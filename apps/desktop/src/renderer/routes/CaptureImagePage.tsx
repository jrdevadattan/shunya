import { useEffect, useState } from 'react';
import { PageHeader } from '@recovery/ui';
import { ArrowLeft, Check, Copy, HardDriveDownload, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BlockDevice, CaptureResult } from '../../main/secure-erase/types.js';
import { ApplicationShell } from './ApplicationShell.js';
import { DevicePicker, formatDeviceBytes } from '../features/devices/DevicePicker.js';
import { trackOperation, useOperationByKind } from '../features/operations/operations-store.js';

const GiB = 1024 ** 3;
type Scope = 'full' | '2gb' | '4gb';

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
  const [actionError, setActionError] = useState<string>();
  const [copied, setCopied] = useState(false);

  const latestCapture = useOperationByKind('capture');
  const op = latestCapture && latestCapture.device === selected ? latestCapture : undefined;
  const running = op?.status === 'running';
  const result = op?.status === 'done' ? (op.result as CaptureResult | undefined) : undefined;
  const runError = op?.status === 'error' ? op.error : actionError;

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
    if (!selected && latestCapture?.device) setSelected(latestCapture.device);
  }, [latestCapture, selected]);

  const target = devices?.find((device) => device.device === selected);

  function selectDevice(device: BlockDevice) {
    setSelected(device.device);
    setActionError(undefined);
    setCopied(false);
  }

  async function chooseOutput() {
    if (!target) return;
    setActionError(undefined);
    try {
      const suggested = `${target.model.replace(/[^A-Za-z0-9._-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.raw`;
      const chosen = await window.secureErase.chooseCaptureOutput(suggested);
      if (chosen) setImagePath(chosen);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'The output file could not be chosen.');
    }
  }

  const plannedBytes = target ? Math.min(target.sizeBytes, scopeBytes(scope) ?? target.sizeBytes) : 0;
  const canCapture = Boolean(target && imagePath) && !running;

  async function capture() {
    if (!target || !imagePath) return;
    setActionError(undefined);
    setCopied(false);
    try {
      await trackOperation(
        { id: `capture:${target.device}`, kind: 'capture', label: `Imaging ${target.model}`, route: '/capture-image', device: target.device },
        window.secureErase.captureImage(target.device, { imagePath, maxBytes: scopeBytes(scope) }),
      );
    } catch { /* surfaced through the store op */ }
  }

  async function copyPath() {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.imagePath); setCopied(true); } catch { setCopied(false); }
  }

  return (
    <ApplicationShell title="Make a disk image">
      <div className="page page--narrow">
        <Link to="/" className="back-link"><ArrowLeft aria-hidden="true" />Home</Link>
        <PageHeader
          eyebrow="Prepare"
          title="Make a disk image"
          description="Copies a USB drive into a read-only image file so you can recover from the copy and keep the original untouched. Nothing is ever written to the drive."
          actions={<button type="button" className="button button--secondary" onClick={() => void refresh()} disabled={running}><RefreshCw aria-hidden="true" />Rescan</button>}
        />

        {loadError ? <p role="alert" className="form-error">{loadError}</p> : null}
        <DevicePicker devices={devices} selected={selected} busy={running} onSelect={selectDevice} />

        {target ? (
          <section className="card stack stack--loose" aria-label="Capture options">
            <fieldset className="scope-options">
              <legend>How much to copy</legend>
              <label className="check check--boxed"><input type="radio" name="scope" checked={scope === 'full'} onChange={() => setScope('full')} disabled={running} /><span><strong>Entire drive</strong><small>{formatDeviceBytes(target.sizeBytes)} — an exact copy. Slower for large drives.</small></span></label>
              <label className="check check--boxed"><input type="radio" name="scope" checked={scope === '2gb'} onChange={() => setScope('2gb')} disabled={running} /><span><strong>First 2 GB</strong><small>Fast — for a prepared demo drive where the files sit at the start.</small></span></label>
              <label className="check check--boxed"><input type="radio" name="scope" checked={scope === '4gb'} onChange={() => setScope('4gb')} disabled={running} /><span><strong>First 4 GB</strong><small>A larger leading slice.</small></span></label>
            </fieldset>

            <div className="output-row">
              <button type="button" className="button button--secondary" onClick={() => void chooseOutput()} disabled={running}>Choose where to save…</button>
              {imagePath ? <code className="flash-erase__path">{imagePath}</code> : <small>Save the <code>.raw</code> file on a different drive than the one you are copying.</small>}
            </div>

            {elevated === false ? (
              <p className="flash-erase__warn"><ShieldAlert aria-hidden="true" /> Reading a physical drive needs administrator rights. If it fails with “access denied”, close the app and relaunch it as Administrator.</p>
            ) : null}

            <div className="flash-erase__actions">
              <button type="button" className="button button--primary button--large" disabled={!canCapture} onClick={() => void capture()}>
                <HardDriveDownload aria-hidden="true" />
                {running ? 'Copying…' : `Copy ${formatDeviceBytes(plannedBytes)} to image`}
              </button>
            </div>

            {running || op?.status === 'done' ? (
              <div className="flash-erase__progress">
                <div className={`job-progress__bar${running ? ' job-progress__bar--running' : ''}`} role="progressbar" aria-label="Capture progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(op?.percent ?? 0)}>
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
                  <strong>Image saved{result.truncated ? ' (leading portion)' : ''} — {formatDeviceBytes(result.bytesCaptured)}</strong>
                  <small>SHA-256: <code className="flash-erase__path">{result.sha256}</code></small>
                  <small>
                    Saved to: <code className="flash-erase__path">{result.imagePath}</code>
                    <button type="button" className="button button--ghost button--small" onClick={() => void copyPath()} style={{ marginLeft: 8 }}>
                      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? 'Copied' : 'Copy path'}
                    </button>
                  </small>
                  <small style={{ marginTop: 6 }}>
                    Next: <Link to="/cases/new?source=disk-image">start a recovery from this image</Link>.
                  </small>
                </div>
              </div>
            ) : null}
            <p className="note"><ShieldCheck aria-hidden="true" />The drive is opened read-only and the image is hashed (SHA-256) as it is written, so it can be verified later.</p>
          </section>
        ) : null}
      </div>
    </ApplicationShell>
  );
}
