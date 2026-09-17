import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface CaptureProgress {
  bytesCaptured: number;
  totalBytes: number;
  percent: number;
}

export interface WindowsCaptureOptions {
  chunkSize?: number;
  onProgress?: (progress: CaptureProgress) => void;
}

export interface WindowsCaptureResult {
  bytesCaptured: number;
  sha256: string;
}

const DEFAULT_CHUNK = 4 * 1024 * 1024;

/**
 * Read-only capture of a raw device (`\\.\PhysicalDriveN`) to a `.raw`/`.dd`
 * image file, via a .NET device handle. This is the imaging step of a forensic
 * workflow: the source is opened GENERIC_READ only, so the evidence device is
 * never modified (read-only chain of custody). A SHA-256 of the whole image is
 * computed as it streams, for tamper-evidence. Requires the process to be
 * elevated (opening a physical drive needs admin on Windows).
 */
const PS_WRAPPER = String.raw`param(
  [Parameter(Mandatory=$true)][string]$Source,
  [Parameter(Mandatory=$true)][string]$Output,
  [Parameter(Mandatory=$true)][long]$TotalBytes,
  [Parameter(Mandatory=$true)][int]$ChunkSize
)
$ErrorActionPreference = 'Stop'
$src = @"
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using Microsoft.Win32.SafeHandles;

public static class RawRead {
  const uint GENERIC_READ = 0x80000000;
  const uint FILE_SHARE_READ = 0x00000001;
  const uint FILE_SHARE_WRITE = 0x00000002;
  const uint OPEN_EXISTING = 3;
  const uint FILE_FLAG_SEQUENTIAL_SCAN = 0x08000000;

  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern SafeFileHandle CreateFile(string lpFileName, uint dwDesiredAccess, uint dwShareMode,
    IntPtr lpSecurityAttributes, uint dwCreationDisposition, uint dwFlagsAndAttributes, IntPtr hTemplateFile);

  public static void Run(string source, string output, long totalBytes, int chunkSize) {
    SafeFileHandle src = CreateFile(source, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE,
      IntPtr.Zero, OPEN_EXISTING, FILE_FLAG_SEQUENTIAL_SCAN, IntPtr.Zero);
    if (src.IsInvalid) throw new Exception("Could not open " + source + " for reading (Win32 error " + Marshal.GetLastWin32Error() + ")");
    byte[] buffer = new byte[chunkSize];
    using (FileStream input = new FileStream(src, FileAccess.Read, chunkSize, false))
    using (FileStream outFs = new FileStream(output, FileMode.Create, FileAccess.Write, FileShare.None, 1048576, FileOptions.None))
    using (SHA256 sha = SHA256.Create()) {
      long copied = 0;
      long lastReport = -1;
      while (copied < totalBytes) {
        long remaining = totalBytes - copied;
        int want = remaining < (long)chunkSize ? (int)remaining : chunkSize;
        int n = input.Read(buffer, 0, want);
        if (n <= 0) break;
        outFs.Write(buffer, 0, n);
        sha.TransformBlock(buffer, 0, n, null, 0);
        copied += n;
        if (copied - lastReport >= (32L * 1024 * 1024) || copied >= totalBytes) {
          lastReport = copied;
          Console.Out.WriteLine("PROGRESS " + copied + " " + totalBytes);
          Console.Out.Flush();
        }
      }
      sha.TransformFinalBlock(new byte[0], 0, 0);
      outFs.Flush();
      string hex = BitConverter.ToString(sha.Hash).Replace("-", "").ToLowerInvariant();
      Console.Out.WriteLine("SHA256 " + hex);
      Console.Out.WriteLine("BYTES " + copied);
      Console.Out.WriteLine("DONE");
      Console.Out.Flush();
    }
  }
}
"@
Add-Type -TypeDefinition $src -Language CSharp
[RawRead]::Run($Source, $Output, $TotalBytes, $ChunkSize)
`;

function friendlyWin32(detail: string): string | null {
  if (/Win32 error 5\b|Access is denied|UnauthorizedAccess/i.test(detail)) {
    return 'Windows refused read access to the drive (error 5). Imaging a physical device needs the app running as Administrator — close it and relaunch as Administrator, then try again.';
  }
  if (/Win32 error 21\b|not ready/i.test(detail)) {
    return 'The drive is not ready (error 21). Re-seat the USB drive and try again.';
  }
  if (/Win32 error 32\b|being used by another process|sharing violation/i.test(detail)) {
    return 'The drive is in use by another process (error 32). Close any window using it and try again.';
  }
  return null;
}

/** Read-only capture of `source` (a `\\.\PhysicalDriveN` path) into the `.raw`
 * file `output`, streaming progress and returning the image's SHA-256. */
export async function windowsCaptureImage(
  source: string,
  output: string,
  totalBytes: number,
  options: WindowsCaptureOptions = {},
): Promise<WindowsCaptureResult> {
  if (!Number.isSafeInteger(totalBytes) || totalBytes <= 0) throw new Error('CAPTURE_INVALID_SIZE');
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK;
  const directory = await mkdtemp(path.join(tmpdir(), 'rawread-'));
  const scriptPath = path.join(directory, 'raw-read.ps1');
  await writeFile(scriptPath, PS_WRAPPER, 'utf8');

  try {
    return await new Promise<WindowsCaptureResult>((resolve, reject) => {
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath,
          '-Source', source, '-Output', output, '-TotalBytes', String(totalBytes), '-ChunkSize', String(chunkSize)],
        { shell: false, windowsHide: true },
      );

      let stdoutBuffer = '';
      let stderr = '';
      let sha256 = '';
      let bytes = 0;
      let done = false;

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString();
        let newlineIndex = stdoutBuffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const line = stdoutBuffer.slice(0, newlineIndex).trim();
          stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
          if (line.startsWith('PROGRESS ')) {
            const parts = line.split(/\s+/);
            const captured = Number(parts[1]);
            const total = Number(parts[2]) || totalBytes;
            if (Number.isFinite(captured)) {
              bytes = captured;
              options.onProgress?.({ bytesCaptured: captured, totalBytes: total, percent: (captured / total) * 100 });
            }
          } else if (line.startsWith('SHA256 ')) {
            sha256 = line.slice('SHA256 '.length).trim();
          } else if (line.startsWith('BYTES ')) {
            bytes = Number(line.slice('BYTES '.length).trim()) || bytes;
          } else if (line === 'DONE') {
            done = true;
          }
          newlineIndex = stdoutBuffer.indexOf('\n');
        }
      });

      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
      child.once('error', reject);
      child.once('close', (code) => {
        if (code === 0 && done && sha256) {
          resolve({ bytesCaptured: bytes || totalBytes, sha256 });
          return;
        }
        const detail = stderr.trim();
        const friendly = friendlyWin32(detail);
        reject(new Error(friendly ?? (detail ? `The capture could not be completed: ${detail}` : `The capture failed (exit code ${code}).`)));
      });
    });
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}
