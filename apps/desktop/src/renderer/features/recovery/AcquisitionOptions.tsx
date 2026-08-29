import { CapabilityBanner } from '@recovery/ui';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';

export function AcquisitionOptions() {
  return <WorkflowFrame eyebrow="Create a forensic image" title="Healthy device acquisition" description="Physical devices require a narrowly scoped read-only privileged helper." steps={[{ id: 'source', label: 'Source', state: 'complete' }, { id: 'destination', label: 'Destination', state: 'complete' }, { id: 'acquisition', label: 'Acquisition', state: 'current' }]}>
    <CapabilityBanner level="warning" title="Acquisition capability unavailable" explanation="The current daemon does not expose a typed acquisition request or destination assessment. No source size, required space, block size, or completion state is simulated." />
    <code>ACQUISITION_UI_UNAVAILABLE</code><p>Use Rescue Mode for the current system disk.</p><button className="button button--primary" type="button" disabled title="Acquisition capability is unavailable">Create verified image</button>
  </WorkflowFrame>;
}
