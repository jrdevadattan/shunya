// @vitest-environment jsdom

import { act, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import type { JobStatus, RecoveryArtifact } from '@recovery/contracts';
import { SourceAssessmentPage } from '../../src/renderer/features/sources/SourceAssessmentPage.js';
import { PartitionList } from '../../src/renderer/features/sources/PartitionList.js';
import { JobProgressPage } from '../../src/renderer/features/jobs/JobProgressPage.js';
import { ResultsPage } from '../../src/renderer/features/results/ResultsPage.js';
import { ExportWizard } from '../../src/renderer/features/export/ExportWizard.js';
import { ReportsPage } from '../../src/renderer/features/reports/ReportsPage.js';
import { MemoryResultsPage } from '../../src/renderer/features/memory/MemoryResultsPage.js';
import { CaseLayout } from '../../src/renderer/routes/CaseLayout.js';
import { ScanOptionsPage } from '../../src/renderer/features/recovery/ScanOptionsPage.js';
import { CaseOverviewPage } from '../../src/renderer/routes/CaseOverviewPage.js';
import { WorkflowFrame } from '../../src/renderer/components/WorkflowFrame.js';
import { CapabilityBanner } from '@recovery/ui';

const createdAt = '2026-08-29T12:00:00Z';
const source = {
  sourceId: 'source-live', kind: 'raw_image', displayName: 'live-evidence.raw', stableId: 'sha256:live',
  sizeBytes: '2097152', logicalSectorSize: 512, physicalSectorSize: 512, bus: null, model: null,
  serialRedacted: null, systemDisk: false, mountedReadWrite: false, encryptedState: 'none', health: 'healthy',
  capabilities: [],
} as const;
const status: JobStatus = {
  jobId: 'job-live', caseId: 'case-live', sourceId: source.sourceId, goal: 'recover_everything', preset: 'full',
  stage: 'completed', createdAt, updatedAt: createdAt,
  limitations: [{ code: 'YARA_X_UNAVAILABLE', stage: 'threat_scan', level: 'unsupported', explanation: 'Recovered content was not threat-scanned.', recommendedAction: 'Install and verify YARA-X.' }],
  partitions: { sectorSize: 512, partitions: [{ partitionId: 'partition-1', index: 1, startSector: '1', sectorCount: '4095', startOffsetBytes: '512', lengthBytes: '2096640', partitionType: 'FAT32', filesystem: null, label: 'Evidence volume' }], candidates: [], gaps: [], rawToolOutput: null, toolVersion: null },
};
const artifact: RecoveryArtifact = {
  artifactId: 'artifact-live', sourceId: source.sourceId, partitionId: 'partition-1', originalName: null, originalPath: null,
  displayName: 'JPEG_live.jpg', extension: 'jpg', mimeType: 'image/jpeg', sizeBytes: '42', recoveryMethod: 'carving',
  recoveryState: 'complete_validated', sha256: 'a'.repeat(64), sourceRanges: [{ offset: '4096', length: '42' }],
  threatStatus: 'not_scanned', previewStatus: 'unsupported',
};

function api(overrides: Record<string, unknown> = {}) {
  return {
    getRuntimeInfo: vi.fn().mockResolvedValue({ mode: 'installed' }),
    createCase: vi.fn(), openCase: vi.fn().mockResolvedValue({ caseId: 'case-live', title: 'Live case title', operator: 'operator', referenceNumber: null, organization: null, workspacePath: 'D:/case-live', notes: null, createdAt }), listSources: vi.fn().mockResolvedValue([source]), addImageSource: vi.fn(),
    assessSource: vi.fn().mockResolvedValue({ sourceId: source.sourceId, decision: 'ready', requiresAcknowledgement: false, findings: [{ code: 'DAEMON_READY', level: 'supported', title: 'Live image ready', explanation: 'Daemon assessment completed.', recommendedAction: 'Continue.' }] }),
    createRecoveryJob: vi.fn(), startJob: vi.fn(), pauseJob: vi.fn(), resumeJob: vi.fn(), cancelJob: vi.fn(),
    getJobStatus: vi.fn().mockResolvedValue(status), listJobEvents: vi.fn().mockResolvedValue([{ eventId: 'event-live', jobId: 'job-live', sequence: 9, stage: 'completed', occurredAt: createdAt, message: 'Recovery completed' }]),
    queryArtifacts: vi.fn().mockResolvedValue({ items: [artifact], nextCursor: null, totalCount: 1 }),
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

function CaseArtifactProbe() {
  const { caseId = '' } = useParams();
  useEffect(() => { void window.recoveryApi.queryArtifacts({ pageSize: 100 }); }, [caseId]);
  return <p>Artifacts requested for {caseId}</p>;
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
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('live renderer pages', () => {
  it('renders a semantic recovery workflow frame with current and completed steps', async () => {
    await renderRoute(
      <WorkflowFrame
        eyebrow="Source"
        title="Assess evidence"
        description="Review safety findings."
        steps={[
          { id: 'source', label: 'Source', state: 'complete' },
          { id: 'assessment', label: 'Assessment', state: 'current' },
        ]}
        aside={<CapabilityBanner level="warning" title="Mounted source" explanation="Use a read-only image." />}
      >
        <p>Assessment content</p>
      </WorkflowFrame>,
      '/cases/case-live/sources',
      '/cases/:caseId/sources',
    );
    expect(container?.querySelector('[aria-current="step"]')?.textContent).toContain('Assessment');
    expect(container?.textContent).toContain('Complete');
    expect(container?.querySelector('section[aria-labelledby]')).toBeTruthy();
    expect(await findText('Mounted source')).toBeTruthy();
  });

  it('opens the persisted case and renders the daemon case title', async () => {
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={['/cases/case-live/overview']}><Routes><Route path="/cases/:caseId" element={<CaseLayout />}><Route path="overview" element={<p>Overview loaded</p>} /></Route></Routes></MemoryRouter>));
    expect(await findText('Live case title')).toBeTruthy();
    expect(await findText('Overview loaded')).toBeTruthy();
  });

  it('renders grouped case navigation and restores search trigger focus after Escape', async () => {
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={['/cases/case-live/overview']}><Routes><Route path="/cases/:caseId" element={<CaseLayout />}><Route path="overview" element={<p>Overview loaded</p>} /></Route></Routes></MemoryRouter>));
    await findText('Overview loaded');

    expect(container.querySelectorAll('.navigation-group')).toHaveLength(3);
    expect(container.querySelector('a[aria-current="page"]')?.textContent).toContain('Overview');
    expect(container.textContent).toContain('Volatility is unavailable');
    const trigger = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((item) => item.getAttribute('aria-label') === 'Search screens and actions');
    expect(trigger).toBeTruthy();

    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })));
    expect(container.querySelector('[role="dialog"][aria-label="Command search"]')).toBeTruthy();
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('renders Overview metrics only from live daemon state', async () => {
    const secondSource = { ...source, sourceId: 'source-second', displayName: 'second-evidence.raw' };
    Object.assign(window, { recoveryApi: api({
      listSources: vi.fn().mockResolvedValue([source, secondSource]),
      queryArtifacts: vi.fn().mockResolvedValue({ items: [artifact], nextCursor: null, totalCount: 501 }),
    }) });
    await renderRoute(<CaseOverviewPage />, '/cases/case-live/overview', '/cases/:caseId/overview');
    await findText('501');
    const metrics = Array.from(container?.querySelectorAll('.metric-card') ?? []).map((element) => element.textContent);
    expect(metrics).toEqual(expect.arrayContaining([
      expect.stringContaining('Sources2'),
      expect.stringContaining('Recovery jobCompleted'),
      expect.stringContaining('Recovered artifacts501'),
      expect.stringContaining('Limitations1'),
    ]));
  });

  it('shows an Overview alert instead of invented metrics when daemon loading fails', async () => {
    Object.assign(window, { recoveryApi: api({ listSources: vi.fn().mockRejectedValue(new Error('SOURCE_LIST_FAILED: unavailable')) }) });
    await renderRoute(<CaseOverviewPage />, '/cases/case-live/overview', '/cases/:caseId/overview');
    expect((await findText(/SOURCE_LIST_FAILED/)).getAttribute('role')).toBe('alert');
    expect(container?.querySelectorAll('.metric-card')).toHaveLength(0);
  });

  it('does not mount case children while the matching case open is pending', async () => {
    const pending = deferred<Awaited<ReturnType<typeof window.recoveryApi.openCase>>>();
    const queryArtifacts = vi.fn().mockResolvedValue({ items: [], nextCursor: null, totalCount: 0 });
    Object.assign(window, { recoveryApi: api({ openCase: vi.fn().mockReturnValue(pending.promise), queryArtifacts }) });
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={['/cases/case-live/overview']}><Routes><Route path="/cases/:caseId" element={<CaseLayout />}><Route path="overview" element={<CaseArtifactProbe />} /></Route></Routes></MemoryRouter>));
    expect(container.textContent).not.toContain('Artifacts requested');
    expect(queryArtifacts).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ caseId: 'case-live', title: 'Live case title', operator: 'operator', referenceNumber: null, organization: null, workspacePath: 'D:/case-live', notes: null, createdAt }));
    expect(await findText('Artifacts requested for case-live')).toBeTruthy();
  });

  it('does not mount case children after case open fails', async () => {
    sessionStorage.setItem('recovery:case-live:sourceId', 'source-live');
    sessionStorage.setItem('recovery:case-live:goal', 'recover_everything');
    const queryArtifacts = vi.fn().mockResolvedValue({ items: [], nextCursor: null, totalCount: 0 });
    Object.assign(window, { recoveryApi: api({ openCase: vi.fn().mockRejectedValue(new Error('CASE_OPEN_FAILED: unavailable')), queryArtifacts }) });
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={['/cases/case-live/overview']}><Routes><Route path="/cases/:caseId" element={<CaseLayout />}><Route path="overview" element={<CaseArtifactProbe />} /></Route></Routes></MemoryRouter>));
    expect(await findText(/CASE_OPEN_FAILED/)).toBeTruthy();
    expect(container.textContent).not.toContain('Artifacts requested');
    expect(queryArtifacts).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('recovery:case-live:workspacePath')).toBeNull();
    expect(sessionStorage.getItem('recovery:case-live:sourceId')).toBeNull();
    expect(sessionStorage.getItem('recovery:case-live:jobId')).toBeNull();
    expect(sessionStorage.getItem('recovery:case-live:goal')).toBeNull();
  });

  it('unmounts the first case before opening a second case and rejects mismatched context', async () => {
    sessionStorage.setItem('recovery:case-b:workspacePath', 'D:/case-b');
    sessionStorage.setItem('recovery:case-b:jobId', 'job-from-wrong-case');
    const second = deferred<Awaited<ReturnType<typeof window.recoveryApi.openCase>>>();
    const queryArtifacts = vi.fn().mockResolvedValue({ items: [], nextCursor: null, totalCount: 0 });
    const openCase = vi.fn((workspace: string) => workspace === 'D:/case-live'
      ? Promise.resolve({ caseId: 'case-live', title: 'Case A', operator: 'operator', referenceNumber: null, organization: null, workspacePath: 'D:/case-live', notes: null, createdAt })
      : second.promise);
    Object.assign(window, { recoveryApi: api({ openCase, queryArtifacts }) });
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={['/cases/case-live/overview']}><Routes><Route path="/cases/:caseId" element={<CaseLayout />}><Route path="overview" element={<><CaseArtifactProbe /><Link to="/cases/case-b/overview">Open case B</Link></>} /></Route></Routes></MemoryRouter>));
    await findText('Artifacts requested for case-live');
    await click(Array.from(container.querySelectorAll('a')).find((item) => item.textContent === 'Open case B')!);
    expect(container.textContent).not.toContain('Artifacts requested for case-b');
    expect(queryArtifacts).toHaveBeenCalledTimes(1);
    await act(async () => second.resolve({ caseId: 'case-live', title: 'Wrong case', operator: 'operator', referenceNumber: null, organization: null, workspacePath: 'D:/case-live', notes: null, createdAt }));
    expect(await findText(/does not match the requested case/i)).toBeTruthy();
    expect(queryArtifacts).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('recovery:case-b:jobId')).toBeNull();
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

  it('does not overlap job polls while a prior status request is unresolved', async () => {
    vi.useFakeTimers();
    const pending = deferred<Awaited<ReturnType<typeof window.recoveryApi.getJobStatus>>>();
    const getJobStatus = vi.fn().mockReturnValue(pending.promise);
    Object.assign(window, { recoveryApi: api({ getJobStatus, listJobEvents: vi.fn().mockResolvedValue([]) }) });
    await renderRoute(<JobProgressPage />, '/cases/case-live/jobs', '/cases/:caseId/jobs');
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(getJobStatus).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ ...status, stage: 'carving' }));
  });

  it('requests only later job events and stops polling after a terminal status', async () => {
    vi.useFakeTimers();
    const running = { ...status, stage: 'carving' as const };
    const completed = { ...status, stage: 'completed' as const };
    const getJobStatus = vi.fn().mockResolvedValueOnce(running).mockResolvedValue(completed);
    const listJobEvents = vi.fn()
      .mockResolvedValueOnce([{ eventId: 'event-5', jobId: 'job-live', sequence: 5, stage: 'carving', occurredAt: createdAt, message: 'Carving' }])
      .mockResolvedValueOnce([{ eventId: 'event-6', jobId: 'job-live', sequence: 6, stage: 'completed', occurredAt: createdAt, message: 'Completed once' }]);
    Object.assign(window, { recoveryApi: api({ getJobStatus, listJobEvents }) });
    await renderRoute(<JobProgressPage />, '/cases/case-live/jobs', '/cases/:caseId/jobs');
    await act(async () => { await Promise.resolve(); await vi.advanceTimersByTimeAsync(1_000); });
    expect(listJobEvents).toHaveBeenNthCalledWith(1, 'job-live', 0);
    expect(listJobEvents).toHaveBeenNthCalledWith(2, 'job-live', 5);
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(getJobStatus).toHaveBeenCalledTimes(2);
    expect(container?.textContent).toContain('Carving');
    expect(container?.textContent).toContain('Completed once');
  });

  it.each([
    ['carving', 'Pause', 'pauseJob', 'PAUSE_REFUSED'],
    ['carving', 'Cancel scan', 'cancelJob', 'CANCEL_REFUSED'],
    ['paused', 'Resume recovery', 'resumeJob', 'RESUME_REFUSED'],
  ] as const)('keeps the %s command error visible when %s fails', async (stage, label, method, code) => {
    vi.useFakeTimers();
    const pollAfterCommand = deferred<Awaited<ReturnType<typeof window.recoveryApi.getJobStatus>>>();
    const getJobStatus = vi.fn().mockResolvedValueOnce({ ...status, stage }).mockReturnValue(pollAfterCommand.promise);
    Object.assign(window, { recoveryApi: api({ getJobStatus, [method]: vi.fn().mockRejectedValue(new Error(`${code}: denied`)), listJobEvents: vi.fn().mockResolvedValue([]) }) });
    await renderRoute(<JobProgressPage />, '/cases/case-live/jobs', '/cases/:caseId/jobs');
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    await click(button(label));
    expect(container?.textContent).toContain(code);
    await act(async () => pollAfterCommand.resolve({ ...status, stage }));
    expect(container?.textContent).toContain(code);
  });

  it('does not let an older poll overwrite a successful job command', async () => {
    vi.useFakeTimers();
    const stalePoll = deferred<Awaited<ReturnType<typeof window.recoveryApi.getJobStatus>>>();
    const getJobStatus = vi.fn()
      .mockResolvedValueOnce({ ...status, stage: 'carving' })
      .mockReturnValue(stalePoll.promise);
    Object.assign(window, { recoveryApi: api({
      getJobStatus,
      listJobEvents: vi.fn().mockResolvedValue([]),
      pauseJob: vi.fn().mockResolvedValue({ ...status, stage: 'paused' }),
    }) });
    await renderRoute(<JobProgressPage />, '/cases/case-live/jobs', '/cases/:caseId/jobs');
    await act(async () => { await Promise.resolve(); await vi.advanceTimersByTimeAsync(1_000); });
    await click(button('Pause'));
    expect(container?.textContent).toContain('Recovery paused');
    await act(async () => stalePoll.resolve({ ...status, stage: 'carving' }));
    expect(container?.textContent).toContain('Recovery paused');
    expect(container?.textContent).not.toContain('Searching remaining disk space');
  });

  it('renders daemon artifact pages and the daemon preview refusal', async () => {
    await renderRoute(<ResultsPage />, '/cases/case-live/results', '/cases/:caseId/results');
    expect(await findText('JPEG_live.jpg')).toBeTruthy();
    await click(button(/JPEG_live.jpg/));
    expect(await findText(/preview derivative is unavailable/i)).toBeTruthy();
    expect(await findText(/not scanned/i)).toBeTruthy();
  });

  it('sends changed result searches back through the typed daemon query', async () => {
    const queryArtifacts = vi.fn().mockResolvedValue({ items: [artifact], nextCursor: null, totalCount: 1 });
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
      .mockResolvedValueOnce({ items: [artifact], nextCursor: 'cursor-live', totalCount: 2 })
      .mockResolvedValueOnce({ items: [secondArtifact], nextCursor: null, totalCount: 2 });
    Object.assign(window, { recoveryApi: api({ queryArtifacts }) });
    await renderRoute(<ResultsPage />, '/cases/case-live/results', '/cases/:caseId/results');
    await findText('JPEG_live.jpg');
    await click(button('Load more results'));
    expect(await findText('Recovered JPEG 0000002')).toBeTruthy();
    expect(queryArtifacts).toHaveBeenLastCalledWith({ search: undefined, cursor: 'cursor-live', pageSize: 100 });
  });

  it('ignores an older result query that resolves after a newer search', async () => {
    const oldQuery = deferred<{ items: RecoveryArtifact[]; nextCursor: null; totalCount: number }>();
    const newQuery = deferred<{ items: RecoveryArtifact[]; nextCursor: null; totalCount: number }>();
    const newer = { ...artifact, artifactId: 'artifact-newer', displayName: 'ledger-result.jpg' };
    const queryArtifacts = vi.fn().mockReturnValueOnce(oldQuery.promise).mockReturnValueOnce(newQuery.promise);
    Object.assign(window, { recoveryApi: api({ queryArtifacts }) });
    await renderRoute(<ResultsPage />, '/cases/case-live/results', '/cases/:caseId/results');
    await change(input('Search recovered files'), 'ledger');
    await act(async () => newQuery.resolve({ items: [newer], nextCursor: null, totalCount: 1 }));
    expect(await findText('ledger-result.jpg')).toBeTruthy();
    await act(async () => oldQuery.resolve({ items: [artifact], nextCursor: null, totalCount: 1 }));
    expect(container?.textContent).toContain('ledger-result.jpg');
    expect(container?.textContent).not.toContain('JPEG_live.jpg');
  });

  it('resets selection and preview when a replacement result query arrives', async () => {
    const newer = { ...artifact, artifactId: 'artifact-newer', displayName: 'replacement.jpg' };
    const queryArtifacts = vi.fn()
      .mockResolvedValueOnce({ items: [artifact], nextCursor: null, totalCount: 1 })
      .mockResolvedValueOnce({ items: [newer], nextCursor: null, totalCount: 1 });
    const requestPreview = vi.fn((artifactId: string) => Promise.resolve({ artifactId, status: 'unsupported', policy: 'derivative_required', detectedMimeType: 'image/jpeg', derivativePath: null }));
    Object.assign(window, { recoveryApi: api({ queryArtifacts, requestPreview }) });
    await renderRoute(<ResultsPage />, '/cases/case-live/results', '/cases/:caseId/results');
    await findText('JPEG_live.jpg');
    await change(input('Search recovered files'), 'replacement');
    expect(await findText('replacement.jpg')).toBeTruthy();
    expect(requestPreview).toHaveBeenLastCalledWith('artifact-newer');
  });

  it('locks a cursor page while it is loading to prevent duplicate append requests', async () => {
    const next = deferred<{ items: RecoveryArtifact[]; nextCursor: null; totalCount: number }>();
    const queryArtifacts = vi.fn()
      .mockResolvedValueOnce({ items: [artifact], nextCursor: 'cursor-live', totalCount: 2 })
      .mockReturnValue(next.promise);
    Object.assign(window, { recoveryApi: api({ queryArtifacts }) });
    await renderRoute(<ResultsPage />, '/cases/case-live/results', '/cases/:caseId/results');
    await findText('JPEG_live.jpg');
    const loadMore = button('Load more results');
    await click(loadMore);
    await click(loadMore);
    expect(queryArtifacts).toHaveBeenCalledTimes(2);
    await act(async () => next.resolve({ items: [{ ...artifact, artifactId: 'artifact-next', displayName: 'next.jpg' }], nextCursor: null, totalCount: 2 }));
  });

  it('unlocks pagination when a replacement search supersedes a pending cursor page', async () => {
    const staleAppend = deferred<{ items: RecoveryArtifact[]; nextCursor: null; totalCount: number }>();
    const replacement = { ...artifact, artifactId: 'artifact-replacement', displayName: 'replacement.jpg' };
    const queryArtifacts = vi.fn()
      .mockResolvedValueOnce({ items: [artifact], nextCursor: 'cursor-old', totalCount: 1 })
      .mockReturnValueOnce(staleAppend.promise)
      .mockResolvedValueOnce({ items: [replacement], nextCursor: 'cursor-new', totalCount: 2 });
    Object.assign(window, { recoveryApi: api({ queryArtifacts }) });
    await renderRoute(<ResultsPage />, '/cases/case-live/results', '/cases/:caseId/results');
    await findText('JPEG_live.jpg');
    await click(button('Load more results'));
    await change(input('Search recovered files'), 'replacement');
    await findText('replacement.jpg');
    expect(button('Load more results').disabled).toBe(false);
    await act(async () => staleAppend.resolve({ items: [], nextCursor: null, totalCount: 1 }));
  });

  it('offers only the live text search filter and uses complete ARIA grid cells', async () => {
    await renderRoute(<ResultsPage />, '/cases/case-live/results', '/cases/:caseId/results');
    await findText('JPEG_live.jpg');
    expect(container?.querySelectorAll('[role="columnheader"]')).toHaveLength(4);
    expect(container?.querySelectorAll('[role="gridcell"]')).toHaveLength(4);
    expect(container?.querySelectorAll('.results-filters input[type="checkbox"]')).toHaveLength(0);
    expect(container?.textContent).not.toContain('Save filter');
    expect(container?.textContent).toContain('Additional result filters are unavailable');
  });

  it('does not present unsupported file-family controls as active scan inputs', async () => {
    await renderRoute(<ScanOptionsPage />, '/cases/case-live/recovery/scan-options', '/cases/:caseId/recovery/scan-options');
    expect(container?.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(container?.textContent).toContain('File-family selection is unavailable');
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

  it('loads every artifact cursor before selecting files for export', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({ ...artifact, artifactId: `artifact-${index + 1}`, displayName: `Artifact ${index + 1}` }));
    const lastArtifact = { ...artifact, artifactId: 'artifact-501', displayName: 'Artifact 501' };
    const queryArtifacts = vi.fn()
      .mockResolvedValueOnce({ items: firstPage, nextCursor: 'cursor-500', totalCount: 501 })
      .mockResolvedValueOnce({ items: [lastArtifact], nextCursor: null, totalCount: 501 });
    let submittedIds: string[] = [];
    const exportArtifacts = vi.fn(async (request: { artifactIds: string[] }) => {
      submittedIds = request.artifactIds;
      return { exportId: 'export-all', items: [{ artifactId: 'artifact-501', outputPath: 'D:/verified/Artifact 501', sha256: artifact.sha256, verified: true }] };
    });
    Object.assign(window, { recoveryApi: api({ queryArtifacts, exportArtifacts }) });
    await renderRoute(<ExportWizard />, '/cases/case-live/exports', '/cases/:caseId/exports');
    await findText('Artifact 501');
    await change(input('Export destination path'), 'D:/verified');
    await change(input('Destination physical identity'), 'disk-9');
    await click(button('Start verified export'));
    expect(submittedIds).toHaveLength(501);
    expect(submittedIds.at(-1)).toBe('artifact-501');
    expect((await findText(/Verification incomplete/)).closest('[role="alert"]')).toBeTruthy();
    expect(container?.textContent).not.toContain('Export complete');
  });

  it('does not announce export completion when any returned item is unverified', async () => {
    Object.assign(window, { recoveryApi: api({ exportArtifacts: vi.fn().mockResolvedValue({
      exportId: 'export-mixed', items: [
        { artifactId: 'artifact-live', outputPath: 'D:/verified/one.jpg', sha256: artifact.sha256, verified: true },
        { artifactId: 'artifact-failed', outputPath: 'D:/verified/two.jpg', sha256: 'b'.repeat(64), verified: false },
      ],
    }) }) });
    await renderRoute(<ExportWizard />, '/cases/case-live/exports', '/cases/:caseId/exports');
    await findText('JPEG_live.jpg');
    await change(input('Export destination path'), 'D:/verified');
    await change(input('Destination physical identity'), 'disk-9');
    await click(button('Start verified export'));
    expect((await findText(/Verification incomplete/)).closest('[role="alert"]')).toBeTruthy();
    expect(container?.textContent).not.toContain('Export complete');
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

  it('does not present a disk recovery job as a memory-analysis job', async () => {
    Object.assign(window, { recoveryApi: api({ getJobStatus: vi.fn().mockResolvedValue({ ...status, goal: 'recover_everything', stage: 'completed' }) }) });
    await renderRoute(<MemoryResultsPage />, '/cases/case-live/memory/results', '/cases/:caseId/memory/results');
    expect(await findText(/No memory-analysis job is active/)).toBeTruthy();
    expect(container?.textContent).not.toContain('Live job state');
  });
});
