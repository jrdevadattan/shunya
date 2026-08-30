import type { RecoveryCase } from '@recovery/contracts';

type CaseField = 'workspacePath' | 'sourceId' | 'jobId' | 'goal';
const key = (caseId: string, field: CaseField) => `recovery:${caseId}:${field}`;
const validatedKey = (caseId: string) => `recovery:${caseId}:validated`;
let lastValidatedCase: RecoveryCase | undefined;

export function rememberCase(caseId: string, workspacePath: string): void {
  lastValidatedCase = undefined;
  sessionStorage.removeItem(validatedKey(caseId));
  const previous = activeWorkspace(caseId);
  if (previous && previous !== workspacePath) {
    for (const field of ['sourceId', 'jobId', 'goal'] satisfies CaseField[]) sessionStorage.removeItem(key(caseId, field));
  }
  sessionStorage.setItem(key(caseId, 'workspacePath'), workspacePath);
}

export function rememberValidatedCase(recoveryCase: RecoveryCase): void {
  rememberCase(recoveryCase.caseId, recoveryCase.workspacePath);
  lastValidatedCase = recoveryCase;
  sessionStorage.setItem(validatedKey(recoveryCase.caseId), '1');
}

export function validatedCase(caseId: string, workspacePath: string): RecoveryCase | null {
  return sessionStorage.getItem(validatedKey(caseId)) === '1'
    && lastValidatedCase?.caseId === caseId && lastValidatedCase.workspacePath === workspacePath
    ? lastValidatedCase
    : null;
}

export function forgetCase(caseId: string): void {
  for (const field of ['workspacePath', 'sourceId', 'jobId', 'goal'] satisfies CaseField[]) sessionStorage.removeItem(key(caseId, field));
  sessionStorage.removeItem(validatedKey(caseId));
  if (lastValidatedCase?.caseId === caseId) lastValidatedCase = undefined;
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
