import { JobEventSchema, JobStatusSchema, type JobEvent, type JobStatus } from '@recovery/contracts';
import { CapabilityBanner, MetricCard, StageTimeline, SurfaceCard, type TimelineStage } from '@recovery/ui';
import { Activity, Clock3, Database, Layers3 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { activeJobId } from '../../application-state.js';

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

export function JobProgressPage() {
  const { caseId = '' } = useParams();
  const jobId = activeJobId(caseId);
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
  const progress = status ? progressByStage[status.stage] : 0;
  return <section className="job-progress">
    <header className="page-heading"><div><p className="eyebrow">Recovery job</p><h1>{status ? stageLabels[status.stage] ?? status.stage : 'Recovery status unavailable'}</h1><p className="page-heading__description">Live progress from the persisted recovery daemon. This view stops polling when the job reaches a terminal state.</p></div></header>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {status ? <>
      <div className="metric-grid metric-grid--jobs">
        <MetricCard label="Workflow progress" value={`${progress}%`} detail="Stage-based estimate" icon={Activity} tone={status.stage === 'failed' ? 'danger' : status.stage === 'completed' ? 'success' : 'neutral'} />
        <MetricCard label="Current stage" value={status.stage.replaceAll('_', ' ')} detail="Daemon-reported state" icon={Layers3} />
        <MetricCard label="Partitions" value={status.partitions?.partitions.length ?? '—'} detail={status.partitions ? 'Recorded by the daemon' : 'Not reported yet'} icon={Database} />
        <MetricCard label="Last update" value={formatTime(status.updatedAt)} detail={status.updatedAt} icon={Clock3} />
      </div>
      <div className="job-progress__bar" role="progressbar" aria-label="Recovery progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="job-progress__workspace">
        <SurfaceCard title="Recovery stages" description="Completed, active, and upcoming daemon stages."><StageTimeline stages={timelineFor(status.stage)} /></SurfaceCard>
        <SurfaceCard title="Job controls" description={`Source ${status.sourceId}`}>
          <div className="job-progress__actions">
            {status.stage === 'paused' || status.stage === 'needs_attention' ? <button className="button button--primary" type="button" onClick={() => void command(window.recoveryApi.resumeJob)}>Resume recovery</button> : null}
            {!['completed', 'cancelled', 'failed', 'paused', 'needs_attention'].includes(status.stage) ? <button className="button button--secondary" type="button" onClick={() => void command(window.recoveryApi.pauseJob)}>Pause</button> : null}
            {!['completed', 'cancelled', 'failed'].includes(status.stage) ? <button className="button button--secondary" type="button" onClick={() => void command(window.recoveryApi.cancelJob)}>Cancel scan</button> : null}
            {terminalStages.has(status.stage) ? <p className="empty-state">This job is in a terminal state. No further controls are available.</p> : null}
          </div>
        </SurfaceCard>
      </div>
      {status.limitations.length ? <div className="job-progress__limitations">{status.limitations.map((limitation) => <CapabilityBanner key={limitation.code} level={limitation.level === 'unsupported' ? 'warning' : 'info'} title={limitation.code} explanation={limitation.explanation} />)}</div> : null}
    </> : null}
    <SurfaceCard title="Recovery event log" description="Append-only events returned by the recovery daemon." className="job-progress__log">
      <ol aria-label="Recovery event log">{events.map((event) => <li key={event.eventId}><code>{event.sequence}</code><span>{event.message ?? stageLabels[event.stage] ?? event.stage}</span><time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time></li>)}</ol>
      {!events.length ? <p className="empty-state">No recovery events have been recorded yet.</p> : null}
    </SurfaceCard>
  </section>;
}

function timelineFor(stage: JobStatus['stage']): TimelineStage[] {
  const currentIndex = Math.max(0, stageOrder.indexOf(stage));
  const terminal = stage === 'completed';
  const groups = [
    { id: 'prepare', label: 'Prepare and preflight', index: 1 },
    { id: 'acquire', label: 'Acquire and verify image', index: 3 },
    { id: 'discover', label: 'Discover partitions and metadata', index: 5 },
    { id: 'recover', label: 'Recover and validate files', index: 8 },
    { id: 'review', label: 'Index and prepare results', index: 10 },
  ];
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
