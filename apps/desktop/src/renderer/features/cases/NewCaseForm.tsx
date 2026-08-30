import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { WorkspaceDirectoryEntry, WorkspaceSelection } from '@recovery/contracts';
import { ArrowLeft, ArrowRight, Check, Database, FileText, Folder, FolderOpen, HardDrive, Info, ListChecks, ShieldCheck } from 'lucide-react';
import { createCase } from './case-store.js';

type IntakeStep = 'details' | 'workspace' | 'review';
const steps: Array<{ id: IntakeStep; label: string }> = [
  { id: 'details', label: 'Details' }, { id: 'workspace', label: 'Workspace' }, { id: 'review', label: 'Review' },
];

export function NewCaseForm() {
  const navigate = useNavigate();
  const [step, setStep] = useState<IntakeStep>('details');
  const [title, setTitle] = useState('');
  const [operator, setOperator] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [organization, setOrganization] = useState('');
  const [notes, setNotes] = useState('');
  const [selection, setSelection] = useState<WorkspaceSelection | null>(null);
  const [caseFolderName, setCaseFolderName] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [selectingFolder, setSelectingFolder] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const destinationPath = selection ? joinPath(selection.selectedPath, caseFolderName.trim()) : '';

  useEffect(() => { if (step !== 'details') headingRef.current?.focus(); }, [step]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  async function chooseWorkspace() {
    setError(undefined); setSelectingFolder(true);
    try {
      const selected = await window.recoveryApi.chooseWorkspaceFolder();
      if (selected) setSelection(selected);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The selected folder could not be inspected.');
    } finally { setSelectingFolder(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(undefined);
    if (step === 'details') {
      const nextError = validateDetails(title, operator);
      if (nextError) { setError(nextError); return; }
      if (!caseFolderName) setCaseFolderName(suggestFolderName(title));
      setStep('workspace'); return;
    }
    if (step === 'workspace') {
      const nextError = validateWorkspace(selection, caseFolderName);
      if (nextError) { setError(nextError); return; }
      setStep('review'); return;
    }
    if (!selection) return;
    setSubmitting(true);
    try {
      const recoveryCase = await createCase({
        title, operator, referenceNumber: optional(referenceNumber), organization: optional(organization),
        workspacePath: destinationPath, notes: optional(notes),
      });
      await navigate(`/cases/${recoveryCase.caseId}/overview`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The recovery case could not be created.');
    } finally { setSubmitting(false); }
  }

  const currentIndex = steps.findIndex((item) => item.id === step);
  return <form className="case-intake" onSubmit={(event) => void submit(event)} noValidate>
    <ol className="case-intake__steps" aria-label="Case creation progress">
      {steps.map((item, index) => <li key={item.id} data-state={index < currentIndex ? 'complete' : item.id === step ? 'current' : 'pending'} aria-current={item.id === step ? 'step' : undefined}>
        <span>{index < currentIndex ? <Check aria-hidden="true" /> : index + 1}</span><strong>{item.label}</strong>
      </li>)}
    </ol>
    {error ? <p className="form-error case-intake__error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p> : null}
    {step === 'details' ? <DetailsStep values={{ title, operator, referenceNumber, organization, notes }} setters={{ setTitle, setOperator, setReferenceNumber, setOrganization, setNotes }} /> : null}
    {step === 'workspace' ? <WorkspaceStep headingRef={headingRef} selection={selection} caseFolderName={caseFolderName} destinationPath={destinationPath} selecting={selectingFolder} choose={() => void chooseWorkspace()} setName={setCaseFolderName} /> : null}
    {step === 'review' && selection ? <ReviewStep headingRef={headingRef} values={{ title, operator, referenceNumber, organization, notes }} selection={selection} caseFolderName={caseFolderName} destinationPath={destinationPath} editDetails={() => setStep('details')} editWorkspace={() => setStep('workspace')} /> : null}
    <div className="case-intake__actions">
      {step === 'details' ? <Link to="/" className="button button--secondary">Cancel</Link> : <button type="button" className="button button--secondary" onClick={() => { setError(undefined); setStep(step === 'review' ? 'workspace' : 'details'); }}><ArrowLeft aria-hidden="true" />Back</button>}
      <button type="submit" className="button button--primary" disabled={submitting || selectingFolder}>
        {step === 'details' ? <>Continue to workspace<ArrowRight aria-hidden="true" /></> : null}
        {step === 'workspace' ? <>Continue to review<ArrowRight aria-hidden="true" /></> : null}
        {step === 'review' ? <>{submitting ? 'Creating case…' : 'Create case'}<ArrowRight aria-hidden="true" /></> : null}
      </button>
    </div>
  </form>;
}

interface Values { title: string; operator: string; referenceNumber: string; organization: string; notes: string }

function DetailsStep({ values, setters }: { values: Values; setters: Record<`set${Capitalize<keyof Values>}`, (value: string) => void> }) {
  return <section className="case-intake__screen" aria-labelledby="case-details-heading">
    <header className="case-intake__heading"><p className="eyebrow">Case details</p><h2 id="case-details-heading">Tell us about this recovery</h2><p>Keep the case recognizable for operators and reports. You will choose storage next.</p></header>
    <div className="case-intake__details-layout">
      <div className="case-intake__fields">
        <label>Case title <span>Required</span><input name="title" value={values.title} onChange={(event) => setters.setTitle(event.target.value)} autoFocus maxLength={120} /></label>
        <label>Operator name or ID <span>Required</span><input name="operator" value={values.operator} onChange={(event) => setters.setOperator(event.target.value)} /></label>
        <div className="case-intake__field-row">
          <label>Reference number <span>Optional</span><input name="reference" value={values.referenceNumber} onChange={(event) => setters.setReferenceNumber(event.target.value)} /></label>
          <label>Organization or unit <span>Optional</span><input name="organization" value={values.organization} onChange={(event) => setters.setOrganization(event.target.value)} /></label>
        </div>
        <label>Notes <span>Optional</span><textarea name="notes" rows={3} value={values.notes} onChange={(event) => setters.setNotes(event.target.value)} /></label>
      </div>
      <aside className="case-blueprint" aria-labelledby="blueprint-heading">
        <h3 id="blueprint-heading">Case workspace blueprint</h3><p>The new case folder keeps recovery records together.</p>
        <ul><li><Database aria-hidden="true" />Evidence records</li><li><Folder aria-hidden="true" />Recovered files</li><li><FileText aria-hidden="true" />Reports</li><li><ListChecks aria-hidden="true" />Activity log</li></ul>
        <div className="case-blueprint__safety"><ShieldCheck aria-hidden="true" /><span><strong>The source remains read only.</strong><small>Case storage never changes the original source.</small></span></div>
      </aside>
    </div>
  </section>;
}

function WorkspaceStep({ headingRef, selection, caseFolderName, destinationPath, selecting, choose, setName }: {
  headingRef: RefObject<HTMLHeadingElement | null>; selection: WorkspaceSelection | null; caseFolderName: string; destinationPath: string;
  selecting: boolean; choose(): void; setName(value: string): void;
}) {
  return <section className="case-intake__screen" aria-labelledby="case-workspace-heading">
    <header className="case-intake__heading"><p className="eyebrow">Workspace</p><h2 id="case-workspace-heading" tabIndex={-1} ref={headingRef}>Choose a parent folder</h2><p>The parent may contain files. SHUNYA creates a new named child folder without overwriting it.</p></header>
    {!selection ? <div className="workspace-empty"><FolderOpen aria-hidden="true" /><h3>No parent folder selected</h3><p>The native picker will inspect only the folder you select, including its real free space.</p><button type="button" className="button button--secondary" onClick={choose} disabled={selecting}>{selecting ? 'Opening folder picker…' : 'Choose parent folder'}</button></div>
      : <div className="workspace-layout">
        <div className="workspace-browser">
          <header><span><HardDrive aria-hidden="true" /><strong>{selection.rootLabel}</strong></span><button type="button" className="button button--secondary" onClick={choose} disabled={selecting}>Choose another folder</button></header>
          <div className="workspace-browser__tree">
            <div className="workspace-tree__root"><FolderOpen aria-hidden="true" /><strong>{selection.selectedPath}</strong></div>
            {selection.directories.length ? <DirectoryTree entries={selection.directories} /> : <p className="workspace-browser__empty">The selected parent has no visible subfolders.</p>}
            {selection.truncated ? <p className="workspace-browser__notice"><Info aria-hidden="true" />Only the first bounded portion of this folder tree is shown.</p> : null}
          </div>
          <label className="workspace-name">Case folder name <span>Required</span><input name="caseFolderName" value={caseFolderName} onChange={(event) => setName(event.target.value)} aria-describedby="workspace-name-hint" /></label>
          <small id="workspace-name-hint">A new child folder with this name will be created inside the selected parent.</small>
        </div>
        <StorageSummary selection={selection} destinationPath={destinationPath} />
      </div>}
  </section>;
}

function DirectoryTree({ entries }: { entries: WorkspaceDirectoryEntry[] }) {
  return <ul className="workspace-tree" aria-label="Folder preview">{entries.map((entry) => <li key={entry.relativePath}>
    <span><Folder aria-hidden="true" />{entry.name}</span>{entry.children.length ? <DirectoryTree entries={entry.children} /> : null}{entry.childrenOmitted ? <small>Deeper folders not shown</small> : null}
  </li>)}</ul>;
}

function StorageSummary({ selection, destinationPath }: { selection: WorkspaceSelection; destinationPath: string }) {
  const total = BigInt(selection.totalBytes); const reportedFree = BigInt(selection.freeBytes); const free = reportedFree > total ? total : reportedFree; const used = total - free;
  const freePercent = percent(free, total);
  return <aside className="storage-summary" aria-labelledby="storage-heading">
    <header><HardDrive aria-hidden="true" /><span><h3 id="storage-heading">Storage on {selection.rootLabel}</h3><p>{selection.selectedPath}</p></span></header>
    <div className="storage-summary__figures"><span><strong>{formatBytes(free)} free</strong><small>Available now</small></span><span><strong>{formatBytes(total)} total</strong><small>Drive capacity</small></span></div>
    <div className="storage-summary__bar" role="img" aria-label={`${formatBytes(free)} free and ${formatBytes(used)} used of ${formatBytes(total)}`}><span className="storage-summary__free" style={{ width: `${freePercent}%` }} /><span className="storage-summary__used" style={{ width: `${100 - freePercent}%` }} /></div>
    <ul className="storage-summary__legend"><li><i className="is-free" />Free space <strong>{formatBytes(free)}</strong></li><li><i className="is-used" />Used space <strong>{formatBytes(used)}</strong></li></ul>
    <div className="destination-preview"><Info aria-hidden="true" /><span><strong>What will be created</strong><small>A new case folder at</small><code>{destinationPath || 'Enter a case folder name'}</code></span></div>
    <p className="storage-summary__truth">A recovery-space requirement is unavailable until a source is selected, so no estimate is shown.</p>
  </aside>;
}

function ReviewStep({ headingRef, values, selection, caseFolderName, destinationPath, editDetails, editWorkspace }: {
  headingRef: RefObject<HTMLHeadingElement | null>; values: Values; selection: WorkspaceSelection; caseFolderName: string; destinationPath: string; editDetails(): void; editWorkspace(): void;
}) {
  return <section className="case-intake__screen" aria-labelledby="review-heading">
    <header className="case-intake__heading"><p className="eyebrow">Review</p><h2 id="review-heading" tabIndex={-1} ref={headingRef}>Review recovery case</h2><p>No recovery scan starts when this case is created.</p></header>
    <div className="case-review-layout"><div className="case-review-sections">
      <ReviewSection title="Case details" edit={editDetails} rows={[["Case title", values.title], ["Operator", values.operator], ["Reference number", optional(values.referenceNumber) ?? 'Not provided'], ["Organization or unit", optional(values.organization) ?? 'Not provided'], ["Notes", optional(values.notes) ?? 'Not provided']]} />
      <ReviewSection title="Workspace" edit={editWorkspace} rows={[["Drive or root", selection.rootLabel], ["Parent folder", selection.selectedPath], ["Case folder name", caseFolderName], ["Destination", destinationPath]]} />
    </div><aside className="review-readiness"><ShieldCheck aria-hidden="true" /><h3>Ready to create the case</h3><p>The destination came from the native folder inspection.</p><ul><li><Check aria-hidden="true" />Original sources remain read only</li><li><Check aria-hidden="true" />A new child folder will be created</li><li><Check aria-hidden="true" />{formatBytes(BigInt(selection.freeBytes))} currently free</li></ul><small>Source selection and scanning come next.</small></aside></div>
  </section>;
}

function ReviewSection({ title, rows, edit }: { title: string; rows: string[][]; edit(): void }) {
  return <section className="review-section"><header><h3>{title}</h3><button type="button" onClick={edit}>Edit {title.toLowerCase()}</button></header><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>;
}

function validateDetails(title: string, operator: string) { const clean = title.trim(); if (clean.length < 3 || clean.length > 120) return 'Enter a case title between 3 and 120 characters.'; if (!operator.trim()) return 'Enter the operator name or ID.'; }
function validateWorkspace(selection: WorkspaceSelection | null, name: string) {
  if (!selection) return 'Choose a parent folder for the case workspace.';
  const clean = name.trim();
  if (!clean) return 'Enter a case folder name.';
  if (clean.length > 120 || /[<>:"/\\|?*\u0000-\u001f]/.test(clean) || /[. ]$/.test(clean) || clean === '.' || clean === '..') return 'Use a folder name without path separators, reserved characters, or a trailing space or period.';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(clean)) return 'Choose a different case folder name; that name is reserved by Windows.';
  if (selection.directories.some((entry) => entry.name.localeCompare(clean, undefined, { sensitivity: 'accent' }) === 0)) return 'A folder with that name already exists in the selected parent. Choose a new case folder name.';
}
function suggestFolderName(title: string) { return title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/, '').slice(0, 120) || 'Recovery case'; }
function joinPath(parent: string, child: string) { if (!child) return ''; const separator = parent.includes('\\') ? '\\' : '/'; const base = parent.replace(/[\\/]+$/, ''); return `${base || separator}${base ? separator : ''}${child}`; }
function formatBytes(bytes: bigint) { const units: Array<[bigint, string]> = [[1_000_000_000_000n, 'TB'], [1_000_000_000n, 'GB'], [1_000_000n, 'MB'], [1_000n, 'KB']]; for (const [size, label] of units) { if (bytes >= size) { const tenths = (bytes * 10n + size / 2n) / size; return `${tenths / 10n}${tenths % 10n ? `.${tenths % 10n}` : ''} ${label}`; } } return `${bytes} B`; }
function percent(value: bigint, total: bigint) { return total <= 0n ? 0 : Number((value * 1_000n) / total) / 10; }
function optional(value: string) { return value.trim() || null; }
