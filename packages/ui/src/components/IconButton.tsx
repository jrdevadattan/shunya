import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  label: string;
  icon: LucideIcon;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon: Icon, className = '', type = 'button', ...props },
  ref,
) {
  return (
    <button {...props} ref={ref} type={type} className={['icon-button', className].filter(Boolean).join(' ')} aria-label={label} title={label}>
      <Icon aria-hidden="true" />
    </button>
  );
});
