import { JobEventSchema, JobStatusSchema, type JobEvent, type JobStatus } from '@recovery/contracts';
import { AdvancedSection, CapabilityBanner } from '@recovery/ui';
import { AlertTriangle, CheckCircle2, Clock3, Database, FileText, Files, FolderLock, HardDrive, ListChecks, Loader2, Pause, PauseCircle, Play, ScanSearch, ShieldCheck, Square, Timer, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { activeJobId, activeWorkspace } from '../../application-state.js';
import { familyMeta, formatCount } from '../recovery/file-families.js';
import { ReadErrorMap } from './ReadErrorMap.js';

const stageLabels: Record<string, string> = {
  draft: 'Recovery job created', preflight: 'Checking source and destination', acquiring: 'Creating a safe disk image',
  verifying_image: 'Verifying the image', partition_scan: 'Partition discovery', metadata_scan: 'Looking for deleted file records',
  carving: 'Searching remaining disk space', validating: 'Checking recovered files', threat_scan: 'Checking for potentially unsafe content',
  indexing: 'Preparing results', review_ready: 'Results ready', completed: 'Recovery completed', paused: 'Recovery paused',
  needs_attention: 'Recovery needs attention', cancelling: 'Cancelling recovery', cancelled: 'Recovery cancelled', failed: 'Recovery failed',
};
const stageHints: Record<string, string> = {
  preflight: 'Checking the source and recording its fingerprint.',
  partition_scan: 'Reading the partition table.',
  metadata_scan: 'Looking for records of deleted files.',
  carving: 'Scanning for the file types you selected.',
  validating: 'Checking each recovered file is complete.',
  threat_scan: 'Scanning recovered files for threats.',
  indexing: 'Building the list of results.',
  completed: 'Your files are ready, and a report was generated.',
  paused: 'Paused. Resume when you are ready.',
  needs_attention: 'Stopped — see the notes below.',
  cancelled: 'Cancelled. Files found before that are kept.',
  failed: 'Could not finish — see the notes below.',
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
  const reportKicked = useRef(false);
  const logRef = useRef<HTMLOListElement>(null);

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
        // Auto-generate the recovery report once the job completes, so a finished
        // recovery always has a report ready without an extra manual step.
        if (nextStatus.stage === 'completed' && !reportKicked.current) {
          reportKicked.current = true;
          void window.recoveryApi.generateReport(caseId).catch(() => undefined);
        }
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

  useEffect(() => {
    const list = logRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [events]);

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

  if (!jobId) return <section className="page"><h1>Recovery</h1><p role="alert" className="form-error">No recovery has been started for this case yet.</p></section>;
  if (!status && !pollError) return <section className="page"><h1>Recovery</h1><p role="status" className="empty-state">Loading recovery status…</p></section>;
  const error = commandError ?? pollError;
  const progress = status && !stagesWithoutWorkflowPosition.has(status.stage) ? progressByStage[status.stage] : undefined;
  const running = status ? !terminalStages.has(status.stage) && !stagesWithoutWorkflowPosition.has(status.stage) : false;
  const held = status?.stage === 'paused' || status?.stage === 'needs_attention';
  const HeroIcon = !status ? Loader2 : status.stage === 'completed' ? CheckCircle2 : status.stage === 'failed' ? XCircle : status.stage === 'cancelled' ? Square : held ? PauseCircle : status.stage === 'needs_attention' ? AlertTriangle : Loader2;

  return <section className="page job-page">
    {status ? <section className="job-hero" data-state={status.stage} aria-label="Recovery status">
      <div className="job-hero__row">
        <span className="job-hero__icon" aria-hidden="true"><HeroIcon className={running ? 'spin' : undefined} /></span>
        <div className="job-hero__text">
          <h1>{stageLabels[status.stage] ?? status.stage}</h1>
          <p>{stageHints[status.stage] ?? 'Working…'}</p>
        </div>
        <div className="job-hero__percent" data-unavailable={progress === undefined || undefined}>
          <strong>{progress === undefined ? '—' : `${progress}%`}</strong>
          <small>{progress === undefined ? 'Stage position unavailable' : 'Stage-based progress'}</small>
        </div>
      </div>
      {progress !== undefined ? <div className={`job-progress__bar${running ? ' job-progress__bar--running' : ''}`} role="progressbar" aria-label="Stage-based workflow progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div> : null}
      <ol className="job-hero__stages" aria-label="Recovery stage timeline">
        {timelineFor(status.stage).map((stage) => <li key={stage.id} className="job-stage" data-status={stage.status}>{stage.label}<span className="sr-only"> — {stage.status}</span></li>)}
      </ol>
      <div className="job-hero__actions">
        {status.families?.length ? <div className="job-progress__families" aria-label="File families being searched for">
          <span className="job-progress__families-label"><ScanSearch aria-hidden="true" />Looking for</span>
          {status.families.map((family) => { const { Icon, label } = familyMeta(family); return <span className="family-chip" data-family={family} key={family}><Icon aria-hidden="true" />{label}</span>; })}
          <small>{formatCount(status.families)} signatures</small>
        </div> : <span />}
        <div className="button-row">
          {status.stage === 'completed' ? <>
            <Link className="button button--primary" to={`/cases/${caseId}/results`}><Files aria-hidden="true" />Review recovered files</Link>
            <Link className="button button--secondary" to={`/cases/${caseId}/reports`}><FileText aria-hidden="true" />Open report</Link>
          </> : null}
          {held ? <button className="button button--primary" type="button" onClick={() => void command(window.recoveryApi.resumeJob)}><Play aria-hidden="true" />Resume recovery</button> : null}
          {running ? <button className="button button--secondary" type="button" onClick={() => void command(window.recoveryApi.pauseJob)}><Pause aria-hidden="true" />Pause</button> : null}
          {!terminalStages.has(status.stage) ? <button className="button button--danger-outline" type="button" onClick={() => void command(window.recoveryApi.cancelJob)}><Square aria-hidden="true" />Cancel scan</button> : null}
        </div>
      </div>
    </section> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}

    {status ? <>
      <figure className="job-facts" aria-label="Recovery data path">
        <div className="job-fact"><HardDrive aria-hidden="true" /><span><strong>{status.sourceId}</strong><small>Read-only source</small></span></div>
        <div className="job-fact"><FolderLock aria-hidden="true" /><span><strong>{workspacePath ?? 'Workspace path unavailable'}</strong><small>Case workspace</small></span></div>
        <div className="job-fact"><Timer aria-hidden="true" /><span><strong>{elapsedLabel(status.createdAt, status.updatedAt)}</strong><small>{running ? 'Elapsed · updating live' : 'Elapsed'}</small></span></div>
        <div className="job-fact"><Database aria-hidden="true" /><span><strong>{status.partitions?.partitions.length ?? 'Not yet'}</strong><small>Partitions found</small></span></div>
        <figcaption className="sr-only">Recovery moves from the read-only source into the case workspace through the {status.preset} scan preset.</figcaption>
      </figure>

      {status.limitations.length ? <AdvancedSection title={`Notes (${status.limitations.length})`} summary="How this recovery ran" icon={ListChecks} quiet>
        <div className="notes-list">{status.limitations.map((limitation) => <CapabilityBanner key={limitation.code} level={limitation.level === 'unsupported' ? 'warning' : 'info'} title={friendlyLimitation(limitation.code)} explanation={limitation.explanation} action={<code className="diagnostic-code">{limitation.code}</code>} />)}</div>
      </AdvancedSection> : null}

      <AdvancedSection title="Details" summary="Event log and read coverage" icon={Clock3} quiet>
        <section className="job-progress__log stack stack--tight" aria-labelledby="event-stream-title">
          <h2 id="event-stream-title">Event stream</h2>
          <ol className="event-log" aria-label="Recovery event stream" ref={logRef}>{events.map((event) => <li key={event.eventId}><code>{event.sequence}</code><span>{event.message ?? stageLabels[event.stage] ?? event.stage}</span><time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time></li>)}</ol>
          {!events.length ? <p className="empty-state">No recovery events have been recorded yet.</p> : null}
        </section>
        <div className="grid-2">
          <div className="card card--muted"><strong>Checkpoint detail unavailable</strong><p className="form-hint">No checkpoint time or byte range is reported.</p></div>
          <div className="card card--muted"><ReadErrorMap /></div>
        </div>
        <p className="note"><ShieldCheck aria-hidden="true" />Last update: {formatTime(status.updatedAt)}.</p>
      </AdvancedSection>
    </> : null}
  </section>;
}

function friendlyLimitation(code: string): string {
  const known: Record<string, string> = {
    TSK_METADATA_UNAVAILABLE: 'Original file names could not be recovered',
    PHOTOREC_UNAVAILABLE: 'Built-in carving engine was used',
    PHOTOREC_FAILED: 'PhotoRec did not complete; built-in engine used',
    YARA_X_LIMITED_RULESET: 'Threat scan used the built-in demonstration rules',
    YARA_X_UNAVAILABLE: 'Recovered files were not threat-scanned',
  };
  return known[code] ?? code.replaceAll('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

function timelineFor(stage: JobStatus['stage']): Array<{ id: string; label: string; status: 'pending' | 'running' | 'completed' | 'paused' | 'failed' }> {
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

function elapsedLabel(createdAt: string, updatedAt: string): string {
  const start = new Date(createdAt).getTime();
  const end = new Date(updatedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 'Unavailable';
  const totalSeconds = Math.floor((end - start) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function mergeEvents(current: JobEvent[], incoming: JobEvent[]): JobEvent[] {
  const byId = new Map(current.map((event) => [event.eventId, event]));
  for (const event of incoming) byId.set(event.eventId, event);
  return [...byId.values()].sort((left, right) => left.sequence - right.sequence);
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Recovery status could not be loaded.'; }
