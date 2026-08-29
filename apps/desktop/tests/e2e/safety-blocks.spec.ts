import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';

test('safety policy explains Rescue Mode and never bypasses a same-device block', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => { window.location.hash = '#/cases/safety/sources/system/assessment?state=system'; });
    await expect(page.getByText('Rescue Mode recommended')).toBeVisible();
    await expect(page.getByRole('button', { name: /Why am I seeing this/ })).toBeVisible();

    await page.evaluate(() => { window.location.hash = '#/cases/safety/recovery/destination?state=same-device'; });
    await expect(page.getByText('Destination is on the source device')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await expect(page.getByText('No bypass is available for same-device destinations.')).toBeVisible();
  } finally {
    await electronApp.close();
  }
});
