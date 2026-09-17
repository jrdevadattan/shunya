//! Built-in multi-format signature carver.
//!
//! The engine scans a byte image for file headers and bounds each hit with a
//! format-specific structural walk (chunk tables, box sizes, section tables,
//! trailers). Formats without a reliable end marker are bounded by the next
//! recognised header or a per-format cap and are reported as incomplete so the
//! validator can mark them partial instead of the engine guessing.

use crate::FileFamily;

/// One carved region of the source image.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CarvedHit {
    pub offset: usize,
    pub length: usize,
    /// Short format label, e.g. `jpeg`, `docx`, `mp4`.
    pub kind: &'static str,
    /// File extension to store the payload under.
    pub extension: &'static str,
    pub family: FileFamily,
    /// `true` when the structural walk reached the format's own end marker.
    pub complete: bool,
}

struct Bound {
    length: usize,
    kind: &'static str,
    extension: &'static str,
    family: FileFamily,
    complete: bool,
}

struct Signature {
    magic: &'static [u8],
    /// Distance from the magic to the real file start (MP4 `ftyp` sits at +4).
    back: usize,
    /// Families this header can resolve to (a ZIP may turn out to be a DOCX).
    families: &'static [FileFamily],
    bound: fn(&[u8], usize) -> Option<Bound>,
}

const MIB: usize = 1024 * 1024;
const JPEG_CAP: usize = 96 * MIB;
const PNG_CAP: usize = 96 * MIB;
const GIF_CAP: usize = 64 * MIB;
const BMP_CAP: usize = 128 * MIB;
const PDF_CAP: usize = 256 * MIB;
const PDF_PARTIAL_CAP: usize = 8 * MIB;
const ZIP_CAP: usize = 512 * MIB;
const OLE_CAP: usize = 128 * MIB;
const SEVENZ_CAP: usize = 512 * MIB;
const OPEN_ENDED_CAP: usize = 64 * MIB;
const MP4_CAP: usize = 2048 * MIB;
const RIFF_CAP: usize = 2048 * MIB;
const SQLITE_CAP: usize = 512 * MIB;
const PE_CAP: usize = 256 * MIB;
const ELF_CAP: usize = 256 * MIB;
/// How often the cancellation callback is consulted while scanning.
const CANCEL_CHECK_STRIDE: usize = MIB;

const IMAGES: &[FileFamily] = &[FileFamily::Images];
const DOCUMENTS: &[FileFamily] = &[FileFamily::Documents];
const ARCHIVES: &[FileFamily] = &[FileFamily::Archives];
const AUDIO_VIDEO: &[FileFamily] = &[FileFamily::AudioVideo];
const DATABASES: &[FileFamily] = &[FileFamily::Databases];
const EXECUTABLES: &[FileFamily] = &[FileFamily::Executables];
const RIFF_FAMILIES: &[FileFamily] = &[FileFamily::AudioVideo, FileFamily::Images];
const ZIP_FAMILIES: &[FileFamily] = &[
    FileFamily::Archives,
    FileFamily::Documents,
    FileFamily::Executables,
];

const SIGNATURES: &[Signature] = &[
    Signature { magic: b"\xff\xd8\xff", back: 0, families: IMAGES, bound: jpeg },
    Signature { magic: b"\x89PNG\r\n\x1a\n", back: 0, families: IMAGES, bound: png },
    Signature { magic: b"GIF87a", back: 0, families: IMAGES, bound: gif },
    Signature { magic: b"GIF89a", back: 0, families: IMAGES, bound: gif },
    Signature { magic: b"BM", back: 0, families: IMAGES, bound: bmp },
    Signature { magic: b"RIFF", back: 0, families: RIFF_FAMILIES, bound: riff },
    Signature { magic: b"%PDF-", back: 0, families: DOCUMENTS, bound: pdf },
    Signature { magic: b"PK\x03\x04", back: 0, families: ZIP_FAMILIES, bound: zip },
    Signature { magic: b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", back: 0, families: DOCUMENTS, bound: ole },
    Signature { magic: b"7z\xbc\xaf\x27\x1c", back: 0, families: ARCHIVES, bound: sevenz },
    Signature { magic: b"Rar!\x1a\x07", back: 0, families: ARCHIVES, bound: rar },
    Signature { magic: b"\x1f\x8b\x08", back: 0, families: ARCHIVES, bound: gzip },
    Signature { magic: b"ftyp", back: 4, families: AUDIO_VIDEO, bound: mp4 },
    Signature { magic: b"ID3", back: 0, families: AUDIO_VIDEO, bound: mp3 },
    Signature { magic: b"SQLite format 3\0", back: 0, families: DATABASES, bound: sqlite },
    Signature { magic: b"MZ", back: 0, families: EXECUTABLES, bound: pe },
    Signature { magic: b"\x7fELF", back: 0, families: EXECUTABLES, bound: elf },
];

/// Human-readable list of the formats the built-in engine recognises.
pub fn supported_formats() -> &'static [&'static str] {
    &[
        "JPEG", "PNG", "GIF", "BMP", "WebP", "PDF", "DOCX/XLSX/PPTX", "ODT/ODS/ODP", "DOC/XLS/PPT",
        "ZIP", "JAR", "7z", "RAR", "GZIP", "MP4/MOV/M4A/3GP", "WAV", "AVI", "MP3", "SQLite",
        "EXE/DLL", "ELF",
    ]
}

