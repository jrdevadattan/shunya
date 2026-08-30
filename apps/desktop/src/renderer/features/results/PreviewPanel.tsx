import type { PreviewDescriptor, RecoveryArtifact } from '@recovery/contracts';
import { FileCheck2, LockKeyhole, ShieldAlert, ShieldCheck } from 'lucide-react';
import { CapabilityBanner } from '@recovery/ui';
import { decidePreview } from './preview-policy.js';

export function PreviewPanel({ artifact, preview, error }: { artifact: RecoveryArtifact; preview?: PreviewDescriptor; error?: string }) {
  const localDecision = decidePreview({ mimeType: artifact.mimeType, validation: artifact.recoveryState, threat: artifact.threatStatus });
  if (localDecision.kind === 'blocked') return <section className="preview-panel preview-panel--blocked" aria-label="Protected preview policy"><header><ShieldAlert aria-hidden="true" /><span><strong>Protected preview blocked</strong><small>Active content is never rendered or launched from recovery results.</small></span></header><p>{previewRefusal(localDecision.reason)}</p>{preview?.status === 'unsupported' ? <p>Preview derivative is unavailable under daemon policy <code>{preview.policy}</code>.</p> : null}</section>;
  if (error) return <div className="preview-panel"><CapabilityBanner level="warning" title="Preview unavailable" explanation={error} /></div>;
  if (!preview) return <div className="preview-panel"><p role="status">Checking protected preview policy…</p></div>;
  if (preview.status === 'blocked') return <div className="preview-panel"><CapabilityBanner level="danger" title={artifact.threatStatus === 'potential_threat' ? 'Potentially unsafe content detected' : 'Preview blocked'} explanation="The daemon refused this preview. Review metadata or use an authorized controlled analysis environment after export." /><code>{preview.policy}</code></div>;
  if (preview.status === 'unsupported' || !preview.derivativePath) return <section className="preview-panel preview-panel--metadata" aria-label="Protected preview"><header><LockKeyhole aria-hidden="true" /><span><strong>Protected preview</strong><small>The recovered original is never embedded.</small></span></header><p>The daemon did not provide a sanitized derivative. Metadata and recovery evidence remain available.</p><code>{preview.policy}</code></section>;
  return <section className="preview-panel preview-panel--ready" aria-label="Protected preview"><header><ShieldCheck aria-hidden="true" /><span><strong>Sanitized derivative ready</strong><small>Protected preview · active content disabled</small></span></header><div><FileCheck2 aria-hidden="true" /><p>A daemon-produced derivative is ready for a supported protected viewer. The original recovered file is not launched.</p></div></section>;
}

function previewRefusal(reason: 'active_content' | 'potential_threat' | 'corrupt' | 'scan_incomplete'): string { return ({ active_content: 'This file type can contain active content, so only metadata and recovery evidence are shown.', potential_threat: 'A threat rule matched this artifact. Preview remains blocked; the match is not a final malware verdict.', corrupt: 'Corrupt content is not decoded in the protected viewer.', scan_incomplete: 'Preview remains blocked until the threat check completes successfully.' } as const)[reason]; }
