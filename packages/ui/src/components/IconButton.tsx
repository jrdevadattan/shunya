import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  label: string;
  icon: LucideIcon;
}

export function IconButton({ label, icon: Icon, className = '', type = 'button', ...props }: IconButtonProps) {
  return (
    <button {...props} type={type} className={['icon-button', className].filter(Boolean).join(' ')} aria-label={label} title={label}>
      <Icon aria-hidden="true" />
    </button>
  );
}
