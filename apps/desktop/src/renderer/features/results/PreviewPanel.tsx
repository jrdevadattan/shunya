import type { RecoveryArtifact } from '@recovery/contracts';
import { CapabilityBanner } from '@recovery/ui';
import { decidePreview } from './preview-policy.js';

export function PreviewPanel({ artifact }: { artifact: RecoveryArtifact }) {
  const decision = decidePreview({ mimeType: artifact.mimeType, validation: artifact.recoveryState, threat: artifact.threatStatus });
  if (decision.kind === 'blocked') {
    const threat = decision.reason === 'potential_threat';
    return <div className="preview-panel"><CapabilityBanner level="danger" title={threat ? 'Potentially unsafe content detected' : 'Preview blocked'} explanation={threat ? 'Preview is blocked. The match identifies a rule pattern; it is not a final malware verdict.' : 'This file contains active executable content or has not completed safety checks. Review metadata or export it to a controlled analysis environment.'} /></div>;
  }
  return <div className="preview-panel"><nav aria-label="Artifact detail tabs"><button type="button">Preview</button><button type="button">Metadata</button><button type="button">Recovery evidence</button><button type="button">Threat check</button><button type="button">Hex</button></nav><p>{decision.kind === 'sanitized_image' ? 'A re-encoded image derivative is shown here; the original recovered file is never embedded.' : 'A bounded sanitized preview is available.'}</p></div>;
}
