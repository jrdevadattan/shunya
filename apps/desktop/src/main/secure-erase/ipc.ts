import { BrowserWindow, ipcMain } from 'electron';
import { eraseDevice, getSanitizeCapabilities, listNvmeDevices } from './nvme.js';
import { ensureNvmeBinary } from './nvmeBinary.js';
import { listBlockDevices } from './blockDevices.js';
import { csprngEraseDevice, isElevated, type CsprngEraseOptions } from './flashErase.js';
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
  // Flash / removable-media CSPRNG overwrite (NIST 800-88 Clear).
  ipcMain.handle('secureErase.listBlockDevices', async (event) => {
    validateIpcSender(event);
    return listBlockDevices();
  });
  ipcMain.handle('secureErase.isElevated', async (event) => {
    validateIpcSender(event);
    return isElevated();
  });
  ipcMain.handle('secureErase.csprngErase', async (event, device: unknown, options: unknown) => {
    validateIpcSender(event);
    if (typeof device !== 'string' || !isCsprngOptions(options)) throw new Error('ERASE_INVALID_REQUEST');
    return csprngEraseDevice(device, options, (progress) => {
      for (const window of BrowserWindow.getAllWindows()) window.webContents.send('secureErase.progress', progress);
    });
  });
}

function isEraseOptions(value: unknown): value is EraseOptions {
  return typeof value === 'object' && value !== null
    && typeof (value as EraseOptions).confirmation === 'string'
    && typeof (value as EraseOptions).allowFormatFallback === 'boolean';
}

function isCsprngOptions(value: unknown): value is CsprngEraseOptions {
  return typeof value === 'object' && value !== null
    && typeof (value as CsprngEraseOptions).confirmation === 'string'
    && typeof (value as CsprngEraseOptions).dryRun === 'boolean';
}
