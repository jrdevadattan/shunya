import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { SourceDescriptor } from '@recovery/contracts';
import { addImageSource } from './source-store.js';
import { SourceCard } from './SourceCard.js';
import { rememberSource } from '../../application-state.js';

const sourceTypes = [
  { title: 'Physical device', description: 'Discover connected disks without mounting or reading their content.' },
  { title: 'Disk image', description: 'Add a RAW, IMG, DD, or complete numbered split image.' },
  { title: 'Memory image', description: 'Add a supported volatile-memory capture for a separate analysis workflow.' },
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

  return <section className="sources-page">
    <header><p className="eyebrow">Recovery source</p><h1>Add source</h1><p>Select the device or image to analyze. The source is never used as a destination.</p></header>
    <div className="start-grid">{sourceTypes.map((type) => <article className="start-card" key={type.title}><strong>{type.title}</strong><span>{type.description}</span></article>)}</div>
    <form className="case-form" onSubmit={submit}><label>Disk image path<input name="imagePath" placeholder="C:\evidence\disk.raw" required /></label><button className="button button--primary" type="submit">Add image source</button></form>
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {source ? <SourceCard source={source} /> : null}
  </section>;
}
