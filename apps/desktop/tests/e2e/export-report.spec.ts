import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';
import { createLiveCase } from './support/case-context.js';

test('export and report screens surface daemon errors without simulated success', async () => {
  const electronApp = await launchPackagedApp();
  let cleanup: () => Promise<void> = async () => undefined;
  try {
    const page = await electronApp.firstWindow();
    const context = await createLiveCase(page, 'Export report context'); cleanup = context.cleanup;
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/exports`; }, context.caseId);
    await expect(page.getByRole('heading', { name: 'Review export' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('No recovery job is active');
    await expect(page.getByText('Export complete')).toHaveCount(0);

    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/reports`; }, context.caseId);
    await expect(page.getByRole('heading', { name: 'Recovery report' })).toBeVisible();
    await page.getByRole('button', { name: 'Generate report' }).click();
    await expect(page.getByRole('alert')).toContainText('No recovery job is active');
    await expect(page.getByText('Source hash verified')).toHaveCount(0);
  } finally { await electronApp.close(); await cleanup(); }
});
