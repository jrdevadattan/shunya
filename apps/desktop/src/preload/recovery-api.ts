import {
  AddImageSourceInputSchema, ArtifactPageSchema, ArtifactParamsSchema, ArtifactQuerySchema, CaseOpenParamsSchema,
  CreateCaseInputSchema, CreateRecoveryJobInputSchema, ExportArtifactsInputSchema, ExportJobSchema, JobEventSchema,
  JobEventsParamsSchema, JobParamsSchema, JobStatusSchema, PreviewDescriptorSchema, RecoveryArtifactSchema,
  RecoveryCaseSchema, RecoveryJobSchema, ReportDescriptorSchema, ReportParamsSchema, RuntimeInfoSchema,
  SourceAssessmentSchema, SourceDescriptorSchema, SourceParamsSchema, type JobEvent, type RecoveryDesktopApi,
} from '@recovery/contracts';

export const recoveryApiMethodNames = [
  'getRuntimeInfo', 'createCase', 'openCase', 'listSources', 'addImageSource', 'assessSource',
  'createRecoveryJob', 'startJob', 'pauseJob', 'resumeJob', 'cancelJob', 'queryArtifacts',
  'getJobStatus', 'listJobEvents', 'getArtifact', 'requestPreview', 'exportArtifacts', 'generateReport', 'subscribeJobEvents',
] as const;

export interface PreloadTransport {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  subscribe(channel: string, listener: (payload: unknown) => void): () => void;
}

export function createRecoveryApi(transport: PreloadTransport): RecoveryDesktopApi {
  const api: RecoveryDesktopApi = {
    getRuntimeInfo: async () => RuntimeInfoSchema.parse(await transport.invoke('runtime.get', {})),
    createCase: async (input) => RecoveryCaseSchema.parse(await transport.invoke('case.create', CreateCaseInputSchema.parse(input))),
    openCase: async (casePath) => RecoveryCaseSchema.parse(await transport.invoke('case.open', CaseOpenParamsSchema.parse({ casePath }))),
    listSources: async () => SourceDescriptorSchema.array().parse(await transport.invoke('source.list', {})),
    addImageSource: async (input) => SourceDescriptorSchema.parse(await transport.invoke('source.add_image', AddImageSourceInputSchema.parse(input))),
    assessSource: async (sourceId) => SourceAssessmentSchema.parse(await transport.invoke('source.assess', SourceParamsSchema.parse({ sourceId }))),
    createRecoveryJob: async (input) => RecoveryJobSchema.parse(await transport.invoke('job.create', CreateRecoveryJobInputSchema.parse(input))),
    startJob: async (jobId) => JobStatusSchema.parse(await transport.invoke('job.start', JobParamsSchema.parse({ jobId }))),
    pauseJob: async (jobId) => JobStatusSchema.parse(await transport.invoke('job.pause', JobParamsSchema.parse({ jobId }))),
    resumeJob: async (jobId) => JobStatusSchema.parse(await transport.invoke('job.resume', JobParamsSchema.parse({ jobId }))),
    cancelJob: async (jobId) => JobStatusSchema.parse(await transport.invoke('job.cancel', JobParamsSchema.parse({ jobId }))),
    getJobStatus: async (jobId) => JobStatusSchema.parse(await transport.invoke('job.status', JobParamsSchema.parse({ jobId }))),
    listJobEvents: async (jobId, afterSequence = 0) => JobEventSchema.array().parse(await transport.invoke('job.events', JobEventsParamsSchema.parse({ jobId, afterSequence }))),
    queryArtifacts: async (query) => ArtifactPageSchema.parse(await transport.invoke('artifact.query', ArtifactQuerySchema.parse(query))),
    getArtifact: async (artifactId) => RecoveryArtifactSchema.parse(await transport.invoke('artifact.get', ArtifactParamsSchema.parse({ artifactId }))),
    requestPreview: async (artifactId) => PreviewDescriptorSchema.parse(await transport.invoke('artifact.preview', ArtifactParamsSchema.parse({ artifactId }))),
    exportArtifacts: async (input) => ExportJobSchema.parse(await transport.invoke('export.start', ExportArtifactsInputSchema.parse(input))),
    generateReport: async (caseId) => ReportDescriptorSchema.parse(await transport.invoke('report.generate', ReportParamsSchema.parse({ caseId }))),
    subscribeJobEvents: (listener: (event: JobEvent) => void) => transport.subscribe('job.event', (payload) => listener(JobEventSchema.parse(payload))),
  };
  return Object.freeze(api);
}
