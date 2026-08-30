import { Blocks, Globe2, LockKeyhole, Network, Workflow } from 'lucide-react';

const capabilities = [
  { label: 'Process tree', detail: 'Processes, parents, and command-line findings', icon: Workflow },
  { label: 'Network connections', detail: 'Sockets and connection ownership', icon: Network },
  { label: 'Loaded modules', detail: 'Kernel modules, drivers, and mapped libraries', icon: Blocks },
  { label: 'Registry findings', detail: 'Windows registry artifacts and context', icon: Globe2 },
];

export function AdvancedMemoryCapabilities() {
  return (
    <section className="memory-advanced" aria-labelledby="memory-advanced-title">
      <header>
        <h2 id="memory-advanced-title">What advanced analysis would provide</h2>
        <p>Unavailable until the daemon exposes a verified runtime capability.</p>
      </header>
      <div className="memory-advanced__grid">
        {capabilities.map(({ label, detail, icon: Icon }) => (
          <article key={label} aria-disabled="true">
            <Icon aria-hidden="true" />
            <span><strong>{label}</strong><small>{detail}</small></span>
            <span className="memory-locked"><LockKeyhole aria-hidden="true" />Unavailable</span>
          </article>
        ))}
      </div>
    </section>
  );
}
