import type { BrowserWindowConstructorOptions } from 'electron';

export function buildMainWindowOptions(preloadPath: string, packaged = false): BrowserWindowConstructorOptions {
  return {
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    backgroundColor: '#f5f7fa',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: !packaged,
    },
  };
}
