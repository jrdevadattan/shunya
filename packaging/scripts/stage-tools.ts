import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

interface ToolEntry { id: string; version: string; license: string; origin: string; platform: string; relativePath: string; sha256: string; networkAllowed: boolean; redistributionAllowed: boolean }
interface ToolLock { manifestVersion: number; tools: ToolEntry[] }
interface PackageFile { id: string; path: string; sha256: string; executable: boolean; license: string }

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
const lock = JSON.parse(await readFile(lockPath, 'utf8')) as ToolLock;
if (lock.manifestVersion !== 1 || !Array.isArray(lock.tools)) throw new Error('unsupported tool lock manifest');
for (const tool of lock.tools) {
  if (!tool.id || !tool.version || !tool.license || !tool.origin || !/^[a-f0-9]{64}$/.test(tool.sha256)) throw new Error(`incomplete integrity, provenance, or license metadata for ${tool.id || 'unknown tool'}`);
  if (tool.networkAllowed) throw new Error(`air-gapped package refuses network-enabled tool ${tool.id}`);
  if (!tool.redistributionAllowed) throw new Error(`package refuses tool without reviewed redistribution approval: ${tool.id}`);
  if (tool.platform !== platform) continue;
  const relative = safeRelative(tool.relativePath);
  const source = path.join(repository, 'tools', relative);
  const bytes = await readFile(source);
  if (digest(bytes) !== tool.sha256) throw new Error(`checksum mismatch for ${tool.id}`);
  const target = path.join(output, 'tools', relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  files.push({ id: tool.id, path: path.posix.join('tools', relative.split(path.sep).join('/')), sha256: tool.sha256, executable: true, license: tool.license });
}
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
function safeRelative(value: string): string { const normalized = path.normalize(value); if (path.isAbsolute(normalized) || normalized.startsWith(`..${path.sep}`) || normalized === '..') throw new Error(`unsafe tool path: ${value}`); return normalized; }
function platformId(os: NodeJS.Platform, arch: string): string {
  const mappedOs = os === 'win32' ? 'windows' : os === 'darwin' ? 'macos' : os;
  const mappedArch = arch === 'x64' ? 'x64' : arch === 'arm64' ? 'arm64' : arch;
  return `${mappedOs}-${mappedArch}`;
}
