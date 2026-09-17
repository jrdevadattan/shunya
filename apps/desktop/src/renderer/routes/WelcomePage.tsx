import { RecoveryCaseSchema } from '@recovery/contracts';
import { ArrowRight, BriefcaseBusiness, CalendarDays, FolderOpen, FolderSearch, HardDriveDownload, ShieldAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { rememberValidatedCase } from '../application-state.js';
import { loadRecentCases, rememberRecentCase, type RecentRecoveryCase } from '../features/cases/recent-cases.js';
import { loadRecentDeletions, type RecentDeletionCase } from '../features/cases/recent-deletions.js';
import { ApplicationShell } from './ApplicationShell.js';

export function WelcomePage() {
  const navigate = useNavigate();
  const [recentCases, setRecentCases] = useState(loadRecentCases);
  const [recentDeletions] = useState(loadRecentDeletions);
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
    <ApplicationShell title="Home">
      <div className="page home">
        <h1>What would you like to do?</h1>

        <section className="home__actions" aria-label="Start">
          <Link className="action-card action-card--primary" to="/cases/new">
            <span className="action-card__icon" aria-hidden="true"><FolderSearch /></span>
            <h2>Recover files</h2>
            <p>Get back deleted photos, documents and more from a drive image.</p>
            <span className="action-card__footer">Start <ArrowRight aria-hidden="true" /></span>
          </Link>
          <Link className="action-card" to="/deletion/new">
            <span className="action-card__icon" aria-hidden="true"><Trash2 /></span>
            <h2>Securely delete</h2>
            <p>Destroy a folder or a whole USB drive, with a signed certificate.</p>
            <span className="action-card__footer">Choose <ArrowRight aria-hidden="true" /></span>
          </Link>
          <Link className="action-card" to="/capture-image">
            <span className="action-card__icon" aria-hidden="true"><HardDriveDownload /></span>
            <h2>Make a disk image</h2>
            <p>Copy a USB drive to a read-only image, then recover from the copy.</p>
            <span className="action-card__footer">Capture <ArrowRight aria-hidden="true" /></span>
          </Link>
        </section>

        <div className="home__row">
          <section className="list-card" aria-labelledby="recent-cases-title">
            <header>
              <h2 id="recent-cases-title">Recent cases</h2>
              <Link className="button button--secondary button--small" to="/cases/open"><FolderOpen aria-hidden="true" />Open a case folder</Link>
            </header>
            {error ? <p className="form-error" role="alert" style={{ margin: '12px 20px 0' }}>{error}</p> : null}
            {recentCases.length ? <ul className="list-card__items">
              {recentCases.map((recentCase) => <li key={recentCase.caseId}>
                <span className="list-card__icon" aria-hidden="true"><BriefcaseBusiness /></span>
                <div className="list-card__body">
                  <strong>{recentCase.title}</strong>
                  <small>{recentCase.workspacePath}</small>
                  <span className="list-card__meta"><span>{recentCase.operator}</span><span><CalendarDays aria-hidden="true" />{formatDate(recentCase.createdAt)}</span></span>
                </div>
                <button className="button button--secondary button--small" type="button" disabled={Boolean(openingCaseId)} onClick={() => void continueCase(recentCase)}>{openingCaseId === recentCase.caseId ? 'Opening…' : 'Continue'}</button>
              </li>)}
            </ul> : <p className="list-card__empty">No recent cases yet.</p>}
          </section>

          <section className="list-card" aria-labelledby="deletion-cases-title">
            <header>
              <h2 id="deletion-cases-title">Deletion history</h2>
              <Link className="button button--secondary button--small" to="/secure-erase"><ShieldAlert aria-hidden="true" />Wipe a drive</Link>
            </header>
            {recentDeletions.length ? <ul className="list-card__items">
              {recentDeletions.map((entry) => <li key={entry.id}>
                <span className="list-card__icon" data-tone={entry.status === 'completed' ? 'success' : entry.status === 'completed_with_failures' ? 'warning' : undefined} aria-hidden="true"><Trash2 /></span>
                <div className="list-card__body">
                  <strong>{entry.title}</strong>
                  <small>{entry.targetPath}{entry.deviceModel ? ` · ${entry.deviceModel}` : ''}</small>
                  <span className="list-card__meta"><span className="deletion-status" data-tone={entry.status === 'completed' ? 'done' : entry.status === 'completed_with_failures' ? 'warning' : 'legacy'}>{deletionStatusLabel(entry)}</span><span><CalendarDays aria-hidden="true" />{formatDate(entry.completedAt ?? entry.createdAt)}</span></span>
                </div>
              </li>)}
            </ul> : <p className="list-card__empty">No deletions yet.</p>}
          </section>
        </div>
      </div>
    </ApplicationShell>
  );
}

function deletionStatusLabel(entry: RecentDeletionCase): string {
  if (entry.status === 'completed') return `${(entry.filesDeleted ?? entry.totalFiles).toLocaleString('en-US')} files deleted`;
  if (entry.status === 'completed_with_failures') return `${(entry.filesDeleted ?? 0).toLocaleString('en-US')} of ${entry.totalFiles.toLocaleString('en-US')} deleted · ${entry.failures ?? 0} failed`;
  return `${entry.totalFiles.toLocaleString('en-US')} files listed · not deleted`;
}

function formatDate(createdAt: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(createdAt));
}
