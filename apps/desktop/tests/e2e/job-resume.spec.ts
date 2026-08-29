import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';

test('resume after restart preserves completed stages and waits for confirmation', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => { window.location.hash = '#/cases/restart-test/jobs?fixture=resume'; });
    await expect(page.getByRole('heading', { name: 'Recovery paused after restart' })).toBeVisible();
    await page.getByRole('button', { name: 'Resume recovery' }).click();
    await expect(page.getByRole('heading', { name: 'Metadata recovery running' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Metadata recovery running' })).toBeVisible();
    await expect(page.getByText('Partition discovery')).toBeVisible();
  } finally {
    await electronApp.close();
  }
});
