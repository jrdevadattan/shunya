import { PageHeader } from '@recovery/ui';
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
      <div className="page page--narrow">
        <Link to="/" className="back-link"><ArrowLeft aria-hidden="true" />Home</Link>
        {opening
          ? <PageHeader eyebrow="Existing case" title="Open an existing recovery case" description="Choose the folder of a case you created earlier to continue where you left off." />
          : <PageHeader eyebrow="Step 1 of 3" title="Start a new recovery case" description="A case keeps everything recovered from one device together: the files, the report and the log." />}
        {opening ? <OpenCaseForm /> : <NewCaseForm intent={intent} />}
      </div>
    </ApplicationShell>
  );
}
