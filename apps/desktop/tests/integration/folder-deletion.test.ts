import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  clearDeletionPlans, executeFolderDeletion, planFolderDeletion,
  type DeletionDependencies, type DeletionProgressEvent, type FolderDevice,
} from '../../src/main/secure-erase/folderDeletion.js';
import type { BlockDevice } from '../../src/main/secure-erase/types.js';

const usb: BlockDevice = { device: '\\\\.\\PhysicalDrive9', model: 'Test USB', serial: 'ABC', sizeBytes: 8 * 1024 ** 3, busType: 'USB', removable: true, system: false };
const systemDisk: BlockDevice = { ...usb, device: '\\\\.\\PhysicalDrive0', model: 'System NVMe', busType: 'NVMe', removable: false, system: true };

function dependencies(device: BlockDevice, mountRoot: string, audit: Record<string, unknown>[] = []): DeletionDependencies & { audit: DeletionDependencies['audit']; entries: Record<string, unknown>[] } {
  return {
    entries: audit,
    resolveDevice: async (): Promise<FolderDevice> => ({ device, mountRoot }),
    audit: async (entry) => { audit.push(entry); return 'C:/audit/secure-erase/test.ndjson'; },
  };
}

const roots: string[] = [];
async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'folder-deletion-'));
  roots.push(root);
  const target = path.join(root, 'Evidence');
  await mkdir(path.join(target, 'nested', 'deeper'), { recursive: true });
  await writeFile(path.join(target, 'a.txt'), Buffer.alloc(300 * 1024, 0x41));
  await writeFile(path.join(target, 'nested', 'b.bin'), Buffer.alloc(70 * 1024, 0x42));
  await writeFile(path.join(target, 'nested', 'deeper', 'c.log'), 'hello world');
  await writeFile(path.join(target, 'empty.dat'), Buffer.alloc(0));
  await writeFile(path.join(target, 'readonly.txt'), 'locked');
  await chmod(path.join(target, 'readonly.txt'), 0o444);
  return target;
}

afterEach(async () => {
  clearDeletionPlans();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('folder-level secure deletion', () => {
  it('plans read-only, then overwrites, renames, unlinks every file and removes the folders', async () => {
    const target = await fixture();
    const deps = dependencies(usb, path.parse(target).root);
    const plan = await planFolderDeletion(target, deps);
    expect(plan.fileCount).toBe(5);
    expect(plan.directoryCount).toBe(2);
    expect(plan.totalBytes).toBe(300 * 1024 + 70 * 1024 + 'hello world'.length + 'locked'.length);
    expect(plan.sample).toContain('a.txt');
    expect(plan.skipped).toEqual([]);
    // Planning is read-only.
    expect((await stat(path.join(target, 'a.txt'))).size).toBe(300 * 1024);

    const events: DeletionProgressEvent[] = [];
    const result = await executeFolderDeletion(plan.planId, { confirmation: plan.targetPath }, deps, (event) => events.push(event));
    expect(result.filesDeleted).toBe(5);
    expect(result.failures).toEqual([]);
    expect(result.bytesOverwritten).toBe(plan.totalBytes);
    expect(result.directoriesRemoved).toBe(3);
    expect(result.assurance).toBe('clear');
    expect(result.auditLogPath).toContain('secure-erase');
    await expect(stat(target)).rejects.toThrow();
    expect(events.at(-1)?.percent).toBe(100);
    expect(events.at(-1)?.filesDone).toBe(5);
    expect(deps.entries.map((entry) => entry.action)).toEqual(['start', 'finish']);
    expect(deps.entries[1]?.finalStatus).toBe('completed');
  });

  it('refuses the system disk, non-removable media, and a drive root', async () => {
    const target = await fixture();
    await expect(planFolderDeletion(target, dependencies(systemDisk, path.parse(target).root))).rejects.toThrow('DELETION_SYSTEM_DEVICE_BLOCKED');
    await expect(planFolderDeletion(target, dependencies({ ...usb, removable: false }, path.parse(target).root))).rejects.toThrow('DELETION_NON_REMOVABLE_BLOCKED');
    await expect(planFolderDeletion(target, dependencies(usb, target))).rejects.toThrow('DELETION_DRIVE_ROOT_BLOCKED');
    await expect(planFolderDeletion(path.join(target, 'a.txt'), dependencies(usb, path.parse(target).root))).rejects.toThrow('DELETION_TARGET_NOT_A_FOLDER');
    await expect(planFolderDeletion(path.join(target, 'missing'), dependencies(usb, path.parse(target).root))).rejects.toThrow('DELETION_TARGET_NOT_FOUND');
  });

  it('requires the exact folder path as confirmation and a plan that still matches the device', async () => {
    const target = await fixture();
    const deps = dependencies(usb, path.parse(target).root);
    const plan = await planFolderDeletion(target, deps);
    await expect(executeFolderDeletion(plan.planId, { confirmation: 'yes' }, deps)).rejects.toThrow('DELETION_CONFIRMATION_MISMATCH');
    await expect(executeFolderDeletion('not-a-plan', { confirmation: plan.targetPath }, deps)).rejects.toThrow('DELETION_PLAN_NOT_FOUND');
    const swapped = dependencies({ ...usb, device: '\\\\.\\PhysicalDrive3' }, path.parse(target).root);
    await expect(executeFolderDeletion(plan.planId, { confirmation: plan.targetPath }, swapped)).rejects.toThrow('DELETION_DEVICE_CHANGED');
    // Nothing was touched by the refused attempts.
    expect((await readFile(path.join(target, 'nested', 'deeper', 'c.log'))).toString()).toBe('hello world');
    expect((await readdir(target)).sort()).toEqual(['a.txt', 'empty.dat', 'nested', 'readonly.txt']);
  });

  it('never follows links: they are skipped and reported, and their parent folder is left in place', async () => {
    const target = await fixture();
    const outside = path.join(path.dirname(target), 'outside');
    await mkdir(outside);
    await writeFile(path.join(outside, 'keep.txt'), 'must survive');
    let linked = true;
    try {
      const { symlink } = await import('node:fs/promises');
      await symlink(outside, path.join(target, 'nested', 'link'), 'junction');
    } catch {
      linked = false; // symlink creation needs privileges on some Windows setups
    }
    if (!linked) return;
    const deps = dependencies(usb, path.parse(target).root);
    const plan = await planFolderDeletion(target, deps);
    // plan.targetPath is the canonical (long-name) form of the temp folder.
    expect(plan.skipped).toEqual([{ path: path.join(plan.targetPath, 'nested', 'link'), reason: 'symlink' }]);
    const result = await executeFolderDeletion(plan.planId, { confirmation: plan.targetPath }, deps);
    expect(result.filesDeleted).toBe(5);
    expect((await readFile(path.join(outside, 'keep.txt'))).toString()).toBe('must survive');
    // The folder holding the link could not be emptied, so it (and the target) remain.
    await expect(stat(path.join(target, 'nested'))).resolves.toBeTruthy();
  });
});
