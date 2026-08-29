import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';

test('job screen does not synthesize restart progress without a live job id', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => { window.location.hash = '#/cases/restart-test/jobs'; });
    await expect(page.getByRole('alert')).toContainText('No recovery job has been created');
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('No recovery job has been created');
    await expect(page.getByText('Metadata recovery running')).toHaveCount(0);
  } finally {
    await electronApp.close();
  }
});
