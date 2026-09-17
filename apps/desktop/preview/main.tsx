// Browser-only preview harness for designing the renderer without Electron.
// Installs realistic mock bridges on `window`, seeds a case, then boots the
// real application entry. Never shipped: only `vite.preview.config.ts` uses it.
import type { JobEvent, JobStatus, RecoveryArtifact, RecoveryCase, SourceDescriptor } from '@recovery/contracts';

const params = new URLSearchParams(window.location.search);
const stage = (params.get('stage') ?? 'completed') as JobStatus['stage'];
const createdAt = '2026-09-05T08:00:00Z';

const recoveryCase: RecoveryCase = {
  caseId: 'case-live', title: 'Q4 workstation recovery', operator: 'Priya Nair', referenceNumber: 'SIH-26149-T1',
  organization: 'Cyber Cell, Pune', workspacePath: 'D:\\Cases\\Q4 workstation recovery', notes: null, createdAt,
};
const image: SourceDescriptor = {
  sourceId: 'image-85315030', kind: 'raw_image', displayName: 'demo_evidence.raw', stableId: 'sha256:9f2a…c41e',
  sizeBytes: '4194304', logicalSectorSize: 512, physicalSectorSize: 512, bus: null, model: null, serialRedacted: null,
  systemDisk: false, mountedReadWrite: false, encryptedState: 'none', health: 'healthy', capabilities: [],
};
const nvme: SourceDescriptor = {
  ...image, sourceId: 'physical-0', kind: 'physical_device', displayName: 'NVMe SAMSUNG MZVL8512HELU-00BTW', stableId: 'eui.0025384741B172E9',
  sizeBytes: '512110190592', bus: 'NVMe', serialRedacted: '••••2E9', systemDisk: true, encryptedState: 'unknown', health: 'unknown',
};
const usb: SourceDescriptor = {
  ...nvme, sourceId: 'physical-1', displayName: 'SanDisk Ultra', stableId: 'USBSTOR\\DISK&VEN_SANDISK', sizeBytes: '30752636928', bus: 'USB', serialRedacted: '••••6270', systemDisk: false,
};

const status: JobStatus = {
  jobId: 'job-live', caseId: 'case-live', sourceId: image.sourceId, goal: 'recover_everything', preset: 'full', stage, createdAt, updatedAt: '2026-09-05T08:04:12Z',
  families: ['images', 'documents', 'archives', 'audio_video', 'databases', 'executables'],
  limitations: [
    { code: 'TSK_METADATA_UNAVAILABLE', stage: 'metadata_scan', level: 'limited', explanation: 'Sleuth Kit metadata recovery is not available in the current verified tool catalog.', recommendedAction: 'Install and verify Sleuth Kit to recover surviving original names and paths.' },
    { code: 'PHOTOREC_UNAVAILABLE', stage: 'carving', level: 'limited', explanation: 'PhotoRec is not in the verified tool catalog; the built-in multi-format signature engine was used (JPEG, PNG, GIF, BMP, WebP, PDF, DOCX/XLSX/PPTX, ZIP, 7z, RAR, GZIP, MP4/MOV, WAV, AVI, MP3, SQLite, EXE/DLL, ELF).', recommendedAction: 'Vendor and verify PhotoRec through tools/manifests to extend coverage.' },
    { code: 'YARA_X_LIMITED_RULESET', stage: 'threat_scan', level: 'limited', explanation: 'Threat scanning ran with the YARA-X engine and the built-in demonstration ruleset (SIH marker and EICAR).', recommendedAction: 'Provide a verified production YARA ruleset for complete threat classification.' },
  ],
  partitions: { sectorSize: 512, partitions: [{ partitionId: 'partition-1', index: 1, startSector: '1', sectorCount: '8191', startOffsetBytes: '512', lengthBytes: '4193792', partitionType: 'FAT32', filesystem: 'FAT32', label: 'Evidence volume' }], candidates: [], gaps: [], rawToolOutput: null, toolVersion: null },
};

const events: JobEvent[] = ['preflight', 'partition_scan', 'metadata_scan', 'carving', 'validating', 'threat_scan', 'indexing', 'completed'].map((eventStage, index) => ({
  eventId: `event-${index}`, jobId: 'job-live', sequence: index + 1, stage: eventStage as JobStatus['stage'],
  occurredAt: `2026-09-05T08:0${Math.min(9, index)}:00Z`, message: index === 7 ? 'Recovery completed' : null,
}));

