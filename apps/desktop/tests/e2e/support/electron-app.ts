import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { _electron as electron } from '@playwright/test';

export function packagedLaunchArguments(appAsar: string, userDataPath: string): string[] {
  return [appAsar, `--user-data-dir=${userDataPath}`];
}

function packagedExecutablePath(): string {
  const packageRoot = path.resolve(`out/SIH Recovery Platform-${process.platform}-${process.arch}`);
  if (process.platform === 'win32') return path.join(packageRoot, 'recovery-platform.exe');
  if (process.platform === 'darwin') {
    return path.join(packageRoot, 'SIH Recovery Platform.app', 'Contents', 'MacOS', 'SIH Recovery Platform');
  }
  return path.join(packageRoot, 'recovery-platform');
}

function testHarnessElectronPath(): string {
  const electronRoot = [path.resolve('node_modules/electron/dist'), path.resolve('../../node_modules/electron/dist')]
    .find((candidate) => existsSync(candidate));
  if (!electronRoot) throw new Error('Electron test runtime is missing.');
  if (process.platform === 'win32') return path.join(electronRoot, 'electron.exe');
  if (process.platform === 'darwin') return path.join(electronRoot, 'Electron.app', 'Contents', 'MacOS', 'Electron');
  return path.join(electronRoot, 'electron');
}

export async function launchPackagedApp() {
  const packagedExecutable = packagedExecutablePath();
  if (!existsSync(packagedExecutable)) throw new Error(`packaged application is missing: ${packagedExecutable}`);
  const packageRoot = path.dirname(packagedExecutable);
  const appAsar = process.platform === 'darwin'
    ? path.resolve(packageRoot, '../Resources/app.asar')
    : path.join(packageRoot, 'resources', 'app.asar');
  const daemonPath = path.resolve(`../../target/release/${process.platform === 'win32' ? 'recoveryd.exe' : 'recoveryd'}`);
  const daemonEnvironment: Record<string, string> = {};
  if (existsSync(daemonPath)) {
    daemonEnvironment.RECOVERY_DAEMON_PATH = daemonPath;
    daemonEnvironment.RECOVERY_DAEMON_SHA256 = createHash('sha256').update(readFileSync(daemonPath)).digest('hex');
  }
  const inheritedEnvironment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
  const userDataPath = mkdtempSync(path.join(tmpdir(), 'sih-recovery-e2e-user-data-'));
  const electronApp = await electron.launch({
    executablePath: testHarnessElectronPath(),
    args: packagedLaunchArguments(appAsar, userDataPath),
    env: { ...inheritedEnvironment, ...daemonEnvironment, NODE_ENV: 'production', RECOVERY_RELEASE_BUILD: '1' },
  });
  electronApp.process().once('exit', () => rmSync(userDataPath, { recursive: true, force: true }));
  try {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#root').waitFor({ state: 'attached' });
    return electronApp;
  } catch (error) {
    await electronApp.close();
    throw error;
  }
}
