import { ArtifactPageSchema, ExportJobSchema, type ExportJob, type RecoveryArtifact } from '@recovery/contracts';
import { ArrowRight, CheckCircle2, CheckSquare2, File, FolderLock, HardDrive, LoaderCircle, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';

interface ExportSelection {
  artifactIds: string[];
  totalCount: number;
  totalBytes: bigint;
  previewItems: RecoveryArtifact[];
  sourceIds: string[];
  conditions: Record<RecoveryArtifact['recoveryState'], number>;
}

const emptyConditions = (): ExportSelection['conditions'] => ({ complete_validated: 0, complete_unverified: 0, partial_validated: 0, partial_unverified: 0, corrupt: 0 });

export function ExportWizard() {
  const { caseId = '' } = useParams();
  const [selection, setSelection] = useState<ExportSelection>();
  const [result, setResult] = useState<ExportJob>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const [loadingCount, setLoadingCount] = useState(0);
  const [submittedCount, setSubmittedCount] = useState(0);

  useEffect(() => {
    let active = true;
    void loadCompleteSelection(caseId, (count) => { if (active) setLoadingCount(count); })
      .then((loaded) => { if (active) setSelection(loaded); })
      .catch((cause) => { if (active) setError(message(cause)); });
    return () => { active = false; };
  }, [caseId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection) return;
    const ineligibleCount = selection.artifactIds.length - selection.conditions.complete_validated;
    if (ineligibleCount > 0) { setError(verifiedSelectionMessage(ineligibleCount, selection.artifactIds.length)); return; }
    setError(undefined); setResult(undefined); setRunning(true); setSubmittedCount(selection.artifactIds.length);
    const values = new FormData(event.currentTarget);
    try {
      setResult(ExportJobSchema.parse(await window.recoveryApi.exportArtifacts({
        artifactIds: selection.artifactIds,
        destinationPath: String(values.get('destinationPath') ?? '').trim(),
        acknowledgeUnsafe: values.get('acknowledgeUnsafe') === 'on',
      })));
    } catch (cause) { setError(message(cause)); } finally { setRunning(false); }
  }

  const selectedCount = selection?.artifactIds.length ?? 0;
  const ineligibleCount = selection ? selectedCount - selection.conditions.complete_validated : 0;
  const verifiedCount = result?.items.filter((item) => item.verified).length ?? 0;
  const completelyVerified = Boolean(result?.items.length && result.items.length === submittedCount && verifiedCount === result.items.length);
  const sourceLabel = !selection ? 'Loading source identity…' : selection.sourceIds.length === 1 ? selection.sourceIds[0] : `${selection.sourceIds.length} source identities`;

  return <section className="workflow-page export-wizard">
    <header className="page-heading"><div><p className="eyebrow">Verified export</p><h1>Review export</h1><p className="page-heading__description">Confirm what will be copied and where. The daemon proves physical separation before writing and verifies returned hashes.</p></div></header>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <figure className="export-safety" aria-labelledby="export-safety-title"><article><HardDrive aria-hidden="true" /><span><strong id="export-safety-title">Recovery source</strong><small>{sourceLabel}{selection ? ' · read-only' : ''}</small></span></article><ArrowRight aria-hidden="true" /><article className="export-safety__workspace"><FolderLock aria-hidden="true" /><span><strong>Protected recovery workspace</strong><small>Original recovered files are not launched.</small></span></article><ArrowRight aria-hidden="true" /><article><HardDrive aria-hidden="true" /><span><strong>Export destination</strong><small>Pending daemon topology verification</small></span></article><figcaption><ShieldCheck aria-hidden="true" />The export is refused unless source and destination physical topology can be proven separate.</figcaption></figure>
    <form className="export-form" onSubmit={submit}>
      <div className="export-workspace">
        <section className="export-selection" aria-labelledby="export-selection-title"><header><div><h2 id="export-selection-title">Selected items to export</h2><p>Complete cursor traversal keeps the selection accurate across every daemon page.</p></div>{selection ? <strong>{selectedCount.toLocaleString('en-US')} {selectedCount === 1 ? 'item' : 'items'} selected</strong> : <LoaderCircle className="is-spinning" aria-label="Loading complete artifact selection" />}</header>
          {!selection ? <p role="status">Loading all recovered artifacts… {loadingCount.toLocaleString('en-US')} indexed</p> : <><div className="export-selection__summary"><span><CheckSquare2 aria-hidden="true" /><strong>{selectedCount.toLocaleString('en-US')} items selected</strong></span><strong>{formatBytes(selection.totalBytes)}</strong></div>{ineligibleCount > 0 ? <p className="form-error" role="alert">{verifiedSelectionMessage(ineligibleCount, selectedCount)} Return to Results and review the selection.</p> : null}<ul className="export-selection-list">{selection.previewItems.map((artifact) => <li key={artifact.artifactId}><File aria-hidden="true" /><span><strong>{artifact.displayName}</strong><small>{artifact.recoveryMethod === 'carving' ? 'Original folder unavailable' : artifact.originalPath ?? 'Original path unavailable'}</small></span><em>{formatBytes(BigInt(artifact.sizeBytes))}</em></li>)}</ul>{selectedCount > selection.previewItems.length ? <p className="export-selection__bounded">Showing {selection.previewItems.length} representative items. All {selectedCount.toLocaleString('en-US')} selected identifiers will be submitted.</p> : null}<ConditionSummary conditions={selection.conditions} /></>}
        </section>
        <section className="export-destination" aria-labelledby="export-destination-title"><header><h2 id="export-destination-title">Export destination</h2><span>Daemon verified at export start</span></header><label>Export destination path<input name="destinationPath" required placeholder="Choose a separate writable destination" /></label><p className="export-destination__pending"><TriangleAlert aria-hidden="true" />Safety pending: entering a path does not prove device separation. The daemon derives the physical topology and refuses export unless separation can be proven.</p><label className="export-form__acknowledgement"><input name="acknowledgeUnsafe" type="checkbox" /> I authorize controlled export of selected artifacts marked potentially unsafe.</label></section>
      </div>
      <footer className="export-actions"><span><ShieldCheck aria-hidden="true" />No source write is requested by this workflow.</span><button className="button button--primary" type="submit" disabled={!selection || running || selectedCount === 0 || ineligibleCount > 0}>{running ? 'Exporting and verifying…' : 'Start verified export'}<ArrowRight aria-hidden="true" /></button></footer>
    </form>
    {result ? <section className={completelyVerified ? 'export-verification is-complete' : 'export-verification is-incomplete'} role={completelyVerified ? 'status' : 'alert'} aria-labelledby="export-verification-title"><header>{completelyVerified ? <CheckCircle2 aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}<span><h2 id="export-verification-title">{completelyVerified ? 'Export complete and verified' : 'Verification incomplete'}</h2><p>{completelyVerified ? `${verifiedCount} ${verifiedCount === 1 ? 'file' : 'files'} exported and verified.` : `${verifiedCount} of ${submittedCount} selected files were returned and verified. Treat the export as incomplete.`}</p></span><code>{result.exportId}</code></header><ul>{result.items.map((item) => <li key={item.artifactId}><span>{item.outputPath}</span><strong>{item.verified ? 'SHA-256 verified' : 'Verification failed'}</strong></li>)}</ul><p>The destination was not opened automatically.</p></section> : null}
  </section>;
}

async function loadCompleteSelection(caseId: string, onProgress: (count: number) => void): Promise<ExportSelection> {
  const requestedIds = readRequestedIds(caseId);
  if (requestedIds && new Set(requestedIds).size !== requestedIds.length) throw new Error('Export selection contains duplicate artifact identifiers. Return to Results and review the selection.');
  const requested = requestedIds ? new Set(requestedIds) : undefined;
  const artifactIds: string[] = [];
  const previewHead: RecoveryArtifact[] = [];
  let previewLast: RecoveryArtifact | undefined;
  let totalBytes = 0n;
  const sourceIds = new Set<string>();
  const conditions = emptyConditions();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  let totalCount = 0;
  do {
    const loaded = ArtifactPageSchema.parse(await window.recoveryApi.queryArtifacts({ pageSize: 500, cursor }));
    totalCount = loaded.totalCount;
    for (const artifact of loaded.items) {
      if (requested && !requested.has(artifact.artifactId)) continue;
      artifactIds.push(artifact.artifactId); totalBytes += BigInt(artifact.sizeBytes); sourceIds.add(artifact.sourceId); conditions[artifact.recoveryState] += 1;
      if (previewHead.length < 49) previewHead.push(artifact); else previewLast = artifact;
    }
    onProgress(artifactIds.length);
    cursor = loaded.nextCursor ?? undefined;
    if (cursor && cursors.has(cursor)) throw new Error('Artifact pagination did not advance. Export selection was not submitted.');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  if (requested && artifactIds.length !== requested.size) {
    const missing = requested.size - artifactIds.length;
    throw new Error(`Export selection is stale: ${missing.toLocaleString('en-US')} of ${requested.size.toLocaleString('en-US')} requested artifacts could not be found. Return to Results and review the selection.`);
  }
  if (!requested && artifactIds.length !== totalCount) throw new Error(`Artifact pagination ended after ${artifactIds.length.toLocaleString('en-US')} of ${totalCount.toLocaleString('en-US')} indexed artifacts.`);
  return { artifactIds, totalCount, totalBytes, previewItems: previewLast ? [...previewHead, previewLast] : previewHead, sourceIds: Array.from(sourceIds), conditions };
}

function readRequestedIds(caseId: string): string[] | undefined { const stored = sessionStorage.getItem(`recovery:${caseId}:exportArtifactIds`); if (stored === null) return undefined; try { const value = JSON.parse(stored); if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === 'string' && item.length > 0)) throw new Error(); return value; } catch { throw new Error('Export selection could not be read safely. Return to Results and review the selection.'); } }
function ConditionSummary({ conditions }: { conditions: ExportSelection['conditions'] }) { const rows: Array<[string, number]> = [['Complete', conditions.complete_validated], ['Complete, unverified', conditions.complete_unverified], ['Partial', conditions.partial_validated + conditions.partial_unverified], ['Corrupt', conditions.corrupt]]; return <section className="export-conditions" aria-labelledby="export-conditions-title"><h3 id="export-conditions-title">Condition breakdown</h3><ul>{rows.map(([label, count]) => <li key={label}><span>{label}</span><strong>{count.toLocaleString('en-US')}</strong></li>)}</ul></section>; }
function verifiedSelectionMessage(ineligibleCount: number, selectedCount: number): string { return `Verified export requires every selected artifact to be complete and validated. ${ineligibleCount.toLocaleString('en-US')} of ${selectedCount.toLocaleString('en-US')} selected artifacts ${ineligibleCount === 1 ? 'is' : 'are'} not eligible.`; }
function formatBytes(bytes: bigint): string { if (bytes < 1_000n) return `${bytes.toLocaleString('en-US')} ${bytes === 1n ? 'byte' : 'bytes'}`; const units: Array<[bigint, string]> = [[1_000_000_000_000n, 'TB'], [1_000_000_000n, 'GB'], [1_000_000n, 'MB'], [1_000n, 'KB']]; for (const [size, label] of units) if (bytes >= size) { const tenths = (bytes * 10n + size / 2n) / size; return `${tenths / 10n}${tenths % 10n ? `.${tenths % 10n}` : ''} ${label}`; } return `${bytes} bytes`; }
function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'The export could not be started.'; }
