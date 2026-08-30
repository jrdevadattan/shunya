import { expect, test } from '@playwright/test';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchPackagedApp } from './support/electron-app.js';
import { createLiveCase } from './support/case-context.js';

test('reloading the current case preserves active job visibility and controls', async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(path.join(tmpdir(), 'recovery-active-reload-'));
  const imagePath = path.join(directory, 'active.raw');
  const image = await open(imagePath, 'w');
  await image.truncate(1024 * 1024 * 1024);
  await image.close();
  const electronApp = await launchPackagedApp();
  let cleanupCase: () => Promise<void> = async () => undefined;
  try {
    const page = await electronApp.firstWindow();
    const context = await createLiveCase(page, 'Active reload case'); cleanupCase = context.cleanup;
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/sources`; }, context.caseId);
    await page.getByLabel('Disk image path').fill(imagePath);
    await page.getByRole('button', { name: 'Add image source' }).click();
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Choose recovery goal' }).click();
    await page.getByRole('button', { name: /Recover everything/ }).click();
    await page.getByRole('button', { name: 'Continue to scan options' }).click();
    await page.getByText('Full Scan', { exact: true }).locator('..').getByRole('button', { name: 'Use this preset' }).click();
    await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).some((key) => key.endsWith(':jobId')))).toBe(true);

    await page.reload();

    await expect(page.getByText('Active reload case')).toBeVisible();
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/jobs`; }, context.caseId);
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('heading', { name: 'Recovery paused' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).some((key) => key.endsWith(':jobId')))).toBe(true);
    await page.getByRole('button', { name: 'Cancel scan' }).click();
    await expect(page.getByRole('heading', { name: 'Recovery cancelled' })).toBeVisible();
  } finally {
    await electronApp.close();
    await cleanupCase();
    await rm(directory, { recursive: true, force: true });
  }
});
