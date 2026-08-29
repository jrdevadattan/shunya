import { JobStatusSchema, type JobStatus } from '@recovery/contracts';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { activeJobId } from '../../application-state.js';
import { CapabilityBanner } from '@recovery/ui';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';

export function PartitionList() {
  const { caseId = '' } = useParams();
  const [status, setStatus] = useState<JobStatus>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const jobId = activeJobId(caseId);
    if (!jobId) { setError('No recovery job is active for this case.'); return; }
    let stopped = false;
    async function load() {
      try {
        const next = JobStatusSchema.parse(await window.recoveryApi.getJobStatus(jobId!));
        if (stopped) return;
        setStatus(next); setError(undefined);
        if (!next.partitions && !['completed', 'cancelled', 'failed', 'needs_attention'].includes(next.stage)) window.setTimeout(() => void load(), 250);
      } catch (cause) { if (!stopped) setError(message(cause)); }
    }
    void load();
    return () => { stopped = true; };
  }, [caseId]);
  const result = status?.partitions;
  return <WorkflowFrame
    eyebrow="Read-only discovery"
    title="Partitions found"
    description="Partition candidates are stored in the case. No partition table is written to the source."
    steps={[{ id: 'setup', label: 'Recovery setup', state: 'complete' }, { id: 'discovery', label: 'Partition discovery', state: 'current' }, { id: 'recovery', label: 'Recovery', state: 'upcoming' }]}
    aside={<CapabilityBanner level="info" title="Source remains unchanged" explanation="Detected structures are case records only; the source partition table is never rewritten." />}
  >
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {!status && !error ? <p role="status">Loading partition results…</p> : null}
    {status && !result ? <p>Partition discovery has not completed.</p> : null}
    {result ? <div className="table-scroll"><table><thead><tr><th>Name</th><th>Filesystem</th><th>Start offset (bytes)</th><th>Length (bytes)</th></tr></thead><tbody>{result.partitions.map((partition) => <tr key={partition.partitionId}><td>{partition.label ?? partition.partitionId}</td><td>{partition.filesystem ?? partition.partitionType}</td><td>{partition.startOffsetBytes}</td><td>{partition.lengthBytes}</td></tr>)}</tbody></table>{result.candidates.map((candidate) => <p key={`${candidate.startOffsetBytes}:${candidate.source}`}>Candidate {candidate.filesystem ?? 'unknown filesystem'} at {candidate.startOffsetBytes} bytes · {candidate.confidence}</p>)}</div> : null}
  </WorkflowFrame>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Partition results could not be loaded.'; }
