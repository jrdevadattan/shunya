import { useState, type FormEvent } from 'react';
import type { SourceDescriptor } from '@recovery/contracts';
import { addImageSource } from './source-store.js';
import { SourceCard } from './SourceCard.js';

const sourceTypes = [
  { title: 'Physical device', description: 'Discover connected disks without mounting or reading their content.' },
  { title: 'Disk image', description: 'Add a RAW, IMG, DD, or complete numbered split image.' },
  { title: 'Memory image', description: 'Add a supported volatile-memory capture for a separate analysis workflow.' },
];

export function AddSourcePage() {
  const [source, setSource] = useState<SourceDescriptor>();
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      const path = String(new FormData(event.currentTarget).get('imagePath') ?? '');
      setSource(await addImageSource(path));
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