function artifact(index: number, name: string, ext: string, mime: string, size: number, extra: Partial<RecoveryArtifact> = {}): RecoveryArtifact {
  return {
    artifactId: `artifact-${index}`, sourceId: image.sourceId, partitionId: 'partition-1', originalName: null, originalPath: null,
    displayName: name, extension: ext, mimeType: mime, sizeBytes: String(size), recoveryMethod: 'carving', recoveryState: 'complete_validated',
    sha256: (index + 1).toString(16).padStart(2, '0').repeat(32), sourceRanges: [{ offset: String(65536 + index * 131072), length: String(size) }],
    threatStatus: 'no_rule_match', previewStatus: 'safe_preview', ...extra,
  };
}
const artifacts: RecoveryArtifact[] = [
  artifact(0, 'Recovered JPEG 0000001', 'jpg', 'image/jpeg', 19932),
  artifact(1, 'Recovered JPEG 0000002', 'jpg', 'image/jpeg', 24470),
  artifact(2, 'Recovered PNG 0000003', 'png', 'image/png', 2760),
  artifact(3, 'Recovered PDF 0000004', 'pdf', 'application/pdf', 1109),
  artifact(4, 'Recovered JPEG 0000005', 'jpg', 'image/jpeg', 26129, { threatStatus: 'potential_threat', previewStatus: 'blocked' }),
  artifact(5, 'Recovered DOCX 0000006', 'docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1796, { previewStatus: 'unsupported' }),
  artifact(6, 'Recovered SQLITE 0000007', 'sqlite', 'application/x-sqlite3', 8192, { previewStatus: 'unsupported' }),
  artifact(7, 'Recovered GIF 0000008', 'gif', 'image/gif', 2502, { previewStatus: 'unsupported' }),
  artifact(8, 'Recovered BMP 0000009', 'bmp', 'image/bmp', 768054, { previewStatus: 'unsupported', recoveryState: 'partial_validated' }),
  artifact(9, 'Recovered WAV 0000010', 'wav', 'audio/wav', 24044, { previewStatus: 'unsupported' }),
  artifact(10, 'Recovered ZIP 0000011', 'zip', 'application/zip', 4046, { previewStatus: 'unsupported' }),
  artifact(11, 'Recovered JPEG 0000012', 'jpg', 'image/jpeg', 10072),
  artifact(12, 'ledger.xlsx', 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 51200, { recoveryMethod: 'metadata', originalName: 'ledger.xlsx', originalPath: 'Users/Maya/Documents/ledger.xlsx', previewStatus: 'unsupported' }),
];

const familyMimes: Record<string, string[]> = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'],
  documents: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  archives: ['application/zip'], audio_video: ['audio/wav', 'video/mp4'], databases: ['application/x-sqlite3'], executables: [],
};

const delay = <T,>(value: T, ms = 120) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

const blockDevices = [
  { device: '\\\\.\\PhysicalDrive0', model: 'NVMe SAMSUNG MZVL8512HELU-00BTW', serial: 'S6XPNL0T', sizeBytes: 512110190592, busType: 'NVMe', removable: false, system: true },
  { device: '\\\\.\\PhysicalDrive1', model: 'SanDisk Ultra', serial: '4C530000080921116270', sizeBytes: 30752636928, busType: 'USB', removable: true, system: false },
];

const progressListeners = { erase: new Set<(event: unknown) => void>(), capture: new Set<(event: unknown) => void>(), deletion: new Set<(event: unknown) => void>() };
function simulate(kind: keyof typeof progressListeners, build: (percent: number) => unknown, steps = 20): Promise<void> {
  return new Promise((resolve) => {
    let step = 0;
    const tick = () => {
      step += 1;
      const percent = Math.min(100, Math.round((step / steps) * 100));
      for (const listener of progressListeners[kind]) listener(build(percent));
      if (step < steps) setTimeout(tick, 150); else resolve();
    };
    tick();
  });
}

