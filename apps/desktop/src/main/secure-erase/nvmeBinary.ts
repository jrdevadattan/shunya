/** Downloads and verifies nvme-cli on first use. Release engineering must set
 * the immutable GitHub Release URL and SHA-256 values before shipping. */
import { app } from 'electron';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';

const BINARY_BASE_URL = 'https://github.com/YOUR_USER/sih-nvme-binaries/releases/download/v1.0';
const BINARIES: Record<string, { fileName: string; sha256: string }> = {
  win32: { fileName: 'nvme-windows-x64.exe', sha256: 'PUT_SHA256_HASH_HERE' },
  linux: { fileName: 'nvme-linux-x64', sha256: 'PUT_SHA256_HASH_HERE' },
};

function configuration(): { fileName: string; sha256: string } {
  const config = BINARIES[process.platform];
  if (!config) throw new Error(`No nvme-cli binary available for platform: ${process.platform}`);
  if (BINARY_BASE_URL.includes('YOUR_USER') || !/^[a-f0-9]{64}$/i.test(config.sha256)) {
    throw new Error('NVME_BINARY_RELEASE_NOT_CONFIGURED: Set the GitHub Release URL and SHA-256 for this platform before shipping.');
  }
  return config;
}

function cacheDirectory(): string {
  const directory = path.join(app.getPath('userData'), 'bin');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  return directory;
}

function localPath(): string {
  configuration();
  return path.join(cacheDirectory(), process.platform === 'win32' ? 'nvme.exe' : 'nvme');
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk: string | Buffer) => { hash.update(chunk); });
    stream.once('end', () => resolve(hash.digest('hex')));
    stream.once('error', reject);
  });
}

function downloadFile(url: string, destination: string, redirects = 0): Promise<void> {
  if (redirects > 5) return Promise.reject(new Error('NVME_BINARY_DOWNLOAD_REDIRECT_LIMIT'));
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        downloadFile(new URL(response.headers.location, url).toString(), destination, redirects + 1).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) { response.resume(); reject(new Error(`NVME_BINARY_DOWNLOAD_FAILED: HTTP ${response.statusCode}`)); return; }
      const file = fs.createWriteStream(destination, { mode: 0o700 });
      response.pipe(file);
      file.once('finish', () => file.close((error) => error ? reject(error) : resolve()));
      file.once('error', reject);
    });
    request.once('error', reject);
  });
}

/** Ensures a verified platform binary exists in userData; never executes a
 * download whose SHA-256 differs from the release-pinned expected digest. */
export async function ensureNvmeBinary(onProgress?: (message: string) => void): Promise<string> {
  const config = configuration();
  const target = localPath();
  if (fs.existsSync(target)) {
    if ((await sha256File(target)).toLowerCase() === config.sha256.toLowerCase()) return target;
    onProgress?.('Cached nvme-cli failed verification; downloading a replacement.');
    fs.rmSync(target, { force: true });
  }
  const temporary = `${target}.download`;
  fs.rmSync(temporary, { force: true });
  try {
    onProgress?.('Downloading nvme-cli…');
    await downloadFile(`${BINARY_BASE_URL}/${config.fileName}`, temporary);
    onProgress?.('Verifying downloaded nvme-cli…');
    const actual = await sha256File(temporary);
    if (actual.toLowerCase() !== config.sha256.toLowerCase()) throw new Error('NVME_BINARY_CHECKSUM_MISMATCH');
    if (process.platform !== 'win32') fs.chmodSync(temporary, 0o755);
    fs.renameSync(temporary, target);
    onProgress?.('nvme-cli is ready.');
    return target;
  } catch (cause) {
    fs.rmSync(temporary, { force: true });
    throw cause;
  }
}

export function getNvmeBinaryPathSync(): string {
  const target = localPath();
  if (!fs.existsSync(target)) throw new Error('NVME_BINARY_NOT_READY: Call ensureNvmeBinary first.');
  return target;
}
