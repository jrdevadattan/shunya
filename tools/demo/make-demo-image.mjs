// Generates a deterministic demo evidence image for the SIH recovery demo.
//
// The image contains a FAT32 partition and REAL, openable files of several
// families scattered through the data area (simulating deleted files in
// unallocated space): rendered JPEG/PNG/GIF/BMP pictures with visible titles,
// a PDF with text, a Word document, a SQLite database, a WAV recording and a
// ZIP archive. One JPEG carries the EICAR test signature in a comment segment
// so the real YARA-X engine flags it as a potential threat while the picture
// itself still opens.
//
//   node tools/demo/make-demo-image.mjs                 # built-in evidence set
//   node tools/demo/make-demo-image.mjs --from <dir>    # also embed your own files
//   node tools/demo/make-demo-image.mjs --out <path>    # write elsewhere
//
// JPEG encoding uses Chromium's encoder via the repository's Electron build
// (tools/demo/encode-jpeg.cjs); everything else is produced in plain Node.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');

const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const extraDirs = args.flatMap((value, index) => (value === '--from' && args[index + 1] ? [args[index + 1]] : []));
const outPath = option('--out') ?? path.join(repo, 'SIH_DEMO_KIT/assets/demo_evidence.raw');

// EICAR standard antivirus test string (harmless; the industry-standard way to
// prove threat detection works without using real malware).
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

// ---------------------------------------------------------------------------
// Tiny raster toolkit: RGB canvas, shapes, 5x7 bitmap font.
// ---------------------------------------------------------------------------

const FONT = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..###', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '###..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  ':': ['.....', '..#..', '..#..', '.....', '..#..', '..#..', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '..#..', '..#..'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
};

function canvas(width, height) {
  return { width, height, px: Buffer.alloc(width * height * 3) };
}
function put(c, x, y, [r, g, b]) {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  const i = (y * c.width + x) * 3;
  c.px[i] = r; c.px[i + 1] = g; c.px[i + 2] = b;
}
function gradient(c, from, to, diagonal = true) {
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const t = diagonal ? (x / c.width + y / c.height) / 2 : y / c.height;
    put(c, x, y, from.map((v, i) => Math.round(v + (to[i] - v) * t)));
  }
}
function rect(c, x, y, w, h, color) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(c, i, j, color); }
function circle(c, cx, cy, r, color) { for (let j = cy - r; j <= cy + r; j++) for (let i = cx - r; i <= cx + r; i++) if ((i - cx) ** 2 + (j - cy) ** 2 <= r * r) put(c, i, j, color); }
function text(c, string, x, y, scale, color) {
  let cursor = x;
  for (const raw of string.toUpperCase()) {
    const glyph = FONT[raw] ?? FONT[' '];
    glyph.forEach((row, gy) => [...row].forEach((cell, gx) => { if (cell === '#') rect(c, cursor + gx * scale, y + gy * scale, scale, scale, color); }));
    cursor += 6 * scale;
  }
}
function textWidth(string, scale) { return string.length * 6 * scale - scale; }
function centeredText(c, string, y, scale, color) { text(c, string, Math.round((c.width - textWidth(string, scale)) / 2), y, scale, color); }
function watermark(c) { text(c, 'SHUNYA DEMO EVIDENCE', 12, c.height - 22, 2, [255, 255, 255]); }

// ---------------------------------------------------------------------------
// Encoders: PNG, BMP, GIF, ZIP (stored), PDF, WAV. CRC32 shared by PNG/ZIP.
// ---------------------------------------------------------------------------

const CRC_TABLE = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buffer, seed = 0) { let c = ~seed >>> 0; for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8); return ~c >>> 0; }
const u16le = (v) => { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; };
const u32le = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b; };
const u32be = (v) => { const b = Buffer.alloc(4); b.writeUInt32BE(v >>> 0); return b; };

