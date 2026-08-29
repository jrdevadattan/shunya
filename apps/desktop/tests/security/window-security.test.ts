import { describe, expect, it } from 'vitest';
import { buildMainWindowOptions } from '../../src/main/windows.js';

describe('main window security', () => {
  it('creates a sandboxed and context-isolated renderer', () => {
    const options = buildMainWindowOptions('C:/app/preload.js');

    expect(options.webPreferences?.nodeIntegration).toBe(false);
    expect(options.webPreferences?.contextIsolation).toBe(true);
    expect(options.webPreferences?.sandbox).toBe(true);
    expect(options.webPreferences?.webSecurity).toBe(true);
  });

  it('disables DevTools in every packaged build regardless of environment variables', () => {
    const options = buildMainWindowOptions('C:/app/preload.js', true);
    expect(options.webPreferences?.devTools).toBe(false);
  });
});
