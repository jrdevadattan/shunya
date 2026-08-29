import { Link, useParams } from 'react-router-dom';

export function MemoryOptionsPage() {
  const { caseId = 'case' } = useParams();
  return <section className="workflow-page"><header><p className="eyebrow">Analysis preset</p><h1>Choose memory checks</h1><p>Only typed, normalized tables may cross the renderer boundary. Options remain disabled until a verified Volatility capability is reported.</p></header><fieldset className="case-form" disabled><label><input type="checkbox" />Processes and command lines</label><label><input type="checkbox" />Network connections</label><label><input type="checkbox" />Loaded modules and drivers</label><label><input type="checkbox" />YARA-X findings</label></fieldset><Link className="button button--primary" to={`/cases/${caseId}/memory/results`}>Check current capability</Link></section>;
}
