import { RecoveryCaseSchema } from '@recovery/contracts';
import { FolderOpen, ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rememberValidatedCase } from '../../application-state.js';
import { rememberRecentCase } from './recent-cases.js';

export function OpenCaseForm() {
  const navigate = useNavigate();
  const openingRef = useRef(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string>();

  async function chooseAndOpen() {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    setError(undefined);
    try {
      const selection = await window.recoveryApi.chooseWorkspaceFolder();
      if (!selection) return;
      const opened = RecoveryCaseSchema.parse(await window.recoveryApi.openCase(selection.selectedPath));
      rememberValidatedCase(opened);
      rememberRecentCase(opened);
      await navigate(`/cases/${opened.caseId}/overview`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The selected case workspace could not be opened.');
    } finally {
      openingRef.current = false;
      setOpening(false);
    }
  }

  return <section className="open-case-panel" aria-labelledby="open-case-panel-title">
    <FolderOpen aria-hidden="true" />
    <div>
      <h2 id="open-case-panel-title">Choose the existing case folder</h2>
      <p>Select the folder that contains the case manifest. SHUNYA validates it through the recovery service before adding it to Recent cases.</p>
      <div className="open-case-panel__safety"><ShieldCheck aria-hidden="true" /><span><strong>Opening does not start a scan.</strong><small>Source writes remain blocked.</small></span></div>
    </div>
    <button className="button button--primary" type="button" disabled={opening} onClick={() => void chooseAndOpen()}>{opening ? 'Opening workspace…' : 'Choose case workspace'}</button>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
  </section>;
}
