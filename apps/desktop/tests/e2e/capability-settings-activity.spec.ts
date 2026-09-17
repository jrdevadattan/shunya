import { expect, test } from '@playwright/test';
import { createLiveCase } from './support/case-context.js';
import { launchPackagedApp } from './support/electron-app.js';

test('case activity is persistently discoverable and timestamps its case record in UTC', async () => {
  const electronApp = await launchPackagedApp();
  let cleanup: () => Promise<void> = async () => undefined;
  try {
    const page = await electronApp.firstWindow();
    const context = await createLiveCase(page, 'Activity navigation context'); cleanup = context.cleanup;
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/activity`; }, context.caseId);

    const current = page.getByRole('navigation', { name: 'Case navigation' }).getByRole('link', { name: 'Case activity' });
    await expect(current).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-activity-sequence="case"] time')).toContainText(/ UTC$/);
  } finally { await electronApp.close(); await cleanup(); }
});

test('settings persists supported appearance choices and keeps safety invariants non-interactive', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => { window.location.hash = '#/settings'; });
    await page.getByLabel('Dark theme').check();
    await page.getByLabel('Collapse navigation sidebar').check();
    await page.reload();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('[data-testid="app-shell"]')).toHaveAttribute('data-collapsed', 'true');
    await expect(page.locator('.settings-invariant input')).toHaveCount(0);
  } finally { await electronApp.close(); }
});
