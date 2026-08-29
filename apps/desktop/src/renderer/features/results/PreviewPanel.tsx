import type { PreviewDescriptor, RecoveryArtifact } from '@recovery/contracts';
import { CapabilityBanner } from '@recovery/ui';

export function PreviewPanel({ artifact, preview, error }: { artifact: RecoveryArtifact; preview?: PreviewDescriptor; error?: string }) {
  if (error) return <div className="preview-panel"><CapabilityBanner level="warning" title="Preview unavailable" explanation={error} /></div>;
  if (!preview) return <div className="preview-panel"><p role="status">Checking preview policy…</p></div>;
  if (preview.status === 'blocked') {
    const threat = artifact.threatStatus === 'potential_threat';
    return <div className="preview-panel"><CapabilityBanner level="danger" title={threat ? 'Potentially unsafe content detected' : 'Preview blocked'} explanation={threat ? 'Preview is blocked. The match identifies a rule pattern; it is not a final malware verdict.' : 'The daemon blocked this content. Review metadata or export it to a controlled analysis environment.'} /><code>{preview.policy}</code></div>;
  }
  if (preview.status === 'unsupported' || !preview.derivativePath) return <div className="preview-panel"><CapabilityBanner level="warning" title="Preview derivative is unavailable" explanation="The daemon did not provide an evidenced sanitized derivative. The original recovered file is not embedded." /><code>{preview.policy}</code></div>;
  return <div className="preview-panel"><nav aria-label="Artifact detail tabs"><button type="button">Preview</button><button type="button">Metadata</button><button type="button">Recovery evidence</button><button type="button">Threat check</button><button type="button">Hex</button></nav><p>A daemon-produced sanitized derivative is available.</p></div>;
}
