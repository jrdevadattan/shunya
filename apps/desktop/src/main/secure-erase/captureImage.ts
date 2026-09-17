import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import path from 'node:path';
import { appendAudit } from './audit.js';
import { listBlockDevices } from './blockDevices.js';
import type { BlockDevice, CaptureProgressEvent, CaptureResult } from './types.js';
import { windowsCaptureImage, type CaptureProgress } from './windowsRawRead.js';

export interface CaptureImageOptions {
  /** Absolute path of the .raw/.dd image to write. */
  imagePath: string;
  /** Cap the capture to a leading portion (bytes). Null/undefined = whole device. */
  maxBytes?: number | null;
}

const SECTOR_ALIGN = 4 * 1024 * 1024;

/** Resolves the source only if it exists and is a removable device that is not
 * the system disk — a read-only capture never modifies it, but we still refuse
 * the OS disk and fixed media to keep this a safe, demo-friendly evidence tool. */
async function requireCaptureableDevice(device: string): Promise<BlockDevice> {
  const devices = await listBlockDevices();
  const match = devices.find((candidate) => candidate.device === device);
  if (!match) throw new Error('CAPTURE_DEVICE_NOT_FOUND');
  if (match.system) throw new Error('CAPTURE_SYSTEM_DEVICE_BLOCKED');
  if (!match.removable) throw new Error('CAPTURE_NON_REMOVABLE_DEVICE_BLOCKED');
  if (!Number.isSafeInteger(match.sizeBytes) || match.sizeBytes <= 0) throw new Error('CAPTURE_DEVICE_SIZE_UNKNOWN');
  return match;
}

function run(executable: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true });
    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.once('error', () => resolve(''));
    child.once('close', () => resolve(stdout));
  });
}

/** Drive letters mounted on the given Windows physical disk, e.g. ['D']. */
async function windowsDriveLetters(device: string): Promise<string[]> {
  const digits = device.match(/physicaldrive(\d+)$/i)?.[1];
  if (!digits) return [];
  const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `(Get-Partition -DiskNumber ${Number.parseInt(digits, 10)} -ErrorAction SilentlyContinue | Where-Object { $_.DriveLetter } | ForEach-Object { [string]$_.DriveLetter }) -join ','`]);
  return out.trim().split(',').map((letter) => letter.trim().toUpperCase()).filter(Boolean);
}

/**
 * Read-only capture of a removable device to a `.raw` image (forensic imaging).
 * The source is opened read-only, so the evidence is never modified, and a
 * SHA-256 of the image is recorded. On Windows this needs the app elevated.
 */
export async function captureDeviceImage(
  device: string,
  options: CaptureImageOptions,
  onProgress: (event: CaptureProgressEvent) => void,
): Promise<CaptureResult> {
  const target = await requireCaptureableDevice(device);
  const imagePath = options.imagePath;
  if (typeof imagePath !== 'string' || imagePath.trim().length === 0) throw new Error('CAPTURE_INVALID_OUTPUT_PATH');

  // Refuse to write the image onto the very drive we are imaging.
  if (process.platform === 'win32') {
    const letters = await windowsDriveLetters(device);
    const outLetter = path.parse(path.resolve(imagePath)).root.replace(/[:\\/]/g, '').toUpperCase();
    if (outLetter && letters.includes(outLetter)) {
      throw new Error('CAPTURE_OUTPUT_ON_SOURCE: Choose an output file on a different drive than the one you are imaging.');
    }
  }

  // Whole device, or a sector-aligned leading slice when a cap is given.
  let totalBytes = target.sizeBytes;
  if (options.maxBytes && options.maxBytes > 0) {
    const aligned = Math.floor(options.maxBytes / SECTOR_ALIGN) * SECTOR_ALIGN;
    totalBytes = Math.min(target.sizeBytes, Math.max(SECTOR_ALIGN, aligned));
  }
  const truncated = totalBytes < target.sizeBytes;

  await appendAudit({ device, action: 'capture_start', model: target.model, serial: target.serial,
    deviceBytes: target.sizeBytes, captureBytes: totalBytes, truncated, imagePath });

  const forward = (progress: CaptureProgress) => onProgress({
    device,
    percent: progress.percent,
    statusText: `Imaging ${target.model} read-only — ${(progress.bytesCaptured / 1024 ** 3).toFixed(2)} of ${(progress.totalBytes / 1024 ** 3).toFixed(2)} GB`,
  });

  onProgress({ device, percent: 0, statusText: 'Opening device read-only…' });

  let sha256: string;
  let bytesCaptured: number;
  if (process.platform === 'win32') {
    const result = await windowsCaptureImage(device, imagePath, totalBytes, { onProgress: forward });
    sha256 = result.sha256;
    bytesCaptured = result.bytesCaptured;
  } else {
    ({ sha256, bytesCaptured } = await captureViaNode(device, imagePath, totalBytes, forward));
  }

  const completedAt = new Date().toISOString();
  const auditLogPath = await appendAudit({ device, action: 'capture_complete', model: target.model,
    serial: target.serial, imagePath, bytesCaptured, sha256, truncated, finalStatus: 'completed' });
  onProgress({ device, percent: 100, statusText: `Image captured — SHA-256 ${sha256.slice(0, 16)}…` });

  return { device, model: target.model, imagePath, bytesCaptured, sha256, truncated, completedAt, auditLogPath };
}

/** Linux/other: stream the block device to the image file with Node fs. */
async function captureViaNode(
  device: string,
  imagePath: string,
  totalBytes: number,
  onProgress: (progress: CaptureProgress) => void,
): Promise<{ sha256: string; bytesCaptured: number }> {
  const hash = createHash('sha256');
  const outHandle = await open(imagePath, 'w');
  let captured = 0;
  let lastReport = 0;
  try {
    const reader = createReadStream(device, { highWaterMark: SECTOR_ALIGN, end: totalBytes - 1 });
    for await (const chunk of reader) {
      const buffer = chunk as Buffer;
      await outHandle.write(buffer);
      hash.update(buffer);
      captured += buffer.length;
      if (captured - lastReport >= 32 * 1024 * 1024 || captured >= totalBytes) {
        lastReport = captured;
        onProgress({ bytesCaptured: captured, totalBytes, percent: (captured / totalBytes) * 100 });
      }
    }
    await outHandle.sync().catch(() => undefined);
  } finally {
    await outHandle.close().catch(() => undefined);
  }
  return { sha256: hash.digest('hex'), bytesCaptured: captured };
}
