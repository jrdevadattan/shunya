import { Link, useParams } from 'react-router-dom';

export function MemoryOptionsPage() {
  const { caseId = 'case' } = useParams();
  return <section className="workflow-page"><header><p className="eyebrow">Analysis preset</p><h1>Choose memory checks</h1><p>Only typed, normalized tables cross the renderer boundary. Full raw tool output remains in the case audit data.</p></header><div className="case-form"><label><input defaultChecked type="checkbox" />Processes and command lines</label><label><input defaultChecked type="checkbox" />Network connections</label><label><input defaultChecked type="checkbox" />Loaded modules and drivers</label><label><input defaultChecked type="checkbox" />YARA-X findings</label></div><Link className="button button--primary" to={`/cases/${caseId}/memory/results`}>Run fixture analysis</Link></section>;
}
