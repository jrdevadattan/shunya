import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';

test('damaged device flow defaults to resumable first pass', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => { window.location.hash = '#/cases/damaged/recovery/damaged'; });
    await expect(page.getByRole('heading', { name: 'Damaged device recovery' })).toBeVisible();
    await expect(page.getByLabel(/First pass only/)).toBeChecked();
    await page.getByRole('button', { name: 'Start first pass' }).click();
    await expect(page.getByRole('status')).toContainText('Mapfile saved');
    await expect(page.getByLabel(/82% rescued/)).toBeVisible();
  } finally { await electronApp.close(); }
});
