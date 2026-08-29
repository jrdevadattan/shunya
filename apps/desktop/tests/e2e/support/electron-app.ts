import path from 'node:path';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { _electron as electron } from '@playwright/test';

function packagedExecutablePath(): string {
  const packageRoot = path.resolve(`out/SIH Recovery Platform-${process.platform}-${process.arch}`);
  if (process.platform === 'win32') return path.join(packageRoot, 'recovery-platform.exe');
  if (process.platform === 'darwin') {
    return path.join(packageRoot, 'SIH Recovery Platform.app', 'Contents', 'MacOS', 'SIH Recovery Platform');
  }
  return path.join(packageRoot, 'recovery-platform');
}

export function launchPackagedApp() {
  const daemonPath = path.resolve(`../../target/release/${process.platform === 'win32' ? 'recoveryd.exe' : 'recoveryd'}`);
  const daemonEnvironment: Record<string, string> = {};
  if (existsSync(daemonPath)) {
    daemonEnvironment.RECOVERY_DAEMON_PATH = daemonPath;
    daemonEnvironment.RECOVERY_DAEMON_SHA256 = createHash('sha256').update(readFileSync(daemonPath)).digest('hex');
  }
  const inheritedEnvironment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
  return electron.launch({
    executablePath: packagedExecutablePath(),
    args: [],
    env: { ...inheritedEnvironment, ...daemonEnvironment, NODE_ENV: 'production', RECOVERY_RELEASE_BUILD: '1' },
  });
}
