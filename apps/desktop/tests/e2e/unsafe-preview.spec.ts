import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';

test('results screen reports the daemon error instead of showing a static unsafe artifact', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => { window.location.hash = '#/cases/results/results'; });
    await expect(page.getByRole('alert')).toContainText('JOB_NOT_FOUND');
    await expect(page.getByText('script.exe')).toHaveCount(0);
    await expect(page.getByText('Open with system app')).toHaveCount(0);
  } finally { await electronApp.close(); }
});
