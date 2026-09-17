import { describe, expect, it } from 'vitest';
import { ResultStore } from '../../src/renderer/features/results/result-store.js';

describe('million-result renderer boundary', () => {
  it('keeps only the server-provided page in renderer memory', () => {
    const store = new ResultStore();
    store.ingestPage({ items: [], nextCursor: 'cursor-for-row-100-of-1000000', totalCount: 1_000_000 });
    expect(store.snapshot().items).toHaveLength(0);
    expect(store.snapshot().nextCursor).toContain('1000000');
    expect(store.snapshot().totalCount).toBe(1_000_000);
  });
});
