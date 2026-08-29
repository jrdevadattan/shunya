import { ReportDescriptorSchema, type ReportDescriptor } from '@recovery/contracts';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CapabilityBanner, SurfaceCard } from '@recovery/ui';

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
  return <section className="workflow-page reports-page"><header className="page-heading"><div><p className="eyebrow">Case documentation</p><h1>Recovery report</h1><p className="page-heading__description">Generate deterministic JSON and readable Markdown from persisted case evidence.</p></div><button className="button button--primary" type="button" onClick={() => void generate()} disabled={running}>{running ? 'Generating report…' : 'Generate report'}</button></header>{error ? <p role="alert" className="form-error">{error}</p> : null}{report ? <div className="report-grid"><SurfaceCard title="Generated report"><dl className="report-paths"><div><dt>Case</dt><dd>{report.caseId}</dd></div><div><dt>JSON</dt><dd>{report.jsonPath}</dd></div><div><dt>Markdown</dt><dd>{report.markdownPath}</dd></div></dl></SurfaceCard><SurfaceCard title="Warnings and limitations"><div className="report-banner-list">{report.limitations.length ? report.limitations.map((limitation) => <CapabilityBanner key={limitation.code} level="warning" title={limitation.code} explanation={limitation.explanation} />) : <p className="empty-state">No daemon limitations were recorded.</p>}</div></SurfaceCard></div> : <SurfaceCard className="reports-page__empty"><p className="empty-state">No report has been generated in this session.</p></SurfaceCard>}</section>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'The report could not be generated.'; }
