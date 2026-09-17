import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { verifyPackage } from '../../packaging/scripts/verify-package.js';

test('packaged Electron security controls are enforced', async (context) => {
  const repository = findRepository(process.cwd());
  const packageRoot = path.join(repository, `apps/desktop/out/SIH Recovery Platform-${process.platform}-${process.arch}`);
  if (!existsSync(packageRoot)) { context.skip('package is built and verified by each platform packaging job'); return; }
  await verifyPackage(packageRoot);
  const html = readFileSync(path.join(repository, 'apps/desktop/src/renderer/index.html'), 'utf8');
  assert.match(html, /default-src 'self'/);
  const options = readFileSync(path.join(repository, 'apps/desktop/src/main/windows.ts'), 'utf8');
  for (const control of ['nodeIntegration: false', 'contextIsolation: true', 'sandbox: true', 'webSecurity: true', 'devTools: !packaged']) assert.ok(options.includes(control), control);
});
function findRepository(start: string): string { let candidate = path.resolve(start); while (!existsSync(path.join(candidate, 'pnpm-workspace.yaml'))) { const parent = path.dirname(candidate); if (parent === candidate) throw new Error('repository root not found'); candidate = parent; } return candidate; }
