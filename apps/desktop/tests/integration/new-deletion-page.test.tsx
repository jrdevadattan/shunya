// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewDeletionPage, explainDeletionError } from '../../src/renderer/routes/NewDeletionPage.js';
import { loadRecentDeletions, RECENT_DELETIONS_STORAGE_KEY } from '../../src/renderer/features/cases/recent-deletions.js';
import type { DeletionPlan, DeletionResult } from '../../src/main/secure-erase/folderDeletion.js';

const plan: DeletionPlan = {
  planId: '6f1d3c1e-0b1c-4a5e-9b3f-6c3a2f1e0d11', targetPath: 'E:\\Evidence\\old-exports',
  device: { device: { device: '\\\\.\\PhysicalDrive2', model: 'SanDisk Ultra', serial: '6270', sizeBytes: 30_752_636_928, busType: 'USB', removable: true, system: false }, mountRoot: 'E:\\' },
  fileCount: 3, directoryCount: 1, totalBytes: 4096, sample: ['a.txt', 'nested\\b.bin', 'c.log'], skipped: [], plannedAt: '2026-09-05T08:00:00Z',
};
const result: DeletionResult = {
  planId: plan.planId, targetPath: plan.targetPath, device: plan.device, method: 'csprng_overwrite', assurance: 'clear',
  fileCount: 3, filesDeleted: 3, bytesOverwritten: 4096, directoriesRemoved: 2, failures: [], skipped: [],
  startedAt: '2026-09-05T08:00:01Z', completedAt: '2026-09-05T08:00:03Z', auditLogPath: 'C:\\audit\\secure-erase\\2026-09-05.ndjson',
};

let root: Root | undefined;
let container: HTMLDivElement | undefined;

async function render() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={['/deletion/new']}><Routes><Route path="/deletion/new" element={<NewDeletionPage />} /><Route path="/" element={<p>Home</p>} /></Routes></MemoryRouter>);
  });
}

function button(name: RegExp): HTMLButtonElement {
  const match = Array.from(container?.querySelectorAll<HTMLButtonElement>('button') ?? []).find((element) => name.test(element.textContent ?? ''));
  if (!match) throw new Error(`Button not found: ${name}`);
  return match;
}

async function click(control: HTMLElement) { await act(async () => control.click()); }
async function type(control: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(control, value);
    control.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function settle() { await act(async () => new Promise((resolve) => setTimeout(resolve, 0))); }

beforeEach(() => {
  localStorage.removeItem(RECENT_DELETIONS_STORAGE_KEY);
  Object.assign(window, {
    recoveryApi: {},
    secureErase: { onProgress: () => () => undefined, onCaptureProgress: () => () => undefined },
    certificates: { generate: vi.fn(), verify: vi.fn(), save: vi.fn() },
    deletionApi: {
      chooseFolder: vi.fn().mockResolvedValue(plan.targetPath),
      plan: vi.fn().mockResolvedValue(plan),
      execute: vi.fn().mockResolvedValue(result),
      onProgress: vi.fn().mockReturnValue(() => undefined),
    },
  });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

describe('NewDeletionPage', () => {
  it('plans the folder, requires the exact path as confirmation, executes, and records the result', async () => {
    await render();
    await click(button(/Choose folder/));
    await settle();
    expect(window.deletionApi.plan).toHaveBeenCalledWith(plan.targetPath);
    expect(container?.textContent).toContain('SanDisk Ultra');
    expect(container?.textContent).toContain('3 files');
    expect(container?.textContent).toContain('Removable');

    const deleteButton = button(/Securely delete 3 files/);
    expect(deleteButton.disabled).toBe(true);
    const confirm = container?.querySelector<HTMLInputElement>('input[aria-label="Type the folder path to confirm"]');
    await type(confirm!, 'E:\\Evidence');
    expect(button(/Securely delete 3 files/).disabled).toBe(true);
    await type(confirm!, plan.targetPath);
    expect(button(/Securely delete 3 files/).disabled).toBe(false);

    await click(button(/Securely delete 3 files/));
    await settle();
    expect(window.deletionApi.execute).toHaveBeenCalledWith(plan.planId, { confirmation: plan.targetPath });
    expect(container?.textContent).toContain('Secure deletion complete');
    expect(container?.textContent).toContain('3 of 3 files overwritten and removed');
    expect(container?.textContent).toContain(result.auditLogPath);

    const remembered = loadRecentDeletions();
    expect(remembered).toHaveLength(1);
    expect(remembered[0]).toMatchObject({ id: plan.planId, targetPath: plan.targetPath, totalFiles: 3, filesDeleted: 3, status: 'completed', deviceModel: 'SanDisk Ultra' });
  });

  it('explains a refused folder in plain language instead of crashing', async () => {
    (window.deletionApi.plan as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DELETION_NON_REMOVABLE_BLOCKED'));
    await render();
    await click(button(/Choose folder/));
    await settle();
    const alert = container?.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('internal drive');
    expect(container?.querySelector('input[aria-label="Type the folder path to confirm"]')).toBeNull();
    expect(explainDeletionError('DELETION_DRIVE_ROOT_BLOCKED')).toContain('Erase a device');
    expect(explainDeletionError("Error invoking remote method 'deletion.plan': Error: DELETION_SYSTEM_DEVICE_BLOCKED")).toContain('system disk');
    expect(explainDeletionError('EACCES: permission denied')).toBe('EACCES: permission denied');
  });
});
