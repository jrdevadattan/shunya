import { AdvancedSection, CapabilityBanner, PageHeader } from '@recovery/ui';
import { SourceDescriptorSchema, type SourceDescriptor } from '@recovery/contracts';
import { useEffect, useState } from 'react';
import { activeSourceId } from '../../application-state.js';
import { ArrowRight, FileImage, FolderLock, HardDrive, Info, ShieldAlert } from 'lucide-react';
import { useParams } from 'react-router-dom';

/** Acquisition destination — kept as an honest "not in this build" surface. */
export function DestinationPage() {
  const { caseId = '' } = useParams();
  const [source, setSource] = useState<SourceDescriptor>();
  useEffect(() => {
    let active = true;
    setSource(undefined);
    const sourceId = activeSourceId(caseId);
    if (!sourceId) return () => { active = false; };
    void window.recoveryApi.listSources().then((items) => {
      if (active) setSource(SourceDescriptorSchema.array().parse(items).find((item) => item.sourceId === sourceId));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [caseId]);

  return <section className="page page--narrow">
    <PageHeader eyebrow="Recover" title="Choose destination" description="Where a new disk image would be written. This step is not available in this build, so nothing can be selected yet." />
    <figure className="card job-facts" aria-label="Source and destination safety relationship" style={{ gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)' }}>
      <div className="job-fact">{source?.kind === 'physical_device' ? <HardDrive aria-hidden="true" /> : <FileImage aria-hidden="true" />}<span><strong>{source?.displayName ?? 'No active source'}</strong><small>{source ? 'Read-only recovery source' : 'Return to Sources to select one'}</small></span></div>
      <ArrowRight aria-hidden="true" style={{ alignSelf: 'center', color: 'var(--text-tertiary)' }} />
      <div className="job-fact"><FolderLock aria-hidden="true" /><span><strong>Destination not assessed</strong><small>No physical identity or free-space result is available</small></span></div>
      <figcaption className="sr-only">The relationship stays unverified until a typed destination-assessment API is available.</figcaption>
    </figure>
    <CapabilityBanner level="warning" title="Destination assessment unavailable" explanation="No typed acquisition-destination assessment is exposed by the current daemon. No free-space or physical-separation result is assumed." />
    <div className="locked-control"><div><strong>Destination drive</strong><p>Drive selection and storage assessment are locked because the current API cannot validate either value.</p></div><button className="button button--secondary" type="button" disabled title="Destination assessment is unavailable">Choose destination drive</button></div>
    <div className="workflow-inline-actions"><button className="button button--primary" type="button" disabled title="Destination assessment is unavailable">Continue</button></div>
    <AdvancedSection title="Why is this locked?" summary="Technical background" icon={Info} quiet>
      <p className="note" data-tone="warning"><ShieldAlert aria-hidden="true" />The recovery service must resolve both locations to physical device identities before allowing output. Export performs that proof at export time; a dedicated destination assessment does not exist yet.</p>
    </AdvancedSection>
  </section>;
}
