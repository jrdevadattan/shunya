import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { SourceDescriptor } from '@recovery/contracts';
import { addImageSource } from './source-store.js';
import { SourceCard } from './SourceCard.js';
import { rememberSource } from '../../application-state.js';
import { BrainCircuit, HardDrive, Image } from 'lucide-react';
import { CapabilityBanner } from '@recovery/ui';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';

const sourceTypes = [
  { title: 'Physical device', description: 'Discover connected disks without mounting or reading their content.', icon: HardDrive },
  { title: 'Disk image', description: 'Add a RAW, IMG, DD, or complete numbered split image.', icon: Image },
  { title: 'Memory image', description: 'Add a supported volatile-memory capture for a separate analysis workflow.', icon: BrainCircuit },
];

export function AddSourcePage() {
  const { caseId = '' } = useParams();
  const navigate = useNavigate();
  const [source, setSource] = useState<SourceDescriptor>();
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      const path = String(new FormData(event.currentTarget).get('imagePath') ?? '');
      const added = await addImageSource(path);
      setSource(added);
      rememberSource(caseId, added.sourceId);
      await navigate(`/cases/${caseId}/sources/${added.sourceId}/assessment`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The image could not be added.');
    }
  }

  return <WorkflowFrame
    eyebrow="Recovery source"
    title="Add source"
    description="Select the device or image to analyze. The source is never used as a destination."
    steps={[{ id: 'source', label: 'Source', state: 'current' }, { id: 'assessment', label: 'Assessment', state: 'upcoming' }, { id: 'recovery', label: 'Recovery setup', state: 'upcoming' }]}
    aside={<CapabilityBanner level="info" title="Read-only source" explanation="Evidence is inventoried and assessed before a recovery job can start." />}
  >
    <div className="selection-grid">{sourceTypes.map((type) => <article className="selection-card" key={type.title}><span aria-hidden="true"><type.icon /></span><strong>{type.title}</strong><p>{type.description}</p></article>)}</div>
    <form className="workflow-form" onSubmit={submit}><label>Disk image path<input name="imagePath" placeholder="C:\evidence\disk.raw" required /></label><button className="button button--primary" type="submit">Add image source</button></form>
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {source ? <SourceCard source={source} /> : null}
  </WorkflowFrame>;
}
