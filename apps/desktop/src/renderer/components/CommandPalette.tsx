import type { NavigationGroup, NavigationItem } from '@recovery/ui';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigation: NavigationGroup[];
  restoreFocusRef: RefObject<HTMLButtonElement | null>;
}

export function CommandPalette({ open, onOpenChange, navigation, restoreFocusRef }: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const items = useMemo(
    () => navigation.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label }))),
    [navigation],
  );
  const visible = items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    queueMicrotask(() => inputRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
        queueMicrotask(() => restoreFocusRef.current?.focus());
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('input, button:not([disabled])'));
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenChange, open, restoreFocusRef]);

  if (!open) return null;

  const close = () => {
    onOpenChange(false);
    queueMicrotask(() => restoreFocusRef.current?.focus());
  };
  const select = (item: NavigationItem) => {
    if (item.disabledReason) return;
    navigate(item.href.replace(/^#/, ''));
    close();
  };

  return (
    <div className="command-palette__backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
      <div ref={dialogRef} className="command-palette" role="dialog" aria-label="Command search" aria-modal="true">
        <label className="command-palette__search">
          <Search aria-hidden="true" />
          <span className="sr-only">Search screens and actions</span>
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search screens and actions…" />
          <kbd>Esc</kbd>
        </label>
        <div className="command-palette__results">
          {visible.length ? visible.map((item) => (
            <button key={item.id} type="button" disabled={Boolean(item.disabledReason)} onClick={() => select(item)}>
              <item.icon aria-hidden="true" />
              <span><strong>{item.label}</strong><small>{item.disabledReason ?? item.group}</small></span>
            </button>
          )) : <p>No matching screen</p>}
        </div>
      </div>
    </div>
  );
}
