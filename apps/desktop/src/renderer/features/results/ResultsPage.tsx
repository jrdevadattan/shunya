import { ArtifactPageSchema, PreviewDescriptorSchema, type ArtifactPage, type PreviewDescriptor } from '@recovery/contracts';
import { useEffect, useRef, useState } from 'react';
import { SurfaceCard } from '@recovery/ui';
import { ArtifactDetailsPanel } from './ArtifactDetailsPanel.js';
import { ArtifactTable } from './ArtifactTable.js';
import { ResultFilters } from './ResultFilters.js';

export function ResultsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState<ArtifactPage>({ items: [], nextCursor: null, totalCount: 0 });
  const [selected, setSelected] = useState<string>();
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
    appendInFlight.current = true;
    setLoadingMore(true);
    const expectedGeneration = generation.current;
    const expectedAppendToken = ++appendToken.current;
    try {
      const result = ArtifactPageSchema.parse(await window.recoveryApi.queryArtifacts({ search: search || undefined, cursor, pageSize: 100 }));
      if (generation.current === expectedGeneration) {
        setPage((current) => current.nextCursor === cursor ? { items: [...current.items, ...result.items], nextCursor: result.nextCursor, totalCount: result.totalCount } : current);
        setError(undefined);
      }
    } catch (cause) {
      if (generation.current === expectedGeneration) setError(message(cause));
    } finally {
      if (appendToken.current === expectedAppendToken) {
        appendInFlight.current = false;
        setLoadingMore(false);
      }
    }
  }
  useEffect(() => {
    let active = true;
    const expectedGeneration = generation.current + 1;
    generation.current = expectedGeneration;
    appendToken.current += 1;
    appendInFlight.current = false;
    setLoadingMore(false);
    setPage({ items: [], nextCursor: null, totalCount: 0 });
    setSelected(undefined);
    setPreview(undefined);
    setPreviewError(undefined);
    setError(undefined);
    void window.recoveryApi.queryArtifacts({ search: search || undefined, cursor: undefined, pageSize: 100 })
      .then((value) => {
        const result = ArtifactPageSchema.parse(value);
        if (!active || generation.current !== expectedGeneration) return;
        setPage(result);
        setSelected(result.items[0]?.artifactId);
      })
      .catch((cause) => { if (active && generation.current === expectedGeneration) setError(message(cause)); });
    return () => { active = false; };
  }, [search]);
  useEffect(() => {
    if (!selected) { setPreview(undefined); return; }
    let active = true;
    setPreview(undefined); setPreviewError(undefined);
    void window.recoveryApi.requestPreview(selected)
      .then((value) => active && setPreview(PreviewDescriptorSchema.parse(value)))
      .catch((cause) => active && setPreviewError(message(cause)));
    return () => { active = false; };
  }, [selected]);
  const artifact = page.items.find((item) => item.artifactId === selected);
  const artifactLabel = `${page.totalCount} indexed ${page.totalCount === 1 ? 'artifact' : 'artifacts'}`;
  return <section className="results-page">
    <header className="page-heading"><div><p className="eyebrow">Recovered files</p><h1>Review recovery results</h1><p className="page-heading__description">Browse daemon-indexed artifacts without opening recovered originals in an operating-system application.</p></div><span className="results-page__count">{artifactLabel}</span></header>
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    <div className="results-workspace" aria-label="Recovery result browser">
      <ResultFilters search={search} onSearch={setSearch} />
      <main className="results-browser"><SurfaceCard title="Recovered files" description={`${page.items.length} loaded of ${page.totalCount} indexed`}>
        {page.items.length ? <ArtifactTable artifacts={page.items} selected={selected} onSelect={setSelected} /> : <p className="empty-state">{error ? 'Results unavailable.' : 'No recovered artifacts were returned.'}</p>}
        {page.nextCursor ? <button className="button button--secondary results-browser__more" type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading more results…' : 'Load more results'}</button> : null}
      </SurfaceCard></main>
      <ArtifactDetailsPanel artifact={artifact} preview={preview} previewError={previewError} />
    </div>
  </section>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Recovery results could not be loaded.'; }
