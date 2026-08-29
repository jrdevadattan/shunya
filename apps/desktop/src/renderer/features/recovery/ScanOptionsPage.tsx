import { RecoveryJobSchema, RecoveryGoalSchema, type ScanPreset } from '@recovery/contracts';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { activeSourceId, rememberJob } from '../../application-state.js';

const presets: Array<[string, string, ScanPreset]> = [
  ['Quick Scan — Recommended first', 'Looks for deleted file records. Fastest. Best chance of original names.', 'quick'],
  ['Full Scan', 'Includes Quick Scan and searches remaining disk space by file content. Takes longer and may produce files without original names.', 'full'],
  ['Advanced', 'Choose partitions, file types, ranges, and forensic engines. For trained examiners.', 'advanced'],
];

export function ScanOptionsPage() {
  const { caseId = '' } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [starting, setStarting] = useState<ScanPreset>();
  async function start(preset: ScanPreset) {
    const sourceId = activeSourceId(caseId);
    const goalValue = sessionStorage.getItem(`recovery:${caseId}:goal`);
    const goal = RecoveryGoalSchema.safeParse(goalValue);
    if (!sourceId || !goal.success) { setError('Select a source and recovery goal before starting a scan.'); return; }
    setError(undefined); setStarting(preset);
    try {
      const job = RecoveryJobSchema.parse(await window.recoveryApi.createRecoveryJob({ caseId, sourceId, goal: goal.data, preset }));
      rememberJob(caseId, job.jobId);
      await window.recoveryApi.startJob(job.jobId);
      await navigate(`/cases/${caseId}/recovery/partitions`);
    } catch (cause) { setError(message(cause)); }
    finally { setStarting(undefined); }
  }
  return <section><header><p className="eyebrow">Recovery setup</p><h1>Choose scan options</h1></header>{error ? <p role="alert" className="form-error">{error}</p> : null}<div className="start-grid">{presets.map(([title, description, preset]) => <article className="start-card" key={title}><strong>{title}</strong><span>{description}</span><button className="button button--primary" type="button" disabled={Boolean(starting)} onClick={() => void start(preset)}>{starting === preset ? 'Starting…' : 'Use this preset'}</button></article>)}</div><p className="form-hint">File-family selection is unavailable because recovery jobs currently accept only a typed scan preset.</p></section>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'The recovery job could not be started.'; }
