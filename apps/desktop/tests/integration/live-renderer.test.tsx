// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SourceAssessmentPage } from '../../src/renderer/features/sources/SourceAssessmentPage.js';
import { PartitionList } from '../../src/renderer/features/sources/PartitionList.js';
import { JobProgressPage } from '../../src/renderer/features/jobs/JobProgressPage.js';
import { ResultsPage } from '../../src/renderer/features/results/ResultsPage.js';
import { ExportWizard } from '../../src/renderer/features/export/ExportWizard.js';
import { ReportsPage } from '../../src/renderer/features/reports/ReportsPage.js';
import { MemoryResultsPage } from '../../src/renderer/features/memory/MemoryResultsPage.js';
import { CaseLayout } from '../../src/renderer/routes/CaseLayout.js';
import { ScanOptionsPage } from '../../src/renderer/features/recovery/ScanOptionsPage.js';

const createdAt = '2026-08-29T12:00:00Z';
const source = {
  sourceId: 'source-live', kind: 'raw_image', displayName: 'live-evidence.raw', stableId: 'sha256:live',
  sizeBytes: '2097152', logicalSectorSize: 512, physicalSectorSize: 512, bus: null, model: null,
  serialRedacted: null, systemDisk: false, mountedReadWrite: false, encryptedState: 'none', health: 'healthy',
  capabilities: [],
} as const;
const status = {
  jobId: 'job-live', caseId: 'case-live', sourceId: source.sourceId, goal: 'recover_everything', preset: 'full',
  stage: 'completed', createdAt, updatedAt: createdAt,
  limitations: [{ code: 'YARA_X_UNAVAILABLE', stage: 'threat_scan', level: 'unsupported', explanation: 'Recovered content was not threat-scanned.', recommendedAction: 'Install and verify YARA-X.' }],
  partitions: { sectorSize: 512, partitions: [{ partitionId: 'partition-1', index: 1, startSector: '1', sectorCount: '4095', startOffsetBytes: '512', lengthBytes: '2096640', partitionType: 'FAT32', filesystem: null, label: 'Evidence volume' }], candidates: [], gaps: [], rawToolOutput: null, toolVersion: null },
} as const;
const artifact = {
  artifactId: 'artifact-live', sourceId: source.sourceId, partitionId: 'partition-1', originalName: null, originalPath: null,
  displayName: 'JPEG_live.jpg', extension: 'jpg', mimeType: 'image/jpeg', sizeBytes: '42', recoveryMethod: 'carving',
  recoveryState: 'complete_validated', sha256: 'a'.repeat(64), sourceRanges: [{ offset: '4096', length: '42' }],
  threatStatus: 'not_scanned', previewStatus: 'unsupported',
} as const;

function api(overrides: Record<string, unknown> = {}) {
  return {
    getRuntimeInfo: vi.fn().mockResolvedValue({ mode: 'installed' }),
    createCase: vi.fn(), openCase: vi.fn().mockResolvedValue({ caseId: 'case-live', title: 'Live case title', operator: 'operator', referenceNumber: null, organization: null, workspacePath: 'D:/case-live', notes: null, createdAt }), listSources: vi.fn().mockResolvedValue([source]), addImageSource: vi.fn(),
    assessSource: vi.fn().mockResolvedValue({ sourceId: source.sourceId, decision: 'ready', requiresAcknowledgement: false, findings: [{ code: 'DAEMON_READY', level: 'supported', title: 'Live image ready', explanation: 'Daemon assessment completed.', recommendedAction: 'Continue.' }] }),
    createRecoveryJob: vi.fn(), startJob: vi.fn(), pauseJob: vi.fn(), resumeJob: vi.fn(), cancelJob: vi.fn(),
    getJobStatus: vi.fn().mockResolvedValue(status), listJobEvents: vi.fn().mockResolvedValue([{ eventId: 'event-live', jobId: 'job-live', sequence: 9, stage: 'completed', occurredAt: createdAt, message: 'Recovery completed' }]),
    queryArtifacts: vi.fn().mockResolvedValue({ items: [artifact], nextCursor: null }),
    getArtifact: vi.fn().mockResolvedValue(artifact), requestPreview: vi.fn().mockResolvedValue({ artifactId: artifact.artifactId, status: 'unsupported', policy: 'derivative_required', detectedMimeType: 'image/jpeg', derivativePath: null }),
    exportArtifacts: vi.fn().mockResolvedValue({ exportId: 'export-live', items: [{ artifactId: artifact.artifactId, outputPath: 'D:/verified/JPEG_live.jpg', sha256: artifact.sha256, verified: true }] }),
    generateReport: vi.fn().mockResolvedValue({ caseId: 'case-live', jsonPath: 'D:/case/report.json', markdownPath: 'D:/case/report.md', limitations: status.limitations }),
    subscribeJobEvents: vi.fn().mockReturnValue(() => undefined),
    ...overrides,
  };
}

