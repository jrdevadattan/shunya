//! Structural validators for the formats the multi-format carver produces.
//!
//! Each validator answers one question: does the byte payload end where its
//! own headers say it should? Formats without a sized structure are reported
//! as unverified rather than validated, so the UI never over-claims.

use recovery_domain::RecoveryState;

pub struct Detection {
    pub state: RecoveryState,
    pub findings: Vec<String>,
    pub mime_type: &'static str,
    pub active_content: bool,
}

fn sized(actual: usize, declared: usize, mime_type: &'static str, what: &str) -> Detection {
    let (state, findings) = if actual >= declared {
        (RecoveryState::CompleteValidated, Vec::new())
    } else {
        (
            RecoveryState::PartialValidated,
            vec![format!("{what} declares {declared} bytes but {actual} were recovered")],
        )
    };
    Detection { state, findings, mime_type, active_content: false }
}

fn unverified(mime_type: &'static str, note: &str, active_content: bool) -> Detection {
    Detection {
        state: RecoveryState::CompleteUnverified,
        findings: vec![note.into()],
        mime_type,
        active_content,
    }
}

fn corrupt(mime_type: &'static str, note: &str) -> Detection {
    Detection { state: RecoveryState::Corrupt, findings: vec![note.into()], mime_type, active_content: false }
}

fn u16le(bytes: &[u8], at: usize) -> Option<u16> {
    bytes.get(at..at + 2).map(|v| u16::from_le_bytes([v[0], v[1]]))
}
fn u32le(bytes: &[u8], at: usize) -> Option<u32> {
    bytes.get(at..at + 4).map(|v| u32::from_le_bytes(v.try_into().unwrap()))
}
fn u64le(bytes: &[u8], at: usize) -> Option<u64> {
    bytes.get(at..at + 8).map(|v| u64::from_le_bytes(v.try_into().unwrap()))
}
fn u16be(bytes: &[u8], at: usize) -> Option<u16> {
    bytes.get(at..at + 2).map(|v| u16::from_be_bytes([v[0], v[1]]))
}
fn u32be(bytes: &[u8], at: usize) -> Option<u32> {
    bytes.get(at..at + 4).map(|v| u32::from_be_bytes(v.try_into().unwrap()))
}
fn u64be(bytes: &[u8], at: usize) -> Option<u64> {
    bytes.get(at..at + 8).map(|v| u64::from_be_bytes(v.try_into().unwrap()))
}

/// Detects any container format the base registry does not already handle.
pub fn detect(bytes: &[u8]) -> Option<Detection> {
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some(gif(bytes));
    }
    if bytes.starts_with(b"BM") && bytes.len() >= 26 {
        return bmp(bytes);
    }
    if bytes.starts_with(b"RIFF") {
        return riff(bytes);
    }
    if bytes.starts_with(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1") {
        return Some(ole(bytes));
    }
    if bytes.starts_with(b"7z\xbc\xaf\x27\x1c") {
        return Some(sevenz(bytes));
    }
    if bytes.starts_with(b"Rar!\x1a\x07") {
        return Some(unverified("application/vnd.rar", "RAR archive end is not verifiable without decoding", false));
    }
    if bytes.starts_with(b"\x1f\x8b\x08") {
        return Some(unverified("application/gzip", "GZIP member end is not verifiable without decoding", false));
    }
    if bytes.len() >= 12 && &bytes[4..8] == b"ftyp" {
        return Some(mp4(bytes));
    }
    if bytes.starts_with(b"ID3") {
        return Some(unverified("audio/mpeg", "MP3 frame stream end is not verifiable", false));
    }
    if bytes.starts_with(b"SQLite format 3\0") {
        return Some(sqlite(bytes));
    }
    if bytes.starts_with(b"MZ") {
        return pe(bytes);
    }
    if bytes.starts_with(b"\x7fELF") {
        return elf(bytes);
    }
    None
}

fn gif(bytes: &[u8]) -> Detection {
    if bytes.len() < 14 {
        return corrupt("image/gif", "GIF header is truncated");
    }
    if bytes.last() == Some(&0x3b) {
        Detection { state: RecoveryState::CompleteValidated, findings: Vec::new(), mime_type: "image/gif", active_content: false }
    } else {
        Detection {
            state: RecoveryState::PartialValidated,
            findings: vec!["missing GIF trailer".into()],
            mime_type: "image/gif",
            active_content: false,
        }
    }
}

