import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderOpen } from 'lucide-react';
import { createCase } from './case-store.js';

export function NewCaseForm() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [workspacePath, setWorkspacePath] = useState('');

  async function chooseWorkspace() {
    setError(undefined);
    setSelectingFolder(true);
    try {
      const selected = await window.recoveryApi.chooseWorkspaceFolder();
      if (selected) setWorkspacePath(selected);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The folder picker could not be opened.');
    } finally {
      setSelectingFolder(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      const values = new FormData(event.currentTarget);
      const recoveryCase = await createCase({
        title: String(values.get('title') ?? ''),
        referenceNumber: optional(values.get('reference')),
        operator: String(values.get('operator') ?? ''),
        organization: optional(values.get('organization')),
        workspacePath: String(values.get('workspace') ?? ''),
        notes: optional(values.get('notes')),
      });
      await navigate(`/cases/${recoveryCase.caseId}/overview`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The recovery case could not be created.');
    } finally {
      setSubmitting(false);
    }
  }

  return <form className="case-form case-intake-form" onSubmit={submit}>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <section className="case-form__section" aria-labelledby="case-details-heading">
      <header><div><h2 id="case-details-heading">Case details</h2><p>Required fields are marked.</p></div></header>
      <div className="case-form__grid">
        <label>Case title <span>Required</span><input name="title" required minLength={3} maxLength={120} autoFocus placeholder="e.g. Finance laptop recovery" /></label>
        <label>Reference number <span>Optional</span><input name="reference" placeholder="Incident or ticket ID" /></label>
        <label>Operator name or ID <span>Required</span><input name="operator" required placeholder="Your name or examiner ID" /></label>
        <label>Organization or unit <span>Optional</span><input name="organization" placeholder="Team, lab, or organization" /></label>
      </div>
    </section>
    <section className="case-form__section" aria-labelledby="case-storage-heading">
      <header><div><h2 id="case-storage-heading">Workspace and notes</h2><p>Choose where case evidence and recovery output will be stored.</p></div></header>
      <div className="case-form__grid">
        <label className="case-form__wide">Case workspace destination <span>Required</span><div className="folder-picker"><input name="workspace" required value={workspacePath} onChange={(event) => setWorkspacePath(event.target.value)} placeholder="No folder selected" aria-describedby="workspace-hint" /><button className="button button--secondary" type="button" disabled={selectingFolder} onClick={() => void chooseWorkspace()}><FolderOpen aria-hidden="true" />{selectingFolder ? 'Opening…' : 'Browse'}</button></div><small id="workspace-hint">Use an empty destination with enough space for the disk image and recovered files.</small></label>
        <label className="case-form__wide">Notes <span>Optional</span><textarea name="notes" rows={2} placeholder="Add context that will help with the recovery or final report" /></label>
      </div>
    </section>
    <div className="form-actions"><Link to="/" className="button button--secondary">Cancel</Link><button type="submit" className="button button--primary" disabled={submitting}>{submitting ? 'Creating case…' : 'Create case'}</button></div>
  </form>;
}

function optional(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}
