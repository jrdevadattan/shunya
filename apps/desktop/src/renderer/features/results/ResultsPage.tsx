import { useMemo, useState } from 'react';
import type { RecoveryArtifact } from '@recovery/contracts';
import { ArtifactDetailsPanel } from './ArtifactDetailsPanel.js';
import { ArtifactTable } from './ArtifactTable.js';
import { ResultFilters } from './ResultFilters.js';

const artifacts: RecoveryArtifact[] = [
  { artifactId: 'a1', sourceId: 's1', partitionId: 'p1', originalName: 'report.pdf', originalPath: '/Finance/report.pdf', displayName: 'report.pdf', extension: 'pdf', mimeType: 'application/pdf', sizeBytes: '48210', recoveryMethod: 'metadata', recoveryState: 'complete_validated', sha256: 'a'.repeat(64), sourceRanges: [], threatStatus: 'no_rule_match', previewStatus: 'safe_preview' },
  { artifactId: 'a2', sourceId: 's1', partitionId: null, originalName: null, originalPath: null, displayName: 'Recovered JPEG 0000123', extension: 'jpg', mimeType: 'image/jpeg', sizeBytes: '15042', recoveryMethod: 'carving', recoveryState: 'complete_unverified', sha256: 'b'.repeat(64), sourceRanges: [], threatStatus: 'no_rule_match', previewStatus: 'safe_preview' },
  { artifactId: 'a3', sourceId: 's1', partitionId: 'p1', originalName: 'script.exe', originalPath: '/Downloads/script.exe', displayName: 'script.exe', extension: 'exe', mimeType: 'application/x-msdownload', sizeBytes: '8128', recoveryMethod: 'metadata', recoveryState: 'partial_unverified', sha256: null, sourceRanges: [], threatStatus: 'no_rule_match', previewStatus: 'blocked' },
];

export function ResultsPage() {
  const [search, setSearch] = useState(''); const [selected, setSelected] = useState('a1');
  const filtered = useMemo(() => artifacts.filter((artifact) => `${artifact.displayName} ${artifact.originalPath ?? ''}`.toLowerCase().includes(search.toLowerCase())), [search]);
  return <section className="results-page"><header><p className="eyebrow">Recovered files</p><h1>Review recovery results</h1><p>Results appear while scanning continues. Pages are loaded from the case index, up to 500 at a time.</p></header><div className="results-workspace"><ResultFilters search={search} onSearch={setSearch} /><main><ArtifactTable artifacts={filtered} selected={selected} onSelect={setSelected} /></main><ArtifactDetailsPanel artifact={artifacts.find((artifact) => artifact.artifactId === selected)} /></div></section>;
}
