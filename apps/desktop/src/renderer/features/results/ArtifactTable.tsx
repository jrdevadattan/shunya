import type { RecoveryArtifact } from '@recovery/contracts';
import { ResultStatusBadge } from '@recovery/ui';

function badgeStatus(state: RecoveryArtifact['recoveryState']): 'complete' | 'partial' | 'corrupt' | 'unverified' {
  if (state === 'corrupt') return 'corrupt'; if (state.startsWith('partial')) return 'partial'; if (state.endsWith('unverified')) return 'unverified'; return 'complete';
}

export function ArtifactTable({ artifacts, selected, onSelect }: { artifacts: RecoveryArtifact[]; selected?: string; onSelect(id: string): void }) {
  return <div className="artifact-table" role="grid" aria-label="Recovered files"><div className="artifact-table__header" role="row"><span>Name</span><span>Recovery</span><span>Quality</span><span>Size</span></div>{artifacts.map((artifact) => <button type="button" role="row" className={selected === artifact.artifactId ? 'artifact-row is-selected' : 'artifact-row'} key={artifact.artifactId} onClick={() => onSelect(artifact.artifactId)}><span>{artifact.displayName}</span><span>{artifact.recoveryMethod === 'metadata' ? 'Original name available · Recovered from file record' : 'Original name unavailable · Recovered by content signature'}</span><ResultStatusBadge status={badgeStatus(artifact.recoveryState)} /><span>{artifact.sizeBytes} bytes</span></button>)}</div>;
}
