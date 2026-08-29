import { app, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';

const TRUSTED_PROTOCOL = 'recovery:';

export function isTrustedRendererUrl(value: string, allowDevelopment = false): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === TRUSTED_PROTOCOL && url.hostname === 'app') ||
      (allowDevelopment && ['localhost', '127.0.0.1'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol));
  } catch {
    return false;
  }
}

export function validateIpcSender(event: IpcMainInvokeEvent): void {
  if (!isTrustedRendererUrl(event.senderFrame?.url ?? '', !app.isPackaged)) {
    throw new Error('UNTRUSTED_IPC_SENDER');
  }
}

export function hardenWindow(window: BrowserWindow, allowDevelopment = false): void {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url, allowDevelopment)) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
}
