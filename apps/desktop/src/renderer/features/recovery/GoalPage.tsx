import type { RecoveryGoal } from '@recovery/contracts';
import { Link, useParams } from 'react-router-dom';

const goals = [
  ['Recently deleted files', 'Best when files were deleted recently and the filesystem records may remain.', 'recently_deleted'],
  ['Find a specific file or folder', 'Narrow recovery by name, former path, type, size, date, or a known hash.', 'specific_target'],
  ['Recover everything', 'Search file records first, then remaining disk space by content signature.', 'recover_everything'],
  ['Lost or damaged partition', 'Look for missing partition structures and intact filesystems without writing a partition table.', 'partition_loss'],
  ['Damaged or failing device', 'Create a resumable image before repeated analysis.', 'damaged_device'],
  ['Memory analysis', 'Analyze a supported volatile-memory image in a separate workflow.', 'memory_analysis'],
] as const;

export function GoalPage() {
  const { caseId = '' } = useParams();
  return <section><header><p className="eyebrow">Recovery setup</p><h1>What do you want to recover?</h1></header><div className="start-grid">{goals.map(([title, description, goal]) => <Link className="start-card" key={title} to={`/cases/${caseId}/recovery/scan-options`} onClick={() => sessionStorage.setItem(`recovery:${caseId}:goal`, goal satisfies RecoveryGoal)}><strong>{title}</strong><span>{description}</span></Link>)}</div><p>A surviving file record may restore the original name and folder. If only file content remains, the platform may recover the file without its original name or location.</p></section>;
}
