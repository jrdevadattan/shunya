import { AppShell, ThemeToggle } from '@recovery/ui';
import { CircleCheck, Search } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { CommandPalette } from '../components/CommandPalette.js';
import {
  applyTheme,
  loadUiPreferences,
  saveUiPreferences,
  type UiPreferences,
} from '../features/preferences/ui-preferences.js';
import { caseNavigation } from './case-navigation.js';

interface ApplicationPreferencesValue {
  preferences: UiPreferences;
  updatePreferences(next: UiPreferences): void;
}

const ApplicationPreferencesContext = createContext<ApplicationPreferencesValue | null>(null);

export function useApplicationPreferences(): ApplicationPreferencesValue {
  const value = useContext(ApplicationPreferencesContext);
  if (!value) throw new Error('Application preferences must be used inside ApplicationShell.');
  return value;
}

export function ApplicationShell({ title, children }: { title: string; children: ReactNode }) {
  const location = useLocation();
  const [preferences, setPreferences] = useState<UiPreferences>(() => loadUiPreferences());
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const navigation = caseNavigation(null, location.pathname);

  useEffect(() => {
    return applyTheme(preferences.theme);
  }, [preferences.theme]);
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  const updatePreferences = (next: UiPreferences) => {
    setPreferences(next);
    saveUiPreferences(next);
  };

  return (
    <ApplicationPreferencesContext.Provider value={{ preferences, updatePreferences }}>
      <AppShell
        brand="SHUNYA Recovery"
        collapsed={preferences.sidebarCollapsed}
        onCollapsedChange={(sidebarCollapsed) => updatePreferences({ ...preferences, sidebarCollapsed })}
        navigation={navigation}
        header={(
          <div className="application-header">
            <strong>{title}</strong>
            <div className="application-header__actions">
              <button ref={searchTriggerRef} type="button" className="header-search" aria-label="Search screens and actions" onClick={() => setSearchOpen(true)}>
                <Search aria-hidden="true" /><span>Search</span><kbd>Ctrl K</kbd>
              </button>
              <ThemeToggle value={preferences.theme} onChange={(theme) => updatePreferences({ ...preferences, theme })} />
            </div>
          </div>
        )}
        footer={(
          <div className="sidebar-safety-status" role="status">
            <CircleCheck aria-hidden="true" />
            <span>Source writes blocked</span>
          </div>
        )}
      >
        {children}
      </AppShell>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} navigation={navigation} restoreFocusRef={searchTriggerRef} />
    </ApplicationPreferencesContext.Provider>
  );
}
