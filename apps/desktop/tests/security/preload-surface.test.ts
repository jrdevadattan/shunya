import { describe, expect, it, vi } from 'vitest';
import { createRecoveryApi, recoveryApiMethodNames } from '../../src/preload/recovery-api.js';

describe('preload API surface', () => {
  it('does not expose generic IPC, filesystem, or command methods', () => {
    expect(recoveryApiMethodNames).not.toContain('send');
    expect(recoveryApiMethodNames).not.toContain('readFile');
    expect(recoveryApiMethodNames).not.toContain('writeFile');
    expect(recoveryApiMethodNames).not.toContain('runCommand');
    expect(recoveryApiMethodNames).not.toContain('openPath');
    expect(recoveryApiMethodNames).not.toContain('inspectPath');
    expect(recoveryApiMethodNames).not.toContain('listDirectory');
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

  it('maps the daemon-derived current case state through a narrow typed method', async () => {
    const invoke = vi.fn().mockResolvedValue({ sourceId: 'source-live', latestJobId: 'job-live' });
    const api = createRecoveryApi({ invoke, subscribe: () => () => undefined });

    await expect(api.getCaseState()).resolves.toEqual({ sourceId: 'source-live', latestJobId: 'job-live' });
    expect(invoke).toHaveBeenCalledWith('case.state', {});
  });

  it('does not send a renderer-supplied physical identity for export', async () => {
    const invoke = vi.fn().mockResolvedValue({ exportId: 'export-live', items: [] });
    const api = createRecoveryApi({ invoke, subscribe: () => () => undefined });

    await api.exportArtifacts({ artifactIds: ['artifact-live'], destinationPath: 'D:/verified', acknowledgeUnsafe: false });
    expect(invoke).toHaveBeenCalledWith('export.start', {
      artifactIds: ['artifact-live'], destinationPath: 'D:/verified', acknowledgeUnsafe: false,
    });
  });

  it('maps dialog-scoped workspace inspection through a narrow typed IPC method', async () => {
    const selection = {
      selectedPath: 'D:/recovery-cases', rootPath: 'D:/', rootLabel: 'D:',
      totalBytes: '2000000000000', freeBytes: '800000000000',
      directories: [{ name: 'Prior Cases', relativePath: 'Prior Cases', children: [], childrenOmitted: false }],
      truncated: false,
    };
    const invoke = vi.fn().mockResolvedValue(selection);
    const api = createRecoveryApi({ invoke, subscribe: () => () => undefined });
    await expect(api.chooseWorkspaceFolder()).resolves.toEqual(selection);
    expect(invoke).toHaveBeenCalledWith('dialog.choose_workspace', {});
  });

  it('preserves native folder-picker cancellation as null', async () => {
    const api = createRecoveryApi({ invoke: vi.fn().mockResolvedValue(null), subscribe: () => () => undefined });

    await expect(api.chooseWorkspaceFolder()).resolves.toBeNull();
  });

  it('turns workspace inspection permission failures into useful guidance', async () => {
    const api = createRecoveryApi({
      invoke: vi.fn().mockRejectedValue(new Error(
        "Error invoking remote method 'dialog.choose_workspace': Error: WORKSPACE_PERMISSION_DENIED: selected folder cannot be inspected",
      )),
      subscribe: () => () => undefined,
    });

    await expect(api.chooseWorkspaceFolder()).rejects.toThrow(
      'The selected folder could not be inspected. Choose a folder you have permission to read.',
    );
  });

  it('turns Electron IPC wrappers and daemon codes into a useful recovery message', async () => {
    const api = createRecoveryApi({
      invoke: vi.fn().mockRejectedValue(new Error(
        "Error invoking remote method 'case.create': Error: CASE_CREATE_FAILED: destination already exists and will not be overwritten: D:\\case",
      )),
      subscribe: () => () => undefined,
    });

    await expect(api.createCase({
      title: 'Laptop recovery',
      operator: 'analyst-7',
      referenceNumber: null,
      organization: null,
      workspacePath: 'D:\\case',
      notes: null,
    })).rejects.toThrow('That case folder already exists. Choose a different case folder name or parent folder so nothing is overwritten.');
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
