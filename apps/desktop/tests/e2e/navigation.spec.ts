import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';

test('navigation starts a new recovery case from the approved cases home', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await expect(page.getByRole('heading', { name: 'Your recovery cases' })).toBeVisible();
    await page.getByRole('link', { name: 'New recovery' }).click();
    await expect(page.getByRole('heading', { name: 'Start a new recovery case' })).toBeVisible();
    await expect(page.getByLabel('Case title')).toBeVisible();
  } finally {
    await electronApp.close();
  }
});
