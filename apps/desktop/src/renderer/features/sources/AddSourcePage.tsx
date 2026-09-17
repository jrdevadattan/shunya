import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { SourceDescriptor } from '@recovery/contracts';
import { AdvancedSection } from '@recovery/ui';
import { addImageSource, listPhysicalSources } from './source-store.js';
import { SourceCard } from './SourceCard.js';
import { rememberSource } from '../../application-state.js';
import { ArrowRight, FileImage, FolderOpen, HardDrive, LockKeyhole, RefreshCw } from 'lucide-react';
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
      await navigate(`/cases/${caseId}/recovery/setup`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The image could not be added.');
    } finally {
      addingImageRef.current = false;
      setAddingImage(false);
    }
  }

  return <WorkflowFrame
    eyebrow="Recover · step 2 of 3"
    title="Choose what to recover from"
    description="Pick the image file of the drive you want to recover from. It is only ever read, never changed."
    steps={[{ id: 'source', label: 'Source', state: 'current' }, { id: 'setup', label: 'Set up', state: 'upcoming' }, { id: 'recovery', label: 'Recover', state: 'upcoming' }]}
    aside={<div className="workflow-truth workflow-truth--safe"><LockKeyhole aria-hidden="true" /><span><strong>Read-only</strong><small>Nothing on this screen can write to the drive or image.</small></span></div>}
  >
    <section className="source-picker" aria-labelledby="source-image-picker-title">
      <header><FileImage aria-hidden="true" /><div><h2 id="source-image-picker-title">Disk image file</h2><p>RAW, IMG, DD or E01. Don't have one yet? <Link to="/capture-image">Make one from a USB drive</Link> first.</p></div></header>
      <form className="source-picker__form" onSubmit={submit}>
        <label className="field"><span>Image file</span><input name="imagePath" value={imagePath} onChange={(event) => setImagePath(event.target.value)} placeholder="Choose an evidence image file" required disabled={addingImage || selectingImage} /></label>
        <button className="button button--secondary" type="button" onClick={() => void chooseImage()} disabled={addingImage || selectingImage}><FolderOpen aria-hidden="true" />{selectingImage ? 'Opening…' : 'Choose image file'}</button>
        <button className="button button--primary" type="submit" disabled={addingImage || selectingImage}>{addingImage ? 'Checking image…' : 'Continue'}<ArrowRight aria-hidden="true" /></button>
      </form>
      {error ? <p role="alert" className="form-error">{error}</p> : null}
    </section>

    <AdvancedSection title="Drives detected on this computer" summary="For reference only — recovery in this version works from image files" icon={HardDrive} quiet>
      <div className="button-row button-row--between">
        <p className="form-hint" id="available-sources-title">Physical drives found by the recovery service.</p>
        <button className="button button--ghost button--small" type="button" disabled={refreshing} onClick={() => void loadSources()}><RefreshCw aria-hidden="true" />{refreshing ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      {inventoryError ? <p role="alert" className="form-error">{inventoryError}</p> : null}
      <div className="source-inventory" aria-label="Available recovery sources">
        {sources.map((item) => <SourceCard key={item.sourceId} source={item} />)}
        {inventoryLoading && sources.length === 0 && !inventoryError ? <p className="empty-state" role="status">Looking for drives…</p> : null}
        {!inventoryLoading && sources.length === 0 && !inventoryError ? <p className="empty-state">No drives or images were reported.</p> : null}
      </div>
    </AdvancedSection>
  </WorkflowFrame>;
}
