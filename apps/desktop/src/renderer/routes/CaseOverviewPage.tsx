import { ArtifactPageSchema, JobStatusSchema, SourceDescriptorSchema, type JobStatus, type SourceDescriptor } from '@recovery/contracts';
import { AdvancedSection, MetricCard, PageHeader } from '@recovery/ui';
import { Activity, ArrowRight, FileImage, Files, HardDrive, ListChecks, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { activeJobId } from '../application-state.js';

interface OverviewData {
  sources: SourceDescriptor[];
  totalArtifacts: number | null;
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
      jobId
        ? window.recoveryApi.getJobStatus(jobId).then((value) => JobStatusSchema.parse(value))
        : Promise.resolve(null),
    ]).then(async ([sources, job]) => {
      const totalArtifacts = job && (job.stage === 'review_ready' || job.stage === 'completed')
        ? await window.recoveryApi.queryArtifacts({ pageSize: 1 }).then((value) => ArtifactPageSchema.parse(value).totalCount)
        : job ? null : 0;
      if (active) setData({ sources, totalArtifacts, job });
    }).catch((cause) => {
      if (active) setError(message(cause));
    });
    return () => { active = false; };
  }, [caseId]);

  if (error) return <section className="page"><p className="form-error" role="alert">{error}</p></section>;
  if (!data) return <section className="page"><p role="status" className="empty-state">Loading recovery overview…</p></section>;

  const limitationCount = data.job?.limitations.length ?? 0;
  const next = nextAction(caseId, data);

  return (
    <section className="page">
      <PageHeader eyebrow="Case" title="Recovery overview" description="Where this case stands and what to do next." />

      <section className="start-panel" aria-labelledby="overview-next-title">
        <div>
          <p className="eyebrow">Next step</p>
          <h2 id="overview-next-title">{next.title}</h2>
          <p>{next.detail}</p>
        </div>
        <Link className="button button--primary button--large" to={next.to}>{next.label}<ArrowRight aria-hidden="true" /></Link>
      </section>

      <div className="grid-4">
        <MetricCard label="Sources" value={data.sources.length} detail="Drive images in this case" icon={HardDrive} />
        <MetricCard label="Recovery job" value={data.job ? stageLabel(data.job.stage) : 'Not started'} detail={data.job ? 'Current stage' : 'Add a source to begin'} icon={Activity} />
        <MetricCard label="Recovered artifacts" value={data.totalArtifacts === null ? 'Unavailable' : data.totalArtifacts.toLocaleString()} detail={data.totalArtifacts === null ? 'Unavailable until indexing' : 'Files found so far'} icon={Files} tone={data.totalArtifacts ? 'success' : 'neutral'} />
        <MetricCard label="Limitations" value={limitationCount} detail={limitationCount ? 'Notes from the recovery service' : 'Nothing to note'} icon={TriangleAlert} tone={limitationCount ? 'warning' : 'neutral'} />
      </div>

      <div className="grid-2">
        <section className="card stack stack--tight" aria-labelledby="overview-sources-title">
          <h2 id="overview-sources-title">Sources</h2>
          {data.sources.length ? <ul className="list-card__items" style={{ margin: '0 -20px -20px' }}>
            {data.sources.map((source) => <li key={source.sourceId}><span className="list-card__icon" aria-hidden="true">{source.kind === 'physical_device' ? <HardDrive /> : <FileImage />}</span><div className="list-card__body"><strong>{source.displayName}</strong><small>{source.kind.replaceAll('_', ' ')} · read-only</small></div></li>)}
          </ul> : <p className="empty-state">No evidence source has been added.</p>}
        </section>
        <AdvancedSection title={`Notes from the recovery service (${limitationCount})`} summary={data.job ? 'What this build could and could not do for this job' : 'Appear once a recovery has run'} icon={ListChecks} quiet>
          {data.job?.limitations.length ? <ul className="kv">{data.job.limitations.map((limitation) => <li key={limitation.code} style={{ listStyle: 'none', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}><strong style={{ fontSize: 'var(--text-sm)' }}>{limitation.code}</strong><p className="form-hint">{limitation.explanation}</p></li>)}</ul> : <p className="empty-state">{data.job ? 'No limitations were reported for this job.' : 'No recovery job is active.'}</p>}
        </AdvancedSection>
      </div>
    </section>
  );
}

function nextAction(caseId: string, data: OverviewData): { label: string; to: string; title: string; detail: string } {
  if (!data.sources.length) return { label: 'Add source', to: `/cases/${caseId}/sources`, title: 'No recovery job yet', detail: 'Add a source, choose a recovery goal, and select a scan preset to create the first recovery job.' };
  if (!data.job) return { label: 'Set up recovery', to: `/cases/${caseId}/recovery/setup`, title: 'No recovery job yet', detail: 'Add a source, choose a recovery goal, and select a scan preset to create the first recovery job.' };
  if (data.job.stage === 'completed' || data.job.stage === 'review_ready') return { label: 'Review recovered files', to: `/cases/${caseId}/results`, title: 'Recovery finished', detail: 'Look through what was found, pick the files you need, and export them.' };
  return { label: 'View recovery job', to: `/cases/${caseId}/jobs`, title: 'Recovery in progress', detail: `Current stage: ${stageLabel(data.job.stage)}. Open the job to watch progress or pause it.` };
}

function stageLabel(stage: JobStatus['stage']): string {
  return stage.split('_').map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ');
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'The recovery overview could not be loaded.';
}
