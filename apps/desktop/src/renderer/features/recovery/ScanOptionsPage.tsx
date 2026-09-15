import { RecoveryJobSchema, RecoveryGoalSchema, type FileFamily, type ScanPreset } from '@recovery/contracts';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { activeSourceId, rememberJob } from '../../application-state.js';
import { Gauge, Search, ShieldCheck, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';
import { FileFamilySelector } from './FileFamilySelector.js';
import { formatCount, readStoredFamilies, storeFamilies } from './file-families.js';

const presets: Array<[string, string, ScanPreset, LucideIcon, string, string]> = [
  ['Quick Scan', 'Looks for deleted file records first. Best chance of preserving original names and folders.', 'quick', Gauge, 'File records', 'Selected families'],
  ['Full Scan', 'Adds content-signature recovery across remaining source space. Original names may be unavailable.', 'full', Search, 'File records and source space', 'Selected families'],
  ['Advanced', 'Runs the daemon advanced preset with the same family selection. Partition scoping is preset-defined.', 'advanced', SlidersHorizontal, 'Daemon-defined advanced scan', 'Selected families'],
];

export function ScanOptionsPage() {
  const { caseId = '' } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [starting, setStarting] = useState<ScanPreset>();
  const [families, setFamilies] = useState<FileFamily[]>(() => readStoredFamilies(caseId));
  const changeFamilies = (next: FileFamily[]) => { setFamilies(next); storeFamilies(caseId, next); };

  async function start(preset: ScanPreset) {
    const sourceId = activeSourceId(caseId);
    const goalValue = sessionStorage.getItem(`recovery:${caseId}:goal`);
    const goal = RecoveryGoalSchema.safeParse(goalValue);
    if (!sourceId || !goal.success) { setError('Select a source and recovery goal before starting a scan.'); return; }
    if (!families.length) { setError('Select at least one file family to search for.'); return; }
    setError(undefined); setStarting(preset);
    try {
      const job = RecoveryJobSchema.parse(await window.recoveryApi.createRecoveryJob({ caseId, sourceId, goal: goal.data, preset, families }));
      rememberJob(caseId, job.jobId);
      await window.recoveryApi.startJob(job.jobId);
      await navigate(`/cases/${caseId}/jobs`);
    } catch (cause) { setError(message(cause)); }
    finally { setStarting(undefined); }
  }

  const disabled = Boolean(starting) || families.length === 0;
  return <WorkflowFrame
    eyebrow="Recovery setup"
    title="Choose scan options"
    description="Pick the file families to search for, then start with the least intensive scan that can answer the recovery goal."
    steps={[{ id: 'source', label: 'Source', state: 'complete' }, { id: 'goal', label: 'Recovery goal', state: 'complete' }, { id: 'scan', label: 'Scan options', state: 'current' }]}
    aside={<div className="workflow-truth workflow-truth--safe"><ShieldCheck aria-hidden="true" /><span><strong>Signatures, not guesses</strong><small>Every recovered file is bounded by its own structure, validated, and threat-scanned before you see it. {formatCount(families)} content signatures are enabled.</small></span></div>}
  >
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    <FileFamilySelector selected={families} onChange={changeFamilies} disabled={Boolean(starting)} />
    <div className="scan-comparison"><table aria-label="Scan preset comparison"><thead><tr><th>Preset</th><th>What the daemon reads</th><th>Content signatures</th><th>Duration</th></tr></thead><tbody>{presets.map(([title, description, preset, Icon, scope, signatures]) => <tr key={title}><td><article><span aria-hidden="true"><Icon /></span><span><strong>{title}</strong><small>{description}</small><button className="button button--primary" type="button" disabled={disabled} onClick={() => void start(preset)}>{starting === preset ? 'Starting…' : 'Use this preset'}</button></span></article></td><td>{scope}</td><td>{signatures}</td><td>No duration estimate available</td></tr>)}</tbody></table></div>
  </WorkflowFrame>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'The recovery job could not be started.'; }
