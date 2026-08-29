import { Link, useParams } from 'react-router-dom';

export function MemorySourcePage() {
  const { caseId = 'case' } = useParams();
  return <section className="workflow-page"><header><p className="eyebrow">Volatile memory</p><h1>Memory image analysis</h1><p>Analyze an existing authorized memory image without mixing volatile-memory findings into recovered disk files.</p></header><div className="report-grid"><article className="report-summary"><h2>Choose an image</h2><p>Supported fixture analysis uses Volatility 3 machine-readable output.</p><button className="button button--secondary" type="button">Choose memory image</button></article><aside className="report-limitations"><h2>Live capture changes the system</h2><p>Memory capture is explicit, elevated, and cannot be perfectly non-invasive. macOS live-memory capture is unsupported in this release.</p></aside></div><Link className="button button--primary" to={`/cases/${caseId}/memory/options`}>Continue to analysis options</Link></section>;
}
