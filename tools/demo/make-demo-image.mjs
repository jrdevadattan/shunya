// Generates a deterministic demo evidence image for the SIH recovery demo.
// It contains a FAT32 partition and several JPEG artifacts sitting in the data
// area (simulating deleted files in unallocated space). One artifact carries the
// EICAR test signature so the real YARA-X engine flags it as a potential threat.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../SIH_DEMO_KIT/assets');
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'demo_evidence.raw');

const SIZE = 4 * 1024 * 1024; // 4 MiB
const image = Buffer.alloc(SIZE, 0);

// MBR + a FAT32 partition so "Partition discovery" shows a real partition.
image[510] = 0x55;
image[511] = 0xaa;
image[446 + 4] = 0x0c; // partition type: FAT32 (LBA)
image.writeUInt32LE(1, 446 + 8); // start LBA
image.writeUInt32LE(SIZE / 512 - 1, 446 + 12); // sector count
image.write('FAT32   ', 512 + 82, 'ascii'); // FAT32 signature in the volume boot record

// EICAR standard antivirus test string (harmless; the industry-standard way to
// prove threat detection works without using real malware).
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

function jpeg(label) {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
    Buffer.from(`  SHUNYA-DEMO EVIDENCE :: ${label}  `, 'latin1'),
    Buffer.from([0xff, 0xd9]),
  ]);
}

const artifacts = [
  jpeg('Q4_Financial_Report'),
  jpeg('Aadhaar_Scan_Front'),
  jpeg('Family_Trip_Goa_2025'),
  jpeg('Board_Meeting_Minutes'),
  jpeg(`Suspicious_Attachment ${EICAR}`), // recovered file that carries a malware signature
  jpeg('Site_Blueprint_Final'),
  jpeg('Employee_ID_Photo'),
];

// Scatter the artifacts through the data area, past the partition/VBR region.
let offset = 64 * 1024;
for (const blob of artifacts) {
  blob.copy(image, offset);
  offset += 128 * 1024;
}

writeFileSync(outPath, image);
console.log(`Wrote ${outPath}`);
console.log(`  ${SIZE} bytes; ${artifacts.length} JPEG artifacts (1 carries the EICAR signature).`);
