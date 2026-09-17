import { useState } from 'react';
import { BadgeCheck, Download, FileBadge, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { CertificateRecord, SignedCertificate } from '../../../main/certificate.js';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

const FIELD_LABELS: Array<[keyof CertificateRecord, string]> = [
  ['operator', 'Operator'], ['organization', 'Organization'], ['caseReference', 'Reference'],
  ['model', 'Device model'], ['device', 'Device path'], ['serial', 'Serial'],
  ['method', 'Method'], ['assurance', 'Assurance'], ['standard', 'Standard'],
  ['details', 'Details'], ['completedAt', 'Completed at'],
];

function certificateHtml(cert: SignedCertificate): string {
  const rows = FIELD_LABELS
    .filter(([key]) => cert.record[key])
    .map(([key, label]) => `<tr><th>${label}</th><td>${escapeHtml(String(cert.record[key]))}</td></tr>`)
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SHUNYA Certificate ${cert.certificateId}</title>
<style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;background:#f4f2ee;color:#1a1a1a;margin:0;padding:40px}
.cert{max-width:760px;margin:0 auto;background:#fff;border:1px solid #e2ded7;border-radius:14px;padding:40px;box-shadow:0 10px 40px rgba(0,0,0,.08)}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.06em;font-size:20px;color:#f56600}
h1{font-size:26px;margin:14px 0 4px}.sub{color:#666;margin:0 0 22px;font-size:13px}
table{width:100%;border-collapse:collapse;margin:8px 0 22px}th,td{text-align:left;padding:9px 12px;font-size:13px;border-bottom:1px solid #efece7}
th{width:170px;color:#666;font-weight:600}
.sig{background:#faf8f5;border:1px solid #e9e5df;border-radius:10px;padding:16px;font-size:12px}
.sig strong{display:block;margin:10px 0 3px;color:#333}.sig code{word-break:break-all;font-family:ui-monospace,Consolas,monospace;color:#111}
.seal{display:inline-flex;align-items:center;gap:8px;background:#eafaf0;color:#1a7f4b;border:1px solid #b9e6cd;border-radius:999px;padding:6px 14px;font-weight:700;font-size:12px;margin-bottom:8px}
.note{color:#666;font-size:11px;line-height:1.6;margin-top:16px}</style></head>
<body><div class="cert">
<div class="brand">◆ SHUNYA</div>
<div class="seal">✓ Cryptographically signed · tamper‑evident</div>
<h1>Certificate of ${cert.record.kind === 'sanitization' ? 'Secure Sanitization' : 'Data Recovery'}</h1>
<p class="sub">${escapeHtml(cert.record.title)} &middot; Certificate ID <b>${cert.certificateId}</b> &middot; Issued ${new Date(cert.issuedAt).toLocaleString()}</p>
<table>${rows}</table>
<div class="sig">
<strong>Algorithm</strong><code>Ed25519</code>
<strong>Signature (base64)</strong><code>${cert.signature}</code>
<strong>Public‑key fingerprint (trust anchor)</strong><code>${cert.publicKeyFingerprint}</code>
<strong>Payload SHA‑256</strong><code>${cert.payloadSha256}</code>
</div>
<p class="note">This certificate is signed with an Ed25519 key. <b>Any change to any field invalidates the signature.</b> A verifier confirms authenticity by checking the signature against a public key whose fingerprint equals the value above. Embedded record for re‑verification:</p>
<script type="application/json" id="shunya-certificate">${escapeHtml(JSON.stringify(cert))}</script>
</div></body></html>`;
}

export function CertificatePanel({ record }: { record: CertificateRecord }) {
  const [cert, setCert] = useState<SignedCertificate>();
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; reason?: string }>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [savedPath, setSavedPath] = useState<string>();

  async function generate() {
    setBusy('generate'); setError(undefined); setVerifyResult(undefined); setSavedPath(undefined);
    try { setCert(await window.certificates.generate(record)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not generate the certificate.'); }
    finally { setBusy(undefined); }
  }
  async function doVerify() {
    if (!cert) return;
    setBusy('verify');
    try { setVerifyResult(await window.certificates.verify(cert)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Verification failed.'); }
    finally { setBusy(undefined); }
  }
  async function save() {
    if (!cert) return;
    setBusy('save'); setError(undefined);
    try {
      const path = await window.certificates.save(`SHUNYA-Certificate-${cert.certificateId}.html`, certificateHtml(cert));
      if (path) setSavedPath(path);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the certificate.'); }
    finally { setBusy(undefined); }
  }

  return <section className="certificate" aria-label="Tamper-evident certificate">
    <header className="certificate__head"><FileBadge aria-hidden="true" /><div><strong>Tamper‑evident certificate</strong><small>Ed25519‑signed proof of this operation — any edit breaks the signature.</small></div></header>
    {!cert ? (
      <button className="button button--primary" type="button" disabled={busy === 'generate'} onClick={() => void generate()}>
        <BadgeCheck aria-hidden="true" />{busy === 'generate' ? 'Signing…' : 'Generate signed certificate'}
      </button>
    ) : (
      <div className="certificate__body">
        <dl className="certificate__facts">
          <div><dt>Certificate ID</dt><dd>{cert.certificateId}</dd></div>
          <div><dt>Issued</dt><dd>{new Date(cert.issuedAt).toLocaleString()}</dd></div>
          <div><dt>Algorithm</dt><dd>Ed25519</dd></div>
          <div><dt>Key fingerprint</dt><dd className="certificate__mono">{cert.publicKeyFingerprint}</dd></div>
          <div className="certificate__wide"><dt>Signature</dt><dd className="certificate__mono">{cert.signature}</dd></div>
        </dl>
        <div className="certificate__actions">
          <button className="button button--secondary" type="button" disabled={busy === 'verify'} onClick={() => void doVerify()}><ShieldCheck aria-hidden="true" />{busy === 'verify' ? 'Verifying…' : 'Verify certificate'}</button>
          <button className="button button--secondary" type="button" disabled={busy === 'save'} onClick={() => void save()}><Download aria-hidden="true" />{busy === 'save' ? 'Saving…' : 'Save certificate (.html)'}</button>
        </div>
        {verifyResult ? (
          verifyResult.valid
            ? <p className="certificate__verdict certificate__verdict--ok"><ShieldCheck aria-hidden="true" /> Authentic — signature valid and untampered.</p>
            : <p className="certificate__verdict certificate__verdict--bad"><ShieldAlert aria-hidden="true" /> {verifyResult.reason ?? 'Verification failed.'}</p>
        ) : null}
        {savedPath ? <p className="certificate__saved">Saved to <code>{savedPath}</code> — open it in a browser and print to PDF.</p> : null}
      </div>
    )}
    {error ? <p role="alert" className="form-error">{error}</p> : null}
  </section>;
}
