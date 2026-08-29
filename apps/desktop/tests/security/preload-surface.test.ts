import { describe, expect, it } from 'vitest';
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
      invoke: async (...args) => { calls.push(args); return []; },
      subscribe: () => () => undefined,
    });
    await api.getJobStatus('job-live');
    await api.listJobEvents('job-live', 42);
    expect(calls).toEqual([
      ['job.status', 'job-live'],
      ['job.events', { jobId: 'job-live', afterSequence: 42 }],
    ]);
  });
});
