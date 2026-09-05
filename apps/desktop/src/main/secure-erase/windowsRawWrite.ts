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
 * The .NET program that actually performs the overwrite, compiled at runtime by
 * PowerShell's `Add-Type`. Node's own `fs` cannot do positioned writes to a raw
 * `\\.\PhysicalDriveN` handle on Windows (it fails with EBADF); a .NET
 * `FileStream` opens the device with the correct share mode + WRITE_THROUGH and
 * issues sector-aligned writes, which Windows supports for raw devices.
 *
 * The overwrite bytes come from `RNGCryptoServiceProvider` — the Windows OS
 * CSPRNG (BCryptGenRandom), which is an AES-256 CTR_DRBG per NIST SP 800-90A.
 * That keeps this a genuine single-pass CSPRNG overwrite (NIST SP 800-88 Clear),
 * consistent with the AES-256-CTR keystream used by the cross-platform engine.
 */
const PS_WRAPPER = String.raw`param(
  [Parameter(Mandatory=$true)][string]$Target,
  [Parameter(Mandatory=$true)][long]$TotalBytes,
  [Parameter(Mandatory=$true)][int]$ChunkSize
)
$ErrorActionPreference = 'Stop'
$src = @"
using System;
using System.IO;
using System.Security.Cryptography;

public static class RawWipe {
  public static void Run(string target, long totalBytes, int chunkSize) {
    byte[] buffer = new byte[chunkSize];
    using (RNGCryptoServiceProvider rng = new RNGCryptoServiceProvider())
    using (FileStream fs = new FileStream(target, FileMode.Open, FileAccess.Write, FileShare.ReadWrite, 1048576, FileOptions.WriteThrough)) {
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
  }
}
"@
Add-Type -TypeDefinition $src -Language CSharp
[RawWipe]::Run($Target, $TotalBytes, $ChunkSize)
`;

/**
 * CSPRNG overwrite of `target` (a raw device path like `\\.\PhysicalDrive1`, or a
 * scratch file for the dry run) using a .NET `FileStream`. Streams progress back
 * as the child writes. Requires the Electron process to be elevated for a real
 * device; a non-elevated attempt surfaces a clear access-denied error.
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
        if (/denied|unauthorized|elevat|administrat|privilege|requires/i.test(detail)) {
          reject(new Error('This wipe needs administrator rights — close the app and relaunch it as Administrator, then try again.'));
          return;
        }
        reject(new Error(detail ? `CSPRNG_OVERWRITE_FAILED: ${detail}` : `CSPRNG_OVERWRITE_FAILED: exited with code ${code}`));
      });
    });
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}
