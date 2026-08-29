import { JobStatusSchema, type JobStatus } from '@recovery/contracts';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { activeJobId } from '../../application-state.js';

export function MemoryResultsPage() {
  const { caseId = '' } = useParams();
  const [status, setStatus] = useState<JobStatus>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const jobId = activeJobId(caseId);
    if (!jobId) { setError('No memory-analysis job is active for this case.'); return; }
    void window.recoveryApi.getJobStatus(jobId).then((value) => setStatus(JobStatusSchema.parse(value))).catch((cause) => setError(message(cause)));
  }, [caseId]);
  return <section className="workflow-page"><header><p className="eyebrow">Volatile memory</p><h1>Memory analysis results</h1><p>Memory findings remain separate from disk recovery results.</p></header>{error ? <p role="alert" className="form-error">{error}</p> : null}{!status && !error ? <p role="status">Checking verified memory-analysis capability…</p> : null}<aside className="report-limitations"><h2>Analysis unavailable</h2><code>VOLATILITY_UNAVAILABLE</code><p>The verified Volatility capability is unavailable in the current daemon tool state. No process, network, module, or YARA finding is inferred or simulated.</p>{status ? <p>Live job state: {status.stage.replaceAll('_', ' ')}.</p> : null}{status?.limitations.length ? <ul>{status.limitations.map((limitation) => <li key={limitation.code}>{limitation.code}: {limitation.explanation}</li>)}</ul> : null}</aside><p>Install and verify Volatility through the supported tool manifest workflow before running memory analysis.</p></section>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Memory-analysis capability could not be checked.'; }
