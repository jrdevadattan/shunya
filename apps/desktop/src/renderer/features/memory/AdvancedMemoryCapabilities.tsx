import { Blocks, Globe2, LockKeyhole, Network, Workflow } from 'lucide-react';

const capabilities = [
  { label: 'Process tree', detail: 'Processes, parents, and command-line findings', icon: Workflow },
  { label: 'Network connections', detail: 'Sockets and connection ownership', icon: Network },
  { label: 'Loaded modules', detail: 'Kernel modules, drivers, and mapped libraries', icon: Blocks },
  { label: 'Registry findings', detail: 'Windows registry artifacts and context', icon: Globe2 },
];

export function AdvancedMemoryCapabilities({ headingLevel = 'h2' }: { headingLevel?: 'h2' | 'h3' } = {}) {
  const Heading = headingLevel;
  return (
    <section className="stack stack--tight" aria-labelledby="memory-advanced-title">
      <div>
        <Heading id="memory-advanced-title">What advanced analysis would provide</Heading>
        <p className="form-hint">Unavailable until the daemon exposes a verified runtime capability.</p>
      </div>
      <div className="capability-grid">
        {capabilities.map(({ label, detail, icon: Icon }) => (
          <article key={label} className="capability-tile" aria-disabled="true">
            <Icon aria-hidden="true" />
            <span><strong>{label}</strong><small>{detail}</small></span>
            <span className="badge"><LockKeyhole aria-hidden="true" />Unavailable</span>
          </article>
        ))}
      </div>
    </section>
  );
}
