import { CapabilityBanner, InfoPopover } from '@recovery/ui';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';

export function DestinationPage() {
  return <WorkflowFrame eyebrow="Recovery setup" title="Choose destination" description="Image destination and recovered-file export destination are selected separately." steps={[{ id: 'source', label: 'Source', state: 'complete' }, { id: 'destination', label: 'Destination', state: 'current' }, { id: 'acquisition', label: 'Acquisition', state: 'upcoming' }]} aside={<InfoPopover title="Why am I seeing this?">The daemon must resolve both locations to physical device identities before allowing output. Export performs that proof at export time.</InfoPopover>}>
    <CapabilityBanner level="warning" title="Destination assessment unavailable" explanation="No typed acquisition-destination assessment is exposed by the current daemon. No free-space or physical-separation result is assumed." />
    <button className="button button--primary" type="button" disabled title="Destination assessment is unavailable">Continue</button>
  </WorkflowFrame>;
}
