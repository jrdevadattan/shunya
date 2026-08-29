import { ArtifactPageSchema, PreviewDescriptorSchema, type ArtifactPage, type PreviewDescriptor } from '@recovery/contracts';
import { useEffect, useState } from 'react';
import { ArtifactDetailsPanel } from './ArtifactDetailsPanel.js';
import { ArtifactTable } from './ArtifactTable.js';
import { ResultFilters } from './ResultFilters.js';

export function ResultsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState<ArtifactPage>({ items: [], nextCursor: null });
  const [selected, setSelected] = useState<string>();
  const [preview, setPreview] = useState<PreviewDescriptor>();
  const [previewError, setPreviewError] = useState<string>();
  const [error, setError] = useState<string>();

  async function load(cursor?: string) {
    try {
      const result = ArtifactPageSchema.parse(await window.recoveryApi.queryArtifacts({ search: search || undefined, cursor, pageSize: 100 }));
      setPage((current) => cursor ? { items: [...current.items, ...result.items], nextCursor: result.nextCursor } : result);
      setSelected((current) => current ?? result.items[0]?.artifactId);
      setError(undefined);
    } catch (cause) { setError(message(cause)); }
  }
  useEffect(() => { void load(); }, [search]);
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
  return <section className="results-page"><header><p className="eyebrow">Recovered files</p><h1>Review recovery results</h1><p>Results are loaded from the case index in daemon-paginated pages.</p></header>{error ? <p role="alert" className="form-error">{error}</p> : null}<div className="results-workspace"><ResultFilters search={search} onSearch={setSearch} /><main>{page.items.length ? <ArtifactTable artifacts={page.items} selected={selected} onSelect={setSelected} /> : <p>{error ? 'Results unavailable.' : 'No recovered artifacts were returned.'}</p>}{page.nextCursor ? <button className="button button--secondary" type="button" onClick={() => void load(page.nextCursor ?? undefined)}>Load more results</button> : null}</main><ArtifactDetailsPanel artifact={artifact} preview={preview} previewError={previewError} /></div></section>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Recovery results could not be loaded.'; }
