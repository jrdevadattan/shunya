import { Laptop, ShieldCheck } from 'lucide-react';
import type { RuntimeMode } from '@recovery/contracts';

export function RuntimeModeBadge({ mode }: { mode: RuntimeMode }) {
  const rescue = mode === 'rescue';
  return <span className={`mode-badge mode-badge--${mode}`}>{rescue ? <ShieldCheck aria-hidden="true" /> : <Laptop aria-hidden="true" />}{rescue ? 'Rescue Mode' : 'Installed Mode'}</span>;
}
