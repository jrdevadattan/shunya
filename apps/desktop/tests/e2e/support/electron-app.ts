import path from 'node:path';
import { _electron as electron } from '@playwright/test';

function packagedExecutablePath(): string {
  const packageRoot = path.resolve(`out/@recovery-desktop-${process.platform}-${process.arch}`);
  if (process.platform === 'win32') return path.join(packageRoot, '@recovery-desktop.exe');
  if (process.platform === 'darwin') {
    return path.join(packageRoot, '@recovery-desktop.app', 'Contents', 'MacOS', '@recovery-desktop');
  }
  return path.join(packageRoot, '@recovery-desktop');
}

export function launchPackagedApp() {
  return electron.launch({
    executablePath: packagedExecutablePath(),
    args: [],
    env: { ...process.env, NODE_ENV: 'production', RECOVERY_RELEASE_BUILD: '1' },
  });
}
