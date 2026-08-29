import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';
import { createLiveCase } from './support/case-context.js';

test('results workspace reports daemon state and contains no production findings', async () => {
  const electronApp = await launchPackagedApp();
  let cleanup: () => Promise<void> = async () => undefined;
  try {
    const page = await electronApp.firstWindow();
    const context = await createLiveCase(page, 'Results context'); cleanup = context.cleanup;
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/results`; }, context.caseId);
    await expect(page.getByRole('heading', { name: 'Review recovery results' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('JOB_NOT_FOUND');
    await expect(page.getByText('Recovered JPEG 0000123')).toHaveCount(0);
    await expect(page.getByText('Open with system app')).toHaveCount(0);
  } finally { await electronApp.close(); await cleanup(); }
});
