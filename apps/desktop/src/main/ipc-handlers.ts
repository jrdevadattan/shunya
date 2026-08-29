import { ipcMain } from 'electron';
import type { RpcMethod } from '@recovery/contracts';
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
        return { mode: process.env.RECOVERY_RUNTIME_MODE === 'rescue' ? 'rescue' : 'installed' };
      }
      if (!daemon) throw new Error('DAEMON_UNAVAILABLE');
      return daemon.request(channel as RpcMethod, requestParams(channel, args));
    });
  }
}

function requestParams(channel: (typeof requestChannels)[number], args: unknown[]): Record<string, unknown> {
  const first = args[0];
  if (first && typeof first === 'object' && !Array.isArray(first)) return first as Record<string, unknown>;
  if (channel === 'case.open') return { casePath: String(first ?? '') };
  if (channel === 'source.assess') return { sourceId: String(first ?? '') };
  if (channel.startsWith('job.')) return { jobId: String(first ?? '') };
  if (channel === 'artifact.get' || channel === 'artifact.preview') return { artifactId: String(first ?? '') };
  if (channel === 'report.generate') return { caseId: String(first ?? '') };
  return {};
}
