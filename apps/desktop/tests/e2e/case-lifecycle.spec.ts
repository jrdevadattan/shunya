import { expect, test } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchPackagedApp } from './support/electron-app.js';

test('case lifecycle creates and opens a persistent recovery workspace', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'recovery-case-e2e-'));
  const workspace = path.join(parent, 'case-workspace');
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.getByRole('link', { name: /New recovery case/ }).click();
    await page.getByLabel('Case title').fill('E2E laptop recovery');
    await page.getByLabel('Operator name or ID').fill('e2e-operator');
    await page.getByLabel('Case workspace destination').fill(workspace);
    await page.getByRole('button', { name: 'Create case' }).click();

    await expect(page.getByRole('heading', { name: 'Case overview' })).toBeVisible();
    const manifest = JSON.parse(await readFile(path.join(workspace, 'case.json'), 'utf8')) as { title: string };
    expect(manifest.title).toBe('E2E laptop recovery');
  } finally {
    await electronApp.close();
    await rm(parent, { recursive: true, force: true });
  }
});
