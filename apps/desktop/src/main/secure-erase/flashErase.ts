import { spawn } from 'node:child_process';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { appendAudit } from './audit.js';
import { listBlockDevices } from './blockDevices.js';
import { csprngOverwrite, type OverwriteProgress } from './csprngOverwrite.js';
import { windowsCsprngOverwrite } from './windowsRawWrite.js';
import type { BlockDevice, EraseProgressEvent, EraseResult } from './types.js';

/** Runs a CSPRNG overwrite of `target` using the engine that works on this
 * platform. Windows raw devices (and Windows scratch files, so the dry run is a
 * true rehearsal) go through a .NET FileStream because Node's `fs` cannot do
 * positioned writes to a `\\.\PhysicalDriveN` handle; everything else uses the
 * cross-platform Node AES-256-CTR engine. */
async function overwriteTarget(
  target: string,
  totalBytes: number,
  onProgress: (progress: OverwriteProgress) => void,
): Promise<void> {
  if (process.platform === 'win32') {
    await windowsCsprngOverwrite(target, totalBytes, { onProgress });
  } else {
    await csprngOverwrite(target, totalBytes, { onProgress });
  }
}

export interface CsprngEraseOptions {
  /** Must exactly equal the target device path; re-checked in the main process. */
  confirmation: string;
  /** When true, no device is touched: a real CSPRNG stream is written to a
   * scratch file to demonstrate the pipeline safely. */
  dryRun: boolean;
}

const METHOD = 'csprng_overwrite' as const;
const DRY_RUN_SAMPLE_BYTES = 64 * 1024 * 1024;

function run(executable: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once('error', reject);
    child.once('close', (code) => resolve({ exitCode: code ?? -1, stdout, stderr }));
  });
}

/** Resolves the target only if it exists, is not the system disk, and is
 * removable — a defence-in-depth re-check independent of the renderer. */
async function requireEligibleDevice(device: string): Promise<BlockDevice> {
  const devices = await listBlockDevices();
  const match = devices.find((candidate) => candidate.device === device);
  if (!match) throw new Error('ERASE_DEVICE_NOT_FOUND');
  if (match.system) throw new Error('ERASE_SYSTEM_DEVICE_BLOCKED');
  if (!match.removable) throw new Error('ERASE_NON_REMOVABLE_DEVICE_BLOCKED');
  if (!Number.isSafeInteger(match.sizeBytes) || match.sizeBytes <= 0) throw new Error('ERASE_DEVICE_SIZE_UNKNOWN');
  return match;
}

async function isElevated(): Promise<boolean> {
  if (process.platform === 'win32') {
    // `net session` returns exit code 0 only for an elevated (admin) process.
    const netSession = await run('cmd.exe', ['/d', '/s', '/c', 'net session']).catch(() => null);
    if (netSession && netSession.exitCode === 0) return true;
    // Fallback: token elevation check.
    const ps = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '[bool]([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)']).catch(() => null);
    return Boolean(ps && ps.stdout.trim().toLowerCase() === 'true');
  }
  return typeof process.getuid === 'function' && process.getuid() === 0;
}

/** Unmounts every mounted partition of the target device. Requires privilege. */
async function unmountLinuxDevice(device: string): Promise<void> {
  const list = await run('lsblk', ['-nro', 'PATH,MOUNTPOINT', device]);
  const mounts = list.stdout.split(/\r?\n/).flatMap((line) => {
    const parts = line.trim().split(/\s+/);
    return parts.length >= 2 && parts[0] && parts[1] ? [parts[0]] : [];
  });
  for (const partition of mounts) {
    const result = await run('umount', [partition]);
    if (result.exitCode !== 0) throw new Error(`ERASE_UNMOUNT_FAILED: ${partition}: ${result.stderr.trim()}`);
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${bytes} bytes`;
}

/**
 * CSPRNG overwrite of a removable flash device (NIST SP 800-88 Clear).
 *
 * `dryRun` writes a real CSPRNG stream to a scratch file so the flow can be
 * demonstrated and tested without destroying anything. The live path requires
 * elevation, takes the disk offline (Windows) / unmounts it (Linux), then
 * overwrites every sector in one pass.
 */
export async function csprngEraseDevice(
  device: string,
  options: CsprngEraseOptions,
  onProgress: (event: EraseProgressEvent) => void,
): Promise<EraseResult> {
  if (options.confirmation !== device) throw new Error('ERASE_CONFIRMATION_MISMATCH');
  const target = await requireEligibleDevice(device);
  const forward = (progress: OverwriteProgress, statusText: string) =>
    onProgress({ device, method: METHOD, percent: progress.percent, statusText });

  if (options.dryRun) {
    const sample = Math.min(target.sizeBytes, DRY_RUN_SAMPLE_BYTES);
    const directory = await mkdtemp(path.join(tmpdir(), 'csprng-dry-'));
    const scratch = path.join(directory, 'sample.bin');
    try {
      const handle = await open(scratch, 'w');
      await handle.truncate(sample);
      await handle.close();
      onProgress({ device, method: METHOD, percent: 0,
        statusText: `Dry run: CSPRNG overwrite of a ${formatBytes(sample)} sample — the device (${formatBytes(target.sizeBytes)}) is not touched` });
      await overwriteTarget(scratch, sample, (progress) => forward(progress, 'Dry run: writing CSPRNG sample'));
      const auditLogPath = await appendAudit({ device, method: METHOD, mode: 'dry_run', model: target.model,
        serial: target.serial, deviceBytes: target.sizeBytes, sampleBytes: sample, finalStatus: 'dry_run_completed' });
      onProgress({ device, method: METHOD, percent: 100, statusText: 'Dry run complete — no data on the device was changed' });
      return { device, method: METHOD, assurance: 'clear', completedAt: new Date().toISOString(), auditLogPath };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  // We do NOT hard-block on an elevation pre-check — any probe can be wrong and
  // wrongly block a genuinely-elevated app. If the process is not actually
  // elevated, taking the disk offline / the raw write below fails cleanly with a
  // clear access-denied error instead.
  await appendAudit({ device, method: METHOD, mode: 'live', model: target.model, serial: target.serial,
    deviceBytes: target.sizeBytes, action: 'start' });
  if (process.platform === 'linux') await unmountLinuxDevice(device);
  else if (process.platform !== 'win32') throw new Error('ERASE_UNSUPPORTED_PLATFORM');
  // On Windows the raw-write engine locks + dismounts the target's volumes
  // itself and holds the lock for the whole write — `Set-Disk -IsOffline` does
  // not reliably free a removable USB drive, so the raw open was refused.

  onProgress({ device, method: METHOD, percent: 0, statusText: 'Overwriting every sector with CSPRNG data' });
  await overwriteTarget(device, target.sizeBytes, (progress) => forward(progress, 'Writing CSPRNG data across the device'));

  const auditLogPath = await appendAudit({ device, method: METHOD, mode: 'live', model: target.model,
    serial: target.serial, deviceBytes: target.sizeBytes, finalStatus: 'completed' });
  onProgress({ device, method: METHOD, percent: 100, statusText: 'CSPRNG overwrite complete (NIST 800-88 Clear)' });
  return { device, method: METHOD, assurance: 'clear', completedAt: new Date().toISOString(), auditLogPath };
}

export { isElevated };
