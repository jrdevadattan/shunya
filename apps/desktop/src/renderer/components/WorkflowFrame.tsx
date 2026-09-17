import { Stepper, SurfaceCard } from '@recovery/ui';
import { useId, type ReactNode } from 'react';

export interface WorkflowStep {
  id: string;
  label: string;
  state: 'upcoming' | 'current' | 'complete';
}

export interface WorkflowFrameProps {
  eyebrow: string;
  title: string;
  description: string;
  steps: WorkflowStep[];
  aside?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/** Shared frame for the recovery flow: heading, step indicator, content card, optional aside. */
export function WorkflowFrame({ eyebrow, title, description, steps, aside, actions, children }: WorkflowFrameProps) {
  const titleId = useId();
  return (
    <section className="workflow-frame" aria-labelledby={titleId}>
      <div className="page-header__row">
        <header className="workflow-frame__heading">
          <p className="eyebrow">{eyebrow}</p>
          <h1 id={titleId}>{title}</h1>
          <p>{description}</p>
        </header>
        <Stepper steps={steps} ariaLabel="Recovery workflow progress" />
      </div>
      <div className={aside ? 'workflow-frame__layout' : 'workflow-frame__layout workflow-frame__layout--single'}>
        <SurfaceCard className="workflow-frame__content">{children}</SurfaceCard>
        {aside ? <aside className="workflow-frame__aside" aria-label="Safety and capability guidance">{aside}</aside> : null}
      </div>
      {actions ? <footer className="workflow-frame__actions">{actions}</footer> : null}
    </section>
  );
}
