import { JobStatusSchema, type JobStatus } from '@recovery/contracts';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { activeJobId } from '../../application-state.js';
import { CapabilityBanner } from '@recovery/ui';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';
import { ArrowRight, Database, HardDrive, LockKeyhole, ScanSearch } from 'lucide-react';

export function PartitionList() {
  const { caseId = '' } = useParams();
  const [status, setStatus] = useState<JobStatus>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    setStatus(undefined);
    setError(undefined);
    const jobId = activeJobId(caseId);
    if (!jobId) { setError('No recovery job is active for this case.'); return; }
    let stopped = false;
    let timer: number | undefined;
    async function load() {
      if (stopped) return;
      try {
        const next = JobStatusSchema.parse(await window.recoveryApi.getJobStatus(jobId!));
        if (stopped) return;
        setStatus(next); setError(undefined);
        if (!next.partitions && !['completed', 'cancelled', 'failed', 'needs_attention'].includes(next.stage)) timer = window.setTimeout(() => void load(), 250);
      } catch (cause) { if (!stopped) setError(message(cause)); }
    }
    void load();
    return () => { stopped = true; if (timer !== undefined) window.clearTimeout(timer); };
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
      {result.partitions.length === 0 && result.candidates.length === 0 ? <section className="partition-empty" aria-labelledby="partition-empty-title"><ScanSearch aria-hidden="true" /><div><h2 id="partition-empty-title">No partition structures were detected</h2><p>Recovery continues across the source bytes using the selected full-scan strategy. Nothing needs to be selected here.</p></div><Link className="button button--primary button--icon" to={`/cases/${caseId}/activity`}>View recovery activity<ArrowRight aria-hidden="true" /></Link></section> : <>
      <div className="partition-discovery__workspace">
        <section className="partition-tree-card" aria-labelledby="partition-tree-title"><header><div><h2 id="partition-tree-title">Detected structures</h2><p>Exact daemon partition records and candidate layouts, grouped beneath the recovery source.</p></div><Database aria-hidden="true" /></header><ul aria-label="Detected partition tree"><li><span className="partition-tree__source"><HardDrive aria-hidden="true" /><span><strong>Recovery source</strong><small>{result.partitions.length} reported partition{result.partitions.length === 1 ? '' : 's'} · {result.candidates.length} candidate layout{result.candidates.length === 1 ? '' : 's'}</small></span></span><ul>{result.partitions.map((partition) => <li key={partition.partitionId}><span><span className="partition-swatch" aria-hidden="true" /><span><strong>{partition.label ?? partition.partitionId}</strong><small>Reported partition · {partition.filesystem ?? partition.partitionType} · {formatBytes(partition.lengthBytes)}</small></span></span></li>)}{result.candidates.map((candidate) => <li key={`${candidate.startOffsetBytes}:${candidate.source}`}><span><span className="partition-swatch partition-swatch--candidate" aria-hidden="true" /><span><strong>{candidateLabel(candidate.filesystem)}</strong><small>{candidate.confidence} confidence · starts at byte {formatInteger(candidate.startOffsetBytes)} · {candidate.source}</small></span></span></li>)}</ul></li></ul></section>
        <section className="partition-scope" aria-labelledby="partition-scope-title"><ScanSearch aria-hidden="true" /><div><h2 id="partition-scope-title">Scan scope is fixed</h2><p>The typed recovery job API does not accept partition selections. The running job controls discovery and recovery scope.</p></div><button className="button button--secondary" type="button" disabled title="Partition selection is unavailable">Choose partition scan scope</button></section>
      </div>
      <div className="table-scroll partition-details"><table><caption>Daemon partition details</caption><thead><tr><th>Name</th><th>Filesystem</th><th>Start offset (bytes)</th><th>Length (bytes)</th></tr></thead><tbody>{result.partitions.map((partition) => <tr key={partition.partitionId}><td>{partition.label ?? partition.partitionId}</td><td>{partition.filesystem ?? partition.partitionType}</td><td>{partition.startOffsetBytes}</td><td>{partition.lengthBytes}</td></tr>)}</tbody></table>{result.candidates.map((candidate) => <p key={`${candidate.startOffsetBytes}:${candidate.source}`}>Candidate {candidate.filesystem ?? 'unknown filesystem'} at {candidate.startOffsetBytes} bytes · {candidate.confidence}</p>)}</div></>}
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
  const candidateMarkers = result.candidates.map((candidate) => ({
    id: `${candidate.startOffsetBytes}:${candidate.source}`,
    start: BigInt(candidate.startOffsetBytes),
    label: candidateLabel(candidate.filesystem),
    confidence: candidate.confidence,
    source: candidate.source,
  }));
  const rangeExtent = ranges.reduce((maximum, range) => {
    const end = range.start + range.length;
    return end > maximum ? end : maximum;
  }, 0n);
  const extent = candidateMarkers.reduce((maximum, candidate) => candidate.start > maximum ? candidate.start : maximum, rangeExtent);
  return <figure className="partition-map" aria-label="Partition map">
    <figcaption><HardDrive aria-hidden="true" /><span><strong>Detected layout</strong><small>Bars use daemon-reported lengths; candidate markers show only reported starting offsets.</small></span></figcaption>
    <div className="partition-map__track" role="list" aria-label="Detected layout segments">{ranges.map((range) => <span key={range.id} role="listitem" className={range.kind === 'gap' ? 'is-gap' : 'is-partition'} style={{ left: percent(range.start, extent), width: percent(range.length, extent) }} aria-label={`${range.label}, ${formatBytes(range.length.toString())}`} />)}{candidateMarkers.map((candidate) => <span key={candidate.id} role="listitem" className={`is-candidate ${candidateEdgeClass(candidate.start, extent)}`.trim()} style={{ left: percent(candidate.start, extent) }} aria-label={`${candidate.label} at byte ${formatInteger(candidate.start.toString())}, ${candidate.confidence} confidence`} />)}</div>
    <ul>{ranges.map((range) => <li key={range.id}><i className={range.kind === 'gap' ? 'is-gap' : 'is-partition'} aria-hidden="true" /><span><strong>{range.label}</strong><small>{formatBytes(range.length.toString())}</small></span></li>)}{candidateMarkers.map((candidate) => <li key={candidate.id}><i className="is-candidate" aria-hidden="true" /><span><strong>{candidate.label}</strong><small>Starts at byte {formatInteger(candidate.start.toString())} · {candidate.confidence} confidence · {candidate.source}</small></span></li>)}</ul>
  </figure>;
}

function percent(value: bigint, total: bigint): string {
  if (total === 0n) return '0%';
  return `${Number((value * 10_000n) / total) / 100}%`;
}

function candidateEdgeClass(start: bigint, extent: bigint): string {
  if (start === 0n) return 'is-candidate--start';
  if (start >= extent) return 'is-candidate--end';
  return '';
}

function formatBytes(value: string): string {
  const bytes = BigInt(value);
  const gibibyte = 1024n ** 3n;
  const mebibyte = 1024n ** 2n;
  if (bytes >= gibibyte) return `${formatUnit(bytes, gibibyte)} GiB`;
  if (bytes >= mebibyte) return `${formatUnit(bytes, mebibyte)} MiB`;
  return `${formatInteger(value)} bytes`;
}

function formatUnit(value: bigint, unit: bigint): string {
  const tenths = ((value * 10n) + (unit / 2n)) / unit;
  return `${tenths / 10n}.${tenths % 10n}`;
}

function formatInteger(value: string): string { return value.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function candidateLabel(filesystem: string | null): string { return `Candidate ${filesystem ?? 'unknown filesystem'}`; }
