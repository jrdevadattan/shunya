import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchPackagedApp } from './support/electron-app.js';

async function expectFrontmost(locator: Locator) {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('Action has no rendered bounds.');
  expect(await locator.evaluate((element, point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    return Boolean(hit && (hit === element || element.contains(hit)));
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 })).toBe(true);
}

async function clickAndExpectHash(page: Page, action: Locator, hash: RegExp) {
  await expectFrontmost(action);
  await action.click();
  await expect(page).toHaveURL(hash);
}

test('packaged home, intake, recovery path, and support actions change route and state', async () => {
  const electronApp = await launchPackagedApp();
  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); window.location.hash = '#/'; });
    await expect(page.getByRole('heading', { name: 'Your recovery cases' })).toBeVisible();

    await clickAndExpectHash(page, page.getByRole('link', { name: 'New recovery' }), /#\/cases\/new$/);
    await page.getByLabel('Case title').fill('Action smoke case');
    await page.getByLabel('Operator name or ID').fill('action-operator');
    await expectFrontmost(page.getByRole('button', { name: 'Continue to workspace' }));
    await page.getByRole('button', { name: 'Continue to workspace' }).click();
    await expect(page.getByRole('heading', { name: 'Choose a parent folder' })).toBeVisible();
    await expectFrontmost(page.getByRole('button', { name: 'Back' }));
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: 'Tell us about this recovery' })).toBeVisible();
    await clickAndExpectHash(page, page.getByRole('link', { name: 'Cancel' }), /#\/$/);

    for (const [name, hash] of [
      ['Recover from a device', /#\/cases\/new$/],
      ['Analyze a disk image', /#\/cases\/new\?source=disk-image$/],
      ['Analyze a memory image', /#\/cases\/new\?source=memory-image$/],
    ] as const) {
      await clickAndExpectHash(page, page.getByRole('link', { name: new RegExp(name) }), hash);
      await expect(page.getByRole('heading', { name: 'Start a new recovery case' })).toBeVisible();
      await clickAndExpectHash(page, page.getByRole('link', { name: 'Cancel' }), /#\/$/);
    }

    await clickAndExpectHash(page, page.getByRole('link', { name: 'Settings' }), /#\/settings$/);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await clickAndExpectHash(page, page.getByRole('link', { name: 'Help' }), /#\/help$/);
    await expect(page.getByRole('heading', { name: 'Help' })).toBeVisible();
    await clickAndExpectHash(page, page.getByRole('link', { name: 'About' }), /#\/about$/);
    await expect(page.getByRole('heading', { name: 'About SHUNYA Recovery' })).toBeVisible();
  } finally {
    await electronApp.close();
  }
});

test('packaged open/reopen, case sidebar, and source actions are frontmost and responsive', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'recovery-actions-e2e-'));
  const workspace = path.join(directory, 'valid-case');
  const invalidWorkspace = path.join(directory, 'not-a-case');
  const imagePath = path.join(directory, 'action-source.raw');
  const electronApp = await launchPackagedApp();
  try {
    await writeFile(imagePath, 'action source fixture');
    await mkdir(invalidWorkspace);
    const page = await electronApp.firstWindow();
    const recoveryCase = await page.evaluate(async (workspacePath) => window.recoveryApi.createCase({
      title: 'Action case', operator: 'action-operator', referenceNumber: null,
      organization: null, workspacePath, notes: null,
    }), workspace);
    await electronApp.evaluate(({ dialog }, paths) => {
      const responses = [
        { canceled: true, filePaths: [], bookmarks: [] },
        { canceled: false, filePaths: [paths.invalidWorkspace], bookmarks: [] },
        { canceled: false, filePaths: [paths.workspace], bookmarks: [] },
        { canceled: false, filePaths: [paths.imagePath], bookmarks: [] },
      ];
      dialog.showOpenDialog = async () => responses.shift() ?? { canceled: true, filePaths: [], bookmarks: [] };
    }, { workspace, invalidWorkspace, imagePath });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); window.location.hash = '#/'; });

    await clickAndExpectHash(page, page.getByRole('link', { name: 'Open existing case' }), /#\/cases\/open$/);
    const chooseWorkspace = page.getByRole('button', { name: 'Choose case workspace' });
    await expectFrontmost(chooseWorkspace);
    await chooseWorkspace.click();
    await expect(page).toHaveURL(/#\/cases\/open$/);
    await expect(chooseWorkspace).toBeEnabled();
    await chooseWorkspace.click();
    await expect(page.getByRole('alert')).toContainText(/CASE_OPEN_FAILED|filesystem error/i);
    await expect(chooseWorkspace).toBeEnabled();
    await chooseWorkspace.click();
    await expect(page).toHaveURL(new RegExp(`#\/cases\/${recoveryCase.caseId}\/overview$`));
    await expect(page.getByRole('heading', { name: 'Recovery overview' })).toBeVisible({ timeout: 20_000 });

    const navigation = page.getByRole('navigation', { name: 'Case navigation' });
    for (const [name, route] of [
      ['Case activity', 'activity'],
      ['Recovery', 'sources'],
      ['Verify', 'results'],
      ['Reports', 'reports'],
      ['Case setup', 'overview'],
    ] as const) {
      await clickAndExpectHash(page, navigation.getByRole('link', { name, exact: true }), new RegExp(`#\/cases\/${recoveryCase.caseId}\/${route}$`));
    }

    await clickAndExpectHash(page, navigation.getByRole('link', { name: 'Recovery', exact: true }), new RegExp(`#\/cases\/${recoveryCase.caseId}\/sources$`));
    await expect(page.getByRole('heading', { name: 'Select recovery source' })).toBeVisible();
    const refresh = page.getByRole('button', { name: 'Refresh' });
    await expectFrontmost(refresh);
    await refresh.click();
    await page.getByRole('button', { name: 'Choose image file' }).click();
    await expect(page.getByLabel('Disk image path')).toHaveValue(imagePath);
    const addImage = page.getByRole('button', { name: 'Add image source' });
    await expectFrontmost(addImage);
    await addImage.click();
    await expect(page).toHaveURL(new RegExp(`#\/cases\/${recoveryCase.caseId}\/sources\/[^/]+\/assessment$`), { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'action-source.raw' })).toBeVisible();
  } finally {
    await electronApp.close();
    await rm(directory, { recursive: true, force: true });
  }
});
