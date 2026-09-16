import { AdvancedSection, CapabilityBanner, PageHeader } from '@recovery/ui';
import { Clock3, FolderLock, Gauge, HardDrive, Info, Pause, Settings2, ShieldCheck, Square } from 'lucide-react';
import { ReadErrorMap } from '../jobs/ReadErrorMap.js';

/** Damaged-media imaging — kept as an honest "not in this build" surface. */
export function DamagedDeviceWizard() {
  return <section className="page page--narrow">
    <PageHeader eyebrow="Damaged device" title="Create a safe working image" description="For unstable or failing drives, readable areas are copied first and difficult areas retried later. This workflow is not available in this build." />
    <CapabilityBanner level="info" title="Rescue Mode only" explanation="In Installed Mode, stop using the source and restart SHUNYA in Rescue Mode." />
    <CapabilityBanner level="warning" title="Damaged-device workflow unavailable" explanation="The current daemon does not expose a typed acquisition request, ddrescue telemetry, mapfile, or controls. No source details, rates, ranges, or capabilities are simulated." />
    <div className="capability-grid" aria-label="Unavailable damaged-media data path">
      <article className="capability-tile"><HardDrive aria-hidden="true" /><span><strong>Source device details unavailable</strong><small>No physical device descriptor is exposed.</small></span></article>
      <article className="capability-tile"><Settings2 aria-hidden="true" /><span><strong>Imaging engine unavailable</strong><small>No safe strategy can be selected.</small></span></article>
      <article className="capability-tile"><FolderLock aria-hidden="true" /><span><strong>Working image destination unavailable</strong><small>Separation from the source is not verified.</small></span></article>
      <article className="capability-tile"><Gauge aria-hidden="true" /><span><strong>Live read rate unavailable</strong><small>No throughput samples are reported.</small></span></article>
      <article className="capability-tile"><ShieldCheck aria-hidden="true" /><span><strong>Source-write status unavailable</strong><small>No acquisition helper state is exposed.</small></span></article>
      <article className="capability-tile"><Clock3 aria-hidden="true" /><span><strong>Checkpoint detail unavailable</strong><small>No mapfile or checkpoint time is reported.</small></span></article>
    </div>
    <div className="button-row">
      <button className="button button--primary" type="button" disabled title="ddrescue controls are unavailable">Start first pass</button>
      <button className="button button--secondary" type="button" disabled title="No active acquisition can be paused"><Pause aria-hidden="true" />Pause safely</button>
      <button className="button button--danger-outline" type="button" disabled title="No active acquisition can be stopped"><Square aria-hidden="true" />Stop imaging</button>
    </div>
    <AdvancedSection title="Technical details" summary="Strategy options and read coverage that this build cannot report" icon={Info} quiet>
      <code className="diagnostic-code">DDRESCUE_UI_UNAVAILABLE</code>
      <fieldset className="damaged-strategies" disabled>
        <legend>Safe strategy <small>Requires typed acquisition capabilities</small></legend>
        <label className="check check--boxed"><input type="radio" name="damaged-strategy" /><span><strong>Gentle</strong><small>Capability unavailable</small></span></label>
        <label className="check check--boxed"><input type="radio" name="damaged-strategy" /><span><strong>Standard</strong><small>Capability unavailable</small></span></label>
        <label className="check check--boxed"><input type="radio" name="damaged-strategy" /><span><strong>Persistent</strong><small>Capability unavailable</small></span></label>
      </fieldset>
      <ReadErrorMap />
      <p className="form-hint">Retry state unavailable: no deferred or unreadable range count is reported.</p>
    </AdvancedSection>
  </section>;
}
