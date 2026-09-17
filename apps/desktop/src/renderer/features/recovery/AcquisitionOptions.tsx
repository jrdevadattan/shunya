import { CapabilityBanner, PageHeader } from '@recovery/ui';
import { Database, FileCheck2, Gauge, ShieldCheck } from 'lucide-react';

/** Healthy-device acquisition — kept as an honest "not in this build" surface. */
export function AcquisitionOptions() {
  return <section className="page page--narrow">
    <PageHeader eyebrow="Recover" title="Healthy device acquisition" description="Creating a verified image straight from a physical device is not part of this build. Use “Make a disk image” from Home instead." />
    <CapabilityBanner level="warning" title="Acquisition capability unavailable" explanation="The current daemon does not expose a typed acquisition request or destination assessment. No source size, required space, block size, or completion state is simulated." />
    <div className="capability-grid" aria-label="Unavailable acquisition options">
      <article className="capability-tile"><Database aria-hidden="true" /><span><strong>Source range</strong><small>Unavailable until the daemon reports a typed acquisition source.</small></span></article>
      <article className="capability-tile"><Gauge aria-hidden="true" /><span><strong>Block size</strong><small>Cannot be selected without typed acquisition support.</small></span><button className="button button--secondary button--small" type="button" disabled title="Block-size selection is unavailable">Choose block size</button></article>
      <article className="capability-tile"><FileCheck2 aria-hidden="true" /><span><strong>Verification</strong><small>No acquisition hash or completion state is assumed.</small></span></article>
      <article className="capability-tile"><ShieldCheck aria-hidden="true" /><span><strong>Rescue Mode for system disks</strong><small>Use authorized Rescue Mode before acquiring the current system disk.</small></span></article>
    </div>
    <code className="diagnostic-code">ACQUISITION_UI_UNAVAILABLE</code>
    <div className="workflow-inline-actions"><button className="button button--primary" type="button" disabled title="Acquisition capability is unavailable">Create verified image</button></div>
  </section>;
}
