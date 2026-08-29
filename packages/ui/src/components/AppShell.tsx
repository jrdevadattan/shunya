import { PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

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
  const collapseLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <div className="app-shell" data-collapsed={String(collapsed)} data-testid="app-shell">
      <aside className="app-shell__sidebar" aria-label="Application sidebar">
        <div className="app-shell__brand">
          <span className="app-shell__brand-mark" aria-hidden="true"><ShieldCheck /></span>
          <strong className="app-shell__brand-label">{brand}</strong>
        </div>

        <nav className="app-shell__navigation" aria-label="Case navigation">
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
                          <button type="button" className="navigation-item" aria-disabled="true" title={`${item.label}: ${item.disabledReason}`}>
                            {content}
                          </button>
                          <span className="navigation-item__disabled-reason">{item.disabledReason}</span>
                        </div>
                      ) : (
                        <a className="navigation-item" href={item.href} aria-current={item.active ? 'page' : undefined} title={collapsed ? item.label : undefined}>
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
        <button type="button" className="app-shell__collapse" aria-label={collapseLabel} title={collapseLabel} onClick={() => onCollapsedChange(!collapsed)}>
          <CollapseIcon aria-hidden="true" />
          <span className="app-shell__collapse-label">{collapseLabel}</span>
        </button>
      </aside>

      <header className="app-shell__header" data-height="48">{header}</header>
      <main className="app-shell__content">{children}</main>
    </div>
  );
}
