import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, HardDrive, HardDriveDownload, Loader2, ShieldAlert, ShieldCheck, Usb } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BlockDevice, CaptureProgressEvent, CaptureResult } from '../../main/secure-erase/types.js';
import { ApplicationShell } from './ApplicationShell.js';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${bytes} B`;
}

const GiB = 1024 ** 3;
type Scope = 'full' | '2gb' | '4gb';
type Phase = 'idle' | 'running' | 'done' | 'error';

function scopeBytes(scope: Scope): number | null {
  if (scope === '2gb') return 2 * GiB;
  if (scope === '4gb') return 4 * GiB;
  return null;
}

export function CaptureImagePage() {
  const [devices, setDevices] = useState<BlockDevice[] | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const [elevated, setElevated] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<string>();
  const [scope, setScope] = useState<Scope>('full');
  const [imagePath, setImagePath] = useState<string>();
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<CaptureProgressEvent>();
  const [result, setResult] = useState<CaptureResult>();
  const [runError, setRunError] = useState<string>();
  const [copied, setCopied] = useState(false);

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
    const unsubscribe = window.secureErase.onCaptureProgress((event) => setProgress(event as CaptureProgressEvent));
    return unsubscribe;
  }, []);

  const target = devices?.find((device) => device.device === selected);

  function selectDevice(device: BlockDevice) {
    setSelected(device.device);
    setImagePath(undefined);
    setResult(undefined);
    setRunError(undefined);
    setPhase('idle');
    setProgress(undefined);
    // Default large drives to a fast leading capture; small ones to the whole device.
    setScope(device.sizeBytes > 8 * GiB ? '2gb' : 'full');
  }

  async function chooseOutput() {
    const suggested = target ? `evidence-${target.model.replace(/[^a-z0-9]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.raw` : 'evidence.raw';
    try {
      const chosen = await window.secureErase.chooseCaptureOutput(suggested);
      if (chosen) { setImagePath(chosen); setResult(undefined); setPhase('idle'); }
    } catch (cause) {
      setRunError(cause instanceof Error ? cause.message : 'The output file could not be chosen.');
    }
  }

  async function capture() {
    if (!target || !imagePath) return;
    setPhase('running');
    setRunError(undefined);
    setResult(undefined);
    setProgress({ device: target.device, percent: 0, statusText: 'Starting…' });
    try {
      const outcome = await window.secureErase.captureImage(target.device, { imagePath, maxBytes: scopeBytes(scope) });
      setResult(outcome);
      setPhase('done');
    } catch (cause) {
      setRunError(cause instanceof Error ? cause.message : 'The capture could not be completed.');
      setPhase('error');
    }
  }

  async function copyPath() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.imagePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard may be unavailable; ignore */ }
  }

  const captureGiB = scopeBytes(scope);
  const plannedBytes = target ? (captureGiB === null ? target.sizeBytes : Math.min(target.sizeBytes, captureGiB)) : 0;
  const canCapture = Boolean(target) && Boolean(imagePath) && phase !== 'running';

  return (
    <ApplicationShell title="Capture evidence image">
      <div className="flash-erase">
        <Link to="/" className="back-link"><ArrowLeft aria-hidden="true" size={16} />Back to workspace</Link>

        <header className="page-heading">
          <div>
            <p className="eyebrow flash-erase__eyebrow">Read-only evidence imager</p>
            <h1>Capture a device to a .raw image</h1>
            <p className="page-heading__description">
              Clones a USB device to a <strong>read-only</strong> RAW image (<code>.raw</code>/<code>.dd</code>) — the evidence is never
              modified. Add the image to a recovery case to carve back deleted files. A SHA-256 of the image is recorded for chain of custody.
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
                onClick={() => selectDevice(device)}
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
          <section className="flash-erase__panel" aria-label="Capture options">
            <div className="flash-erase__method">
              <ShieldCheck aria-hidden="true" />
              <div>
                <strong>Read-only forensic image</strong>
                <p>The device is opened <strong>read-only</strong> — nothing is ever written to the evidence. The image is hashed (SHA-256) as it is written so it can be verified later.</p>
              </div>
            </div>

            <fieldset className="flash-erase__scope">
              <legend>How much to capture</legend>
              <label><input type="radio" name="scope" checked={scope === 'full'} onChange={() => setScope('full')} disabled={phase === 'running'} /> <span><strong>Entire device</strong> <small>{formatBytes(target.sizeBytes)} — exact clone, slower for large drives.</small></span></label>
              <label><input type="radio" name="scope" checked={scope === '2gb'} onChange={() => setScope('2gb')} disabled={phase === 'running'} /> <span><strong>First 2 GB</strong> <small>Fast — for a prepared demo drive where the files sit at the start.</small></span></label>
              <label><input type="radio" name="scope" checked={scope === '4gb'} onChange={() => setScope('4gb')} disabled={phase === 'running'} /> <span><strong>First 4 GB</strong> <small>A larger leading slice.</small></span></label>
            </fieldset>

            <div className="flash-erase__output">
              <button type="button" className="button button--secondary" onClick={() => void chooseOutput()} disabled={phase === 'running'}>Choose output file…</button>
              {imagePath ? <code className="flash-erase__path">{imagePath}</code> : <small>Pick a <code>.raw</code> file on a different drive than the one you are imaging.</small>}
            </div>

            {elevated === false ? (
              <p className="flash-erase__warn"><ShieldAlert aria-hidden="true" /> Imaging a physical device needs administrator rights. If it fails with “access denied”, close the app and relaunch it as Administrator.</p>
            ) : null}

            <div className="flash-erase__actions">
              <button type="button" className="button button--primary" disabled={!canCapture} onClick={() => void capture()}>
                <HardDriveDownload aria-hidden="true" />
                {phase === 'running' ? 'Capturing…' : `Capture ${formatBytes(plannedBytes)} image`}
              </button>
            </div>

            {phase === 'running' || phase === 'done' ? (
              <div className="flash-erase__progress">
                <div className={`job-progress__bar${phase === 'running' ? ' job-progress__bar--running' : ''}`} role="progressbar" aria-label="Capture progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress?.percent ?? 0)}>
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
                  <strong>Image captured{result.truncated ? ' (leading portion)' : ''} — {formatBytes(result.bytesCaptured)}</strong>
                  <small>SHA-256: <code className="flash-erase__path">{result.sha256}</code></small>
                  <small>
                    Saved to: <code className="flash-erase__path">{result.imagePath}</code>
                    <button type="button" className="button button--ghost button--small" onClick={() => void copyPath()} style={{ marginLeft: 8 }}>
                      {copied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}{copied ? 'Copied' : 'Copy path'}
                    </button>
                  </small>
                  <small style={{ marginTop: 6 }}>
                    Next: <Link to="/cases/new?source=disk-image">create a recovery case → Analyze a disk image</Link>, paste this path as the disk-image source, and recover the deleted files.
                  </small>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </ApplicationShell>
  );
}
