export type ThemePreference = 'light' | 'dark' | 'system';

export interface UiPreferences {
  theme: ThemePreference;
  sidebarCollapsed: boolean;
}

const preferenceKey = 'recovery:ui-preferences';
const defaults: UiPreferences = { theme: 'system', sidebarCollapsed: false };

export function loadUiPreferences(storage: Storage = localStorage): UiPreferences {
  try {
    const value: unknown = JSON.parse(storage.getItem(preferenceKey) ?? 'null');
    if (!value || typeof value !== 'object') return { ...defaults };
    const record = value as Record<string, unknown>;
    if (!isTheme(record.theme) || typeof record.sidebarCollapsed !== 'boolean') return { ...defaults };
    return { theme: record.theme, sidebarCollapsed: record.sidebarCollapsed };
  } catch {
    return { ...defaults };
  }
}

export function saveUiPreferences(preferences: UiPreferences, storage: Storage = localStorage): void {
  storage.setItem(preferenceKey, JSON.stringify(preferences));
}

export function applyTheme(theme: ThemePreference): () => void {
  if (theme !== 'system') {
    document.documentElement.dataset.theme = theme;
    return () => undefined;
  }

  if (typeof matchMedia !== 'function') {
    document.documentElement.dataset.theme = 'light';
    return () => undefined;
  }
  const media = matchMedia('(prefers-color-scheme: dark)');
  const update = (event: Pick<MediaQueryListEvent, 'matches'> | MediaQueryList) => {
    document.documentElement.dataset.theme = event.matches ? 'dark' : 'light';
  };
  update(media);
  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
}

function isTheme(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}
