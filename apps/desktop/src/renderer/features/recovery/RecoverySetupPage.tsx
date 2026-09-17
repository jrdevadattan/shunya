import {
  RecoveryGoalSchema, RecoveryJobSchema, SourceAssessmentSchema, SourceDescriptorSchema,
  type FileFamily, type RecoveryGoal, type ScanPreset, type SourceAssessment, type SourceDescriptor,
} from '@recovery/contracts';
import { AdvancedSection } from '@recovery/ui';
import { AlertTriangle, CheckCircle2, Files, Gauge, Play, ScanSearch, Search, ShieldAlert, ShieldCheck, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { activeSourceId, rememberJob, rememberSource } from '../../application-state.js';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';
import { FileFamilySelector } from './FileFamilySelector.js';
import { formatCount, readStoredFamilies, storeFamilies } from './file-families.js';

const goals: Array<{ value: RecoveryGoal; label: string; detail: string; Icon: LucideIcon }> = [
  { value: 'recover_everything', label: 'Recover everything', detail: 'Search the whole image for the selected file types. Best for most situations.', Icon: Files },
  { value: 'partition_loss', label: 'Lost or damaged partition', detail: 'Also look for missing partition structures before recovering files.', Icon: ScanSearch },
];
const presets: Array<{ value: ScanPreset; label: string; detail: string; Icon: LucideIcon }> = [
  { value: 'full', label: 'Full scan', detail: 'Reads all of the image. Recommended.', Icon: Search },
  { value: 'quick', label: 'Quick scan', detail: 'Looks for file records first. Faster, may find less.', Icon: Gauge },
  { value: 'advanced', label: 'Advanced', detail: 'Uses the service’s advanced scan preset.', Icon: SlidersHorizontal },
];

/**
 * One screen to set up a recovery: confirms the source is safe to read, lets
 * the user pick what to look for, and starts the job. Goal and scan preset are
 * sensible defaults tucked under "Advanced options".
 */
export function RecoverySetupPage() {
  const { caseId = '', sourceId: routeSourceId } = useParams();
  const navigate = useNavigate();
  const [source, setSource] = useState<SourceDescriptor>();
  const [assessment, setAssessment] = useState<SourceAssessment>();
  const [assessmentError, setAssessmentError] = useState<string>();
  const [families, setFamilies] = useState<FileFamily[]>(() => readStoredFamilies(caseId));
  const [goal, setGoal] = useState<RecoveryGoal>(() => {
    const stored = RecoveryGoalSchema.safeParse(sessionStorage.getItem(`recovery:${caseId}:goal`));
    return stored.success && goals.some((option) => option.value === stored.data) ? stored.data : 'recover_everything';
  });
  const [preset, setPreset] = useState<ScanPreset>('full');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();

  const sourceId = routeSourceId ?? activeSourceId(caseId);

  useEffect(() => {
    let active = true;
    if (routeSourceId) rememberSource(caseId, routeSourceId);
    setSource(undefined); setAssessment(undefined); setAssessmentError(undefined);
    if (!sourceId) { setAssessmentError('Choose a drive image first.'); return () => { active = false; }; }
    void window.recoveryApi.listSources()
      .then((items) => { if (active) setSource(SourceDescriptorSchema.array().parse(items).find((item) => item.sourceId === sourceId)); })
      .catch(() => undefined);
    void window.recoveryApi.assessSource(sourceId)
      .then((result) => { if (active) setAssessment(SourceAssessmentSchema.parse(result)); })
      .catch((cause) => { if (active) setAssessmentError(message(cause)); });
    return () => { active = false; };
  }, [caseId, sourceId]);

  const changeFamilies = (next: FileFamily[]) => { setFamilies(next); storeFamilies(caseId, next); };
  const changeGoal = (next: RecoveryGoal) => { setGoal(next); sessionStorage.setItem(`recovery:${caseId}:goal`, next); };
  const blocked = assessment?.decision === 'blocked';
  const canStart = Boolean(sourceId) && Boolean(assessment) && !blocked && families.length > 0 && !starting;

  async function start() {
    if (!sourceId || !canStart) return;
    setError(undefined); setStarting(true);
    try {
      sessionStorage.setItem(`recovery:${caseId}:goal`, goal);
      const job = RecoveryJobSchema.parse(await window.recoveryApi.createRecoveryJob({ caseId, sourceId, goal, preset, families }));
      rememberJob(caseId, job.jobId);
      await window.recoveryApi.startJob(job.jobId);
      await navigate(`/cases/${caseId}/jobs`);
    } catch (cause) { setError(message(cause)); }
    finally { setStarting(false); }
  }

  return <WorkflowFrame
    eyebrow="Recover · step 3 of 3"
    title="Set up the recovery"
    description="Choose which kinds of files to look for, then start."
    steps={[{ id: 'source', label: 'Source', state: 'complete' }, { id: 'setup', label: 'Set up', state: 'current' }, { id: 'recovery', label: 'Recover', state: 'upcoming' }]}
    aside={<div className="workflow-truth workflow-truth--safe"><ShieldCheck aria-hidden="true" /><span><strong>Read-only</strong><small>Recovered files are checked and threat-scanned before you see them.</small></span></div>}
  >
    <Verdict source={source} assessment={assessment} error={assessmentError} />

    <FileFamilySelector selected={families} onChange={changeFamilies} disabled={starting} />

    {error ? <p role="alert" className="form-error">{error}</p> : null}
    <div className="start-panel">
      <div>
        <h2>Ready to recover</h2>
        <p>{blocked ? 'This source cannot be scanned.' : families.length ? `${families.length === 6 ? 'All file types' : `${families.length} file ${families.length === 1 ? 'type' : 'types'}`} · ${presetLabel(preset)}. You can pause or cancel any time.` : 'Select at least one file type.'}</p>
      </div>
      <button className="button button--primary button--large" type="button" disabled={!canStart} onClick={() => void start()}><Play aria-hidden="true" />{starting ? 'Starting…' : 'Start recovery'}</button>
    </div>

    <AdvancedSection title="Advanced options" summary="Recovery goal and scan depth">
      <fieldset className="preset-list" aria-label="Recovery goal">
        <legend className="sr-only">Recovery goal</legend>
        {goals.map(({ value, label, detail, Icon }) => <label className="preset" key={value}><input type="radio" name="recovery-goal" value={value} checked={goal === value} onChange={() => changeGoal(value)} disabled={starting} /><span className="preset__icon" aria-hidden="true"><Icon /></span><span className="preset__text"><strong>{label}</strong><small>{detail}</small></span></label>)}
      </fieldset>
      <fieldset className="preset-list" aria-label="Scan depth">
        <legend className="sr-only">Scan depth</legend>
        {presets.map(({ value, label, detail, Icon }) => <label className="preset" key={value}><input type="radio" name="scan-preset" value={value} checked={preset === value} onChange={() => setPreset(value)} disabled={starting} /><span className="preset__icon" aria-hidden="true"><Icon /></span><span className="preset__text"><strong>{label}</strong><small>{detail}</small></span></label>)}
      </fieldset>
      <p className="form-hint">Recovering files by their original name needs a metadata engine, which is not in this build.</p>
    </AdvancedSection>
  </WorkflowFrame>;
}

function Verdict({ source, assessment, error }: { source?: SourceDescriptor; assessment?: SourceAssessment; error?: string }) {
  if (error) return <p role="alert" className="form-error">{error}</p>;
  if (!assessment) return <p role="status" className="empty-state">Checking the source…</p>;
  const tone = assessment.decision === 'ready' ? 'success' : assessment.decision === 'warning' ? 'warning' : 'danger';
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' ? AlertTriangle : ShieldAlert;
  const title = tone === 'success' ? 'Source is ready' : tone === 'warning' ? 'Source needs attention' : 'Source cannot be scanned';
  const detail = source ? `${source.displayName} · ${formatBytes(source.sizeBytes)} · opened read-only` : 'Opened read-only';
  return <section className="verdict" data-tone={tone} aria-label="Source check">
    <span className="verdict__icon" aria-hidden="true"><Icon /></span>
    <div className="verdict__text"><h2>{title}</h2><p>{detail}</p></div>
    {assessment.findings.length ? <details className="artifact-ranges"><summary>Details ({assessment.findings.length})</summary>
      <div className="finding-list" style={{ marginTop: 10 }}>{assessment.findings.map((finding) => {
        const level = finding.level === 'supported' ? 'success' : finding.level === 'unsupported' || finding.level === 'requires_unlock' ? 'danger' : 'warning';
        const FindingIcon = level === 'success' ? CheckCircle2 : level === 'danger' ? ShieldAlert : AlertTriangle;
        return <div className="finding" data-level={level} key={finding.code}><FindingIcon aria-hidden="true" /><div className="finding__body"><strong>{finding.title}</strong><p>{finding.explanation}</p>{finding.recommendedAction ? <p className="finding__action">{finding.recommendedAction}</p> : null}<details><summary>Technical reference</summary><code>{finding.code}</code></details></div></div>;
      })}</div>
    </details> : null}
  </section>;
}

function presetLabel(preset: ScanPreset): string { return preset === 'quick' ? 'file records first' : preset === 'advanced' ? 'advanced preset' : 'whole image'; }
function formatBytes(value: string): string {
  const bytes = BigInt(value);
  const gib = 1024n ** 3n; const mib = 1024n ** 2n;
  if (bytes >= gib) return `${unit(bytes, gib)} GB`;
  if (bytes >= mib) return `${unit(bytes, mib)} MB`;
  return `${bytes.toLocaleString('en-US')} bytes`;
}
function unit(value: bigint, divisor: bigint): string { const tenths = (value * 10n + divisor / 2n) / divisor; return `${tenths / 10n}${tenths % 10n ? `.${tenths % 10n}` : ''}`; }
function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'The recovery could not be started.'; }
