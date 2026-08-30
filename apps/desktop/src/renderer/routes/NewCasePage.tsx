import { ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { NewCaseForm } from '../features/cases/NewCaseForm.js';
import { OpenCaseForm } from '../features/cases/OpenCaseForm.js';
import { ApplicationShell } from './ApplicationShell.js';

export function NewCasePage() {
  const location = useLocation();
  const opening = location.pathname === '/cases/open';
  const requestedSource = new URLSearchParams(location.search).get('source');
  const intent = requestedSource === 'disk-image' || requestedSource === 'memory-image' ? requestedSource : undefined;
  return (
    <ApplicationShell title={opening ? 'Open case' : 'New case'}>
      <div className="form-page">
        <Link to="/" className="back-link"><ArrowLeft aria-hidden="true" />Back to workspace</Link>
        <header className="page-heading">
          {opening
            ? <div><p className="eyebrow">Existing workspace</p><h1>Open an existing recovery case</h1><p className="page-heading__description">Choose a known case folder to validate and continue its persisted recovery state.</p></div>
            : <div><p className="eyebrow">Case intake</p><h1>Start a new recovery case</h1><p className="page-heading__description">Add the case details, inspect a parent folder, and review everything before creating the workspace.</p></div>}
        </header>
        {opening ? <OpenCaseForm /> : <NewCaseForm intent={intent} />}
      </div>
    </ApplicationShell>
  );
}
