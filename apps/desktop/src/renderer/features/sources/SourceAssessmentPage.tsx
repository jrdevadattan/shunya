import { RuntimeInfoSchema, SourceAssessmentSchema, SourceDescriptorSchema, type RuntimeMode, type SourceAssessment, type SourceDescriptor } from '@recovery/contracts';
import { CapabilityBanner, RuntimeModeBadge } from '@recovery/ui';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AssessmentFinding } from './AssessmentFinding.js';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';
import { ArrowRight, FileImage, FolderLock, HardDrive, ShieldCheck } from 'lucide-react';

export function SourceAssessmentPage() {
  const { caseId = '', sourceId = '' } = useParams();
  const [source, setSource] = useState<SourceDescriptor>();
  const [assessment, setAssessment] = useState<SourceAssessment>();
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>('installed');
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    setSource(undefined);
    setAssessment(undefined);
    setRuntimeMode('installed');
    setError(undefined);
    void window.recoveryApi.assessSource(sourceId)
      .then((result) => active && setAssessment(SourceAssessmentSchema.parse(result)))
      .catch((cause) => active && setError(message(cause)));
    void window.recoveryApi.listSources()
      .then((sources) => {
        if (active) setSource(SourceDescriptorSchema.array().parse(sources).find((item) => item.sourceId === sourceId));
      })
      .catch(() => undefined);
    void window.recoveryApi.getRuntimeInfo()
      .then((runtime) => active && setRuntimeMode(RuntimeInfoSchema.parse(runtime).mode))
      .catch(() => undefined);
    return () => { active = false; };
  }, [caseId, sourceId]);
  return <WorkflowFrame
    eyebrow="Source assessment"
    title={source?.displayName ?? 'Source safety assessment'}
    description="Review the daemon's safety findings before configuring recovery."
    steps={[{ id: 'source', label: 'Source', state: 'complete' }, { id: 'assessment', label: 'Assessment', state: 'current' }, { id: 'recovery', label: 'Recovery setup', state: 'upcoming' }]}
    aside={<><RuntimeModeBadge mode={runtimeMode} /><CapabilityBanner level="info" title="Read-only analysis" explanation="The source is assessed without changing its contents." /></>}
    actions={assessment && assessment.decision !== 'blocked' ? <Link className="button button--primary" to={`/cases/${caseId}/recovery/goal`}>Choose recovery goal</Link> : null}
  >
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {!assessment && !error ? <p role="status">Assessing source…</p> : null}
    {source && assessment ? <figure className="safety-relationship" aria-label="Read-only source relationship">
      <div className="safety-relationship__node safety-relationship__node--source">
        {source.kind === 'physical_device' ? <HardDrive aria-hidden="true" /> : <FileImage aria-hidden="true" />}
        <span><strong>{source.displayName}</strong><small>{formatBytes(source.sizeBytes)} · {source.kind.replaceAll('_', ' ')}</small><em>Read-only source</em></span>
      </div>
      <div className="safety-relationship__path"><ShieldCheck aria-hidden="true" /><strong>Read-only analysis path</strong><ArrowRight aria-hidden="true" /></div>
      <div className="safety-relationship__node"><FolderLock aria-hidden="true" /><span><strong>Recovery workspace</strong><small>Case records and recovered output only</small><em>No writes to source</em></span></div>
      <figcaption>{assessment.decision === 'ready' ? 'The daemon reports this source ready for recovery.' : assessment.decision === 'warning' ? 'Review every daemon warning before continuing.' : 'Recovery is blocked by the daemon assessment.'}</figcaption>
    </figure> : null}
    <div className="finding-list">{assessment?.findings.map((finding) => <AssessmentFinding key={finding.code} finding={finding} />)}</div>
  </WorkflowFrame>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Source assessment failed.'; }
function formatBytes(value: string): string {
  const bytes = BigInt(value);
  const gibibyte = 1024n ** 3n;
  return bytes >= gibibyte ? `${formatUnit(bytes, gibibyte)} GiB` : `${formatInteger(value)} bytes`;
}

function formatUnit(value: bigint, unit: bigint): string {
  const tenths = ((value * 10n) + (unit / 2n)) / unit;
  return `${tenths / 10n}.${tenths % 10n}`;
}

function formatInteger(value: string): string { return value.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
