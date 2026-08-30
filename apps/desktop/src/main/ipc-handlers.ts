import path from 'node:path';
import type { Dirent } from 'node:fs';
import { readdir, statfs } from 'node:fs/promises';
import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron';
import {
  parseDesktopRpcParams, parseDesktopRpcResult, WORKSPACE_TREE_MAX_DEPTH, WORKSPACE_TREE_MAX_ENTRIES,
  WorkspaceFolderResultSchema, type RpcMethod, type WorkspaceDirectoryEntry, type WorkspaceSelection,
} from '@recovery/contracts';
import type { DaemonSupervisor } from './daemon-supervisor.js';
import { validateIpcSender } from './security.js';

const requestChannels = [
  'runtime.get', 'case.create', 'case.open', 'source.list', 'source.add_image', 'source.assess',
  'job.create', 'job.start', 'job.pause', 'job.resume', 'job.cancel', 'job.status', 'job.events', 'artifact.query',
  'artifact.get', 'artifact.preview', 'export.start', 'report.generate',
] as const;

export interface WorkspaceInspectionFileSystem {
  statfs(selectedPath: string): Promise<{ bsize: bigint; blocks: bigint; bavail: bigint }>;
  readdir(directoryPath: string): Promise<Dirent[]>;
}

const nativeWorkspaceFileSystem: WorkspaceInspectionFileSystem = {
  statfs: (selectedPath) => statfs(selectedPath, { bigint: true }),
  readdir: (directoryPath) => readdir(directoryPath, { withFileTypes: true }),
};

export async function inspectWorkspaceSelection(
  selectedPath: string,
  fileSystem: WorkspaceInspectionFileSystem = nativeWorkspaceFileSystem,
): Promise<WorkspaceSelection> {
  try {
    const storage = await fileSystem.statfs(selectedPath);
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
        entryCount += 1;
        const relativePath = relativeParent ? path.join(relativeParent, directoryEntry.name) : directoryEntry.name;
        const atDepthLimit = depth >= WORKSPACE_TREE_MAX_DEPTH;
        if (atDepthLimit) truncated = true;
        result.push({
          name: directoryEntry.name,
          relativePath,
          children: atDepthLimit
            ? []
            : await inspectDirectories(path.join(directoryPath, directoryEntry.name), relativePath, depth + 1),
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

export function registerIpcHandlers(daemon?: DaemonSupervisor): void {
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
  for (const channel of requestChannels) {
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      validateIpcSender(event);
      if (!daemon && channel === 'runtime.get') {
        return parseDesktopRpcResult(channel, { mode: process.env.RECOVERY_RUNTIME_MODE === 'rescue' ? 'rescue' : 'installed' });
      }
      if (!daemon) throw new Error('DAEMON_UNAVAILABLE');
      const params = parseDesktopRpcParams(channel, args[0] ?? {});
      return parseDesktopRpcResult(channel, await daemon.request(channel as RpcMethod, params));
    });
  }
}
