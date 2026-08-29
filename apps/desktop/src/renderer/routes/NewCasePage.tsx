import { Link } from 'react-router-dom';
import { NewCaseForm } from '../features/cases/NewCaseForm.js';

export function NewCasePage() {
  return <main className="form-page"><Link to="/" className="back-link">← Back</Link><header><p className="eyebrow">Case intake</p><h1>Create recovery case</h1><p>Record the case details before selecting a source.</p></header><NewCaseForm /></main>;
}
