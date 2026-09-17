import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerZIP } from '@electron-forge/maker-zip';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: 'recovery-platform',
    extraResource: ['resources'],
    ...(process.env.MAC_CODESIGN_IDENTITY ? {
      osxSign: {
        identity: process.env.MAC_CODESIGN_IDENTITY,
        optionsForFile: () => ({ entitlements: 'entitlements.mac.plist', hardenedRuntime: true }),
      },
    } : {}),
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel(
      {
        name: 'sih_recovery_platform',
        setupExe: 'SIH-Recovery-Platform-Setup.exe',
        ...(process.env.WINDOWS_CERTIFICATE_FILE ? {
          certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
          certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
        } : {}),
      },
      ['win32'],
    ),
    new MakerDeb({
      options: {
        name: 'sih-recovery-platform',
        productName: 'SIH Recovery Platform',
        genericName: 'Forensic Recovery Workstation',
        description: 'Offline-first read-only forensic recovery workstation',
        section: 'utils',
        priority: 'optional',
        categories: ['System', 'Utility'],
        bin: 'recovery-platform',
        maintainer: 'SIH 26149 Recovery Team',
        homepage: 'https://github.com/jrdevadattan/sih_winners_26',
      },
    }, ['linux']),
    new MakerDMG({ format: 'ULFO' }, ['darwin']),
    new MakerZIP({}, ['darwin']),
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/main.ts', config: 'vite.main.config.ts' },
        { entry: 'src/preload/preload.ts', config: 'vite.preload.config.ts' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      resetAdHocDarwinSignature: true,
      strictlyRequireAllFuses: true,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
      [FuseV1Options.WasmTrapHandlers]: true,
    }),
  ],
};

export default config;