fn bmp(bytes: &[u8]) -> Option<Detection> {
    let declared = u32le(bytes, 2)? as usize;
    let pixel_offset = u32le(bytes, 10)? as usize;
    if declared < 26 || pixel_offset >= declared {
        return None;
    }
    Some(sized(bytes.len(), declared, "image/bmp", "BMP"))
}

fn riff(bytes: &[u8]) -> Option<Detection> {
    let declared = (u32le(bytes, 4)? as usize).checked_add(8)?;
    let mime = match bytes.get(8..12)? {
        b"WAVE" => "audio/wav",
        b"AVI " => "video/x-msvideo",
        b"WEBP" => "image/webp",
        _ => return None,
    };
    Some(sized(bytes.len(), declared, mime, "RIFF container"))
}

fn ole(bytes: &[u8]) -> Detection {
    let shift = u16le(bytes, 30).unwrap_or(0);
    if !matches!(shift, 9 | 12) {
        return corrupt("application/x-ole-storage", "invalid OLE2 sector size");
    }
    let mime = if contains_utf16(bytes, "WordDocument") {
        "application/msword"
    } else if contains_utf16(bytes, "Workbook") || contains_utf16(bytes, "Book") {
        "application/vnd.ms-excel"
    } else if contains_utf16(bytes, "PowerPoint Document") {
        "application/vnd.ms-powerpoint"
    } else {
        "application/x-ole-storage"
    };
    unverified(mime, "OLE2 stream allocation was not fully walked", true)
}

fn contains_utf16(haystack: &[u8], needle: &str) -> bool {
    let encoded: Vec<u8> = needle.encode_utf16().flat_map(u16::to_le_bytes).collect();
    haystack.windows(encoded.len()).any(|window| window == encoded.as_slice())
}

fn sevenz(bytes: &[u8]) -> Detection {
    let Some(total) = u64le(bytes, 12)
        .zip(u64le(bytes, 20))
        .and_then(|(offset, size)| 32u64.checked_add(offset)?.checked_add(size))
        .and_then(|total| usize::try_from(total).ok())
    else {
        return corrupt("application/x-7z-compressed", "7z signature header is truncated");
    };
    sized(bytes.len(), total, "application/x-7z-compressed", "7z archive")
}

fn mp4(bytes: &[u8]) -> Detection {
    let brand = bytes.get(8..12).unwrap_or_default();
    let mime = match brand {
        b"qt  " => "video/quicktime",
        b"M4A " => "audio/mp4",
        brand if brand.starts_with(b"3gp") || brand.starts_with(b"3g2") => "video/3gpp",
        _ => "video/mp4",
    };
    let mut index = 0;
    let mut saw_moov = false;
    while index + 8 <= bytes.len() {
        let mut size = u32be(bytes, index).unwrap_or(0) as usize;
        let kind = &bytes[index + 4..index + 8];
        let mut header = 8;
        if size == 1 {
            size = u64be(bytes, index + 8).and_then(|v| usize::try_from(v).ok()).unwrap_or(0);
            header = 16;
        } else if size == 0 {
            size = bytes.len() - index;
        }
        if size < header || !kind.iter().all(|byte| (0x20..=0x7e).contains(byte)) {
            return corrupt(mime, "invalid ISO media box header");
        }
        if kind == b"moov" {
            saw_moov = true;
        }
        let Some(end) = index.checked_add(size) else {
            return corrupt(mime, "ISO media box overflows");
        };
        if end > bytes.len() {
            return Detection {
                state: RecoveryState::PartialValidated,
                findings: vec![format!("final ISO media box declares {size} bytes but {} remain", bytes.len() - index)],
                mime_type: mime,
                active_content: false,
            };
        }
        index = end;
    }
    if saw_moov {
        Detection { state: RecoveryState::CompleteValidated, findings: Vec::new(), mime_type: mime, active_content: false }
    } else {
        Detection {
            state: RecoveryState::PartialValidated,
            findings: vec!["missing moov box; media index was not recovered".into()],
            mime_type: mime,
            active_content: false,
        }
    }
}

