import { CapabilityBanner } from '@recovery/ui';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';

export function DamagedDeviceWizard() {
  return <WorkflowFrame eyebrow="Rescue Mode only" title="Damaged device recovery" description="Repeated reading can worsen a failing device. Image healthy regions first and persist the recovery map." steps={[{ id: 'source', label: 'Source', state: 'complete' }, { id: 'strategy', label: 'Imaging strategy', state: 'current' }, { id: 'recovery', label: 'Recovery', state: 'upcoming' }]}>
    <CapabilityBanner level="warning" title="Damaged-device workflow unavailable" explanation="The current daemon does not expose typed ddrescue progress or controls. No rescued, unreadable, or pending ranges are simulated." />
    <code>DDRESCUE_UI_UNAVAILABLE</code><button className="button button--primary" type="button" disabled title="ddrescue controls are unavailable">Start first pass</button>
  </WorkflowFrame>;
}
