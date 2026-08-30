import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
const showOpenDialog = vi.fn();
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => handlers.set(channel, handler)) },
  BrowserWindow: { fromWebContents: vi.fn(() => null) },
  dialog: { showOpenDialog },
}));
vi.mock('../../src/main/security.js', () => ({ validateIpcSender: vi.fn() }));

describe('main IPC schema boundary', () => {
  beforeEach(() => handlers.clear());

  afterEach(() => {
    showOpenDialog.mockReset();
  });

  it('rejects malformed renderer params before the daemon request', async () => {
    const request = vi.fn();
    const { registerIpcHandlers } = await import('../../src/main/ipc-handlers.js');
    registerIpcHandlers({ request } as never);
    await expect(handlers.get('job.status')?.({}, { jobId: '' })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects malformed daemon results before returning them to IPC', async () => {
    const request = vi.fn().mockResolvedValue([]);
    const { registerIpcHandlers } = await import('../../src/main/ipc-handlers.js');
    registerIpcHandlers({ request } as never);
    await expect(handlers.get('job.status')?.({}, { jobId: 'job-live' })).rejects.toThrow();
  });

  it('inspects only the folder returned by the native dialog and excludes files', async () => {
    const parent = await mkdtemp(path.join(tmpdir(), 'workspace-inspection-'));
    const selected = path.join(parent, 'selected');
    const ignored = path.join(parent, 'renderer-supplied');
    await mkdir(path.join(selected, 'Evidence', 'Cases'), { recursive: true });
    await mkdir(ignored);
    await writeFile(path.join(selected, 'manifest.json'), '{}');
    showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [selected] });
    const { registerIpcHandlers } = await import('../../src/main/ipc-handlers.js');
    registerIpcHandlers();
    try {
      const result = await handlers.get('dialog.choose_workspace')?.({ sender: {} }, { path: ignored });
      expect(result).toMatchObject({
        selectedPath: selected,
        totalBytes: expect.stringMatching(/^\d+$/),
        freeBytes: expect.stringMatching(/^\d+$/),
        directories: [{
          name: 'Evidence', relativePath: 'Evidence', childrenOmitted: false,
          children: [{ name: 'Cases', relativePath: 'Evidence/Cases', children: [], childrenOmitted: false }],
        }],
        truncated: false,
      });
      expect(JSON.stringify(result)).not.toContain('manifest.json');
      expect(JSON.stringify(result)).not.toContain(ignored);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('returns null when native folder selection is cancelled', async () => {
    showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    const { registerIpcHandlers } = await import('../../src/main/ipc-handlers.js');
    registerIpcHandlers();

    await expect(handlers.get('dialog.choose_workspace')?.({ sender: {} }, {})).resolves.toBeNull();
  });

  it('bounds dialog-scoped directory traversal by depth and total entry count', async () => {
    const parent = await mkdtemp(path.join(tmpdir(), 'workspace-bounds-'));
    const selected = path.join(parent, 'selected');
    await mkdir(path.join(selected, 'deep-1', 'deep-2', 'deep-3', 'deep-4'), { recursive: true });
    await Promise.all(Array.from({ length: 230 }, (_, index) => mkdir(path.join(selected, `folder-${String(index).padStart(3, '0')}`))));
    showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [selected] });
    const { registerIpcHandlers } = await import('../../src/main/ipc-handlers.js');
    registerIpcHandlers();
    try {
      const result = await handlers.get('dialog.choose_workspace')?.({ sender: {} }, {}) as {
        directories: Array<{ relativePath: string; children: unknown[] }>;
        truncated: boolean;
      };
      const flatten = (nodes: Array<{ relativePath: string; children: unknown[] }>): string[] => nodes.flatMap((node) => [
        node.relativePath,
        ...flatten(node.children as Array<{ relativePath: string; children: unknown[] }>),
      ]);
      const relativePaths = flatten(result.directories);
      expect(relativePaths.length).toBeLessThanOrEqual(200);
      expect(Math.max(...relativePaths.map((entry) => entry.split('/').length))).toBeLessThanOrEqual(3);
      expect(result.truncated).toBe(true);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('returns a typed useful error when the selected folder cannot be read', async () => {
    const { inspectWorkspaceSelection } = await import('../../src/main/ipc-handlers.js');
    const permissionError = Object.assign(new Error('access denied'), { code: 'EACCES' });

    await expect(inspectWorkspaceSelection('D:/restricted', {
      statfs: vi.fn().mockRejectedValue(permissionError),
      readdir: vi.fn(),
      lstat: vi.fn(),
      realpath: vi.fn(),
    })).rejects.toThrow(
      'WORKSPACE_PERMISSION_DENIED: The selected folder could not be inspected. Choose a folder you have permission to read.',
    );
  });

  it('omits directory-like entries whose canonical target escapes the selected root', async () => {
    const { inspectWorkspaceSelection } = await import('../../src/main/ipc-handlers.js');
    const selected = path.resolve('dialog-selected');
    const outside = path.resolve('outside-selected-root');
    const directory = (name: string) => ({ name, isDirectory: () => true });

    const result = await inspectWorkspaceSelection(selected, {
      statfs: vi.fn().mockResolvedValue({ bsize: 1n, blocks: 1000n, bavail: 600n }),
      lstat: vi.fn().mockResolvedValue({ isDirectory: () => true, isSymbolicLink: () => false }),
      realpath: vi.fn(async (candidate: string) => candidate === path.join(selected, 'escape') ? outside : candidate),
      readdir: vi.fn(async (candidate: string) => candidate === selected
        ? [directory('escape'), directory('safe')]
        : candidate === path.join(selected, 'escape') ? [directory('stolen')] : []),
    } as never);

    expect(result.directories.map((entry) => entry.name)).toEqual(['safe']);
    expect(JSON.stringify(result)).not.toContain('stolen');
  });

  it('omits symbolic directory entries even when their target stays inside the selected root', async () => {
    const { inspectWorkspaceSelection } = await import('../../src/main/ipc-handlers.js');
    const selected = path.resolve('dialog-selected');
    const directory = (name: string) => ({ name, isDirectory: () => true });

    const result = await inspectWorkspaceSelection(selected, {
      statfs: vi.fn().mockResolvedValue({ bsize: 1n, blocks: 1000n, bavail: 600n }),
      lstat: vi.fn(async (candidate: string) => ({ isDirectory: () => true, isSymbolicLink: () => candidate.endsWith('linked') })),
      realpath: vi.fn(async (candidate: string) => candidate === path.join(selected, 'linked') ? path.join(selected, 'target') : candidate),
      readdir: vi.fn(async (candidate: string) => candidate === selected ? [directory('linked'), directory('target')] : []),
    } as never);

    expect(result.directories.map((entry) => entry.name)).toEqual(['target']);
  });

  it('omits directory entries whose canonical target was already visited', async () => {
    const { inspectWorkspaceSelection } = await import('../../src/main/ipc-handlers.js');
    const selected = path.resolve('dialog-selected');
    const directory = (name: string) => ({ name, isDirectory: () => true });

    const result = await inspectWorkspaceSelection(selected, {
      statfs: vi.fn().mockResolvedValue({ bsize: 1n, blocks: 1000n, bavail: 600n }),
      lstat: vi.fn().mockResolvedValue({ isDirectory: () => true, isSymbolicLink: () => false }),
      realpath: vi.fn(async (candidate: string) => candidate === path.join(selected, 'cycle') ? selected : candidate),
      readdir: vi.fn(async (candidate: string) => candidate === selected ? [directory('cycle'), directory('safe')] : []),
    } as never);

    expect(result.directories.map((entry) => entry.name)).toEqual(['safe']);
  });
});
