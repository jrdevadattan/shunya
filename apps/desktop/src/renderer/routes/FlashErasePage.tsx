import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, HardDrive, Loader2, ShieldAlert, ShieldCheck, Usb } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BlockDevice, EraseProgressEvent, EraseResult } from '../../main/secure-erase/types.js';
import { ApplicationShell } from './ApplicationShell.js';
import { CertificatePanel } from '../features/certificate/CertificatePanel.js';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${bytes} B`;
}

type Phase = 'idle' | 'running' | 'done' | 'error';

export function FlashErasePage() {
  const [devices, setDevices] = useState<BlockDevice[] | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const [elevated, setElevated] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<string>();
  const [dryRun, setDryRun] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<EraseProgressEvent>();
  const [result, setResult] = useState<EraseResult>();
  const [runError, setRunError] = useState<string>();
  const progressRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    void refresh();
    const unsubscribe = window.secureErase.onProgress((event) => setProgress(event as EraseProgressEvent));
    return unsubscribe;
  }, []);

  const target = devices?.find((device) => device.device === selected);
  const confirmed = Boolean(target) && confirmText === target?.device;
  const showElevationHint = !dryRun && elevated === false;
  const canErase = confirmed && phase !== 'running';

  async function erase() {
    if (!target || !confirmed) return;
    setPhase('running');
    setRunError(undefined);
    setResult(undefined);
    setProgress({ device: target.device, method: 'csprng_overwrite', percent: 0, statusText: 'Starting…' });
    try {
      const outcome = await window.secureErase.csprngErase(target.device, { confirmation: target.device, dryRun });
      setResult(outcome);
      setPhase('done');
    } catch (cause) {
      setRunError(cause instanceof Error ? cause.message : 'The erase could not be completed.');
      setPhase('error');
    }
  }

  return (
    <ApplicationShell title="Secure erase">
      <div className="flash-erase">
        <Link to="/" className="back-link"><ArrowLeft aria-hidden="true" size={16} />Back to workspace</Link>

        <header className="page-heading">
          <div>
            <p className="eyebrow flash-erase__eyebrow">Secure drive eraser</p>
            <h1>Erase a removable device</h1>
            <p className="page-heading__description">
              Overwrites every sector of a USB flash drive with a CSPRNG (AES-256-CTR) keystream in a single pass —
              a NIST SP 800-88 <strong>Clear</strong> method. The system disk can never be selected.
            </p>
          </div>
          <button type="button" className="button button--secondary" onClick={() => void refresh()} disabled={phase === 'running'}>Rescan devices</button>
        </header>

        {loadError ? <p role="alert" className="form-error">{loadError}</p> : null}

        <section className="flash-erase__devices" aria-label="Detected devices">
          {devices === null ? <p role="status" className="flash-erase__loading"><Loader2 aria-hidden="true" className="spin" /> Scanning connected devices…</p> : null}
          {devices?.length === 0 ? <p className="empty-state">No physical devices were reported.</p> : null}
          {devices?.map((device) => {
            const eligible = device.removable && !device.system;
            const active = selected === device.device;
            return (
              <button
                key={device.device}
                type="button"
                className="flash-erase__device"
                data-eligible={eligible || undefined}
                data-active={active || undefined}
                aria-pressed={active}
                disabled={!eligible || phase === 'running'}
                onClick={() => { setSelected(device.device); setConfirmText(''); setResult(undefined); setPhase('idle'); }}
              >
                <span className="flash-erase__device-icon" aria-hidden="true">{device.removable ? <Usb /> : <HardDrive />}</span>
                <span className="flash-erase__device-body">
                  <strong>{device.model}</strong>
                  <small>{formatBytes(device.sizeBytes)} · {device.busType ?? 'unknown bus'} · <code className="flash-erase__path">{device.device}</code></small>
                </span>
                <span className="flash-erase__device-badge" data-tone={device.system ? 'system' : eligible ? 'eligible' : 'blocked'}>
                  {device.system ? 'System disk — protected' : eligible ? 'Removable' : 'Fixed disk — not eligible'}
                </span>
              </button>
            );
          })}
        </section>

        {target ? (
          <section className="flash-erase__panel" aria-label="Erase options">
            <div className="flash-erase__method">
              <ShieldCheck aria-hidden="true" />
              <div>
                <strong>CSPRNG overwrite — NIST SP 800-88 Clear</strong>
                <p>A single sequential AES-256-CTR keystream pass over all {formatBytes(target.sizeBytes)}. No key is stored or reused; the transient key exists only in memory and is zeroed after.</p>
                <p className="flash-erase__limitation">
                  Honest limitation: on flash media, wear-leveling and over-provisioning mean a logical overwrite may not reach every physical NAND cell. For NIST <strong>Purge</strong> assurance, use a firmware command (ATA Secure Erase / NVMe Sanitize).
                </p>
              </div>
            </div>

            <label className="flash-erase__dryrun">
              <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} disabled={phase === 'running'} />
              <span>
                <strong>Dry run (safe)</strong>
                <small>Writes a real CSPRNG sample to a scratch file to prove the pipeline. The device is <em>not</em> changed. Uncheck to perform the real, irreversible wipe.</small>
              </span>
            </label>

            {showElevationHint ? (
              <p className="flash-erase__warn"><ShieldAlert aria-hidden="true" /> A live wipe needs administrator rights. If it fails with “access denied”, close and relaunch the app as Administrator. If you already launched as admin, you can proceed.</p>
            ) : null}

            {!dryRun ? (
              <div className="flash-erase__danger">
                <ShieldAlert aria-hidden="true" />
                <div>
                  <strong>This permanently destroys everything on {target.model} ({formatBytes(target.sizeBytes)}).</strong>
                  <p>To confirm, type the device path exactly: <code className="flash-erase__path">{target.device}</code></p>
                  <input
                    className="flash-erase__confirm"
                    value={confirmText}
                    onChange={(event) => setConfirmText(event.target.value)}
                    placeholder={target.device}
                    spellCheck={false}
                    autoComplete="off"
                    disabled={phase === 'running'}
                  />
                </div>
              </div>
            ) : null}

            <div className="flash-erase__actions">
              <button
                type="button"
                className="button button--danger"
                disabled={dryRun ? phase === 'running' : !canErase}
                onClick={() => void erase()}
              >
                <ShieldAlert aria-hidden="true" />
                {phase === 'running' ? 'Working…' : dryRun ? 'Run dry run' : `Erase ${target.model}`}
              </button>
            </div>

            {phase === 'running' || phase === 'done' ? (
              <div className="flash-erase__progress" ref={progressRef}>
                <div className={`job-progress__bar${phase === 'running' ? ' job-progress__bar--running' : ''}`} role="progressbar" aria-label="Erase progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress?.percent ?? 0)}>
                  <span style={{ width: `${progress?.percent ?? 0}%` }} />
                </div>
                <p className="flash-erase__status">{progress?.statusText ?? 'Working…'} {progress?.percent !== null && progress?.percent !== undefined ? `(${Math.round(progress.percent)}%)` : ''}</p>
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
          </section>
        ) : null}
      </div>
    </ApplicationShell>
  );
}
