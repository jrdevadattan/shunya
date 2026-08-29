import { expect, test } from '@playwright/test';
import { launchPackagedApp } from './support/electron-app.js';
import { createLiveCase } from './support/case-context.js';

test('result filtering remains responsive without renderer long tasks', async () => {
  const electronApp = await launchPackagedApp();
  let cleanup: () => Promise<void> = async () => undefined;
  try {
    const page = await electronApp.firstWindow(); await page.waitForLoadState('domcontentloaded'); await page.locator('#root').waitFor();
    const context = await createLiveCase(page, 'Responsive results context'); cleanup = context.cleanup;
    await page.evaluate((caseId) => { (window as unknown as { __longTasks: number }).__longTasks = 0; new PerformanceObserver((list) => { (window as unknown as { __longTasks: number }).__longTasks += list.getEntries().length; }).observe({ type: 'longtask', buffered: true }); window.location.hash = `#/cases/${caseId}/results`; }, context.caseId);
    const search = page.getByRole('searchbox'); const started = Date.now();
    for (const query of ['report', 'jpeg', 'script', 'report']) { await search.fill(query); await expect(search).toHaveValue(query); }
    await expect(page.getByRole('row')).toHaveCount(0);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(await page.evaluate(() => (window as unknown as { __longTasks: number }).__longTasks)).toBeLessThanOrEqual(2);
  } finally { await electronApp.close(); await cleanup(); }
});
