import type { ReactNode } from 'react';

export interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Slot rendered under the title row (steppers, chips). */
  below?: ReactNode;
  className?: string;
  titleId?: string;
}

export function PageHeader({ eyebrow, title, description, actions, below, className = '', titleId }: PageHeaderProps) {
  return (
    <header className={['page-header', className].filter(Boolean).join(' ')}>
      <div className="page-header__row">
        <div className="page-header__text">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 id={titleId}>{title}</h1>
          {description ? <p className="page-header__description">{description}</p> : null}
        </div>
        {actions ? <div className="page-header__actions">{actions}</div> : null}
      </div>
      {below ? <div className="page-header__below">{below}</div> : null}
    </header>
  );
}
