import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NewCaseForm } from '../features/cases/NewCaseForm.js';
import { ApplicationShell } from './ApplicationShell.js';

export function NewCasePage() {
  return (
    <ApplicationShell title="New case">
      <div className="form-page">
        <Link to="/" className="back-link"><ArrowLeft aria-hidden="true" />Back to workspace</Link>
        <header className="page-heading">
          <div><p className="eyebrow">Case intake</p><h1>Start a new recovery case</h1><p className="page-heading__description">Add the case details, inspect a parent folder, and review everything before creating the workspace.</p></div>
        </header>
        <NewCaseForm />
      </div>
    </ApplicationShell>
  );
}
