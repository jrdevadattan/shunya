import type { RecoveryArtifact } from '@recovery/contracts';
import { File, FileArchive, FileImage, FileText, Shapes, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { ResultStatusBadge } from '@recovery/ui';

export function ArtifactTable({ artifacts, selected, exportSelection, onSelect, onToggleExport }: {
  artifacts: RecoveryArtifact[]; selected?: string; exportSelection: { has(id: string): boolean };
  onSelect(id: string): void; onToggleExport(artifact: RecoveryArtifact): void;
}) {
  return <div className="artifact-table"><table aria-label="Recovered artifacts"><thead><tr><th scope="col"><span className="sr-only">Export selection</span></th><th scope="col">Name</th><th scope="col">Original path</th><th scope="col">Type</th><th scope="col">Size</th><th scope="col">Condition</th><th scope="col">Threat scan</th></tr></thead><tbody>{artifacts.map((artifact) => {
    const Icon = artifactIcon(artifact);
    const path = artifact.recoveryMethod === 'carving' ? 'Original folder unavailable' : artifact.originalPath ?? 'Original path unavailable';
    const threatened = artifact.threatStatus === 'potential_threat';
    return <tr className={selected === artifact.artifactId ? 'artifact-row is-selected' : 'artifact-row'} key={artifact.artifactId} aria-selected={selected === artifact.artifactId} data-threat={threatened || undefined}>
      <td><input type="checkbox" aria-label={`Select ${artifact.displayName} for export`} checked={exportSelection.has(artifact.artifactId)} onChange={() => onToggleExport(artifact)} /></td>
      <td><button type="button" className="artifact-row__select" onClick={() => onSelect(artifact.artifactId)}><Icon aria-hidden="true" /><span><strong>{artifact.displayName}</strong><small>{artifact.recoveryMethod === 'carving' ? 'Content-signature recovery' : 'File record recovery'}</small></span></button></td>
      <td>{path}</td><td>{artifact.extension?.toUpperCase() ?? artifact.mimeType ?? 'Unknown'}</td><td>{formatBytes(BigInt(artifact.sizeBytes))}</td><td><ResultStatusBadge status={badgeStatus(artifact.recoveryState)} /></td>
      <td><ThreatBadge status={artifact.threatStatus} /></td>
    </tr>;
  })}</tbody></table></div>;
}

function ThreatBadge({ status }: { status: RecoveryArtifact['threatStatus'] }) {
  if (status === 'potential_threat') return <span className="threat-badge" data-tone="threat"><ShieldAlert aria-hidden="true" />Potential threat</span>;
  if (status === 'scan_error') return <span className="threat-badge" data-tone="unknown"><ShieldQuestion aria-hidden="true" />Scan error</span>;
  if (status === 'not_scanned') return <span className="threat-badge" data-tone="unknown"><ShieldQuestion aria-hidden="true" />Not scanned</span>;
  return <span className="threat-badge" data-tone="clean"><ShieldCheck aria-hidden="true" />Clean</span>;
}

function badgeStatus(state: RecoveryArtifact['recoveryState']): 'complete' | 'partial' | 'corrupt' | 'unverified' {
  if (state === 'corrupt') return 'corrupt'; if (state.startsWith('partial')) return 'partial'; if (state.endsWith('unverified')) return 'unverified'; return 'complete';
}
function artifactIcon(artifact: RecoveryArtifact) { if (artifact.recoveryMethod === 'carving') return Shapes; if (artifact.mimeType?.startsWith('image/')) return FileImage; if (artifact.mimeType?.includes('zip') || artifact.mimeType?.includes('archive')) return FileArchive; if (artifact.mimeType?.startsWith('text/') || artifact.mimeType === 'application/pdf') return FileText; return File; }
function formatBytes(bytes: bigint): string { const units: Array<[bigint, string]> = [[1_000_000_000_000n, 'TB'], [1_000_000_000n, 'GB'], [1_000_000n, 'MB'], [1_000n, 'KB']]; for (const [size, label] of units) if (bytes >= size) { const tenths = (bytes * 10n + size / 2n) / size; return `${tenths / 10n}${tenths % 10n ? `.${tenths % 10n}` : ''} ${label}`; } return `${bytes.toLocaleString('en-US')} ${bytes === 1n ? 'byte' : 'bytes'}`; }
