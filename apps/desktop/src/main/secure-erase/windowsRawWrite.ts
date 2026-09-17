import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { OverwriteProgress } from './csprngOverwrite.js';

export interface WindowsOverwriteOptions {
  /** Bytes per write. Must be a multiple of the sector size (4 MiB is a multiple
   * of both 512 and 4096). */
  chunkSize?: number;
  onProgress?: (progress: OverwriteProgress) => void;
}

const DEFAULT_CHUNK = 4 * 1024 * 1024;

/**
 * The .NET program that performs the overwrite, compiled at runtime by
 * PowerShell's `Add-Type`. Node's own `fs` cannot do positioned writes to a raw
 * `\\.\PhysicalDriveN` handle on Windows (it fails with EBADF).
 *
 * The correct Windows recipe for writing a raw removable disk (used by Rufus,
 * dd-for-windows, etc.) is:
 *   1. For every mounted volume on the target disk: open `\\.\X:`, then
 *      FSCTL_LOCK_VOLUME + FSCTL_DISMOUNT_VOLUME, and KEEP that handle open so
 *      the lock is held for the whole write. `Set-Disk -IsOffline` alone does
 *      not reliably free a USB drive, which is why the raw open was refused.
 *   2. Open `\\.\PhysicalDriveN` with GENERIC_WRITE + FILE_SHARE_READ|WRITE +
 *      FILE_FLAG_WRITE_THROUGH and write sector-aligned chunks.
 *   3. Release the volume locks.
 *
 * Overwrite bytes come from the OS CSPRNG (`RNGCryptoServiceProvider` /
 * BCryptGenRandom, an AES-256 CTR_DRBG per NIST SP 800-90A), so it stays a
 * genuine single-pass CSPRNG overwrite (NIST SP 800-88 Clear), consistent with
 * the cross-platform AES-256-CTR engine used on Linux and in tests.
 */
const PS_WRAPPER = String.raw`param(
  [Parameter(Mandatory=$true)][string]$Target,
  [Parameter(Mandatory=$true)][long]$TotalBytes,
  [Parameter(Mandatory=$true)][int]$ChunkSize
)
$ErrorActionPreference = 'Stop'
$volumes = ''
if ($Target -match 'PhysicalDrive(\d+)') {
  $diskNum = [int]$Matches[1]
  try {
    $volumes = (Get-Partition -DiskNumber $diskNum -ErrorAction SilentlyContinue |
      Where-Object { $_.DriveLetter } | ForEach-Object { [string]$_.DriveLetter }) -join ','
  } catch { $volumes = '' }
}
$src = @"
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Threading;
using Microsoft.Win32.SafeHandles;

public static class RawWipe {
  const uint GENERIC_READ = 0x80000000;
  const uint GENERIC_WRITE = 0x40000000;
  const uint FILE_SHARE_READ = 0x00000001;
  const uint FILE_SHARE_WRITE = 0x00000002;
  const uint OPEN_EXISTING = 3;
  const uint FILE_FLAG_WRITE_THROUGH = 0x80000000;
  const uint FSCTL_LOCK_VOLUME = 0x00090018;
  const uint FSCTL_DISMOUNT_VOLUME = 0x00090020;

  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern SafeFileHandle CreateFile(string lpFileName, uint dwDesiredAccess, uint dwShareMode,
    IntPtr lpSecurityAttributes, uint dwCreationDisposition, uint dwFlagsAndAttributes, IntPtr hTemplateFile);

  [DllImport("kernel32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  static extern bool DeviceIoControl(SafeFileHandle hDevice, uint dwIoControlCode, IntPtr lpInBuffer,
    uint nInBufferSize, IntPtr lpOutBuffer, uint nOutBufferSize, out uint lpBytesReturned, IntPtr lpOverlapped);

  static SafeFileHandle LockVolume(char letter) {
    SafeFileHandle vh = CreateFile("\\\\.\\" + letter + ":", GENERIC_READ | GENERIC_WRITE,
      FILE_SHARE_READ | FILE_SHARE_WRITE, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero);
    if (vh.IsInvalid) throw new Exception("Could not open volume " + letter + ": (Win32 error " + Marshal.GetLastWin32Error() + ")");
    uint br;
    bool locked = false;
    for (int i = 0; i < 20 && !locked; i++) {
      locked = DeviceIoControl(vh, FSCTL_LOCK_VOLUME, IntPtr.Zero, 0, IntPtr.Zero, 0, out br, IntPtr.Zero);
      if (!locked) Thread.Sleep(100);
    }
    DeviceIoControl(vh, FSCTL_DISMOUNT_VOLUME, IntPtr.Zero, 0, IntPtr.Zero, 0, out br, IntPtr.Zero);
    return vh; // keep open so the lock/dismount holds for the whole write
  }

  public static void Run(string target, long totalBytes, int chunkSize, string volumes) {
    List<SafeFileHandle> held = new List<SafeFileHandle>();
    try {
      if (!string.IsNullOrEmpty(volumes)) {
        foreach (string v in volumes.Split(',')) {
          string t = v.Trim();
          if (t.Length == 0) continue;
          held.Add(LockVolume(t[0]));
        }
      }
      SafeFileHandle disk = CreateFile(target, GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE,
        IntPtr.Zero, OPEN_EXISTING, FILE_FLAG_WRITE_THROUGH, IntPtr.Zero);
      if (disk.IsInvalid) throw new Exception("Could not open device " + target + " for writing (Win32 error " + Marshal.GetLastWin32Error() + ")");
      byte[] buffer = new byte[chunkSize];
      using (RNGCryptoServiceProvider rng = new RNGCryptoServiceProvider())
      using (FileStream fs = new FileStream(disk, FileAccess.Write, 1048576, false)) {
        long written = 0;
        long lastReport = -1;
        while (written < totalBytes) {
          long remaining = totalBytes - written;
          int thisChunk = remaining < (long)chunkSize ? (int)remaining : chunkSize;
          rng.GetBytes(buffer);
          fs.Write(buffer, 0, thisChunk);
          written += thisChunk;
          if (written - lastReport >= (64L * 1024 * 1024) || written >= totalBytes) {
            lastReport = written;
            Console.Out.WriteLine("PROGRESS " + written + " " + totalBytes);
            Console.Out.Flush();
          }
        }
        fs.Flush();
      }
      Console.Out.WriteLine("DONE");
      Console.Out.Flush();
    } finally {
      foreach (SafeFileHandle h in held) { try { h.Dispose(); } catch {} }
    }
  }
}
"@
Add-Type -TypeDefinition $src -Language CSharp
try {
  [RawWipe]::Run($Target, $TotalBytes, $ChunkSize, $volumes)
} finally {
  # Windows caches the partition table and keeps showing the old layout after a
  # raw overwrite until the disk is rescanned. Force it here (also after an
  # interrupted or failed write, since partial destruction is real) so Disk
  # Management shows the disk as RAW / unallocated immediately.
  if ($Target -match 'PhysicalDrive(\d+)') {
    try { Update-Disk -Number ([int]$Matches[1]) -ErrorAction SilentlyContinue } catch {}
  }
}
`;

