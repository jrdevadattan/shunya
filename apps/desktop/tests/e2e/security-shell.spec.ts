import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';

test('security shell keeps Node globals out of the renderer', async () => {
  const electronApp = await launchPackagedApp();

  try {
    const page = await electronApp.firstWindow();
    expect(await page.evaluate(() => typeof (window as Window & { require?: unknown }).require)).toBe('undefined');
    expect(await page.evaluate(() => typeof (window as Window & { process?: unknown }).process)).toBe('undefined');
  } finally {
    await electronApp.close();
  }
});
