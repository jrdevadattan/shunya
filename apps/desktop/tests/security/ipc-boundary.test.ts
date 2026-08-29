import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => handlers.set(channel, handler)) },
}));
vi.mock('../../src/main/security.js', () => ({ validateIpcSender: vi.fn() }));

describe('main IPC schema boundary', () => {
  beforeEach(() => handlers.clear());

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
});
