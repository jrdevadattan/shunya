import type { CapabilityFinding } from '@recovery/contracts';
import { RuntimeModeBadge } from '@recovery/ui';
import { useSearchParams } from 'react-router-dom';
import { AssessmentFinding } from './AssessmentFinding.js';

const scenarios: Record<string, CapabilityFinding> = {
  ready: { code: 'SOURCE_READY', level: 'supported', title: 'Ready', explanation: 'This source can be analyzed safely in the current mode.', recommendedAction: 'Continue to choose a recovery goal.' },
  system: { code: 'ACTIVE_SYSTEM_DISK_REQUIRES_RESCUE', level: 'requires_rescue_mode', title: 'Rescue Mode recommended', explanation: 'This disk contains the running operating system. Normal activity can overwrite deleted data. Restart in Rescue Mode for the best recovery chance.', recommendedAction: 'Use Rescue Mode.' },
  failing: { code: 'FAILING_SOURCE', level: 'limited', title: 'Device failing', explanation: 'Read errors or health warnings were detected. Repeated scanning may worsen the device. Create a resumable image in Rescue Mode before recovery.', recommendedAction: 'Start damaged-device workflow.' },
  locked: { code: 'SOURCE_LOCKED', level: 'requires_unlock', title: 'Encrypted and locked', explanation: 'The source is encrypted. Provide an authorized recovery key or unlock it through the operating system before analysis. The platform does not crack passwords.', recommendedAction: 'Refresh after unlock.' },
  unsupported: { code: 'UNSUPPORTED_SOURCE', level: 'unsupported', title: 'Source unsupported', explanation: 'This source cannot be analyzed by the installed recovery engines.', recommendedAction: 'Create a supported RAW image or choose another source.' },
};

export function SourceAssessmentPage() {
  const [search] = useSearchParams();
  const finding = scenarios[search.get('state') ?? 'ready'] ?? scenarios.ready!;
  return <section className="assessment-page"><header><p className="eyebrow">Source assessment</p><h1>Source safety assessment</h1><div className="assessment-meta"><span>Read-only analysis</span><RuntimeModeBadge mode="installed" /></div></header><AssessmentFinding finding={finding} /></section>;
}
