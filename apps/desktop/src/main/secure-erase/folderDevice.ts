// Maps a folder path to the physical block device that hosts it, so folder
// deletion can enforce the same "removable media only, never the system disk"
// rule as the whole-device wipe. Nothing here trusts the renderer: the drive
// letter / mount point is derived from the resolved path in the main process.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { listBlockDevices } from './blockDevices.js';
import type { FolderDevice } from './folderDeletion.js';
import type { BlockDevice } from './types.js';

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

/** Pure helper: pick the block device for a disk number / device path. */
export function matchDevice(devices: BlockDevice[], devicePath: string): BlockDevice {
  const match = devices.find((candidate) => candidate.device.toLowerCase() === devicePath.toLowerCase());
  if (!match) throw new Error('DELETION_DEVICE_UNRESOLVED');
  return match;
}

async function windowsFolderDevice(targetPath: string, devices: BlockDevice[]): Promise<FolderDevice> {
  const root = path.parse(path.resolve(targetPath)).root; // e.g. "E:\"
  const letter = /^([A-Za-z]):\\?$/.exec(root)?.[1];
  if (!letter) throw new Error('DELETION_DEVICE_UNRESOLVED');
  const script = `(Get-Partition -DriveLetter ${letter.toUpperCase()} -ErrorAction Stop | Select-Object -First 1).DiskNumber`;
  const result = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  const number = Number.parseInt(result.stdout.trim(), 10);
  if (result.exitCode !== 0 || !Number.isInteger(number)) throw new Error('DELETION_DEVICE_UNRESOLVED');
  return { device: matchDevice(devices, `\\\\.\\PhysicalDrive${number}`), mountRoot: `${letter.toUpperCase()}:\\` };
}

async function linuxFolderDevice(targetPath: string, devices: BlockDevice[]): Promise<FolderDevice> {
  const mount = await run('findmnt', ['-n', '-o', 'SOURCE,TARGET', '--target', targetPath]);
  const [source, mountRoot] = mount.stdout.trim().split(/\s+/);
  if (mount.exitCode !== 0 || !source || !mountRoot) throw new Error('DELETION_DEVICE_UNRESOLVED');
  const parent = await run('lsblk', ['-no', 'PKNAME', source]);
  const disk = parent.stdout.trim().split('\n')[0]?.trim();
  const devicePath = disk ? `/dev/${disk}` : source;
  return { device: matchDevice(devices, devicePath), mountRoot };
}

/** Resolves the removable device hosting `targetPath` or throws a typed error. */
export async function resolveFolderDevice(targetPath: string): Promise<FolderDevice> {
  const devices = await listBlockDevices();
  if (process.platform === 'win32') return windowsFolderDevice(targetPath, devices);
  if (process.platform === 'linux') return linuxFolderDevice(targetPath, devices);
  throw new Error('DELETION_UNSUPPORTED_PLATFORM');
}
