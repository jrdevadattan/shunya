import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';

test('unsafe preview is blocked without launching recovered active content', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => { window.location.hash = '#/cases/results/results'; });
    await page.getByRole('row', { name: /script.exe/ }).click();
    await expect(page.getByText('Preview blocked')).toBeVisible();
    await expect(page.getByText(/controlled analysis environment/)).toBeVisible();
    await expect(page.getByText('Open with system app')).toHaveCount(0);
  } finally { await electronApp.close(); }
});
