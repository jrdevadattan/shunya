import { ipcMain } from 'electron';
import { parseDesktopRpcParams, parseDesktopRpcResult, type RpcMethod } from '@recovery/contracts';
import type { DaemonSupervisor } from './daemon-supervisor.js';
import { validateIpcSender } from './security.js';

const requestChannels = [
  'runtime.get', 'case.create', 'case.open', 'source.list', 'source.add_image', 'source.assess',
  'job.create', 'job.start', 'job.pause', 'job.resume', 'job.cancel', 'job.status', 'job.events', 'artifact.query',
  'artifact.get', 'artifact.preview', 'export.start', 'report.generate',
] as const;

export function registerIpcHandlers(daemon?: DaemonSupervisor): void {
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
