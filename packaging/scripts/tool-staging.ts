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
  const lock = JSON.parse(await readFile(options.lockPath, 'utf8')) as ToolLock;
  if (lock.manifestVersion !== 1 || !Array.isArray(lock.tools)) {
    throw new Error('unsupported tool lock manifest');
  }
  const seenIds = new Set<string>();
  const validated = lock.tools.map((tool) => {
    if (!tool.id || !tool.version || !tool.license || !tool.origin || !/^[a-f0-9]{64}$/.test(tool.sha256)) {
      throw new Error(`incomplete integrity, provenance, or license metadata for ${tool.id || 'unknown tool'}`);
    }
    if (seenIds.has(tool.id)) throw new Error(`duplicate tool ID: ${tool.id}`);
    seenIds.add(tool.id);
    if (tool.networkAllowed) throw new Error(`air-gapped package refuses network-enabled tool ${tool.id}`);
    if (!tool.redistributionAllowed) throw new Error(`package refuses tool without reviewed redistribution approval: ${tool.id}`);
    return { tool, relativePath: safeRelative(tool.relativePath) };
  });

  const files: PackageFile[] = [];
  const toolsRoot = path.join(options.repositoryRoot, 'tools');
  const canonicalToolsRoot = await realpath(toolsRoot);
  for (const { tool, relativePath } of validated) {
    if (tool.platform !== options.platform) continue;
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

function digest(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function safeRelative(value: string): string {
  const normalized = path.normalize(value);
  if (!value || path.isAbsolute(normalized) || normalized.startsWith(`..${path.sep}`) || normalized === '..') {
    throw new Error(`unsafe tool path: ${value}`);
  }
  return normalized;
}

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
