import { describe, expect, it } from 'vitest';
import { packagedLaunchArguments } from '../e2e/support/electron-app.js';

describe('packaged E2E Electron profile', () => {
  it('launches the packaged app with an isolated user-data directory', () => {
    expect(packagedLaunchArguments('C:/package/resources/app.asar', 'C:/temp/recovery-e2e-profile')).toEqual([
      'C:/package/resources/app.asar',
      '--user-data-dir=C:/temp/recovery-e2e-profile',
    ]);
  });
});
