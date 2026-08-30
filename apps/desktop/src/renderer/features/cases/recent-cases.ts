import { RecoveryCaseSchema, type RecoveryCase } from '@recovery/contracts';

export const RECENT_CASES_STORAGE_KEY = 'recovery:recent-cases';
export const MAX_RECENT_CASES = 12;

const RecentRecoveryCaseSchema = RecoveryCaseSchema.pick({
  caseId: true,
  title: true,
  operator: true,
  workspacePath: true,
  createdAt: true,
});

export type RecentRecoveryCase = Pick<RecoveryCase, 'caseId' | 'title' | 'operator' | 'workspacePath' | 'createdAt'>;

export function loadRecentCases(storage: Storage = localStorage): RecentRecoveryCase[] {
  try {
    const raw = storage.getItem(RECENT_CASES_STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      const parsed = RecentRecoveryCaseSchema.safeParse(entry);
      return parsed.success ? [parsed.data] : [];
    }).slice(0, MAX_RECENT_CASES);
  } catch {
    return [];
  }
}

export function rememberRecentCase(recoveryCase: RecoveryCase, storage: Storage = localStorage): RecentRecoveryCase[] {
  const recentCase = RecentRecoveryCaseSchema.parse(recoveryCase);
  const recentCases = [
    recentCase,
    ...loadRecentCases(storage).filter((entry) =>
      entry.caseId !== recentCase.caseId && entry.workspacePath !== recentCase.workspacePath,
    ),
  ].slice(0, MAX_RECENT_CASES);
  try {
    storage.setItem(RECENT_CASES_STORAGE_KEY, JSON.stringify(recentCases));
  } catch {
    // A full or disabled local store must not turn a successful daemon operation into a failure.
  }
  return recentCases;
}