/// Scans `bytes` for every enabled family and returns non-overlapping hits in
/// source order. `keep_going` is polled roughly once per MiB; returning `false`
/// stops the scan and returns the hits found so far.
pub fn carve_signatures(
    bytes: &[u8],
    families: &[FileFamily],
    keep_going: &mut dyn FnMut() -> bool,
) -> Vec<CarvedHit> {
    let mut by_first_byte: [Vec<usize>; 256] = std::array::from_fn(|_| Vec::new());
    for (index, signature) in SIGNATURES.iter().enumerate() {
        if signature
            .families
            .iter()
            .any(|family| families.contains(family))
        {
            by_first_byte[signature.magic[0] as usize].push(index);
        }
    }
    let mut hits = Vec::new();
    let mut position = 0;
    let mut next_cancel_check = CANCEL_CHECK_STRIDE;
    while position < bytes.len() {
        if position >= next_cancel_check {
            next_cancel_check = position + CANCEL_CHECK_STRIDE;
            if !keep_going() {
                break;
            }
        }
        match match_at(bytes, position, &by_first_byte) {
            Some((start, bound)) if bound.length > 0 => {
                // Skip the whole structure either way; only report it when the
                // format it resolved to is one the operator asked for.
                position = start + bound.length;
                if families.contains(&bound.family) {
                    hits.push(CarvedHit {
                        offset: start,
                        length: bound.length,
                        kind: bound.kind,
                        extension: bound.extension,
                        family: bound.family,
                        complete: bound.complete,
                    });
                }
            }
            _ => position += 1,
        }
    }
    hits
}

fn match_at(bytes: &[u8], position: usize, table: &[Vec<usize>; 256]) -> Option<(usize, Bound)> {
    for &index in &table[bytes[position] as usize] {
        let signature = &SIGNATURES[index];
        if position < signature.back || !bytes[position..].starts_with(signature.magic) {
            continue;
        }
        let start = position - signature.back;
        if let Some(bound) = (signature.bound)(bytes, start) {
            return Some((start, bound));
        }
    }
    None
}

/// Offset of the next recognised header after `from`, bounded by `limit`.
fn next_header(bytes: &[u8], from: usize, limit: usize) -> Option<usize> {
    let end = limit.min(bytes.len());
    let mut position = from;
    while position < end {
        for signature in SIGNATURES {
            if position >= signature.back
                && bytes[position..end].starts_with(signature.magic)
                && (signature.bound)(bytes, position - signature.back).is_some()
            {
                return Some(position - signature.back);
            }
        }
        position += 1;
    }
    None
}

fn bound(length: usize, kind: &'static str, extension: &'static str, family: FileFamily, complete: bool) -> Option<Bound> {
    (length > 0).then_some(Bound { length, kind, extension, family, complete })
}

fn find(haystack: &[u8], needle: &[u8], from: usize) -> Option<usize> {
    if from >= haystack.len() || needle.is_empty() {
        return None;
    }
    haystack[from..]
        .windows(needle.len())
        .position(|window| window == needle)
        .map(|found| found + from)
}

