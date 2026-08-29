import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyPackage } from '../../packaging/scripts/verify-package.js';

test('packaged executables hashes CSP and Electron fuses pass integrity verification', async (context) => {
  const repository = findRepository(process.cwd());
  const root = path.resolve(process.env.RECOVERY_PACKAGE_DIR ?? path.join(repository, `apps/desktop/out/SIH Recovery Platform-${process.platform}-${process.arch}`));
  if (!existsSync(root)) { context.skip(`package not present at ${root}; platform packaging jobs set RECOVERY_PACKAGE_DIR`); return; }
  await assert.doesNotReject(verifyPackage(root));
});

test('rejects a declared Unix executable without execute permissions', {
  skip: process.platform === 'win32' ? 'Unix mode bits are unavailable on Windows' : false,
}, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'recovery-package-mode-'));
  const resources = path.join(root, 'resources');
  const bytes = Buffer.from('daemon fixture');
  try {
    await mkdir(resources, { recursive: true });
    await writeFile(path.join(resources, 'recoveryd'), bytes);
    await chmod(path.join(resources, 'recoveryd'), 0o644);
    await writeFile(path.join(resources, 'package-manifest.json'), JSON.stringify({
      schemaVersion: 1,
      airGapped: true,
      telemetry: false,
      autoUpdate: false,
      files: [{
        path: 'recoveryd',
        sha256: createHash('sha256').update(bytes).digest('hex'),
        executable: true,
      }],
    }));

    await assert.rejects(verifyPackage(root), /missing Unix execute permissions: recoveryd/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function findRepository(start: string): string {
  let candidate = path.resolve(start);
  while (!existsSync(path.join(candidate, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(candidate);
    if (parent === candidate) throw new Error('repository root not found');
    candidate = parent;
  }
  return candidate;
}
