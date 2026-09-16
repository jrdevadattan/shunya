import { AdvancedSection, PageHeader } from '@recovery/ui';
import { CircleHelp, FolderSearch, Info, LockKeyhole, Monitor, Moon, PanelLeftClose, RotateCcw, ShieldCheck, Sun, Trash2 } from 'lucide-react';
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
  { value: 'light', label: 'Light theme', Icon: Sun },
  { value: 'system', label: 'System theme', Icon: Monitor },
  { value: 'dark', label: 'Dark theme', Icon: Moon },
] as const;

function SettingsWorkspace() {
  const { preferences, updatePreferences } = useApplicationPreferences();
  return (
    <section className="page page--narrow" aria-labelledby="settings-title">
      <PageHeader title="Settings" titleId="settings-title" description="Theme and sidebar choices are stored on this device. Changes apply immediately." />
      <div className="settings-grid">
        <section className="card stack" aria-labelledby="appearance-title">
          <h2 id="appearance-title">Appearance</h2>
          <fieldset className="settings-theme"><legend>Theme</legend>{themes.map(({ value, label, Icon }) => <label key={value}><input type="radio" name="settings-theme" checked={preferences.theme === value} onChange={() => updatePreferences({ ...preferences, theme: value })} /><Icon aria-hidden="true" />{label}</label>)}</fieldset>
          <label className="check check--boxed"><input type="checkbox" checked={preferences.sidebarCollapsed} onChange={(event) => updatePreferences({ ...preferences, sidebarCollapsed: event.target.checked })} /><span><strong><PanelLeftClose aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Collapse navigation sidebar</strong><small>Keep the compact sidebar between launches.</small></span></label>
          <button className="button button--ghost button--small" type="button" onClick={() => updatePreferences({ theme: 'system', sidebarCollapsed: false })}><RotateCcw aria-hidden="true" />Restore appearance defaults</button>
        </section>

        <section className="card stack" aria-labelledby="safety-title">
          <div><h2 id="safety-title">Built-in safety</h2><p className="form-hint">These protections are always on. They are part of how SHUNYA works, not options.</p></div>
          <div className="settings-invariants">
            <article className="settings-invariant"><ShieldCheck aria-hidden="true" /><span><strong>Always open evidence sources read-only</strong><small>Nothing is ever written to the drive you recover from.</small></span><em>Enforced and cannot be changed</em></article>
            <article className="settings-invariant"><ShieldCheck aria-hidden="true" /><span><strong>Require a separate export destination</strong><small>Exports are refused onto the source or the case folder.</small></span><em>Enforced and cannot be changed</em></article>
            <article className="settings-invariant"><ShieldCheck aria-hidden="true" /><span><strong>Keep active-content preview protected</strong><small>Programs and flagged files are never opened in the app.</small></span><em>Enforced and cannot be changed</em></article>
          </div>
        </section>
      </div>
      <AdvancedSection title="Advanced recovery defaults" summary="Checkpoint cadence, verification policy, storage headroom and tool runtimes" icon={LockKeyhole} quiet>
        <p className="form-hint">Additional recovery defaults are unavailable because the daemon has no persisted settings API. Checkpoint cadence, verification policy, storage headroom, and tool runtimes therefore have no editable controls here.</p>
      </AdvancedSection>
    </section>
  );
}

export function HelpPage() {
  return (
    <ApplicationShell title="Help">
      <section className="page page--narrow" aria-labelledby="help-title">
        <PageHeader title="Help" titleId="help-title" description="Three things to know before you start." />
        <div className="support-grid">
          <article className="support-card"><FolderSearch aria-hidden="true" /><div><h2>Recovering files</h2><p>Open or create a case before using case recovery tools. Then choose the drive image, pick the file types you want back, and press Start.</p></div></article>
          <article className="support-card"><ShieldCheck aria-hidden="true" /><div><h2>Protect the original</h2><p>Keep evidence sources read-only and choose a separate destination for case data and exports. Making a disk image first is the safest path.</p></div></article>
          <article className="support-card"><Trash2 aria-hidden="true" /><div><h2>Securely deleting</h2><p>Folder deletion and whole-drive wipes only work on removable USB media. Your system drive can never be selected.</p></div></article>
          <article className="support-card"><CircleHelp aria-hidden="true" /><div><h2>When something is unavailable</h2><p>Some capabilities show as unavailable rather than guessing. The message at that spot explains what is missing and what to do.</p></div></article>
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
          <article className="support-card"><Info aria-hidden="true" /><div><h2>What it does</h2><p>SHUNYA Recovery coordinates case work through the local recovery service and displays only typed service results — nothing is estimated in the interface.</p></div></article>
          <article className="support-card"><ShieldCheck aria-hidden="true" /><div><h2>Truthful by design</h2><p>Unsupported capabilities stay unavailable instead of producing simulated findings, device health, or forensic evidence.</p></div></article>
        </div>
      </section>
    </ApplicationShell>
  );
}
