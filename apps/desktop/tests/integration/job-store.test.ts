import { describe, expect, it } from 'vitest';
import { JobEventStore } from '../../src/renderer/features/jobs/job-store.js';

describe('JobEventStore', () => {
  it('replays a snapshot and ignores duplicated or stale event sequence numbers', () => {
    const store = new JobEventStore();
    store.replay(
      { jobId: 'job-1', stage: 'metadata_scan', filesFound: 4, bytesProcessed: '1024' },
      [
        { jobId: 'job-1', sequence: 8, stage: 'metadata_scan', message: 'Scanning metadata' },
        { jobId: 'job-1', sequence: 8, stage: 'carving', message: 'Duplicate must be ignored' },
        { jobId: 'job-1', sequence: 7, stage: 'failed', message: 'Stale must be ignored' },
      ],
    );
    expect(store.getSnapshot()).toMatchObject({ stage: 'metadata_scan', lastSequence: 8 });
  });
});
