import { Menu } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
  badge?: string;
  disabledReason?: string;
}

export interface NavigationGroup {
  id: string;
  label: string;
  items: NavigationItem[];
}

export interface AppShellProps {
  brand: string;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  header: ReactNode;
  navigation: NavigationGroup[];
  footer: ReactNode;
  children: ReactNode;
}

export function AppShell({ brand, collapsed, onCollapsedChange, header, navigation, footer, children }: AppShellProps) {
  const [responsiveCollapsed, setResponsiveCollapsed] = useState(() => compactViewport().matches);
  const effectiveCollapsed = collapsed || responsiveCollapsed;
  const collapseLabel = responsiveCollapsed
    ? 'Sidebar collapsed for this window width'
    : collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  const [wordmark = brand, ...subtitleParts] = brand.split(' ');
  const subtitle = subtitleParts.join(' ');
  const approvedTokens = {
    '--accent-primary': '#f56600',
    '--status-success': '#2da44e',
  } as CSSProperties;

  useEffect(() => {
    const query = compactViewport();
    const onChange = (event: MediaQueryListEvent) => setResponsiveCollapsed(event.matches);
    setResponsiveCollapsed(query.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  return (
    <div className="app-shell" data-collapsed={String(effectiveCollapsed)} data-responsive-collapsed={String(responsiveCollapsed)} data-testid="app-shell" style={approvedTokens}>
      <aside className="app-shell__sidebar" aria-label="Application sidebar">
        <div className="app-shell__brand">
          <span className="app-shell__brand-wordmark" aria-label={brand}>
            <strong>{wordmark}</strong>
            {subtitle ? <small>{subtitle}</small> : null}
          </span>
          <button
            type="button"
            className="app-shell__collapse"
            aria-label={collapseLabel}
            aria-controls="app-sidebar-navigation"
            aria-expanded={!effectiveCollapsed}
            disabled={responsiveCollapsed}
            title={collapseLabel}
            onClick={() => onCollapsedChange(!collapsed)}
          >
            <Menu aria-hidden="true" />
          </button>
        </div>

        <nav id="app-sidebar-navigation" className="app-shell__navigation" aria-label="Case navigation">
          {navigation.map((group) => (
            <section className="navigation-group" key={group.id} aria-labelledby={`navigation-${group.id}`}>
              <h2 id={`navigation-${group.id}`}>{group.label}</h2>
              <ul>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const content = (
                    <>
                      <Icon aria-hidden="true" />
                      <span className="navigation-item__label">{item.label}</span>
                      {item.badge ? <span className="navigation-item__badge">{item.badge}</span> : null}
                    </>
                  );

                  return (
                    <li key={item.id}>
                      {item.disabledReason ? (
                        <div className="navigation-item__disabled">
                          <button type="button" className="navigation-item" aria-label={item.label} aria-disabled="true" title={`${item.label}: ${item.disabledReason}`}>
                            {content}
                          </button>
                          <span className="navigation-item__disabled-reason">{item.disabledReason}</span>
                        </div>
                      ) : (
                        <a className="navigation-item" href={item.href} aria-label={item.label} aria-current={item.active ? 'page' : undefined} title={effectiveCollapsed ? item.label : undefined}>
                          {content}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>

        <div className="app-shell__sidebar-footer">{footer}</div>
      </aside>

      <header className="app-shell__header" data-height="64">{header}</header>
      <main className="app-shell__content">{children}</main>
    </div>
  );
}

function compactViewport(): Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'> {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') return window.matchMedia('(max-width: 760px)');
  return { matches: false, addEventListener: () => undefined, removeEventListener: () => undefined };
}
