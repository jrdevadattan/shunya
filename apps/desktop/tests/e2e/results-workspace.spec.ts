import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';

test('results workspace uses paginated three-pane semantic review labels', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => { window.location.hash = '#/cases/results/results'; });
    await expect(page.getByRole('heading', { name: 'Review recovery results' })).toBeVisible();
    await expect(page.getByText('Original name unavailable · Recovered by content signature')).toBeVisible();
    await page.getByLabel('Search recovered files').fill('JPEG');
    await expect(page.getByText('Recovered JPEG 0000123')).toBeVisible();
    await expect(page.getByText(/never opens the operating-system application/)).toBeVisible();
    await expect(page.getByText('Open with system app')).toHaveCount(0);
  } finally { await electronApp.close(); }
});
