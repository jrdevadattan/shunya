import { SourceDescriptorSchema, type SourceDescriptor } from '@recovery/contracts';
import { AdvancedSection, CapabilityBanner, EmptyState, PageHeader } from '@recovery/ui';
import { FileText, FolderLock, Info } from 'lucide-react';
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
    <section className="page page--narrow">
      <PageHeader eyebrow="Memory" title="Analyze memory image" description="Memory analysis is not part of this build. Registered memory images are listed so their identity is on record." />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {!sources && !error ? <p role="status" className="empty-state">Loading registered memory images…</p> : null}
      {sources?.length ? (
        <ul className="memory-source-list" aria-label="Registered memory images">
          {sources.map((source) => <MemorySourceSummary key={source.sourceId} source={source} />)}
        </ul>
      ) : sources ? (
        <EmptyState icon={FileText} title="No memory image is registered" description="Add an authorized image source before configuring memory analysis." action={<Link className="button button--secondary" to={`/cases/${caseId}/sources`}>Add source</Link>} compact />
      ) : null}
      <CapabilityBanner level="warning" title="Advanced analysis unavailable" explanation="The desktop API does not expose a verified Volatility runtime, symbol packs, or normalized finding tables. No process, network, module, registry, or YARA result will be inferred or simulated." />
      <AdvancedSection title="What would be available" summary="Identity details on record, and what advanced analysis would add" icon={Info} quiet>
        <div className="capability-grid">
          <article className="capability-tile"><FileText aria-hidden="true" /><span><strong>Registered image identity</strong><small>Display name, source kind, and stable source identifier</small></span></article>
          <article className="capability-tile"><FolderLock aria-hidden="true" /><span><strong>Read-only case boundary</strong><small>Memory findings remain separate from recovered disk files</small></span></article>
        </div>
        <AdvancedMemoryCapabilities />
      </AdvancedSection>
      <div className="button-row button-row--end"><Link className="button button--secondary" to={`/cases/${caseId}/memory/options`}>Review capability details</Link></div>
    </section>
  );
}

function MemorySourceSummary({ source }: { source: SourceDescriptor }) {
  return <li><FileText aria-hidden="true" /><span><strong>{source.displayName}</strong><small><code>{source.kind}</code> source kind</small></span><span><strong>{formatBytes(source.sizeBytes)}</strong><small><code>{source.sizeBytes} bytes</code> exact</small></span><span><strong>Stable identifier</strong><small><code>{source.stableId}</code></small></span></li>;
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
