import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, net, protocol } from 'electron';
import { registerIpcHandlers } from './ipc-handlers.js';
import { hardenWindow } from './security.js';
import { buildMainWindowOptions } from './windows.js';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

protocol.registerSchemesAsPrivileged([
  { scheme: 'recovery', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function registerAppProtocol(): void {
  const rendererRoot = path.resolve(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`);
  protocol.handle('recovery', (request) => {
    const url = new URL(request.url);
    const relativePath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const requestedPath = path.resolve(rendererRoot, `.${relativePath}`);
    if (!requestedPath.startsWith(`${rendererRoot}${path.sep}`)) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(requestedPath).toString());
  });
}

async function createMainWindow(): Promise<void> {
  const preloadPath = path.join(__dirname, 'preload.js');
  const window = new BrowserWindow(buildMainWindowOptions(preloadPath));
  hardenWindow(window);
  window.once('ready-to-show', () => window.show());

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await window.loadURL('recovery://app/');
  }
}

app.whenReady().then(async () => {
  registerAppProtocol();
  registerIpcHandlers();
  await createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
