import type { JobEvent, RecoveryDesktopApi } from '@recovery/contracts';

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
  return Object.freeze({
    getRuntimeInfo: () => transport.invoke('runtime.get'),
    createCase: (input: unknown) => transport.invoke('case.create', input),
    openCase: (casePath: string) => transport.invoke('case.open', casePath),
    listSources: () => transport.invoke('source.list'),
    addImageSource: (input: unknown) => transport.invoke('source.add_image', input),
    assessSource: (sourceId: string) => transport.invoke('source.assess', sourceId),
    createRecoveryJob: (input: unknown) => transport.invoke('job.create', input),
    startJob: (jobId: string) => transport.invoke('job.start', jobId),
    pauseJob: (jobId: string) => transport.invoke('job.pause', jobId),
    resumeJob: (jobId: string) => transport.invoke('job.resume', jobId),
    cancelJob: (jobId: string) => transport.invoke('job.cancel', jobId),
    getJobStatus: (jobId: string) => transport.invoke('job.status', jobId),
    listJobEvents: (jobId: string, afterSequence = 0) => transport.invoke('job.events', { jobId, afterSequence }),
    queryArtifacts: (query: unknown) => transport.invoke('artifact.query', query),
    getArtifact: (artifactId: string) => transport.invoke('artifact.get', artifactId),
    requestPreview: (artifactId: string) => transport.invoke('artifact.preview', artifactId),
    exportArtifacts: (input: unknown) => transport.invoke('export.start', input),
    generateReport: (caseId: string) => transport.invoke('report.generate', caseId),
    subscribeJobEvents: (listener: (event: JobEvent) => void) => transport.subscribe('job.event', listener as (payload: unknown) => void),
  }) as RecoveryDesktopApi;
}
