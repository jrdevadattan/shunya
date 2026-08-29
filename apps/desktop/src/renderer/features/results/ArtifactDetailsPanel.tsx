import type { RecoveryArtifact } from '@recovery/contracts';
import { PreviewPanel } from './PreviewPanel.js';

export function ArtifactDetailsPanel({ artifact }: { artifact?: RecoveryArtifact }) {
  if (!artifact) return <aside className="artifact-details"><h2>Details</h2><p>Select a recovered file.</p></aside>;
  return <aside className="artifact-details"><h2>{artifact.displayName}</h2><PreviewPanel artifact={artifact} /><dl><dt>Original path</dt><dd>{artifact.originalPath ?? 'Original path unavailable'}</dd><dt>SHA-256</dt><dd>{artifact.sha256 ?? 'Not calculated'}</dd><dt>Threat check</dt><dd>{artifact.threatStatus === 'no_rule_match' ? 'No rule match' : artifact.threatStatus.replaceAll('_', ' ')}</dd><dt>Source ranges</dt><dd>{artifact.sourceRanges.length}</dd></dl><p>Double-clicking shows full details; it never opens the operating-system application.</p></aside>;
}
