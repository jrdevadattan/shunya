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
          <div><p className="eyebrow">Case intake</p><h1>Create recovery case</h1><p className="page-heading__description">Set up a clean workspace first. You will select the recovery source on the next screen.</p></div>
        </header>
        <NewCaseForm />
      </div>
    </ApplicationShell>
  );
}
