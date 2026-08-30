import { expect, test } from '@playwright/test';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchPackagedApp } from './support/electron-app.js';
import { createLiveCase } from './support/case-context.js';

test('live recovery renders daemon partitions, progress, results, preview and report limitations', async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(path.join(tmpdir(), 'recovery-live-e2e-'));
  const imagePath = path.join(directory, 'live.raw');
  const image = Buffer.alloc(2 * 1024 * 1024);
  image[510] = 0x55; image[511] = 0xaa; image[446 + 4] = 0x0c;
  image.writeUInt32LE(1, 446 + 8); image.writeUInt32LE(image.length / 512 - 1, 446 + 12);
  image.write('FAT32   ', 512 + 82, 'ascii');
  for (let index = 0; index < 101; index += 1) {
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from(`live renderer recovery ${index}`), 0xff, 0xd9]).copy(image, 4096 + index * 64);
  }
  await writeFile(imagePath, image);
  const electronApp = await launchPackagedApp();
  let cleanupCase: () => Promise<void> = async () => undefined;
  try {
    const page = await electronApp.firstWindow();
    const context = await createLiveCase(page, 'Live renderer recovery');
    cleanupCase = context.cleanup;
    await expect(page.getByText('Live renderer recovery')).toBeVisible();
    await page.getByRole('link', { name: 'Recovery', exact: true }).click();
    await page.getByLabel('Disk image path').fill(imagePath);
    await page.getByRole('button', { name: 'Add image source' }).click();
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Choose recovery goal' }).click();
    await page.getByRole('button', { name: /Recover everything/ }).click();
    await page.getByRole('button', { name: 'Continue to scan options' }).click();
    await page.getByText('Full Scan', { exact: true }).locator('..').getByRole('button', { name: 'Use this preset' }).click();
    await expect(page.getByRole('heading', { name: 'Partitions found' })).toBeVisible();
    await expect(page.getByRole('figure', { name: 'Partition map' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Detected partition tree' })).toContainText(/partition-1.*FAT32/s);
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/jobs`; }, context.caseId);
    await expect(page.getByRole('heading', { name: 'Recovery completed' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/recovered content was not threat-scanned/i)).toBeVisible();
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/activity`; }, context.caseId);
    await expect(page.getByRole('heading', { name: 'Case activity' })).toBeVisible();
    await page.setViewportSize({ width: 1427, height: 894 });
    const beforeScroll = await page.evaluate(() => ({
      sidebarTop: document.querySelector('.app-shell__sidebar')?.getBoundingClientRect().top,
      headerTop: document.querySelector('.app-shell__header')?.getBoundingClientRect().top,
    }));
    await page.locator('.app-shell__content').evaluate((element) => { element.scrollTop = element.scrollHeight; });
    const afterScroll = await page.evaluate(() => ({
      sidebarTop: document.querySelector('.app-shell__sidebar')?.getBoundingClientRect().top,
      headerTop: document.querySelector('.app-shell__header')?.getBoundingClientRect().top,
    }));
    expect(afterScroll).toEqual(beforeScroll);
    await page.evaluate((caseId) => { window.location.hash = `#/cases/${caseId}/results`; }, context.caseId);
    const preloadPage = await page.evaluate(() => window.recoveryApi.queryArtifacts({ pageSize: 100 }));
    const sessionState = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
    const dom = await page.locator('body').innerText();
    const directPage = await directArtifactQuery(context.workspacePath);
    expect(directPage).toEqual(preloadPage);
    expect(Object.keys(sessionState)).toContainEqual(expect.stringMatching(/:jobId$/));
    expect(dom).toContain('Recovered JPEG 0000001');
    await expect(page.getByText(/Recovered JPEG 0000001/).first()).toBeVisible();
    await page.setViewportSize({ width: 1427, height: 894 });
    const artifactRow = page.locator('.artifact-table tbody tr').first();
    const artifactLayout = await artifactRow.evaluate((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      return {
        display: getComputedStyle(row).display,
        nameWidth: cells[1]?.getBoundingClientRect().width ?? 0,
        conditionWidth: cells[5]?.getBoundingClientRect().width ?? 0,
      };
    });
    expect(artifactLayout.display).toBe('table-row');
    expect(artifactLayout.nameWidth).toBeGreaterThanOrEqual(170);
    expect(artifactLayout.conditionWidth).toBeGreaterThanOrEqual(90);
    await expect(page.getByText(/Preview derivative is unavailable/i)).toBeVisible();
    await expect(page.getByText(/not scanned/i)).toBeVisible();
    await page.getByRole('button', { name: 'Load more results' }).click();
    await expect(page.getByText(/Recovered JPEG 0000101/).first()).toBeVisible();
    await page.getByRole('searchbox').fill('Recovered JPEG 0000001');
    await expect(page.getByText(/Recovered JPEG 0000001/).first()).toBeVisible();
    await page.getByRole('link', { name: 'Reports' }).click();
    await page.getByRole('button', { name: 'Generate report' }).click();
    await expect(page.getByText(/YARA_X_UNAVAILABLE/)).toBeVisible();
  } finally {
    await electronApp.close();
    await cleanupCase();
    await rm(directory, { recursive: true, force: true });
  }
});

async function directArtifactQuery(casePath: string): Promise<unknown> {
  const executable = path.resolve(`../../target/release/${process.platform === 'win32' ? 'recoveryd.exe' : 'recoveryd'}`);
  const child = spawn(executable, [], { stdio: ['pipe', 'pipe', 'pipe'] });
  let buffer = '';
  const waiters = new Map<string, (frame: { kind: string; result?: unknown; error?: { code: string; message: string } }) => void>();
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    for (;;) {
      const newline = buffer.indexOf('\n');
      if (newline < 0) break;
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const frame = JSON.parse(line) as { id?: string; kind: string; result?: unknown; error?: { code: string; message: string } };
      if (frame.id) waiters.get(frame.id)?.(frame);
    }
  });
  const request = (method: string, params: Record<string, unknown>) => new Promise<unknown>((resolve, reject) => {
    const id = randomUUID();
    waiters.set(id, (frame) => {
      waiters.delete(id);
      if (frame.kind === 'response') resolve(frame.result);
      else reject(new Error(`${frame.error?.code}: ${frame.error?.message}`));
    });
    child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
  });
  try {
    await request('case.open', { casePath });
    return await request('artifact.query', { pageSize: 100 });
  } finally {
    child.kill();
  }
}