function png(c) {
  const chunk = (type, data) => { const t = Buffer.from(type, 'ascii'); return Buffer.concat([u32be(data.length), t, data, u32be(crc32(Buffer.concat([t, data])))]); };
  const rows = Buffer.alloc((c.width * 3 + 1) * c.height);
  for (let y = 0; y < c.height; y++) { rows[y * (c.width * 3 + 1)] = 0; c.px.copy(rows, y * (c.width * 3 + 1) + 1, y * c.width * 3, (y + 1) * c.width * 3); }
  const ihdr = Buffer.concat([u32be(c.width), u32be(c.height), Buffer.from([8, 2, 0, 0, 0])]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function bmp(c) {
  const rowBytes = (c.width * 3 + 3) & ~3;
  const pixels = Buffer.alloc(rowBytes * c.height);
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const s = (y * c.width + x) * 3; const d = (c.height - 1 - y) * rowBytes + x * 3;
    pixels[d] = c.px[s + 2]; pixels[d + 1] = c.px[s + 1]; pixels[d + 2] = c.px[s];
  }
  const header = Buffer.concat([Buffer.from('BM', 'ascii'), u32le(54 + pixels.length), u32le(0), u32le(54), u32le(40), u32le(c.width), u32le(c.height), u16le(1), u16le(24), u32le(0), u32le(pixels.length), u32le(2835), u32le(2835), u32le(0), u32le(0)]);
  return Buffer.concat([header, pixels]);
}

// GIF89a with a 6x6x6 colour cube palette and a standard LZW encoder.
function gif(c) {
  const palette = Buffer.alloc(256 * 3);
  for (let i = 0; i < 216; i++) { palette[i * 3] = Math.floor(i / 36) * 51; palette[i * 3 + 1] = Math.floor(i / 6 % 6) * 51; palette[i * 3 + 2] = (i % 6) * 51; }
  const indices = new Uint8Array(c.width * c.height);
  for (let i = 0; i < indices.length; i++) indices[i] = Math.round(c.px[i * 3] / 51) * 36 + Math.round(c.px[i * 3 + 1] / 51) * 6 + Math.round(c.px[i * 3 + 2] / 51);
  const out = []; let bits = 0, bitCount = 0, codeSize = 9, next = 258;
  const emit = (code) => { bits |= code << bitCount; bitCount += codeSize; while (bitCount >= 8) { out.push(bits & 0xff); bits >>>= 8; bitCount -= 8; } };
  let table = new Map();
  emit(256);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const key = prefix * 256 + indices[i];
    if (table.has(key)) { prefix = table.get(key); continue; }
    emit(prefix);
    if (next === 4096) { emit(256); table = new Map(); next = 258; codeSize = 9; }
    else { if (next >= 1 << codeSize) codeSize++; table.set(key, next++); }
    prefix = indices[i];
  }
  emit(prefix); emit(257);
  if (bitCount > 0) out.push(bits & 0xff);
  const blocks = [];
  for (let i = 0; i < out.length; i += 255) { const slice = out.slice(i, i + 255); blocks.push(Buffer.from([slice.length]), Buffer.from(slice)); }
  return Buffer.concat([Buffer.from('GIF89a', 'ascii'), u16le(c.width), u16le(c.height), Buffer.from([0xf7, 0, 0]), palette, Buffer.from([0x2c]), u16le(0), u16le(0), u16le(c.width), u16le(c.height), Buffer.from([0, 8]), ...blocks, Buffer.from([0, 0x3b])]);
}

// Stored (uncompressed) ZIP that Explorer, Word and unzip all accept.
function zip(entries) {
  const locals = []; const centrals = []; let offset = 0;
  for (const [name, data] of entries) {
    const n = Buffer.from(name, 'utf8'); const crc = crc32(data);
    const local = Buffer.concat([Buffer.from('PK\x03\x04', 'latin1'), u16le(20), u16le(0), u16le(0), u16le(0), u16le(0x21), u32le(crc), u32le(data.length), u32le(data.length), u16le(n.length), u16le(0), n, data]);
    centrals.push(Buffer.concat([Buffer.from('PK\x01\x02', 'latin1'), u16le(20), u16le(20), u16le(0), u16le(0), u16le(0), u16le(0x21), u32le(crc), u32le(data.length), u32le(data.length), u16le(n.length), u16le(0), u16le(0), u16le(0), u16le(0), u32le(0), u32le(offset), n]));
    locals.push(local); offset += local.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.concat([Buffer.from('PK\x05\x06', 'latin1'), u16le(0), u16le(0), u16le(entries.length), u16le(entries.length), u32le(central.length), u32le(offset), u16le(0)]);
  return Buffer.concat([...locals, central, end]);
}

function docx(title, paragraphs) {
  const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const body = [`<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="40"/></w:rPr><w:t>${xml(title)}</w:t></w:r></w:p>`, ...paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${xml(p)}</w:t></w:r></w:p>`)].join('');
  return zip([
    ['[Content_Types].xml', Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')],
    ['_rels/.rels', Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')],
    ['word/document.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`)],
  ]);
}

