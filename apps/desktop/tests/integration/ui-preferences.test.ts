// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  loadUiPreferences,
  saveUiPreferences,
} from '../../src/renderer/features/preferences/ui-preferences.js';

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  vi.restoreAllMocks();
});

describe('UI preferences', () => {
  it('falls back for missing or malformed local preference data', () => {
    expect(loadUiPreferences()).toEqual({ theme: 'system', sidebarCollapsed: false });
    localStorage.setItem('recovery:ui-preferences', '{bad json');
    expect(loadUiPreferences()).toEqual({ theme: 'system', sidebarCollapsed: false });
    localStorage.setItem('recovery:ui-preferences', JSON.stringify({ theme: 'midnight', sidebarCollapsed: 'yes' }));
    expect(loadUiPreferences()).toEqual({ theme: 'system', sidebarCollapsed: false });
  });

  it('persists only the validated theme and collapsed state', () => {
    saveUiPreferences({ theme: 'dark', sidebarCollapsed: true });
    expect(JSON.parse(localStorage.getItem('recovery:ui-preferences')!)).toEqual({
      theme: 'dark',
      sidebarCollapsed: true,
    });
  });

  it('resolves system theme changes and detaches the listener on cleanup', () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const media = {
      matches: true,
      addEventListener: vi.fn((_name: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)),
      removeEventListener: vi.fn((_name: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener)),
    } as unknown as MediaQueryList;
    vi.stubGlobal('matchMedia', vi.fn(() => media));

    const cleanup = applyTheme('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
    listeners.forEach((listener) => listener({ matches: false } as MediaQueryListEvent));
    expect(document.documentElement.dataset.theme).toBe('light');
    cleanup();
    expect(media.removeEventListener).toHaveBeenCalled();
  });
});
