// @vitest-environment jsdom

import { act, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, Link, MemoryRouter, Route, RouterProvider, Routes, useLocation, useParams } from 'react-router-dom';
import type { JobStatus, RecoveryArtifact } from '@recovery/contracts';
import { SourceAssessmentPage } from '../../src/renderer/features/sources/SourceAssessmentPage.js';
import { AddSourcePage } from '../../src/renderer/features/sources/AddSourcePage.js';
import { PartitionList } from '../../src/renderer/features/sources/PartitionList.js';
import { JobProgressPage } from '../../src/renderer/features/jobs/JobProgressPage.js';
import { ReadErrorMap } from '../../src/renderer/features/jobs/ReadErrorMap.js';
import { DamagedDeviceWizard } from '../../src/renderer/features/recovery/DamagedDeviceWizard.js';
import { ResultsPage } from '../../src/renderer/features/results/ResultsPage.js';
import { ExportWizard } from '../../src/renderer/features/export/ExportWizard.js';
import { ReportsPage } from '../../src/renderer/features/reports/ReportsPage.js';
import { MemoryResultsPage } from '../../src/renderer/features/memory/MemoryResultsPage.js';
import { MemorySourcePage } from '../../src/renderer/features/memory/MemorySourcePage.js';
import { MemoryOptionsPage } from '../../src/renderer/features/memory/MemoryOptionsPage.js';
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
import { RECENT_CASES_STORAGE_KEY } from '../../src/renderer/features/cases/recent-cases.js';

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
    chooseExportFolder: vi.fn().mockResolvedValue(null),
    chooseSourceImage: vi.fn().mockResolvedValue(null),
    createCase: vi.fn(), openCase: vi.fn().mockResolvedValue({ caseId: 'case-live', title: 'Live case title', operator: 'operator', referenceNumber: null, organization: null, workspacePath: 'D:/case-live', notes: null, createdAt }), getCaseState: vi.fn().mockResolvedValue({ sourceId: source.sourceId, latestJobId: status.jobId }), listSources: vi.fn().mockResolvedValue([source]), addImageSource: vi.fn(),
    assessSource: vi.fn().mockResolvedValue({ sourceId: source.sourceId, decision: 'ready', requiresAcknowledgement: false, findings: [{ code: 'DAEMON_READY', level: 'supported', title: 'Live image ready', explanation: 'Daemon assessment completed.', recommendedAction: 'Continue.' }] }),
    createRecoveryJob: vi.fn(), startJob: vi.fn(), pauseJob: vi.fn(), resumeJob: vi.fn(), cancelJob: vi.fn(),
    getJobStatus: vi.fn().mockResolvedValue(status), listJobEvents: vi.fn().mockResolvedValue([{ eventId: 'event-live', jobId: 'job-live', sequence: 9, stage: 'completed', occurredAt: createdAt, message: 'Recovery completed' }]),
    queryArtifacts: vi.fn().mockResolvedValue({ items: [artifact], nextCursor: null, totalCount: 1 }),
    getArtifact: vi.fn().mockResolvedValue(artifact), requestPreview: vi.fn().mockResolvedValue({ artifactId: artifact.artifactId, status: 'unsupported', policy: 'derivative_required', detectedMimeType: 'image/jpeg', derivativePath: null }),
    exportArtifacts: vi.fn().mockResolvedValue({ exportId: 'export-live', items: [{ artifactId: artifact.artifactId, outputPath: 'D:/verified/JPEG_live.jpg', sha256: artifact.sha256, verified: true }] }),
    generateReport: vi.fn().mockResolvedValue({ caseId: 'case-live', jsonPath: 'D:/case/case-live-recovery-report.json', markdownPath: 'D:/case/case-live-recovery-report.md', limitations: status.limitations }),
    revealReportInFolder: vi.fn().mockResolvedValue(undefined),
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
    root?.render(<MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={element} /><Route path="/cases/:caseId/overview" element={<p>Created case overview</p>} /><Route path="/cases/:caseId/sources" element={<p>Source setup</p>} /><Route path="/cases/:caseId/sources/:sourceId/assessment" element={<p>Source assessment</p>} /></Routes></MemoryRouter>);
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

