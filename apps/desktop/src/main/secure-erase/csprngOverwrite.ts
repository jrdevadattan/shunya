import { createCipheriv, randomBytes } from 'node:crypto';
import { open } from 'node:fs/promises';

export interface OverwriteProgress {
  bytesWritten: number;
  totalBytes: number;
  percent: number;
}

export interface OverwriteOptions {
  /** Bytes written per iteration. Must be a multiple of the target sector size
   * for a raw block device (4 MiB is a multiple of both 512 and 4096). */
  chunkSize?: number;
  onProgress?: (progress: OverwriteProgress) => void;
  /** Minimum gap between progress callbacks, in ms. */
  progressIntervalMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_CHUNK = 4 * 1024 * 1024;

/**
 * Full-target CSPRNG overwrite. Streams an AES-256-CTR keystream across every
 * byte of `targetPath` in a single sequential pass.
 *
 * IMPORTANT — this is an overwrite-based NIST SP 800-88 Rev. 2 **Clear** method,
 * NOT "Cryptographic Erase". No key is ever persisted or reused: the transient
 * key and IV exist only in process memory for this one pass and are zeroed
 * afterward. There is nothing to store, wrap, or destroy. CTR mode (not GCM) is
 * used deliberately — the goal is to destroy data, so an authentication tag
 * would serve no purpose.
 *
 * Known limitation: on flash media, wear-leveling / over-provisioning / bad-block
 * remapping mean a full logical-address overwrite does not guarantee every
 * physical NAND page is touched. For NIST **Purge**-level assurance, use a
 * firmware command (ATA Secure Erase, NVMe Sanitize) instead.
 */
export async function csprngOverwrite(
  targetPath: string,
  totalBytes: number,
  options: OverwriteOptions = {},
): Promise<{ bytesWritten: number }> {
  if (!Number.isSafeInteger(totalBytes) || totalBytes <= 0) {
    throw new Error('CSPRNG_OVERWRITE_INVALID_SIZE');
  }
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK;
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
    throw new Error('CSPRNG_OVERWRITE_INVALID_CHUNK');
  }
  const progressIntervalMs = options.progressIntervalMs ?? 500;

  // AES-256-CTR keystream: encrypting a zero buffer yields the raw keystream,
  // a high-quality CSPRNG byte stream that never repeats within this pass.
  const key = randomBytes(32);
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-ctr', key, iv);
  const zeros = Buffer.alloc(chunkSize);

  const handle = await open(targetPath, 'r+');
  let bytesWritten = 0;
  let lastReport = 0;
  try {
    while (bytesWritten < totalBytes) {
      if (options.signal?.aborted) throw new Error('CSPRNG_OVERWRITE_ABORTED');
      const remaining = totalBytes - bytesWritten;
      const thisChunk = remaining < chunkSize ? remaining : chunkSize;
      const source = thisChunk === chunkSize ? zeros : zeros.subarray(0, thisChunk);
      // CTR is a stream cipher: output length equals input length, no padding.
      const block = cipher.update(source);
      let offsetInBlock = 0;
      while (offsetInBlock < block.length) {
        const { bytesWritten: n } = await handle.write(
          block,
          offsetInBlock,
          block.length - offsetInBlock,
          bytesWritten + offsetInBlock,
        );
        if (n <= 0) throw new Error('CSPRNG_OVERWRITE_SHORT_WRITE');
        offsetInBlock += n;
      }
      bytesWritten += block.length;
      const now = Date.now();
      if (options.onProgress && (now - lastReport >= progressIntervalMs || bytesWritten >= totalBytes)) {
        lastReport = now;
        options.onProgress({ bytesWritten, totalBytes, percent: (bytesWritten / totalBytes) * 100 });
      }
    }
    // Flush the OS write cache to the medium before we report completion.
    await handle.sync().catch(() => undefined);
  } finally {
    // Zero all transient key material and the working buffer.
    key.fill(0);
    iv.fill(0);
    zeros.fill(0);
    cipher.destroy();
    await handle.close().catch(() => undefined);
  }
  return { bytesWritten };
}
