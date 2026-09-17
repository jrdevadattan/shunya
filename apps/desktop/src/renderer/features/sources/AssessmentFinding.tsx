import type { CapabilityFinding } from '@recovery/contracts';
import { CapabilityBanner, InfoPopover } from '@recovery/ui';

export function AssessmentFinding({ finding }: { finding: CapabilityFinding }) {
  const level = finding.level === 'supported' ? 'success' : finding.level === 'unsupported' || finding.level === 'requires_unlock' ? 'danger' : 'warning';
  return <div className="assessment-finding">
    <CapabilityBanner level={level} title={finding.title} explanation={finding.explanation} action={finding.recommendedAction ? <p><strong>Recommended action:</strong> {finding.recommendedAction}</p> : undefined} />
    <InfoPopover title="Why am I seeing this?">{finding.explanation}</InfoPopover>
    <details><summary>Technical details</summary><code>{finding.code}</code></details>
  </div>;
}
