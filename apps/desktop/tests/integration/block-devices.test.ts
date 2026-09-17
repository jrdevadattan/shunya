import { describe, expect, it } from 'vitest';
import { parseLinuxLsblk, parseWindowsDisks } from '../../src/main/secure-erase/blockDevices.js';

describe('parseWindowsDisks', () => {
  it('maps disks, flags the system disk, and marks USB as removable', () => {
    const json = JSON.stringify([
      { number: 0, model: 'NVMe SAMSUNG', sizeBytes: '512110190592', busType: 'NVMe', mediaType: 'SSD', serial: 'ABC.', isSystem: true, isOffline: false },
      { number: 1, model: 'SanDisk Ultra', sizeBytes: '30752636928', busType: 'USB', mediaType: 'Unspecified', serial: '4C53', isSystem: false, isOffline: false },
    ]);
    const devices = parseWindowsDisks(json);
    expect(devices).toHaveLength(2);
    const system = devices[0]!;
    const pen = devices[1]!;
    expect(system.device).toBe('\\\\.\\PhysicalDrive0');
    expect(system.system).toBe(true);
    expect(system.removable).toBe(false);
    expect(pen.device).toBe('\\\\.\\PhysicalDrive1');
    expect(pen.system).toBe(false);
    expect(pen.removable).toBe(true);
    expect(pen.sizeBytes).toBe(30752636928);
    expect(pen.serial).toBe('4C53');
    expect(pen.busType).toBe('USB');
  });

  it('accepts a single-object payload (ConvertTo-Json collapses one item)', () => {
    const json = JSON.stringify({ number: 2, model: 'Lone', sizeBytes: '1000', busType: 'USB', mediaType: '', serial: '', isSystem: false, isOffline: false });
    const devices = parseWindowsDisks(json);
    expect(devices).toHaveLength(1);
    expect(devices[0]!.device).toBe('\\\\.\\PhysicalDrive2');
    expect(devices[0]!.serial).toBeNull();
  });
});

describe('parseLinuxLsblk', () => {
  it('maps disks and flags the disk holding / as system', () => {
    const json = JSON.stringify({
      blockdevices: [
        { name: 'sda', model: 'Samsung SSD', serial: 'S1', size: 512110190592, type: 'disk', tran: 'nvme', rm: false, children: [{ name: 'sda1', type: 'part', mountpoints: ['/'] }] },
        { name: 'sdb', model: 'SanDisk Ultra', serial: 'U1', size: 30752636928, type: 'disk', tran: 'usb', rm: true, children: [{ name: 'sdb1', type: 'part', mountpoints: ['/media/usb'] }] },
      ],
    });
    const devices = parseLinuxLsblk(json);
    expect(devices).toHaveLength(2);
    const sda = devices[0]!;
    const sdb = devices[1]!;
    expect(sda.device).toBe('/dev/sda');
    expect(sda.system).toBe(true);
    expect(sdb.device).toBe('/dev/sdb');
    expect(sdb.system).toBe(false);
    expect(sdb.removable).toBe(true);
    expect(sdb.sizeBytes).toBe(30752636928);
  });
});
