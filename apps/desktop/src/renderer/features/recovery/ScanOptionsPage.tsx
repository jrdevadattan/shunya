import { RecoveryJobSchema, RecoveryGoalSchema, type ScanPreset } from '@recovery/contracts';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { activeSourceId, rememberJob } from '../../application-state.js';
import { Gauge, Search, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';

const presets: Array<[string, string, ScanPreset, LucideIcon]> = [
  ['Quick Scan — Recommended first', 'Looks for deleted file records. Fastest. Best chance of original names.', 'quick', Gauge],
  ['Full Scan', 'Includes Quick Scan and searches remaining disk space by file content. Takes longer and may produce files without original names.', 'full', Search],
  ['Advanced', 'Choose partitions, file types, ranges, and forensic engines. For trained examiners.', 'advanced', SlidersHorizontal],
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
  return <WorkflowFrame
    eyebrow="Recovery setup"
    title="Choose scan options"
    description="Start with the least intensive scan that can answer the recovery goal."
    steps={[{ id: 'source', label: 'Source', state: 'complete' }, { id: 'goal', label: 'Recovery goal', state: 'complete' }, { id: 'scan', label: 'Scan options', state: 'current' }]}
  >
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    <div className="selection-grid selection-grid--presets">{presets.map(([title, description, preset, Icon]) => <article className="selection-card" key={title}><span aria-hidden="true"><Icon /></span><strong>{title}</strong><p>{description}</p><button className="button button--primary" type="button" disabled={Boolean(starting)} onClick={() => void start(preset)}>{starting === preset ? 'Starting…' : 'Use this preset'}</button></article>)}</div>
    <p className="form-hint">File-family selection is unavailable because recovery jobs currently accept only a typed scan preset.</p>
  </WorkflowFrame>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'The recovery job could not be started.'; }
