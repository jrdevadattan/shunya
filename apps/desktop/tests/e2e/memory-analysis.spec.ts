import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';
import { createLiveCase } from './support/case-context.js';

test('memory capability remains truthful and separate when Volatility is not exposed', async () => {
  const electronApp = await launchPackagedApp();
  let cleanup: () => Promise<void> = async () => undefined;
  try {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#root').waitFor();
    const context = await createLiveCase(page, 'Memory analysis context'); cleanup = context.cleanup;
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/memory`; }, context.caseId);
    await expect(page.getByRole('heading', { name: 'Analyze memory image' })).toBeVisible();
    await expect(page.getByText('No memory image is registered')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Advanced analysis unavailable' })).toBeVisible();
    await expect(page.getByText(/does not expose a verified Volatility runtime/)).toBeVisible();
    await expect(page.getByText('SHA-256 verified')).toHaveCount(0);
    await page.getByRole('link', { name: 'Review capability details' }).click();
    await expect(page.getByRole('heading', { name: 'What advanced analysis would provide' })).toBeVisible();
    await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
    await page.getByRole('link', { name: 'View current result state' }).click();
    await expect(page.getByRole('heading', { name: 'Memory analysis results' })).toBeVisible();
    await expect(page.getByText('VOLATILITY_UNAVAILABLE')).toBeVisible();
    await expect(page.getByText('svchost.exe')).toHaveCount(0);
    await expect(page.getByRole('main').getByText('Recovered files')).toHaveCount(0);
  } finally { await electronApp.close(); await cleanup(); }
});
