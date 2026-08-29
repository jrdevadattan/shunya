import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';

test('damaged device flow refuses to simulate unavailable ddrescue progress', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => { window.location.hash = '#/cases/damaged/recovery/damaged'; });
    await expect(page.getByRole('heading', { name: 'Damaged device recovery' })).toBeVisible();
    await expect(page.getByText('DDRESCUE_UI_UNAVAILABLE')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start first pass' })).toBeDisabled();
    await expect(page.getByText(/No rescued, unreadable, or pending ranges are simulated/)).toBeVisible();
  } finally { await electronApp.close(); }
});
