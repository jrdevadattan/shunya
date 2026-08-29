import { expect, test } from '@playwright/test';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchPackagedApp } from './support/electron-app.js';

test('reloading the current case preserves active job visibility and controls', async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(path.join(tmpdir(), 'recovery-active-reload-'));
  const imagePath = path.join(directory, 'active.raw');
  const image = await open(imagePath, 'w');
  await image.truncate(1024 * 1024 * 1024);
  await image.close();
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.getByRole('link', { name: /New recovery case/ }).click();
    await page.getByLabel('Case title').fill('Active reload case');
    await page.getByLabel('Operator name or ID').fill('e2e-operator');
    await page.getByLabel('Case workspace destination').fill(path.join(directory, 'case'));
    await page.getByRole('button', { name: 'Create case' }).click();
    await page.getByRole('link', { name: 'Sources' }).click();
    await page.getByLabel('Disk image path').fill(imagePath);
    await page.getByRole('button', { name: 'Add image source' }).click();
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Choose recovery goal' }).click();
    await page.getByRole('link', { name: /Recover everything/ }).click();
    await page.getByText('Full Scan', { exact: true }).locator('..').getByRole('button', { name: 'Use this preset' }).click();
    await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).some((key) => key.endsWith(':jobId')))).toBe(true);

    await page.reload();

    await expect(page.getByText('Active reload case')).toBeVisible();
    await page.getByRole('link', { name: 'Recovery Jobs' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('heading', { name: 'Recovery paused' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).some((key) => key.endsWith(':jobId')))).toBe(true);
    await page.getByRole('button', { name: 'Cancel scan' }).click();
    await expect(page.getByRole('heading', { name: 'Recovery cancelled' })).toBeVisible();
  } finally {
    await electronApp.close();
    await rm(directory, { recursive: true, force: true });
  }
});
