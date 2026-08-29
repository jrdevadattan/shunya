import { JobEventSchema, JobStatusSchema, type JobEvent, type JobStatus } from '@recovery/contracts';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { activeJobId } from '../../application-state.js';

const stageLabels: Record<string, string> = {
  draft: 'Recovery job created', preflight: 'Checking source and destination', acquiring: 'Creating a safe disk image',
  verifying_image: 'Verifying the image', partition_scan: 'Partition discovery', metadata_scan: 'Looking for deleted file records',
  carving: 'Searching remaining disk space', validating: 'Checking recovered files', threat_scan: 'Checking for potentially unsafe content',
  indexing: 'Preparing results', review_ready: 'Results ready', completed: 'Recovery completed', paused: 'Recovery paused',
  needs_attention: 'Recovery needs attention', cancelling: 'Cancelling recovery', cancelled: 'Recovery cancelled', failed: 'Recovery failed',
};

export function JobProgressPage() {
  const { caseId = '' } = useParams();
  const jobId = activeJobId(caseId);
  const [status, setStatus] = useState<JobStatus>();
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    if (!jobId) { setError('No recovery job has been created for this case.'); return; }
    try {
      const [nextStatus, nextEvents] = await Promise.all([window.recoveryApi.getJobStatus(jobId), window.recoveryApi.listJobEvents(jobId, 0)]);
      setStatus(JobStatusSchema.parse(nextStatus));
      setEvents(JobEventSchema.array().parse(nextEvents));
      setError(undefined);
    } catch (cause) { setError(message(cause)); }
  }, [jobId]);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 1000); return () => window.clearInterval(timer); }, [load]);

  async function command(operation: (id: string) => Promise<unknown>) {
    if (!jobId) return;
    setError(undefined);
    try { await operation(jobId); await load(); } catch (cause) { setError(message(cause)); }
  }

  if (!jobId) return <section><h1>Recovery jobs</h1><p role="alert">No recovery job has been created for this case.</p></section>;
  if (!status && !error) return <section><h1>Recovery jobs</h1><p role="status">Loading recovery status…</p></section>;
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

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Recovery status could not be loaded.'; }
