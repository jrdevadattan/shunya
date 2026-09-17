import { expect, test } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchPackagedApp } from './support/electron-app.js';

test('case lifecycle persists, reopens, and continues a truthful case without inventing a job', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'recovery-case-e2e-'));
  const workspace = path.join(parent, 'E2E laptop recovery');
  const electronApp = await launchPackagedApp();
  try {
    await electronApp.evaluate(({ dialog }, selectedPath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selectedPath], bookmarks: [] });
    }, parent);
    const page = await electronApp.firstWindow();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      window.location.hash = '#/';
    });

    await expect(page.getByRole('heading', { name: 'Your recovery cases' })).toBeVisible();
    await page.getByRole('link', { name: 'New recovery' }).click();
    await page.getByLabel('Case title').fill('E2E laptop recovery');
    await page.getByLabel('Operator name or ID').fill('e2e-operator');
    await page.getByLabel('Notes').fill('private notes must not enter recent storage');
    await page.getByRole('button', { name: 'Continue to workspace' }).click();
    await page.getByRole('button', { name: 'Choose parent folder' }).click();
    await expect(page.getByText(parent, { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Continue to review' }).click();
    await page.getByRole('button', { name: 'Create case' }).click();
    await expect(page).toHaveURL(/#\/cases\/[^/]+\/sources$/);
    await expect(page.getByRole('heading', { name: 'Select recovery source' })).toBeVisible();

    const manifest = JSON.parse(await readFile(path.join(workspace, 'case.json'), 'utf8')) as { caseId: string; title: string };
    expect(manifest.title).toBe('E2E laptop recovery');
    await page.getByRole('link', { name: 'Cases', exact: true }).click();
    await page.reload();
    await expect(page.getByText('E2E laptop recovery', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue case' }).click();

    await expect(page).toHaveURL(new RegExp(`#\/cases\/${manifest.caseId}\/overview$`));
    await expect(page.getByRole('heading', { name: 'Recovery overview' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'No recovery job yet' })).toBeVisible();
    await expect(page.getByText('Add a source, choose a recovery goal, and select a scan preset to create the first recovery job.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Add source|Configure recovery/ }).first()).toBeVisible();
    expect(await page.evaluate((caseId) => sessionStorage.getItem(`recovery:${caseId}:jobId`), manifest.caseId)).toBeNull();
    const storedRecent = await page.evaluate(() => localStorage.getItem('recovery:recent-cases'));
    expect(storedRecent).not.toContain('private notes');
    expect(Object.keys(JSON.parse(storedRecent!)[0]).sort()).toEqual(['caseId', 'createdAt', 'operator', 'title', 'workspacePath']);

    await page.evaluate(() => localStorage.setItem('recovery:recent-cases', '{bad json'));
    await page.getByRole('link', { name: 'Cases', exact: true }).click();
    await page.reload();
    await expect(page.getByText('No recent cases are stored on this device yet.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your recovery cases' })).toBeVisible();
  } finally {
    await electronApp.close();
    await rm(parent, { recursive: true, force: true });
  }
});
