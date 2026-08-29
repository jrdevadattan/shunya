import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';

test('export and report workflow verifies copies and provenance', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => { window.location.hash = '#/cases/results/exports'; });
    await expect(page.getByRole('heading', { name: 'Export recovered files' })).toBeVisible();
    await expect(page.getByText('1. Select files')).toBeVisible();
    await page.getByRole('button', { name: 'Start verified export' }).click();
    await expect(page.getByText('Export complete')).toBeVisible();
    await expect(page.getByText('All 2 copied files passed SHA-256 verification.')).toBeVisible();

    await page.evaluate(() => { window.location.hash = '#/cases/results/reports'; });
    await expect(page.getByRole('heading', { name: 'Recovery report' })).toBeVisible();
    await expect(page.getByText('Source hash verified')).toBeVisible();
    await expect(page.getByText('Original names are unavailable for carved files.')).toBeVisible();
  } finally { await electronApp.close(); }
});
