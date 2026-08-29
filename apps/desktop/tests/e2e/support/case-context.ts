import type { Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function createLiveCase(page: Page, title: string) {
  const parent = await mkdtemp(path.join(tmpdir(), 'recovery-context-e2e-'));
  const workspace = path.join(parent, 'case');
  await page.getByRole('link', { name: /New recovery case/ }).click();
  await page.getByLabel('Case title').fill(title);
  await page.getByLabel('Operator name or ID').fill('e2e-operator');
  await page.getByLabel('Case workspace destination').fill(workspace);
  await page.getByRole('button', { name: 'Create case' }).click();
  await page.getByRole('heading', { name: 'Case overview' }).waitFor();
  const hash = await page.evaluate(() => window.location.hash);
  const caseId = hash.match(/^#\/cases\/([^/]+)/)?.[1];
  if (!caseId) throw new Error(`Case id missing from route: ${hash}`);
  return { caseId, cleanup: () => rm(parent, { recursive: true, force: true }) };
}
