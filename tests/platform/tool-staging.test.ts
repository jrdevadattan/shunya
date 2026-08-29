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

test('rejects omitted networkAllowed on a current-platform entry', async () => {
  const malformed = entry({
    relativePath: 'vendor/windows-x64/tool.exe',
    sha256: '0'.repeat(64),
    platform: 'windows-x64',
  }) as Record<string, unknown>;
  delete malformed.networkAllowed;

  await assertMalformedEntryRejected(malformed, 'windows-x64', /networkAllowed must be false/);
});

test('rejects omitted networkAllowed on an off-platform entry before filtering', async () => {
  const malformed = entry({
    relativePath: 'vendor/linux-x64/tool',
    sha256: '0'.repeat(64),
    platform: 'linux-x64',
  }) as Record<string, unknown>;
  delete malformed.networkAllowed;

  await assertMalformedEntryRejected(malformed, 'windows-x64', /networkAllowed must be false/);
});

test('rejects non-string and blank metadata plus unsupported platforms at runtime', async () => {
  const base = entry({
    relativePath: 'vendor/linux-x64/tool',
    sha256: '0'.repeat(64),
    platform: 'linux-x64',
  });
  const cases: Array<{ name: string; malformed: unknown; expected: RegExp }> = [
    { name: 'blank identity', malformed: { ...base, id: '   ' }, expected: /id must be a nonblank string/ },
    { name: 'numeric version', malformed: { ...base, version: 123 }, expected: /version must be a nonblank string/ },
    { name: 'blank license', malformed: { ...base, license: '\t' }, expected: /license must be a nonblank string/ },
    { name: 'object origin', malformed: { ...base, origin: {} }, expected: /origin must be a nonblank string/ },
    { name: 'unsupported platform', malformed: { ...base, platform: 'solaris-x64' }, expected: /unsupported tool platform/ },
    { name: 'string network flag', malformed: { ...base, networkAllowed: 'false' }, expected: /networkAllowed must be false/ },
    { name: 'string redistribution flag', malformed: { ...base, redistributionAllowed: 'true' }, expected: /redistributionAllowed must be true/ },
    { name: 'numeric path', malformed: { ...base, relativePath: 7 }, expected: /relativePath must be a nonblank string/ },
  ];

  for (const scenario of cases) {
    await assertMalformedEntryRejected(scenario.malformed, 'windows-x64', scenario.expected, scenario.name);
  }
});

test('rejects portable path hazards before platform filtering', async () => {
  const base = entry({
    relativePath: 'vendor/linux-x64/tool',
    sha256: '0'.repeat(64),
    platform: 'linux-x64',
  });
  for (const relativePath of [
    'vendor/./tool',
    'vendor//tool',
    'vendor/tool/',
    'C:/Windows/tool.exe',
    String.raw`vendor\..\escape.exe`,
    String.raw`\\server\share\tool.exe`,
    String.raw`\\?\C:\tool.exe`,
    'vendor/tool:stream',
    'vendor/NUL.exe',
  ]) {
    await assertMalformedEntryRejected(
      { ...base, relativePath },
      'windows-x64',
      /unsafe tool path/,
      relativePath,
    );
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

async function assertMalformedEntryRejected(
  malformed: unknown,
  platform: string,
  expected: RegExp,
  label = 'malformed entry',
): Promise<void> {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'recovery-tool-stage-malformed-'));
  try {
    const lockPath = path.join(repositoryRoot, 'tools.lock.json');
    await writeFile(lockPath, JSON.stringify({ manifestVersion: 1, tools: [malformed] }));
    await assert.rejects(
      stageExternalTools({
        repositoryRoot,
        outputRoot: path.join(repositoryRoot, 'output'),
        lockPath,
        platform,
      }),
      expected,
      label,
    );
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
}
