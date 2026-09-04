// Generates a REAL Ed25519-signed sample certificate (proof), using the exact
// canonical-payload + signing scheme the app uses, so the verifier page and the
// app agree. Outputs a viewable HTML certificate + the machine-readable JSON.
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../SIH_DEMO_KIT/assets');
mkdirSync(outDir, { recursive: true });

const record = {
  kind: 'sanitization',
  title: 'Secure sanitization of SanDisk Ultra',
  operator: 'Demo Operator',
  organization: 'Team SHUNYA',
  caseReference: 'SIH-26149-DEMO',
  device: '\\\\.\\PhysicalDrive1',
  model: 'SanDisk Ultra',
  serial: '4C530000080921116270',
  method: 'CSPRNG overwrite (AES-256-CTR keystream)',
  assurance: 'clear',
  standard: 'NIST SP 800-88 Rev. 2 · Clear',
  details: '28.64 GB removable device, single-pass overwrite',
  completedAt: new Date().toISOString(),
};

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });

const sortRecord = (r) => Object.fromEntries(Object.keys(r).sort().map((k) => [k, r[k]]));
const issuedAt = new Date().toISOString();
const certificateId = createHash('sha256').update(`${record.completedAt}|${record.device}|${issuedAt}`).digest('hex').slice(0, 24).toUpperCase();
const payload = Buffer.from(JSON.stringify({ certificateId, issuedAt, record: sortRecord(record) }), 'utf8');
const signature = sign(null, payload, privateKeyPem);

const cert = {
  certificateId,
  issuedAt,
  algorithm: 'ed25519',
  record,
  payloadSha256: createHash('sha256').update(payload).digest('hex'),
  signature: signature.toString('base64'),
  publicKey: publicKeyDer.toString('base64'),
  publicKeyFingerprint: createHash('sha256').update(publicKeyDer).digest('hex').slice(0, 32).toUpperCase(),
};

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FIELDS = [['operator', 'Operator'], ['organization', 'Organization'], ['caseReference', 'Reference'], ['model', 'Device model'], ['device', 'Device path'], ['serial', 'Serial'], ['method', 'Method'], ['assurance', 'Assurance'], ['standard', 'Standard'], ['details', 'Details'], ['completedAt', 'Completed at']];
const rows = FIELDS.filter(([k]) => cert.record[k]).map(([k, l]) => `<tr><th>${l}</th><td>${esc(cert.record[k])}</td></tr>`).join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SHUNYA Certificate ${cert.certificateId}</title>
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
<div class="seal">✓ Cryptographically signed · tamper-evident</div>
<h1>Certificate of Secure Sanitization</h1>
<p class="sub">${esc(cert.record.title)} &middot; Certificate ID <b>${cert.certificateId}</b> &middot; Issued ${new Date(cert.issuedAt).toLocaleString()}</p>
<table>${rows}</table>
<div class="sig">
<strong>Algorithm</strong><code>Ed25519</code>
<strong>Signature (base64)</strong><code>${cert.signature}</code>
<strong>Public-key fingerprint (trust anchor)</strong><code>${cert.publicKeyFingerprint}</code>
<strong>Payload SHA-256</strong><code>${cert.payloadSha256}</code>
</div>
<p class="note">This certificate is signed with an Ed25519 key. <b>Any change to any field invalidates the signature.</b> Verify it at the SHUNYA verifier or with any Ed25519 tool. Embedded record for re-verification:</p>
<script type="application/json" id="shunya-certificate">${esc(JSON.stringify(cert))}</script>
</div></body></html>`;

writeFileSync(path.join(outDir, 'sample-certificate.html'), html);
writeFileSync(path.join(outDir, 'sample-certificate.json'), JSON.stringify(cert, null, 2));
console.log('Wrote sample-certificate.html and sample-certificate.json');
console.log('CERT_JSON_BEGIN');
console.log(JSON.stringify(cert));
console.log('CERT_JSON_END');
