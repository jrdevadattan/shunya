import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';

test('destination screen does not invent topology safety evidence', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => { window.location.hash = '#/cases/safety/recovery/destination'; });
    await expect(page.getByText('Destination assessment unavailable')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await expect(page.getByText(/No free-space or physical-separation result is assumed/)).toBeVisible();
  } finally {
    await electronApp.close();
  }
});
