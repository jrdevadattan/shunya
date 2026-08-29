import { RuntimeInfoSchema, SourceAssessmentSchema, SourceDescriptorSchema, type RuntimeMode, type SourceAssessment, type SourceDescriptor } from '@recovery/contracts';
import { CapabilityBanner, RuntimeModeBadge } from '@recovery/ui';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AssessmentFinding } from './AssessmentFinding.js';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';

export function SourceAssessmentPage() {
  const { caseId = '', sourceId = '' } = useParams();
  const [source, setSource] = useState<SourceDescriptor>();
  const [assessment, setAssessment] = useState<SourceAssessment>();
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>('installed');
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
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
  }, [sourceId]);
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
    <div className="finding-list">{assessment?.findings.map((finding) => <AssessmentFinding key={finding.code} finding={finding} />)}</div>
  </WorkflowFrame>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Source assessment failed.'; }
