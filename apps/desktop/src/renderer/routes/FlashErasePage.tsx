import { useEffect, useState } from 'react';
import { AdvancedSection, PageHeader } from '@recovery/ui';
import { ArrowLeft, BookOpen, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BlockDevice, EraseResult } from '../../main/secure-erase/types.js';
import { ApplicationShell } from './ApplicationShell.js';
import { CertificatePanel } from '../features/certificate/CertificatePanel.js';
import { DevicePicker, formatDeviceBytes } from '../features/devices/DevicePicker.js';
import { trackOperation, useOperationByKind } from '../features/operations/operations-store.js';

export function FlashErasePage() {
  const [devices, setDevices] = useState<BlockDevice[] | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const [elevated, setElevated] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<string>();
  const [dryRun, setDryRun] = useState(true);
  const [confirmText, setConfirmText] = useState('');

  // The running/finished wipe lives in the global store, so progress and the
  // result survive navigating away and back while the wipe runs in the main process.
  const latestWipe = useOperationByKind('wipe');
  const op = latestWipe && latestWipe.device === selected ? latestWipe : undefined;
  const phase = op ? op.status : 'idle';
  const running = phase === 'running';
  const result = op?.status === 'done' ? (op.result as EraseResult | undefined) : undefined;
  const runError = op?.status === 'error' ? op.error : undefined;

  async function refresh() {
    setLoadError(undefined);
    try {
      const [list, admin] = await Promise.all([window.secureErase.listBlockDevices(), window.secureErase.isElevated()]);
      setDevices(list);
      setElevated(admin);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Devices could not be listed.');
    }
  }

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!selected && latestWipe?.device) setSelected(latestWipe.device);
  }, [latestWipe, selected]);

  const target = devices?.find((device) => device.device === selected);
  const confirmed = Boolean(target) && confirmText === target?.device;
  const showElevationHint = !dryRun && elevated === false;
  const canErase = confirmed && !running;

  async function erase() {
    if (!target || !confirmed) return;
    try {
      await trackOperation(
        { id: `wipe:${target.device}`, kind: 'wipe', label: `${dryRun ? 'Dry run' : 'Erasing'} ${target.model}`, route: '/secure-erase', device: target.device },
        window.secureErase.csprngErase(target.device, { confirmation: target.device, dryRun }),
      );
    } catch { /* error surfaces via the store op */ }
  }

  return (
    <ApplicationShell title="Erase a drive">
      <div className="page page--narrow">
        <Link to="/" className="back-link"><ArrowLeft aria-hidden="true" />Home</Link>
        <PageHeader
          eyebrow="Securely delete"
          title="Erase a removable drive"
          description="Overwrites every byte of a USB drive with random data in a single pass, then issues a signed certificate. Your system drive can never be selected."
          actions={<button type="button" className="button button--secondary" onClick={() => void refresh()} disabled={running}><RefreshCw aria-hidden="true" />Rescan</button>}
        />

        {loadError ? <p role="alert" className="form-error">{loadError}</p> : null}
        <DevicePicker devices={devices} selected={selected} busy={running} onSelect={(device) => { setSelected(device.device); setConfirmText(''); }} />

        {target ? (
          <section className="card stack stack--loose" aria-label="Erase options">
            <label className="check check--boxed">
              <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} disabled={running} />
              <span>
                <strong>Dry run (safe)</strong>
                <small>Runs the whole pipeline against a scratch file so you can see it work. <em>{target.model} is not changed.</em> Untick to perform the real, irreversible wipe.</small>
              </span>
            </label>

            {showElevationHint ? (
              <p className="flash-erase__warn"><ShieldAlert aria-hidden="true" /> A real wipe needs administrator rights. If it fails with “access denied”, close the app and relaunch it as Administrator.</p>
            ) : null}

            {!dryRun ? (
              <div className="danger-zone">
                <ShieldAlert aria-hidden="true" />
                <div>
                  <strong>This permanently destroys everything on {target.model} ({formatDeviceBytes(target.sizeBytes)}).</strong>
                  <p>To confirm, type the device path exactly: <code className="flash-erase__path">{target.device}</code></p>
                  <input
                    className="flash-erase__confirm"
                    value={confirmText}
                    onChange={(event) => setConfirmText(event.target.value)}
                    placeholder={target.device}
                    spellCheck={false}
                    autoComplete="off"
                    disabled={running}
                    aria-label="Type the device path to confirm"
                  />
                </div>
              </div>
            ) : null}

            <div className="flash-erase__actions">
              <button type="button" className={dryRun ? 'button button--primary button--large' : 'button button--danger button--large'} disabled={dryRun ? running : !canErase} onClick={() => void erase()}>
                <ShieldAlert aria-hidden="true" />
                {running ? 'Working…' : dryRun ? 'Run dry run' : `Erase ${target.model}`}
              </button>
            </div>

            {running || phase === 'done' ? (
              <div className="flash-erase__progress">
                <div className={`job-progress__bar${running ? ' job-progress__bar--running' : ''}`} role="progressbar" aria-label="Erase progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(op?.percent ?? 0)}>
                  <span style={{ width: `${op?.percent ?? 0}%` }} />
                </div>
                <p className="flash-erase__status">{op?.statusText ?? 'Working…'} ({Math.round(op?.percent ?? 0)}%)</p>
              </div>
            ) : null}

            {runError ? <p role="alert" className="form-error">{runError}</p> : null}

            {result ? (
              <div className="flash-erase__result">
                <ShieldCheck aria-hidden="true" />
                <div>
                  <strong>{dryRun ? 'Dry run complete — device untouched' : 'Erase complete'}</strong>
                  <small>Method: CSPRNG overwrite · Assurance: {result.assurance} · {new Date(result.completedAt).toLocaleString()}</small>
                  <small>Audit log: <code className="flash-erase__path">{result.auditLogPath}</code></small>
                </div>
              </div>
            ) : null}

            {result ? <CertificatePanel record={{
              kind: 'sanitization',
              title: dryRun ? `Secure-erase dry run — ${target.model}` : `Secure sanitization of ${target.model}`,
              device: target.device,
              model: target.model,
              serial: target.serial ?? undefined,
              method: dryRun ? 'CSPRNG overwrite (DRY RUN — device not modified)' : 'CSPRNG overwrite (AES-256-CTR keystream)',
              assurance: result.assurance,
              standard: 'NIST SP 800-88 Rev. 2 · Clear',
              details: `${(target.sizeBytes / 1024 ** 3).toFixed(2)} GB removable device`,
              completedAt: result.completedAt,
            }} /> : null}

            <AdvancedSection title="How the erase works" summary="Method, standards and the honest limitation for flash media" icon={BookOpen} quiet>
              <p className="form-hint"><strong>CSPRNG overwrite — NIST SP 800-88 Rev. 2 Clear.</strong> A single sequential AES-256-CTR keystream pass over all {formatDeviceBytes(target.sizeBytes)}. No key is stored or reused; the transient key exists only in memory and is zeroed afterwards.</p>
              <p className="note" data-tone="warning"><ShieldAlert aria-hidden="true" />Honest limitation: on flash media, wear-levelling and over-provisioning mean a logical overwrite may not reach every physical NAND cell. For NIST <strong>Purge</strong> assurance, use a firmware command (ATA Secure Erase / NVMe Sanitize).</p>
            </AdvancedSection>
          </section>
        ) : null}
      </div>
    </ApplicationShell>
  );
}
