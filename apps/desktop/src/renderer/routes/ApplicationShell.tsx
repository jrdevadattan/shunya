import { AppShell, IconButton } from '@recovery/ui';
import { CircleCheck, Search } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { CommandPalette } from '../components/CommandPalette.js';
import {
  applyTheme,
  loadUiPreferences,
  saveUiPreferences,
  type UiPreferences,
} from '../features/preferences/ui-preferences.js';
import { caseNavigation } from './case-navigation.js';

export function ApplicationShell({ title, children }: { title: string; children: ReactNode }) {
  const location = useLocation();
  const [preferences, setPreferences] = useState<UiPreferences>(() => loadUiPreferences());
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const navigation = caseNavigation(null, location.pathname);

  useEffect(() => applyTheme(preferences.theme), [preferences.theme]);
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
    <>
      <AppShell
        brand="SHUNYA Recovery"
        collapsed={preferences.sidebarCollapsed}
        onCollapsedChange={(sidebarCollapsed) => updatePreferences({ ...preferences, sidebarCollapsed })}
        navigation={navigation}
        header={(
          <div className="application-header">
            <strong>{title}</strong>
            <div className="application-header__actions">
              <IconButton ref={searchTriggerRef} label="Search screens and actions" icon={Search} onClick={() => setSearchOpen(true)} />
              <select
                aria-label="Theme"
                value={preferences.theme}
                onChange={(event) => updatePreferences({ ...preferences, theme: event.target.value as UiPreferences['theme'] })}
              >
                <option value="system">System theme</option>
                <option value="light">Light theme</option>
                <option value="dark">Dark theme</option>
              </select>
            </div>
          </div>
        )}
        footer={(
          <div className="sidebar-safety-status" role="status">
            <CircleCheck aria-hidden="true" />
            <span><strong>Source writes blocked</strong><small>Read-only recovery safeguards</small></span>
          </div>
        )}
      >
        {children}
      </AppShell>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} navigation={navigation} restoreFocusRef={searchTriggerRef} />
    </>
  );
}
