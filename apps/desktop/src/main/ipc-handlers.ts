import path from 'node:path';
import type { Dirent, Stats } from 'node:fs';
import { lstat, readdir, realpath, statfs, writeFile } from 'node:fs/promises';
import { BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron';
import { generateCertificate, verifyCertificate, type CertificateRecord, type SignedCertificate } from './certificate.js';
import {
  parseDesktopRpcParams, parseDesktopRpcResult, WORKSPACE_TREE_MAX_DEPTH, WORKSPACE_TREE_MAX_ENTRIES,
  ReportDescriptorSchema, ReportRevealParamsSchema, WorkspaceFolderResultSchema,
  type RpcMethod, type WorkspaceDirectoryEntry, type WorkspaceSelection,
} from '@recovery/contracts';
import type { DaemonSupervisor } from './daemon-supervisor.js';
import { validateIpcSender } from './security.js';

const requestChannels = [
  'runtime.get', 'case.create', 'case.open', 'case.state', 'source.list', 'source.add_image', 'source.assess',
  'job.create', 'job.start', 'job.pause', 'job.resume', 'job.cancel', 'job.status', 'job.events', 'artifact.query',
  'artifact.get', 'artifact.preview', 'export.start', 'report.generate', 'deletion.list_files', 'deletion.start',
] as const;

export interface WorkspaceInspectionFileSystem {
  statfs(selectedPath: string): Promise<{ bsize: bigint; blocks: bigint; bavail: bigint }>;
  readdir(directoryPath: string): Promise<Dirent[]>;
  lstat(directoryPath: string): Promise<Pick<Stats, 'isDirectory' | 'isSymbolicLink'>>;
  realpath(directoryPath: string): Promise<string>;
}

const nativeWorkspaceFileSystem: WorkspaceInspectionFileSystem = {
  statfs: (selectedPath) => statfs(selectedPath, { bigint: true }),
  readdir: (directoryPath) => readdir(directoryPath, { withFileTypes: true }),
  lstat,
  realpath,
};

export async function inspectWorkspaceSelection(
  selectedPath: string,
  fileSystem: WorkspaceInspectionFileSystem = nativeWorkspaceFileSystem,
): Promise<WorkspaceSelection> {
  try {
    const storage = await fileSystem.statfs(selectedPath);
    const canonicalRoot = await fileSystem.realpath(selectedPath);
    const visitedDirectories = new Set([canonicalPathKey(canonicalRoot)]);
    let entryCount = 0;
    let truncated = false;

    const inspectDirectories = async (
      directoryPath: string,
      relativeParent: string,
      depth: number,
    ): Promise<WorkspaceDirectoryEntry[]> => {
      const directoryEntries = (await fileSystem.readdir(directoryPath))
        .filter((entry) => entry.isDirectory())
        .sort((left, right) => left.name.localeCompare(right.name));
      const result: WorkspaceDirectoryEntry[] = [];
      for (const directoryEntry of directoryEntries) {
        if (entryCount >= WORKSPACE_TREE_MAX_ENTRIES) {
          truncated = true;
          break;
        }
        if (!isSafeDirectoryName(directoryEntry.name)) continue;
        const childPath = path.join(directoryPath, directoryEntry.name);
        const metadata = await fileSystem.lstat(childPath);
        if (!metadata.isDirectory() || metadata.isSymbolicLink()) continue;
        const canonicalChild = await fileSystem.realpath(childPath);
        const canonicalKey = canonicalPathKey(canonicalChild);
        if (!isWithinRoot(canonicalRoot, canonicalChild) || visitedDirectories.has(canonicalKey)) continue;
        visitedDirectories.add(canonicalKey);
        entryCount += 1;
        const relativePath = relativeParent ? `${relativeParent}/${directoryEntry.name}` : directoryEntry.name;
        const atDepthLimit = depth >= WORKSPACE_TREE_MAX_DEPTH;
        if (atDepthLimit) truncated = true;
        result.push({
          name: directoryEntry.name,
          relativePath,
          children: atDepthLimit
            ? []
            : await inspectDirectories(childPath, relativePath, depth + 1),
          childrenOmitted: atDepthLimit,
        });
      }
      return result;
    };

    const rootPath = path.parse(path.resolve(selectedPath)).root;
    const trimmedRoot = rootPath.replace(/[\\/]+$/, '');
    return WorkspaceFolderResultSchema.unwrap().parse({
      selectedPath,
      rootPath,
      rootLabel: trimmedRoot || rootPath,
      totalBytes: (storage.bsize * storage.blocks).toString(),
      freeBytes: (storage.bsize * storage.bavail).toString(),
      directories: await inspectDirectories(selectedPath, '', 1),
      truncated,
    });
  } catch (cause) {
    const errorCode = typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : '';
    if (errorCode === 'EACCES' || errorCode === 'EPERM') {
      throw new Error(
        'WORKSPACE_PERMISSION_DENIED: The selected folder could not be inspected. Choose a folder you have permission to read.',
      );
    }
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`WORKSPACE_INSPECTION_FAILED: The selected folder could not be inspected. ${detail}`);
  }
}

