import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { verifyPackage } from '../../packaging/scripts/verify-package.js';

test('packaged executables hashes CSP and Electron fuses pass integrity verification', async (context) => {
  const repository = findRepository(process.cwd());
  const root = path.resolve(process.env.RECOVERY_PACKAGE_DIR ?? path.join(repository, `apps/desktop/out/SIH Recovery Platform-${process.platform}-${process.arch}`));
  if (!existsSync(root)) { context.skip(`package not present at ${root}; platform packaging jobs set RECOVERY_PACKAGE_DIR`); return; }
  await assert.doesNotReject(verifyPackage(root));
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
