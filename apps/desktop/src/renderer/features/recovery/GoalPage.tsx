import type { RecoveryGoal } from '@recovery/contracts';
import { Link, useParams } from 'react-router-dom';
import { Cpu, Files, LocateFixed, ScanSearch, ShieldAlert, Trash2 } from 'lucide-react';
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
  return <WorkflowFrame
    eyebrow="Recovery setup"
    title="What do you want to recover?"
    description="Choose the outcome that best matches the evidence and incident."
    steps={[{ id: 'source', label: 'Source', state: 'complete' }, { id: 'goal', label: 'Recovery goal', state: 'current' }, { id: 'scan', label: 'Scan options', state: 'upcoming' }]}
  >
    <div className="selection-grid selection-grid--goals">{goals.map(([title, description, goal, Icon]) => <Link className="selection-card selection-card--link" key={title} to={`/cases/${caseId}/recovery/scan-options`} onClick={() => sessionStorage.setItem(`recovery:${caseId}:goal`, goal satisfies RecoveryGoal)}><span aria-hidden="true"><Icon /></span><strong>{title}</strong><p>{description}</p></Link>)}</div>
    <p className="workflow-note">A surviving file record may restore the original name and folder. Content-only recovery may not preserve either.</p>
  </WorkflowFrame>;
}
