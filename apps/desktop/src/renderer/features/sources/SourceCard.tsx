import type { SourceDescriptor } from '@recovery/contracts';
import { FileImage, HardDrive, Usb } from 'lucide-react';

export function SourceCard({ source }: { source: SourceDescriptor }) {
  const Icon = source.kind === 'physical_device' ? (source.bus?.toUpperCase() === 'USB' ? Usb : HardDrive) : FileImage;
  const tone = source.systemDisk ? 'success' : source.bus?.toUpperCase() === 'USB' ? 'accent' : undefined;
  const label = source.systemDisk ? 'System disk — protected' : source.kind === 'physical_device' ? (source.bus?.toUpperCase() === 'USB' ? 'Removable' : 'Internal drive') : 'Image file';
  return <article className="source-card">
    <span className="source-card__icon" aria-hidden="true"><Icon /></span>
    <div className="source-card__body">
      <h3>{source.displayName}</h3>
      <small>{formatBytes(source.sizeBytes)}{source.bus ? ` · ${source.bus}` : ''}</small>
    </div>
    <span className="badge" data-tone={tone}>{label}</span>
    <details><summary>Technical details</summary><dl className="kv"><div><dt>Stable identity</dt><dd><code>{source.stableId}</code></dd></div><div><dt>Kind</dt><dd>{source.kind.replaceAll('_', ' ')}</dd></div><div><dt>Bus</dt><dd>{source.bus ?? 'Image file'}</dd></div><div><dt>System disk</dt><dd>{source.systemDisk ? 'Yes' : 'No'}</dd></div></dl></details>
  </article>;
}

function formatBytes(value: string): string {
  const bytes = Number(value);
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${bytes.toLocaleString()} bytes`;
}
