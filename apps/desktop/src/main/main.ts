import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { app, BrowserWindow, net, protocol } from 'electron';
import { DaemonSupervisor } from './daemon-supervisor.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { hardenWindow } from './security.js';
import { buildMainWindowOptions } from './windows.js';
import { registerSecureEraseHandlers } from './secure-erase/ipc.js';

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
  const window = new BrowserWindow(buildMainWindowOptions(preloadPath, app.isPackaged));
  hardenWindow(window, !app.isPackaged);
  window.once('ready-to-show', () => window.show());

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await window.loadURL('recovery://app/');
  }
}

app.enableSandbox();
app.whenReady().then(async () => {
  registerAppProtocol();
  const daemon = await startDaemon();
  registerIpcHandlers(daemon);
  registerSecureEraseHandlers();
  await createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

async function startDaemon(): Promise<DaemonSupervisor | undefined> {
  const executablePath = process.env.RECOVERY_DAEMON_PATH;
  const expectedSha256 = process.env.RECOVERY_DAEMON_SHA256;
  if (executablePath && expectedSha256) {
    const daemon = new DaemonSupervisor({ executablePath, expectedSha256 });
    await daemon.start();
    return daemon;
  }
  if (!app.isPackaged) return undefined;

  const bundledResources = path.join(process.resourcesPath, 'resources');
  const bundledExecutable = path.join(bundledResources, process.platform === 'win32' ? 'recoveryd.exe' : 'recoveryd');
  const manifestPath = path.join(bundledResources, 'recoveryd.sha256');
  try {
    const expectedHash = (await readFile(manifestPath, 'utf8')).trim().split(/\s+/)[0];
    if (!expectedHash) return undefined;
    const daemon = new DaemonSupervisor({ executablePath: bundledExecutable, expectedSha256: expectedHash });
    await daemon.start();
    return daemon;
  } catch {
    return undefined;
  }
}
