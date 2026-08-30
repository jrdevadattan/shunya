import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';
import { createLiveCase } from './support/case-context.js';

test('damaged device flow refuses to simulate unavailable ddrescue progress', async () => {
  const electronApp = await launchPackagedApp();
  let cleanup: () => Promise<void> = async () => undefined;
  try {
    const page = await electronApp.firstWindow();
    const context = await createLiveCase(page, 'Damaged device context'); cleanup = context.cleanup;
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/recovery/damaged`; }, context.caseId);
    await expect(page.getByRole('heading', { name: 'Damaged device recovery' })).toBeVisible();
    await expect(page.getByText('DDRESCUE_UI_UNAVAILABLE')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start first pass' })).toBeDisabled();
    await expect(page.getByText(/No source details, rates, ranges, or capabilities are simulated/)).toBeVisible();
    await expect(page.getByText('Live read rate unavailable')).toBeVisible();
    await expect(page.getByText('Checkpoint detail unavailable')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause safely' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Stop imaging' })).toBeDisabled();
  } finally { await electronApp.close(); await cleanup(); }
});