fn u16le(bytes: &[u8], at: usize) -> Option<u16> {
    bytes.get(at..at + 2).map(|value| u16::from_le_bytes([value[0], value[1]]))
}
fn u32le(bytes: &[u8], at: usize) -> Option<u32> {
    bytes.get(at..at + 4).map(|value| u32::from_le_bytes(value.try_into().unwrap()))
}
fn u64le(bytes: &[u8], at: usize) -> Option<u64> {
    bytes.get(at..at + 8).map(|value| u64::from_le_bytes(value.try_into().unwrap()))
}
fn u16be(bytes: &[u8], at: usize) -> Option<u16> {
    bytes.get(at..at + 2).map(|value| u16::from_be_bytes([value[0], value[1]]))
}
fn u32be(bytes: &[u8], at: usize) -> Option<u32> {
    bytes.get(at..at + 4).map(|value| u32::from_be_bytes(value.try_into().unwrap()))
}
fn u64be(bytes: &[u8], at: usize) -> Option<u64> {
    bytes.get(at..at + 8).map(|value| u64::from_be_bytes(value.try_into().unwrap()))
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/// JPEG: walk marker segments to the SOS, then scan entropy-coded data for the
/// real EOI. Embedded EXIF thumbnails live inside APP1 segments and are skipped
/// by their declared length, so their EOI never truncates the outer image.
fn jpeg(bytes: &[u8], start: usize) -> Option<Bound> {
    let data = &bytes[start..];
    let limit = data.len().min(JPEG_CAP);
    let marker = *data.get(3)?;
    if !(0xc0..=0xfe).contains(&marker) {
        return None;
    }
    let mut index = 2;
    while index + 4 <= limit {
        if data[index] != 0xff {
            return jpeg_fallback(data, limit);
        }
        let marker = data[index + 1];
        match marker {
            0xff => index += 1,
            0xd8 | 0x01 | 0xd0..=0xd7 => index += 2,
            0xd9 => return bound(index + 2, "jpeg", "jpg", FileFamily::Images, true),
            0xda => {
                let segment = usize::from(u16be(data, index + 2)?);
                if segment < 2 {
                    return jpeg_fallback(data, limit);
                }
                index += 2 + segment;
                // Entropy-coded data: only FF00 (stuffing) and FFD0-D7 (restart)
                // may appear before the next real marker.
                while index + 1 < limit {
                    if data[index] == 0xff {
                        let next = data[index + 1];
                        if next == 0xd9 {
                            return bound(index + 2, "jpeg", "jpg", FileFamily::Images, true);
                        }
                        if next == 0x00 || next == 0xff || (0xd0..=0xd7).contains(&next) {
                            index += 1;
                            continue;
                        }
                        // A structural marker (DHT/DQT/SOS for progressive scans).
                        break;
                    }
                    index += 1;
                }
                if index + 1 >= limit {
                    return bound(limit, "jpeg", "jpg", FileFamily::Images, false);
                }
            }
            _ => {
                let segment = usize::from(u16be(data, index + 2)?);
                if segment < 2 {
                    return jpeg_fallback(data, limit);
                }
                index += 2 + segment;
            }
        }
    }
    bound(limit.min(index.max(4)), "jpeg", "jpg", FileFamily::Images, false)
}

fn jpeg_fallback(data: &[u8], limit: usize) -> Option<Bound> {
    let end = find(&data[..limit], b"\xff\xd9", 3)? + 2;
    bound(end, "jpeg", "jpg", FileFamily::Images, true)
}

/// PNG: walk `length | type | data | crc` chunks until IEND.
fn png(bytes: &[u8], start: usize) -> Option<Bound> {
    let data = &bytes[start..];
    let limit = data.len().min(PNG_CAP);
    if data.get(12..16)? != b"IHDR" {
        return None;
    }
    let mut index = 8;
    let mut last_good = 0;
    while index + 12 <= limit {
        let length = u32be(data, index)? as usize;
        let kind = &data[index + 4..index + 8];
        if !kind.iter().all(u8::is_ascii_alphabetic) {
            break;
        }
        let Some(end) = index.checked_add(12 + length) else { break };
        if end > limit {
            break;
        }
        last_good = end;
        if kind == b"IEND" {
            return bound(end, "png", "png", FileFamily::Images, true);
        }
        index = end;
    }
    (last_good > 33).then_some(Bound { length: last_good, kind: "png", extension: "png", family: FileFamily::Images, complete: false })
}

/// GIF: header, screen descriptor, optional colour tables, then blocks until
/// the 0x3B trailer.
fn gif(bytes: &[u8], start: usize) -> Option<Bound> {
    let data = &bytes[start..];
    let limit = data.len().min(GIF_CAP);
    if limit < 14 {
        return None;
    }
    let flags = data[10];
    let mut index = 13;
    if flags & 0x80 != 0 {
        index += 3 << ((flags & 0x07) + 1);
    }
    let mut last_good = index.min(limit);
    let mut blocks = 0;
    while index < limit {
        match data[index] {
            0x3b => return bound(index + 1, "gif", "gif", FileFamily::Images, true),
            0x2c => {
                if index + 10 > limit {
                    break;
                }
                let local = data[index + 9];
                index += 10;
                if local & 0x80 != 0 {
                    index += 3 << ((local & 0x07) + 1);
                }
                index += 1;
                index = match gif_sub_blocks(data, index, limit) {
                    Some(next) => next,
                    None => break,
                };
            }
            0x21 => {
                index += 2;
                index = match gif_sub_blocks(data, index, limit) {
                    Some(next) => next,
                    None => break,
                };
            }
            _ => break,
        }
        blocks += 1;
        last_good = index;
    }
    (blocks > 0).then(|| Bound { length: last_good.min(limit), kind: "gif", extension: "gif", family: FileFamily::Images, complete: false })
}

fn gif_sub_blocks(data: &[u8], mut index: usize, limit: usize) -> Option<usize> {
    loop {
        let size = *data.get(index)?;
        index += 1;
        if size == 0 {
            return (index <= limit).then_some(index);
        }
        index += usize::from(size);
        if index > limit {
            return None;
        }
    }
}

/// BMP: the declared file size in the header, sanity-checked against the
/// pixel-data offset and DIB header size.
fn bmp(bytes: &[u8], start: usize) -> Option<Bound> {
    let data = &bytes[start..];
    let size = u32le(data, 2)? as usize;
    let pixel_offset = u32le(data, 10)? as usize;
    let dib = u32le(data, 14)?;
    if !(26..=BMP_CAP).contains(&size)
        || pixel_offset >= size
        || pixel_offset < 26
        || !matches!(dib, 12 | 16 | 40 | 52 | 56 | 64 | 108 | 124)
    {
        return None;
    }
    let available = data.len();
    bound(size.min(available), "bmp", "bmp", FileFamily::Images, size <= available)
}

/// RIFF containers: WAV, AVI and WebP share `RIFF <size> <form>`.
fn riff(bytes: &[u8], start: usize) -> Option<Bound> {
    let data = &bytes[start..];
    let size = u32le(data, 4)? as usize;
    let (kind, extension, family) = match data.get(8..12)? {
        b"WAVE" => ("wav", "wav", FileFamily::AudioVideo),
        b"AVI " => ("avi", "avi", FileFamily::AudioVideo),
        b"WEBP" => ("webp", "webp", FileFamily::Images),
        _ => return None,
    };
    let total = size.checked_add(8)?;
    if !(16..=RIFF_CAP).contains(&total) {
        return None;
    }
    let available = data.len();
    bound(total.min(available), kind, extension, family, total <= available)
}

// ---------------------------------------------------------------------------
// Documents and archives
// ---------------------------------------------------------------------------

/// PDF: the last `%%EOF` before the next PDF header (incremental updates add
/// several). Without any EOF the document is reported as an incomplete slice.
fn pdf(bytes: &[u8], start: usize) -> Option<Bound> {
    let data = &bytes[start..];
    let limit = data.len().min(PDF_CAP);
    let window = &data[..limit];
    let stop = find(window, b"%PDF-", 5).unwrap_or(limit);
    let mut cursor = 5;
    let mut last_eof = None;
    while let Some(found) = find(&window[..stop], b"%%EOF", cursor) {
        last_eof = Some(found + 5);
        cursor = found + 5;
    }
    match last_eof {
        Some(mut end) => {
            while end < stop && matches!(window[end], b'\r' | b'\n' | b' ') && end - (cursor) < 3 {
                end += 1;
            }
            bound(end, "pdf", "pdf", FileFamily::Documents, true)
        }
        None => bound(stop.min(PDF_PARTIAL_CAP), "pdf", "pdf", FileFamily::Documents, false),
    }
}

/// ZIP: locate the end-of-central-directory record whose central-directory
/// offset and size agree with this archive's start, so nested archives never
/// close the outer one early. Office and Java packages are named by content.
fn zip(bytes: &[u8], start: usize) -> Option<Bound> {
    let data = &bytes[start..];
    let limit = data.len().min(ZIP_CAP);
    let window = &data[..limit];
    let mut cursor = 4;
    while let Some(eocd) = find(window, b"PK\x05\x06", cursor) {
        cursor = eocd + 4;
        let (Some(cd_size), Some(cd_offset), Some(comment)) = (u32le(window, eocd + 12), u32le(window, eocd + 16), u16le(window, eocd + 20)) else {
            break;
        };
        let zip64 = cd_offset == u32::MAX || cd_size == u32::MAX;
        let consistent = (cd_offset as u64 + cd_size as u64) == eocd as u64;
        if !(zip64 || consistent) {
            continue;
        }
        let end = (eocd + 22 + usize::from(comment)).min(limit);
        let (kind, extension, family) = zip_subtype(&window[..end]);
        return bound(end, kind, extension, family, true);
    }
    None
}

/// Classifies a ZIP by the entry names in its local file headers.
pub(crate) fn zip_subtype(data: &[u8]) -> (&'static str, &'static str, FileFamily) {
    let mut index = 0;
    let mut seen = 0;
    let mut result = ("zip", "zip", FileFamily::Archives);
    while seen < 64 && data.get(index..index + 30).is_some_and(|header| header.starts_with(b"PK\x03\x04")) {
        let flags = u16le(data, index + 6).unwrap_or(0);
        let compressed = u32le(data, index + 18).unwrap_or(0) as usize;
        let name_length = usize::from(u16le(data, index + 26).unwrap_or(0));
        let extra_length = usize::from(u16le(data, index + 28).unwrap_or(0));
        let Some(name) = data.get(index + 30..index + 30 + name_length) else { break };
        let body = index + 30 + name_length + extra_length;
        if name.starts_with(b"word/") {
            return ("docx", "docx", FileFamily::Documents);
        }
        if name.starts_with(b"xl/") {
            return ("xlsx", "xlsx", FileFamily::Documents);
        }
        if name.starts_with(b"ppt/") {
            return ("pptx", "pptx", FileFamily::Documents);
        }
        if name == b"AndroidManifest.xml" || name == b"classes.dex" {
            return ("apk", "apk", FileFamily::Executables);
        }
        if name == b"META-INF/MANIFEST.MF" {
            result = ("jar", "jar", FileFamily::Executables);
        }
        if name == b"mimetype" {
            let mime = data.get(body..body + compressed.min(80)).unwrap_or_default();
            if mime.starts_with(b"application/vnd.oasis.opendocument.text") {
                return ("odt", "odt", FileFamily::Documents);
            }
            if mime.starts_with(b"application/vnd.oasis.opendocument.spreadsheet") {
                return ("ods", "ods", FileFamily::Documents);
            }
            if mime.starts_with(b"application/vnd.oasis.opendocument.presentation") {
                return ("odp", "odp", FileFamily::Documents);
            }
        }
        if compressed == 0 && flags & 0x08 != 0 {
            // Sizes live in a trailing data descriptor; the walk cannot continue.
            break;
        }
        index = body + compressed;
        seen += 1;
    }
    result
}

/// OLE2 compound files (legacy Office). The FAT sector count gives a hard
/// upper bound on the file size; the directory names pick the application.
fn ole(bytes: &[u8], start: usize) -> Option<Bound> {
    let data = &bytes[start..];
    let sector_shift = u16le(data, 30)?;
    if !matches!(sector_shift, 9 | 12) {
        return None;
    }
    let sector = 1usize << sector_shift;
    let fat_sectors = u32le(data, 44)? as usize;
    if fat_sectors == 0 || fat_sectors > 65_536 {
        return None;
    }
    let upper = fat_sectors.checked_mul(sector / 4)?.checked_mul(sector)?.checked_add(sector)?;
    let length = upper.min(OLE_CAP).min(data.len());
    let region = &data[..length];
    let (kind, extension) = if contains_utf16(region, "WordDocument") {
        ("doc", "doc")
    } else if contains_utf16(region, "Workbook") || contains_utf16(region, "Book") {
        ("xls", "xls")
    } else if contains_utf16(region, "PowerPoint Document") {
        ("ppt", "ppt")
    } else {
        ("ole", "ole")
    };
    bound(length, kind, extension, FileFamily::Documents, false)
}

fn contains_utf16(haystack: &[u8], needle: &str) -> bool {
    let encoded: Vec<u8> = needle.encode_utf16().flat_map(u16::to_le_bytes).collect();
    find(haystack, &encoded, 0).is_some()
}

/// 7-Zip: `32 + next header offset + next header size` from the signature header.
fn sevenz(bytes: &[u8], start: usize) -> Option<Bound> {
    let data = &bytes[start..];
    let offset = u64le(data, 12)?;
    let size = u64le(data, 20)?;
    let total = usize::try_from(32u64.checked_add(offset)?.checked_add(size)?).ok()?;
    if !(32..=SEVENZ_CAP).contains(&total) {
        return None;
    }
    let available = data.len();
    bound(total.min(available), "7z", "7z", FileFamily::Archives, total <= available)
}

/// RAR has no cheap end marker: bounded by the next header or the cap.
fn rar(bytes: &[u8], start: usize) -> Option<Bound> {
    let version = *bytes.get(start + 6)?;
    if version != 0x00 && version != 0x01 {
        return None;
    }
    open_ended(bytes, start, 8, "rar", "rar", FileFamily::Archives)
}

/// GZIP members carry their size only in the trailer: bounded by the next header.
fn gzip(bytes: &[u8], start: usize) -> Option<Bound> {
    let flags = *bytes.get(start + 3)?;
    if flags & 0xe0 != 0 {
        return None;
    }
    open_ended(bytes, start, 10, "gzip", "gz", FileFamily::Archives)
}

fn open_ended(bytes: &[u8], start: usize, header: usize, kind: &'static str, extension: &'static str, family: FileFamily) -> Option<Bound> {
    let limit = start.saturating_add(OPEN_ENDED_CAP).min(bytes.len());
    let end = next_header(bytes, start + header, limit).unwrap_or(limit);
    bound(end - start, kind, extension, family, false)
}

// ---------------------------------------------------------------------------
// Audio and video
// ---------------------------------------------------------------------------

/// ISO base media (MP4/MOV/M4A/3GP): walk top-level boxes from `ftyp`.
fn mp4(bytes: &[u8], start: usize) -> Option<Bound> {
    let data = &bytes[start..];
    let limit = data.len().min(MP4_CAP);
    let first = u32be(data, 0)? as usize;
    if !(8..=64).contains(&first) {
        return None;
    }
    let brand = data.get(8..12)?;
    let (kind, extension) = match brand {
        b"qt  " => ("mov", "mov"),
        b"M4A " => ("m4a", "m4a"),
        b"M4V " => ("m4v", "m4v"),
        brand if brand.starts_with(b"3gp") || brand.starts_with(b"3g2") => ("3gp", "3gp"),
        _ => ("mp4", "mp4"),
    };
    let mut index = 0;
    let mut boxes = 0;
    let mut saw_media = false;
    while index + 8 <= limit {
        let mut size = u32be(data, index)? as usize;
        let kind_bytes = &data[index + 4..index + 8];
        if !kind_bytes.iter().all(|byte| (0x20..=0x7e).contains(byte)) {
            break;
        }
        let mut header = 8;
        if size == 1 {
            size = usize::try_from(u64be(data, index + 8)?).ok()?;
            header = 16;
        } else if size == 0 {
            size = limit - index;
        }
        if size < header {
            break;
        }
        if matches!(kind_bytes, b"moov" | b"mdat") {
            saw_media = true;
        }
        let Some(end) = index.checked_add(size) else { break };
        if end > limit {
            // The final box is cut off by the end of the readable region.
            return (boxes > 0).then_some(Bound { length: limit, kind, extension, family: FileFamily::AudioVideo, complete: false });
        }
        boxes += 1;
        index = end;
    }
    if boxes < 2 {
        return None;
    }
    bound(index, kind, extension, FileFamily::AudioVideo, saw_media)
}

/// MP3 with an ID3v2 tag: the tag is sized, the audio frames are open-ended.
fn mp3(bytes: &[u8], start: usize) -> Option<Bound> {
    let data = &bytes[start..];
    let major = *data.get(3)?;
    if !(2..=4).contains(&major) || *data.get(4)? == 0xff {
        return None;
    }
    let size = data.get(6..10)?;
    if size.iter().any(|byte| byte & 0x80 != 0) {
        return None;
    }
    let tag = 10 + size.iter().fold(0usize, |acc, byte| (acc << 7) | usize::from(*byte));
    if tag > data.len() {
        return None;
    }
    let limit = start.saturating_add(OPEN_ENDED_CAP).min(bytes.len());
    let end = next_header(bytes, start + tag, limit).unwrap_or(limit);
    bound(end - start, "mp3", "mp3", FileFamily::AudioVideo, false)
}

// ---------------------------------------------------------------------------
// Databases and executables
// ---------------------------------------------------------------------------

/// SQLite 3: `page size × page count` from the database header.
fn sqlite(bytes: &[u8], start: usize) -> Option<Bound> {
    let data = &bytes[start..];
    let raw_page = u16be(data, 16)?;
    let page = if raw_page == 1 { 65_536 } else { usize::from(raw_page) };
    if page < 512 || !page.is_power_of_two() {
        return None;
    }
    let pages = u32be(data, 28)? as usize;
    let total = if pages == 0 { SQLITE_CAP } else { page.checked_mul(pages)? };
    if total > SQLITE_CAP {
        return None;
    }
    let available = data.len();
    bound(total.min(available), "sqlite", "sqlite", FileFamily::Databases, pages != 0 && total <= available)
}

/// PE (EXE/DLL): the furthest section or certificate table end.
fn pe(bytes: &[u8], start: usize) -> Option<Bound> {
    let data = &bytes[start..];
    let pe_offset = u32le(data, 0x3c)? as usize;
    if !(0x40..0x1000).contains(&pe_offset) || data.get(pe_offset..pe_offset + 4)? != b"PE\0\0" {
        return None;
    }
    let sections = usize::from(u16le(data, pe_offset + 6)?);
    let optional_size = usize::from(u16le(data, pe_offset + 20)?);
    let characteristics = u16le(data, pe_offset + 22)?;
    if sections == 0 || sections > 96 {
        return None;
    }
    let optional = pe_offset + 24;
    let mut end = optional + optional_size + sections * 40;
    let directories = match u16le(data, optional)? {
        0x10b => optional + 96,
        0x20b => optional + 112,
        _ => return None,
    };
    if let (Some(certificate_offset), Some(certificate_size)) = (u32le(data, directories + 4 * 8), u32le(data, directories + 4 * 8 + 4))
        && certificate_offset != 0
        && certificate_size != 0
    {
        end = end.max(certificate_offset as usize + certificate_size as usize);
    }
    let table = optional + optional_size;
    for section in 0..sections {
        let entry = table + section * 40;
        let raw_size = u32le(data, entry + 16)? as usize;
        let raw_pointer = u32le(data, entry + 20)? as usize;
        if raw_size != 0 {
            end = end.max(raw_pointer.checked_add(raw_size)?);
        }
    }
    if end > PE_CAP {
        return None;
    }
    let (kind, extension) = if characteristics & 0x2000 != 0 { ("dll", "dll") } else { ("exe", "exe") };
    let available = data.len();
    bound(end.min(available), kind, extension, FileFamily::Executables, end <= available)
}

/// ELF: the furthest of the program-header and section-header tables.
fn elf(bytes: &[u8], start: usize) -> Option<Bound> {
    let data = &bytes[start..];
    let class = *data.get(4)?;
    let encoding = *data.get(5)?;
    if !matches!(class, 1 | 2) || !matches!(encoding, 1 | 2) {
        return None;
    }
    let read16 = |at: usize| if encoding == 1 { u16le(data, at) } else { u16be(data, at) };
    let read32 = |at: usize| if encoding == 1 { u32le(data, at) } else { u32be(data, at) };
    let read64 = |at: usize| if encoding == 1 { u64le(data, at) } else { u64be(data, at) };
    let (ph_off, sh_off, ph_ent, ph_num, sh_ent, sh_num, header) = if class == 2 {
        (read64(0x20)?, read64(0x28)?, read16(0x36)?, read16(0x38)?, read16(0x3a)?, read16(0x3c)?, 64u64)
    } else {
        (u64::from(read32(0x1c)?), u64::from(read32(0x20)?), read16(0x2a)?, read16(0x2c)?, read16(0x2e)?, read16(0x30)?, 52u64)
    };
    let program_end = ph_off.checked_add(u64::from(ph_ent) * u64::from(ph_num))?;
    let section_end = sh_off.checked_add(u64::from(sh_ent) * u64::from(sh_num))?;
    let end = usize::try_from(header.max(program_end).max(section_end)).ok()?;
    if end > ELF_CAP {
        return None;
    }
    let available = data.len();
    bound(end.min(available), "elf", "elf", FileFamily::Executables, end <= available)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn png_fixture() -> Vec<u8> {
        let mut png = b"\x89PNG\r\n\x1a\n".to_vec();
        png.extend_from_slice(&13u32.to_be_bytes());
        png.extend_from_slice(b"IHDR");
        png.extend_from_slice(&[0; 13]);
        png.extend_from_slice(&[0; 4]);
        png.extend_from_slice(&0u32.to_be_bytes());
        png.extend_from_slice(b"IEND");
        png.extend_from_slice(&[0; 4]);
        png
    }

    #[test]
    fn jpeg_skips_the_exif_thumbnail_eoi() {
        let mut jpeg = vec![0xff, 0xd8, 0xff, 0xe1];
        let thumbnail = [0xffu8, 0xd8, 0xff, 0xd9];
        let segment_length = (2 + thumbnail.len()) as u16;
        jpeg.extend_from_slice(&segment_length.to_be_bytes());
        jpeg.extend_from_slice(&thumbnail);
        jpeg.extend_from_slice(&[0xff, 0xda, 0x00, 0x02]);
        jpeg.extend_from_slice(&[0x12, 0xff, 0x00, 0x34, 0xff, 0xd9]);
        let hits = carve_signatures(&jpeg, &FileFamily::ALL, &mut || true);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].length, jpeg.len());
        assert!(hits[0].complete);
    }

    #[test]
    fn carves_multiple_formats_in_source_order() {
        let mut image = vec![0u8; 8192];
        let png = png_fixture();
        image[100..100 + png.len()].copy_from_slice(&png);
        let pdf = b"%PDF-1.4\nhello\n%%EOF\n";
        image[1000..1000 + pdf.len()].copy_from_slice(pdf);
        let mut sqlite = b"SQLite format 3\0".to_vec();
        sqlite.resize(100, 0);
        sqlite[16..18].copy_from_slice(&512u16.to_be_bytes());
        sqlite[28..32].copy_from_slice(&2u32.to_be_bytes());
        image[2000..2100].copy_from_slice(&sqlite);
        let hits = carve_signatures(&image, &FileFamily::ALL, &mut || true);
        let kinds: Vec<_> = hits.iter().map(|hit| hit.kind).collect();
        assert_eq!(kinds, vec!["png", "pdf", "sqlite"]);
        assert_eq!(hits[0].length, png.len());
        assert_eq!(hits[1].length, pdf.len());
        assert_eq!(hits[2].length, 1024);
        assert!(hits[2].complete);
    }

    #[test]
    fn family_filter_limits_the_scan() {
        let mut image = vec![0u8; 4096];
        let png = png_fixture();
        image[10..10 + png.len()].copy_from_slice(&png);
        let pdf = b"%PDF-1.4\n%%EOF";
        image[500..500 + pdf.len()].copy_from_slice(pdf);
        let hits = carve_signatures(&image, &[FileFamily::Documents], &mut || true);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].kind, "pdf");
    }

    #[test]
    fn zip_uses_the_matching_central_directory_record_and_names_office_files() {
        let name = b"word/document.xml";
        let mut zip = b"PK\x03\x04".to_vec();
        zip.extend_from_slice(&[0; 14]);
        zip.extend_from_slice(&5u32.to_le_bytes());
        zip.extend_from_slice(&5u32.to_le_bytes());
        zip.extend_from_slice(&(name.len() as u16).to_le_bytes());
        zip.extend_from_slice(&0u16.to_le_bytes());
        zip.extend_from_slice(name);
        zip.extend_from_slice(b"hello");
        let central_offset = zip.len() as u32;
        zip.extend_from_slice(b"PK\x01\x02");
        zip.extend_from_slice(&[0; 42]);
        let central_size = zip.len() as u32 - central_offset;
        zip.extend_from_slice(b"PK\x05\x06");
        zip.extend_from_slice(&[0; 8]);
        zip.extend_from_slice(&central_size.to_le_bytes());
        zip.extend_from_slice(&central_offset.to_le_bytes());
        zip.extend_from_slice(&0u16.to_le_bytes());
        let mut image = vec![0u8; 2048];
        image[64..64 + zip.len()].copy_from_slice(&zip);
        let hits = carve_signatures(&image, &FileFamily::ALL, &mut || true);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].kind, "docx");
        assert_eq!(hits[0].family, FileFamily::Documents);
        assert_eq!(hits[0].length, zip.len());
    }

    #[test]
    fn mp4_walks_boxes_and_reports_truncation() {
        let mut mp4 = Vec::new();
        mp4.extend_from_slice(&16u32.to_be_bytes());
        mp4.extend_from_slice(b"ftypisom");
        mp4.extend_from_slice(&[0; 4]);
        mp4.extend_from_slice(&24u32.to_be_bytes());
        mp4.extend_from_slice(b"moov");
        mp4.extend_from_slice(&[0; 16]);
        mp4.extend_from_slice(&64u32.to_be_bytes());
        mp4.extend_from_slice(b"mdat");
        mp4.extend_from_slice(&[1; 20]);
        let hits = carve_signatures(&mp4, &[FileFamily::AudioVideo], &mut || true);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].kind, "mp4");
        assert_eq!(hits[0].length, mp4.len());
        assert!(!hits[0].complete);
    }

    #[test]
    fn cancellation_stops_the_scan_early() {
        let image = vec![0u8; 3 * MIB];
        let mut calls = 0;
        let hits = carve_signatures(&image, &FileFamily::ALL, &mut || {
            calls += 1;
            false
        });
        assert!(hits.is_empty());
        assert_eq!(calls, 1);
    }
}
