import { BrowserWindow, dialog, ipcMain } from 'electron';
import { validateIpcSender } from '../security.js';
import { appendAudit } from './audit.js';
import { executeFolderDeletion, planFolderDeletion, type DeletionDependencies } from './folderDeletion.js';
import { resolveFolderDevice } from './folderDevice.js';

const dependencies: DeletionDependencies = {
  resolveDevice: resolveFolderDevice,
  audit: appendAudit,
};

/** Folder-level secure deletion on removable media (plan → confirm → execute). */
export function registerDeletionHandlers(): void {
  ipcMain.handle('deletion.chooseFolder', async (event) => {
    validateIpcSender(event);
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: 'Choose the folder to securely delete',
      buttonLabel: 'Select folder',
      properties: ['openDirectory' as const],
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    const selectedPath = result.filePaths[0];
    return result.canceled || !selectedPath ? null : selectedPath;
  });
  ipcMain.handle('deletion.plan', async (event, targetPath: unknown) => {
    validateIpcSender(event);
    if (typeof targetPath !== 'string' || !targetPath) throw new Error('DELETION_TARGET_REQUIRED');
    return planFolderDeletion(targetPath, dependencies);
  });
  ipcMain.handle('deletion.execute', async (event, planId: unknown, options: unknown) => {
    validateIpcSender(event);
    if (typeof planId !== 'string' || !isExecuteOptions(options)) throw new Error('DELETION_INVALID_REQUEST');
    return executeFolderDeletion(planId, options, dependencies, (progress) => {
      for (const window of BrowserWindow.getAllWindows()) window.webContents.send('deletion.progress', progress);
    });
  });
}

function isExecuteOptions(value: unknown): value is { confirmation: string } {
  return typeof value === 'object' && value !== null && typeof (value as { confirmation?: unknown }).confirmation === 'string';
}
