import type { SourceDescriptor } from '@recovery/contracts';

export function SourceCard({ source }: { source: SourceDescriptor }) {
  return <article className="source-card">
    <div><p className="eyebrow">{source.kind.replaceAll('_', ' ')}</p><h2>{source.displayName}</h2></div>
    <span className="result-badge">{source.capabilities[0]?.title ?? 'Source found'}</span>
    <p>{formatBytes(source.sizeBytes)}</p>
    <details><summary>Technical details</summary><dl><dt>Stable identity</dt><dd>{source.stableId}</dd><dt>Bus</dt><dd>{source.bus ?? 'Image file'}</dd><dt>System disk</dt><dd>{source.systemDisk ? 'Yes' : 'No'}</dd></dl></details>
  </article>;
}

function formatBytes(value: string): string {
  const bytes = Number(value);
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GiB` : `${bytes.toLocaleString()} bytes`;
}
