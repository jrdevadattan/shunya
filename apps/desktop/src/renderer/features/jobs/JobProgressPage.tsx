import { JobEventSchema, JobStatusSchema, type JobEvent, type JobStatus } from '@recovery/contracts';
import { CapabilityBanner, StageTimeline, SurfaceCard, type TimelineStage } from '@recovery/ui';
import { ArrowRight, CheckCircle2, Clock3, Database, FolderLock, Gauge, HardDrive, Pause, Play, ShieldCheck, Square, Waypoints } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { activeJobId, activeWorkspace } from '../../application-state.js';
import { ReadErrorMap } from './ReadErrorMap.js';

const stageLabels: Record<string, string> = {
  draft: 'Recovery job created', preflight: 'Checking source and destination', acquiring: 'Creating a safe disk image',
  verifying_image: 'Verifying the image', partition_scan: 'Partition discovery', metadata_scan: 'Looking for deleted file records',
  carving: 'Searching remaining disk space', validating: 'Checking recovered files', threat_scan: 'Checking for potentially unsafe content',
  indexing: 'Preparing results', review_ready: 'Results ready', completed: 'Recovery completed', paused: 'Recovery paused',
  needs_attention: 'Recovery needs attention', cancelling: 'Cancelling recovery', cancelled: 'Recovery cancelled', failed: 'Recovery failed',
};
const terminalStages = new Set<JobStatus['stage']>(['completed', 'cancelled', 'failed']);
const progressByStage: Record<JobStatus['stage'], number> = {
  draft: 2, preflight: 8, waiting_for_destination: 12, acquiring: 22, verifying_image: 32, partition_scan: 43, metadata_scan: 55,
  carving: 68, validating: 78, threat_scan: 84, indexing: 92, review_ready: 98, completed: 100,
  exporting: 98, reporting: 99, paused: 50, needs_attention: 50, cancelling: 50, cancelled: 50, failed: 50,
};
const stageOrder: JobStatus['stage'][] = [
  'draft', 'preflight', 'waiting_for_destination', 'acquiring', 'verifying_image', 'partition_scan', 'metadata_scan', 'carving',
  'validating', 'threat_scan', 'indexing', 'review_ready', 'exporting', 'reporting', 'completed',
];
const stagesWithoutWorkflowPosition = new Set<JobStatus['stage']>(['paused', 'needs_attention', 'cancelling', 'cancelled', 'failed']);

