import { JobStatusSchema, type JobStatus } from '@recovery/contracts';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { activeJobId } from '../../application-state.js';
import { CapabilityBanner } from '@recovery/ui';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';
import { Database, HardDrive, LockKeyhole, ScanSearch } from 'lucide-react';

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
    {result ? <div className="partition-discovery">
      <PartitionMap result={result} />
      <div className="partition-discovery__workspace">
        <section className="partition-tree-card" aria-labelledby="partition-tree-title"><header><div><h2 id="partition-tree-title">Detected structures</h2><p>Exact daemon partition records, grouped beneath the recovery source.</p></div><Database aria-hidden="true" /></header><ul aria-label="Detected partition tree"><li><span className="partition-tree__source"><HardDrive aria-hidden="true" /><span><strong>Recovery source</strong><small>{result.partitions.length} partition{result.partitions.length === 1 ? '' : 's'} reported</small></span></span><ul>{result.partitions.map((partition) => <li key={partition.partitionId}><span><span className="partition-swatch" aria-hidden="true" /><span><strong>{partition.label ?? partition.partitionId}</strong><small>{partition.filesystem ?? partition.partitionType} · {formatBytes(partition.lengthBytes)}</small></span></span></li>)}</ul></li></ul></section>
        <section className="partition-scope" aria-labelledby="partition-scope-title"><ScanSearch aria-hidden="true" /><div><h2 id="partition-scope-title">Scan scope is fixed</h2><p>The typed recovery job API does not accept partition selections. The running job controls discovery and recovery scope.</p></div><button className="button button--secondary" type="button" disabled title="Partition selection is unavailable">Choose partition scan scope</button></section>
      </div>
      <div className="table-scroll partition-details"><table><caption>Daemon partition details</caption><thead><tr><th>Name</th><th>Filesystem</th><th>Start offset (bytes)</th><th>Length (bytes)</th></tr></thead><tbody>{result.partitions.map((partition) => <tr key={partition.partitionId}><td>{partition.label ?? partition.partitionId}</td><td>{partition.filesystem ?? partition.partitionType}</td><td>{partition.startOffsetBytes}</td><td>{partition.lengthBytes}</td></tr>)}</tbody></table>{result.candidates.map((candidate) => <p key={`${candidate.startOffsetBytes}:${candidate.source}`}>Candidate {candidate.filesystem ?? 'unknown filesystem'} at {candidate.startOffsetBytes} bytes · {candidate.confidence}</p>)}</div>
      <div className="workflow-truth workflow-truth--safe"><LockKeyhole aria-hidden="true" /><span><strong>Source remains read-only</strong><small>Nothing on this screen can write a partition table.</small></span></div>
    </div> : null}
  </WorkflowFrame>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Partition results could not be loaded.'; }

function PartitionMap({ result }: { result: NonNullable<JobStatus['partitions']> }) {
  const ranges = [
    ...result.partitions.map((partition) => ({ id: partition.partitionId, start: BigInt(partition.startOffsetBytes), length: BigInt(partition.lengthBytes), label: partition.label ?? partition.partitionId, kind: 'partition' as const })),
    ...result.gaps.map(([start, length], index) => ({ id: `gap-${index}`, start: BigInt(start), length: BigInt(length), label: 'Unallocated range', kind: 'gap' as const })),
  ].sort((left, right) => left.start < right.start ? -1 : left.start > right.start ? 1 : 0);
  const extent = ranges.reduce((maximum, range) => {
    const end = range.start + range.length;
    return end > maximum ? end : maximum;
  }, 0n);
  return <figure className="partition-map" aria-label="Partition map">
    <figcaption><HardDrive aria-hidden="true" /><span><strong>Detected layout</strong><small>Proportions use only daemon-reported offsets and lengths.</small></span></figcaption>
    <div className="partition-map__track" role="list" aria-label="Detected layout segments">{ranges.map((range) => <span key={range.id} role="listitem" className={range.kind === 'gap' ? 'is-gap' : 'is-partition'} style={{ left: percent(range.start, extent), width: percent(range.length, extent) }} aria-label={`${range.label}, ${formatBytes(range.length.toString())}`} />)}</div>
    <ul>{ranges.map((range) => <li key={range.id}><i className={range.kind === 'gap' ? 'is-gap' : 'is-partition'} aria-hidden="true" /><span><strong>{range.label}</strong><small>{formatBytes(range.length.toString())}</small></span></li>)}</ul>
  </figure>;
}

function percent(value: bigint, total: bigint): string {
  if (total === 0n) return '0%';
  return `${Number((value * 10_000n) / total) / 100}%`;
}

function formatBytes(value: string): string {
  const bytes = Number(value);
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  return `${bytes.toLocaleString()} bytes`;
}
