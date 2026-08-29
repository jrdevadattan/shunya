import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';

test('export and report screens surface daemon errors without simulated success', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => { window.location.hash = '#/cases/results/exports'; });
    await expect(page.getByRole('heading', { name: 'Export recovered files' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('JOB_NOT_FOUND');
    await expect(page.getByText('Export complete')).toHaveCount(0);

    await page.evaluate(() => { window.location.hash = '#/cases/results/reports'; });
    await expect(page.getByRole('heading', { name: 'Recovery report' })).toBeVisible();
    await page.getByRole('button', { name: 'Generate report' }).click();
    await expect(page.getByRole('alert')).toContainText('INVALID_REPORT_INPUT');
    await expect(page.getByText('Source hash verified')).toHaveCount(0);
  } finally { await electronApp.close(); }
});
