import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';

test('results workspace reports daemon state and contains no production findings', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => { window.location.hash = '#/cases/results/results'; });
    await expect(page.getByRole('heading', { name: 'Review recovery results' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('JOB_NOT_FOUND');
    await expect(page.getByText('Recovered JPEG 0000123')).toHaveCount(0);
    await expect(page.getByText('Open with system app')).toHaveCount(0);
  } finally { await electronApp.close(); }
});
