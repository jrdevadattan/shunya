import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function MetricCard({ label, value, detail, icon: Icon, tone = 'neutral' }: {
  label: string;
  value: ReactNode;
  detail: string;
  icon: LucideIcon;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  return (
    <article className="metric-card" data-tone={tone}>
      <div className="metric-card__heading">
        <p>{label}</p>
        <span className="metric-card__icon" aria-hidden="true"><Icon /></span>
      </div>
      <strong>{value}</strong>
      <span className="metric-card__detail">{detail}</span>
    </article>
  );
}