export function JobProgressPage() {
  const { caseId = '' } = useParams();
  const jobId = activeJobId(caseId);
  const workspacePath = activeWorkspace(caseId);
  const [status, setStatus] = useState<JobStatus>();
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [pollError, setPollError] = useState<string>();
  const [commandError, setCommandError] = useState<string>();
  const terminal = useRef(false);
  const requestGeneration = useRef(0);

  useEffect(() => {
    if (!jobId) return;
    const activeJobId = jobId;
    let active = true;
    let inFlight = false;
    let timer: number | undefined;
    let afterSequence = 0;
    terminal.current = false;
    async function poll() {
      if (!active || inFlight || terminal.current) return;
      inFlight = true;
      const expectedGeneration = requestGeneration.current;
      let scheduleNext = true;
      try {
        const [rawStatus, rawEvents] = await Promise.all([
          window.recoveryApi.getJobStatus(activeJobId),
          window.recoveryApi.listJobEvents(activeJobId, afterSequence),
        ]);
        const nextStatus = JobStatusSchema.parse(rawStatus);
        const nextEvents = JobEventSchema.array().parse(rawEvents);
        if (!active || requestGeneration.current !== expectedGeneration) return;
        if (nextEvents.length) afterSequence = Math.max(afterSequence, ...nextEvents.map((event) => event.sequence));
        setStatus(nextStatus);
        setEvents((current) => mergeEvents(current, nextEvents));
        setPollError(undefined);
        terminal.current = terminalStages.has(nextStatus.stage);
        scheduleNext = !terminal.current;
      } catch (cause) {
        if (active) setPollError(message(cause));
      } finally {
        inFlight = false;
        if (active && scheduleNext && !terminal.current) timer = window.setTimeout(() => void poll(), 1000);
      }
    }
    void poll();
    return () => { active = false; terminal.current = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, [jobId]);

  async function command(operation: (id: string) => Promise<JobStatus>) {
    if (!jobId) return;
    requestGeneration.current += 1;
    setCommandError(undefined);
    try {
      const nextStatus = JobStatusSchema.parse(await operation(jobId));
      setStatus(nextStatus);
      terminal.current = terminalStages.has(nextStatus.stage);
    } catch (cause) { setCommandError(message(cause)); }
  }

  if (!jobId) return <section><h1>Recovery jobs</h1><p role="alert">No recovery job has been created for this case.</p></section>;
  if (!status && !pollError) return <section><h1>Recovery jobs</h1><p role="status">Loading recovery status…</p></section>;
  const error = commandError ?? pollError;
  const progress = status && !stagesWithoutWorkflowPosition.has(status.stage) ? progressByStage[status.stage] : undefined;
  return <section className="job-progress">
    <header className="page-heading job-progress__heading"><div><p className="eyebrow">Live recovery workspace</p><h1>{status ? stageLabels[status.stage] ?? status.stage : 'Recovery status unavailable'}</h1><p className="page-heading__description">Daemon-reported recovery state for job {status?.jobId}. Values that are not exposed remain visibly unavailable.</p></div>{status ? <div className="job-progress__headline" data-unavailable={progress === undefined || undefined}><strong>{progress === undefined ? 'Stage position unavailable' : `${progress}%`}</strong><span>{progress === undefined ? 'This state does not report a workflow position' : 'Stage-based position, not measured bytes'}</span></div> : null}</header>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {status ? <>
      <SurfaceCard className="job-progress__timeline" title="Recovery stages" description="Completed, active, and upcoming stages derived from the current daemon stage.">
        <StageTimeline stages={timelineFor(status.stage)} ariaLabel="Recovery stage timeline" />
      </SurfaceCard>
      {progress !== undefined ? <div className="job-progress__bar" role="progressbar" aria-label="Stage-based workflow progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <span style={{ width: `${progress}%` }} />
      </div> : null}
      <figure className="job-progress__relationship" aria-label="Recovery data path">
        <div><HardDrive aria-hidden="true" /><span><strong>{status.sourceId}</strong><small>Read-only source</small></span><ShieldCheck aria-hidden="true" /></div>
        <div className="job-progress__path"><span aria-hidden="true" /><Waypoints aria-hidden="true" /><strong>{presetLabel(status.preset)}</strong><ArrowRight aria-hidden="true" /></div>
        <div><FolderLock aria-hidden="true" /><span><strong>{workspacePath ?? 'Workspace path unavailable'}</strong><small>Case workspace</small></span>{workspacePath ? <CheckCircle2 aria-hidden="true" /> : null}</div>
        <figcaption className="sr-only">Recovery moves from the read-only source into the case workspace through the selected scan preset.</figcaption>
      </figure>
      <div className="job-progress__workspace">
        <div className="job-progress__main">
          <section className="job-progress__telemetry" aria-label="Recovery telemetry">
            <article><Database aria-hidden="true" /><span><strong>{status.partitions?.partitions.length ?? 'Not reported'}</strong><small>Partitions recorded</small></span></article>
            <article><Gauge aria-hidden="true" /><span><strong>Unavailable</strong><small>Throughput is not reported</small></span></article>
            <article><Clock3 aria-hidden="true" /><span><strong>{formatTime(status.updatedAt)}</strong><small>Last daemon update</small></span></article>
          </section>
          <ReadErrorMap />
        </div>
        <div className="job-progress__rail">
          <SurfaceCard title="Checkpoint detail unavailable" description="No checkpoint time or byte range is reported by the current job API.">
            <p className="job-progress__truth"><Clock3 aria-hidden="true" /> Pause and resume remain daemon-controlled. This screen does not infer a checkpoint.</p>
          </SurfaceCard>
          <SurfaceCard title="Job controls" description={`Daemon state: ${status.stage.replaceAll('_', ' ')}`}>
            <div className="job-progress__actions">
              {status.stage === 'paused' || status.stage === 'needs_attention' ? <button className="button button--primary" type="button" onClick={() => void command(window.recoveryApi.resumeJob)}><Play aria-hidden="true" />Resume recovery</button> : null}
              {!['completed', 'cancelled', 'failed', 'paused', 'needs_attention'].includes(status.stage) ? <button className="button button--secondary" type="button" onClick={() => void command(window.recoveryApi.pauseJob)}><Pause aria-hidden="true" />Pause</button> : null}
              {!['completed', 'cancelled', 'failed'].includes(status.stage) ? <button className="button button--danger" type="button" onClick={() => void command(window.recoveryApi.cancelJob)}><Square aria-hidden="true" />Cancel scan</button> : null}
              {terminalStages.has(status.stage) ? <p className="empty-state">This job is in a terminal state. No further controls are available.</p> : null}
            </div>
          </SurfaceCard>
        </div>
      </div>
      {status.limitations.length ? <div className="job-progress__limitations">{status.limitations.map((limitation) => <CapabilityBanner key={limitation.code} level={limitation.level === 'unsupported' ? 'warning' : 'info'} title={limitation.code} explanation={limitation.explanation} />)}</div> : null}
    </> : null}
    <div aria-label="Recovery event log"><SurfaceCard title="Event stream" description="Append-only events returned by the recovery daemon." className="job-progress__log">
      <ol aria-label="Recovery event stream">{events.map((event) => <li key={event.eventId}><code>{event.sequence}</code><span>{event.message ?? stageLabels[event.stage] ?? event.stage}</span><time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time></li>)}</ol>
      {!events.length ? <p className="empty-state">No recovery events have been recorded yet.</p> : null}
    </SurfaceCard></div>
  </section>;
}

function presetLabel(preset: JobStatus['preset']): string {
  return `${preset.replaceAll('_', ' ')} scan`;
}

function timelineFor(stage: JobStatus['stage']): TimelineStage[] {
  const currentIndex = stageOrder.indexOf(stage);
  const terminal = stage === 'completed';
  const groups = [
    { id: 'prepare', label: 'Prepare and preflight', index: 1 },
    { id: 'acquire', label: 'Acquire and verify image', index: 4 },
    { id: 'discover', label: 'Discover partitions and metadata', index: 6 },
    { id: 'recover', label: 'Recover and validate files', index: 9 },
    { id: 'review', label: 'Index and prepare results', index: 11 },
  ];
  if (currentIndex < 0) return groups.map((group) => ({ id: group.id, label: group.label, status: 'pending' }));
  return groups.map((group, index) => ({
    id: group.id,
    label: group.label,
    status: terminal || currentIndex > group.index ? 'completed'
      : currentIndex <= group.index && (index === 0 || currentIndex > groups[index - 1]!.index)
        ? stage === 'failed' ? 'failed' : stage === 'paused' || stage === 'needs_attention' ? 'paused' : 'running'
        : 'pending',
  }));
}

function formatTime(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function mergeEvents(current: JobEvent[], incoming: JobEvent[]): JobEvent[] {
  const byId = new Map(current.map((event) => [event.eventId, event]));
  for (const event of incoming) byId.set(event.eventId, event);
  return [...byId.values()].sort((left, right) => left.sequence - right.sequence);
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Recovery status could not be loaded.'; }
