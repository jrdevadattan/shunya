import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';
import { createLiveCase } from './support/case-context.js';

test('job screen does not synthesize restart progress without a live job id', async () => {
  const electronApp = await launchPackagedApp();
  let cleanup: () => Promise<void> = async () => undefined;
  try {
    const page = await electronApp.firstWindow();
    const context = await createLiveCase(page, 'Job restart context'); cleanup = context.cleanup;
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/jobs`; }, context.caseId);
    await expect(page.getByRole('alert')).toContainText('No recovery job has been created');
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('No recovery job has been created');
    await expect(page.getByText('Metadata recovery running')).toHaveCount(0);
  } finally {
    await electronApp.close();
    await cleanup();
  }
});
