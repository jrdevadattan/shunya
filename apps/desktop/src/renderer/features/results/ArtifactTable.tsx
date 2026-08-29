import type { RecoveryArtifact } from '@recovery/contracts';
import { ResultStatusBadge } from '@recovery/ui';

function badgeStatus(state: RecoveryArtifact['recoveryState']): 'complete' | 'partial' | 'corrupt' | 'unverified' {
  if (state === 'corrupt') return 'corrupt'; if (state.startsWith('partial')) return 'partial'; if (state.endsWith('unverified')) return 'unverified'; return 'complete';
}

export function ArtifactTable({ artifacts, selected, onSelect }: { artifacts: RecoveryArtifact[]; selected?: string; onSelect(id: string): void }) {
  return <div className="artifact-table" role="grid" aria-label="Recovered files"><div className="artifact-table__header" role="row"><span role="columnheader">Name</span><span role="columnheader">Recovery</span><span role="columnheader">Quality</span><span role="columnheader">Size</span></div>{artifacts.map((artifact) => <button type="button" role="row" aria-selected={selected === artifact.artifactId} className={selected === artifact.artifactId ? 'artifact-row is-selected' : 'artifact-row'} key={artifact.artifactId} onClick={() => onSelect(artifact.artifactId)}><span role="gridcell">{artifact.displayName}</span><span role="gridcell">{artifact.recoveryMethod === 'metadata' ? 'Original name available · Recovered from file record' : 'Original name unavailable · Recovered by content signature'}</span><span role="gridcell"><ResultStatusBadge status={badgeStatus(artifact.recoveryState)} /></span><span role="gridcell">{artifact.sizeBytes} bytes</span></button>)}</div>;
}
