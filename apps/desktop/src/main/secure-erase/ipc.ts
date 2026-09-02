import { BrowserWindow, ipcMain } from 'electron';
import { eraseDevice, getSanitizeCapabilities, listNvmeDevices } from './nvme.js';
import { ensureNvmeBinary } from './nvmeBinary.js';
import type { EraseOptions } from './types.js';
import { validateIpcSender } from '../security.js';

export function registerSecureEraseHandlers(): void {
  ipcMain.handle('secureErase.prepareBinary', async (event) => {
    validateIpcSender(event);
    await ensureNvmeBinary((message) => {
      event.sender.send('secureErase.downloadProgress', message);
    });
  });
  ipcMain.handle('secureErase.listDevices', async (event) => {
    validateIpcSender(event);
    return listNvmeDevices();
  });
  ipcMain.handle('secureErase.getCapabilities', async (event, device: unknown) => {
    validateIpcSender(event);
    if (typeof device !== 'string') throw new Error('NVME_INVALID_DEVICE');
    return getSanitizeCapabilities(device);
  });
  ipcMain.handle('secureErase.eraseDevice', async (event, device: unknown, options: unknown) => {
    validateIpcSender(event);
    if (typeof device !== 'string' || !isEraseOptions(options)) throw new Error('NVME_INVALID_ERASE_REQUEST');
    return eraseDevice(device, options, (progress) => {
      for (const window of BrowserWindow.getAllWindows()) window.webContents.send('secureErase.progress', progress);
    });
  });
}

function isEraseOptions(value: unknown): value is EraseOptions {
  return typeof value === 'object' && value !== null
    && typeof (value as EraseOptions).confirmation === 'string'
    && typeof (value as EraseOptions).allowFormatFallback === 'boolean';
}
