import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { stageExternalTools, type PackageFile } from './tool-staging.js';

async function main(): Promise<void> {
const repository = path.resolve(process.cwd(), '../..');
const output = path.join(repository, 'apps/desktop/resources');
const platform = platformId(process.platform, process.arch);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const executableSuffix = process.platform === 'win32' ? '.exe' : '';
const core = [
  { id: 'recoveryd', source: path.join(repository, `target/release/recoveryd${executableSuffix}`), target: `recoveryd${executableSuffix}`, license: 'Apache-2.0' },
  { id: 'privileged-helper', source: path.join(repository, `target/release/recovery-privileged-helper${executableSuffix}`), target: `recovery-privileged-helper${executableSuffix}`, license: 'Apache-2.0' },
];
const files: PackageFile[] = [];
for (const item of core) {
  const bytes = await readFile(item.source).catch(() => { throw new Error(`missing release binary: ${item.source}; run cargo build --workspace --release first`); });
  await writeFile(path.join(output, item.target), bytes);
  const sha256 = digest(bytes);
  files.push({ id: item.id, path: item.target, sha256, executable: true, license: item.license });
  if (item.id === 'recoveryd') await writeFile(path.join(output, 'recoveryd.sha256'), `${sha256}  ${item.target}\n`);
}

const lockPath = path.join(repository, 'tools/manifests/tools.lock.json');
files.push(...await stageExternalTools({ repositoryRoot: repository, outputRoot: output, lockPath, platform }));
await cp(lockPath, path.join(output, 'tools.lock.json'));
for (const document of [
  { id: 'project-license', target: 'LICENSE', license: 'Apache-2.0' },
  { id: 'third-party-notices', target: 'THIRD_PARTY_NOTICES.md', license: 'Mixed; see document' },
]) {
  const bytes = await readFile(path.join(repository, document.target));
  await writeFile(path.join(output, document.target), bytes);
  files.push({ id: document.id, path: document.target, sha256: digest(bytes), executable: false, license: document.license });
}
const manifest = { schemaVersion: 1, platform, airGapped: true, telemetry: false, autoUpdate: false, fuses: { runAsNode: false, nodeOptions: false, nodeCliInspect: false, embeddedAsarIntegrity: true, onlyLoadFromAsar: true, wasmTrapHandlers: true }, files: files.sort((a, b) => a.path.localeCompare(b.path)) };
await writeFile(path.join(output, 'package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

function digest(bytes: Buffer): string { return createHash('sha256').update(bytes).digest('hex'); }
function platformId(os: NodeJS.Platform, arch: string): string {
  const mappedOs = os === 'win32' ? 'windows' : os === 'darwin' ? 'macos' : os;
  const mappedArch = arch === 'x64' ? 'x64' : arch === 'arm64' ? 'arm64' : arch;
  return `${mappedOs}-${mappedArch}`;
}