let root: Root | undefined;
let container: HTMLDivElement | undefined;

async function renderRoute(element: ReactNode, path: string, route: string) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={element} /></Routes></MemoryRouter>);
  });
}

async function findText(text: string | RegExp): Promise<HTMLElement> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const matches = (element: Element) => typeof text === 'string' ? element.textContent === text : text.test(element.textContent ?? '');
    const match = Array.from(container?.querySelectorAll<HTMLElement>('*') ?? []).find((element) =>
      matches(element) && !Array.from(element.children).some(matches),
    );
    if (match) return match;
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  throw new Error(`Text not found: ${String(text)}\n${container?.innerHTML ?? ''}`);
}

function button(name: string | RegExp): HTMLButtonElement {
  const match = Array.from(container?.querySelectorAll<HTMLButtonElement>('button') ?? []).find((element) =>
    typeof name === 'string' ? element.textContent?.trim() === name : name.test(element.textContent ?? ''),
  );
  if (!match) throw new Error(`Button not found: ${String(name)}`);
  return match;
}

function input(label: string): HTMLInputElement {
  const match = Array.from(container?.querySelectorAll<HTMLLabelElement>('label') ?? []).find((element) => element.textContent?.includes(label))?.querySelector('input');
  if (!match) throw new Error(`Input not found: ${label}`);
  return match;
}

async function change(control: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(control, value);
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function click(control: HTMLElement) {
  await act(async () => control.click());
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
  sessionStorage.setItem('recovery:case-live:jobId', 'job-live');
  sessionStorage.setItem('recovery:case-live:workspacePath', 'D:/case-live');
  Object.assign(window, { recoveryApi: api() });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.restoreAllMocks();
});

