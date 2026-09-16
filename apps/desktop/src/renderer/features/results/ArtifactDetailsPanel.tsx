import type { PreviewDescriptor, RecoveryArtifact } from '@recovery/contracts';
import { CheckCircle2, FileQuestion, Fingerprint, MapPin, MousePointerClick, ShieldAlert, ShieldCheck } from 'lucide-react';
import { ResultStatusBadge } from '@recovery/ui';
import { PreviewPanel } from './PreviewPanel.js';
import { formatLabel } from '../recovery/file-families.js';

export function ArtifactDetailsPanel({ artifact, preview, previewError }: { artifact?: RecoveryArtifact; preview?: PreviewDescriptor; previewError?: string }) {
  if (!artifact) return <aside className="artifact-details"><h2>Selected file</h2><p><MousePointerClick aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Select a file to see where it came from and whether it is safe.</p></aside>;
  const carved = artifact.recoveryMethod === 'carving';
  return <aside className="artifact-details" aria-label={`Evidence for ${artifact.displayName}`}>
    <header><div><p>{formatLabel(artifact)} · {formatBytes(BigInt(artifact.sizeBytes))}</p><h2>{artifact.displayName}</h2></div><ResultStatusBadge status={status(artifact.recoveryState)} /></header>
    <PreviewPanel artifact={artifact} preview={preview} error={previewError} />
    <section className="artifact-evidence" aria-labelledby="artifact-evidence-title"><h3 id="artifact-evidence-title">Evidence supporting recovery</h3><ul>
      <li><MapPin aria-hidden="true" /><span><strong>{carved ? 'Original name and folder unavailable' : artifact.originalPath ? 'Original path from a surviving file record' : 'Original path unavailable'}</strong><small>{carved ? 'Found by its content — rename it when you export.' : artifact.originalPath ?? 'No path was recorded.'}</small></span></li>
      <li><CheckCircle2 aria-hidden="true" /><span><strong>{qualityLabel(artifact.recoveryState)}</strong><small>{qualityDetail(artifact.recoveryState)}</small></span></li>
      <li data-threat={artifact.threatStatus === 'potential_threat' || undefined}>{artifact.threatStatus === 'potential_threat' ? <ShieldAlert aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}<span><strong>{threatLabel(artifact.threatStatus)}</strong><small>{threatDetail(artifact.threatStatus, artifact.displayName)}</small></span></li>
      <li><Fingerprint aria-hidden="true" /><span><strong>{artifact.sha256 ? 'SHA-256 recorded' : 'SHA-256 unavailable'}</strong><small className="artifact-evidence__hash">{artifact.sha256 ?? 'No indexed digest was returned.'}</small></span></li>
    </ul></section>
    <details className="artifact-ranges" open><summary><FileQuestion aria-hidden="true" />Source byte ranges ({artifact.sourceRanges.length})</summary>{artifact.sourceRanges.length ? <ol>{artifact.sourceRanges.map((range, index) => <li key={`${range.offset}:${range.length}:${index}`}>Offset {formatInteger(range.offset)} · {formatInteger(range.length)} bytes</li>)}</ol> : <p>No source range evidence was returned.</p>}</details>
  </aside>;
}

function status(state: RecoveryArtifact['recoveryState']): 'complete' | 'partial' | 'corrupt' | 'unverified' { if (state === 'corrupt') return 'corrupt'; if (state.startsWith('partial')) return 'partial'; if (state.endsWith('unverified')) return 'unverified'; return 'complete'; }
function qualityLabel(state: RecoveryArtifact['recoveryState']): string { return ({ complete_validated: 'Complete and validated', complete_unverified: 'Complete, unverified', partial_validated: 'Partial and validated', partial_unverified: 'Partial, unverified', corrupt: 'Corrupt' } as const)[state]; }
function qualityDetail(state: RecoveryArtifact['recoveryState']): string { return ({ complete_validated: 'The file structure checks out end to end.', complete_unverified: 'The end of this format cannot be verified without opening it.', partial_validated: 'The start is intact but the file was cut short on disk.', partial_unverified: 'Some of the file was recovered; completeness is unknown.', corrupt: 'The content did not match a known structure.' } as const)[state]; }
function threatLabel(threat: RecoveryArtifact['threatStatus']): string { return ({ no_rule_match: 'No threat-rule match', potential_threat: 'Potentially unsafe — flagged by YARA-X', scan_error: 'Threat check failed', not_scanned: 'Threat check not scanned' } as const)[threat]; }
function threatDetail(threat: RecoveryArtifact['threatStatus'], name: string): string {
  if (threat === 'potential_threat') return `A threat signature matched inside "${name}". It stays quarantined.`;
  if (threat === 'scan_error') return 'The threat scan could not complete for this file.';
  if (threat === 'not_scanned') return 'This file was not threat-scanned.';
  return 'Scanned, no threat rule matched.';
}
function formatInteger(value: string): string { return BigInt(value).toLocaleString('en-US'); }
function formatBytes(bytes: bigint): string { const units: Array<[bigint, string]> = [[1_000_000_000n, 'GB'], [1_000_000n, 'MB'], [1_000n, 'KB']]; for (const [size, label] of units) if (bytes >= size) { const tenths = (bytes * 10n + size / 2n) / size; return `${tenths / 10n}${tenths % 10n ? `.${tenths % 10n}` : ''} ${label}`; } return `${bytes.toLocaleString('en-US')} bytes`; }
