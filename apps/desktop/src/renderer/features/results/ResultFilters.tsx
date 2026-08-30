import type { RecoveryArtifact } from '@recovery/contracts';
import { FileQuestion, Files, Folder, FolderOpen, Search, Shapes } from 'lucide-react';

interface FolderNode { label: string; path: string; count: number; children: FolderNode[]; }
interface MutableFolderNode { label: string; path: string; count: number; children: Map<string, MutableFolderNode>; }

export function ResultFilters({ artifacts, search, method, originalPathPrefix, onSearch, onMethod, onFolder }: {
  artifacts: RecoveryArtifact[]; search: string; method?: string; originalPathPrefix?: string;
  onSearch(value: string): void; onMethod(value?: string): void; onFolder(path: string): void;
}) {
  const folders = buildFolderTree(artifacts);
  const carvedCount = artifacts.filter((artifact) => artifact.recoveryMethod === 'carving').length;
  const metadataCount = artifacts.filter((artifact) => artifact.recoveryMethod === 'metadata').length;
  return <aside className="results-filters">
    <label className="results-search"><span>Search recovered files</span><span><Search aria-hidden="true" /><input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Name, path, or type" /></span></label>
    <nav aria-label="Recovered artifact folders and filters"><section aria-labelledby="recovered-data-title"><header><h2 id="recovered-data-title">Recovered data</h2><span>{artifacts.length} loaded</span></header><ul className="result-filter-list">
      <li><button type="button" aria-pressed={!method} onClick={() => onMethod(undefined)}><Files aria-hidden="true" /><span>All results</span></button><small>{artifacts.length}</small></li>
      <li><button type="button" aria-pressed={method === 'metadata'} onClick={() => onMethod('metadata')}><FolderOpen aria-hidden="true" /><span>Original folders</span></button><small>{metadataCount}</small></li>
      {folders.map((folder) => <FolderBranch key={folder.path} folder={folder} selectedPath={originalPathPrefix} onFolder={onFolder} />)}
      <li><button type="button" aria-pressed={method === 'carving'} onClick={() => onMethod('carving')}><Shapes aria-hidden="true" /><span>Content-signature recovery</span></button><small>{carvedCount}</small></li>
      <li className="result-filter-list__truth"><FileQuestion aria-hidden="true" /><span>Carved artifacts stay outside original folders because their folder provenance is unavailable.</span></li>
    </ul></section></nav>
  </aside>;
}

function FolderBranch({ folder, selectedPath, onFolder }: { folder: FolderNode; selectedPath?: string; onFolder(path: string): void }) {
  return <li className="result-folder-branch"><button type="button" aria-pressed={selectedPath === folder.path} onClick={() => onFolder(folder.path)}><Folder aria-hidden="true" /><span>{folder.label}</span><small>{folder.count}</small></button>{folder.children.length ? <ul>{folder.children.map((child) => <FolderBranch key={child.path} folder={child} selectedPath={selectedPath} onFolder={onFolder} />)}</ul> : null}</li>;
}

export function buildFolderTree(artifacts: RecoveryArtifact[]): FolderNode[] {
  const roots = new Map<string, MutableFolderNode>();
  for (const artifact of artifacts) {
    if (artifact.recoveryMethod !== 'metadata' || !artifact.originalPath) continue;
    const parts = artifact.originalPath.split(/[\\/]+/).filter(Boolean).slice(0, -1);
    let siblings = roots; let path = '';
    for (const part of parts) {
      path = path ? `${path}/${part}` : part;
      let node = siblings.get(part);
      if (!node) { node = { label: part, path, count: 0, children: new Map() }; siblings.set(part, node); }
      node.count += 1; siblings = node.children;
    }
  }
  const finalize = (nodes: Map<string, MutableFolderNode>): FolderNode[] => Array.from(nodes.values(), (node) => ({ label: node.label, path: node.path, count: node.count, children: finalize(node.children) }));
  return finalize(roots);
}
