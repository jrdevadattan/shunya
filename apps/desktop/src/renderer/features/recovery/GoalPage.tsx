import type { RecoveryGoal } from '@recovery/contracts';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Cpu, Files, LocateFixed, ScanSearch, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';

const goals = [
  ['Recently deleted files', 'Best when files were deleted recently and the filesystem records may remain.', 'recently_deleted', Trash2],
  ['Find a specific file or folder', 'Narrow recovery by name, former path, type, size, date, or a known hash.', 'specific_target', LocateFixed],
  ['Recover everything', 'Search file records first, then remaining disk space by content signature.', 'recover_everything', Files],
  ['Lost or damaged partition', 'Look for missing partition structures and intact filesystems without writing a partition table.', 'partition_loss', ScanSearch],
  ['Damaged or failing device', 'Create a resumable image before repeated analysis.', 'damaged_device', ShieldAlert],
  ['Memory analysis', 'Analyze a supported volatile-memory image in a separate workflow.', 'memory_analysis', Cpu],
] as const;

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
    actions={<button className="button button--primary button--icon" type="button" disabled={!selected} onClick={() => void navigate(nextRoute(caseId, selected))}>Continue to scan options<ArrowRight aria-hidden="true" /></button>}
  >
    <div className="goal-selection" role="group" aria-label="Choose your recovery goal">{goals.map(([title, description, goal, Icon]) => <button className="goal-card" key={title} type="button" aria-pressed={selected === goal} onClick={() => choose(goal satisfies RecoveryGoal)}><span aria-hidden="true"><Icon /></span><span><strong>{title}</strong><small>{description}</small></span><i aria-hidden="true" /></button>)}</div>
    <p className="workflow-note">A surviving file record may restore the original name and folder. Content-only recovery may not preserve either.</p>
  </WorkflowFrame>;
}

function nextRoute(caseId: string, goal: RecoveryGoal | null): string {
  if (goal === 'memory_analysis') return `/cases/${caseId}/memory`;
  if (goal === 'damaged_device') return `/cases/${caseId}/recovery/damaged`;
  return `/cases/${caseId}/recovery/scan-options`;
}
