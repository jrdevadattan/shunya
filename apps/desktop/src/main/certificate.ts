import { createHash, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

/** Facts a certificate attests. Kept flat and stable so signing + verifying
 * agree byte‑for‑byte. */
export interface CertificateRecord {
  kind: 'sanitization' | 'recovery';
  title: string;
  operator?: string;
  organization?: string;
  caseReference?: string;
  device?: string;
  model?: string;
  serial?: string;
  method?: string;
  assurance?: string;
  standard?: string;
  details?: string;
  completedAt: string;
}

export interface SignedCertificate {
  certificateId: string;
  issuedAt: string;
  algorithm: 'ed25519';
  record: CertificateRecord;
  payloadSha256: string;
  signature: string; // base64 Ed25519 signature over the canonical payload
  publicKey: string; // base64 SPKI public key (the trust anchor)
  publicKeyFingerprint: string; // sha256(publicKey) truncated — publish this out of band
}

async function keyDir(): Promise<string> {
  const dir = path.join(app.getPath('userData'), 'certificates', 'keys');
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Loads a persistent Ed25519 signing identity, creating it on first use.
 * The public key fingerprint is the trust anchor — a verifier trusts a
 * certificate only if this fingerprint matches the published one. */
async function loadOrCreateKeys(): Promise<{ privateKeyPem: string; publicKeyDer: Buffer }> {
  const dir = await keyDir();
  const privPath = path.join(dir, 'signing-ed25519.pem');
  const pubPath = path.join(dir, 'signing-ed25519.spki.der');
  try {
    return { privateKeyPem: await readFile(privPath, 'utf8'), publicKeyDer: await readFile(pubPath) };
  } catch {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
    await writeFile(privPath, privateKeyPem, { mode: 0o600 });
    await writeFile(pubPath, publicKeyDer);
    return { privateKeyPem, publicKeyDer };
  }
}

function sortRecord(record: CertificateRecord): Record<string, unknown> {
  const flat = record as unknown as Record<string, unknown>;
  return Object.fromEntries(Object.keys(flat).sort().map((key) => [key, flat[key]]));
}

function canonicalPayload(record: CertificateRecord, issuedAt: string, certificateId: string): Buffer {
  return Buffer.from(JSON.stringify({ certificateId, issuedAt, record: sortRecord(record) }), 'utf8');
}

export async function generateCertificate(record: CertificateRecord): Promise<SignedCertificate> {
  const { privateKeyPem, publicKeyDer } = await loadOrCreateKeys();
  const issuedAt = new Date().toISOString();
  const certificateId = createHash('sha256')
    .update(`${record.completedAt}|${record.device ?? record.caseReference ?? ''}|${issuedAt}`)
    .digest('hex').slice(0, 24).toUpperCase();
  const payload = canonicalPayload(record, issuedAt, certificateId);
  const signature = sign(null, payload, privateKeyPem);
  return {
    certificateId,
    issuedAt,
    algorithm: 'ed25519',
    record,
    payloadSha256: createHash('sha256').update(payload).digest('hex'),
    signature: signature.toString('base64'),
    publicKey: publicKeyDer.toString('base64'),
    publicKeyFingerprint: createHash('sha256').update(publicKeyDer).digest('hex').slice(0, 32).toUpperCase(),
  };
}

export function verifyCertificate(cert: SignedCertificate): { valid: boolean; reason?: string } {
  try {
    const payload = canonicalPayload(cert.record, cert.issuedAt, cert.certificateId);
    const publicKeyDer = Buffer.from(cert.publicKey, 'base64');
    const keyObject = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
    if (!verify(null, payload, keyObject, Buffer.from(cert.signature, 'base64'))) {
      return { valid: false, reason: 'Signature does not match — the certificate has been altered.' };
    }
    const fingerprint = createHash('sha256').update(publicKeyDer).digest('hex').slice(0, 32).toUpperCase();
    if (fingerprint !== cert.publicKeyFingerprint) {
      return { valid: false, reason: 'Public‑key fingerprint mismatch — signed by an untrusted key.' };
    }
    if (createHash('sha256').update(payload).digest('hex') !== cert.payloadSha256) {
      return { valid: false, reason: 'Payload hash mismatch — the record was modified.' };
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : 'verification failed' };
  }
}
