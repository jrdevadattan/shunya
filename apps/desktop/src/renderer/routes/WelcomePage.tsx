import { ArrowRight, BrainCircuit, FolderOpen, HardDrive, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApplicationShell } from './ApplicationShell.js';

const recoveryPaths = [
  { title: 'Recover from a device', description: 'Create a case, then add a supported read-only source.', to: '/cases/new', icon: HardDrive },
  { title: 'Analyze a disk image', description: 'Create a case for an existing RAW image.', to: '/cases/new?source=disk-image', icon: FolderOpen },
  { title: 'Analyze a memory image', description: 'Review the verified memory-analysis capability before starting.', to: '/cases/new?source=memory-image', icon: BrainCircuit },
];

export function WelcomePage() {
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

        <section className="recent-cases-unavailable" aria-labelledby="recent-cases-title">
          <div>
            <h2 id="recent-cases-title">Recent cases</h2>
            <p>Recent cases are unavailable because the recovery service does not expose a case index.</p>
            <p>Open a known workspace folder to continue a case without displaying invented history.</p>
          </div>
          <Link className="button button--secondary button--icon" to="/cases/open"><FolderOpen aria-hidden="true" />Open existing case</Link>
        </section>
      </div>
    </ApplicationShell>
  );
}
