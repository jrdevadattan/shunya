import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';

test('partition scan setup remains read-only and explains scan presets', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => { window.location.hash = '#/cases/partition/recovery/goal'; });
    await page.getByRole('link', { name: /Recover everything/ }).click();
    await expect(page.getByRole('heading', { name: 'Choose scan options' })).toBeVisible();
    await page.getByText('Full Scan', { exact: true }).locator('..').getByRole('link', { name: 'Use this preset' }).click();
    await expect(page.getByRole('heading', { name: 'Partitions found' })).toBeVisible();
    await expect(page.getByText('No partition table is written to the source.')).toBeVisible();
  } finally {
    await electronApp.close();
  }
});
