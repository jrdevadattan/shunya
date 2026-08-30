import { CircleHelp, Info, MonitorCog, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApplicationShell } from './ApplicationShell.js';

export function SettingsPage() {
  return (
    <ApplicationShell title="Settings">
      <section className="support-page" aria-labelledby="settings-title">
        <header><h1 id="settings-title">Settings</h1><p>Available application preferences and recovery safety boundaries.</p></header>
        <div className="support-page__grid">
          <article>
            <MonitorCog aria-hidden="true" />
            <div><h2>Appearance</h2><p>Theme and sidebar choices are stored on this device. Use the theme control in the application header and the menu button beside the SHUNYA wordmark.</p></div>
          </article>
          <article>
            <ShieldCheck aria-hidden="true" />
            <div><h2>Recovery safety</h2><p>Sources remain read-only and source writes are blocked. Additional persisted recovery defaults are not available in this build.</p></div>
          </article>
        </div>
      </section>
    </ApplicationShell>
  );
}

export function HelpPage() {
  return (
    <ApplicationShell title="Help">
      <section className="support-page" aria-labelledby="help-title">
        <header><h1 id="help-title">Help</h1><p>Start with a known recovery workspace and follow the case workflow.</p></header>
        <div className="support-page__grid">
          <article>
            <CircleHelp aria-hidden="true" />
            <div><h2>Using recovery tools</h2><p>Open or create a case before using case recovery tools. Unavailable capabilities explain their limitation at the point of use.</p></div>
          </article>
          <article>
            <ShieldCheck aria-hidden="true" />
            <div><h2>Protect the source</h2><p>Keep evidence sources read-only and choose a separate destination for case data and exports.</p></div>
          </article>
        </div>
        <Link className="button button--primary" to="/cases/new">Create a recovery case</Link>
      </section>
    </ApplicationShell>
  );
}

export function AboutPage() {
  return (
    <ApplicationShell title="About">
      <section className="support-page" aria-labelledby="about-title">
        <header><h1 id="about-title">About SHUNYA Recovery</h1><p>Offline-first, read-only recovery workspace</p></header>
        <div className="support-page__grid">
          <article>
            <Info aria-hidden="true" />
            <div><h2>Product scope</h2><p>SHUNYA Recovery coordinates case work through the local recovery service and displays only typed service results.</p></div>
          </article>
          <article>
            <ShieldCheck aria-hidden="true" />
            <div><h2>Truthful by design</h2><p>Unsupported capabilities stay unavailable instead of producing simulated findings, device health, or forensic evidence.</p></div>
          </article>
        </div>
      </section>
    </ApplicationShell>
  );
}
