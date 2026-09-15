// Folder-level secure deletion for removable media.
//
// Every regular file beneath the chosen folder is overwritten in place with an
// AES-256-CTR CSPRNG keystream (the same engine as the whole-device wipe), then
// renamed to a random name and unlinked; emptied directories are removed
// bottom-up. This module is pure Node so it is unit-testable: the device
// resolver and the audit sink are injected by the IPC layer.
//
// Honesty notes that the UI must carry: this is an overwrite-based NIST SP
// 800-88 Rev. 2 **Clear** at file level. On flash media, wear-levelling means
// the physical pages that held the old content are not guaranteed to be the
// ones rewritten; the whole-device erase is the higher-assurance path, and
// firmware sanitize (Purge) is stronger still.
import { randomBytes, randomUUID } from 'node:crypto';
import { chmod, lstat, open, readdir, realpath, rename, rmdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { csprngOverwrite } from './csprngOverwrite.js';
import type { BlockDevice } from './types.js';

export interface FolderDevice {
  /** The removable block device that hosts the folder. */
  device: BlockDevice;
  /** Mount point / drive root the folder lives under, e.g. `E:\` or `/media/usb`. */
  mountRoot: string;
}

export interface DeletionPlanFile {
  path: string;
  sizeBytes: number;
}

export interface DeletionSkip {
  path: string;
  reason: 'symlink' | 'special' | 'unreadable';
}

export interface DeletionPlan {
  planId: string;
  targetPath: string;
  device: FolderDevice;
  fileCount: number;
  directoryCount: number;
  totalBytes: number;
  /** First entries only; the full list stays in the main process. */
  sample: string[];
  skipped: DeletionSkip[];
  plannedAt: string;
}

export interface DeletionProgressEvent {
  planId: string;
  targetPath: string;
  percent: number | null;
  statusText: string;
  filesDone: number;
  fileCount: number;
}

export interface DeletionFailure {
  path: string;
  error: string;
}

export interface DeletionResult {
  planId: string;
  targetPath: string;
  device: FolderDevice;
  method: 'csprng_overwrite';
  assurance: 'clear';
  fileCount: number;
  filesDeleted: number;
  bytesOverwritten: number;
  directoriesRemoved: number;
  failures: DeletionFailure[];
  skipped: DeletionSkip[];
  startedAt: string;
  completedAt: string;
  auditLogPath: string;
}

export interface DeletionDependencies {
  /** Resolves the removable device hosting `targetPath`; throws when it is not eligible. */
  resolveDevice(targetPath: string): Promise<FolderDevice>;
  /** Appends an audit record and returns the log path. */
  audit(entry: Record<string, unknown>): Promise<string>;
}

const SAMPLE_SIZE = 12;
const OVERWRITE_CHUNK = 4 * 1024 * 1024;

interface PlanInternal extends DeletionPlan {
  files: DeletionPlanFile[];
  directories: string[];
}

/** Plans are kept in memory so `execute` can only ever act on a path that was planned. */
const plans = new Map<string, PlanInternal>();

function normalise(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.replace(/\//g, '\\').toLowerCase() : resolved;
}

async function isRoot(target: string, mountRoot: string): Promise<boolean> {
  // Compare canonical forms so an 8.3 short name never disguises the mount root.
  const canonicalRoot = await realpath(mountRoot).catch(() => mountRoot);
  const normalisedTarget = normalise(target).replace(/[\\/]+$/, '');
  const normalisedRoot = normalise(canonicalRoot).replace(/[\\/]+$/, '');
  return normalisedTarget === normalisedRoot || path.parse(path.resolve(target)).root === path.resolve(target);
}

async function walk(root: string, files: DeletionPlanFile[], directories: string[], skipped: DeletionSkip[]): Promise<void> {
  const stack = [root];
  while (stack.length) {
    const directory = stack.pop()!;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      skipped.push({ path: directory, reason: 'unreadable' });
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      let info;
      try {
        info = await lstat(entryPath);
      } catch {
        skipped.push({ path: entryPath, reason: 'unreadable' });
        continue;
      }
      if (info.isSymbolicLink()) {
        // Never follow links or junctions: they could point outside the folder or the device.
        skipped.push({ path: entryPath, reason: 'symlink' });
        continue;
      }
      if (info.isDirectory()) {
        directories.push(entryPath);
        stack.push(entryPath);
      } else if (info.isFile()) {
        files.push({ path: entryPath, sizeBytes: info.size });
      } else {
        skipped.push({ path: entryPath, reason: 'special' });
      }
    }
  }
}

export async function planFolderDeletion(targetPath: string, dependencies: DeletionDependencies): Promise<DeletionPlan> {
  if (typeof targetPath !== 'string' || !targetPath.trim()) throw new Error('DELETION_TARGET_REQUIRED');
  const resolved = await realpath(targetPath).catch(() => { throw new Error('DELETION_TARGET_NOT_FOUND'); });
  const info = await stat(resolved);
  if (!info.isDirectory()) throw new Error('DELETION_TARGET_NOT_A_FOLDER');
  const device = await dependencies.resolveDevice(resolved);
  if (device.device.system) throw new Error('DELETION_SYSTEM_DEVICE_BLOCKED');
  if (!device.device.removable) throw new Error('DELETION_NON_REMOVABLE_BLOCKED');
  if (await isRoot(resolved, device.mountRoot)) throw new Error('DELETION_DRIVE_ROOT_BLOCKED');

  const files: DeletionPlanFile[] = [];
  const directories: string[] = [];
  const skipped: DeletionSkip[] = [];
  await walk(resolved, files, directories, skipped);
  files.sort((left, right) => left.path.localeCompare(right.path));
  const plan: PlanInternal = {
    planId: randomUUID(),
    targetPath: resolved,
    device,
    fileCount: files.length,
    directoryCount: directories.length,
    totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
    sample: files.slice(0, SAMPLE_SIZE).map((file) => path.relative(resolved, file.path)),
    skipped,
    plannedAt: new Date().toISOString(),
    files,
    directories,
  };
  plans.set(plan.planId, plan);
  const { files: _files, directories: _directories, ...summary } = plan;
  return summary;
}

async function shredFile(file: DeletionPlanFile, onBytes: (written: number) => void): Promise<number> {
  // Clear a read-only attribute so the overwrite and unlink can proceed.
  await chmod(file.path, 0o666).catch(() => undefined);
  let written = 0;
  if (file.sizeBytes > 0) {
    let last = 0;
    await csprngOverwrite(file.path, file.sizeBytes, {
      chunkSize: Math.min(OVERWRITE_CHUNK, Math.max(64 * 1024, file.sizeBytes)),
      progressIntervalMs: 200,
      onProgress: (progress) => { onBytes(progress.bytesWritten - last); last = progress.bytesWritten; },
    });
    written = file.sizeBytes;
  }
  // Truncate so the directory entry no longer records the original length,
  // then rename to a random name so the original file name is not left in the
  // directory table, then unlink.
  const handle = await open(file.path, 'r+');
  try { await handle.truncate(0); } finally { await handle.close(); }
  const scrambled = path.join(path.dirname(file.path), randomBytes(8).toString('hex'));
  let finalPath = file.path;
  try { await rename(file.path, scrambled); finalPath = scrambled; } catch { /* keep the original name if rename is refused */ }
  await unlink(finalPath);
  return written;
}

export async function executeFolderDeletion(
  planId: string,
  options: { confirmation: string },
  dependencies: DeletionDependencies,
  onProgress: (event: DeletionProgressEvent) => void = () => undefined,
): Promise<DeletionResult> {
  const plan = plans.get(planId);
  if (!plan) throw new Error('DELETION_PLAN_NOT_FOUND');
  if (options.confirmation !== plan.targetPath) throw new Error('DELETION_CONFIRMATION_MISMATCH');
  // Re-resolve the device right before acting: the media may have been swapped.
  const device = await dependencies.resolveDevice(plan.targetPath);
  if (device.device.system || !device.device.removable) throw new Error('DELETION_DEVICE_CHANGED');
  if (device.device.device !== plan.device.device.device) throw new Error('DELETION_DEVICE_CHANGED');
  plans.delete(planId);

  const startedAt = new Date().toISOString();
  await dependencies.audit({
    kind: 'folder_deletion', action: 'start', planId, targetPath: plan.targetPath, device: device.device.device,
    model: device.device.model, serial: device.device.serial, fileCount: plan.fileCount, totalBytes: plan.totalBytes,
  });
  const report = (percent: number | null, statusText: string, filesDone: number) =>
    onProgress({ planId, targetPath: plan.targetPath, percent, statusText, filesDone, fileCount: plan.fileCount });

  let bytesOverwritten = 0;
  let filesDeleted = 0;
  const failures: DeletionFailure[] = [];
  report(0, `Overwriting ${plan.fileCount} files with CSPRNG data`, 0);
  for (const file of plan.files) {
    try {
      await shredFile(file, (written) => {
        bytesOverwritten += written;
        report(plan.totalBytes ? (bytesOverwritten / plan.totalBytes) * 100 : null, `Overwriting ${path.basename(file.path)}`, filesDeleted);
      });
      filesDeleted += 1;
      report(plan.totalBytes ? (bytesOverwritten / plan.totalBytes) * 100 : (filesDeleted / Math.max(1, plan.fileCount)) * 100, `Deleted ${path.basename(file.path)}`, filesDeleted);
    } catch (cause) {
      failures.push({ path: file.path, error: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  // Remove directories deepest-first, then the folder itself; anything that is
  // not empty (a skipped link or a failed file) is left in place and reported.
  let directoriesRemoved = 0;
  const directories = [...plan.directories].sort((left, right) => right.length - left.length);
  for (const directory of [...directories, plan.targetPath]) {
    try { await rmdir(directory); directoriesRemoved += 1; } catch (cause) {
      if (failures.length === 0 && plan.skipped.length === 0) failures.push({ path: directory, error: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  const completedAt = new Date().toISOString();
  const finalStatus = failures.length ? 'completed_with_failures' : 'completed';
  const auditLogPath = await dependencies.audit({
    kind: 'folder_deletion', action: 'finish', planId, targetPath: plan.targetPath, device: device.device.device,
    filesDeleted, bytesOverwritten, directoriesRemoved, failures: failures.length, skipped: plan.skipped.length, finalStatus,
  });
  report(100, failures.length ? `Finished with ${failures.length} failure(s)` : 'Secure deletion complete (NIST 800-88 Clear, per file)', filesDeleted);
  return {
    planId, targetPath: plan.targetPath, device, method: 'csprng_overwrite', assurance: 'clear',
    fileCount: plan.fileCount, filesDeleted, bytesOverwritten, directoriesRemoved, failures, skipped: plan.skipped,
    startedAt, completedAt, auditLogPath,
  };
}

/** Test hook: forget every pending plan. */
export function clearDeletionPlans(): void {
  plans.clear();
}
