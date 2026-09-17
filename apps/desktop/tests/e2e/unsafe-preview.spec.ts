import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';
import { createLiveCase } from './support/case-context.js';

test('results screen reports the daemon error instead of showing a static unsafe artifact', async () => {
  const electronApp = await launchPackagedApp();
  let cleanup: () => Promise<void> = async () => undefined;
  try {
    const page = await electronApp.firstWindow();
    const context = await createLiveCase(page, 'Unsafe preview context'); cleanup = context.cleanup;
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/results`; }, context.caseId);
    await expect(page.getByRole('alert')).toContainText('No recovery job is active');
    await expect(page.getByText('script.exe')).toHaveCount(0);
    await expect(page.getByText('Open with system app')).toHaveCount(0);
  } finally { await electronApp.close(); await cleanup(); }
});
