import path from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';

function packagedExecutablePath(): string {
  const packageRoot = path.resolve(`out/@recovery-desktop-${process.platform}-${process.arch}`);
  if (process.platform === 'win32') return path.join(packageRoot, '@recovery-desktop.exe');
  if (process.platform === 'darwin') {
    return path.join(packageRoot, '@recovery-desktop.app', 'Contents', 'MacOS', '@recovery-desktop');
  }
  return path.join(packageRoot, '@recovery-desktop');
}

test('security shell keeps Node globals out of the renderer', async () => {
  const electronApp = await electron.launch({
    executablePath: packagedExecutablePath(),
    args: [],
    env: { ...process.env, NODE_ENV: 'production', RECOVERY_RELEASE_BUILD: '1' },
  });

  try {
    const page = await electronApp.firstWindow();
    expect(await page.evaluate(() => typeof (window as Window & { require?: unknown }).require)).toBe('undefined');
    expect(await page.evaluate(() => typeof (window as Window & { process?: unknown }).process)).toBe('undefined');
  } finally {
    await electronApp.close();
  }
});
