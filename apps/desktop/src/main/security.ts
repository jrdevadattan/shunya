import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

const TRUSTED_PROTOCOL = 'recovery:';

export function isTrustedRendererUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === TRUSTED_PROTOCOL && url.hostname === 'app') ||
      (process.env.NODE_ENV === 'development' && url.hostname === 'localhost');
  } catch {
    return false;
  }
}

export function validateIpcSender(event: IpcMainInvokeEvent): void {
  if (!isTrustedRendererUrl(event.senderFrame?.url ?? '')) {
    throw new Error('UNTRUSTED_IPC_SENDER');
  }
}

export function hardenWindow(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
}
