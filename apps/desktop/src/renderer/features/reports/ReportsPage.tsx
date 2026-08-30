import { ReportDescriptorSchema, type ReportDescriptor } from '@recovery/contracts';
import { CheckCircle2, FileJson2, FileText, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CapabilityBanner } from '@recovery/ui';

export function ReportsPage() {
  const { caseId = '' } = useParams();
  const [report, setReport] = useState<ReportDescriptor>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  async function generate() { setError(undefined); setRunning(true); try { setReport(ReportDescriptorSchema.parse(await window.recoveryApi.generateReport(caseId))); } catch (cause) { setError(message(cause)); } finally { setRunning(false); } }
  return <section className="workflow-page reports-page">
    <header className="page-heading"><div><p className="eyebrow">Case documentation</p><h1>Recovery report</h1><p className="page-heading__description">Generate deterministic JSON evidence and readable Markdown from persisted daemon records.</p></div><button className="button button--primary" type="button" onClick={() => void generate()} disabled={running}>{running ? 'Generating report…' : 'Generate report'}</button></header>
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {report ? <><section className="report-ready" role="status" aria-labelledby="report-ready-title"><CheckCircle2 aria-hidden="true" /><span><h2 id="report-ready-title">Report output ready</h2><p>Only daemon-recorded evidence is included. No recovery findings are calculated in the renderer.</p></span><code>{report.caseId}</code></section><div className="report-grid">
      <section className="report-output" aria-labelledby="report-output-title"><header><h2 id="report-output-title">Report files</h2><span>Persisted case output</span></header><article><FileJson2 aria-hidden="true" /><span><strong>JSON evidence record</strong><small>Machine-readable persisted evidence</small><code>{report.jsonPath}</code></span></article><article><FileText aria-hidden="true" /><span><strong>Markdown recovery summary</strong><small>Human-readable first vertical-slice report</small><code>{report.markdownPath}</code></span></article><p><ShieldCheck aria-hidden="true" />Generated paths are displayed only; recovered content and report files are not launched automatically.</p></section>
      <section className="report-limitations" aria-labelledby="report-limitations-title"><header><TriangleAlert aria-hidden="true" /><span><h2 id="report-limitations-title">Warnings and limitations</h2><p>Limitations returned with this report remain part of its evidential context.</p></span></header><div className="report-banner-list">{report.limitations.length ? report.limitations.map((limitation) => <CapabilityBanner key={limitation.code} level="warning" title={limitation.code} explanation={limitation.explanation} />) : <p className="empty-state">No daemon limitations were recorded.</p>}</div></section>
    </div></> : <section className="reports-page__empty"><FileText aria-hidden="true" /><h2>No report generated in this session</h2><p>The daemon will create JSON and Markdown outputs from persisted case evidence when requested.</p></section>}
  </section>;
}
function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'The report could not be generated.'; }
