import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface ToolEntry {
  id: string;
  version: string;
  license: string;
  origin: string;
  platform: string;
  relativePath: string;
  sha256: string;
  networkAllowed: boolean;
  redistributionAllowed: boolean;
}

interface ToolLock { manifestVersion: number; tools: ToolEntry[] }

const TOOL_PLATFORMS = new Set(['windows-x64', 'linux-x64', 'linux-arm64', 'macos-x64', 'macos-arm64']);
const TOOL_ENTRY_KEYS = new Set([
  'id', 'version', 'license', 'origin', 'platform', 'relativePath', 'sha256',
  'networkAllowed', 'redistributionAllowed',
]);

export interface PackageFile {
  id: string;
  path: string;
  sha256: string;
  executable: boolean;
  license: string;
}

export interface StageExternalToolsOptions {
  repositoryRoot: string;
  outputRoot: string;
  lockPath: string;
  platform: string;
}

export async function stageExternalTools(options: StageExternalToolsOptions): Promise<PackageFile[]> {
  const lock = parseToolLock(JSON.parse(await readFile(options.lockPath, 'utf8')) as unknown);
  const seenIds = new Set<string>();
  const validated = lock.tools.map((tool) => {
    const identity = `${tool.id}\0${tool.platform}`;
    if (seenIds.has(identity)) throw new Error(`duplicate tool ID and platform: ${tool.id} ${tool.platform}`);
    seenIds.add(identity);
    return { tool, relativePath: safeRelative(tool.relativePath) };
  });

  const files: PackageFile[] = [];
  const selected = validated.filter(({ tool }) => tool.platform === options.platform);
  if (selected.length === 0) return files;
  const toolsRoot = path.join(options.repositoryRoot, 'tools');
  const canonicalToolsRoot = await realpath(toolsRoot);
  for (const { tool, relativePath } of selected) {
    const source = path.join(toolsRoot, relativePath);
    if ((await lstat(source)).isSymbolicLink()) {
      throw new Error(`package tool must not be a symlink: ${tool.id}`);
    }
    const canonicalSource = await realpath(source);
    if (!isContained(canonicalToolsRoot, canonicalSource)) {
      throw new Error(`tool path escapes tools root: ${tool.id}`);
    }
    const bytes = await readFile(canonicalSource);
    if (digest(bytes) !== tool.sha256) throw new Error(`checksum mismatch for ${tool.id}`);
    const target = path.join(options.outputRoot, 'tools', relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    files.push({
      id: tool.id,
      path: path.posix.join('tools', relativePath.split(path.sep).join('/')),
      sha256: tool.sha256,
      executable: true,
      license: tool.license,
    });
  }
  return files;
}

function parseToolLock(value: unknown): ToolLock {
  if (!isRecord(value) || value.manifestVersion !== 1 || !Array.isArray(value.tools)) {
    throw new Error('unsupported tool lock manifest');
  }
  return {
    manifestVersion: 1,
    tools: value.tools.map((entry, index) => parseToolEntry(entry, index)),
  };
}

function parseToolEntry(value: unknown, index: number): ToolEntry {
  if (!isRecord(value)) throw new Error(`tool entry ${index} must be an object`);
  for (const key of Object.keys(value)) {
    if (!TOOL_ENTRY_KEYS.has(key)) throw new Error(`tool entry ${index} has unknown field: ${key}`);
  }
  const id = nonblankString(value.id, 'id', index);
  const version = nonblankString(value.version, 'version', index);
  const license = nonblankString(value.license, 'license', index);
  const origin = nonblankString(value.origin, 'origin', index);
  const platform = nonblankString(value.platform, 'platform', index);
  if (!TOOL_PLATFORMS.has(platform)) throw new Error(`unsupported tool platform for ${id}: ${platform}`);
  const relativePath = nonblankString(value.relativePath, 'relativePath', index);
  if (typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) {
    throw new Error(`incomplete integrity, provenance, or license metadata for ${id}: sha256 must be 64 lowercase hex characters`);
  }
  if (value.networkAllowed !== false) throw new Error(`networkAllowed must be false for ${id}`);
  if (value.redistributionAllowed !== true) throw new Error(`redistributionAllowed must be true for ${id}`);
  return {
    id,
    version,
    license,
    origin,
    platform,
    relativePath,
    sha256: value.sha256,
    networkAllowed: false,
    redistributionAllowed: true,
  };
}

function nonblankString(value: unknown, field: string, index: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a nonblank string in tool entry ${index}`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function digest(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function safeRelative(value: string): string {
  if (!isPortableToolRelativePath(value)) {
    throw new Error(`unsafe tool path: ${value}`);
  }
  return path.normalize(value);
}

function isPortableToolRelativePath(value: string): boolean {
  if (!value || value.startsWith('/') || value.includes('\\')) return false;
  return value.split('/').every((component) => {
    if (!component || component === '.' || component === '..' || component.endsWith('.') || component.endsWith(' ')) {
      return false;
    }
    if (/[<>:"|?*\u0000-\u001f]/u.test(component)) return false;
    const stem = component.split('.')[0]?.toUpperCase() ?? '';
    return !/^(CON|PRN|AUX|NUL|CLOCK\$|COM[1-9]|LPT[1-9])$/u.test(stem);
  });
}

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
