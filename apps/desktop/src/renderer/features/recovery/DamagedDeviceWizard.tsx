import { CapabilityBanner } from '@recovery/ui';
import { ArrowRight, CircleHelp, Clock3, FolderLock, Gauge, HardDrive, Pause, Settings2, ShieldCheck, Square } from 'lucide-react';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';
import { ReadErrorMap } from '../jobs/ReadErrorMap.js';

export function DamagedDeviceWizard() {
  return <WorkflowFrame eyebrow="Damaged-media recovery" title="Create a safe working image" description="For unstable or damaged media, copy readable areas first and retry difficult areas later." steps={[{ id: 'source', label: 'Source', state: 'complete' }, { id: 'workspace', label: 'Workspace', state: 'current' }, { id: 'review', label: 'Review', state: 'upcoming' }]}>
    <div className="damaged-workspace">
      <h2>Damaged device recovery</h2>
      <CapabilityBanner level="info" title="Rescue Mode only" explanation="In Installed Mode, stop using the source and restart SHUNYA in Rescue Mode." />
      <CapabilityBanner level="warning" title="Damaged-device workflow unavailable" explanation="The current daemon does not expose a typed acquisition request, ddrescue telemetry, mapfile, or controls. No source details, rates, ranges, or capabilities are simulated." />
      <code className="diagnostic-code">DDRESCUE_UI_UNAVAILABLE</code>
      <figure className="damaged-workspace__relationship" aria-label="Unavailable damaged-media data path">
        <article><HardDrive aria-hidden="true" /><span><strong>Source device details unavailable</strong><small>No physical device descriptor is exposed.</small></span></article>
        <div className="damaged-workspace__path"><Settings2 aria-hidden="true" /><span><strong>Imaging engine unavailable</strong><small>No safe strategy can be selected.</small></span><ArrowRight aria-hidden="true" /></div>
        <article><FolderLock aria-hidden="true" /><span><strong>Working image destination unavailable</strong><small>Separation from the source is not verified.</small></span></article>
        <figcaption className="sr-only">Damaged-media acquisition is unavailable from source through imaging engine to working-image destination.</figcaption>
      </figure>
      <div className="damaged-workspace__grid">
        <div>
          <ReadErrorMap />
          <fieldset className="damaged-strategies" disabled>
            <legend>Safe strategy <small>Requires typed acquisition capabilities</small></legend>
            <label><input type="radio" name="damaged-strategy" /><span><strong>Gentle</strong><small>Capability unavailable</small></span></label>
            <label><input type="radio" name="damaged-strategy" /><span><strong>Standard</strong><small>Capability unavailable</small></span></label>
            <label><input type="radio" name="damaged-strategy" /><span><strong>Persistent</strong><small>Capability unavailable</small></span></label>
          </fieldset>
        </div>
        <aside className="damaged-workspace__rail">
          <section><Gauge aria-hidden="true" /><span><strong>Live read rate unavailable</strong><small>No throughput samples are reported.</small></span></section>
          <section><ShieldCheck aria-hidden="true" /><span><strong>Source-write status unavailable</strong><small>No acquisition helper state is exposed.</small></span></section>
          <section><Clock3 aria-hidden="true" /><span><strong>Checkpoint detail unavailable</strong><small>No mapfile or checkpoint time is reported.</small></span></section>
          <section><CircleHelp aria-hidden="true" /><span><strong>Retry state unavailable</strong><small>No deferred or unreadable range count is reported.</small></span></section>
        </aside>
      </div>
      <div className="damaged-workspace__actions">
        <button className="button button--primary" type="button" disabled title="ddrescue controls are unavailable">Start first pass</button>
        <button className="button button--secondary" type="button" disabled title="No active acquisition can be paused"><Pause aria-hidden="true" />Pause safely</button>
        <button className="button button--danger" type="button" disabled title="No active acquisition can be stopped"><Square aria-hidden="true" />Stop imaging</button>
      </div>
    </div>
  </WorkflowFrame>;
}
