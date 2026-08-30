import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { SourceDescriptor } from '@recovery/contracts';
import { addImageSource, listPhysicalSources } from './source-store.js';
import { SourceCard } from './SourceCard.js';
import { rememberSource } from '../../application-state.js';
import { FileImage, FolderOpen, LockKeyhole, RefreshCw } from 'lucide-react';
import { CapabilityBanner } from '@recovery/ui';
import { WorkflowFrame } from '../../components/WorkflowFrame.js';

export function AddSourcePage() {
  const { caseId = '' } = useParams();
  const navigate = useNavigate();
  const [sources, setSources] = useState<SourceDescriptor[]>([]);
  const [inventoryError, setInventoryError] = useState<string>();
  const [error, setError] = useState<string>();
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingImage, setAddingImage] = useState(false);
  const [selectingImage, setSelectingImage] = useState(false);
  const [imagePath, setImagePath] = useState('');
  const refreshingRef = useRef(false);
  const addingImageRef = useRef(false);
  const selectingImageRef = useRef(false);

  async function loadSources(showRefreshState = true) {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setInventoryLoading(true);
    if (showRefreshState) setRefreshing(true);
    try {
      setSources(await listPhysicalSources());
      setInventoryError(undefined);
    } catch (cause) {
      setInventoryError(cause instanceof Error ? cause.message : 'Source inventory could not be loaded.');
    } finally {
      refreshingRef.current = false;
      setInventoryLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void loadSources(false); }, []);

  async function chooseImage() {
    if (selectingImageRef.current) return;
    selectingImageRef.current = true;
    setSelectingImage(true);
    setError(undefined);
    try {
      const selected = await window.recoveryApi.chooseSourceImage();
      if (selected) setImagePath(selected);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The evidence image could not be selected.');
    } finally {
      selectingImageRef.current = false;
      setSelectingImage(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addingImageRef.current) return;
    addingImageRef.current = true;
    setError(undefined);
    setAddingImage(true);
    try {
      const added = await addImageSource(imagePath);
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
    <section className="source-image-picker" aria-labelledby="source-image-picker-title">
      <header><FileImage aria-hidden="true" /><div><h2 id="source-image-picker-title">Choose an evidence image</h2><p>Select a RAW, IMG, DD, E01-compatible, or authorized memory image. The path remains editable as a fallback.</p></div></header>
      <form className="workflow-form source-image-form" onSubmit={submit}>
        <label>Disk image path<input name="imagePath" value={imagePath} onChange={(event) => setImagePath(event.target.value)} placeholder="Choose an evidence image file" required disabled={addingImage || selectingImage} /></label>
        <button className="button button--secondary button--icon" type="button" onClick={() => void chooseImage()} disabled={addingImage || selectingImage}><FolderOpen aria-hidden="true" />{selectingImage ? 'Opening file picker…' : 'Choose image file'}</button>
        <button className="button button--primary button--icon" type="submit" disabled={addingImage || selectingImage}><FileImage aria-hidden="true" />{addingImage ? 'Adding image…' : 'Add image source'}</button>
      </form>
      {error ? <p role="alert" className="form-error">{error}</p> : null}
    </section>
    <section className="source-inventory" aria-labelledby="available-sources-title">
      <header><div><h2 id="available-sources-title">Available recovery sources</h2><p>Daemon-detected devices are shown for context. Use the image picker above for this recovery.</p></div><button className="button button--secondary button--icon" type="button" disabled={refreshing} onClick={() => void loadSources()}><RefreshCw aria-hidden="true" />{refreshing ? 'Refreshing…' : 'Refresh'}</button></header>
      {inventoryError ? <p role="alert" className="form-error">{inventoryError}</p> : null}
      <div className="source-inventory__list" aria-label="Available recovery sources">
        {sources.map((item) => <SourceCard key={item.sourceId} source={item} />)}
        {inventoryLoading && sources.length === 0 && !inventoryError ? <p className="empty-state" role="status">Loading available sources…</p> : null}
        {!inventoryLoading && sources.length === 0 && !inventoryError ? <p className="empty-state">No image sources have been added to this case.</p> : null}
      </div>
    </section>
  </WorkflowFrame>;
}
