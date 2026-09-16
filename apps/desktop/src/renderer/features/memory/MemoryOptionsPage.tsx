import { CapabilityBanner, PageHeader } from '@recovery/ui';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { AdvancedMemoryCapabilities } from './AdvancedMemoryCapabilities.js';

export function MemoryOptionsPage() {
  const { caseId = 'case' } = useParams();
  return (
    <section className="page page--narrow">
      <PageHeader eyebrow="Memory" title="Memory analysis options" description="Only verified, typed analysis options can become runnable controls. This build exposes no such capability." />
      <CapabilityBanner level="warning" title="Analysis configuration is locked" explanation="The daemon has no persisted memory-analysis options API and does not report a verified Volatility runtime." />
      <AdvancedMemoryCapabilities />
      <p className="note"><ShieldCheck aria-hidden="true" />Memory findings will remain empty until normalized daemon results exist. Disk recovery artifacts are never reused as volatile-memory findings.</p>
      <div className="button-row button-row--between"><Link className="button button--secondary" to={`/cases/${caseId}/memory`}><ArrowLeft aria-hidden="true" />Back</Link><Link className="button button--primary" to={`/cases/${caseId}/memory/results`}>View current result state</Link></div>
    </section>
  );
}