Object.assign(window, {
  recoveryApi: {
    getRuntimeInfo: () => delay({ mode: 'installed' }),
    chooseWorkspaceFolder: () => delay({ selectedPath: 'D:\\Cases', rootPath: 'D:\\', rootLabel: 'Data (D:)', totalBytes: '1000204886016', freeBytes: '612345678901', directories: [{ name: 'Archive', relativePath: 'Archive', children: [], childrenOmitted: false }, { name: 'Templates', relativePath: 'Templates', children: [], childrenOmitted: false }], truncated: false }, 400),
    chooseExportFolder: () => delay('E:\\Exports\\Q4 workstation', 300),
    chooseSourceImage: () => delay('D:\\Evidence\\demo_evidence.raw', 300),
    createCase: (input: Partial<RecoveryCase>) => delay({ ...recoveryCase, ...input, caseId: 'case-live', createdAt: new Date().toISOString() }, 500),
    openCase: () => delay(recoveryCase),
    getCaseState: () => delay({ sourceId: image.sourceId, latestJobId: stage === 'draft' ? null : status.jobId }),
    listSources: () => delay([nvme, usb, image]),
    addImageSource: () => delay(image, 400),
    assessSource: () => delay({ sourceId: image.sourceId, decision: 'ready', requiresAcknowledgement: false, findings: [
      { code: 'SOURCE_READY', level: 'supported', title: 'Image ready for read-only recovery', explanation: 'The image is a regular file and will be opened read-only for every stage.', recommendedAction: 'Continue to choose what to recover.' },
      { code: 'HASH_BASELINE', level: 'supported', title: 'Integrity baseline will be recorded', explanation: 'A SHA-256 of the whole image is taken before and after recovery.', recommendedAction: null },
    ] }, 500),
    createRecoveryJob: () => delay({ ...status, stage: 'draft' }, 300),
    startJob: () => delay({ ...status, stage: 'preflight' }, 300),
    pauseJob: () => delay({ ...status, stage: 'paused' }),
    resumeJob: () => delay({ ...status, stage: 'carving' }),
    cancelJob: () => delay({ ...status, stage: 'cancelled' }),
    getJobStatus: () => delay(status),
    listJobEvents: (_id: string, after = 0) => delay(events.filter((event) => event.sequence > after)),
    queryArtifacts: (query: { search?: string; method?: string; family?: string; cursor?: string }) => {
      let items = artifacts;
      if (query.method) items = items.filter((item) => item.recoveryMethod === query.method);
      if (query.family) items = items.filter((item) => query.family === 'other' ? !Object.values(familyMimes).flat().includes(item.mimeType ?? '') : (familyMimes[query.family] ?? []).includes(item.mimeType ?? ''));
      if (query.search) items = items.filter((item) => item.displayName.toLowerCase().includes(query.search!.toLowerCase()));
      return delay({ items, nextCursor: null, totalCount: items.length }, 200);
    },
    getArtifact: (id: string) => delay(artifacts.find((item) => item.artifactId === id)),
    requestPreview: (id: string) => {
      const item = artifacts.find((entry) => entry.artifactId === id)!;
      return delay({ artifactId: id, status: item.previewStatus, policy: item.previewStatus === 'safe_preview' ? 'sanitized_image' : item.previewStatus === 'blocked' ? 'threat_blocked' : 'derivative_required', detectedMimeType: item.mimeType, derivativePath: item.previewStatus === 'safe_preview' ? 'D:\\Cases\\previews\\' + id + '.png' : null }, 250);
    },
    exportArtifacts: (input: { artifactIds: string[]; destinationPath: string }) => delay({ exportId: 'export-7f3a', items: input.artifactIds.map((id) => ({ artifactId: id, outputPath: `${input.destinationPath}\\${artifacts.find((a) => a.artifactId === id)?.displayName ?? id}`, sha256: 'ab'.repeat(32), verified: true })) }, 900),
    generateReport: () => delay({ caseId: 'case-live', jsonPath: 'D:\\Cases\\Q4 workstation recovery\\reports\\case-live-recovery-report.json', markdownPath: 'D:\\Cases\\Q4 workstation recovery\\reports\\case-live-recovery-report.md', limitations: status.limitations }, 600),
    revealReportInFolder: () => delay(undefined),
    subscribeJobEvents: () => () => undefined,
    listDeletionFiles: () => delay([]),
    startDeletion: () => delay({ markerPath: '', totalFiles: 0 }),
  },
  certificates: {
    generate: (record: unknown) => delay({ certificateId: 'SHN-2026-0915-4F2A', issuedAt: new Date().toISOString(), algorithm: 'ed25519', record, payloadSha256: 'c4'.repeat(32), signature: 'MEUCIQDf5Yt0m8s8b3n2lJ0bY2f6qQm5xI9o0f8Vb7Zc3n9Q1gIgXx7c3Q0x6pQ8m9jY1Vq3M0aB2C3d4E5f6G7h8I9J0k=', publicKeyFingerprint: 'SHA256:7Kq9…3vZa' }, 600),
    verify: () => delay({ valid: true }, 400),
    save: (name: string) => delay(`C:\\Users\\Priya\\Documents\\${name}`, 300),
  },
  secureErase: {
    prepareBinary: () => delay(undefined),
    listDevices: () => delay([]),
    getCapabilities: () => delay({}),
    eraseDevice: () => delay({}),
    listBlockDevices: () => delay(blockDevices, 500),
    isElevated: () => delay(true),
    csprngErase: async (device: string, options: { dryRun: boolean }) => {
      await simulate('erase', (percent) => ({ device, method: 'csprng_overwrite', percent, statusText: options.dryRun ? 'Dry run: writing CSPRNG sample' : 'Writing CSPRNG data across the device' }));
      return { device, method: 'csprng_overwrite', assurance: 'clear', completedAt: new Date().toISOString(), auditLogPath: 'C:\\Users\\Priya\\AppData\\Roaming\\SIH Recovery Platform\\audit\\secure-erase\\2026-09-15.ndjson' };
    },
    chooseCaptureOutput: (name: string) => delay(`D:\\Evidence\\${name}`, 300),
    captureImage: async (device: string, options: { imagePath: string; maxBytes?: number | null }) => {
      await simulate('capture', (percent) => ({ device, percent, statusText: 'Reading sectors and hashing' }));
      return { device, model: 'SanDisk Ultra', imagePath: options.imagePath, bytesCaptured: options.maxBytes ?? 30752636928, sha256: '9f'.repeat(32), truncated: Boolean(options.maxBytes), completedAt: new Date().toISOString() };
    },
    onProgress: (callback: (event: unknown) => void) => { progressListeners.erase.add(callback); return () => progressListeners.erase.delete(callback); },
    onCaptureProgress: (callback: (event: unknown) => void) => { progressListeners.capture.add(callback); return () => progressListeners.capture.delete(callback); },
    onDownloadProgress: () => () => undefined,
  },
  deletionApi: {
    chooseFolder: () => delay('E:\\old-exports', 300),
    plan: (targetPath: string) => delay({ planId: '6f1d3c1e-0b1c-4a5e-9b3f-6c3a2f1e0d11', targetPath, device: { device: blockDevices[1]!.device, mountRoot: 'E:\\', ...{ device: blockDevices[1] } }, fileCount: 37, directoryCount: 4, totalBytes: 48_213_004, sample: ['Q4_Financial_Report.jpg', 'Aadhaar_Scan_Front.jpg', 'minutes\\Board_Meeting_Minutes.pdf', 'minutes\\attendance.xlsx', 'raw\\IMG_0231.jpg', 'raw\\IMG_0232.jpg'], skipped: [], plannedAt: new Date().toISOString() }, 500),
    execute: async (planId: string) => {
      await simulate('deletion', (percent) => ({ planId, targetPath: 'E:\\old-exports', percent, statusText: percent < 100 ? 'Overwriting IMG_0231.jpg' : 'Secure deletion complete (NIST 800-88 Clear, per file)', filesDone: Math.round((percent / 100) * 37), fileCount: 37 }));
      return { planId, targetPath: 'E:\\old-exports', device: { device: blockDevices[1], mountRoot: 'E:\\' }, method: 'csprng_overwrite', assurance: 'clear', fileCount: 37, filesDeleted: 37, bytesOverwritten: 48_213_004, directoriesRemoved: 5, failures: [], skipped: [], startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), auditLogPath: 'C:\\Users\\Priya\\AppData\\Roaming\\SIH Recovery Platform\\audit\\secure-erase\\2026-09-15.ndjson' };
    },
    onProgress: (callback: (event: unknown) => void) => { progressListeners.deletion.add(callback); return () => progressListeners.deletion.delete(callback); },
  },
});

