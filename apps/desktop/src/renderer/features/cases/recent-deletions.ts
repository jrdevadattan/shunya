import { z } from 'zod';

export const RECENT_DELETIONS_STORAGE_KEY = 'recovery:recent-deletions';
export const MAX_RECENT_DELETIONS = 12;

export const RecentDeletionCaseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  targetPath: z.string(),
  totalFiles: z.number(),
  createdAt: z.string(),
  // Legacy records (the old marker-file stub) only carried the fields above.
  markerPath: z.string().optional(),
  status: z.enum(['completed', 'completed_with_failures']).optional(),
  filesDeleted: z.number().optional(),
  bytesOverwritten: z.number().optional(),
  failures: z.number().optional(),
  deviceModel: z.string().optional(),
  auditLogPath: z.string().optional(),
  completedAt: z.string().optional(),
});

export type RecentDeletionCase = z.infer<typeof RecentDeletionCaseSchema>;

export function loadRecentDeletions(storage: Storage = localStorage): RecentDeletionCase[] {
  try {
    const raw = storage.getItem(RECENT_DELETIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const result = RecentDeletionCaseSchema.safeParse(entry);
      return result.success ? [result.data] : [];
    }).slice(0, MAX_RECENT_DELETIONS);
  } catch {
    return [];
  }
}

export function rememberRecentDeletion(deletionCase: RecentDeletionCase, storage: Storage = localStorage): RecentDeletionCase[] {
  const parsedCase = RecentDeletionCaseSchema.parse(deletionCase);
  const recentDeletions = [
    parsedCase,
    ...loadRecentDeletions(storage).filter((entry) => entry.id !== parsedCase.id),
  ].slice(0, MAX_RECENT_DELETIONS);
  try {
    storage.setItem(RECENT_DELETIONS_STORAGE_KEY, JSON.stringify(recentDeletions));
  } catch {
    // Storage is a convenience; the audit log in the main process is the record.
  }
  return recentDeletions;
}