function pdf(title, lines) {
  const escape = (s) => s.replace(/[\\()]/g, (m) => `\\${m}`);
  const content = [`BT /F1 22 Tf 72 760 Td (${escape(title)}) Tj ET`, ...lines.map((line, i) => `BT /F1 12 Tf 72 ${720 - i * 18} Td (${escape(line)}) Tj ET`)].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'; const offsets = [];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function wav(seconds = 1.5, rate = 8000) {
  const samples = Math.floor(seconds * rate); const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const t = i / rate; const envelope = Math.min(1, t * 8) * Math.exp(-t * 1.2);
    const tone = Math.sin(2 * Math.PI * 440 * t) * 0.6 + Math.sin(2 * Math.PI * 660 * t) * 0.3;
    data.writeInt16LE(Math.round(tone * envelope * 12000), i * 2);
  }
  const fmt = Buffer.concat([Buffer.from('fmt ', 'ascii'), u32le(16), u16le(1), u16le(1), u32le(rate), u32le(rate * 2), u16le(2), u16le(16)]);
  const body = Buffer.concat([Buffer.from('WAVE', 'ascii'), fmt, Buffer.from('data', 'ascii'), u32le(data.length), data]);
  return Buffer.concat([Buffer.from('RIFF', 'ascii'), u32le(body.length), body]);
}

async function sqlite(rows) {
  const { DatabaseSync } = await import('node:sqlite');
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'shunya-demo-db-')), 'messages.sqlite');
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=DELETE; CREATE TABLE messages (id INTEGER PRIMARY KEY, sender TEXT NOT NULL, body TEXT NOT NULL, sent_at TEXT NOT NULL);');
  const insert = db.prepare('INSERT INTO messages (sender, body, sent_at) VALUES (?, ?, ?)');
  for (const [sender, body, at] of rows) insert.run(sender, body, at);
  db.close();
  const bytes = readFileSync(file); rmSync(path.dirname(file), { recursive: true, force: true });
  return bytes;
}

// Inserts a JPEG COM segment right after SOI; decoders ignore it, YARA sees it.
function jpegComment(jpeg, comment) {
  const payload = Buffer.from(comment, 'latin1');
  const length = Buffer.alloc(2); length.writeUInt16BE(payload.length + 2);
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xfe]), length, payload, jpeg.subarray(2)]);
}

// ---------------------------------------------------------------------------
// Scenes: each returns a canvas with a recognisable picture and a title.
// ---------------------------------------------------------------------------

