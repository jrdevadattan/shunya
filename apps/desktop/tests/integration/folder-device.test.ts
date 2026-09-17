import { describe, expect, it } from 'vitest';
import { matchDevice, resolveFolderDevice } from '../../src/main/secure-erase/folderDevice.js';
import type { BlockDevice } from '../../src/main/secure-erase/types.js';

const devices: BlockDevice[] = [
  { device: '\\\\.\\PhysicalDrive0', model: 'System', serial: null, sizeBytes: 1, busType: 'NVMe', removable: false, system: true },
  { device: '\\\\.\\PhysicalDrive2', model: 'Pendrive', serial: null, sizeBytes: 1, busType: 'USB', removable: true, system: false },
];

describe('folder → device resolution', () => {
  it('matches a disk path case-insensitively and refuses unknown disks', () => {
    expect(matchDevice(devices, '\\\\.\\physicaldrive2').model).toBe('Pendrive');
    expect(() => matchDevice(devices, '\\\\.\\PhysicalDrive7')).toThrow('DELETION_DEVICE_UNRESOLVED');
  });

  // Real-hardware probe: set DELETION_PROBE_DRIVE=E (a plugged-in USB drive letter) to run it.
  const probe = process.env.DELETION_PROBE_DRIVE;
  it.skipIf(!probe || process.platform !== 'win32')('resolves a plugged-in USB drive as removable and the system drive as blocked', async () => {
    const usb = await resolveFolderDevice(`${probe}:\\`);
    expect(usb.device.removable).toBe(true);
    expect(usb.device.system).toBe(false);
    expect(usb.mountRoot).toBe(`${probe!.toUpperCase()}:\\`);
    const system = await resolveFolderDevice('C:\\Users');
    expect(system.device.system).toBe(true);
    console.log(`probe: ${probe}: -> ${usb.device.model} (${usb.device.busType}); C: -> ${system.device.model}`);
  }, 60_000);

  it.skipIf(!probe || process.platform !== 'win32')('securely deletes a scratch folder on the plugged-in USB drive end to end', async () => {
    const { mkdir, writeFile, stat } = await import('node:fs/promises');
    const { executeFolderDeletion, planFolderDeletion } = await import('../../src/main/secure-erase/folderDeletion.js');
    const target = `${probe}:\\shunya-deletion-probe`;
    await mkdir(`${target}\\nested`, { recursive: true });
    await writeFile(`${target}\\one.bin`, Buffer.alloc(256 * 1024, 1));
    await writeFile(`${target}\\nested\\two.txt`, 'probe');
    const audit: Record<string, unknown>[] = [];
    const dependencies = { resolveDevice: resolveFolderDevice, audit: async (entry: Record<string, unknown>) => { audit.push(entry); return 'probe.ndjson'; } };
    const plan = await planFolderDeletion(target, dependencies);
    expect(plan.fileCount).toBe(2);
    expect(plan.device.device.removable).toBe(true);
    const result = await executeFolderDeletion(plan.planId, { confirmation: plan.targetPath }, dependencies);
    expect(result.filesDeleted).toBe(2);
    expect(result.failures).toEqual([]);
    await expect(stat(target)).rejects.toThrow();
    console.log(`probe: deleted ${result.filesDeleted} files (${result.bytesOverwritten} bytes overwritten) from ${plan.device.device.model}`);
  }, 120_000);
});
