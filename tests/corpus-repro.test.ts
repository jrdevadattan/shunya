import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('carving corpus and logical truth manifest are reproducible', () => {
  const repository = findRepository(process.cwd()); const script = path.join(repository, 'testdata/scripts/create-carving-fixture.py');
  const first = mkdtempSync(path.join(tmpdir(), 'recovery-corpus-a-')); const second = mkdtempSync(path.join(tmpdir(), 'recovery-corpus-b-'));
  for (const output of [first, second]) { const result = spawnSync(process.platform === 'win32' ? 'py' : 'python3', process.platform === 'win32' ? ['-3', script, output] : [script, output], { encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); }
  assert.deepEqual(readFileSync(path.join(first, 'carving-fixture.raw')), readFileSync(path.join(second, 'carving-fixture.raw')));
  assert.equal(readFileSync(path.join(first, 'carving-fixture.truth.json'), 'utf8'), readFileSync(path.join(second, 'carving-fixture.truth.json'), 'utf8'));
});
function findRepository(start: string): string { let candidate = path.resolve(start); while (!readable(path.join(candidate, 'pnpm-workspace.yaml'))) { const parent = path.dirname(candidate); if (parent === candidate) throw new Error('repository root not found'); candidate = parent; } return candidate; }
function readable(file: string): boolean { try { readFileSync(file); return true; } catch { return false; } }
