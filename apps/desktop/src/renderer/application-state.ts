const key = (caseId: string, field: 'workspacePath' | 'sourceId' | 'jobId') => `recovery:${caseId}:${field}`;

export function rememberCase(caseId: string, workspacePath: string): void {
  sessionStorage.setItem(key(caseId, 'workspacePath'), workspacePath);
}

export function rememberSource(caseId: string, sourceId: string): void {
  sessionStorage.setItem(key(caseId, 'sourceId'), sourceId);
}

export function rememberJob(caseId: string, jobId: string): void {
  sessionStorage.setItem(key(caseId, 'jobId'), jobId);
}

export function activeWorkspace(caseId: string): string | null { return sessionStorage.getItem(key(caseId, 'workspacePath')); }
export function activeSourceId(caseId: string): string | null { return sessionStorage.getItem(key(caseId, 'sourceId')); }
export function activeJobId(caseId: string): string | null { return sessionStorage.getItem(key(caseId, 'jobId')); }
