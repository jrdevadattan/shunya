import { CapabilityBanner, InfoPopover } from '@recovery/ui';
import { SourceDescriptorSchema, type SourceDescriptor } from '@recovery/contracts';
import { useEffect, useState } from 'react';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';
import { activeSourceId } from '../../application-state.js';
import { ArrowRight, CircleHelp, FileImage, FolderLock, HardDrive, ShieldAlert } from 'lucide-react';
import { useParams } from 'react-router-dom';

export function DestinationPage() {
  const { caseId = '' } = useParams();
  const [source, setSource] = useState<SourceDescriptor>();
  useEffect(() => {
    let active = true;
    const sourceId = activeSourceId(caseId);
    if (!sourceId) return () => { active = false; };
    void window.recoveryApi.listSources().then((items) => {
      if (active) setSource(SourceDescriptorSchema.array().parse(items).find((item) => item.sourceId === sourceId));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [caseId]);

  return <WorkflowFrame eyebrow="Recovery setup" title="Choose destination" description="A destination can be used only after the daemon proves it is separate from the read-only source and has enough space." steps={[{ id: 'source', label: 'Source', state: 'complete' }, { id: 'destination', label: 'Destination', state: 'current' }, { id: 'acquisition', label: 'Acquisition', state: 'upcoming' }]} aside={<InfoPopover title="Why am I seeing this?">The daemon must resolve both locations to physical device identities before allowing output. Export performs that proof at export time.</InfoPopover>}>
    <figure className="destination-relationship" aria-label="Source and destination safety relationship">
      <div className="destination-relationship__node">{source?.kind === 'physical_device' ? <HardDrive aria-hidden="true" /> : <FileImage aria-hidden="true" />}<span><strong>{source?.displayName ?? 'No active source'}</strong><small>{source ? 'Read-only recovery source' : 'Return to Sources to select one'}</small></span></div>
      <div className="destination-relationship__state"><ShieldAlert aria-hidden="true" /><strong>Separation unverified</strong><ArrowRight aria-hidden="true" /></div>
      <div className="destination-relationship__node destination-relationship__node--unknown"><FolderLock aria-hidden="true" /><span><strong>Destination not assessed</strong><small>No physical identity or free-space result is available</small></span></div>
      <figcaption><CircleHelp aria-hidden="true" />The relationship stays unverified until a typed destination-assessment API is available.</figcaption>
    </figure>
    <CapabilityBanner level="warning" title="Destination assessment unavailable" explanation="No typed acquisition-destination assessment is exposed by the current daemon. No free-space or physical-separation result is assumed." />
    <div className="locked-control"><div><strong>Destination drive</strong><p>Drive selection and storage assessment are locked because the current API cannot validate either value.</p></div><button className="button button--secondary" type="button" disabled title="Destination assessment is unavailable">Choose destination drive</button></div>
    <div className="workflow-inline-actions"><button className="button button--primary" type="button" disabled title="Destination assessment is unavailable">Continue</button></div>
  </WorkflowFrame>;
}
