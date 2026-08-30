import { AlertTriangle, ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { AdvancedMemoryCapabilities } from './AdvancedMemoryCapabilities.js';

export function MemoryOptionsPage() {
  const { caseId = 'case' } = useParams();
  return (
    <section className="workflow-page memory-capability">
      <header className="page-heading"><div><p className="eyebrow">Analysis capability</p><h1>Memory analysis options</h1><p className="page-heading__description">Only verified, typed analysis options can become runnable controls. This build exposes no such capability.</p></div></header>
      <aside className="memory-runtime-notice" role="note"><AlertTriangle aria-hidden="true" /><span><strong>Analysis configuration is locked</strong><small>The daemon has no persisted memory-analysis options API and does not report a verified Volatility runtime.</small></span><LockKeyhole aria-hidden="true" /></aside>
      <AdvancedMemoryCapabilities />
      <section className="memory-policy" aria-labelledby="memory-policy-title"><ShieldCheck aria-hidden="true" /><span><h2 id="memory-policy-title">Truthful output policy</h2><p>Memory findings will remain empty until normalized daemon results exist. Disk recovery artifacts are never reused as volatile-memory findings.</p></span></section>
      <footer className="memory-actions"><Link className="button button--secondary button--icon" to={`/cases/${caseId}/memory`}><ArrowLeft aria-hidden="true" />Back to image capability</Link><Link className="button button--primary" to={`/cases/${caseId}/memory/results`}>View current result state</Link></footer>
    </section>
  );
}
