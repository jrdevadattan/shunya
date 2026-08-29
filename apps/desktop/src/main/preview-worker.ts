import { readFile, writeFile } from 'node:fs/promises';
import { nativeImage } from 'electron';

const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;

export async function sanitizeRasterImage(sourcePath: string, derivativePath: string): Promise<{ path: string; mimeType: 'image/png'; size: number }> {
  const input = await readFile(sourcePath);
  if (input.length > MAX_INPUT_BYTES) throw new Error('PREVIEW_INPUT_LIMIT');
  const image = nativeImage.createFromBuffer(input);
  if (image.isEmpty()) throw new Error('PREVIEW_DECODE_FAILED');
  const output = image.toPNG();
  if (output.length > MAX_OUTPUT_BYTES) throw new Error('PREVIEW_OUTPUT_LIMIT');
  await writeFile(derivativePath, output, { flag: 'wx' });
  return { path: derivativePath, mimeType: 'image/png', size: output.length };
}

export async function boundedTextPreview(sourcePath: string): Promise<string> {
  const input = (await readFile(sourcePath)).subarray(0, 512 * 1024);
  return input.toString('utf8').split(/\r?\n/).slice(0, 5_000).join('\n');
}
