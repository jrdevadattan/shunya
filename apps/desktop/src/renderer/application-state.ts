type CaseField = 'workspacePath' | 'sourceId' | 'jobId' | 'goal';
const key = (caseId: string, field: CaseField) => `recovery:${caseId}:${field}`;

export function rememberCase(caseId: string, workspacePath: string): void {
  const previous = activeWorkspace(caseId);
  if (previous && previous !== workspacePath) {
    for (const field of ['sourceId', 'jobId', 'goal'] satisfies CaseField[]) sessionStorage.removeItem(key(caseId, field));
  }
  sessionStorage.setItem(key(caseId, 'workspacePath'), workspacePath);
}

export function forgetCase(caseId: string): void {
  for (const field of ['workspacePath', 'sourceId', 'jobId', 'goal'] satisfies CaseField[]) sessionStorage.removeItem(key(caseId, field));
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
