import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { SourceDescriptor } from '@recovery/contracts';
import { addImageSource, listPhysicalSources } from './source-store.js';
import { SourceCard } from './SourceCard.js';
import { rememberSource } from '../../application-state.js';
import { BrainCircuit, FileImage, HardDrive, Image, LockKeyhole, RefreshCw } from 'lucide-react';
import { CapabilityBanner } from '@recovery/ui';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';

export function AddSourcePage() {
  const { caseId = '' } = useParams();
  const navigate = useNavigate();
  const [sources, setSources] = useState<SourceDescriptor[]>([]);
  const [inventoryError, setInventoryError] = useState<string>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [addingImage, setAddingImage] = useState(false);
  const refreshingRef = useRef(false);
  const addingImageRef = useRef(false);

  async function loadSources() {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      setSources(await listPhysicalSources());
      setInventoryError(undefined);
    } catch (cause) {
      setInventoryError(cause instanceof Error ? cause.message : 'Source inventory could not be loaded.');
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }

  useEffect(() => { void loadSources(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addingImageRef.current) return;
    addingImageRef.current = true;
    setError(undefined);
    setAddingImage(true);
    try {
      const path = String(new FormData(event.currentTarget).get('imagePath') ?? '');
      const added = await addImageSource(path);
      rememberSource(caseId, added.sourceId);
      await navigate(`/cases/${caseId}/sources/${added.sourceId}/assessment`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The image could not be added.');
    } finally {
      addingImageRef.current = false;
      setAddingImage(false);
    }
  }

  return <WorkflowFrame
    eyebrow="Recovery source"
    title="Select recovery source"
    description="Choose an image that contains the files to recover. Every supported source is opened read-only."
    steps={[{ id: 'source', label: 'Source', state: 'current' }, { id: 'assessment', label: 'Assessment', state: 'upcoming' }, { id: 'recovery', label: 'Recovery setup', state: 'upcoming' }]}
    aside={<><CapabilityBanner level="info" title="Read-only source" explanation="Evidence is inventoried and assessed before a recovery job can start." /><div className="workflow-truth"><LockKeyhole aria-hidden="true" /><span><strong>Source writes blocked</strong><small>No source-write API is exposed to this screen.</small></span></div></>}
  >
    <section className="source-inventory" aria-labelledby="available-sources-title">
      <header><div><h2 id="available-sources-title">Available recovery sources</h2><p>Only sources reported by the recovery daemon appear here.</p></div><button className="button button--secondary button--icon" type="button" disabled={refreshing} onClick={() => void loadSources()}><RefreshCw aria-hidden="true" />{refreshing ? 'Refreshing…' : 'Refresh'}</button></header>
      {inventoryError ? <p role="alert" className="form-error">{inventoryError}</p> : null}
      <div className="source-inventory__list" aria-label="Available recovery sources">
        {sources.map((item) => <SourceCard key={item.sourceId} source={item} />)}
        {sources.length === 0 && !inventoryError ? <p className="empty-state">No image sources have been added to this case.</p> : null}
      </div>
    </section>
    <div className="source-methods">
      <article className="source-method source-method--limited"><span aria-hidden="true"><HardDrive /></span><div><strong>Physical device</strong><p>Connected-device discovery needs a typed physical-source API that is not available in this build.</p></div><button className="button button--secondary" type="button" disabled title="Physical-device discovery is unavailable">Discover physical devices</button></article>
      <article className="source-method"><span aria-hidden="true"><Image /></span><div><strong>Disk or memory image</strong><p>Add a RAW, IMG, DD, E01-compatible, or authorized memory image path for daemon inspection.</p></div></article>
    </div>
    <p className="source-limitation"><BrainCircuit aria-hidden="true" />Physical-device discovery is unavailable because the typed desktop API exposes image sources only.</p>
    <form className="workflow-form source-image-form" onSubmit={submit}><label>Disk image path<input name="imagePath" placeholder="C:\evidence\disk.raw" required disabled={addingImage} /></label><button className="button button--primary button--icon" type="submit" disabled={addingImage}><FileImage aria-hidden="true" />{addingImage ? 'Adding image…' : 'Add image source'}</button></form>
    {error ? <p role="alert" className="form-error">{error}</p> : null}
  </WorkflowFrame>;
}
