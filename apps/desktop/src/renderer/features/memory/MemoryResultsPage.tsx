import { JobStatusSchema, type JobStatus } from '@recovery/contracts';
import { ArrowLeft, FolderLock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { activeJobId } from '../../application-state.js';
import { CapabilityBanner, SurfaceCard } from '@recovery/ui';
import { AdvancedMemoryCapabilities } from './AdvancedMemoryCapabilities.js';

export function MemoryResultsPage() {
  const { caseId = '' } = useParams();
  const [status, setStatus] = useState<JobStatus>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    const jobId = activeJobId(caseId);
    if (!jobId) { setError('No memory-analysis job is active for this case.'); return; }
    void window.recoveryApi.getJobStatus(jobId).then((value) => {
      if (!active) return;
      const nextStatus = JobStatusSchema.parse(value);
      if (nextStatus.goal !== 'memory_analysis') {
        setStatus(undefined);
        setError('No memory-analysis job is active for this case.');
      } else {
        setStatus(nextStatus);
        setError(undefined);
      }
    }).catch((cause) => { if (active) setError(message(cause)); });
    return () => { active = false; };
  }, [caseId]);
  return <section className="workflow-page memory-results memory-capability"><header className="page-heading"><div><p className="eyebrow">Volatile memory</p><h1>Memory analysis results</h1><p className="page-heading__description">Memory findings remain separate from disk recovery results and are never simulated.</p></div></header>{error ? <p role="alert" className="form-error">{error}</p> : null}{!status && !error ? <p role="status">Checking verified memory-analysis capability…</p> : null}<SurfaceCard title="Verified capability"><CapabilityBanner level="warning" title="VOLATILITY_UNAVAILABLE" explanation="The verified Volatility capability is unavailable in the current daemon tool state. No process, network, module, or YARA finding is inferred or simulated." />{status ? <p>Live job state: {status.stage.replaceAll('_', ' ')}.</p> : null}{status?.limitations.length ? <div className="report-banner-list">{status.limitations.map((limitation) => <CapabilityBanner key={limitation.code} level="warning" title={limitation.code} explanation={limitation.explanation} />)}</div> : null}<p className="form-hint">This renderer cannot configure or verify a Volatility runtime because the typed desktop API exposes no runtime-capability method.</p></SurfaceCard><AdvancedMemoryCapabilities /><footer className="memory-actions"><span><FolderLock aria-hidden="true" />No volatile-memory finding tables are available</span><Link className="button button--secondary button--icon" to={`/cases/${caseId}/memory/options`}><ArrowLeft aria-hidden="true" />Review capability details</Link></footer></section>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Memory-analysis capability could not be checked.'; }
