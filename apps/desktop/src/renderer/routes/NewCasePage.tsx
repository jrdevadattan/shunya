import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NewCaseForm } from '../features/cases/NewCaseForm.js';

export function NewCasePage() {
  return (
    <main className="form-page">
      <Link to="/" className="back-link"><ArrowLeft aria-hidden="true" />Back to workspace</Link>
      <header className="page-heading">
        <div><p className="eyebrow">Case intake</p><h1>Create recovery case</h1></div>
        <p>Record the case details before selecting a source.</p>
      </header>
      <NewCaseForm />
    </main>
  );
}