function canonicalPathKey(directoryPath: string): string {
  const resolved = path.resolve(directoryPath);
  return process.platform === 'win32' ? resolved.toLocaleLowerCase() : resolved;
}

function isWithinRoot(canonicalRoot: string, candidate: string): boolean {
  const relative = path.relative(canonicalRoot, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function isSafeDirectoryName(name: string): boolean {
  return name !== '.' && name !== '..' && !name.includes('/') && !name.includes('\\') && !name.includes('\0');
}

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
const execAsync = promisify(exec);

export function registerIpcHandlers(daemon?: DaemonSupervisor): void {
  const generatedReportPaths = new Set<string>();

  ipcMain.handle('deletion.run', async (event, scriptName: string) => {
    validateIpcSender(event);
    
    // WARNING: In a real app, validate the scriptName securely!
    // For development, we'll just simulate or run a safe command.
    try {
      if (process.platform === 'win32') {
        const { stdout, stderr } = await execAsync(`cmd.exe /c echo "Simulated deletion script: ${scriptName}"`);
        return stdout || stderr;
      } else {
        const { stdout, stderr } = await execAsync(`echo "Simulated deletion script: ${scriptName}"`);
        return stdout || stderr;
      }
    } catch (err: any) {
      throw new Error(`Failed to run script: ${err.message}`);
    }
  });
  ipcMain.handle('dialog.choose_workspace', async (event) => {
    validateIpcSender(event);
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options: OpenDialogOptions = {
      title: 'Choose a recovery case workspace',
      buttonLabel: 'Select folder',
      properties: ['openDirectory', 'createDirectory'],
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    const selectedPath = result.filePaths[0];
    if (result.canceled || !selectedPath) return null;
    return inspectWorkspaceSelection(selectedPath);
  });
  ipcMain.handle('dialog.choose_export', async (event) => {
    validateIpcSender(event);
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options: OpenDialogOptions = {
      title: 'Choose export destination',
      buttonLabel: 'Select export folder',
      properties: ['openDirectory', 'createDirectory'],
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    const selectedPath = result.filePaths[0];
    return result.canceled || !selectedPath ? null : selectedPath;
  });
  ipcMain.handle('dialog.choose_source_image', async (event) => {
    validateIpcSender(event);
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options: OpenDialogOptions = {
      title: 'Choose a disk or memory image',
      buttonLabel: 'Select image',
      properties: ['openFile'],
      filters: [
        { name: 'Evidence images', extensions: ['raw', 'img', 'dd', 'e01', 'aff', 'bin', 'mem', 'dmp'] },
        { name: 'All files', extensions: ['*'] },
      ],
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    const selectedPath = result.filePaths[0];
    return result.canceled || !selectedPath ? null : selectedPath;
  });
  ipcMain.handle('report.reveal', async (event, value: unknown) => {
    validateIpcSender(event);
    const { reportPath } = ReportRevealParamsSchema.parse(value);
    if (!generatedReportPaths.has(canonicalPathKey(reportPath))) {
      throw new Error('REPORT_PATH_NOT_GENERATED: Generate the report in this app session before opening its folder.');
    }
    shell.showItemInFolder(reportPath);
    return { revealed: true };
  });
  // Tamper-evident certificate signing (Ed25519).
  ipcMain.handle('certificate.generate', async (event, record: unknown) => {
    validateIpcSender(event);
    return generateCertificate(record as CertificateRecord);
  });
  ipcMain.handle('certificate.verify', async (event, cert: unknown) => {
    validateIpcSender(event);
    return verifyCertificate(cert as SignedCertificate);
  });
  ipcMain.handle('certificate.save', async (event, value: unknown) => {
    validateIpcSender(event);
    const input = value as { suggestedName?: string; content?: string };
    if (typeof input?.content !== 'string') throw new Error('CERTIFICATE_SAVE_INVALID');
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: 'Save certificate',
      defaultPath: input.suggestedName || 'certificate.html',
      filters: [{ name: 'HTML certificate', extensions: ['html'] }],
    };
    const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, input.content, 'utf8');
    return result.filePath;
  });
  for (const channel of requestChannels) {
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      validateIpcSender(event);
      if (!daemon && channel === 'runtime.get') {
        return parseDesktopRpcResult(channel, { mode: process.env.RECOVERY_RUNTIME_MODE === 'rescue' ? 'rescue' : 'installed' });
      }
      if (!daemon) throw new Error('DAEMON_UNAVAILABLE');
      const params = parseDesktopRpcParams(channel, args[0] ?? {});
      const result = parseDesktopRpcResult(channel, await daemon.request(channel as RpcMethod, params));
      if (channel === 'report.generate') {
        const report = ReportDescriptorSchema.parse(result);
        generatedReportPaths.add(canonicalPathKey(report.jsonPath));
        generatedReportPaths.add(canonicalPathKey(report.markdownPath));
      }
      return result;
    });
  }
}
