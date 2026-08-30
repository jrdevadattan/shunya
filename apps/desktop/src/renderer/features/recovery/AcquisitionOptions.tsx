import { CapabilityBanner } from '@recovery/ui';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';
import { Database, FileCheck2, Gauge, ShieldCheck } from 'lucide-react';

export function AcquisitionOptions() {
  return <WorkflowFrame eyebrow="Create a forensic image" title="Healthy device acquisition" description="Physical devices require a narrowly scoped read-only privileged helper." steps={[{ id: 'source', label: 'Source', state: 'complete' }, { id: 'destination', label: 'Destination', state: 'complete' }, { id: 'acquisition', label: 'Acquisition', state: 'current' }]}>
    <CapabilityBanner level="warning" title="Acquisition capability unavailable" explanation="The current daemon does not expose a typed acquisition request or destination assessment. No source size, required space, block size, or completion state is simulated." />
    <div className="acquisition-options" aria-label="Unavailable acquisition options">
      <article><Database aria-hidden="true" /><span><strong>Source range</strong><small>Unavailable until the daemon reports a typed acquisition source.</small></span></article>
      <article><Gauge aria-hidden="true" /><span><strong>Block size</strong><small>Cannot be selected without typed acquisition support.</small></span><button className="button button--secondary" type="button" disabled title="Block-size selection is unavailable">Choose block size</button></article>
      <article><FileCheck2 aria-hidden="true" /><span><strong>Verification</strong><small>No acquisition hash or completion state is assumed.</small></span></article>
    </div>
    <div className="workflow-truth"><ShieldCheck aria-hidden="true" /><span><strong>Rescue Mode for system disks</strong><small>Use authorized Rescue Mode before acquiring the current system disk.</small></span></div>
    <code>ACQUISITION_UI_UNAVAILABLE</code><div className="workflow-inline-actions"><button className="button button--primary" type="button" disabled title="Acquisition capability is unavailable">Create verified image</button></div>
  </WorkflowFrame>;
}
