import { Link, useParams } from 'react-router-dom';

export function MemorySourcePage() {
  const { caseId = 'case' } = useParams();
  return <section className="workflow-page"><header><p className="eyebrow">Volatile memory</p><h1>Memory image analysis</h1><p>Analyze an existing authorized memory image without mixing volatile-memory findings into recovered disk files.</p></header><div className="report-grid"><article className="report-summary"><h2>Memory capability</h2><p>A verified Volatility adapter is required. The application never invents process or network findings when it is unavailable.</p></article><aside className="report-limitations"><h2>Live capture changes the system</h2><p>Memory capture is explicit, elevated, and cannot be perfectly non-invasive. macOS live-memory capture is unsupported in this release.</p></aside></div><Link className="button button--primary" to={`/cases/${caseId}/memory/options`}>Review analysis options</Link></section>;
}