function sceneChart(title) {
  const c = canvas(640, 400); gradient(c, [250, 247, 240], [232, 224, 210]);
  rect(c, 60, 60, 520, 260, [255, 255, 255]); rect(c, 60, 320, 520, 2, [60, 60, 60]); rect(c, 60, 60, 2, 262, [60, 60, 60]);
  [120, 180, 150, 230, 200, 260].forEach((h, i) => rect(c, 90 + i * 82, 320 - h, 52, h, i % 2 ? [245, 102, 0] : [255, 154, 61]));
  text(c, title, 60, 22, 3, [40, 40, 40]); text(c, 'FY2025 REVENUE BY QUARTER', 60, 345, 2, [90, 90, 90]); watermark(c); return c;
}
function sceneCard(title) {
  const c = canvas(640, 400); gradient(c, [225, 232, 245], [200, 210, 232]);
  rect(c, 70, 70, 500, 260, [252, 252, 250]); rect(c, 70, 70, 500, 46, [230, 90, 40]);
  rect(c, 96, 140, 120, 150, [200, 200, 200]); circle(c, 156, 190, 32, [150, 150, 150]); rect(c, 116, 226, 80, 60, [150, 150, 150]);
  text(c, title, 84, 82, 3, [255, 255, 255]); text(c, 'NAME: DEMO PERSON', 240, 150, 2, [50, 50, 50]); text(c, 'ID: XXXX XXXX 2026', 240, 180, 2, [50, 50, 50]); text(c, 'SAMPLE - NOT A REAL DOCUMENT', 240, 260, 2, [180, 40, 40]); watermark(c); return c;
}
function sceneBeach(title) {
  const c = canvas(640, 400); gradient(c, [120, 180, 240], [200, 230, 255], false);
  rect(c, 0, 230, 640, 100, [40, 120, 190]); rect(c, 0, 330, 640, 70, [238, 214, 160]); circle(c, 520, 90, 46, [255, 224, 90]);
  text(c, title, 30, 30, 3, [255, 255, 255]); watermark(c); return c;
}
function sceneBlueprint(title) {
  const c = canvas(640, 400); gradient(c, [20, 60, 130], [30, 80, 160]);
  for (let x = 0; x < 640; x += 40) rect(c, x, 0, 1, 400, [70, 110, 190]); for (let y = 0; y < 400; y += 40) rect(c, 0, y, 640, 1, [70, 110, 190]);
  rect(c, 120, 100, 400, 220, [235, 240, 255]); rect(c, 124, 104, 392, 212, [20, 60, 130]); rect(c, 300, 104, 4, 212, [235, 240, 255]); rect(c, 124, 200, 392, 4, [235, 240, 255]);
  text(c, title, 120, 40, 3, [235, 240, 255]); text(c, 'FLOOR PLAN - LEVEL 2', 130, 340, 2, [235, 240, 255]); watermark(c); return c;
}
function sceneLogo(title) {
  const c = canvas(320, 200); rect(c, 0, 0, 320, 200, [255, 255, 255]);
  circle(c, 80, 100, 50, [245, 102, 0]); circle(c, 80, 100, 30, [255, 255, 255]); text(c, title, 150, 80, 3, [40, 40, 40]); text(c, 'RECOVERY PLATFORM', 150, 115, 2, [120, 120, 120]); return c;
}
function scenePortrait(title) {
  const c = canvas(400, 480); gradient(c, [215, 225, 235], [180, 195, 215]);
  circle(c, 200, 170, 80, [232, 190, 160]); rect(c, 120, 270, 160, 210, [60, 80, 140]); rect(c, 180, 250, 40, 40, [232, 190, 160]);
  text(c, title, 20, 20, 2, [40, 40, 40]); watermark(c); return c;
}
function sceneWarning(title) {
  const c = canvas(640, 400); gradient(c, [40, 40, 48], [70, 70, 84]);
  circle(c, 320, 200, 110, [255, 190, 40]); circle(c, 320, 200, 92, [40, 40, 48]); rect(c, 305, 140, 30, 80, [255, 190, 40]); rect(c, 305, 235, 30, 26, [255, 190, 40]);
  text(c, title, 30, 30, 3, [255, 255, 255]); text(c, 'OPEN ME - YOU WON A PRIZE', 30, 350, 2, [255, 190, 40]); watermark(c); return c;
}

// ---------------------------------------------------------------------------
// Build the evidence set.
// ---------------------------------------------------------------------------

