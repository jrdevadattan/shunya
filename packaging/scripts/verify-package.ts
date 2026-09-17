import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { FuseState, FuseV1Options, getCurrentFuseWire } from '@electron/fuses';
import { extractFile } from '@electron/asar';

interface PackageManifest { schemaVersion: number; airGapped: boolean; telemetry: boolean; autoUpdate: boolean; files: Array<{ path: string; sha256: string; executable: boolean }> }

export async function verifyPackage(packageRoot: string): Promise<void> {
  const manifestPath = await findNamed(packageRoot, 'package-manifest.json');
  if (!manifestPath) throw new Error('package-manifest.json not found in distributable');
  const resourceRoot = path.dirname(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PackageManifest;
  if (manifest.schemaVersion !== 1 || !manifest.airGapped || manifest.telemetry || manifest.autoUpdate) throw new Error('package is not the declared air-gapped profile');
  const requiredDocuments = new Set(['LICENSE', 'THIRD_PARTY_NOTICES.md']);
  for (const file of manifest.files) {
    const candidate = path.resolve(resourceRoot, file.path);
    if (!candidate.startsWith(`${resourceRoot}${path.sep}`)) throw new Error(`unsafe package manifest path: ${file.path}`);
    const metadata = await lstat(candidate);
    if (metadata.isSymbolicLink()) throw new Error(`package executable must not be a symlink: ${file.path}`);
    if (file.executable && process.platform !== 'win32' && (metadata.mode & 0o111) === 0) {
      throw new Error(`package executable is missing Unix execute permissions: ${file.path}`);
    }
    const actual = createHash('sha256').update(await readFile(candidate)).digest('hex');
    if (actual !== file.sha256) throw new Error(`package checksum mismatch: ${file.path}`);
    requiredDocuments.delete(file.path);
  }
  if (requiredDocuments.size) throw new Error(`package licensing documents missing: ${[...requiredDocuments].join(', ')}`);
  const appAsar = await findNamed(packageRoot, 'app.asar');
  if (!appAsar) throw new Error('app.asar not found');
  const mainBundle = extractFile(appAsar, path.join('.vite', 'build', 'main.js')).toString('utf8');
  const rendererHtml = extractFile(appAsar, path.join('.vite', 'renderer', 'main_window', 'index.html')).toString('utf8');
  if (/https?:\/\/localhost:\d+/.test(mainBundle)) throw new Error('development server URL found in release main bundle');
  if (!rendererHtml.includes("default-src 'self'")) throw new Error('renderer CSP is absent from package');
  const executable = await findExecutable(packageRoot);
  const fuses = await getCurrentFuseWire(executable);
  for (const [option, expected] of [[FuseV1Options.RunAsNode, FuseState.DISABLE], [FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseState.DISABLE], [FuseV1Options.EnableNodeCliInspectArguments, FuseState.DISABLE], [FuseV1Options.EnableEmbeddedAsarIntegrityValidation, FuseState.ENABLE], [FuseV1Options.OnlyLoadAppFromAsar, FuseState.ENABLE]] as const) {
    if (fuses[option] !== expected) throw new Error(`Electron fuse ${option} has unexpected state`);
  }
}

async function findNamed(root: string, name: string): Promise<string | undefined> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isFile() && entry.name === name) return candidate;
    if (entry.isDirectory()) { const nested = await findNamed(candidate, name); if (nested) return nested; }
  }
}
async function findExecutable(root: string): Promise<string> {
  const expected = process.platform === 'win32' ? 'recovery-platform.exe' : process.platform === 'darwin' ? 'SIH Recovery Platform' : 'recovery-platform';
  const found = await findNamed(root, expected);
  if (!found) throw new Error(`packaged Electron executable not found: ${expected}`);
  return found;
}

if (process.argv[1]?.endsWith('verify-package.ts')) {
  const target = process.argv[2]; if (!target) throw new Error('usage: verify-package.ts <package-root>');
  verifyPackage(path.resolve(target)).catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
