import { ensureNvmeBinary } from './nvmeBinary.js';
import { appendAudit } from './audit.js';
import { runElevated, runUnprivileged, type CommandResult } from './elevation.js';
import type { EraseMethod, EraseOptions, EraseProgressEvent, EraseResult, NvmeDevice, SanitizeCapabilities } from './types.js';

const POLL_MS = 2_000;
const MAX_POLLS = 60 * 60 * 12 / 2;

function parseJson(output: string): Record<string, unknown> { return JSON.parse(output) as Record<string, unknown>; }
function numberField(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, value.startsWith('0x') ? 16 : 10);
  return Number.NaN;
}
function findArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(findArray);
  return [];
}
function stringValue(object: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) if (typeof object[key] === 'string') return object[key] as string;
  return '';
}

export async function listNvmeDevices(): Promise<NvmeDevice[]> {
  const binaryPath = await ensureNvmeBinary();
  const output = await runUnprivileged(binaryPath, ['list', '-o', 'json']);
  if (output.exitCode !== 0) throw new Error(`NVME_LIST_FAILED: ${output.stderr}`);
  return findArray(parseJson(output.stdout)).map((item) => ({
    device: stringValue(item, 'DevicePath', 'Device', 'device'),
    serial: stringValue(item, 'SerialNumber', 'Serial', 'serial_number'),
    model: stringValue(item, 'ModelNumber', 'Model', 'model'),
    firmware: stringValue(item, 'Firmware', 'FirmwareRevision') || null,
    namespaceId: Number.isSafeInteger(numberField(item.Namespace)) ? numberField(item.Namespace) : null,
  })).filter((device) => device.device !== '');
}

export async function getSanitizeCapabilities(device: string): Promise<SanitizeCapabilities> {
  await assertAllowedDevice(device);
  const binaryPath = await ensureNvmeBinary();
  const result = await runElevated(binaryPath, ['id-ctrl', device, '-o', 'json']);
  if (result.exitCode !== 0) throw new Error(`NVME_IDENTIFY_FAILED: ${result.stderr}`);
  const sanicap = numberField(parseJson(result.stdout).sanicap);
  if (!Number.isFinite(sanicap)) throw new Error('NVME_IDENTIFY_INVALID_SANICAP');
  // NVMe SANICAP: bit 0 crypto erase, bit 1 block erase, bit 2 overwrite.
  return { cryptoErase: (sanicap & 1) !== 0, blockErase: (sanicap & 2) !== 0, overwrite: (sanicap & 4) !== 0 };
}

export async function eraseDevice(device: string, options: EraseOptions, onProgress: (event: EraseProgressEvent) => void): Promise<EraseResult> {
  if (options.confirmation !== device) throw new Error('ERASE_CONFIRMATION_MISMATCH');
  const selected = await assertAllowedDevice(device);
  await assertNotSystemDevice(selected);
  const capabilities = await getSanitizeCapabilities(device);
  const binaryPath = await ensureNvmeBinary();
  const attempts: Array<[EraseMethod, number]> = [];
  if (capabilities.cryptoErase) attempts.push(['sanitize_crypto_erase', 4]);
  if (capabilities.blockErase) attempts.push(['sanitize_block_erase', 2]);
  let lastError = 'No supported sanitize action';
  for (const [method, sanact] of attempts) {
    try { return await runSanitize(binaryPath, device, method, sanact, onProgress); }
    catch (cause) { lastError = cause instanceof Error ? cause.message : String(cause); }
  }
  if (!options.allowFormatFallback) throw new Error(`NVME_SANITIZE_FAILED: ${lastError}`);
  if (selected.namespaceId === null) throw new Error('NVME_NAMESPACE_UNKNOWN: format fallback requires a verified namespace');
  const method: EraseMethod = 'format_user_data_erase';
  onProgress({ device, method, percent: null, statusText: 'Starting lower-assurance Format NVM user-data erase' });
  const result = await runElevated(binaryPath, ['format', device, '--namespace-id', String(selected.namespaceId), '--ses=1']);
  const auditLogPath = await appendAudit({ device, binaryPath, method, exitCode: result.exitCode, finalStatus: result.exitCode === 0 ? 'completed_lower_assurance' : 'failed', stderr: result.stderr });
  if (result.exitCode !== 0) throw new Error(`NVME_FORMAT_FAILED: ${result.stderr}`);
  return { device, method, assurance: 'lower_assurance', completedAt: new Date().toISOString(), auditLogPath };
}

