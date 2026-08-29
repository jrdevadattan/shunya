import { expect, test } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchPackagedApp } from './support/electron-app.js';

test('add image source identifies a RAW image without modifying it', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'recovery-image-e2e-'));
  const imagePath = path.join(directory, 'evidence.raw');
  const original = Buffer.from('forensic image fixture');
  await writeFile(imagePath, original);
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.getByRole('link', { name: /New recovery case/ }).click();
    await page.getByLabel('Case title').fill('Live source assessment');
    await page.getByLabel('Operator name or ID').fill('e2e-operator');
    await page.getByLabel('Case workspace destination').fill(path.join(directory, 'case'));
    await page.getByRole('button', { name: 'Create case' }).click();
    await page.getByRole('link', { name: 'Sources' }).click();
    await page.getByLabel('Disk image path').fill(imagePath);
    await page.getByRole('button', { name: 'Add image source' }).click();
    await expect(page.getByRole('heading', { name: 'evidence.raw' })).toBeVisible();
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
    expect(await (await import('node:fs/promises')).readFile(imagePath)).toEqual(original);
  } finally {
    await electronApp.close();
    await rm(directory, { recursive: true, force: true });
  }
});
