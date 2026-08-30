import { AppShell, IconButton, RuntimeModeBadge } from '@recovery/ui';
import { RecoveryCaseSchema, RuntimeInfoSchema, type RecoveryCase } from '@recovery/contracts';
import { CircleCheck, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { activeWorkspace, forgetCase, rememberValidatedCase, validatedCase } from '../application-state.js';
import { CommandPalette } from '../components/CommandPalette.js';
import {
  applyTheme,
  loadUiPreferences,
  saveUiPreferences,
  type UiPreferences,
} from '../features/preferences/ui-preferences.js';
import { activeNavigationItem, caseCommandNavigation, caseNavigation } from './case-navigation.js';
import { rememberRecentCase } from '../features/cases/recent-cases.js';

export function CaseLayout() {
  const { caseId = 'case' } = useParams();
  const location = useLocation();
  const [runtimeMode, setRuntimeMode] = useState<'installed' | 'rescue'>('installed');
  const [recoveryCase, setRecoveryCase] = useState<RecoveryCase>();
  const [error, setError] = useState<string>();
  const [preferences, setPreferences] = useState<UiPreferences>(() => loadUiPreferences());
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const navigation = caseNavigation(caseId, location.pathname);
  const commandNavigation = caseCommandNavigation(caseId, location.pathname);
  const activeItem = activeNavigationItem(navigation);

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

  useEffect(() => {
    let active = true;
    const workspace = activeWorkspace(caseId);
    setRecoveryCase(undefined);
    setError(undefined);
    void window.recoveryApi.getRuntimeInfo()
      .then((value) => { if (active) setRuntimeMode(RuntimeInfoSchema.parse(value).mode); })
      .catch((cause) => { if (active) setError(message(cause)); });
    if (!workspace) {
      forgetCase(caseId);
      setError('Case context is unavailable. Open or create the case again.');
    } else if (validatedCase(caseId, workspace)) {
      setRecoveryCase(validatedCase(caseId, workspace) ?? undefined);
    } else {
      void window.recoveryApi.openCase(workspace).then((value) => {
        if (!active) return;
        const opened = RecoveryCaseSchema.parse(value);
        if (opened.caseId !== caseId) {
          forgetCase(caseId);
          setError('The opened case does not match the requested case. Open the intended case again.');
          return;
        }
        rememberValidatedCase(opened);
        rememberRecentCase(opened);
        setRecoveryCase(opened);
      }).catch((cause) => {
        if (!active) return;
        forgetCase(caseId);
        setError(message(cause));
      });
    }
    return () => { active = false; };
  }, [caseId]);

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
          <div className="case-header">
            <div className="case-header__title">
              <strong>{activeItem?.label ?? 'Recovery workspace'}</strong>
              {recoveryCase ? <span className="case-header__case">{recoveryCase.title}</span> : null}
              {error ? <span role="alert">{error}</span> : null}
            </div>
            <div className="case-header__actions">
              <IconButton ref={searchTriggerRef} label="Search screens and actions" icon={Search} onClick={() => setSearchOpen(true)} />
              <span className="case-header__shortcut" aria-hidden="true">Ctrl K</span>
              <select
                aria-label="Theme"
                value={preferences.theme}
                onChange={(event) => updatePreferences({ ...preferences, theme: event.target.value as UiPreferences['theme'] })}
              >
                <option value="system">System theme</option>
                <option value="light">Light theme</option>
                <option value="dark">Dark theme</option>
              </select>
              <RuntimeModeBadge mode={runtimeMode} />
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
        {recoveryCase?.caseId === caseId
          ? <Outlet />
          : <p role="status">{error ? 'Case content is unavailable.' : 'Opening case…'}</p>}
      </AppShell>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} navigation={commandNavigation} restoreFocusRef={searchTriggerRef} />
    </>
  );
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'The case could not be opened.';
}
