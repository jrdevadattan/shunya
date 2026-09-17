import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, compact = false, className = '' }: EmptyStateProps) {
  return (
    <div className={['empty', compact ? 'empty--compact' : '', className].filter(Boolean).join(' ')} role="status">
      <span className="empty__icon" aria-hidden="true"><Icon /></span>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  );
}
