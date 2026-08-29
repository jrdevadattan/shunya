const sourceHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

export function ReportsPage() {
  return <section className="workflow-page reports-page">
    <header><p className="eyebrow">Case documentation</p><h1>Recovery report</h1><p>Deterministic JSON and readable Markdown preserve provenance, recovery methods, warnings, and export verification.</p></header>
    <div className="report-grid">
      <article className="report-summary">
        <h2>Case case-26149</h2>
        <dl><div><dt>Source</dt><dd>source-1</dd></div><div><dt>Geometry</dt><dd>512-byte sectors · 1 TiB</dd></div><div><dt>Tools</dt><dd>The Sleuth Kit 4.15.0</dd></div><div><dt>Verified exports</dt><dd>2</dd></div></dl>
        <p className="verified-badge">Source hash verified</p>
        <code className="hash-value">{sourceHash}</code>
      </article>
      <article className="report-limitations"><h2>Warnings and limitations</h2><ul><li>Source health unknown.</li><li>One unreadable range was recorded.</li><li>Original names are unavailable for carved files.</li><li>TRIM or overwritten sectors may make recovery impossible.</li><li>Locked encryption requires authorized keys.</li><li>Installed Mode is not equivalent to a trusted rescue environment.</li></ul></article>
    </div>
    <div className="report-actions"><button className="button button--secondary" type="button">Generate JSON</button><button className="button button--primary" type="button">Generate Markdown</button></div>
  </section>;
}
