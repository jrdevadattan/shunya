import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { stageExternalTools } from '../../packaging/scripts/tool-staging.js';

test('stages a verified non-empty current-platform tool lock', async () => {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'recovery-tool-stage-'));
  try {
    const outputRoot = path.join(repositoryRoot, 'output');
    const relativePath = 'vendor/windows-x64/fixture.exe';
    const bytes = Buffer.from('verified-native-tool');
    await mkdir(path.join(repositoryRoot, 'tools', path.dirname(relativePath)), { recursive: true });
    await writeFile(path.join(repositoryRoot, 'tools', relativePath), bytes);
    const lockPath = path.join(repositoryRoot, 'tools.lock.json');
    await writeFile(lockPath, JSON.stringify({
      manifestVersion: 1,
      tools: [entry({ relativePath, sha256: digest(bytes), platform: 'windows-x64' })],
    }));

    const files = await stageExternalTools({ repositoryRoot, outputRoot, lockPath, platform: 'windows-x64' });

    assert.deepEqual(await readFile(path.join(outputRoot, 'tools', relativePath)), bytes);
    assert.deepEqual(files, [{
      id: 'fixture',
      path: 'tools/vendor/windows-x64/fixture.exe',
      sha256: digest(bytes),
      executable: true,
      license: 'test-only',
    }]);
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
});

test('rejects an unsafe off-platform path before platform selection', async () => {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'recovery-tool-stage-off-platform-'));
  try {
    const lockPath = path.join(repositoryRoot, 'tools.lock.json');
    await writeFile(lockPath, JSON.stringify({
      manifestVersion: 1,
      tools: [entry({
        relativePath: '../escape',
        sha256: '0'.repeat(64),
        platform: 'linux-x64',
      })],
    }));

    await assert.rejects(
      stageExternalTools({
        repositoryRoot,
        outputRoot: path.join(repositoryRoot, 'output'),
        lockPath,
        platform: 'windows-x64',
      }),
      /unsafe tool path/,
    );
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
});

test('rejects a malformed off-platform hash before platform selection', async () => {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'recovery-tool-stage-off-platform-hash-'));
  try {
    const lockPath = path.join(repositoryRoot, 'tools.lock.json');
    await writeFile(lockPath, JSON.stringify({
      manifestVersion: 1,
      tools: [entry({ relativePath: 'vendor/linux-x64/tool', sha256: 'not-a-hash', platform: 'linux-x64' })],
    }));

    await assert.rejects(
      stageExternalTools({
        repositoryRoot,
        outputRoot: path.join(repositoryRoot, 'output'),
        lockPath,
        platform: 'windows-x64',
      }),
      /integrity, provenance, or license metadata/,
    );
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
});

function entry(overrides: { relativePath: string; sha256: string; platform: string }) {
  return {
    id: 'fixture',
    version: '1.0.0',
    license: 'test-only',
    origin: 'test-fixture',
    networkAllowed: false,
    redistributionAllowed: true,
    ...overrides,
  };
}

function digest(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
