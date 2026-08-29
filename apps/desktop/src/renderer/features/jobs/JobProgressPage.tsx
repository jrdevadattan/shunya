import { StageTimeline, type TimelineStage } from '@recovery/ui';
import { useEffect, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { activeJobStore } from './job-store.js';

const baseStages: TimelineStage[] = [
  { id: 'preflight', label: 'Safety checks', status: 'completed' },
  { id: 'partition_scan', label: 'Partition discovery', status: 'completed' },
  { id: 'metadata_scan', label: 'Metadata recovery', status: 'paused' },
  { id: 'carving', label: 'Signature recovery', status: 'pending' },
  { id: 'validating', label: 'Validate recovered files', status: 'pending' },
];

export function JobProgressPage() {
  const [search] = useSearchParams();
  const snapshot = useSyncExternalStore(activeJobStore.subscribe, activeJobStore.getSnapshot);

  useEffect(() => {
    if (!snapshot && search.get('fixture') === 'resume') {
      const resumed = sessionStorage.getItem('recovery-fixture-stage') === 'metadata_scan';
      activeJobStore.replay({
        jobId: 'restart-fixture',
        stage: resumed ? 'metadata_scan' : 'paused',
        filesFound: 128,
        bytesProcessed: '4294967296',
        throughputBytesPerSecond: resumed ? '83886080' : '0',
        etaRange: resumed ? '12–16 minutes' : undefined,
        errors: 0,
        pausedRecoverable: !resumed,
      }, []);
    }
  }, [search, snapshot]);

  if (!snapshot) return <section><h1>Recovery jobs</h1><p>No recovery job has been created for this case.</p></section>;
  const running = snapshot.stage === 'metadata_scan';
  const stages = baseStages.map((stage) => stage.id === 'metadata_scan' ? { ...stage, status: running ? 'running' as const : 'paused' as const } : stage);

  function resume() {
    sessionStorage.setItem('recovery-fixture-stage', 'metadata_scan');
    activeJobStore.update({ stage: 'metadata_scan', pausedRecoverable: false, throughputBytesPerSecond: '83886080', etaRange: '12–16 minutes' });
  }

  return <section className="job-progress">
    <header><p className="eyebrow">Recovery job</p><h1>{running ? 'Metadata recovery running' : 'Recovery paused after restart'}</h1><p>{running ? 'The recovery continues in the background when you change pages.' : 'Completed stages are preserved. Resume when you are ready.'}</p></header>
    <StageTimeline stages={stages} />
    <dl className="metric-grid">
      <div><dt>Data processed</dt><dd>{formatBytes(snapshot.bytesProcessed)}</dd></div>
      <div><dt>Throughput</dt><dd>{snapshot.throughputBytesPerSecond === '0' ? 'Paused' : `${formatBytes(snapshot.throughputBytesPerSecond ?? '0')}/s`}</dd></div>
      <div><dt>Estimated time</dt><dd>{snapshot.etaRange ?? 'Waiting to resume'}</dd></div>
      <div><dt>Files found</dt><dd>{snapshot.filesFound.toLocaleString()}</dd></div>
      <div><dt>Read errors</dt><dd>{snapshot.errors ?? 0}</dd></div>
    </dl>
    <div className="form-actions">
      {snapshot.pausedRecoverable ? <button className="button button--primary" type="button" onClick={resume}>Resume recovery</button> : <button className="button button--secondary" type="button" onClick={() => activeJobStore.update({ stage: 'paused', pausedRecoverable: true, throughputBytesPerSecond: '0' })}>Pause</button>}
      <button className="button button--secondary" type="button">Cancel</button>
    </div>
    <details><summary>Technical log</summary><pre>checkpoint metadata_scan · sequence {snapshot.lastSequence ?? 0}</pre></details>
  </section>;
}

function formatBytes(value: string): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return value;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  return `${bytes.toLocaleString()} bytes`;
}
