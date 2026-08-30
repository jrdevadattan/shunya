import { ArtifactPageSchema, PreviewDescriptorSchema, type ArtifactPage, type PreviewDescriptor, type RecoveryArtifact } from '@recovery/contracts';
import { ArrowRight, CheckCircle2, Files, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArtifactDetailsPanel } from './ArtifactDetailsPanel.js';
import { ArtifactTable } from './ArtifactTable.js';
import { ResultFilters } from './ResultFilters.js';

export function ResultsPage() {
  const { caseId = '' } = useParams();
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState<string>();
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
      const result = ArtifactPageSchema.parse(await window.recoveryApi.queryArtifacts({ search: search || undefined, method, originalPathPrefix, cursor, pageSize: 100 }));
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
    void window.recoveryApi.queryArtifacts({ search: search || undefined, method, originalPathPrefix, cursor: undefined, pageSize: 100 })
      .then((value) => { const result = ArtifactPageSchema.parse(value); if (!active || generation.current !== expectedGeneration) return; setPage(result); setSelected(result.items[0]?.artifactId); })
      .catch((cause) => { if (active && generation.current === expectedGeneration) setError(message(cause)); });
    return () => { active = false; };
  }, [search, method, originalPathPrefix]);

  useEffect(() => {
    if (!selected) { setPreview(undefined); return; }
    let active = true; setPreview(undefined); setPreviewError(undefined);
    void window.recoveryApi.requestPreview(selected).then((value) => active && setPreview(PreviewDescriptorSchema.parse(value))).catch((cause) => active && setPreviewError(message(cause)));
    return () => { active = false; };
  }, [selected]);

  const artifact = page.items.find((item) => item.artifactId === selected);
  const artifactLabel = `${page.totalCount.toLocaleString('en-US')} indexed ${page.totalCount === 1 ? 'artifact' : 'artifacts'}`;
  const selectedBytes = Array.from(exportSelection.values()).reduce((total, item) => total + BigInt(item.sizeBytes), 0n);
  const selectedCount = exportSelection.size;
  const toggleExport = (item: RecoveryArtifact) => setExportSelection((current) => { const next = new Map(current); if (next.has(item.artifactId)) next.delete(item.artifactId); else next.set(item.artifactId, item); return next; });
  const prepareExport = () => sessionStorage.setItem(`recovery:${caseId}:exportArtifactIds`, JSON.stringify(Array.from(exportSelection.keys())));

  return <section className="results-page">
    <header className="page-heading"><div><p className="eyebrow">Recovered files</p><h1>Recovery results</h1><p className="page-heading__description">Review indexed artifacts, their provenance, and protected preview status without launching recovered originals.</p></div><div className="results-page__status"><CheckCircle2 aria-hidden="true" /><span><strong>{artifactLabel}</strong><small>Daemon-indexed evidence</small></span></div></header>
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    <div className="results-workspace" aria-label="Recovery result browser">
      <ResultFilters artifacts={page.items} search={search} method={method} originalPathPrefix={originalPathPrefix} onSearch={setSearch} onMethod={(value) => { setMethod(value); setOriginalPathPrefix(undefined); }} onFolder={(path) => { setMethod('metadata'); setOriginalPathPrefix(path); setSearch(''); }} />
      <main className="results-browser" aria-label="Recovered artifact table"><header><div><Files aria-hidden="true" /><span><h2>Recovered artifacts</h2><p>{page.items.length.toLocaleString('en-US')} loaded of {artifactLabel}</p></span></div><span><ShieldCheck aria-hidden="true" />Protected review</span></header>
        {page.items.length ? <ArtifactTable artifacts={page.items} selected={selected} exportSelection={exportSelection} onSelect={setSelected} onToggleExport={toggleExport} /> : <p className="empty-state">{error ? 'Results unavailable.' : 'No recovered artifacts were returned.'}</p>}
        {page.nextCursor ? <button className="button button--secondary results-browser__more" type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading more results…' : 'Load more results'}</button> : null}
      </main>
      <ArtifactDetailsPanel artifact={artifact} preview={preview} previewError={previewError} />
    </div>
    <footer className="results-selection" aria-label="Export selection summary"><div><strong>{selectedCount.toLocaleString('en-US')} {selectedCount === 1 ? 'item' : 'items'} selected</strong><span aria-hidden="true">·</span><span>{formatBytes(selectedBytes)} selected</span></div><Link className="button button--primary" to={`/cases/${caseId}/exports`} aria-disabled={selectedCount === 0} onClick={(event) => { if (!selectedCount) event.preventDefault(); else prepareExport(); }}>Review export <ArrowRight aria-hidden="true" /></Link></footer>
  </section>;
}

function formatBytes(bytes: bigint): string { if (bytes < 1_000n) return `${bytes.toLocaleString('en-US')} ${bytes === 1n ? 'byte' : 'bytes'}`; const units: Array<[bigint, string]> = [[1_000_000_000_000n, 'TB'], [1_000_000_000n, 'GB'], [1_000_000n, 'MB'], [1_000n, 'KB']]; for (const [size, label] of units) if (bytes >= size) { const tenths = (bytes * 10n + size / 2n) / size; return `${tenths / 10n}${tenths % 10n ? `.${tenths % 10n}` : ''} ${label}`; } return `${bytes} bytes`; }
function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Recovery results could not be loaded.'; }
