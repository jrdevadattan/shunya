import {
  AddImageSourceInputSchema, ArtifactPageSchema, ArtifactParamsSchema, ArtifactQuerySchema, CaseOpenParamsSchema, CaseStateSchema,
  CreateCaseInputSchema, CreateRecoveryJobInputSchema, ExportArtifactsInputSchema, ExportFolderResultSchema, ExportJobSchema, JobEventSchema,
  JobEventsParamsSchema, JobParamsSchema, JobStatusSchema, PreviewDescriptorSchema, RecoveryArtifactSchema,
  RecoveryCaseSchema, RecoveryJobSchema, ReportDescriptorSchema, ReportParamsSchema, ReportRevealParamsSchema, ReportRevealResultSchema, RuntimeInfoSchema,
  SourceAssessmentSchema, SourceDescriptorSchema, SourceImageResultSchema, SourceParamsSchema, WorkspaceFolderResultSchema, DeletionListResultSchema, type JobEvent, type RecoveryDesktopApi,
} from '@recovery/contracts';

export const recoveryApiMethodNames = [
  'getRuntimeInfo', 'chooseWorkspaceFolder', 'chooseExportFolder', 'chooseSourceImage', 'createCase', 'openCase', 'getCaseState', 'listSources', 'addImageSource', 'assessSource',
  'createRecoveryJob', 'startJob', 'pauseJob', 'resumeJob', 'cancelJob', 'queryArtifacts',
  'getJobStatus', 'listJobEvents', 'getArtifact', 'requestPreview', 'exportArtifacts', 'generateReport', 'revealReportInFolder', 'subscribeJobEvents', 'listDeletionFiles',
] as const;

export interface PreloadTransport {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  subscribe(channel: string, listener: (payload: unknown) => void): () => void;
}

export function createRecoveryApi(transport: PreloadTransport): RecoveryDesktopApi {
  const invoke = (channel: string, ...args: unknown[]) => invokeRecovery(transport, channel, ...args);
  const api: RecoveryDesktopApi = {
    getRuntimeInfo: async () => RuntimeInfoSchema.parse(await invoke('runtime.get', {})),
    chooseWorkspaceFolder: async () => WorkspaceFolderResultSchema.parse(await invoke('dialog.choose_workspace', {})),
    chooseExportFolder: async () => ExportFolderResultSchema.parse(await invoke('dialog.choose_export', {})),
    chooseSourceImage: async () => SourceImageResultSchema.parse(await invoke('dialog.choose_source_image', {})),
    createCase: async (input) => RecoveryCaseSchema.parse(await invoke('case.create', CreateCaseInputSchema.parse(input))),
    openCase: async (casePath) => RecoveryCaseSchema.parse(await invoke('case.open', CaseOpenParamsSchema.parse({ casePath }))),
    getCaseState: async () => CaseStateSchema.parse(await invoke('case.state', {})),
    listSources: async () => SourceDescriptorSchema.array().parse(await invoke('source.list', {})),
    addImageSource: async (input) => SourceDescriptorSchema.parse(await invoke('source.add_image', AddImageSourceInputSchema.parse(input))),
    assessSource: async (sourceId) => SourceAssessmentSchema.parse(await invoke('source.assess', SourceParamsSchema.parse({ sourceId }))),
    createRecoveryJob: async (input) => RecoveryJobSchema.parse(await invoke('job.create', CreateRecoveryJobInputSchema.parse(input))),
    startJob: async (jobId) => JobStatusSchema.parse(await invoke('job.start', JobParamsSchema.parse({ jobId }))),
    pauseJob: async (jobId) => JobStatusSchema.parse(await invoke('job.pause', JobParamsSchema.parse({ jobId }))),
    resumeJob: async (jobId) => JobStatusSchema.parse(await invoke('job.resume', JobParamsSchema.parse({ jobId }))),
    cancelJob: async (jobId) => JobStatusSchema.parse(await invoke('job.cancel', JobParamsSchema.parse({ jobId }))),
    getJobStatus: async (jobId) => JobStatusSchema.parse(await invoke('job.status', JobParamsSchema.parse({ jobId }))),
    listJobEvents: async (jobId, afterSequence = 0) => JobEventSchema.array().parse(await invoke('job.events', JobEventsParamsSchema.parse({ jobId, afterSequence }))),
    queryArtifacts: async (query) => ArtifactPageSchema.parse(await invoke('artifact.query', ArtifactQuerySchema.parse(query))),
    getArtifact: async (artifactId) => RecoveryArtifactSchema.parse(await invoke('artifact.get', ArtifactParamsSchema.parse({ artifactId }))),
    requestPreview: async (artifactId) => PreviewDescriptorSchema.parse(await invoke('artifact.preview', ArtifactParamsSchema.parse({ artifactId }))),
    exportArtifacts: async (input) => ExportJobSchema.parse(await invoke('export.start', ExportArtifactsInputSchema.parse(input))),
    generateReport: async (caseId) => ReportDescriptorSchema.parse(await invoke('report.generate', ReportParamsSchema.parse({ caseId }))),
    revealReportInFolder: async (reportPath) => { ReportRevealResultSchema.parse(await invoke('report.reveal', ReportRevealParamsSchema.parse({ reportPath }))); },
    listDeletionFiles: async (targetPath) => {
      const result = await invoke('deletion.list_files', { targetPath });
      return DeletionListResultSchema.parse(result);
    },
    subscribeJobEvents: (listener: (event: JobEvent) => void) => transport.subscribe('job.event', (payload) => listener(JobEventSchema.parse(payload))),
  };
  return Object.freeze(api);
}

async function invokeRecovery(transport: PreloadTransport, channel: string, ...args: unknown[]): Promise<unknown> {
  try {
    return await transport.invoke(channel, ...args);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(userFacingRecoveryError(message));
  }
}

function userFacingRecoveryError(message: string): string {
  if (message.includes('WORKSPACE_PERMISSION_DENIED')) {
    return 'The selected folder could not be inspected. Choose a folder you have permission to read.';
  }
  if (message.includes('destination already exists and will not be overwritten')) {
    return 'That case folder already exists. Choose a different case folder name or parent folder so nothing is overwritten.';
  }
  if (message.includes('DAEMON_UNAVAILABLE')) {
    return 'The recovery service is unavailable. Restart the app and try again.';
  }
  if (message.includes('INSUFFICIENT_DESTINATION_SPACE')) {
    return 'The selected destination does not have enough free space for this recovery.';
  }
  return message
    .replace(/^Error invoking remote method '[^']+': Error:\s*/, '')
    .replace(/^[A-Z][A-Z0-9_]+:\s*/, '');
}
