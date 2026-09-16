import { JobEventSchema, RecoveryCaseSchema, type JobEvent, type RecoveryCase } from '@recovery/contracts';
import { AdvancedSection, PageHeader } from '@recovery/ui';
import { AlertTriangle, ArrowRight, BriefcaseBusiness, CheckCircle2, Clock3, LockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { activeJobId, activeWorkspace } from '../../application-state.js';

interface ActivityState {
  recoveryCase: RecoveryCase;
  events: JobEvent[];
}

export function CaseActivityPage() {
  const { caseId = '' } = useParams();
  const [state, setState] = useState<ActivityState>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    const workspace = activeWorkspace(caseId);
    const jobId = activeJobId(caseId);
    setState(undefined);
    setError(undefined);
    if (!workspace) {
      setError('Case context is unavailable. Open or create the case again.');
      return () => { active = false; };
    }

    let recoveryCase: RecoveryCase | undefined;
    let events: JobEvent[] = [];
    const publish = () => {
      if (active && recoveryCase) setState({ recoveryCase, events: ordered(events, jobId) });
    };
    const unsubscribe = jobId ? window.recoveryApi.subscribeJobEvents((value) => {
      if (!active || value.jobId !== jobId) return;
      events = mergeEvents(events, [JobEventSchema.parse(value)]);
      publish();
    }) : () => undefined;

    void Promise.all([
      window.recoveryApi.openCase(workspace).then((value) => RecoveryCaseSchema.parse(value)),
      jobId ? window.recoveryApi.listJobEvents(jobId, 0).then((value) => JobEventSchema.array().parse(value)) : Promise.resolve([]),
    ]).then(([openedCase, listedEvents]) => {
      if (!active) return;
      if (openedCase.caseId !== caseId) throw new Error('The opened case does not match the requested case.');
      recoveryCase = openedCase;
      events = mergeEvents(events, listedEvents);
      publish();
    }).catch((cause) => { if (active) setError(message(cause)); });

    return () => { active = false; unsubscribe(); };
  }, [caseId]);

  if (error) return <section className="page"><p className="form-error" role="alert">{error}</p></section>;
  if (!state) return <section className="page"><p role="status" className="empty-state">Loading recorded case activity…</p></section>;
  const latest = state.events.at(-1);
  const completed = latest?.stage === 'completed';

  return (
    <section className="page page--narrow" aria-labelledby="activity-title">
      <PageHeader eyebrow="Case record" title="Activity" titleId="activity-title" description={<><BriefcaseBusiness aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> {state.recoveryCase.title} — every recorded step, oldest first.</>} />
      {latest ? <section className="start-panel" data-state={completed ? 'complete' : 'active'} aria-labelledby="activity-summary-title">
        <div><h2 id="activity-summary-title">{completed ? 'Recovery complete' : 'Latest recovery event'}</h2><p>{latest.message ?? stageLabel(latest.stage)} · sequence {latest.sequence}</p></div>
        <Link className="button button--primary" to={completed ? `/cases/${caseId}/results` : `/cases/${caseId}/jobs`}>{completed ? 'Review recovered files' : 'View current recovery'}<ArrowRight aria-hidden="true" /></Link>
      </section> : null}
      <section className="card activity-timeline" aria-labelledby="activity-timeline-title">
        <div className="section-title"><h2 id="activity-timeline-title">Timeline</h2><p>{state.events.length + 1} record{state.events.length === 0 ? '' : 's'}</p></div>
        <ol aria-label="Chronological case activity">
          <li data-activity-sequence="case"><span className="activity-marker"><BriefcaseBusiness aria-hidden="true" /></span><time dateTime={state.recoveryCase.createdAt}>{formatTimestamp(state.recoveryCase.createdAt)}</time><span><strong>Case created</strong><small>Case identity from the persisted case record</small></span><em>Local case store</em></li>
          {state.events.map((event) => <li key={event.eventId} data-activity-sequence={event.sequence}><span className="activity-marker"><CheckCircle2 aria-hidden="true" /></span><time dateTime={event.occurredAt}>{formatTimestamp(event.occurredAt)}</time><span><strong>{event.message ?? stageLabel(event.stage)}</strong><small>{stageLabel(event.stage)} · sequence {event.sequence}</small></span><em>Recovery daemon</em></li>)}
        </ol>
      </section>
      <AdvancedSection title="About this record" summary="Integrity and how the timeline is built" icon={LockKeyhole} quiet>
        <p className="note" data-tone="warning"><AlertTriangle aria-hidden="true" />Audit hash-chain and integrity verification details are unavailable because the desktop API exposes job events but no audit-record or hash-chain endpoint. No integrity status is inferred.</p>
        <p className="note"><Clock3 aria-hidden="true" />Append-only: new events may be added while this screen is open, but existing entries are never edited here. Times are shown in UTC.</p>
      </AdvancedSection>
    </section>
  );
}

function ordered(events: JobEvent[], jobId: string | null): JobEvent[] {
  return events.filter((event) => !jobId || event.jobId === jobId).sort((left, right) => left.sequence - right.sequence);
}

function mergeEvents(current: JobEvent[], next: JobEvent[]): JobEvent[] {
  const bySequence = new Map(current.map((event) => [event.sequence, event]));
  for (const event of next) if (!bySequence.has(event.sequence)) bySequence.set(event.sequence, event);
  return [...bySequence.values()];
}

function stageLabel(stage: JobEvent['stage']): string {
  return stage.split('_').map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ');
}

function formatTimestamp(value: string): string {
  const timestamp = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
  return `${timestamp} UTC`;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Case activity could not be loaded.'; }
