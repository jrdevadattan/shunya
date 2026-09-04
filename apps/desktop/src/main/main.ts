import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
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
    return startSupervisor({ executablePath, expectedSha256 });
  }

  if (!app.isPackaged) {
    const devDaemon = await resolveDevDaemon();
    if (!devDaemon) {
      console.warn(
        '[recovery] No recovery daemon found for development. Build it with ' +
          '`cargo build -p recovery-daemon --release` (or set RECOVERY_DAEMON_PATH and ' +
          'RECOVERY_DAEMON_SHA256). Recovery actions will report DAEMON_UNAVAILABLE until it exists.',
      );
      return undefined;
    }
    console.info(`[recovery] Using development recovery daemon at ${devDaemon.executablePath}`);
    return startSupervisor(devDaemon);
  }

  const bundledResources = path.join(process.resourcesPath, 'resources');
  const bundledExecutable = path.join(bundledResources, process.platform === 'win32' ? 'recoveryd.exe' : 'recoveryd');
  const manifestPath = path.join(bundledResources, 'recoveryd.sha256');
  try {
    const expectedHash = (await readFile(manifestPath, 'utf8')).trim().split(/\s+/)[0];
    if (!expectedHash) return undefined;
    return startSupervisor({ executablePath: bundledExecutable, expectedSha256: expectedHash });
  } catch {
    return undefined;
  }
}

// Starts a supervisor and degrades loudly (returns undefined -> DAEMON_UNAVAILABLE)
// instead of crashing the app when the daemon binary is missing or fails verification.
async function startSupervisor(
  options: { executablePath: string; expectedSha256: string },
): Promise<DaemonSupervisor | undefined> {
  try {
    const daemon = new DaemonSupervisor(options);
    await daemon.start();
    return daemon;
  } catch (error) {
    console.error('[recovery] Recovery daemon failed to start:', error);
    return undefined;
  }
}

// In development (`pnpm start`) there is no packaged resources dir and no signing
// manifest, so locate the locally built daemon and self-hash it. Prefer an explicit
// RECOVERY_DAEMON_DIR, then the release build, then the debug build.
async function resolveDevDaemon(): Promise<{ executablePath: string; expectedSha256: string } | undefined> {
  const binaryName = process.platform === 'win32' ? 'recoveryd.exe' : 'recoveryd';
  const repoRoot = path.resolve(app.getAppPath(), '..', '..');
  const overrideDir = process.env.RECOVERY_DAEMON_DIR;
  const candidateDirs = [
    ...(overrideDir ? [overrideDir] : []),
    path.join(repoRoot, 'target', 'release'),
    path.join(repoRoot, 'target', 'debug'),
  ];
  for (const directory of candidateDirs) {
    const executablePath = path.join(directory, binaryName);
    try {
      const contents = await readFile(executablePath);
      const expectedSha256 = createHash('sha256').update(contents).digest('hex');
      return { executablePath, expectedSha256 };
    } catch {
      // Not present in this directory; try the next candidate.
    }
  }
  return undefined;
}
