import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface AdvancedSectionProps {
  /** Short label, e.g. "Advanced options". */
  title?: string;
  /** One line that tells a non-technical user what is inside and that it is optional. */
  summary?: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  quiet?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Progressive disclosure for technical or rarely-needed controls. The simple
 * path stays visible; everything inside is one click away but never in the way.
 */
export function AdvancedSection({ title = 'Advanced options', summary, icon: Icon = SlidersHorizontal, defaultOpen = false, quiet = false, className = '', children }: AdvancedSectionProps) {
  return (
    <details className={['disclosure', quiet ? 'disclosure--quiet' : '', className].filter(Boolean).join(' ')} open={defaultOpen || undefined}>
      <summary>
        <span className="disclosure__icon" aria-hidden="true"><Icon /></span>
        <span className="disclosure__text"><strong>{title}</strong>{summary ? <small>{summary}</small> : null}</span>
        <ChevronDown className="disclosure__chevron" aria-hidden="true" />
      </summary>
      <div className="disclosure__body">{children}</div>
    </details>
  );
}
