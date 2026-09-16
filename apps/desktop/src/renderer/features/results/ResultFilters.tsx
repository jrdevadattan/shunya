import type { RecoveryArtifact } from '@recovery/contracts';
import { FileQuestion, Files, Folder, FolderOpen, Search, Shapes } from 'lucide-react';
import { FILE_FAMILIES, OTHER_BUCKET, familyOf, type FamilyBucket } from '../recovery/file-families.js';

interface FolderNode { label: string; path: string; count: number; children: FolderNode[]; }
interface MutableFolderNode { label: string; path: string; count: number; children: Map<string, MutableFolderNode>; }

export function ResultFilters({ artifacts, search, method, family, originalPathPrefix, onSearch, onMethod, onFamily, onFolder }: {
  artifacts: RecoveryArtifact[]; search: string; method?: string; family?: FamilyBucket; originalPathPrefix?: string;
  onSearch(value: string): void; onMethod(value?: string): void; onFamily(value?: FamilyBucket): void; onFolder(path: string): void;
}) {
  const folders = buildFolderTree(artifacts);
  const carvedCount = artifacts.filter((artifact) => artifact.recoveryMethod === 'carving').length;
  const metadataCount = artifacts.filter((artifact) => artifact.recoveryMethod === 'metadata').length;
  const familyCounts = countFamilies(artifacts);
  const familyRows = [...FILE_FAMILIES.map(({ id, label, Icon }) => ({ id: id as FamilyBucket, label, Icon })), OTHER_BUCKET]
    .filter((row) => (familyCounts.get(row.id) ?? 0) > 0 || family === row.id);
  return <aside className="results-filters">
    <label className="results-search"><span>Search recovered files</span><span><Search aria-hidden="true" /><input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Name, path, or type" /></span></label>
    <nav aria-label="Recovered artifact folders and filters">
      <section aria-labelledby="recovered-data-title"><header><h2 id="recovered-data-title">Recovered data</h2><span>{artifacts.length} loaded</span></header><ul className="result-filter-list">
        <li><button type="button" aria-pressed={!method && !family} onClick={() => { onMethod(undefined); onFamily(undefined); }}><Files aria-hidden="true" /><span>All results</span></button><small>{artifacts.length}</small></li>
        <li><button type="button" aria-pressed={method === 'metadata'} onClick={() => onMethod('metadata')}><FolderOpen aria-hidden="true" /><span>Original folders</span></button><small>{metadataCount}</small></li>
        {folders.map((folder) => <FolderBranch key={folder.path} folder={folder} selectedPath={originalPathPrefix} onFolder={onFolder} />)}
        <li><button type="button" aria-pressed={method === 'carving'} onClick={() => onMethod('carving')}><Shapes aria-hidden="true" /><span>Content-signature recovery</span></button><small>{carvedCount}</small></li>
        <li className="result-filter-list__truth"><FileQuestion aria-hidden="true" /><span>Files found by content have no original folder.</span></li>
      </ul></section>
      <section aria-labelledby="file-types-title" className="results-filters__families"><header><h2 id="file-types-title">File types</h2><span>{familyRows.length ? `${familyRows.length} ${familyRows.length === 1 ? 'family' : 'families'}` : 'None loaded'}</span></header>
        {familyRows.length ? <ul className="result-filter-list result-filter-list--families">
          {familyRows.map(({ id, label, Icon }) => <li key={id}><button type="button" aria-pressed={family === id} data-family={id} onClick={() => onFamily(family === id ? undefined : id)}><Icon aria-hidden="true" /><span>{label}</span></button><small>{familyCounts.get(id) ?? 0}</small></li>)}
        </ul> : <p className="result-filter-list__empty">Type filters appear once artifacts are loaded.</p>}
      </section>
    </nav>
  </aside>;
}

function countFamilies(artifacts: RecoveryArtifact[]): Map<FamilyBucket, number> {
  const counts = new Map<FamilyBucket, number>();
  for (const artifact of artifacts) {
    const bucket = familyOf(artifact);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return counts;
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
