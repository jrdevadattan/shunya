import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { csprngOverwrite } from '../../src/main/secure-erase/csprngOverwrite.js';

async function tempTarget(size: number): Promise<{ dir: string; file: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'csprng-'));
  const file = path.join(dir, 'target.bin');
  await writeFile(file, Buffer.alloc(size, 0));
  return { dir, file };
}

describe('csprngOverwrite', () => {
  it('overwrites every byte with high-entropy data in a single pass and preserves size', async () => {
    const size = 1024 * 1024;
    const { dir, file } = await tempTarget(size);
    try {
      const progress: number[] = [];
      const result = await csprngOverwrite(file, size, {
        chunkSize: 64 * 1024,
        progressIntervalMs: 0,
        onProgress: (event) => progress.push(event.percent),
      });
      expect(result.bytesWritten).toBe(size);

      const after = await readFile(file);
      expect(after.length).toBe(size); // never truncated or extended

      // The original zero fill is gone; the content reads as CSPRNG bytes.
      const zeroBytes = after.reduce((count, byte) => count + (byte === 0 ? 1 : 0), 0);
      expect(zeroBytes).toBeLessThan(size * 0.02); // ~1/256 expected
      expect(new Set(after).size).toBeGreaterThan(250); // ~all 256 values present

      expect(progress.at(-1)).toBe(100);
      expect(progress.length).toBeGreaterThan(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('handles a size that is not a multiple of the chunk size', async () => {
    const size = 100_003;
    const { dir, file } = await tempTarget(size);
    try {
      const result = await csprngOverwrite(file, size, { chunkSize: 4096, progressIntervalMs: 0 });
      expect(result.bytesWritten).toBe(size);
      expect((await stat(file)).size).toBe(size);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('can be aborted before writing', async () => {
    const size = 1024 * 1024;
    const { dir, file } = await tempTarget(size);
    const controller = new AbortController();
    controller.abort();
    try {
      await expect(
        csprngOverwrite(file, size, { chunkSize: 4096, signal: controller.signal }),
      ).rejects.toThrow('CSPRNG_OVERWRITE_ABORTED');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects an invalid size', async () => {
    await expect(csprngOverwrite('does-not-matter', 0)).rejects.toThrow('CSPRNG_OVERWRITE_INVALID_SIZE');
  });
});
