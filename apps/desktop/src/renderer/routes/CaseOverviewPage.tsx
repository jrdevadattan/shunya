import { ArtifactPageSchema, JobStatusSchema, SourceDescriptorSchema, type JobStatus, type SourceDescriptor } from '@recovery/contracts';
import { MetricCard, SurfaceCard } from '@recovery/ui';
import { Activity, Files, HardDrive, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { activeJobId } from '../application-state.js';

interface OverviewData {
  sources: SourceDescriptor[];
  totalArtifacts: number;
  job: JobStatus | null;
}

export function CaseOverviewPage() {
  const { caseId = 'case' } = useParams();
  const [data, setData] = useState<OverviewData>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    const jobId = activeJobId(caseId);
    setData(undefined);
    setError(undefined);
    void Promise.all([
      window.recoveryApi.listSources().then((value) => SourceDescriptorSchema.array().parse(value)),
      window.recoveryApi.queryArtifacts({ pageSize: 1 }).then((value) => ArtifactPageSchema.parse(value)),
      jobId
        ? window.recoveryApi.getJobStatus(jobId).then((value) => JobStatusSchema.parse(value))
        : Promise.resolve(null),
    ]).then(([sources, artifacts, job]) => {
      if (active) setData({ sources, totalArtifacts: artifacts.totalCount, job });
    }).catch((cause) => {
      if (active) setError(message(cause));
    });
    return () => { active = false; };
  }, [caseId]);

  if (error) return <section className="overview-page"><p className="form-error" role="alert">{error}</p></section>;
  if (!data) return <section className="overview-page"><p role="status">Loading recovery overview…</p></section>;

  const limitationCount = data.job?.limitations.length ?? 0;
  const next = nextAction(caseId, data);

  return (
    <section className="overview-page">
      <header className="page-heading">
        <div><p className="eyebrow">Case workspace</p><h1>Recovery overview</h1></div>
        <Link className="button button--primary" to={next.to}>{next.label}</Link>
      </header>
      <p className="page-heading__description">Live case state from the recovery daemon. No evidence or recovery values are estimated in the renderer.</p>

      <div className="metric-grid metric-grid--overview">
        <MetricCard label="Sources" value={data.sources.length} detail="Evidence sources in this case" icon={HardDrive} />
        <MetricCard label="Recovery job" value={data.job ? stageLabel(data.job.stage) : 'Not started'} detail={data.job ? 'Persisted daemon state' : 'Add a source to begin'} icon={Activity} />
        <MetricCard label="Recovered artifacts" value={data.totalArtifacts.toLocaleString()} detail="Indexed by the recovery daemon" icon={Files} />
        <MetricCard label="Limitations" value={limitationCount} detail="Capabilities requiring attention" icon={TriangleAlert} tone={limitationCount ? 'warning' : 'neutral'} />
      </div>

      <div className="overview-grid">
        <SurfaceCard title="Evidence sources" description="Read-only sources registered with this case">
          {data.sources.length ? (
            <ul className="overview-list">
              {data.sources.map((source) => <li key={source.sourceId}><span>{source.displayName}</span><small>{source.kind.replaceAll('_', ' ')}</small></li>)}
            </ul>
          ) : <p className="empty-state">No evidence source has been added.</p>}
        </SurfaceCard>
        <SurfaceCard title="Current limitations" description="Capability statements reported by the active job">
          {data.job?.limitations.length ? (
            <ul className="overview-list overview-list--limitations">
              {data.job.limitations.map((limitation) => <li key={limitation.code}><span>{limitation.code}</span><small>{limitation.explanation}</small></li>)}
            </ul>
          ) : <p className="empty-state">{data.job ? 'No limitations were reported for this job.' : 'No recovery job is active.'}</p>}
        </SurfaceCard>
      </div>
    </section>
  );
}

function nextAction(caseId: string, data: OverviewData): { label: string; to: string } {
  if (!data.sources.length) return { label: 'Add source', to: `/cases/${caseId}/sources` };
  if (!data.job) return { label: 'Configure recovery', to: `/cases/${caseId}/recovery/goal` };
  if (data.job.stage === 'completed' || data.job.stage === 'review_ready') return { label: 'Review recovered files', to: `/cases/${caseId}/results` };
  return { label: 'View recovery job', to: `/cases/${caseId}/jobs` };
}

function stageLabel(stage: JobStatus['stage']): string {
  return stage.split('_').map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ');
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'The recovery overview could not be loaded.';
}
