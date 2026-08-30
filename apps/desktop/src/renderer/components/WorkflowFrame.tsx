import { Check } from 'lucide-react';
import { SurfaceCard } from '@recovery/ui';
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

export function WorkflowFrame({ eyebrow, title, description, steps, aside, actions, children }: WorkflowFrameProps) {
  const titleId = useId();
  return (
    <section className="workflow-frame" aria-labelledby={titleId}>
      <header className="workflow-frame__heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id={titleId}>{title}</h1>
        <p>{description}</p>
      </header>
      <ol className="workflow-frame__steps" aria-label="Recovery workflow progress">
        {steps.map((step, index) => (
          <li
            key={step.id}
            data-state={step.state}
            aria-current={step.state === 'current' ? 'step' : undefined}
            aria-label={`${step.label} — ${step.state === 'current' ? 'current step' : step.state}`}
          >
            <span className="workflow-frame__step-icon" aria-hidden="true">{step.state === 'complete' ? <Check /> : index + 1}</span>
            <span><strong>{step.label}</strong><small>{step.state === 'complete' ? 'Complete' : step.state === 'current' ? 'Current' : 'Upcoming'}</small></span>
          </li>
        ))}
      </ol>
      <div className={aside ? 'workflow-frame__layout' : 'workflow-frame__layout workflow-frame__layout--single'}>
        <SurfaceCard className="workflow-frame__content">{children}</SurfaceCard>
        {aside ? <aside className="workflow-frame__aside" aria-label="Safety and capability guidance">{aside}</aside> : null}
      </div>
      {actions ? <footer className="workflow-frame__actions">{actions}</footer> : null}
    </section>
  );
}
