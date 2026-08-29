import { CapabilityBanner, RuntimeModeBadge } from '@recovery/ui';
import { Link } from 'react-router-dom';
import { copy } from '../i18n/en.js';

const cards = [
  { title: copy.newCase, description: copy.newCaseDescription, to: '/cases/new' },
  { title: copy.openCase, description: copy.openCaseDescription, to: '/cases/open' },
  { title: copy.diskImage, description: copy.diskImageDescription, to: '/cases/new?source=disk-image' },
  { title: copy.memoryImage, description: copy.memoryImageDescription, to: '/cases/new?source=memory-image' },
];

export function WelcomePage() {
  return <main className="welcome-page"><div className="welcome-topbar"><strong>SHUNYA Recovery</strong><RuntimeModeBadge mode="installed" /></div><section className="welcome-hero"><p className="eyebrow">Digital recovery workspace</p><h1>{copy.welcomeTitle}</h1><p>{copy.welcomeSubtitle}</p></section><div className="start-grid">{cards.map((card) => <Link className="start-card" to={card.to} key={card.title}><strong>{card.title}</strong><span>{card.description}</span></Link>)}</div><CapabilityBanner level="info" title="Installed Mode" explanation={copy.installedNotice} /></main>;
}
