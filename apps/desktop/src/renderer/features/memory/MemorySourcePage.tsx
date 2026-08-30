import { SourceDescriptorSchema, type SourceDescriptor } from '@recovery/contracts';
import { AlertTriangle, Database, FileText, FolderLock, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdvancedMemoryCapabilities } from './AdvancedMemoryCapabilities.js';

export function MemorySourcePage() {
  const { caseId = 'case' } = useParams();
  const [sources, setSources] = useState<SourceDescriptor[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setSources(undefined);
    setError(undefined);
    void window.recoveryApi.listSources().then((value) => {
      if (active) setSources(SourceDescriptorSchema.array().parse(value).filter((source) => source.kind === 'memory_image'));
    }).catch((cause) => { if (active) setError(message(cause)); });
    return () => { active = false; };
  }, [caseId]);

  return (
    <section className="workflow-page memory-capability">
      <header className="page-heading"><div><p className="eyebrow">Volatile memory</p><h1>Analyze memory image</h1><p className="page-heading__description">Review registered image identity and the analysis capabilities this build can truthfully provide.</p></div></header>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {!sources && !error ? <p role="status">Loading registered memory images…</p> : null}
      {sources?.length ? (
        <ul className="memory-source-list" aria-label="Registered memory images">
          {sources.map((source) => <MemorySourceSummary key={source.sourceId} source={source} />)}
        </ul>
      ) : sources ? (
        <div className="memory-empty"><FileText aria-hidden="true" /><span><strong>No memory image is registered</strong><small>Add an authorized image source before configuring memory analysis.</small></span><Link className="button button--secondary" to={`/cases/${caseId}/sources`}>Add source</Link></div>
      ) : null}

      <div className="memory-capability__grid">
        <article className="memory-available">
          <header><ShieldCheck aria-hidden="true" /><span><h2>Available now</h2><p>Typed identity and safety information exposed by the recovery service.</p></span></header>
          <ul>
            <li><FileText aria-hidden="true" /><span><strong>Registered image identity</strong><small>Display name, source kind, and stable source identifier</small></span></li>
            <li><Database aria-hidden="true" /><span><strong>Exact file size</strong><small>Reported by the typed source descriptor</small></span></li>
            <li><FolderLock aria-hidden="true" /><span><strong>Read-only case boundary</strong><small>Memory findings remain separate from recovered disk files</small></span></li>
          </ul>
        </article>
        <aside className="memory-unavailable">
          <header><AlertTriangle aria-hidden="true" /><span><h2>Advanced analysis unavailable</h2><p>The desktop API does not expose a verified Volatility runtime, symbol packs, or normalized finding tables.</p></span></header>
          <p>No process, network, module, registry, or YARA result will be inferred or simulated.</p>
          <div className="memory-unavailable__status"><span>Volatility framework</span><strong>Capability not exposed</strong></div>
          <div className="memory-unavailable__status"><span>Symbol packs</span><strong>Status unavailable</strong></div>
        </aside>
      </div>

      <AdvancedMemoryCapabilities />
      <footer className="memory-actions"><span><FolderLock aria-hidden="true" />Source-write operations are not exposed</span><Link className="button button--primary" to={`/cases/${caseId}/memory/options`}>Review capability details</Link></footer>
    </section>
  );
}

function MemorySourceSummary({ source }: { source: SourceDescriptor }) {
  return <li><FileText aria-hidden="true" /><span><strong>{source.displayName}</strong><small>Registered memory image</small></span><span><strong>{formatBytes(source.sizeBytes)}</strong><small>Reported file size</small></span><span><strong>Read-only</strong><small>Case source policy</small></span></li>;
}

function formatBytes(value: string): string {
  const bytes = BigInt(value);
  const mebibyte = 1024n ** 2n;
  const gibibyte = 1024n ** 3n;
  if (bytes >= gibibyte) return `${formatUnit(bytes, gibibyte)} GiB`;
  if (bytes >= mebibyte) return `${formatUnit(bytes, mebibyte)} MiB`;
  return `${bytes.toLocaleString('en-US')} bytes`;
}

function formatUnit(value: bigint, unit: bigint): string {
  const tenths = (value * 10n + unit / 2n) / unit;
  return `${tenths / 10n}${tenths % 10n === 0n ? '' : `.${tenths % 10n}`}`;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Registered memory images could not be loaded.'; }
