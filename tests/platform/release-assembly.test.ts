import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assembleRelease } from '../../packaging/scripts/assemble-release.mjs';

test('release assembly covers every payload and its checksum list', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'recovery-release-'));
  try {
    await writeFile(path.join(directory, 'app.exe'), 'windows');
    await writeFile(path.join(directory, 'rescue.iso'), 'rescue');
    const manifest = await assembleRelease(directory, 'v0.1.0');
    assert.equal(manifest.tag, 'v0.1.0');
    assert.deepEqual(manifest.files.map((file) => file.name), ['SHA256SUMS', 'app.exe', 'rescue.iso']);
    assert.match(await readFile(path.join(directory, 'SHA256SUMS'), 'utf8'), /  app\.exe\n.*  rescue\.iso\n/s);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
