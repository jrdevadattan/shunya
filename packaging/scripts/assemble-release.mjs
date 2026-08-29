import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHECKSUM_FILE = 'SHA256SUMS';
const MANIFEST_FILE = 'release-manifest.json';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function regularFiles(directory) {
  const names = await readdir(directory);
  const files = [];
  for (const name of names.sort()) {
    if ((await stat(path.join(directory, name))).isFile()) files.push(name);
  }
  return files;
}

export async function assembleRelease(directory, tag) {
  const payloadNames = (await regularFiles(directory)).filter(
    (name) => name !== CHECKSUM_FILE && name !== MANIFEST_FILE,
  );
  const checksums = [];
  for (const name of payloadNames) {
    const bytes = await readFile(path.join(directory, name));
    checksums.push(`${sha256(bytes)}  ${name}`);
  }
  await writeFile(path.join(directory, CHECKSUM_FILE), `${checksums.join('\n')}\n`);

  const manifestNames = [...payloadNames, CHECKSUM_FILE].sort();
  const files = [];
  for (const name of manifestNames) {
    const bytes = await readFile(path.join(directory, name));
    files.push({ name, bytes: bytes.length, sha256: sha256(bytes) });
  }
  const manifest = { schemaVersion: 1, tag, files };
  await writeFile(path.join(directory, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [directory, tag] = process.argv.slice(2);
  if (!directory || !tag) throw new Error('usage: node assemble-release.mjs <directory> <tag>');
  assembleRelease(path.resolve(directory), tag).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
