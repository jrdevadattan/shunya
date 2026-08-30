import { expect, test, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchPackagedApp } from './support/electron-app.js';

async function createCaseFromQuickStart(page: Page, action: string, title: string) {
  await page.getByRole('link', { name: new RegExp(action) }).click();
  await page.getByLabel('Case title').fill(title);
  await page.getByLabel('Operator name or ID').fill('quick-start-operator');
  await page.getByRole('button', { name: 'Continue to workspace' }).click();
  await page.getByRole('button', { name: 'Choose parent folder' }).click();
  await page.getByRole('button', { name: 'Continue to review' }).click();
  await page.getByRole('button', { name: 'Create case' }).click();
}

test('packaged quick starts preserve disk-image and memory-image intent after case creation', async () => {
  test.setTimeout(90_000);
  const parent = await mkdtemp(path.join(tmpdir(), 'recovery-quick-start-'));
  const electronApp = await launchPackagedApp();
  try {
    await electronApp.evaluate(({ dialog }, selectedPath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selectedPath], bookmarks: [] });
    }, parent);
    const page = await electronApp.firstWindow();

    await createCaseFromQuickStart(page, 'Analyze a disk image', 'Disk quick start');
    await expect(page).toHaveURL(/#\/cases\/[^/]+\/sources\/add-image$/);
    await expect(page.getByRole('heading', { name: 'Select recovery source' })).toBeVisible();
    await expect(page.getByLabel('Disk image path')).toBeVisible();

    await page.evaluate(() => { window.location.hash = '#/'; });
    await createCaseFromQuickStart(page, 'Analyze a memory image', 'Memory quick start');
    await expect(page).toHaveURL(/#\/cases\/[^/]+\/memory$/);
    await expect(page.getByRole('heading', { name: 'Analyze memory image' })).toBeVisible();
  } finally {
    await electronApp.close();
    await rm(parent, { recursive: true, force: true });
  }
});
