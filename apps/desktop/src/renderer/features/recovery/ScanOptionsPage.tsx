import { RecoveryJobSchema, RecoveryGoalSchema, type ScanPreset } from '@recovery/contracts';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { activeSourceId, rememberJob } from '../../application-state.js';
import { Gauge, Search, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';

const presets: Array<[string, string, ScanPreset, LucideIcon, string, string]> = [
  ['Quick Scan', 'Looks for deleted file records first. Best chance of preserving original names and folders.', 'quick', Gauge, 'File records', 'Not included'],
  ['Full Scan', 'Adds content-signature recovery across remaining source space. Original names may be unavailable.', 'full', Search, 'File records and source space', 'Included'],
  ['Advanced', 'Runs the daemon advanced preset. Partition and file-family controls remain unavailable in this API.', 'advanced', SlidersHorizontal, 'Daemon-defined advanced scan', 'Preset-defined'],
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
    <div className="scan-comparison"><table aria-label="Scan preset comparison"><thead><tr><th>Preset</th><th>What the daemon reads</th><th>Content signatures</th><th>Duration</th></tr></thead><tbody>{presets.map(([title, description, preset, Icon, scope, signatures]) => <tr key={title}><td><article><span aria-hidden="true"><Icon /></span><span><strong>{title}</strong><small>{description}</small><button className="button button--primary" type="button" disabled={Boolean(starting)} onClick={() => void start(preset)}>{starting === preset ? 'Starting…' : 'Use this preset'}</button></span></article></td><td>{scope}</td><td>{signatures}</td><td>No duration estimate available</td></tr>)}</tbody></table></div>
    <div className="locked-control"><div><strong>File-family filters</strong><p>File-family selection is unavailable because recovery jobs currently accept only a typed scan preset.</p></div><button className="button button--secondary" type="button" disabled title="File-family selection is unavailable">Choose file families</button></div>
  </WorkflowFrame>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'The recovery job could not be started.'; }
