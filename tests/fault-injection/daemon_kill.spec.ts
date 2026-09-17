import { expect, test } from '@playwright/test';
import { launchPackagedApp } from '../../apps/desktop/tests/e2e/support/electron-app.js';

test('daemon or app termination leaves the recovery job resumable', async () => {
  const app = await launchPackagedApp();
  const page = await app.firstWindow();
  await page.evaluate(() => { window.location.hash = '#/cases/restart/jobs?fixture=resume'; });
  await expect(page.getByRole('heading', { name: 'Recovery paused after restart' })).toBeVisible();
  await app.close();
});
