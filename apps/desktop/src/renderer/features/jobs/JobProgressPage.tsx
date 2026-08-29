import { JobEventSchema, JobStatusSchema, type JobEvent, type JobStatus } from '@recovery/contracts';
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
  return <section className="job-progress">
    <header><p className="eyebrow">Recovery job</p><h1>{status ? stageLabels[status.stage] ?? status.stage : 'Recovery status unavailable'}</h1><p>Progress is read from the persisted daemon job state.</p></header>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {status ? <dl className="metric-grid"><div><dt>Current stage</dt><dd>{status.stage.replaceAll('_', ' ')}</dd></div><div><dt>Source</dt><dd>{status.sourceId}</dd></div><div><dt>Last update</dt><dd>{status.updatedAt}</dd></div><div><dt>Partitions recorded</dt><dd>{status.partitions?.partitions.length ?? 'Not reported'}</dd></div></dl> : null}
    {status?.limitations.length ? <aside className="report-limitations"><h2>Limitations</h2><ul>{status.limitations.map((limitation) => <li key={limitation.code}><strong>{limitation.code}</strong>: {limitation.explanation}</li>)}</ul></aside> : null}
    <div className="form-actions">
      {status?.stage === 'paused' || status?.stage === 'needs_attention' ? <button className="button button--primary" type="button" onClick={() => void command(window.recoveryApi.resumeJob)}>Resume recovery</button> : null}
      {status && !['completed', 'cancelled', 'failed', 'paused', 'needs_attention'].includes(status.stage) ? <button className="button button--secondary" type="button" onClick={() => void command(window.recoveryApi.pauseJob)}>Pause</button> : null}
      {status && !['completed', 'cancelled', 'failed'].includes(status.stage) ? <button className="button button--secondary" type="button" onClick={() => void command(window.recoveryApi.cancelJob)}>Cancel scan</button> : null}
    </div>
    <details open><summary>Technical log</summary><ol>{events.map((event) => <li key={event.eventId}><code>{event.sequence}</code> {event.message ?? stageLabels[event.stage] ?? event.stage}</li>)}</ol></details>
  </section>;
}

function mergeEvents(current: JobEvent[], incoming: JobEvent[]): JobEvent[] {
  const byId = new Map(current.map((event) => [event.eventId, event]));
  for (const event of incoming) byId.set(event.eventId, event);
  return [...byId.values()].sort((left, right) => left.sequence - right.sequence);
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Recovery status could not be loaded.'; }
