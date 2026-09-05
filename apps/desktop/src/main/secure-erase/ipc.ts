import { BrowserWindow, dialog, ipcMain } from 'electron';
import { eraseDevice, getSanitizeCapabilities, listNvmeDevices } from './nvme.js';
import { ensureNvmeBinary } from './nvmeBinary.js';
import { listBlockDevices } from './blockDevices.js';
import { csprngEraseDevice, isElevated, type CsprngEraseOptions } from './flashErase.js';
import { captureDeviceImage, type CaptureImageOptions } from './captureImage.js';
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
  // Read-only forensic imaging: capture a removable device to a .raw file.
  ipcMain.handle('secureErase.chooseCaptureOutput', async (event, suggestedName: unknown) => {
    validateIpcSender(event);
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: 'Save evidence image',
      defaultPath: typeof suggestedName === 'string' && suggestedName ? suggestedName : 'evidence.raw',
      filters: [{ name: 'Raw disk image', extensions: ['raw', 'dd', 'img'] }],
    };
    const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });
  ipcMain.handle('secureErase.captureImage', async (event, device: unknown, options: unknown) => {
    validateIpcSender(event);
    if (typeof device !== 'string' || !isCaptureOptions(options)) throw new Error('CAPTURE_INVALID_REQUEST');
    return captureDeviceImage(device, options, (progress) => {
      for (const window of BrowserWindow.getAllWindows()) window.webContents.send('secureErase.captureProgress', progress);
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

function isCaptureOptions(value: unknown): value is CaptureImageOptions {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as CaptureImageOptions;
  if (typeof candidate.imagePath !== 'string' || candidate.imagePath.length === 0) return false;
  return candidate.maxBytes === undefined || candidate.maxBytes === null || typeof candidate.maxBytes === 'number';
}
