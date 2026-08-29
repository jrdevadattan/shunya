import { CapabilityBanner, RuntimeModeBadge } from '@recovery/ui';
import { BrainCircuit, FolderOpen, HardDrive, Plus, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { copy } from '../i18n/en.js';

const cards = [
  { title: copy.newCase, description: copy.newCaseDescription, to: '/cases/new', icon: Plus, label: 'Case' },
  { title: copy.openCase, description: copy.openCaseDescription, to: '/cases/open', icon: FolderOpen, label: 'Workspace' },
  { title: copy.diskImage, description: copy.diskImageDescription, to: '/cases/new?source=disk-image', icon: HardDrive, label: 'Evidence' },
  { title: copy.memoryImage, description: copy.memoryImageDescription, to: '/cases/new?source=memory-image', icon: BrainCircuit, label: 'Analysis' },
];

export function WelcomePage() {
  return (
    <main className="welcome-page">
      <header className="welcome-topbar">
        <div className="welcome-brand"><span aria-hidden="true"><ShieldCheck /></span><strong>SHUNYA Recovery</strong></div>
        <RuntimeModeBadge mode="installed" />
      </header>
      <section className="welcome-hero">
        <p className="eyebrow">Digital recovery workspace</p>
        <h1>{copy.welcomeTitle}</h1>
        <p>{copy.welcomeSubtitle}</p>
      </section>
      <section aria-labelledby="start-recovery-title">
        <div className="section-heading"><div><p className="eyebrow">Get started</p><h2 id="start-recovery-title">Choose a recovery path</h2></div></div>
        <div className="start-grid">
          {cards.map((card) => (
            <Link className="start-card" to={card.to} key={card.title}>
              <span className="start-card__icon" aria-hidden="true"><card.icon /></span>
              <small>{card.label}</small>
              <strong>{card.title}</strong>
              <span>{card.description}</span>
            </Link>
          ))}
        </div>
      </section>
      <CapabilityBanner level="info" title="Installed Mode" explanation={copy.installedNotice} />
    </main>
  );
}
