import { RecoveryCaseSchema } from '@recovery/contracts';
import { ArrowRight, BrainCircuit, CalendarDays, FolderOpen, HardDrive, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { rememberValidatedCase } from '../application-state.js';
import { loadRecentCases, rememberRecentCase, type RecentRecoveryCase } from '../features/cases/recent-cases.js';
import { loadRecentDeletions, type RecentDeletionCase } from '../features/cases/recent-deletions.js';
import { ApplicationShell } from './ApplicationShell.js';

const recoveryPaths = [
  { title: 'Recover from a device', description: 'Create a case, then add a supported read-only source.', to: '/cases/new', icon: HardDrive },
  { title: 'Analyze a disk image', description: 'Create a case for an existing RAW image.', to: '/cases/new?source=disk-image', icon: FolderOpen },
  { title: 'Analyze a memory image', description: 'Review the verified memory-analysis capability before starting.', to: '/cases/new?source=memory-image', icon: BrainCircuit },
];

export function WelcomePage() {
  const navigate = useNavigate();
  const [recentCases, setRecentCases] = useState(loadRecentCases);
  const [recentDeletions, setRecentDeletions] = useState(loadRecentDeletions);
  const [openingCaseId, setOpeningCaseId] = useState<string>();
  const [error, setError] = useState<string>();

  async function continueCase(recentCase: RecentRecoveryCase) {
    if (openingCaseId) return;
    setOpeningCaseId(recentCase.caseId);
    setError(undefined);
    try {
      const opened = RecoveryCaseSchema.parse(await window.recoveryApi.openCase(recentCase.workspacePath));
      rememberValidatedCase(opened);
      setRecentCases(rememberRecentCase(opened));
      await navigate(`/cases/${opened.caseId}/overview`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The recent case could not be opened.');
    } finally {
      setOpeningCaseId(undefined);
    }
  }

  return (
    <ApplicationShell title="Cases">
      <div className="welcome-page welcome-cases-home">
        <header className="page-heading welcome-cases-home__heading">
          <div>
            <h1>Your recovery cases</h1>
            <p className="page-heading__description">Start a new recovery or open a workspace you already know.</p>
          </div>
          <Link className="button button--primary button--icon" to="/cases/new"><Plus aria-hidden="true" />New recovery</Link>
        </header>

        <section className="recovery-paths" aria-label="Start a recovery">
          {recoveryPaths.map((path) => (
            <Link key={path.title} className="recovery-path" to={path.to}>
              <path.icon aria-hidden="true" />
              <span><strong>{path.title}</strong><small>{path.description}</small></span>
              <ArrowRight aria-hidden="true" />
            </Link>
          ))}
        </section>

        <section className="recent-cases" aria-labelledby="recent-cases-title">
          <header>
            <div><h2 id="recent-cases-title">Recent cases</h2><p>Cases successfully created or opened on this device.</p></div>
            <Link className="button button--secondary button--icon" to="/cases/open"><FolderOpen aria-hidden="true" />Open existing case</Link>
          </header>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {recentCases.length ? <ul className="recent-cases__list">
            {recentCases.map((recentCase) => <li key={recentCase.caseId}>
              <div className="recent-case__identity"><strong>{recentCase.title}</strong><small>{recentCase.workspacePath}</small></div>
              <div className="recent-case__details"><span>{recentCase.operator}</span><span><CalendarDays aria-hidden="true" />{formatDate(recentCase.createdAt)}</span></div>
              <button className="button button--secondary" type="button" disabled={Boolean(openingCaseId)} onClick={() => void continueCase(recentCase)}>{openingCaseId === recentCase.caseId ? 'Opening case…' : 'Continue case'}</button>
            </li>)}
          </ul> : <div className="recent-cases__empty">
            <p>No recent cases are stored on this device yet.</p>
            <p>The recovery service does not expose a global case index. Open a known workspace to add it here.</p>
          </div>}
        </section>

        <section className="recent-cases" aria-labelledby="deletion-cases-title" style={{ marginTop: '24px' }}>
          <header>
            <div><h2 id="deletion-cases-title">Your deletion cases</h2><p>Manage and review your secure deletion cases.</p></div>
            <Link className="button button--secondary button--icon" to="/deletion/new"><Plus aria-hidden="true" />New deletion</Link>
          </header>
          {recentDeletions.length ? <ul className="recent-cases__list">
            {recentDeletions.map((recentCase) => <li key={recentCase.id}>
              <div className="recent-case__identity"><strong>{recentCase.title}</strong><small>{recentCase.targetPath}</small></div>
              <div className="recent-case__details">
                <span>Total Files: {recentCase.totalFiles}</span>
                <span><CalendarDays aria-hidden="true" />{formatDate(recentCase.createdAt)}</span>
              </div>
            </li>)}
          </ul> : <div className="recent-cases__empty">
            <p>No deletion cases are stored on this device yet.</p>
          </div>}
        </section>
      </div>
    </ApplicationShell>
  );
}

function formatDate(createdAt: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(createdAt));
}
