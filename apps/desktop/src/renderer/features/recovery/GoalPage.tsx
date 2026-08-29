import { Link } from 'react-router-dom';

const goals = [
  ['Recently deleted files', 'Best when files were deleted recently and the filesystem records may remain.'],
  ['Find a specific file or folder', 'Narrow recovery by name, former path, type, size, date, or a known hash.'],
  ['Recover everything', 'Search file records first, then remaining disk space by content signature.'],
  ['Lost or damaged partition', 'Look for missing partition structures and intact filesystems without writing a partition table.'],
  ['Damaged or failing device', 'Create a resumable image before repeated analysis.'],
  ['Memory analysis', 'Analyze a supported volatile-memory image in a separate workflow.'],
] as const;

export function GoalPage() {
  return <section><header><p className="eyebrow">Recovery setup</p><h1>What do you want to recover?</h1></header><div className="start-grid">{goals.map(([title, description]) => <Link className="start-card" key={title} to="../recovery/scan-options"><strong>{title}</strong><span>{description}</span></Link>)}</div><p>A surviving file record may restore the original name and folder. If only file content remains, the platform may recover the file without its original name or location.</p></section>;
}