// Seed a known case so every case route renders straight away.
localStorage.setItem('recovery:recent-cases', JSON.stringify([
  { caseId: 'case-live', title: recoveryCase.title, operator: recoveryCase.operator, workspacePath: recoveryCase.workspacePath, createdAt },
  { caseId: 'case-2', title: 'Field laptop SSD', operator: 'Arjun Mehta', workspacePath: 'D:\\Cases\\Field laptop SSD', createdAt: '2026-08-29T14:40:00Z' },
]));
localStorage.setItem('recovery:recent-deletions', JSON.stringify([
  { id: '6f1d3c1e-0b1c-4a5e-9b3f-6c3a2f1e0d11', title: 'Deletion: old-exports', targetPath: 'E:\\old-exports', totalFiles: 37, createdAt: '2026-09-05T09:00:00Z', completedAt: '2026-09-05T09:02:10Z', status: 'completed', filesDeleted: 37, bytesOverwritten: 48213004, failures: 0, deviceModel: 'SanDisk Ultra' },
]));
sessionStorage.setItem('recovery:case-live:workspacePath', recoveryCase.workspacePath);
sessionStorage.setItem('recovery:case-live:sourceId', image.sourceId);
if (stage !== 'draft') sessionStorage.setItem('recovery:case-live:jobId', status.jobId);
sessionStorage.setItem('recovery:case-live:goal', 'recover_everything');
if (params.get('theme')) localStorage.setItem('recovery:ui-preferences', JSON.stringify({ theme: params.get('theme'), sidebarCollapsed: false }));

void import('../src/renderer/app.js');
