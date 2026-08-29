import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';
import { createLiveCase } from './support/case-context.js';

test('destination screen does not invent topology safety evidence', async () => {
  const electronApp = await launchPackagedApp();
  let cleanup: () => Promise<void> = async () => undefined;
  try {
    const page = await electronApp.firstWindow();
    const context = await createLiveCase(page, 'Destination safety context'); cleanup = context.cleanup;
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/recovery/destination`; }, context.caseId);
    await expect(page.getByText('Destination assessment unavailable')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await expect(page.getByText(/No free-space or physical-separation result is assumed/)).toBeVisible();
  } finally {
    await electronApp.close();
    await cleanup();
  }
});
