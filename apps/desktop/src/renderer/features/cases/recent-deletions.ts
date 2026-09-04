import { z } from 'zod';

export const RECENT_DELETIONS_STORAGE_KEY = 'recovery:recent-deletions';
export const MAX_RECENT_DELETIONS = 12;

export const RecentDeletionCaseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  targetPath: z.string(),
  totalFiles: z.number(),
  markerPath: z.string(),
  createdAt: z.string(),
});

export type RecentDeletionCase = z.infer<typeof RecentDeletionCaseSchema>;

export function loadRecentDeletions(storage: Storage = localStorage): RecentDeletionCase[] {
  try {
    const raw = storage.getItem(RECENT_DELETIONS_STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      const parsed = RecentDeletionCaseSchema.safeParse(entry);
      return parsed.success ? [parsed.data] : [];
    }).slice(0, MAX_RECENT_DELETIONS);
  } catch {
    return [];
  }
}

export function rememberRecentDeletion(deletionCase: RecentDeletionCase, storage: Storage = localStorage): RecentDeletionCase[] {
  const parsedCase = RecentDeletionCaseSchema.parse(deletionCase);
  const recentDeletions = [
    parsedCase,
    ...loadRecentDeletions(storage).filter((entry) => entry.targetPath !== parsedCase.targetPath),
  ].slice(0, MAX_RECENT_DELETIONS);
  try {
    storage.setItem(RECENT_DELETIONS_STORAGE_KEY, JSON.stringify(recentDeletions));
  } catch {
    // Ignore storage errors
  }
  return recentDeletions;
}
