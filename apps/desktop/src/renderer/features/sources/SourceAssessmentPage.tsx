import { RuntimeInfoSchema, SourceAssessmentSchema, SourceDescriptorSchema, type RuntimeMode, type SourceAssessment, type SourceDescriptor } from '@recovery/contracts';
import { RuntimeModeBadge } from '@recovery/ui';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AssessmentFinding } from './AssessmentFinding.js';

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
  return <section className="assessment-page"><header><p className="eyebrow">Source assessment</p><h1>{source?.displayName ?? 'Source safety assessment'}</h1><div className="assessment-meta"><span>Read-only analysis</span><RuntimeModeBadge mode={runtimeMode} /></div></header>{error ? <p className="form-error" role="alert">{error}</p> : null}{!assessment && !error ? <p role="status">Assessing source…</p> : null}{assessment?.findings.map((finding) => <AssessmentFinding key={finding.code} finding={finding} />)}{assessment && assessment.decision !== 'blocked' ? <Link className="button button--primary" to={`/cases/${caseId}/recovery/goal`}>Choose recovery goal</Link> : null}</section>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Source assessment failed.'; }
