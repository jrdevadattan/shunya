import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

type BannerLevel = 'success' | 'warning' | 'danger' | 'info';
const icons: Record<BannerLevel, ReactNode> = {
  success: <CheckCircle2 aria-hidden="true" />, warning: <TriangleAlert aria-hidden="true" />,
  danger: <AlertCircle aria-hidden="true" />, info: <Info aria-hidden="true" />,
};
const names: Record<BannerLevel, string> = {
  success: 'Success', warning: 'Warning', danger: 'Danger', info: 'Information',
};

export interface CapabilityBannerProps {
  level: BannerLevel;
  title: string;
  explanation: string;
  action?: ReactNode;
}

export function CapabilityBanner({ level, title, explanation, action }: CapabilityBannerProps) {
  return (
    <section className={`capability-banner capability-banner--${level}`} role={level === 'danger' ? 'alert' : 'status'} aria-label={`${names[level]}: ${title}`}>
      <span className="capability-banner__icon">{icons[level]}</span>
      <div><strong>{title}</strong><p>{explanation}</p>{action}</div>
    </section>
  );
}
