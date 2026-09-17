import { expect, test } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchPackagedApp } from './support/electron-app.js';
import { createLiveCase } from './support/case-context.js';

test('add image source identifies a RAW image without modifying it', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'recovery-image-e2e-'));
  const imagePath = path.join(directory, 'evidence.raw');
  const original = Buffer.from('forensic image fixture');
  await writeFile(imagePath, original);
  const electronApp = await launchPackagedApp();
  let cleanupCase: () => Promise<void> = async () => undefined;
  try {
    const page = await electronApp.firstWindow();
    const context = await createLiveCase(page, 'Live source assessment');
    cleanupCase = context.cleanup;
    await page.getByRole('link', { name: 'Recovery', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Select recovery source' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose image file' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Discover physical devices' })).toHaveCount(0);
    await page.getByLabel('Disk image path').fill(imagePath);
    await page.getByRole('button', { name: 'Add image source' }).click();
    await expect(page.getByRole('heading', { name: 'evidence.raw' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
    await expect(page.getByRole('figure', { name: 'Read-only source relationship' })).toContainText('Read-only analysis path');
    expect(await (await import('node:fs/promises')).readFile(imagePath)).toEqual(original);
  } finally {
    await electronApp.close();
    await cleanupCase();
    await rm(directory, { recursive: true, force: true });
  }
});
