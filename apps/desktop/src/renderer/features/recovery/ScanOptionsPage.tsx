import { Link } from 'react-router-dom';
import { FileFamilySelector } from './FileFamilySelector.js';

const presets = [
  ['Quick Scan — Recommended first', 'Looks for deleted file records. Fastest. Best chance of original names.'],
  ['Full Scan', 'Includes Quick Scan and searches remaining disk space by file content. Takes longer and may produce files without original names.'],
  ['Advanced', 'Choose partitions, file types, ranges, and forensic engines. For trained examiners.'],
] as const;

export function ScanOptionsPage() {
  return <section><header><p className="eyebrow">Recovery setup</p><h1>Choose scan options</h1></header><div className="start-grid">{presets.map(([title, description]) => <article className="start-card" key={title}><strong>{title}</strong><span>{description}</span><Link to="../recovery/partitions">Use this preset</Link></article>)}</div><FileFamilySelector /></section>;
}
