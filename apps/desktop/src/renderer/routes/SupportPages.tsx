import { AdvancedSection, PageHeader } from '@recovery/ui';
import { CircleHelp, FolderSearch, Info, LockKeyhole, Monitor, Moon, RotateCcw, ShieldCheck, Sun, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApplicationShell, useApplicationPreferences } from './ApplicationShell.js';

export function SettingsPage() {
  return (
    <ApplicationShell title="Settings">
      <SettingsWorkspace />
    </ApplicationShell>
  );
}

const themes = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'dark', label: 'Dark', Icon: Moon },
] as const;

const invariants = [
  'Evidence sources open read-only',
  'Exports need a separate destination',
  'Active content is never previewed',
];

function SettingsWorkspace() {
  const { preferences, updatePreferences } = useApplicationPreferences();
  return (
    <section className="page page--narrow" aria-labelledby="settings-title">
      <PageHeader title="Settings" titleId="settings-title" />
      <div className="settings-grid">
        <section className="card stack" aria-labelledby="appearance-title">
          <h2 id="appearance-title">Appearance</h2>
          <fieldset className="settings-theme">
            <legend>Theme</legend>
            {themes.map(({ value, label, Icon }) => (
              <label key={value}><input type="radio" name="settings-theme" checked={preferences.theme === value} onChange={() => updatePreferences({ ...preferences, theme: value })} /><Icon aria-hidden="true" />{label}</label>
            ))}
          </fieldset>
          <label className="check"><input type="checkbox" checked={preferences.sidebarCollapsed} onChange={(event) => updatePreferences({ ...preferences, sidebarCollapsed: event.target.checked })} /><span><strong>Collapse sidebar</strong></span></label>
          <button className="button button--ghost button--small" type="button" onClick={() => updatePreferences({ theme: 'system', sidebarCollapsed: false })}><RotateCcw aria-hidden="true" />Reset</button>
        </section>

        <section className="card stack" aria-labelledby="safety-title">
          <div className="section-title"><h2 id="safety-title">Built-in safety</h2><span className="badge" data-tone="success">Enforced and cannot be changed</span></div>
          <ul className="settings-invariants">
            {invariants.map((invariant) => <li key={invariant} className="settings-invariant"><ShieldCheck aria-hidden="true" />{invariant}</li>)}
          </ul>
        </section>
      </div>
      <AdvancedSection title="Advanced recovery defaults" summary="Not configurable in this build" icon={LockKeyhole} quiet>
        <p className="form-hint">The recovery service has no settings API, so checkpoint cadence, verification policy, storage headroom and tool runtimes cannot be changed here.</p>
      </AdvancedSection>
    </section>
  );
}

export function HelpPage() {
  return (
    <ApplicationShell title="Help">
      <section className="page page--narrow" aria-labelledby="help-title">
        <PageHeader title="Help" titleId="help-title" />
        <div className="support-grid">
          <article className="support-card"><FolderSearch aria-hidden="true" /><div><h2>Recovering files</h2><p>Create a case, choose a drive image, pick the file types you want, then press Start.</p></div></article>
          <article className="support-card"><ShieldCheck aria-hidden="true" /><div><h2>Protecting the original</h2><p>Make a disk image first and export to a different drive. The original is never written to.</p></div></article>
          <article className="support-card"><Trash2 aria-hidden="true" /><div><h2>Deleting securely</h2><p>Folder deletion and drive wipes work on USB media only. Your system drive can never be selected.</p></div></article>
          <article className="support-card"><CircleHelp aria-hidden="true" /><div><h2>When something is unavailable</h2><p>Capabilities that are missing say so instead of guessing. The message explains what is needed.</p></div></article>
        </div>
        <div><Link className="button button--primary" to="/cases/new">Create a recovery case</Link></div>
      </section>
    </ApplicationShell>
  );
}

export function AboutPage() {
  return (
    <ApplicationShell title="About">
      <section className="page page--narrow" aria-labelledby="about-title">
        <PageHeader title="About SHUNYA Recovery" titleId="about-title" description="Offline-first, read-only recovery workspace" />
        <div className="support-grid">
          <article className="support-card"><Info aria-hidden="true" /><div><h2>What it does</h2><p>Recovers deleted files from drive images and securely destroys data, entirely offline.</p></div></article>
          <article className="support-card"><ShieldCheck aria-hidden="true" /><div><h2>Truthful by design</h2><p>Nothing is estimated or simulated. Unsupported capabilities stay unavailable.</p></div></article>
        </div>
      </section>
    </ApplicationShell>
  );
}
