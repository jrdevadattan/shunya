import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assembleRelease } from '../../packaging/scripts/assemble-release.mjs';
import { verifyReleaseSet } from '../../packaging/scripts/verify-release-set.mjs';

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

test('complete release verification requires every native platform artifact', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'recovery-release-set-'));
  try {
    const files = [
      'SIH-Recovery-Platform-Setup.exe',
      'sih_recovery_platform-0.1.0-full.nupkg',
      'sih-recovery-platform_0.1.0_amd64.deb',
      'SIH-Recovery-Platform-0.1.0-x64.dmg',
      'SIH-Recovery-Platform-0.1.0-x64.zip',
      'SIH-Recovery-Platform-0.1.0-arm64.dmg',
      'SIH-Recovery-Platform-0.1.0-arm64.zip',
      'recovery-rescue-v0.1.0-x86_64.iso',
      'recovery-rescue-v0.1.0-x86_64.iso.sha256',
      'recovery-rescue-v0.1.0-x86_64.manifest.json',
    ];
    for (const file of files) await writeFile(path.join(directory, file), file);
    await assembleRelease(directory, 'v0.1.0');
    assert.equal((await verifyReleaseSet(directory)).length, 12);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('complete release verification rejects missing macOS artifacts', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'recovery-incomplete-release-'));
  try {
    await writeFile(path.join(directory, 'SIH-Recovery-Platform-Setup.exe'), 'windows');
    await assembleRelease(directory, 'v0.1.0');
    await assert.rejects(verifyReleaseSet(directory), /macOS x64 DMG/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Windows x64 release verification accepts only the approved Windows asset set and manifest coverage', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'recovery-windows-release-set-'));
  try {
    await writeFile(path.join(directory, 'SIH-Recovery-Platform-Setup.exe'), 'windows installer');
    await writeFile(path.join(directory, 'sih_recovery_platform-0.2.0-full.nupkg'), 'windows update');
    await assembleRelease(directory, 'v0.2.0');

    assert.deepEqual(await verifyReleaseSet(directory, { profile: 'windows-x64' }), [
      'SHA256SUMS',
      'SIH-Recovery-Platform-Setup.exe',
      'release-manifest.json',
      'sih_recovery_platform-0.2.0-full.nupkg',
    ]);
    await assert.rejects(verifyReleaseSet(directory), /Debian x64 package/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Windows x64 release verification rejects an uncovered file', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'recovery-windows-release-uncovered-'));
  try {
    await writeFile(path.join(directory, 'SIH-Recovery-Platform-Setup.exe'), 'windows installer');
    await writeFile(path.join(directory, 'sih_recovery_platform-0.2.0-full.nupkg'), 'windows update');
    await assembleRelease(directory, 'v0.2.0');
    await writeFile(path.join(directory, 'unexpected.txt'), 'not reviewed');

    await assert.rejects(
      verifyReleaseSet(directory, { profile: 'windows-x64' }),
      /release manifest does not cover: unexpected\.txt/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