function DestinationProbe() {
  const location = useLocation();
  return <p>{location.pathname}{location.search}</p>;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
  localStorage.clear();
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
    expect(container?.textContent).toContain('No recent cases are stored on this device yet.');
    expect(container?.textContent).toContain('The recovery service does not expose a global case index.');
    expect(container?.textContent).toContain('Source writes blocked');
    expect(container?.textContent).not.toContain('Device connected');
    expect(container?.textContent).not.toContain('Finance Laptop Recovery');
  });

  it('reopens a persisted recent case before navigating and refreshes its truthful registry data', async () => {
    localStorage.setItem(RECENT_CASES_STORAGE_KEY, JSON.stringify([{
      caseId: 'case-recent', title: 'Finance laptop recovery', operator: 'examiner-7',
      workspacePath: 'D:/cases/finance', createdAt,
    }]));
    const openCase = vi.fn().mockResolvedValue({
      caseId: 'case-recent', title: 'Finance laptop recovery (verified)', operator: 'examiner-8',
      referenceNumber: null, organization: null, workspacePath: 'D:/cases/finance', notes: 'must stay private', createdAt,
    });
    Object.assign(window, { recoveryApi: api({ openCase }) });
    await renderRoute(<WelcomePage />, '/', '/');

    expect(await findText('Finance laptop recovery')).toBeTruthy();
    expect(container?.textContent).toContain('examiner-7');
    expect(container?.textContent).toContain('D:/cases/finance');
    await click(button('Continue case'));

    expect(openCase).toHaveBeenCalledWith('D:/cases/finance');
    expect(await findText('Created case overview')).toBeTruthy();
    expect(sessionStorage.getItem('recovery:case-recent:workspacePath')).toBe('D:/cases/finance');
    expect(JSON.parse(localStorage.getItem(RECENT_CASES_STORAGE_KEY)!)).toEqual([{
      caseId: 'case-recent', title: 'Finance laptop recovery (verified)', operator: 'examiner-8',
      workspacePath: 'D:/cases/finance', createdAt,
    }]);
    expect(localStorage.getItem(RECENT_CASES_STORAGE_KEY)).not.toContain('must stay private');
  });

  it('hands a validated recent case to its layout without opening the same workspace twice', async () => {
    localStorage.setItem(RECENT_CASES_STORAGE_KEY, JSON.stringify([{
      caseId: 'case-recent', title: 'Recent recovery', operator: 'examiner-7',
      workspacePath: 'D:/cases/recent', createdAt,
    }]));
    const opened = {
      caseId: 'case-recent', title: 'Recent recovery', operator: 'examiner-7', referenceNumber: null,
      organization: null, workspacePath: 'D:/cases/recent', notes: null, createdAt,
    };
    const openCase = vi.fn().mockResolvedValueOnce(opened).mockReturnValueOnce(new Promise(() => undefined));
    Object.assign(window, { recoveryApi: api({
      openCase,
      listSources: vi.fn().mockResolvedValue([]),
      queryArtifacts: vi.fn().mockResolvedValue({ items: [], nextCursor: null, totalCount: 0 }),
    }) });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={['/']}><Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/cases/:caseId" element={<CaseLayout />}><Route path="overview" element={<CaseOverviewPage />} /></Route>
    </Routes></MemoryRouter>));

    await click(button('Continue case'));

    expect(await findText('Recovery overview')).toBeTruthy();
    expect(openCase).toHaveBeenCalledOnce();
  });

  it('hydrates daemon-derived source and job identifiers before mounting a genuinely reopened case', async () => {
    sessionStorage.removeItem('recovery:case-live:sourceId');
    sessionStorage.removeItem('recovery:case-live:jobId');
    const getCaseState = vi.fn().mockResolvedValue({ sourceId: 'source-persisted', latestJobId: 'job-persisted' });
    Object.assign(window, { recoveryApi: api({ getCaseState }) });
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={['/cases/case-live/overview']}><Routes><Route path="/cases/:caseId" element={<CaseLayout />}><Route path="overview" element={<CaseArtifactProbe />} /></Route></Routes></MemoryRouter>));

    expect(await findText('Artifacts requested for case-live')).toBeTruthy();
    expect(getCaseState).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem('recovery:case-live:sourceId')).toBe('source-persisted');
    expect(sessionStorage.getItem('recovery:case-live:jobId')).toBe('job-persisted');
  });

  it('keeps a genuinely reopened no-job case truthful', async () => {
    sessionStorage.removeItem('recovery:case-live:sourceId');
    sessionStorage.removeItem('recovery:case-live:jobId');
    Object.assign(window, { recoveryApi: api({
      getCaseState: vi.fn().mockResolvedValue({ sourceId: null, latestJobId: null }),
      listSources: vi.fn().mockResolvedValue([]),
    }) });
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={['/cases/case-live/overview']}><Routes><Route path="/cases/:caseId" element={<CaseLayout />}><Route path="overview" element={<CaseOverviewPage />} /></Route></Routes></MemoryRouter>));

    expect(await findText('No recovery job yet')).toBeTruthy();
    expect(sessionStorage.getItem('recovery:case-live:sourceId')).toBeNull();
    expect(sessionStorage.getItem('recovery:case-live:jobId')).toBeNull();
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
    expect(await findText('Open an existing recovery case')).toBeTruthy();
    expect(button('Choose case workspace')).toBeTruthy();
  });

  it('opens a selected case workspace and records it only after daemon validation', async () => {
    const chooseWorkspaceFolder = vi.fn().mockResolvedValue({
      selectedPath: 'D:/cases/existing', rootPath: 'D:/', rootLabel: 'D:',
      totalBytes: '1000', freeBytes: '500', directories: [], truncated: false,
    });
    const openCase = vi.fn().mockResolvedValue({
      caseId: 'case-existing', title: 'Existing recovery', operator: 'examiner-9',
      referenceNumber: null, organization: null, workspacePath: 'D:/cases/existing', notes: null, createdAt,
    });
    Object.assign(window, { recoveryApi: api({ chooseWorkspaceFolder, openCase }) });
    await renderRoute(<NewCasePage />, '/cases/open', '/cases/open');

    await click(button('Choose case workspace'));

    expect(chooseWorkspaceFolder).toHaveBeenCalledOnce();
    expect(openCase).toHaveBeenCalledWith('D:/cases/existing');
    expect(await findText('Created case overview')).toBeTruthy();
    expect(sessionStorage.getItem('recovery:case-existing:workspacePath')).toBe('D:/cases/existing');
    expect(JSON.parse(localStorage.getItem(RECENT_CASES_STORAGE_KEY)!)[0]).toMatchObject({
      caseId: 'case-existing', title: 'Existing recovery', operator: 'examiner-9', workspacePath: 'D:/cases/existing',
    });
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

  it('keeps image selection first and presents daemon inventory as secondary context', async () => {
    await renderRoute(<AddSourcePage />, '/cases/case-live/sources', '/cases/:caseId/sources');

    expect(await findText('live-evidence.raw')).toBeTruthy();
    expect(container?.querySelector('[aria-label="Available recovery sources"]')).toBeTruthy();
    expect(button('Choose image file')).toBeTruthy();
    expect(container?.textContent).not.toContain('Discover physical devices');
    const picker = button('Choose image file');
    const inventory = container?.querySelector('[aria-labelledby="available-sources-title"]');
    expect(picker.compareDocumentPosition(inventory!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('fills the evidence path from the native image picker', async () => {
    const chooseSourceImage = vi.fn().mockResolvedValue('E:/evidence/demo.raw');
    Object.assign(window, { recoveryApi: api({ chooseSourceImage }) });
    await renderRoute(<AddSourcePage />, '/cases/case-live/sources', '/cases/:caseId/sources');

    await click(button('Choose image file'));

    expect(input('Disk image path').value).toBe('E:/evidence/demo.raw');
    expect(chooseSourceImage).toHaveBeenCalledOnce();
  });

  it('preserves a manual evidence path when native image selection is cancelled', async () => {
    Object.assign(window, { recoveryApi: api({ chooseSourceImage: vi.fn().mockResolvedValue(null) }) });
    await renderRoute(<AddSourcePage />, '/cases/case-live/sources', '/cases/:caseId/sources');
    await change(input('Disk image path'), 'D:/manual/demo.raw');

    await click(button('Choose image file'));

    expect(input('Disk image path').value).toBe('D:/manual/demo.raw');
  });

  it('shows image picker failures without discarding the current path', async () => {
    Object.assign(window, { recoveryApi: api({ chooseSourceImage: vi.fn().mockRejectedValue(new Error('The evidence image could not be selected.')) }) });
    await renderRoute(<AddSourcePage />, '/cases/case-live/sources', '/cases/:caseId/sources');
    await change(input('Disk image path'), 'D:/manual/demo.raw');

    await click(button('Choose image file'));

    expect((await findText('The evidence image could not be selected.')).getAttribute('role')).toBe('alert');
    expect(input('Disk image path').value).toBe('D:/manual/demo.raw');
  });

  it('shows immediate pending feedback while source inventory and image actions run', async () => {
    const inventory = deferred<readonly []>();
    const added = deferred<typeof source>();
    const listSources = vi.fn().mockReturnValueOnce(inventory.promise).mockResolvedValue([]);
    const addImageSource = vi.fn().mockReturnValue(added.promise);
    Object.assign(window, { recoveryApi: api({
      listSources,
      addImageSource,
    }) });
    await renderRoute(<AddSourcePage />, '/cases/case-live/sources', '/cases/:caseId/sources');

    expect(button('Refresh').disabled).toBe(false);
    await act(async () => inventory.resolve([]));
    expect(button('Refresh').disabled).toBe(false);
    await act(async () => {
      button('Refresh').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      button('Refresh').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(listSources).toHaveBeenCalledTimes(2);
    await change(input('Disk image path'), 'D:/evidence/action.raw');
    await act(async () => {
      button('Add image source').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      button('Add image source').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(button('Adding image…').disabled).toBe(true);
    expect(addImageSource).toHaveBeenCalledOnce();

    await act(async () => added.resolve(source));
    expect(await findText('Source assessment')).toBeTruthy();
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
    expect(container?.querySelectorAll('ul[aria-label="Folder preview"]')).toHaveLength(1);
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
    expect(await findText('Source setup')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(RECENT_CASES_STORAGE_KEY)!)).toEqual([{
      caseId: 'case-created', title: 'Finance laptop recovery', operator: 'examiner-7',
      workspacePath: 'D:/recovery-cases/Finance Case', createdAt,
    }]);
  });

  it.each([
    ['disk-image', '/cases/case-intent/sources/add-image'],
    ['memory-image', '/cases/case-intent/memory'],
    ['unsupported-value', '/cases/case-intent/sources'],
  ])('routes supported quick-start intent %s to its post-creation workflow', async (intent, destination) => {
    Object.assign(window, { recoveryApi: api({
      chooseWorkspaceFolder: vi.fn().mockResolvedValue({
        selectedPath: 'D:/intent-cases', rootPath: 'D:/', rootLabel: 'D:', totalBytes: '1000', freeBytes: '900', directories: [], truncated: false,
      }),
      createCase: vi.fn().mockResolvedValue({
        caseId: 'case-intent', title: 'Intent recovery', operator: 'examiner', referenceNumber: null,
        organization: null, workspacePath: 'D:/intent-cases/Intent recovery', notes: null, createdAt,
      }),
    }) });
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={[`/cases/new?source=${intent}`]}><Routes>
      <Route path="/cases/new" element={<NewCasePage />} />
      <Route path="/cases/:caseId/sources" element={<DestinationProbe />} />
      <Route path="/cases/:caseId/sources/add-image" element={<DestinationProbe />} />
      <Route path="/cases/:caseId/memory" element={<DestinationProbe />} />
    </Routes></MemoryRouter>));
    await change(input('Case title'), 'Intent recovery');
    await change(input('Operator name or ID'), 'examiner');
    await click(button('Continue to workspace'));
    await click(button('Choose parent folder'));
    await click(button('Continue to review'));
    await click(button('Create case'));

    expect(await findText(destination)).toBeTruthy();
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

  it('opens only one native folder picker when the control is activated twice rapidly', async () => {
    let finishFirstSelection: (value: null) => void = () => undefined;
    const pendingSelection = new Promise<null>((resolve) => { finishFirstSelection = resolve; });
    const chooseWorkspaceFolder = vi.fn()
      .mockReturnValueOnce(pendingSelection)
      .mockResolvedValueOnce(null);
    Object.assign(window, { recoveryApi: api({ chooseWorkspaceFolder }) });
    await renderRoute(<NewCaseForm />, '/cases/new', '/cases/new');
    await change(input('Case title'), 'Rapid picker case');
    await change(input('Operator name or ID'), 'examiner-7');
    await click(button('Continue to workspace'));

    const pickerButton = button('Choose parent folder');
    await act(async () => {
      pickerButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      pickerButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(chooseWorkspaceFolder).toHaveBeenCalledOnce();
    await act(async () => finishFirstSelection(null));
    await click(pickerButton);
    expect(chooseWorkspaceFolder).toHaveBeenCalledTimes(2);
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
      'Case activity',
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

  it('explains truthfully how a new case gets its first recovery job', async () => {
    sessionStorage.removeItem('recovery:case-live:jobId');
    const queryArtifacts = vi.fn().mockReturnValue(new Promise(() => undefined));
    Object.assign(window, { recoveryApi: api({
      listSources: vi.fn().mockResolvedValue([]),
      queryArtifacts,
    }) });
    await renderRoute(<CaseOverviewPage />, '/cases/case-live/overview', '/cases/:caseId/overview');

    expect(await findText('No recovery job yet')).toBeTruthy();
    expect(container?.textContent).toContain('Add a source, choose a recovery goal, and select a scan preset to create the first recovery job.');
    expect(container?.querySelector('a[href="/cases/case-live/sources"]')?.textContent).toContain('Add source');
    expect(window.recoveryApi.createRecoveryJob).not.toHaveBeenCalled();
    expect(queryArtifacts).not.toHaveBeenCalled();
  });

  it('keeps a restored pre-index paused job reachable without inventing an artifact count', async () => {
    const queryArtifacts = vi.fn().mockRejectedValue(new Error('ARTIFACT_QUERY_FAILED: results are not indexed'));
    Object.assign(window, { recoveryApi: api({
      getJobStatus: vi.fn().mockResolvedValue({ ...status, stage: 'paused' }),
      queryArtifacts,
    }) });
    await renderRoute(<CaseOverviewPage />, '/cases/case-live/overview', '/cases/:caseId/overview');

    expect(await findText('Recovery overview')).toBeTruthy();
    expect(container?.textContent).toContain('Unavailable until indexing');
    expect(container?.querySelector('a[href="/cases/case-live/jobs"]')?.textContent).toContain('View recovery job');
    expect(queryArtifacts).not.toHaveBeenCalled();
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

  it('compares scan presets without invented timing and offers every file family by default', async () => {
    sessionStorage.removeItem('recovery:case-live:families');
    await renderRoute(<ScanOptionsPage />, '/cases/case-live/recovery/scan-options', '/cases/:caseId/recovery/scan-options');

    const comparison = container?.querySelector('table[aria-label="Scan preset comparison"]');
    expect(comparison).toBeTruthy();
    expect(comparison?.textContent).toContain('Quick Scan');
    expect(comparison?.textContent).toContain('Full Scan');
    expect(comparison?.textContent).toContain('Advanced');
    expect(comparison?.textContent).toContain('No duration estimate available');
    const families = Array.from(container?.querySelectorAll<HTMLInputElement>('.family-selector input[type="checkbox"]') ?? []);
    expect(families).toHaveLength(6);
    expect(families.every((checkbox) => checkbox.checked)).toBe(true);
    expect(container?.textContent).toContain('6 of 6 families');
    expect(container?.textContent).toContain('Never previewed');
  });

  it('sends the chosen file families with the job and refuses an empty selection', async () => {
    sessionStorage.removeItem('recovery:case-live:jobId');
    sessionStorage.removeItem('recovery:case-live:families');
    sessionStorage.setItem('recovery:case-live:sourceId', 'source-live');
    sessionStorage.setItem('recovery:case-live:goal', 'recover_everything');
    const createRecoveryJob = vi.fn().mockResolvedValue({ jobId: 'job-families', caseId: 'case-live', sourceId: 'source-live', goal: 'recover_everything', preset: 'full', stage: 'draft', createdAt, updatedAt: createdAt });
    Object.assign(window, { recoveryApi: api({ createRecoveryJob, startJob: vi.fn().mockResolvedValue({ ...status, jobId: 'job-families', stage: 'preflight', partitions: null }) }) });
    await renderRoute(<ScanOptionsPage />, '/cases/case-live/recovery/scan-options', '/cases/:caseId/recovery/scan-options');

    await click(button('Clear'));
    expect(container?.textContent).toContain('Select at least one family');
    const fullCard = Array.from(container?.querySelectorAll('article') ?? []).find((element) => element.textContent?.includes('Full Scan'));
    expect((fullCard?.querySelector('button') as HTMLButtonElement).disabled).toBe(true);

    const checkbox = (label: string) => Array.from(container?.querySelectorAll<HTMLLabelElement>('.family-card') ?? []).find((element) => element.textContent?.includes(label))?.querySelector('input') as HTMLInputElement;
    await click(checkbox('Documents'));
    await click(checkbox('Images'));
    expect(container?.textContent).toContain('2 of 6 families');
    expect(JSON.parse(sessionStorage.getItem('recovery:case-live:families') ?? '[]')).toEqual(['documents', 'images']);

    await click(fullCard?.querySelector('button') as HTMLButtonElement);
    expect(createRecoveryJob).toHaveBeenCalledWith({ caseId: 'case-live', sourceId: 'source-live', goal: 'recover_everything', preset: 'full', families: ['documents', 'images'] });
    expect(sessionStorage.getItem('recovery:case-live:jobId')).toBe('job-families');
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

  it('explains a zero-partition result and offers a direct continuation to case activity', async () => {
    Object.assign(window, { recoveryApi: api({ getJobStatus: vi.fn().mockResolvedValue({
      ...status,
      partitions: { sectorSize: 512, partitions: [], candidates: [], gaps: [['0', '4161']], rawToolOutput: null, toolVersion: null },
    }) }) });
    await renderRoute(<PartitionList />, '/cases/case-live/recovery/partitions', '/cases/:caseId/recovery/partitions');

    expect(await findText('No partition structures were detected')).toBeTruthy();
    expect(container?.textContent).toContain('Recovery continues across the source bytes');
    expect(container?.querySelector('a[href="/cases/case-live/activity"]')?.textContent).toContain('View recovery activity');
    expect(container?.querySelector('.partition-details')).toBeNull();
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

  it('creates and starts a daemon job and shows the live job view', async () => {
    sessionStorage.removeItem('recovery:case-live:jobId');
    sessionStorage.setItem('recovery:case-live:sourceId', 'source-live');
    sessionStorage.setItem('recovery:case-live:goal', 'recover_everything');
    Object.assign(window, { recoveryApi: api({
      createRecoveryJob: vi.fn().mockResolvedValue({ jobId: 'job-new', caseId: 'case-live', sourceId: 'source-live', goal: 'recover_everything', preset: 'full', stage: 'draft', createdAt, updatedAt: createdAt }),
      startJob: vi.fn().mockResolvedValue({ ...status, jobId: 'job-new', stage: 'preflight', partitions: null }),
      getJobStatus: vi.fn().mockResolvedValueOnce({ ...status, jobId: 'job-new', stage: 'preflight', partitions: null }).mockResolvedValue(status),
    }) });
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={['/cases/case-live/recovery/scan-options']}><Routes><Route path="/cases/:caseId/recovery/scan-options" element={<ScanOptionsPage />} /><Route path="/cases/:caseId/jobs" element={<JobProgressPage />} /></Routes></MemoryRouter>));
    const fullCard = Array.from(container.querySelectorAll('article')).find((element) => element.textContent?.includes('Full Scan'));
    const usePreset = fullCard?.querySelector('a,button') as HTMLElement | null;
    if (!usePreset) throw new Error('Full Scan action not found');
    await click(usePreset);
    expect(sessionStorage.getItem('recovery:case-live:jobId')).toBe('job-new');
    expect(await findText('Recovery completed')).toBeTruthy();
  });

  it('renders live job state, events, limitations, and controls daemon errors', async () => {
    Object.assign(window, { recoveryApi: api({ pauseJob: vi.fn().mockRejectedValue(new Error('JOB_NOT_RUNNING: completed job')) }) });
    await renderRoute(<JobProgressPage />, '/cases/case-live/jobs', '/cases/:caseId/jobs');
    expect(await findText('Recovery completed')).toBeTruthy();
    expect(await findText(/Recovered content was not threat-scanned/)).toBeTruthy();
    expect(container?.querySelector('[role="progressbar"][aria-label="Stage-based workflow progress"]')).toBeTruthy();
    expect(container?.querySelector('ol[aria-label="Recovery stage timeline"]')).toBeTruthy();
    expect(container?.querySelector('section.job-progress__log')).toBeTruthy();
  });

  it('presents the daemon stage as an honest stage-based timeline rather than measured completion', async () => {
    Object.assign(window, { recoveryApi: api({ getJobStatus: vi.fn().mockResolvedValue({ ...status, stage: 'carving' }) }) });
    await renderRoute(<JobProgressPage />, '/cases/case-live/jobs', '/cases/:caseId/jobs');
    expect(await findText('Searching remaining disk space')).toBeTruthy();
    const timeline = container?.querySelector('ol[aria-label="Recovery stage timeline"]');
    expect(timeline?.querySelectorAll('li')).toHaveLength(5);
    expect(timeline?.querySelector('li[data-status="running"]')?.textContent).toContain('Recover and validate files');
    expect(container?.querySelector('[role="progressbar"][aria-label="Stage-based workflow progress"]')?.getAttribute('aria-valuenow')).toBe('68');
    expect(container?.textContent).toContain('Stage-based position, not measured bytes');
    expect(container?.textContent).not.toMatch(/MB\/s|minutes remaining|files found/i);
  });

  it('shows the live source-to-workspace relationship and append-only daemon event stream', async () => {
    Object.assign(window, { recoveryApi: api({
      getJobStatus: vi.fn().mockResolvedValue({ ...status, stage: 'metadata_scan' }),
      listJobEvents: vi.fn().mockResolvedValue([
        { eventId: 'event-3', jobId: 'job-live', sequence: 3, stage: 'partition_scan', occurredAt: createdAt, message: 'Partition table recorded' },
        { eventId: 'event-4', jobId: 'job-live', sequence: 4, stage: 'metadata_scan', occurredAt: createdAt, message: 'Metadata scan entered' },
      ]),
    }) });
    await renderRoute(<JobProgressPage />, '/cases/case-live/jobs', '/cases/:caseId/jobs');
    const relationship = container?.querySelector('figure[aria-label="Recovery data path"]');
    expect(relationship?.textContent).toContain('source-live');
    expect(relationship?.textContent).toContain('D:/case-live');
    expect(relationship?.textContent).toContain('Read-only source');
    expect(relationship?.textContent).toContain('Case workspace');
    const stream = container?.querySelector('ol[aria-label="Recovery event stream"]');
    expect(stream?.textContent).toContain('Partition table recorded');
    expect(stream?.textContent).toContain('Metadata scan entered');
  });

  it('exposes the event stream as a heading-labelled semantic section without an inert div label', async () => {
    await renderRoute(<JobProgressPage />, '/cases/case-live/jobs', '/cases/:caseId/jobs');
    const region = container?.querySelector<HTMLElement>('section.job-progress__log[aria-labelledby]');
    const heading = region?.querySelector<HTMLHeadingElement>('h2');
    expect(region).toBeTruthy();
    expect(heading?.textContent).toBe('Event stream');
    expect(heading?.id).toBe(region?.getAttribute('aria-labelledby'));
    expect(region?.querySelector('ol[aria-label="Recovery event stream"]')).toBeTruthy();
    expect(container?.querySelector('div[aria-label="Recovery event log"]')).toBeNull();
  });

  it('keeps pause and cancel available while disclosing that checkpoint telemetry is absent', async () => {
    Object.assign(window, { recoveryApi: api({ getJobStatus: vi.fn().mockResolvedValue({ ...status, stage: 'carving' }) }) });
    await renderRoute(<JobProgressPage />, '/cases/case-live/jobs', '/cases/:caseId/jobs');
    expect(await findText('Checkpoint detail unavailable')).toBeTruthy();
    expect(container?.textContent).toContain('No checkpoint time or byte range is reported');
    expect(button('Pause').disabled).toBe(false);
    expect(button('Cancel scan').disabled).toBe(false);
  });

  it('does not assign a workflow percentage or timeline position to a paused state', async () => {
    Object.assign(window, { recoveryApi: api({ getJobStatus: vi.fn().mockResolvedValue({ ...status, stage: 'paused' }) }) });
    await renderRoute(<JobProgressPage />, '/cases/case-live/jobs', '/cases/:caseId/jobs');
    expect(await findText('Recovery paused')).toBeTruthy();
    expect(container?.textContent).toContain('Stage position unavailable');
    expect(container?.textContent).not.toContain('50%');
    expect(container?.querySelector('[role="progressbar"]')).toBeNull();
    expect(Array.from(container?.querySelectorAll('ol[aria-label="Recovery stage timeline"] li') ?? []).every((item) => item.getAttribute('data-status') === 'pending')).toBe(true);
  });

  it('renders a complete read-error legend without manufacturing acquisition coverage', async () => {
    await renderRoute(<ReadErrorMap />, '/read-map', '/read-map');
    const map = container?.querySelector('figure[aria-label="Device read coverage"]');
    expect(map?.textContent).toContain('Rescued');
    expect(map?.textContent).toContain('Unreadable');
    expect(map?.textContent).toContain('Pending');
    expect(map?.textContent).toContain('Not reported by the daemon');
    expect(map?.querySelector('[role="img"]')).toBeNull();
    expect(map?.textContent).not.toMatch(/\d+%/);
  });

  it('renders damaged-media workflow slots as unavailable capability states', async () => {
    await renderRoute(<DamagedDeviceWizard />, '/cases/case-live/recovery/damaged', '/cases/:caseId/recovery/damaged');
    expect(await findText('Create a safe working image')).toBeTruthy();
    expect(container?.textContent).toContain('DDRESCUE_UI_UNAVAILABLE');
    expect(container?.textContent).toContain('Source device details unavailable');
    expect(container?.textContent).toContain('Working image destination unavailable');
    expect(container?.textContent).toContain('Live read rate unavailable');
    expect(container?.textContent).toContain('Checkpoint detail unavailable');
    expect(container?.textContent).toContain('Rescue Mode only');
    expect(container?.textContent).toContain('In Installed Mode, stop using the source and restart SHUNYA in Rescue Mode.');
    expect(button('Start first pass').disabled).toBe(true);
    expect(button('Pause safely').disabled).toBe(true);
    expect(button('Stop imaging').disabled).toBe(true);
    expect(container?.textContent).not.toMatch(/GB copied|MB\/s|minutes remaining|\d+%/i);
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

  it('builds the approved result rail only from evidenced metadata paths and keeps carved results separate', async () => {
    const metadataArtifact: RecoveryArtifact = {
      ...artifact,
      artifactId: 'artifact-metadata',
      displayName: 'ledger.xlsx',
      originalName: 'ledger.xlsx',
      originalPath: 'Users/Maya/Documents/ledger.xlsx',
      recoveryMethod: 'metadata',
      threatStatus: 'no_rule_match',
    };
    const carvedWithUntrustedPath: RecoveryArtifact = {
      ...artifact,
      artifactId: 'artifact-carved',
      displayName: 'JPEG_000184.jpg',
      originalPath: 'Invented/Carved/JPEG_000184.jpg',
      threatStatus: 'no_rule_match',
    };
    Object.assign(window, { recoveryApi: api({
      queryArtifacts: vi.fn().mockResolvedValue({ items: [metadataArtifact, carvedWithUntrustedPath], nextCursor: null, totalCount: 2 }),
      requestPreview: vi.fn().mockResolvedValue({ artifactId: 'artifact-metadata', status: 'unsupported', policy: 'metadata_only', detectedMimeType: null, derivativePath: null }),
    }) });

    await renderRoute(<ResultsPage />, '/cases/case-live/results', '/cases/:caseId/results');
    await findText('ledger.xlsx');

    expect(container?.querySelector('nav[aria-label="Recovered artifact folders and filters"]')).toBeTruthy();
    expect(container?.textContent).toContain('Original folders');
    expect(container?.textContent).toContain('Users');
    expect(container?.textContent).toContain('Content-signature recovery');
    expect(container?.textContent).not.toContain('Invented');
    expect(container?.querySelector('table[aria-label="Recovered artifacts"]')).toBeTruthy();
    expect(container?.querySelectorAll('table[aria-label="Recovered artifacts"] thead th')).toHaveLength(7);
  });

  it('shows selected artifact evidence and a truthful export selection summary', async () => {
    const evidenced: RecoveryArtifact = {
      ...artifact,
      originalName: 'ledger.xlsx',
      originalPath: 'Users/Maya/Documents/ledger.xlsx',
      displayName: 'ledger.xlsx',
      recoveryMethod: 'metadata',
      threatStatus: 'no_rule_match',
    };
    Object.assign(window, { recoveryApi: api({
      queryArtifacts: vi.fn().mockResolvedValue({ items: [evidenced], nextCursor: null, totalCount: 1 }),
      requestPreview: vi.fn().mockResolvedValue({ artifactId: evidenced.artifactId, status: 'unsupported', policy: 'metadata_only', detectedMimeType: evidenced.mimeType, derivativePath: null }),
    }) });

    await renderRoute(<ResultsPage />, '/cases/case-live/results', '/cases/:caseId/results');
    await findText('ledger.xlsx');
    expect(await findText('Evidence supporting recovery')).toBeTruthy();
    expect(container?.textContent).toContain('Original path from a surviving file record');
    expect(container?.textContent).toContain('Offset 4,096 · 42 bytes');
    expect(container?.querySelector<HTMLDetailsElement>('.artifact-ranges')?.open).toBe(true);

    const select = container?.querySelector<HTMLInputElement>('input[aria-label="Select ledger.xlsx for export"]');
    expect(select).toBeTruthy();
    await click(select!);
    expect(await findText('1 item selected')).toBeTruthy();
    expect(container?.textContent).toContain('42 bytes selected');
    expect(container?.querySelector('a[href="/cases/case-live/exports"]')?.textContent).toContain('Review export');
  });

  it('applies method filters through the typed artifact query', async () => {
    const queryArtifacts = vi.fn().mockResolvedValue({ items: [artifact], nextCursor: null, totalCount: 1 });
    Object.assign(window, { recoveryApi: api({ queryArtifacts }) });
    await renderRoute(<ResultsPage />, '/cases/case-live/results', '/cases/:caseId/results');
    await findText('JPEG_live.jpg');

    await click(button('Content-signature recovery'));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(queryArtifacts).toHaveBeenLastCalledWith({ search: undefined, method: 'carving', cursor: undefined, pageSize: 100 });
  });

  it('switches back to evidenced metadata when an original folder is selected after carving', async () => {
    const metadataArtifact: RecoveryArtifact = { ...artifact, artifactId: 'artifact-metadata-folder', displayName: 'ledger.xlsx', originalPath: 'Users/Maya/ledger.xlsx', recoveryMethod: 'metadata', threatStatus: 'no_rule_match' };
    const queryArtifacts = vi.fn().mockResolvedValue({ items: [metadataArtifact], nextCursor: null, totalCount: 1 });
    Object.assign(window, { recoveryApi: api({ queryArtifacts }) });
    await renderRoute(<ResultsPage />, '/cases/case-live/results', '/cases/:caseId/results');
    await findText('ledger.xlsx');
    await click(button('Content-signature recovery'));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    await click(button(/Users/));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(queryArtifacts).toHaveBeenLastCalledWith({ search: undefined, method: 'metadata', originalPathPrefix: 'Users', cursor: undefined, pageSize: 100 });
  });

  it('enforces renderer preview refusal when active content is incorrectly advertised as safe', async () => {
    const activeArtifact: RecoveryArtifact = {
      ...artifact,
      displayName: 'recovered-script.html',
      extension: 'html',
      mimeType: 'text/html',
      threatStatus: 'no_rule_match',
      previewStatus: 'safe_preview',
    };
    Object.assign(window, { recoveryApi: api({
      queryArtifacts: vi.fn().mockResolvedValue({ items: [activeArtifact], nextCursor: null, totalCount: 1 }),
      requestPreview: vi.fn().mockResolvedValue({ artifactId: activeArtifact.artifactId, status: 'safe_preview', policy: 'incorrectly_allowed', detectedMimeType: activeArtifact.mimeType, derivativePath: 'D:/case/previews/unsafe.html' }),
    }) });

    await renderRoute(<ResultsPage />, '/cases/case-live/results', '/cases/:caseId/results');
    expect(await findText('Protected preview blocked')).toBeTruthy();
    expect(container?.textContent).toContain('Active content is never rendered or launched');
    expect(container?.textContent).not.toContain('Sanitized derivative ready');
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

  it('offers live typed filters and uses a complete semantic artifact table', async () => {
    await renderRoute(<ResultsPage />, '/cases/case-live/results', '/cases/:caseId/results');
    await findText('JPEG_live.jpg');
    expect(container?.querySelectorAll('table[aria-label="Recovered artifacts"] th')).toHaveLength(7);
    expect(container?.querySelectorAll('table[aria-label="Recovered artifacts"] tbody td')).toHaveLength(7);
    expect(container?.querySelectorAll('.results-filters input[type="checkbox"]')).toHaveLength(0);
    expect(container?.textContent).not.toContain('Save filter');
    expect(container?.textContent).toContain('Content-signature recovery');
  });

  it('groups results by file type and applies the family filter through the typed artifact query', async () => {
    const docx: RecoveryArtifact = { ...artifact, artifactId: 'artifact-docx', displayName: 'Recovered DOCX 0000002', extension: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', threatStatus: 'no_rule_match' };
    const video: RecoveryArtifact = { ...artifact, artifactId: 'artifact-mp4', displayName: 'Recovered MP4 0000003', extension: 'mp4', mimeType: 'video/mp4', threatStatus: 'no_rule_match' };
    const queryArtifacts = vi.fn().mockResolvedValue({ items: [artifact, docx, video], nextCursor: null, totalCount: 3 });
    Object.assign(window, { recoveryApi: api({ queryArtifacts }) });
    await renderRoute(<ResultsPage />, '/cases/case-live/results', '/cases/:caseId/results');
    await findText('Recovered DOCX 0000002');

    const typeFilters = container?.querySelector('.result-filter-list--families');
    expect(typeFilters?.textContent).toContain('Images');
    expect(typeFilters?.textContent).toContain('Documents');
    expect(typeFilters?.textContent).toContain('Audio & video');
    expect(container?.textContent).toContain('3 file types');
    const badges = Array.from(container?.querySelectorAll('.type-badge') ?? []).map((element) => element.textContent);
    expect(badges).toEqual(['JPEG', 'DOCX', 'MP4']);

    await click(button('Documents'));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(queryArtifacts).toHaveBeenLastCalledWith({ search: undefined, family: 'documents', cursor: undefined, pageSize: 100 });
    expect(container?.textContent).toContain('filtered by Documents');
  });

  it('renders export success and topology refusal from export.start', async () => {
    const exportArtifacts = vi.fn().mockResolvedValue({ exportId: 'export-live', items: [{ artifactId: artifact.artifactId, outputPath: 'D:/verified/JPEG_live.jpg', sha256: artifact.sha256, verified: true }] });
    Object.assign(window, { recoveryApi: api({ exportArtifacts }) });
    await renderRoute(<ExportWizard />, '/cases/case-live/exports', '/cases/:caseId/exports');
    expect(await findText('JPEG_live.jpg')).toBeTruthy();
    await change(input('Export destination path'), 'D:/verified');
    expect(container?.textContent).not.toContain('Destination physical identity');
    await click(button('Start verified export'));
    expect(exportArtifacts).toHaveBeenCalledWith({ artifactIds: [artifact.artifactId], destinationPath: 'D:/verified', acknowledgeUnsafe: false });
    expect(await findText(/export-live/)).toBeTruthy();
    expect(await findText(/1 file exported and verified/i)).toBeTruthy();

    act(() => root?.unmount());
    container?.remove();
    Object.assign(window, { recoveryApi: api({ exportArtifacts: vi.fn().mockRejectedValue(new Error('EXPORT_DESTINATION_UNVERIFIED: physical topology could not be proven')) }) });
    await renderRoute(<ExportWizard />, '/cases/case-live/exports', '/cases/:caseId/exports');
    await findText('JPEG_live.jpg');
    await change(input('Export destination path'), 'D:/unknown');
    await click(button('Start verified export'));
    expect((await findText(/physical topology could not be proven/)).getAttribute('role')).toBe('alert');
  });

  it('fills the export destination from the native folder picker', async () => {
    const chooseExportFolder = vi.fn().mockResolvedValue('E:/verified-export');
    Object.assign(window, { recoveryApi: api({ chooseExportFolder }) });
    await renderRoute(<ExportWizard />, '/cases/case-live/exports', '/cases/:caseId/exports');
    await findText('JPEG_live.jpg');

    await click(button('Choose export folder'));

    expect(input('Export destination path').value).toBe('E:/verified-export');
  });

  it('preserves a manually entered export destination when folder selection is cancelled', async () => {
    const chooseExportFolder = vi.fn().mockResolvedValue(null);
    Object.assign(window, { recoveryApi: api({ chooseExportFolder }) });
    await renderRoute(<ExportWizard />, '/cases/case-live/exports', '/cases/:caseId/exports');
    await findText('JPEG_live.jpg');
    await change(input('Export destination path'), 'D:/manual-export');

    await click(button('Choose export folder'));

    expect(input('Export destination path').value).toBe('D:/manual-export');
  });

  it('shows native export-folder picker failures without discarding the current path', async () => {
    const chooseExportFolder = vi.fn().mockRejectedValue(new Error('The export folder could not be selected.'));
    Object.assign(window, { recoveryApi: api({ chooseExportFolder }) });
    await renderRoute(<ExportWizard />, '/cases/case-live/exports', '/cases/:caseId/exports');
    await findText('JPEG_live.jpg');
    await change(input('Export destination path'), 'D:/manual-export');

    await click(button('Choose export folder'));

    expect((await findText('The export folder could not be selected.')).closest('[role="alert"]')).toBeTruthy();
    expect(input('Export destination path').value).toBe('D:/manual-export');
  });

  it('keeps export source identity pending until live artifact traversal returns', async () => {
    const pendingArtifacts = deferred<{ items: RecoveryArtifact[]; nextCursor: null; totalCount: number }>();
    Object.assign(window, { recoveryApi: api({ queryArtifacts: vi.fn().mockReturnValue(pendingArtifacts.promise) }) });
    await renderRoute(<ExportWizard />, '/cases/case-live/exports', '/cases/:caseId/exports');
    expect(container?.textContent).toContain('Loading source identity…');
    expect(container?.textContent).not.toContain('0 source identities');
    await act(async () => pendingArtifacts.resolve({ items: [artifact], nextCursor: null, totalCount: 1 }));
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
    await click(button('Start verified export'));
    expect(submittedIds).toHaveLength(501);
    expect(submittedIds.at(-1)).toBe('artifact-501');
    expect((await findText(/Verification incomplete/)).closest('[role="alert"]')).toBeTruthy();
    expect(container?.textContent).not.toContain('Export complete');
  });

  it('summarizes large complete-cursor export selections without rendering every artifact row', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({ ...artifact, artifactId: `artifact-a-${index}`, displayName: `Artifact A ${index}` }));
    const secondPage = Array.from({ length: 500 }, (_, index) => ({ ...artifact, artifactId: `artifact-b-${index}`, displayName: `Artifact B ${index}` }));
    const finalArtifact = { ...artifact, artifactId: 'artifact-final', displayName: 'Artifact final' };
    const queryArtifacts = vi.fn()
      .mockResolvedValueOnce({ items: firstPage, nextCursor: 'cursor-500', totalCount: 1001 })
      .mockResolvedValueOnce({ items: secondPage, nextCursor: 'cursor-1000', totalCount: 1001 })
      .mockResolvedValueOnce({ items: [finalArtifact], nextCursor: null, totalCount: 1001 });
    Object.assign(window, { recoveryApi: api({ queryArtifacts }) });

    await renderRoute(<ExportWizard />, '/cases/case-live/exports', '/cases/:caseId/exports');
    expect(await findText('1,001 items selected')).toBeTruthy();
    expect(queryArtifacts).toHaveBeenCalledTimes(3);
    expect(container?.querySelectorAll('.export-selection-list > li')).toHaveLength(50);
    expect(container?.textContent).toContain('Complete cursor traversal');
  });

  it.each(['complete_unverified', 'partial_validated', 'partial_unverified', 'corrupt'] as const)(
    'refuses %s artifacts before verified export submission',
    async (recoveryState) => {
      const ineligible = { ...artifact, artifactId: `artifact-${recoveryState}`, displayName: `${recoveryState}.bin`, recoveryState };
      const exportArtifacts = vi.fn();
      Object.assign(window, { recoveryApi: api({
        queryArtifacts: vi.fn().mockResolvedValue({ items: [ineligible], nextCursor: null, totalCount: 1 }),
        exportArtifacts,
      }) });

      await renderRoute(<ExportWizard />, '/cases/case-live/exports', '/cases/:caseId/exports');
      expect(await findText(/Verified export requires every selected artifact to be complete and validated/)).toBeTruthy();
      expect(button('Start verified export').disabled).toBe(true);
      expect(exportArtifacts).not.toHaveBeenCalled();
    },
  );

  it('refuses mixed validated and unverified selections before submission', async () => {
    const unverified = { ...artifact, artifactId: 'artifact-unverified', displayName: 'unverified.bin', recoveryState: 'complete_unverified' as const };
    const exportArtifacts = vi.fn();
    Object.assign(window, { recoveryApi: api({
      queryArtifacts: vi.fn().mockResolvedValue({ items: [artifact, unverified], nextCursor: null, totalCount: 2 }),
      exportArtifacts,
    }) });

    await renderRoute(<ExportWizard />, '/cases/case-live/exports', '/cases/:caseId/exports');
    expect(await findText(/1 of 2 selected artifacts is not eligible/)).toBeTruthy();
    expect(button('Start verified export').disabled).toBe(true);
    expect(exportArtifacts).not.toHaveBeenCalled();
  });

  it('fails closed when a persisted explicit selection contains a missing artifact', async () => {
    sessionStorage.setItem('recovery:case-live:exportArtifactIds', JSON.stringify([artifact.artifactId, 'artifact-stale']));
    const exportArtifacts = vi.fn();
    Object.assign(window, { recoveryApi: api({ exportArtifacts }) });

    await renderRoute(<ExportWizard />, '/cases/case-live/exports', '/cases/:caseId/exports');
    const failure = await findText(/Export selection is stale: 1 of 2 requested artifacts could not be found/);
    expect(failure.closest('[role="alert"]')).toBeTruthy();
    expect(container?.textContent).toContain('Return to Results and review the selection');
    expect(exportArtifacts).not.toHaveBeenCalled();
  });

  it('fails closed when a persisted explicit selection contains duplicate artifact IDs', async () => {
    sessionStorage.setItem('recovery:case-live:exportArtifactIds', JSON.stringify([artifact.artifactId, artifact.artifactId]));
    const exportArtifacts = vi.fn();
    Object.assign(window, { recoveryApi: api({ exportArtifacts }) });

    await renderRoute(<ExportWizard />, '/cases/case-live/exports', '/cases/:caseId/exports');
    expect(await findText(/Export selection contains duplicate artifact identifiers/)).toBeTruthy();
    expect(container?.textContent).toContain('Return to Results and review the selection');
    expect(exportArtifacts).not.toHaveBeenCalled();
  });

  it('fails closed when complete export traversal repeats a cursor', async () => {
    const queryArtifacts = vi.fn()
      .mockResolvedValueOnce({ items: [artifact], nextCursor: 'cursor-repeat', totalCount: 3 })
      .mockResolvedValueOnce({ items: [{ ...artifact, artifactId: 'artifact-two' }], nextCursor: 'cursor-repeat', totalCount: 3 });
    const exportArtifacts = vi.fn();
    Object.assign(window, { recoveryApi: api({ queryArtifacts, exportArtifacts }) });

    await renderRoute(<ExportWizard />, '/cases/case-live/exports', '/cases/:caseId/exports');
    expect(await findText(/Artifact pagination did not advance/)).toBeTruthy();
    expect(exportArtifacts).not.toHaveBeenCalled();
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
    await click(button('Start verified export'));
    expect((await findText(/Verification incomplete/)).closest('[role="alert"]')).toBeTruthy();
    expect(container?.textContent).not.toContain('Export complete');
  });

  it('renders generated report paths and reveals the generated report in its folder', async () => {
    const revealReportInFolder = vi.fn().mockResolvedValue(undefined);
    Object.assign(window, { recoveryApi: api({ revealReportInFolder }) });
    await renderRoute(<ReportsPage />, '/cases/case-live/reports', '/cases/:caseId/reports');
    await click(button('Generate report'));
    expect(await findText('D:/case/case-live-recovery-report.json')).toBeTruthy();
    expect(await findText(/Recovered content was not threat-scanned/)).toBeTruthy();
    expect(container?.textContent).toContain('Report output ready');
    expect(container?.textContent).toContain('JSON evidence record');
    expect(container?.textContent).toContain('Markdown recovery summary');
    expect(container?.textContent).toContain('Only daemon-recorded evidence is included');

    await click(button('Open report folder'));

    expect(revealReportInFolder).toHaveBeenCalledWith('D:/case/case-live-recovery-report.json');
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

  it('shows registered memory-image identity while keeping unsupported Volatility findings locked', async () => {
    Object.assign(window, { recoveryApi: api({ listSources: vi.fn().mockResolvedValue([{ ...source, kind: 'memory_image', displayName: 'authorized-capture.raw', sizeBytes: '16777216' }]) }) });
    await renderRoute(<MemorySourcePage />, '/cases/case-live/memory', '/cases/:caseId/memory');

    expect(await findText('authorized-capture.raw')).toBeTruthy();
    expect(container?.textContent).toContain('16 MiB');
    expect(container?.textContent).toContain('Advanced analysis unavailable');
    expect(container?.textContent).toContain('The desktop API does not expose a verified Volatility runtime');
    expect(container?.textContent).not.toContain('SHA-256 verified');
    expect(container?.textContent).not.toContain('Python runtime Available');
  });

  it('renders the exact memory source identity and byte count beyond Number precision', async () => {
    Object.assign(window, { recoveryApi: api({ listSources: vi.fn().mockResolvedValue([{
      ...source,
      kind: 'memory_image',
      displayName: 'large-authorized-capture.raw',
      stableId: 'memory-source:sha256:exact-identity',
      sizeBytes: '9007199254740993',
    }]) }) });
    await renderRoute(<MemorySourcePage />, '/cases/case-live/memory', '/cases/:caseId/memory');

    expect(await findText('memory-source:sha256:exact-identity')).toBeTruthy();
    expect(await findText('memory_image')).toBeTruthy();
    expect(await findText('9007199254740993 bytes')).toBeTruthy();
  });

  it('labels memory analysis choices as unavailable instead of presenting runnable fake controls', async () => {
    await renderRoute(<MemoryOptionsPage />, '/cases/case-live/memory/options', '/cases/:caseId/memory/options');

    expect(await findText('What advanced analysis would provide')).toBeTruthy();
    expect(container?.textContent).toContain('Process tree');
    expect(container?.textContent).toContain('Network connections');
    expect(container?.textContent).toContain('Loaded modules');
    expect(container?.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(container?.textContent).toContain('Unavailable until the daemon exposes a verified runtime capability');
  });

  it('assembles case activity only from case identity and ordered daemon job events', async () => {
    Object.assign(window, { recoveryApi: api({
      listJobEvents: vi.fn().mockResolvedValue([
        { eventId: 'event-later', jobId: 'job-live', sequence: 9, stage: 'completed', occurredAt: '2026-08-29T12:09:00Z', message: 'Recovery completed' },
        { eventId: 'event-earlier', jobId: 'job-live', sequence: 2, stage: 'metadata_scan', occurredAt: '2026-08-29T12:02:00Z', message: 'Metadata scan started' },
      ]),
    }) });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const memoryRouter = createMemoryRouter(router.routes, { initialEntries: ['/cases/case-live/activity'] });
    await act(async () => { root?.render(<RouterProvider router={memoryRouter} />); });

    expect(await findText('Case created')).toBeTruthy();
    expect(container.textContent).toContain('Metadata scan started');
    expect(container.textContent).toContain('Recovery completed');
    expect(container.textContent).toContain('Recovery complete');
    expect(container.querySelector('a[href="/cases/case-live/results"]')?.textContent).toContain('Review recovered files');
    const rows = Array.from(container.querySelectorAll('[data-activity-sequence]'));
    expect(rows.map((row) => row.getAttribute('data-activity-sequence'))).toEqual(['case', '2', '9']);
    expect(container.textContent).toContain('Audit hash-chain and integrity verification details are unavailable');
    expect(container.textContent).not.toContain('Chain verified');
  });

  it('exposes Case activity in persistent navigation and marks its route current', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const memoryRouter = createMemoryRouter(router.routes, { initialEntries: ['/cases/case-live/activity'] });
    await act(async () => { root?.render(<RouterProvider router={memoryRouter} />); });

    await findText('Case created');
    const current = container.querySelector<HTMLAnchorElement>('nav a[aria-current="page"]');
    expect(current?.textContent).toContain('Case activity');
    expect(current?.getAttribute('href')).toBe('#/cases/case-live/activity');
  });

  it('shows an unambiguous UTC label while retaining raw activity timestamps', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const memoryRouter = createMemoryRouter(router.routes, { initialEntries: ['/cases/case-live/activity'] });
    await act(async () => { root?.render(<RouterProvider router={memoryRouter} />); });

    await findText('Case created');
    const timestamp = container.querySelector<HTMLTimeElement>('[data-activity-sequence="case"] time');
    expect(timestamp?.dateTime).toBe(createdAt);
    expect(timestamp?.textContent).toMatch(/ UTC$/);
  });

  it('persists supported appearance settings while rendering recovery safety as immutable', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const memoryRouter = createMemoryRouter(router.routes, { initialEntries: ['/settings'] });
    await act(async () => { root?.render(<RouterProvider router={memoryRouter} />); });

    await click(input('Dark theme'));
    await click(input('Collapse navigation sidebar'));

    expect(JSON.parse(localStorage.getItem('recovery:ui-preferences')!)).toEqual({ theme: 'dark', sidebarCollapsed: true });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(container.querySelector('[data-testid="app-shell"]')?.getAttribute('data-collapsed')).toBe('true');
    expect(container.textContent).toContain('Always open evidence sources read-only');
    expect(container.textContent).toContain('Enforced and cannot be changed');
    expect(container.textContent).toContain('Additional recovery defaults are unavailable because the daemon has no persisted settings API.');
    expect(container.querySelectorAll('.settings-invariant input')).toHaveLength(0);
  });

  it('detaches system-theme observation before explicit theme changes', async () => {
    localStorage.clear();
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const media = {
      matches: false,
      addEventListener: (_name: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeEventListener: (_name: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    } as unknown as MediaQueryList;
    vi.stubGlobal('matchMedia', vi.fn(() => media));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const memoryRouter = createMemoryRouter(router.routes, { initialEntries: ['/settings'] });
    await act(async () => { root?.render(<RouterProvider router={memoryRouter} />); });

    expect(document.documentElement.dataset.theme).toBe('light');
    await click(input('Light theme'));
    await act(async () => listeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent)));
    expect(document.documentElement.dataset.theme).toBe('light');

    await click(input('Dark theme'));
    await act(async () => listeners.forEach((listener) => listener({ matches: false } as MediaQueryListEvent)));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
