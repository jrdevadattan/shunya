import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';
import { createLiveCase } from './support/case-context.js';

test('memory analysis remains separate and reports verified capability refusal', async () => {
  const electronApp = await launchPackagedApp();
  let cleanup: () => Promise<void> = async () => undefined;
  try {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#root').waitFor();
    const context = await createLiveCase(page, 'Memory analysis context'); cleanup = context.cleanup;
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/memory`; }, context.caseId);
    await expect(page.getByRole('heading', { name: 'Memory image analysis' })).toBeVisible();
    await expect(page.getByText(/cannot be perfectly non-invasive/)).toBeVisible();
    await page.getByRole('link', { name: 'Review analysis options' }).click();
    await page.getByRole('link', { name: 'Check current capability' }).click();
    await expect(page.getByRole('heading', { name: 'Memory analysis results' })).toBeVisible();
    await expect(page.getByText('VOLATILITY_UNAVAILABLE')).toBeVisible();
    await expect(page.getByText('svchost.exe')).toHaveCount(0);
    await expect(page.getByRole('main').getByText('Recovered files')).toHaveCount(0);
  } finally { await electronApp.close(); await cleanup(); }
});
