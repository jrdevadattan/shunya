import { describe, expect, it, vi } from 'vitest';
import { createRecoveryApi, recoveryApiMethodNames } from '../../src/preload/recovery-api.js';

describe('preload API surface', () => {
  it('does not expose generic IPC, filesystem, or command methods', () => {
    expect(recoveryApiMethodNames).not.toContain('send');
    expect(recoveryApiMethodNames).not.toContain('readFile');
    expect(recoveryApiMethodNames).not.toContain('writeFile');
    expect(recoveryApiMethodNames).not.toContain('runCommand');
    expect(recoveryApiMethodNames).not.toContain('openPath');
  });

  it('maps typed job status and event requests without exposing raw IPC', async () => {
    const calls: unknown[][] = [];
    const api = createRecoveryApi({
      invoke: async (...args) => {
        calls.push(args);
        return args[0] === 'job.status' ? {
          jobId: 'job-live', caseId: 'case-live', sourceId: 'source-live', goal: 'recover_everything', preset: 'full', stage: 'completed',
          createdAt: '2026-08-29T12:00:00Z', updatedAt: '2026-08-29T12:00:00Z', limitations: [], partitions: null,
        } : [];
      },
      subscribe: () => () => undefined,
    });
    await api.getJobStatus('job-live');
    await api.listJobEvents('job-live', 42);
    expect(calls).toEqual([
      ['job.status', { jobId: 'job-live' }],
      ['job.events', { jobId: 'job-live', afterSequence: 42 }],
    ]);
  });

  it('maps workspace folder selection through a narrow typed IPC method', async () => {
    const invoke = vi.fn().mockResolvedValue('D:/recovery-cases/case-1');
    const api = createRecoveryApi({ invoke, subscribe: () => () => undefined });
    await expect(api.chooseWorkspaceFolder()).resolves.toBe('D:/recovery-cases/case-1');
    expect(invoke).toHaveBeenCalledWith('dialog.choose_workspace', {});
  });

  it('rejects malformed daemon responses instead of casting unknown values', async () => {
    const api = createRecoveryApi({
      invoke: async () => [],
      subscribe: () => () => undefined,
    });
    await expect(api.getJobStatus('job-live')).rejects.toThrow();
  });

  it('rejects malformed requests before IPC and malformed subscribed events before delivery', async () => {
    const invoke = vi.fn();
    let subscribed: ((payload: unknown) => void) | undefined;
    const listener = vi.fn();
    const api = createRecoveryApi({ invoke, subscribe: (_channel, next) => { subscribed = next; return () => undefined; } });
    await expect(api.getJobStatus('')).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
    api.subscribeJobEvents(listener);
    expect(() => subscribed?.([])).toThrow();
    expect(listener).not.toHaveBeenCalled();
  });
});