fn sqlite(bytes: &[u8]) -> Detection {
    let raw = u16be(bytes, 16).unwrap_or(0);
    let page = if raw == 1 { 65_536 } else { usize::from(raw) };
    let pages = u32be(bytes, 28).unwrap_or(0) as usize;
    if page < 512 || !page.is_power_of_two() {
        return corrupt("application/x-sqlite3", "invalid SQLite page size");
    }
    if pages == 0 {
        return unverified("application/x-sqlite3", "SQLite header does not record a page count", false);
    }
    sized(bytes.len(), page.saturating_mul(pages), "application/x-sqlite3", "SQLite database")
}

fn pe(bytes: &[u8]) -> Option<Detection> {
    let pe = u32le(bytes, 0x3c)? as usize;
    if bytes.get(pe..pe + 4)? != b"PE\0\0" {
        return None;
    }
    let sections = usize::from(u16le(bytes, pe + 6)?);
    let optional = usize::from(u16le(bytes, pe + 20)?);
    let table = pe + 24 + optional;
    let mut end = table + sections * 40;
    for section in 0..sections {
        let entry = table + section * 40;
        let raw_size = u32le(bytes, entry + 16)? as usize;
        let raw_pointer = u32le(bytes, entry + 20)? as usize;
        if raw_size != 0 {
            end = end.max(raw_pointer.checked_add(raw_size)?);
        }
    }
    let mut detection = sized(bytes.len(), end, "application/vnd.microsoft.portable-executable", "PE image");
    detection.active_content = true;
    Some(detection)
}

fn elf(bytes: &[u8]) -> Option<Detection> {
    let class = *bytes.get(4)?;
    let little = *bytes.get(5)? == 1;
    let r16 = |at| if little { u16le(bytes, at) } else { u16be(bytes, at) };
    let r32 = |at| if little { u32le(bytes, at) } else { u32be(bytes, at) };
    let r64 = |at| if little { u64le(bytes, at) } else { u64be(bytes, at) };
    let (sh_off, sh_ent, sh_num) = if class == 2 {
        (r64(0x28)?, r16(0x3a)?, r16(0x3c)?)
    } else {
        (u64::from(r32(0x20)?), r16(0x2e)?, r16(0x30)?)
    };
    let end = usize::try_from(sh_off + u64::from(sh_ent) * u64::from(sh_num)).ok()?;
    let mut detection = sized(bytes.len(), end.max(52), "application/x-executable", "ELF image");
    detection.active_content = true;
    Some(detection)
}

/// Refines a ZIP container's MIME type from its local file header names.
pub fn zip_mime_type(bytes: &[u8]) -> (&'static str, bool) {
    let mut index = 0;
    let mut seen = 0;
    let mut result = ("application/zip", false);
    while seen < 64 && bytes.get(index..index + 30).is_some_and(|header| header.starts_with(b"PK\x03\x04")) {
        let flags = u16le(bytes, index + 6).unwrap_or(0);
        let compressed = u32le(bytes, index + 18).unwrap_or(0) as usize;
        let name_length = usize::from(u16le(bytes, index + 26).unwrap_or(0));
        let extra_length = usize::from(u16le(bytes, index + 28).unwrap_or(0));
        let Some(name) = bytes.get(index + 30..index + 30 + name_length) else { break };
        let body = index + 30 + name_length + extra_length;
        if name.starts_with(b"word/") {
            return ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", false);
        }
        if name.starts_with(b"xl/") {
            return ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", false);
        }
        if name.starts_with(b"ppt/") {
            return ("application/vnd.openxmlformats-officedocument.presentationml.presentation", false);
        }
        if name == b"AndroidManifest.xml" || name == b"classes.dex" {
            return ("application/vnd.android.package-archive", true);
        }
        if name == b"META-INF/MANIFEST.MF" {
            result = ("application/java-archive", true);
        }
        if name == b"mimetype" {
            let mime = bytes.get(body..body + compressed.min(80)).unwrap_or_default();
            if mime.starts_with(b"application/vnd.oasis.opendocument.text") {
                return ("application/vnd.oasis.opendocument.text", false);
            }
            if mime.starts_with(b"application/vnd.oasis.opendocument.spreadsheet") {
                return ("application/vnd.oasis.opendocument.spreadsheet", false);
            }
            if mime.starts_with(b"application/vnd.oasis.opendocument.presentation") {
                return ("application/vnd.oasis.opendocument.presentation", false);
            }
        }
        if compressed == 0 && flags & 0x08 != 0 {
            break;
        }
        index = body + compressed;
        seen += 1;
    }
    result
}
