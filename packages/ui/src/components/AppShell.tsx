import type { ReactNode } from 'react';

export interface NavigationItem { id: string; label: string; href: string }
export function AppShell({ header, navigation, children }: { header: ReactNode; navigation: NavigationItem[]; children: ReactNode }) {
  return <div className="app-shell"><header className="app-shell__header">{header}</header><aside className="app-shell__sidebar"><nav aria-label="Case navigation"><ul>{navigation.map((item) => <li key={item.id}><a href={item.href}>{item.label}</a></li>)}</ul></nav></aside><main className="app-shell__content">{children}</main></div>;
}
