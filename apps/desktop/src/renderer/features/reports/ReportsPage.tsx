import { ReportDescriptorSchema, type ReportDescriptor } from '@recovery/contracts';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

export function ReportsPage() {
  const { caseId = '' } = useParams();
  const [report, setReport] = useState<ReportDescriptor>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  async function generate() {
    setError(undefined); setRunning(true);
    try { setReport(ReportDescriptorSchema.parse(await window.recoveryApi.generateReport(caseId))); }
    catch (cause) { setError(message(cause)); }
    finally { setRunning(false); }
  }
  return <section className="workflow-page reports-page"><header><p className="eyebrow">Case documentation</p><h1>Recovery report</h1><p>The daemon generates deterministic JSON and readable Markdown from persisted case evidence.</p></header>{error ? <p role="alert" className="form-error">{error}</p> : null}{report ? <div className="report-grid"><article className="report-summary"><h2>Generated report</h2><dl><div><dt>Case</dt><dd>{report.caseId}</dd></div><div><dt>JSON</dt><dd>{report.jsonPath}</dd></div><div><dt>Markdown</dt><dd>{report.markdownPath}</dd></div></dl></article><article className="report-limitations"><h2>Warnings and limitations</h2>{report.limitations.length ? <ul>{report.limitations.map((limitation) => <li key={limitation.code}><strong>{limitation.code}</strong>: {limitation.explanation}</li>)}</ul> : <p>No daemon limitations were recorded.</p>}</article></div> : <p>No report has been generated in this session.</p>}<div className="report-actions"><button className="button button--primary" type="button" onClick={() => void generate()} disabled={running}>{running ? 'Generating report…' : 'Generate report'}</button></div></section>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'The report could not be generated.'; }