function friendlyWin32(detail: string): string | null {
  if (/Win32 error 5\b|Access is denied|UnauthorizedAccess/i.test(detail)) {
    return 'Windows refused write access to the drive (error 5). Make sure the app is running as Administrator, and close any Explorer/AV window that has the drive open, then try again.';
  }
  if (/Win32 error 32\b|being used by another process|sharing violation/i.test(detail)) {
    return 'The drive is in use by another process (error 32). Close any window or program using it (Explorer, antivirus) and try again.';
  }
  if (/Win32 error 21\b|not ready/i.test(detail)) {
    return 'The drive is not ready (error 21). Re-seat the USB drive and try again.';
  }
  return null;
}

/**
 * CSPRNG overwrite of `target` (a raw device path like `\\.\PhysicalDrive1`, or a
 * scratch file for the dry run) using a .NET device handle. Streams progress as
 * the child writes. For a real device the Electron process must be elevated.
 */
export async function windowsCsprngOverwrite(
  target: string,
  totalBytes: number,
  options: WindowsOverwriteOptions = {},
): Promise<{ bytesWritten: number }> {
  if (!Number.isSafeInteger(totalBytes) || totalBytes <= 0) {
    throw new Error('CSPRNG_OVERWRITE_INVALID_SIZE');
  }
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK;
  const directory = await mkdtemp(path.join(tmpdir(), 'csprng-win-'));
  const scriptPath = path.join(directory, 'raw-wipe.ps1');
  await writeFile(scriptPath, PS_WRAPPER, 'utf8');

  try {
    return await new Promise<{ bytesWritten: number }>((resolve, reject) => {
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath,
          '-Target', target, '-TotalBytes', String(totalBytes), '-ChunkSize', String(chunkSize)],
        { shell: false, windowsHide: true },
      );

      let stdoutBuffer = '';
      let stderr = '';
      let lastBytes = 0;
      let done = false;

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString();
        let newlineIndex = stdoutBuffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const line = stdoutBuffer.slice(0, newlineIndex).trim();
          stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
          if (line.startsWith('PROGRESS ')) {
            const parts = line.split(/\s+/);
            const written = Number(parts[1]);
            const total = Number(parts[2]) || totalBytes;
            if (Number.isFinite(written)) {
              lastBytes = written;
              options.onProgress?.({ bytesWritten: written, totalBytes: total, percent: (written / total) * 100 });
            }
          } else if (line === 'DONE') {
            done = true;
          }
          newlineIndex = stdoutBuffer.indexOf('\n');
        }
      });

      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
      child.once('error', reject);
      child.once('close', (code) => {
        if (code === 0 && done) {
          resolve({ bytesWritten: lastBytes || totalBytes });
          return;
        }
        const detail = stderr.trim();
        const friendly = friendlyWin32(detail);
        if (friendly) {
          reject(new Error(friendly));
          return;
        }
        reject(new Error(detail ? `The wipe could not be completed: ${detail}` : `The wipe failed (exit code ${code}).`));
      });
    });
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}
