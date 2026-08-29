import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron';
import { parseDesktopRpcParams, parseDesktopRpcResult, type RpcMethod } from '@recovery/contracts';
import type { DaemonSupervisor } from './daemon-supervisor.js';
import { validateIpcSender } from './security.js';

const requestChannels = [
  'runtime.get', 'case.create', 'case.open', 'source.list', 'source.add_image', 'source.assess',
  'job.create', 'job.start', 'job.pause', 'job.resume', 'job.cancel', 'job.status', 'job.events', 'artifact.query',
  'artifact.get', 'artifact.preview', 'export.start', 'report.generate',
] as const;

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
    return result.canceled ? null : result.filePaths[0] ?? null;
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
