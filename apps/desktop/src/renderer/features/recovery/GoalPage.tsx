import type { RecoveryGoal } from '@recovery/contracts';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Cpu, Files, LocateFixed, ScanSearch, ShieldAlert, ShieldCheck, Trash2, type LucideIcon } from 'lucide-react';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';

type GoalTone = 'recommended' | 'available' | 'unavailable' | 'separate';

interface GoalOption {
  title: string;
  description: string;
  goal: RecoveryGoal;
  Icon: LucideIcon;
  badge: string;
  tone: GoalTone;
}

// Ordered so the goals that actually run in this build come first. The two
// metadata-based goals require a metadata-recovery engine that is not part of
// this vertical slice, so they are shown for transparency but not selectable —
// this prevents the previous dead-end where the default goal produced no results.
const goals: GoalOption[] = [
  { title: 'Recover everything', description: 'Search file records first, then remaining disk space by content signature.', goal: 'recover_everything', Icon: Files, badge: 'Recommended', tone: 'recommended' },
  { title: 'Lost or damaged partition', description: 'Look for missing partition structures and intact filesystems without writing a partition table.', goal: 'partition_loss', Icon: ScanSearch, badge: 'Available', tone: 'available' },
  { title: 'Recently deleted files', description: 'Best when files were deleted recently and the filesystem records may remain.', goal: 'recently_deleted', Icon: Trash2, badge: 'Needs metadata engine — not in this build', tone: 'unavailable' },
  { title: 'Find a specific file or folder', description: 'Narrow recovery by name, former path, type, size, date, or a known hash.', goal: 'specific_target', Icon: LocateFixed, badge: 'Needs metadata engine — not in this build', tone: 'unavailable' },
  { title: 'Damaged or failing device', description: 'Create a resumable image before repeated analysis.', goal: 'damaged_device', Icon: ShieldAlert, badge: 'Separate workflow', tone: 'separate' },
  { title: 'Memory analysis', description: 'Analyze a supported volatile-memory image in a separate workflow.', goal: 'memory_analysis', Icon: Cpu, badge: 'Separate workflow', tone: 'separate' },
];

export function GoalPage() {
  const { caseId = '' } = useParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<RecoveryGoal | null>(() => sessionStorage.getItem(`recovery:${caseId}:goal`) as RecoveryGoal | null);

  function choose(goal: RecoveryGoal) {
    sessionStorage.setItem(`recovery:${caseId}:goal`, goal);
    setSelected(goal);
  }

  return <WorkflowFrame
    eyebrow="Recovery setup"
    title="What do you want to recover?"
    description="Choose the outcome that best matches the evidence. This changes the recovery strategy, never the source."
    steps={[{ id: 'source', label: 'Source', state: 'complete' }, { id: 'goal', label: 'Recovery goal', state: 'current' }, { id: 'scan', label: 'Scan options', state: 'upcoming' }]}
    aside={<div className="workflow-truth workflow-truth--safe"><ShieldCheck aria-hidden="true" /><span><strong>Source stays read-only</strong><small>Every goal uses recovery analysis only.</small></span></div>}
    actions={<button className="button button--primary button--icon" type="button" disabled={!selected} onClick={() => void navigate(nextRoute(caseId, selected))}>{nextActionLabel(selected)}<ArrowRight aria-hidden="true" /></button>}
  >
    <div className="goal-selection" role="group" aria-label="Choose your recovery goal">{goals.map(({ title, description, goal, Icon, badge, tone }) => {
      const disabled = tone === 'unavailable';
      return <button
        className="goal-card"
        key={title}
        type="button"
        data-tone={tone}
        aria-pressed={selected === goal}
        disabled={disabled}
        title={disabled ? 'This capability is not included in this build.' : undefined}
        onClick={() => choose(goal)}
      >
        <span aria-hidden="true"><Icon /></span>
        <span><strong>{title}</strong><small>{description}</small><span className="goal-card__badge" data-tone={tone}>{badge}</span></span>
        <i aria-hidden="true" />
      </button>;
    })}</div>
    <p className="workflow-note">A surviving file record may restore the original name and folder. Content-only recovery may not preserve either. This build recovers content by signature; the metadata-based goals need the metadata engine.</p>
  </WorkflowFrame>;
}

function nextRoute(caseId: string, goal: RecoveryGoal | null): string {
  if (goal === 'memory_analysis') return `/cases/${caseId}/memory`;
  if (goal === 'damaged_device') return `/cases/${caseId}/recovery/damaged`;
  return `/cases/${caseId}/recovery/scan-options`;
}

function nextActionLabel(goal: RecoveryGoal | null): string {
  if (goal === 'memory_analysis') return 'Continue to memory analysis';
  if (goal === 'damaged_device') return 'Continue to damaged-device recovery';
  return 'Continue to scan options';
}
