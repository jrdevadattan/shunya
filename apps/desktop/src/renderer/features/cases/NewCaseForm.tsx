import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createCase } from './case-store.js';

export function NewCaseForm() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

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

  return <form className="case-form" onSubmit={submit}>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <label>Case title<input name="title" required minLength={3} maxLength={120} autoFocus /></label>
    <label>Reference number <span>Optional</span><input name="reference" /></label>
    <label>Operator name or ID<input name="operator" required /></label>
    <label>Organization or unit <span>Optional</span><input name="organization" /></label>
    <label>Case workspace destination<input name="workspace" required placeholder="Choose a destination folder" /></label>
    <p className="form-hint">Choose a new destination with enough free space for the disk image and recovered files. Existing folders are never overwritten.</p>
    <label>Notes <span>Optional</span><textarea name="notes" rows={4} /></label>
    <div className="form-actions"><Link to="/" className="button button--secondary">Cancel</Link><button type="submit" className="button button--primary" disabled={submitting}>{submitting ? 'Creating case…' : 'Create case'}</button></div>
  </form>;
}

function optional(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}