describe('live renderer pages', () => {
  it('opens the persisted case and renders the daemon case title', async () => {
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={['/cases/case-live/overview']}><Routes><Route path="/cases/:caseId" element={<CaseLayout />}><Route path="overview" element={<p>Overview loaded</p>} /></Route></Routes></MemoryRouter>));
    expect(await findText('Live case title')).toBeTruthy();
    expect(await findText('Overview loaded')).toBeTruthy();
  });

  it('renders source assessment findings returned by the daemon', async () => {
    await renderRoute(<SourceAssessmentPage />, '/cases/case-live/sources/source-live/assessment', '/cases/:caseId/sources/:sourceId/assessment');
    expect(await findText('Live image ready')).toBeTruthy();
    expect(await findText('live-evidence.raw')).toBeTruthy();
  });

  it('renders persisted partition results returned by job.status', async () => {
    await renderRoute(<PartitionList />, '/cases/case-live/recovery/partitions', '/cases/:caseId/recovery/partitions');
    expect(await findText('Evidence volume')).toBeTruthy();
    expect(await findText('512')).toBeTruthy();
    expect(await findText('2096640')).toBeTruthy();
  });

  it('creates and starts a daemon job before showing partition results', async () => {
    sessionStorage.removeItem('recovery:case-live:jobId');
    sessionStorage.setItem('recovery:case-live:sourceId', 'source-live');
    sessionStorage.setItem('recovery:case-live:goal', 'recover_everything');
    Object.assign(window, { recoveryApi: api({
      createRecoveryJob: vi.fn().mockResolvedValue({ jobId: 'job-new', caseId: 'case-live', sourceId: 'source-live', goal: 'recover_everything', preset: 'full', stage: 'draft', createdAt, updatedAt: createdAt }),
      startJob: vi.fn().mockResolvedValue({ ...status, jobId: 'job-new', stage: 'preflight', partitions: null }),
      getJobStatus: vi.fn().mockResolvedValueOnce({ ...status, jobId: 'job-new', stage: 'preflight', partitions: null }).mockResolvedValue(status),
    }) });
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={['/cases/case-live/recovery/scan-options']}><Routes><Route path="/cases/:caseId/recovery/scan-options" element={<ScanOptionsPage />} /><Route path="/cases/:caseId/recovery/partitions" element={<PartitionList />} /></Routes></MemoryRouter>));
    const fullCard = Array.from(container.querySelectorAll('article')).find((element) => element.textContent?.includes('Full Scan'));
    const usePreset = fullCard?.querySelector('a,button') as HTMLElement | null;
    if (!usePreset) throw new Error('Full Scan action not found');
    await click(usePreset);
    expect(sessionStorage.getItem('recovery:case-live:jobId')).toBe('job-new');
    expect(await findText('Evidence volume')).toBeTruthy();
  });

  it('renders live job state, events, limitations, and controls daemon errors', async () => {
    Object.assign(window, { recoveryApi: api({ pauseJob: vi.fn().mockRejectedValue(new Error('JOB_NOT_RUNNING: completed job')) }) });
    await renderRoute(<JobProgressPage />, '/cases/case-live/jobs', '/cases/:caseId/jobs');
    expect(await findText('Recovery completed')).toBeTruthy();
    expect(await findText(/Recovered content was not threat-scanned/)).toBeTruthy();
  });

  it('renders daemon artifact pages and the daemon preview refusal', async () => {
    await renderRoute(<ResultsPage />, '/cases/case-live/results', '/cases/:caseId/results');
    expect(await findText('JPEG_live.jpg')).toBeTruthy();
    await click(button(/JPEG_live.jpg/));
    expect(await findText(/preview derivative is unavailable/i)).toBeTruthy();
    expect(await findText(/not scanned/i)).toBeTruthy();
  });

  it('sends changed result searches back through the typed daemon query', async () => {
    const queryArtifacts = vi.fn().mockResolvedValue({ items: [artifact], nextCursor: null });
    Object.assign(window, { recoveryApi: api({ queryArtifacts }) });
    await renderRoute(<ResultsPage />, '/cases/case-live/results', '/cases/:caseId/results');
    await findText('JPEG_live.jpg');
    await change(input('Search recovered files'), 'ledger');
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(queryArtifacts).toHaveBeenLastCalledWith({ search: 'ledger', cursor: undefined, pageSize: 100 });
  });

  it('loads daemon result pagination cursors without renderer fixtures', async () => {
    const secondArtifact = { ...artifact, artifactId: 'artifact-second', displayName: 'Recovered JPEG 0000002' };
    const queryArtifacts = vi.fn()
      .mockResolvedValueOnce({ items: [artifact], nextCursor: 'cursor-live' })
      .mockResolvedValueOnce({ items: [secondArtifact], nextCursor: null });
    Object.assign(window, { recoveryApi: api({ queryArtifacts }) });
    await renderRoute(<ResultsPage />, '/cases/case-live/results', '/cases/:caseId/results');
    await findText('JPEG_live.jpg');
    await click(button('Load more results'));
    expect(await findText('Recovered JPEG 0000002')).toBeTruthy();
    expect(queryArtifacts).toHaveBeenLastCalledWith({ search: undefined, cursor: 'cursor-live', pageSize: 100 });
  });

  it('renders export success and topology refusal from export.start', async () => {
    await renderRoute(<ExportWizard />, '/cases/case-live/exports', '/cases/:caseId/exports');
    expect(await findText('JPEG_live.jpg')).toBeTruthy();
    await change(input('Export destination path'), 'D:/verified');
    await change(input('Destination physical identity'), 'disk-9');
    await click(button('Start verified export'));
    expect(await findText(/export-live/)).toBeTruthy();
    expect(await findText(/1 file exported and verified/i)).toBeTruthy();

    act(() => root?.unmount());
    container?.remove();
    Object.assign(window, { recoveryApi: api({ exportArtifacts: vi.fn().mockRejectedValue(new Error('EXPORT_DESTINATION_UNVERIFIED: physical topology could not be proven')) }) });
    await renderRoute(<ExportWizard />, '/cases/case-live/exports', '/cases/:caseId/exports');
    await findText('JPEG_live.jpg');
    await change(input('Export destination path'), 'D:/unknown');
    await change(input('Destination physical identity'), 'unknown');
    await click(button('Start verified export'));
    expect((await findText(/physical topology could not be proven/)).getAttribute('role')).toBe('alert');
  });

  it('renders generated report paths and daemon limitations', async () => {
    await renderRoute(<ReportsPage />, '/cases/case-live/reports', '/cases/:caseId/reports');
    await click(button('Generate report'));
    expect(await findText('D:/case/report.json')).toBeTruthy();
    expect(await findText(/Recovered content was not threat-scanned/)).toBeTruthy();
  });

  it('removes simulated memory findings and shows typed live capability refusal', async () => {
    Object.assign(window, { recoveryApi: api({ getJobStatus: vi.fn().mockResolvedValue({ ...status, goal: 'memory_analysis', stage: 'needs_attention' }) }) });
    await renderRoute(<MemoryResultsPage />, '/cases/case-live/memory/results', '/cases/:caseId/memory/results');
    expect(await findText('VOLATILITY_UNAVAILABLE')).toBeTruthy();
    expect(await findText(/verified Volatility capability is unavailable/i)).toBeTruthy();
    expect(container?.textContent).not.toContain('svchost.exe');
  });
});
