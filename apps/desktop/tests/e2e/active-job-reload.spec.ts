import { expect, test } from '@playwright/test';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPackagedTestProfile, launchPackagedApp } from './support/electron-app.js';
import { createLiveCase } from './support/case-context.js';

test('reloading the current case preserves active job visibility and controls', async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(path.join(tmpdir(), 'recovery-active-reload-'));
  const imagePath = path.join(directory, 'active.raw');
  const image = await open(imagePath, 'w');
  await image.truncate(1024 * 1024 * 1024);
  await image.close();
  const electronApp = await launchPackagedApp();
  let cleanupCase: () => Promise<void> = async () => undefined;
  try {
    const page = await electronApp.firstWindow();
    const context = await createLiveCase(page, 'Active reload case'); cleanupCase = context.cleanup;
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/sources`; }, context.caseId);
    await page.getByLabel('Disk image path').fill(imagePath);
    await page.getByRole('button', { name: 'Add image source' }).click();
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Choose recovery goal' }).click();
    await page.getByRole('button', { name: /Recover everything/ }).click();
    await page.getByRole('button', { name: 'Continue to scan options' }).click();
    await page.getByText('Full Scan', { exact: true }).locator('..').getByRole('button', { name: 'Use this preset' }).click();
    await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).some((key) => key.endsWith(':jobId')))).toBe(true);

    await page.reload();

    await expect(page.getByText('Active reload case')).toBeVisible();
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/jobs`; }, context.caseId);
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('heading', { name: 'Recovery paused' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).some((key) => key.endsWith(':jobId')))).toBe(true);
    await page.getByRole('button', { name: 'Cancel scan' }).click();
    await expect(page.getByRole('heading', { name: 'Recovery cancelled' })).toBeVisible();
  } finally {
    await electronApp.close();
    await cleanupCase();
    await rm(directory, { recursive: true, force: true });
  }
});

test('closing and relaunching with an isolated profile restores only persisted case source and job state', async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(path.join(tmpdir(), 'recovery-process-relaunch-'));
  const imagePath = path.join(directory, 'relaunch.raw');
  const image = await open(imagePath, 'w');
  await image.truncate(1024 * 1024 * 1024);
  await image.close();
  const profile = createPackagedTestProfile();
  let electronApp = await launchPackagedApp({ userDataPath: profile.userDataPath });
  let cleanupEmptyCase: () => Promise<void> = async () => undefined;
  let cleanupJobCase: () => Promise<void> = async () => undefined;
  try {
    let page = await electronApp.firstWindow();
    const emptyCase = await createLiveCase(page, 'Relaunch no-job case'); cleanupEmptyCase = emptyCase.cleanup;
    const jobCase = await createLiveCase(page, 'Relaunch paused case'); cleanupJobCase = jobCase.cleanup;
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/sources`; }, jobCase.caseId);
    await page.getByLabel('Disk image path').fill(imagePath);
    await page.getByRole('button', { name: 'Add image source' }).click();
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Choose recovery goal' }).click();
    await page.getByRole('button', { name: /Recover everything/ }).click();
    await page.getByRole('button', { name: 'Continue to scan options' }).click();
    await page.getByText('Full Scan', { exact: true }).locator('..').getByRole('button', { name: 'Use this preset' }).click();
    await expect.poll(() => page.evaluate((caseId) => sessionStorage.getItem(`recovery:${caseId}:jobId`), jobCase.caseId)).not.toBeNull();
    await page.evaluate(async (caseId) => {
      const jobId = sessionStorage.getItem(`recovery:${caseId}:jobId`);
      if (!jobId) throw new Error('job identifier was not retained');
      await window.recoveryApi.pauseJob(jobId);
    }, jobCase.caseId);
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/jobs`; }, jobCase.caseId);
    await expect(page.getByRole('heading', { name: 'Recovery paused' })).toBeVisible();
    await electronApp.close();

    electronApp = await launchPackagedApp({ userDataPath: profile.userDataPath });
    page = await electronApp.firstWindow();
    await expect(page.getByRole('heading', { name: 'Your recovery cases' })).toBeVisible();
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.endsWith(':sourceId') || key.endsWith(':jobId')))).toEqual([]);

    await page.getByText('Relaunch no-job case', { exact: true }).locator('..').locator('..').getByRole('button', { name: 'Continue case' }).click();
    await expect(page.getByRole('heading', { name: 'No recovery job yet' })).toBeVisible();
    await page.evaluate(() => { window.location.hash = '#/'; });
    await page.getByText('Relaunch paused case', { exact: true }).locator('..').locator('..').getByRole('button', { name: 'Continue case' }).click();
    await expect(page.getByRole('heading', { name: 'Recovery overview' })).toBeVisible();
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/jobs`; }, jobCase.caseId);
    await expect(page.getByRole('heading', { name: 'Recovery paused' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resume recovery' })).toBeVisible();
  } finally {
    await electronApp.close().catch(() => undefined);
    profile.cleanup();
    await cleanupEmptyCase();
    await cleanupJobCase();
    await rm(directory, { recursive: true, force: true });
  }
});