async function runSanitize(binaryPath: string, device: string, method: EraseMethod, sanact: number, onProgress: (event: EraseProgressEvent) => void): Promise<EraseResult> {
  onProgress({ device, method, percent: 0, statusText: 'Submitting NVMe sanitize command' });
  const submitted = await runElevated(binaryPath, ['sanitize', device, `--sanact=${sanact}`]);
  await appendAudit({ device, binaryPath, method, action: 'submit', exitCode: submitted.exitCode, stderr: submitted.stderr });
  if (submitted.exitCode !== 0) throw new Error(`NVME_SANITIZE_SUBMIT_FAILED: ${submitted.stderr}`);
  for (let poll = 0; poll < MAX_POLLS; poll += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_MS));
    const status = await runElevated(binaryPath, ['sanitize-log', device, '-o', 'json']);
    if (status.exitCode !== 0) throw new Error(`NVME_SANITIZE_LOG_FAILED: ${status.stderr}`);
    const log = parseJson(status.stdout);
    // NVMe sanitize log: SSTAT bits [2:0] are state; SPROG is 0..65536 progress.
    const sstat = numberField(log.sstat) & 0x7;
    const progress = numberField(log.sprog);
    const percent = Number.isFinite(progress) ? Math.min(100, Math.max(0, (progress / 65536) * 100)) : null;
    if (sstat === 2) { onProgress({ device, method, percent, statusText: 'Sanitize in progress' }); continue; }
    const finalStatus = sstat === 1 || sstat === 4 ? 'completed' : 'failed';
    const auditLogPath = await appendAudit({ device, binaryPath, method, action: 'sanitize-log', finalStatus, sstat, sprog: progress });
    if (finalStatus === 'failed') throw new Error(`NVME_SANITIZE_FAILED: controller status ${sstat}`);
    onProgress({ device, method, percent: 100, statusText: sstat === 4 ? 'Completed; deallocation verification not reported' : 'Completed successfully' });
    return { device, method, assurance: 'purge', completedAt: new Date().toISOString(), auditLogPath };
  }
  throw new Error('NVME_SANITIZE_TIMEOUT');
}

async function assertAllowedDevice(device: string): Promise<NvmeDevice> {
  const match = (await listNvmeDevices()).find((item) => item.device === device);
  if (!match) throw new Error('NVME_DEVICE_NOT_ALLOWLISTED');
  return match;
}

async function assertNotSystemDevice(device: NvmeDevice): Promise<void> {
  if (process.platform === 'linux') {
    const mount = await runUnprivileged('/usr/bin/findmnt', ['-no', 'SOURCE', '/']);
    if (mount.exitCode !== 0 || !mount.stdout.trim()) throw new Error('ERASE_SYSTEM_DEVICE_UNVERIFIED');
    const rootSource = mount.stdout.trim();
    const parents = await runUnprivileged('/usr/bin/lsblk', ['-no', 'PKNAME', rootSource]);
    if (parents.exitCode !== 0) throw new Error('ERASE_SYSTEM_DEVICE_UNVERIFIED');
    const backingNames = [rootSource, ...parents.stdout.split(/\r?\n/).filter(Boolean)].map((value) => value.startsWith('/dev/') ? value : `/dev/${value}`);
    if (backingNames.some((value) => value.startsWith(device.device))) throw new Error('ERASE_SYSTEM_DEVICE_BLOCKED');
  }
  if (process.platform === 'win32') {
    // Read-only mapping of the Windows system volume to its physical disk. This
    // runs before UAC elevation and prevents selecting the live OS device.
    const script = "$letter=$env:SystemDrive.TrimEnd(':'); (Get-Partition -DriveLetter $letter | Get-Disk | Select-Object -First 1 -ExpandProperty Number)";
    const systemDisk = await runUnprivileged('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
    const systemNumber = systemDisk.exitCode === 0 ? Number.parseInt(systemDisk.stdout.trim(), 10) : Number.NaN;
    const targetNumber = Number.parseInt(device.device.match(/physicaldrive(\d+)$/i)?.[1] ?? '', 10);
    if (!Number.isFinite(systemNumber) || !Number.isFinite(targetNumber)) throw new Error('ERASE_SYSTEM_DEVICE_UNVERIFIED');
    if (systemNumber === targetNumber) {
      throw new Error('ERASE_SYSTEM_DEVICE_BLOCKED');
    }
  }
}
