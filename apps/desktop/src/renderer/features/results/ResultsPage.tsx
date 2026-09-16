import { ArtifactPageSchema, PreviewDescriptorSchema, type ArtifactPage, type PreviewDescriptor, type RecoveryArtifact } from '@recovery/contracts';
import { ArrowRight, CheckCircle2, Files, Layers, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArtifactDetailsPanel } from './ArtifactDetailsPanel.js';
import { ArtifactTable } from './ArtifactTable.js';
import { ResultFilters } from './ResultFilters.js';
import { familyLabel, familyOf, type FamilyBucket } from '../recovery/file-families.js';

export function ResultsPage() {
  const { caseId = '' } = useParams();
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState<string>();
  const [family, setFamily] = useState<FamilyBucket>();
  const [originalPathPrefix, setOriginalPathPrefix] = useState<string>();
  const [page, setPage] = useState<ArtifactPage>({ items: [], nextCursor: null, totalCount: 0 });
  const [selected, setSelected] = useState<string>();
  const [exportSelection, setExportSelection] = useState<Map<string, RecoveryArtifact>>(() => new Map());
  const [preview, setPreview] = useState<PreviewDescriptor>();
  const [previewError, setPreviewError] = useState<string>();
  const [error, setError] = useState<string>();
  const [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef(0);
  const appendToken = useRef(0);
  const appendInFlight = useRef(false);

  async function loadMore() {
    const cursor = page.nextCursor;
    if (!cursor || appendInFlight.current) return;
    appendInFlight.current = true; setLoadingMore(true);
    const expectedGeneration = generation.current;
    const expectedAppendToken = ++appendToken.current;
    try {
      const result = ArtifactPageSchema.parse(await window.recoveryApi.queryArtifacts({ search: search || undefined, method, family, originalPathPrefix, cursor, pageSize: 100 }));
      if (generation.current === expectedGeneration) {
        setPage((current) => current.nextCursor === cursor ? { items: [...current.items, ...result.items], nextCursor: result.nextCursor, totalCount: result.totalCount } : current);
        setError(undefined);
      }
    } catch (cause) {
      if (generation.current === expectedGeneration) setError(message(cause));
    } finally {
      if (appendToken.current === expectedAppendToken) { appendInFlight.current = false; setLoadingMore(false); }
    }
  }

  useEffect(() => {
    let active = true;
    const expectedGeneration = generation.current + 1;
    generation.current = expectedGeneration; appendToken.current += 1; appendInFlight.current = false;
    setLoadingMore(false); setPage({ items: [], nextCursor: null, totalCount: 0 }); setSelected(undefined); setPreview(undefined); setPreviewError(undefined); setError(undefined);
    void window.recoveryApi.queryArtifacts({ search: search || undefined, method, family, originalPathPrefix, cursor: undefined, pageSize: 100 })
      .then((value) => { const result = ArtifactPageSchema.parse(value); if (!active || generation.current !== expectedGeneration) return; setPage(result); setSelected(result.items[0]?.artifactId); })
      .catch((cause) => { if (active && generation.current === expectedGeneration) setError(message(cause)); });
    return () => { active = false; };
  }, [search, method, family, originalPathPrefix]);

  useEffect(() => {
    if (!selected) { setPreview(undefined); return; }
    let active = true; setPreview(undefined); setPreviewError(undefined);
    void window.recoveryApi.requestPreview(selected).then((value) => active && setPreview(PreviewDescriptorSchema.parse(value))).catch((cause) => active && setPreviewError(message(cause)));
    return () => { active = false; };
  }, [selected]);

  const artifact = page.items.find((item) => item.artifactId === selected);
  const artifactLabel = `${page.totalCount.toLocaleString('en-US')} indexed ${page.totalCount === 1 ? 'artifact' : 'artifacts'}`;
  const threatCount = page.items.filter((item) => item.threatStatus === 'potential_threat').length;
  const validatedCount = page.items.filter((item) => item.recoveryState === 'complete_validated').length;
  const familyCount = new Set(page.items.map(familyOf)).size;
  const selectedBytes = Array.from(exportSelection.values()).reduce((total, item) => total + BigInt(item.sizeBytes), 0n);
  const selectedCount = exportSelection.size;
  const toggleExport = (item: RecoveryArtifact) => setExportSelection((current) => { const next = new Map(current); if (next.has(item.artifactId)) next.delete(item.artifactId); else next.set(item.artifactId, item); return next; });
  const selectAllLoaded = () => setExportSelection(new Map(page.items.map((item) => [item.artifactId, item])));
  const clearSelection = () => setExportSelection(new Map());
  const prepareExport = () => sessionStorage.setItem(`recovery:${caseId}:exportArtifactIds`, JSON.stringify(Array.from(exportSelection.keys())));
  const activeFilters = [method === 'metadata' ? 'File records' : method === 'carving' ? 'Content signatures' : undefined, family ? familyLabel(family) : undefined, originalPathPrefix, search ? `“${search}”` : undefined].filter(Boolean);

  return <section className="results-page">
    <header className="page-heading"><div><p className="eyebrow">Recovered files</p><h1>Recovered files</h1><p className="page-heading__description">Everything found in this recovery, already checked and threat-scanned. Tick the files you want, then export them.</p></div>
      <div className="results-page__summary">
        <div className="results-page__status"><CheckCircle2 aria-hidden="true" /><span><strong>{artifactLabel}</strong><small>Indexed by the recovery service</small></span></div>
        <div className="results-page__stat"><Layers aria-hidden="true" /><span><strong>{familyCount} {familyCount === 1 ? 'file type' : 'file types'}</strong><small>{validatedCount.toLocaleString('en-US')} validated of {page.items.length.toLocaleString('en-US')} loaded</small></span></div>
        {threatCount > 0 ? <div className="results-page__threats"><ShieldAlert aria-hidden="true" /><span><strong>{threatCount} potential threat{threatCount === 1 ? '' : 's'}</strong><small>Flagged by YARA-X · quarantined</small></span></div> : null}
      </div>
    </header>
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    <div className="results-workspace" aria-label="Recovery result browser">
      <ResultFilters artifacts={page.items} search={search} method={method} family={family} originalPathPrefix={originalPathPrefix} onSearch={setSearch} onMethod={(value) => { setMethod(value); setOriginalPathPrefix(undefined); }} onFamily={setFamily} onFolder={(path) => { setMethod('metadata'); setOriginalPathPrefix(path); setSearch(''); }} />
      <main className="results-browser" aria-label="Recovered artifact table"><header><div><Files aria-hidden="true" /><span><h2>Files</h2><p>{page.items.length.toLocaleString('en-US')} loaded of {artifactLabel}{activeFilters.length ? ` · filtered by ${activeFilters.join(' · ')}` : ''}</p></span></div><span><ShieldCheck aria-hidden="true" />Protected review</span></header>
        {page.items.length ? <ArtifactTable artifacts={page.items} selected={selected} exportSelection={exportSelection} onSelect={setSelected} onToggleExport={toggleExport} /> : <p className="empty-state">{error ? 'Results unavailable.' : activeFilters.length ? 'No recovered files match the current filters.' : 'No recovered files were returned.'}</p>}
        {page.nextCursor ? <button className="button button--secondary results-browser__more" type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading more…' : 'Load more'}</button> : null}
      </main>
      <ArtifactDetailsPanel artifact={artifact} preview={preview} previewError={previewError} />
    </div>
    <footer className="results-selection" aria-label="Export selection summary">
      <div>
        <strong>{selectedCount.toLocaleString('en-US')} {selectedCount === 1 ? 'item' : 'items'} selected</strong><span aria-hidden="true">·</span><span>{formatBytes(selectedBytes)} selected</span>
        <button type="button" className="button button--ghost button--small" onClick={selectedCount === page.items.length && page.items.length > 0 ? clearSelection : selectAllLoaded} disabled={!page.items.length}>{selectedCount === page.items.length && page.items.length > 0 ? 'Clear selection' : 'Select all loaded'}</button>
      </div>
      <Link className="button button--primary" to={`/cases/${caseId}/exports`} aria-disabled={selectedCount === 0} onClick={(event) => { if (!selectedCount) event.preventDefault(); else prepareExport(); }}>Review export <ArrowRight aria-hidden="true" /></Link>
    </footer>
  </section>;
}

function formatBytes(bytes: bigint): string { if (bytes < 1_000n) return `${bytes.toLocaleString('en-US')} ${bytes === 1n ? 'byte' : 'bytes'}`; const units: Array<[bigint, string]> = [[1_000_000_000_000n, 'TB'], [1_000_000_000n, 'GB'], [1_000_000n, 'MB'], [1_000n, 'KB']]; for (const [size, label] of units) if (bytes >= size) { const tenths = (bytes * 10n + size / 2n) / size; return `${tenths / 10n}${tenths % 10n ? `.${tenths % 10n}` : ''} ${label}`; } return `${bytes} bytes`; }
function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Recovery results could not be loaded.'; }
