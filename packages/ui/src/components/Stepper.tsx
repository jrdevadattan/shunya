import { Check } from 'lucide-react';

export interface StepperStep {
  id: string;
  label: string;
  state: 'upcoming' | 'current' | 'complete';
}

/** Compact horizontal progress indicator for multi-screen flows. */
export function Stepper({ steps, ariaLabel = 'Progress' }: { steps: StepperStep[]; ariaLabel?: string }) {
  return (
    <ol className="stepper" aria-label={ariaLabel}>
      {steps.map((step, index) => (
        <li key={step.id} data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined} aria-label={`${step.label} — ${step.state === 'current' ? 'current step' : step.state}`}>
          <span className="stepper__dot" aria-hidden="true">{step.state === 'complete' ? <Check /> : index + 1}</span>
          <span>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
