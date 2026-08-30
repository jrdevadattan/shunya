// @vitest-environment jsdom

import { act, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, Link, MemoryRouter, Route, RouterProvider, Routes, useParams } from 'react-router-dom';
import type { JobStatus, RecoveryArtifact } from '@recovery/contracts';
import { SourceAssessmentPage } from '../../src/renderer/features/sources/SourceAssessmentPage.js';
import { AddSourcePage } from '../../src/renderer/features/sources/AddSourcePage.js';
import { PartitionList } from '../../src/renderer/features/sources/PartitionList.js';
import { JobProgressPage } from '../../src/renderer/features/jobs/JobProgressPage.js';
import { ResultsPage } from '../../src/renderer/features/results/ResultsPage.js';
import { ExportWizard } from '../../src/renderer/features/export/ExportWizard.js';
import { ReportsPage } from '../../src/renderer/features/reports/ReportsPage.js';
import { MemoryResultsPage } from '../../src/renderer/features/memory/MemoryResultsPage.js';
import { CaseLayout } from '../../src/renderer/routes/CaseLayout.js';
import { ScanOptionsPage } from '../../src/renderer/features/recovery/ScanOptionsPage.js';
import { GoalPage } from '../../src/renderer/features/recovery/GoalPage.js';
import { DestinationPage } from '../../src/renderer/features/recovery/DestinationPage.js';
import { AcquisitionOptions } from '../../src/renderer/features/recovery/AcquisitionOptions.js';
import { CaseOverviewPage } from '../../src/renderer/routes/CaseOverviewPage.js';
import { WorkflowFrame } from '../../src/renderer/components/WorkflowFrame.js';
import { CapabilityBanner } from '@recovery/ui';
import { NewCaseForm } from '../../src/renderer/features/cases/NewCaseForm.js';
import { WelcomePage } from '../../src/renderer/routes/WelcomePage.js';
import { router } from '../../src/renderer/routes/router.js';
import { NewCasePage } from '../../src/renderer/routes/NewCasePage.js';

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
    chooseWorkspaceFolder: vi.fn().mockResolvedValue(null),
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
    root?.render(<MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={element} /><Route path="/cases/:caseId/overview" element={<p>Created case overview</p>} /></Routes></MemoryRouter>);
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
  it('renders the approved cases home without invented recent cases or device state', async () => {
    await renderRoute(<WelcomePage />, '/', '/');

    expect(container?.querySelector('[data-testid="app-shell"]')).toBeTruthy();
    expect(await findText('Your recovery cases')).toBeTruthy();
    expect(container?.querySelector('a[href="/cases/new"]')?.textContent).toContain('New recovery');
    expect(container?.textContent).toContain('Recent cases are unavailable because the recovery service does not expose a case index.');
    expect(container?.textContent).toContain('Source writes blocked');
    expect(container?.textContent).not.toContain('Device connected');
    expect(container?.textContent).not.toContain('Finance Laptop Recovery');
  });

  it('keeps the approved sidebar visible while creating a case', async () => {
    await renderRoute(<NewCasePage />, '/cases/new', '/cases/new');

    expect(container?.querySelector('[data-testid="app-shell"]')).toBeTruthy();
    expect(container?.querySelector('a[aria-current="page"]')?.textContent).toContain('New case');
    expect(await findText('Start a new recovery case')).toBeTruthy();
  });

  it('marks Cases as current while opening an existing case workspace', async () => {
    await renderRoute(<NewCasePage />, '/cases/open', '/cases/open');

    const current = container?.querySelector('a[aria-current="page"]');
    expect(current).toBeTruthy();
    expect(current?.textContent).toContain('Cases');
  });

  it('routes Settings, Help, and About to truthful support surfaces', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    let memoryRouter = createMemoryRouter(router.routes, { initialEntries: ['/settings'] });
    await act(async () => {
      root?.render(<RouterProvider router={memoryRouter} />);
    });
    expect(await findText('Settings')).toBeTruthy();
    expect(container.textContent).toContain('Theme and sidebar choices are stored on this device.');

    act(() => root?.unmount());
    root = createRoot(container);
    memoryRouter = createMemoryRouter(router.routes, { initialEntries: ['/help'] });
    await act(async () => { root?.render(<RouterProvider router={memoryRouter} />); });
    expect(await findText('Help')).toBeTruthy();
    expect(container.textContent).toContain('Open or create a case before using case recovery tools.');

    act(() => root?.unmount());
    root = createRoot(container);
    memoryRouter = createMemoryRouter(router.routes, { initialEntries: ['/about'] });
    await act(async () => { root?.render(<RouterProvider router={memoryRouter} />); });
    expect(await findText('About SHUNYA Recovery')).toBeTruthy();
    expect(container.textContent).toContain('Offline-first, read-only recovery workspace');
  });

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
    expect(container?.querySelector('[data-state="complete"]')?.getAttribute('aria-label')).toBe('Source — complete');
    expect(container?.querySelector('[data-state="current"]')?.getAttribute('aria-label')).toBe('Assessment — current step');
    expect(container?.textContent).toContain('Complete');
    expect(container?.querySelector('section[aria-labelledby]')).toBeTruthy();
    expect(await findText('Mounted source')).toBeTruthy();
  });

  it('renders daemon inventory as live source cards and keeps unsupported physical discovery disabled', async () => {
    await renderRoute(<AddSourcePage />, '/cases/case-live/sources', '/cases/:caseId/sources');

    expect(await findText('live-evidence.raw')).toBeTruthy();
    expect(container?.querySelector('[aria-label="Available recovery sources"]')).toBeTruthy();
    const physicalDiscovery = button('Discover physical devices');
    expect(physicalDiscovery.disabled).toBe(true);
    expect(container?.textContent).toContain('Physical-device discovery is unavailable because the typed desktop API exposes image sources only.');
  });

  it('guides case intake through Details, Workspace, and Review using live selection data', async () => {
    const chooseWorkspaceFolder = vi.fn().mockResolvedValue({
      selectedPath: 'D:/recovery-cases', rootPath: 'D:/', rootLabel: 'D:',
      totalBytes: '2000000000000', freeBytes: '800000000000',
      directories: [{
        name: 'Prior Cases', relativePath: 'Prior Cases', childrenOmitted: false,
        children: [{ name: 'Case 004', relativePath: 'Prior Cases/Case 004', children: [], childrenOmitted: false }],
      }],
      truncated: false,
    });
    const createCase = vi.fn().mockResolvedValue({
      caseId: 'case-created', title: 'Finance laptop recovery', operator: 'examiner-7',
      referenceNumber: 'FIN-2026-08-30', organization: 'Digital Lab',
      workspacePath: 'D:/recovery-cases/Finance Case', notes: 'Priority recovery', createdAt,
    });
    Object.assign(window, { recoveryApi: api({ chooseWorkspaceFolder, createCase }) });
    await renderRoute(<NewCaseForm />, '/cases/new', '/cases/new');

    expect(container?.querySelector('[aria-current="step"]')?.textContent).toContain('Details');
    await change(input('Case title'), 'Finance laptop recovery');
    await change(input('Operator name or ID'), 'examiner-7');
    await change(input('Reference number'), 'FIN-2026-08-30');
    await change(input('Organization or unit'), 'Digital Lab');
    const notes = container?.querySelector<HTMLTextAreaElement>('textarea[name="notes"]');
    expect(notes).toBeTruthy();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(notes, 'Priority recovery');
      notes?.dispatchEvent(new Event('input', { bubbles: true }));
      notes?.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await click(button('Continue to workspace'));

    expect(container?.querySelector('[aria-current="step"]')?.textContent).toContain('Workspace');
    await click(button('Choose parent folder'));
    expect(chooseWorkspaceFolder).toHaveBeenCalledOnce();
    expect(await findText('Prior Cases')).toBeTruthy();
    expect(await findText('Case 004')).toBeTruthy();
    expect(container?.querySelector('[role="tree"], [role="treeitem"]')).toBeNull();
    expect(container?.querySelector('ul[aria-label="Folder preview"]')).toBeTruthy();
    expect(container?.textContent).toContain('800 GB free');
    expect(container?.textContent).toContain('2 TB total');
    expect(container?.textContent).not.toMatch(/estimated needed|required space|headroom/i);
    await change(input('Case folder name'), 'Finance Case');
    expect(container?.textContent).toContain('D:/recovery-cases/Finance Case');
    await click(button('Continue to review'));

    expect(container?.querySelector('[aria-current="step"]')?.textContent).toContain('Review');
    expect(container?.textContent).toContain('Finance laptop recovery');
    expect(container?.textContent).toContain('examiner-7');
    expect(container?.textContent).toContain('FIN-2026-08-30');
    expect(container?.textContent).toContain('Digital Lab');
    expect(container?.textContent).toContain('Priority recovery');
    expect(container?.textContent).toContain('D:/recovery-cases/Finance Case');
    await click(button('Create case'));

    expect(createCase).toHaveBeenCalledWith({
      title: 'Finance laptop recovery',
      operator: 'examiner-7',
      referenceNumber: 'FIN-2026-08-30',
      organization: 'Digital Lab',
      workspacePath: 'D:/recovery-cases/Finance Case',
      notes: 'Priority recovery',
    });
  });

  it('keeps the workspace step in place with an accessible error when inspection is denied', async () => {
    Object.assign(window, { recoveryApi: api({
      chooseWorkspaceFolder: vi.fn().mockRejectedValue(new Error(
        'The selected folder could not be inspected. Choose a folder you have permission to read.',
      )),
    }) });
    await renderRoute(<NewCaseForm />, '/cases/new', '/cases/new');
    await change(input('Case title'), 'Permission test case');
    await change(input('Operator name or ID'), 'examiner-7');
    await click(button('Continue to workspace'));
    await click(button('Choose parent folder'));

    const alert = await findText('The selected folder could not be inspected. Choose a folder you have permission to read.');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(container?.querySelector('[aria-current="step"]')?.textContent).toContain('Workspace');
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

    expect(Array.from(container.querySelectorAll('.navigation-item')).map((item) => item.textContent?.trim())).toEqual([
      'Cases',
      'New case',
      'Case setup',
      'Recovery',
      'Verify',
      'Reports',
      'Settings',
      'Help',
      'About',
    ]);
    expect(container.querySelector('a[aria-current="page"]')?.textContent).toContain('Case setup');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Source writes blocked');
    const trigger = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((item) => item.getAttribute('aria-label') === 'Search screens and actions');
    expect(trigger).toBeTruthy();

    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })));
    expect(container.querySelector('[role="dialog"][aria-label="Command search"]')).toBeTruthy();
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Sources');
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Recovery Jobs');
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Recovered Files');
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Exports');
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
    const relationship = container?.querySelector('figure[aria-label="Read-only source relationship"]');
    expect(relationship).toBeTruthy();
    expect(relationship?.textContent).toContain('Recovery workspace');
    expect(relationship?.textContent).toContain('Read-only analysis path');
  });

  it('formats source sizes beyond Number precision with exact BigInt arithmetic', async () => {
    const largeSource = { ...source, sizeBytes: '19342813113834067804616130' };
    Object.assign(window, { recoveryApi: api({ listSources: vi.fn().mockResolvedValue([largeSource]) }) });

    await renderRoute(<SourceAssessmentPage />, '/cases/case-live/sources/source-live/assessment', '/cases/:caseId/sources/:sourceId/assessment');

    expect(await findText('18014398509481984.9 GiB · raw image')).toBeTruthy();
  });

  it('clears source assessment state when the case route changes with the same source id', async () => {
    const nextAssessment = deferred<Awaited<ReturnType<typeof window.recoveryApi.assessSource>>>();
    const assessSource = vi.fn()
      .mockResolvedValueOnce({ sourceId: source.sourceId, decision: 'ready', requiresAcknowledgement: false, findings: [{ code: 'CASE_A_READY', level: 'supported', title: 'Case A source ready', explanation: 'First case assessment.', recommendedAction: null }] })
      .mockReturnValueOnce(nextAssessment.promise);
    Object.assign(window, { recoveryApi: api({ assessSource }) });
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={['/cases/case-a/sources/source-live/assessment']}><Routes><Route path="/cases/:caseId/sources/:sourceId/assessment" element={<><SourceAssessmentPage /><Link to="/cases/case-b/sources/source-live/assessment">Open case B assessment</Link></>} /></Routes></MemoryRouter>));
    expect(await findText('Case A source ready')).toBeTruthy();

    await click(Array.from(container.querySelectorAll('a')).find((item) => item.textContent === 'Open case B assessment')!);
    expect(await findText('Assessing source…')).toBeTruthy();
    expect(container.textContent).not.toContain('Case A source ready');
    await act(async () => nextAssessment.resolve({ sourceId: source.sourceId, decision: 'ready', requiresAcknowledgement: false, findings: [] }));
  });

  it('persists an explicit recovery goal selection before continuing to scan options', async () => {
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={['/cases/case-live/recovery/goal']}><Routes><Route path="/cases/:caseId/recovery/goal" element={<GoalPage />} /><Route path="/cases/:caseId/recovery/scan-options" element={<p>Scan options destination</p>} /></Routes></MemoryRouter>));

    const goal = button(/Recover everything/);
    expect(goal.getAttribute('aria-pressed')).toBe('false');
    await click(goal);
    expect(goal.getAttribute('aria-pressed')).toBe('true');
    expect(sessionStorage.getItem('recovery:case-live:goal')).toBe('recover_everything');
    await click(button('Continue to scan options'));
    expect(await findText('Scan options destination')).toBeTruthy();
  });

  it.each([
    ['Damaged or failing device', 'Continue to damaged-device recovery', 'Damaged-device workflow', '/cases/case-live/recovery/damaged'],
    ['Memory analysis', 'Continue to memory analysis', 'Memory-analysis workflow', '/cases/case-live/memory'],
  ] as const)('routes %s to its specialized recovery workflow', async (goalLabel, actionLabel, destination, destinationPath) => {
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={['/cases/case-live/recovery/goal']}><Routes>
      <Route path="/cases/:caseId/recovery/goal" element={<GoalPage />} />
      <Route path="/cases/:caseId/recovery/scan-options" element={<p>Generic scan workflow</p>} />
      <Route path={destinationPath} element={<p>{destination}</p>} />
    </Routes></MemoryRouter>));

    await click(button(new RegExp(goalLabel)));
    expect(container.textContent).not.toContain('Continue to scan options');
    await click(button(actionLabel));
    expect(await findText(destination)).toBeTruthy();
    expect(container.textContent).not.toContain('Generic scan workflow');
  });

  it('compares scan presets without invented timing and locks unsupported file-family controls', async () => {
    await renderRoute(<ScanOptionsPage />, '/cases/case-live/recovery/scan-options', '/cases/:caseId/recovery/scan-options');

    const comparison = container?.querySelector('table[aria-label="Scan preset comparison"]');
    expect(comparison).toBeTruthy();
    expect(comparison?.textContent).toContain('Quick Scan');
    expect(comparison?.textContent).toContain('Full Scan');
    expect(comparison?.textContent).toContain('Advanced');
    expect(comparison?.textContent).toContain('No duration estimate available');
    expect(button('Choose file families').disabled).toBe(true);
  });

  it('shows destination topology as unverified and keeps assessment controls disabled', async () => {
    sessionStorage.setItem('recovery:case-live:sourceId', 'source-live');
    await renderRoute(<DestinationPage />, '/cases/case-live/recovery/destination', '/cases/:caseId/recovery/destination');

    const relationship = container?.querySelector('figure[aria-label="Source and destination safety relationship"]');
    expect(relationship).toBeTruthy();
    expect(relationship?.textContent).toContain('live-evidence.raw');
    expect(relationship?.textContent).toContain('Destination not assessed');
    expect(button('Choose destination drive').disabled).toBe(true);
    expect(button('Continue').disabled).toBe(true);
  });

  it('clears a destination source when the next case has no active source', async () => {
    sessionStorage.setItem('recovery:case-a:sourceId', 'source-live');
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={['/cases/case-a/recovery/destination']}><Routes><Route path="/cases/:caseId/recovery/destination" element={<><DestinationPage /><Link to="/cases/case-b/recovery/destination">Open case B destination</Link></>} /></Routes></MemoryRouter>));
    expect(await findText('live-evidence.raw')).toBeTruthy();

    await click(Array.from(container.querySelectorAll('a')).find((item) => item.textContent === 'Open case B destination')!);
    expect(await findText('No active source')).toBeTruthy();
    expect(container.textContent).not.toContain('live-evidence.raw');
  });

  it('keeps acquisition controls disabled while typed acquisition support is unavailable', async () => {
    await renderRoute(<AcquisitionOptions />, '/cases/case-live/recovery/acquisition', '/cases/:caseId/recovery/acquisition');

    expect(button('Create verified image').disabled).toBe(true);
    expect(button('Choose block size').disabled).toBe(true);
    expect(container?.textContent).toContain('No source size, required space, block size, or completion state is simulated.');
  });

  it('renders persisted partition results returned by job.status', async () => {
    await renderRoute(<PartitionList />, '/cases/case-live/recovery/partitions', '/cases/:caseId/recovery/partitions');
    expect(await findText('Evidence volume')).toBeTruthy();
    expect(await findText('512')).toBeTruthy();
    expect(await findText('2096640')).toBeTruthy();
    expect(container?.querySelector('figure[aria-label="Partition map"]')).toBeTruthy();
    expect(container?.querySelector('[aria-label="Detected partition tree"]')?.textContent).toContain('Evidence volume');
    expect(button('Choose partition scan scope').disabled).toBe(true);
    expect(container?.textContent).toContain('The typed recovery job API does not accept partition selections.');
  });

  it('includes candidate layouts in the main partition tree and map without inventing a length', async () => {
    Object.assign(window, { recoveryApi: api({ getJobStatus: vi.fn().mockResolvedValue({
      ...status,
      goal: 'partition_loss',
      partitions: {
        sectorSize: 512,
        partitions: [],
        candidates: [{ startSector: '2048', startOffsetBytes: '1048576', filesystem: 'NTFS', confidence: 'high', source: 'filesystem signature' }],
        gaps: [], rawToolOutput: null, toolVersion: null,
      },
    }) }) });
    await renderRoute(<PartitionList />, '/cases/case-live/recovery/partitions', '/cases/:caseId/recovery/partitions');

    const tree = container?.querySelector('[aria-label="Detected partition tree"]');
    expect(tree?.textContent).toContain('0 reported partitions · 1 candidate layout');
    expect(tree?.textContent).toContain('Candidate NTFS');
    const map = container?.querySelector('figure[aria-label="Partition map"]');
    expect(map?.textContent).toContain('Candidate NTFS');
    expect(map?.querySelector('[aria-label="Candidate NTFS at byte 1,048,576, high confidence"]')).toBeTruthy();
  });

  it('keeps partition candidates at both map boundaries inside the track', async () => {
    Object.assign(window, { recoveryApi: api({ getJobStatus: vi.fn().mockResolvedValue({
      ...status,
      goal: 'partition_loss',
      partitions: {
        sectorSize: 512,
        partitions: [{ partitionId: 'partition-edge', index: 1, startSector: '0', sectorCount: '2048', startOffsetBytes: '0', lengthBytes: '1048576', partitionType: 'data', filesystem: null, label: 'Extent' }],
        candidates: [
          { startSector: '0', startOffsetBytes: '0', filesystem: 'FAT32', confidence: 'high', source: 'boot signature' },
          { startSector: '2048', startOffsetBytes: '1048576', filesystem: 'NTFS', confidence: 'medium', source: 'filesystem signature' },
        ],
        gaps: [], rawToolOutput: null, toolVersion: null,
      },
    }) }) });
    await renderRoute(<PartitionList />, '/cases/case-live/recovery/partitions', '/cases/:caseId/recovery/partitions');

    const map = container?.querySelector('figure[aria-label="Partition map"]');
    const start = map?.querySelector<HTMLElement>('[aria-label="Candidate FAT32 at byte 0, high confidence"]');
    const end = map?.querySelector<HTMLElement>('[aria-label="Candidate NTFS at byte 1,048,576, medium confidence"]');
    expect(start?.style.left).toBe('0%');
    expect(start?.classList.contains('is-candidate--start')).toBe(true);
    expect(end?.style.left).toBe('100%');
    expect(end?.classList.contains('is-candidate--end')).toBe(true);
  });

  it('formats partition byte labels beyond Number precision with exact BigInt arithmetic', async () => {
    Object.assign(window, { recoveryApi: api({ getJobStatus: vi.fn().mockResolvedValue({
      ...status,
      partitions: {
        sectorSize: 512,
        partitions: [{ partitionId: 'partition-large', index: 1, startSector: '0', sectorCount: '37778931862957163680890', startOffsetBytes: '0', lengthBytes: '19342813113834067804616130', partitionType: 'data', filesystem: null, label: 'Large volume' }],
        candidates: [], gaps: [], rawToolOutput: null, toolVersion: null,
      },
    }) }) });
    await renderRoute(<PartitionList />, '/cases/case-live/recovery/partitions', '/cases/:caseId/recovery/partitions');

    expect(container?.querySelector('figure[aria-label="Partition map"] [role="listitem"]')?.getAttribute('aria-label')).toBe('Large volume, 18014398509481984.9 GiB');
  });

  it('clears persisted partition results when the next case has no active job', async () => {
    sessionStorage.setItem('recovery:case-a:jobId', 'job-live');
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={['/cases/case-a/recovery/partitions']}><Routes><Route path="/cases/:caseId/recovery/partitions" element={<><PartitionList /><Link to="/cases/case-b/recovery/partitions">Open case B partitions</Link></>} /></Routes></MemoryRouter>));
    expect(await findText('Evidence volume')).toBeTruthy();

    await click(Array.from(container.querySelectorAll('a')).find((item) => item.textContent === 'Open case B partitions')!);
    expect(await findText('No recovery job is active for this case.')).toBeTruthy();
    expect(container.querySelector('figure[aria-label="Partition map"]')).toBeNull();
    expect(container.textContent).not.toContain('Evidence volume');
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
    expect(container?.querySelector('[role="progressbar"][aria-label="Recovery progress"]')).toBeTruthy();
    expect(container?.querySelector('ol[aria-label="Recovery progress"]')).toBeTruthy();
    expect(container?.querySelector('[aria-label="Recovery event log"]')).toBeTruthy();
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
    expect(await findText('1 indexed artifact')).toBeTruthy();
    expect(container?.querySelector('.results-workspace[aria-label="Recovery result browser"]')).toBeTruthy();
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
