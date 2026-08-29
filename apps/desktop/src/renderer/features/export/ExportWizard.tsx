import { useState } from 'react';

const steps = [
  ['1. Select files', '2 recovered artifacts selected'],
  ['2. Choose organization', 'Preserve original folders; carved files grouped by detected type'],
  ['3. Choose destination', 'External destination · physical device disk-9'],
  ['4. Review safety', 'Destination differs from source disk-7'],
  ['5. Copy and verify', 'SHA-256 is recalculated after every copy'],
  ['6. Complete', 'A manifest records the path, hash, and verification result'],
] as const;

export function ExportWizard() {
  const [complete, setComplete] = useState(false);
  return <section className="workflow-page export-wizard">
    <header><p className="eyebrow">Verified export</p><h1>Export recovered files</h1><p>Exports are repeatable jobs. Recovery results remain unchanged and exported files are never opened automatically.</p></header>
    <ol className="workflow-steps" aria-label="Export steps">
      {steps.map(([title, detail], index) => <li className={complete || index < 5 ? 'is-ready' : ''} key={title}><strong>{title}</strong><span>{detail}</span></li>)}
    </ol>
    <aside className="safety-callout"><strong>Destination safety passed</strong><p>The selected destination is not on the source physical device. Unsafe active files require a separate acknowledgement.</p></aside>
    {complete
      ? <div className="completion-card" role="status"><h2>Export complete</h2><p>All 2 copied files passed SHA-256 verification.</p><p>The destination was not opened automatically.</p></div>
      : <button className="button button--primary" type="button" onClick={() => setComplete(true)}>Start verified export</button>}
  </section>;
}