async function main() {
  const work = mkdtempSync(path.join(tmpdir(), 'shunya-demo-'));
  const photos = {
    Q4_Financial_Report: sceneChart('Q4 FINANCIAL REPORT'),
    Aadhaar_Scan_Front: sceneCard('ID CARD SCAN - FRONT'),
    Suspicious_Attachment: sceneWarning('SUSPICIOUS ATTACHMENT'),
    Employee_ID_Photo: scenePortrait('EMPLOYEE ID PHOTO'),
  };
  for (const [name, scene] of Object.entries(photos)) writeFileSync(path.join(work, `${name}.png`), png(scene));

  // Real JPEG encoding through Chromium (Electron). Fail loudly rather than
  // silently shipping stubs that will not open.
  const electron = createRequire(path.join(repo, 'apps/desktop/package.json'))('electron');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const encode = spawnSync(electron, [path.join(here, 'encode-jpeg.cjs'), work, '88'], { stdio: 'inherit', env });
  if (encode.status !== 0) throw new Error(`JPEG encoding failed (exit ${encode.status}); is the Electron dev dependency installed?`);
  const jpeg = (name, comment) => jpegComment(readFileSync(path.join(work, `${name}.jpg`)), comment);

  const messages = [
    ['Priya', 'Board pack is in the shared drive, please review before Monday.', '2026-08-28T09:12:00Z'],
    ['Arjun', 'Deleted the old exports by mistake, can we recover them?', '2026-08-29T14:40:00Z'],
    ['Priya', 'Yes - imaging the drive read-only first.', '2026-08-29T14:42:00Z'],
  ];

  const files = [
    ['Q4_Financial_Report.jpg', jpeg('Q4_Financial_Report', 'SHUNYA-DEMO EVIDENCE :: Q4_Financial_Report')],
    ['Aadhaar_Scan_Front.jpg', jpeg('Aadhaar_Scan_Front', 'SHUNYA-DEMO EVIDENCE :: Aadhaar_Scan_Front (sample, not a real document)')],
    ['Family_Trip_Goa_2025.png', png(sceneBeach('FAMILY TRIP GOA 2025'))],
    ['Board_Meeting_Minutes.pdf', pdf('Board Meeting Minutes', ['SHUNYA demo evidence - recovered by content signature.', 'Date: 29 August 2026    Reference: SIH-26149', '', '1. Approval of the Q4 financial report.', '2. Data-loss incident on the shared workstation.', '3. Decision: image the drive read-only and recover with SHUNYA.', '4. Next review: 12 September 2026.'])],
    ['Suspicious_Attachment.jpg', jpeg('Suspicious_Attachment', `SHUNYA-DEMO EVIDENCE :: Suspicious_Attachment ${EICAR}`)],
    ['Site_Blueprint_Final.docx', docx('Site Blueprint - Final', ['SHUNYA demo evidence, recovered by content signature.', 'Prepared for: SIH 2026 judging panel.', 'Scope: level 2 floor plan, structural notes and handover checklist.', 'Status: FINAL - approved 27 August 2026.'])],
    ['Messages_Backup.sqlite', await sqlite(messages)],
    ['Company_Logo.gif', gif(sceneLogo('SHUNYA'))],
    ['Site_Plan_Scan.bmp', bmp(sceneBlueprint('SITE PLAN SCAN'))],
    ['Voice_Memo_14.wav', wav()],
    ['Project_Archive.zip', zip([['README.txt', Buffer.from('SHUNYA demo evidence archive.\nContains the project notes and a thumbnail.\n')], ['thumbnail.png', png(sceneLogo('SHUNYA'))]])],
    ['Employee_ID_Photo.jpg', jpeg('Employee_ID_Photo', 'SHUNYA-DEMO EVIDENCE :: Employee_ID_Photo')],
  ];
  for (const dir of extraDirs) {
    for (const name of readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      if (statSync(full).isFile()) files.push([name, readFileSync(full)]);
    }
  }
  rmSync(work, { recursive: true, force: true });

  // Scatter the files through the data area past the partition/VBR region, each
  // on its own 64 KiB-aligned slot, and grow the image to fit whatever was added.
  const align = (n) => (n + 0xffff) & ~0xffff;
  let offset = 64 * 1024; const placements = [];
  for (const [name, bytes] of files) { placements.push([name, offset, bytes]); offset = align(offset + bytes.length + 32 * 1024); }
  const SIZE = Math.max(4 * 1024 * 1024, align(offset + 256 * 1024) + (1024 * 1024 - 1)) & ~(1024 * 1024 - 1);
  const image = Buffer.alloc(SIZE, 0);
  image[510] = 0x55; image[511] = 0xaa;
  image[446 + 4] = 0x0c; // partition type: FAT32 (LBA)
  image.writeUInt32LE(1, 446 + 8); image.writeUInt32LE(SIZE / 512 - 1, 446 + 12);
  image.write('FAT32   ', 512 + 82, 'ascii');
  for (const [, at, bytes] of placements) bytes.copy(image, at);

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, image);
  console.log(`Wrote ${outPath} (${SIZE} bytes)`);
  for (const [name, at, bytes] of placements) console.log(`  ${String(at).padStart(9)}  ${String(bytes.length).padStart(8)} B  ${name}`);
  console.log(`  ${files.length} real files; Suspicious_Attachment.jpg carries the EICAR signature in a JPEG comment.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
