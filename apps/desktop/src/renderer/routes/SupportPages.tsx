import { Check, CircleHelp, Info, LockKeyhole, PanelLeftClose, RotateCcw, ShieldCheck, SunMoon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApplicationShell, useApplicationPreferences } from './ApplicationShell.js';

export function SettingsPage() {
  return (
    <ApplicationShell title="Settings">
      <SettingsWorkspace />
    </ApplicationShell>
  );
}

function SettingsWorkspace() {
  const { preferences, updatePreferences } = useApplicationPreferences();
  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <header><p className="eyebrow">Application preferences</p><h1 id="settings-title">Settings</h1><p>Configure persisted appearance choices and review recovery safeguards that this build enforces.</p></header>
      <div className="settings-grid">
        <section className="settings-panel" aria-labelledby="appearance-title">
          <header><SunMoon aria-hidden="true" /><span><h2 id="appearance-title">Appearance</h2><p>Theme and sidebar choices are stored on this device. Changes apply immediately.</p></span></header>
          <fieldset className="settings-theme"><legend>Theme</legend>{(['light', 'system', 'dark'] as const).map((theme) => <label key={theme}><input type="radio" name="settings-theme" checked={preferences.theme === theme} onChange={() => updatePreferences({ ...preferences, theme })} />{theme === 'system' ? 'System theme' : `${theme.charAt(0).toUpperCase()}${theme.slice(1)} theme`}<Check aria-hidden="true" /></label>)}</fieldset>
          <label className="settings-sidebar"><input type="checkbox" checked={preferences.sidebarCollapsed} onChange={(event) => updatePreferences({ ...preferences, sidebarCollapsed: event.target.checked })} /><PanelLeftClose aria-hidden="true" /><span><strong>Collapse navigation sidebar</strong><small>Keep the compact sidebar between application launches.</small></span></label>
          <button className="button button--secondary button--icon" type="button" onClick={() => updatePreferences({ theme: 'system', sidebarCollapsed: false })}><RotateCcw aria-hidden="true" />Restore appearance defaults</button>
        </section>

        <section className="settings-panel" aria-labelledby="safety-title">
          <header><ShieldCheck aria-hidden="true" /><span><h2 id="safety-title">Recovery safety invariants</h2><p>These are application boundaries, not optional preferences.</p></span></header>
          <div className="settings-invariants">
            <article className="settings-invariant"><ShieldCheck aria-hidden="true" /><span><strong>Always open evidence sources read-only</strong><small>Source-write and in-place repair operations are not exposed.</small></span><em>Enforced and cannot be changed</em></article>
            <article className="settings-invariant"><ShieldCheck aria-hidden="true" /><span><strong>Require a separate export destination</strong><small>Topology checks fail closed when separation cannot be proven.</small></span><em>Enforced and cannot be changed</em></article>
            <article className="settings-invariant"><ShieldCheck aria-hidden="true" /><span><strong>Keep active-content preview protected</strong><small>Unsafe or unsupported previews remain blocked.</small></span><em>Enforced and cannot be changed</em></article>
          </div>
        </section>
      </div>
      <section className="settings-locked" aria-labelledby="settings-locked-title"><LockKeyhole aria-hidden="true" /><span><h2 id="settings-locked-title">Additional recovery defaults unavailable</h2><p>Additional recovery defaults are unavailable because the daemon has no persisted settings API. Checkpoint cadence, verification policy, storage headroom, and tool runtimes therefore have no editable controls here.</p></span></section>
    </section>
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
