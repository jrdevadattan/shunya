import { spawn } from 'node:child_process';
import type { BlockDevice } from './types.js';

interface CommandResult { exitCode: number; stdout: string; stderr: string; }

function run(executable: string, args: string[]): Promise<CommandResult> {
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

const WINDOWS_DISK_SCRIPT = `$phys = Get-PhysicalDisk
Get-Disk | ForEach-Object {
  $d = $_
  $p = $phys | Where-Object { $_.DeviceId -eq $d.Number } | Select-Object -First 1
  [pscustomobject]@{
    number = $d.Number
    model = "$($d.FriendlyName)"
    sizeBytes = "$($d.Size)"
    busType = "$($d.BusType)"
    mediaType = if ($p) { "$($p.MediaType)" } else { "" }
    serial = if ($p) { "$($p.SerialNumber)" } else { "" }
    isSystem = [bool]($d.IsBoot -or $d.IsSystem)
    isOffline = [bool]$d.IsOffline
  }
} | ConvertTo-Json -Depth 3`;

interface WindowsDiskRow {
  number: number;
  model: string;
  sizeBytes: string;
  busType: string;
  mediaType: string;
  serial: string;
  isSystem: boolean;
  isOffline: boolean;
}

/** Pure parser (unit-testable) for the Windows Get-Disk JSON payload. */
export function parseWindowsDisks(json: string): BlockDevice[] {
  const parsed: unknown = JSON.parse(json);
  const rows: WindowsDiskRow[] = (Array.isArray(parsed) ? parsed : [parsed]) as WindowsDiskRow[];
  return rows
    .filter((row) => Number.isInteger(row.number))
    .map((row) => {
      const busType = (row.busType || '').trim();
      const removable = busType.toUpperCase() === 'USB' || (row.mediaType || '').toUpperCase() === 'REMOVABLE';
      return {
        device: `\\\\.\\PhysicalDrive${row.number}`,
        model: (row.model || `Physical drive ${row.number}`).trim(),
        serial: row.serial?.trim() ? row.serial.trim() : null,
        sizeBytes: Number.parseInt(row.sizeBytes, 10) || 0,
        busType: busType || null,
        removable,
        system: Boolean(row.isSystem),
      } satisfies BlockDevice;
    });
}

interface LsblkNode {
  name: string;
  model?: string | null;
  serial?: string | null;
  size?: number | string | null;
  type?: string;
  tran?: string | null;
  rm?: boolean | string | null;
  mountpoint?: string | null;
  mountpoints?: (string | null)[];
  children?: LsblkNode[];
}

function nodeMountpoints(node: LsblkNode): string[] {
  const single = node.mountpoint ? [node.mountpoint] : [];
  const many = (node.mountpoints ?? []).filter((value): value is string => Boolean(value));
  const child = (node.children ?? []).flatMap(nodeMountpoints);
  return [...single, ...many, ...child];
}

/** Pure parser (unit-testable) for `lsblk -b -d -J` JSON on Linux. */
export function parseLinuxLsblk(json: string): BlockDevice[] {
  const parsed = JSON.parse(json) as { blockdevices?: LsblkNode[] };
  return (parsed.blockdevices ?? [])
    .filter((node) => (node.type ?? 'disk') === 'disk')
    .map((node) => {
      const mounts = nodeMountpoints(node);
      const system = mounts.some((mount) => mount === '/' || mount === '/boot' || mount.startsWith('/boot/'));
      const removable = node.rm === true || node.rm === '1' || (node.tran ?? '').toLowerCase() === 'usb';
      return {
        device: `/dev/${node.name}`,
        model: (node.model ?? node.name).trim() || node.name,
        serial: node.serial?.toString().trim() ? node.serial.toString().trim() : null,
        sizeBytes: typeof node.size === 'number' ? node.size : Number.parseInt(String(node.size ?? '0'), 10) || 0,
        busType: node.tran ? node.tran.toUpperCase() : null,
        removable,
        system,
      } satisfies BlockDevice;
    });
}

/** Enumerate physical block devices with a system-disk flag. Unprivileged. */
export async function listBlockDevices(): Promise<BlockDevice[]> {
  if (process.platform === 'win32') {
    const result = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_DISK_SCRIPT]);
    if (result.exitCode !== 0) throw new Error(`BLOCK_DEVICE_ENUMERATION_FAILED: ${result.stderr.trim()}`);
    return parseWindowsDisks(result.stdout.trim() || '[]');
  }
  if (process.platform === 'linux') {
    const result = await run('lsblk', ['-b', '-d', '-J', '-o', 'NAME,MODEL,SERIAL,SIZE,TYPE,TRAN,RM,MOUNTPOINTS']);
    if (result.exitCode !== 0) throw new Error(`BLOCK_DEVICE_ENUMERATION_FAILED: ${result.stderr.trim()}`);
    return parseLinuxLsblk(result.stdout.trim() || '{"blockdevices":[]}');
  }
  throw new Error('BLOCK_DEVICE_ENUMERATION_UNSUPPORTED_PLATFORM');
}
