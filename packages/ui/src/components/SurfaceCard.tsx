import { useId, type ReactNode } from 'react';

export interface SurfaceCardProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function SurfaceCard({ title, description, actions, className = '', children }: SurfaceCardProps) {
  const titleId = useId();
  const classes = ['surface-card', className].filter(Boolean).join(' ');
  const content = (
    <>
      {title || description || actions ? (
        <header className="surface-card__header">
          <div>
            {title ? <h2 id={titleId}>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="surface-card__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="surface-card__body">{children}</div>
    </>
  );

  return title
    ? <section className={classes} aria-labelledby={titleId}>{content}</section>
    : <div className={classes}>{content}</div>;
}
