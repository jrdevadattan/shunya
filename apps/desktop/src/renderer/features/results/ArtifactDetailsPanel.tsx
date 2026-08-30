import type { PreviewDescriptor, RecoveryArtifact } from '@recovery/contracts';
import { CheckCircle2, FileQuestion, Fingerprint, MapPin, ShieldCheck } from 'lucide-react';
import { ResultStatusBadge } from '@recovery/ui';
import { PreviewPanel } from './PreviewPanel.js';

export function ArtifactDetailsPanel({ artifact, preview, previewError }: { artifact?: RecoveryArtifact; preview?: PreviewDescriptor; previewError?: string }) {
  if (!artifact) return <aside className="artifact-details"><h2>Selection insights</h2><p>Select a recovered artifact to inspect its daemon-recorded evidence.</p></aside>;
  const carved = artifact.recoveryMethod === 'carving';
  return <aside className="artifact-details" aria-label={`Evidence for ${artifact.displayName}`}><header><div><p>Selected artifact</p><h2>{artifact.displayName}</h2></div><ResultStatusBadge status={status(artifact.recoveryState)} /></header><PreviewPanel artifact={artifact} preview={preview} error={previewError} />
    <section className="artifact-evidence" aria-labelledby="artifact-evidence-title"><h3 id="artifact-evidence-title">Evidence supporting recovery</h3><ul>
      <li><MapPin aria-hidden="true" /><span><strong>{carved ? 'Original name and folder unavailable' : artifact.originalPath ? 'Original path from a surviving file record' : 'Original path unavailable'}</strong><small>{carved ? 'Recovered by content signature; no original folder is assigned.' : artifact.originalPath ?? 'The daemon did not return path provenance.'}</small></span></li>
      <li><CheckCircle2 aria-hidden="true" /><span><strong>{qualityLabel(artifact.recoveryState)}</strong><small>Validation state returned by the recovery daemon.</small></span></li>
      <li><ShieldCheck aria-hidden="true" /><span><strong>{threatLabel(artifact.threatStatus)}</strong><small>A no-rule-match result is classification evidence, not proof of safety.</small></span></li>
      <li><Fingerprint aria-hidden="true" /><span><strong>{artifact.sha256 ? 'SHA-256 recorded' : 'SHA-256 unavailable'}</strong><small className="artifact-evidence__hash">{artifact.sha256 ?? 'No indexed digest was returned.'}</small></span></li>
    </ul></section>
    <details className="artifact-ranges"><summary><FileQuestion aria-hidden="true" />Source byte ranges ({artifact.sourceRanges.length})</summary>{artifact.sourceRanges.length ? <ol>{artifact.sourceRanges.map((range, index) => <li key={`${range.offset}:${range.length}:${index}`}>Offset {formatInteger(range.offset)} · {formatInteger(range.length)} bytes</li>)}</ol> : <p>No source range evidence was returned.</p>}</details>
  </aside>;
}

function status(state: RecoveryArtifact['recoveryState']): 'complete' | 'partial' | 'corrupt' | 'unverified' { if (state === 'corrupt') return 'corrupt'; if (state.startsWith('partial')) return 'partial'; if (state.endsWith('unverified')) return 'unverified'; return 'complete'; }
function qualityLabel(state: RecoveryArtifact['recoveryState']): string { return ({ complete_validated: 'Complete and validated', complete_unverified: 'Complete, unverified', partial_validated: 'Partial and validated', partial_unverified: 'Partial, unverified', corrupt: 'Corrupt' } as const)[state]; }
function threatLabel(threat: RecoveryArtifact['threatStatus']): string { return ({ no_rule_match: 'No threat-rule match', potential_threat: 'Potentially unsafe', scan_error: 'Threat check failed', not_scanned: 'Threat check not scanned' } as const)[threat]; }
function formatInteger(value: string): string { return BigInt(value).toLocaleString('en-US'); }
