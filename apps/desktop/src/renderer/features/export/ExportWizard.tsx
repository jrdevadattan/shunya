import { ArtifactPageSchema, ExportJobSchema, type ArtifactPage, type ExportJob } from '@recovery/contracts';
import { useEffect, useState, type FormEvent } from 'react';

export function ExportWizard() {
  const [page, setPage] = useState<ArtifactPage>({ items: [], nextCursor: null });
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<ExportJob>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  useEffect(() => {
    void window.recoveryApi.queryArtifacts({ pageSize: 500 }).then((value) => {
      const loaded = ArtifactPageSchema.parse(value);
      setPage(loaded);
      setSelected(loaded.items.map((item) => item.artifactId));
    }).catch((cause) => setError(message(cause)));
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(undefined); setResult(undefined); setRunning(true);
    const values = new FormData(event.currentTarget);
    try {
      setResult(ExportJobSchema.parse(await window.recoveryApi.exportArtifacts({
        artifactIds: selected,
        destinationPath: String(values.get('destinationPath') ?? '').trim(),
        destinationPhysicalId: String(values.get('destinationPhysicalId') ?? '').trim(),
        acknowledgeUnsafe: values.get('acknowledgeUnsafe') === 'on',
      })));
    } catch (cause) { setError(message(cause)); } finally { setRunning(false); }
  }
  return <section className="workflow-page export-wizard"><header><p className="eyebrow">Verified export</p><h1>Export recovered files</h1><p>The daemon proves destination topology before copying and verifies every exported hash.</p></header>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <form className="case-form" onSubmit={submit}><fieldset><legend>Select recovered artifacts</legend>{page.items.map((artifact) => <label key={artifact.artifactId}><input type="checkbox" checked={selected.includes(artifact.artifactId)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, artifact.artifactId] : current.filter((id) => id !== artifact.artifactId))} />{artifact.displayName}</label>)}</fieldset><label>Export destination path<input name="destinationPath" required /></label><label>Destination physical identity<input name="destinationPhysicalId" required /></label><label><input name="acknowledgeUnsafe" type="checkbox" /> I authorize controlled export of potentially unsafe selected files.</label><button className="button button--primary" type="submit" disabled={running || selected.length === 0}>{running ? 'Exporting and verifying…' : 'Start verified export'}</button></form>
    <p className="form-hint">Export can be refused when the daemon cannot prove that source and destination have separate physical topology.</p>
    {result ? <div className="completion-card" role="status"><h2>Export complete</h2><p>Export ID: {result.exportId}</p><p>{result.items.filter((item) => item.verified).length} {result.items.length === 1 ? 'file' : 'files'} exported and verified.</p><ul>{result.items.map((item) => <li key={item.artifactId}>{item.outputPath} · {item.verified ? 'SHA-256 verified' : 'Verification failed'}</li>)}</ul><p>The destination was not opened automatically.</p></div> : null}
  </section>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'The export could not be started.'; }
