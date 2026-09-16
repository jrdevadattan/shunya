import { JobStatusSchema, type JobStatus } from '@recovery/contracts';
import { AdvancedSection, CapabilityBanner, PageHeader } from '@recovery/ui';
import { ArrowLeft, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { activeJobId } from '../../application-state.js';
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
  return <section className="page page--narrow">
    <PageHeader eyebrow="Memory" title="Memory analysis results" description="Memory findings stay separate from disk recovery results and are never simulated." />
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {!status && !error ? <p role="status" className="empty-state">Checking verified memory-analysis capability…</p> : null}
    <CapabilityBanner level="warning" title="Memory analysis capability unavailable" explanation="The verified Volatility capability is unavailable in the current daemon tool state. No process, network, module, or YARA finding is inferred or simulated." action={<code className="diagnostic-code">VOLATILITY_UNAVAILABLE</code>} />
    {status ? <p className="form-hint">Live job state: {status.stage.replaceAll('_', ' ')}.</p> : null}
    {status?.limitations.length ? <div className="notes-list">{status.limitations.map((limitation) => <CapabilityBanner key={limitation.code} level="warning" title={limitation.code} explanation={limitation.explanation} />)}</div> : null}
    <AdvancedSection title="What advanced analysis would provide" summary="Findings this build cannot produce" icon={Info} quiet defaultOpen>
      <AdvancedMemoryCapabilities headingLevel="h3" />
      <p className="form-hint">This renderer cannot configure or verify a Volatility runtime because the typed desktop API exposes no runtime-capability method.</p>
    </AdvancedSection>
    <div className="button-row"><Link className="button button--secondary" to={`/cases/${caseId}/memory/options`}><ArrowLeft aria-hidden="true" />Review capability details</Link></div>
  </section>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Memory-analysis capability could not be checked.'; }
