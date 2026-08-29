import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';

test('navigation starts a new recovery case from plain-language welcome content', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await expect(page.getByRole('heading', { name: 'Recover data safely and preserve the source' })).toBeVisible();
    await page.getByRole('link', { name: /New recovery case/ }).click();
    await expect(page.getByRole('heading', { name: 'Create recovery case' })).toBeVisible();
    await expect(page.getByLabel('Case title')).toBeVisible();
  } finally {
    await electronApp.close();
  }
});
