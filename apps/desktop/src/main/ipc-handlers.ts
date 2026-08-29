import { ipcMain } from 'electron';
import { validateIpcSender } from './security.js';

const requestChannels = [
  'runtime.get', 'case.create', 'case.open', 'source.list', 'source.add_image', 'source.assess',
  'job.create', 'job.start', 'job.pause', 'job.resume', 'job.cancel', 'artifact.query',
  'artifact.get', 'artifact.preview', 'export.start', 'report.generate',
] as const;

export function registerIpcHandlers(): void {
  for (const channel of requestChannels) {
    ipcMain.handle(channel, (event) => {
      validateIpcSender(event);
      if (channel === 'runtime.get') {
        return { mode: process.env.RECOVERY_RUNTIME_MODE === 'rescue' ? 'rescue' : 'installed' };
      }
      throw new Error('DAEMON_UNAVAILABLE');
    });
  }
}
