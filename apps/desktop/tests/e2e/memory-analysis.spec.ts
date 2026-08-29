import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';

test('memory analysis remains separate and renders typed fixture results', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#root').waitFor();
    await page.evaluate(() => { window.location.hash = '#/cases/memory/memory'; });
    await expect(page.getByRole('heading', { name: 'Memory image analysis' })).toBeVisible();
    await expect(page.getByText(/cannot be perfectly non-invasive/)).toBeVisible();
    await page.getByRole('link', { name: 'Continue to analysis options' }).click();
    await page.getByRole('link', { name: 'Run fixture analysis' }).click();
    await expect(page.getByRole('heading', { name: 'Memory analysis results' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'svchost.exe' })).toBeVisible();
    await expect(page.getByRole('main').getByText('Recovered files')).toHaveCount(0);
  } finally { await electronApp.close(); }
});
