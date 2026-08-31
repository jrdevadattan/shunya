import { useState } from 'react';
import { ArrowLeft, FolderOpen, ShieldAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { WorkspaceSelection } from '@recovery/contracts';
import { ApplicationShell } from './ApplicationShell.js';

export function NewDeletionPage() {
  const navigate = useNavigate();
  const [selection, setSelection] = useState<WorkspaceSelection | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [error, setError] = useState<string>();

  async function chooseFolder() {
    setSelectingFolder(true);
    setError(undefined);
    try {
      const selected = await window.recoveryApi.chooseWorkspaceFolder();
      if (selected) {
        setSelection(selected);
        // Auto create deletion task with folder name as title
        const folderName = selected.selectedPath.split(/[\\/]/).pop() || 'Unknown Folder';
        setTaskTitle(`Deletion Task: ${folderName}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not inspect the selected folder.');
    } finally {
      setSelectingFolder(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selection) return;
    
    // For now, we don't have deletion logic, so just go back or show success
    alert(`Created deletion task "${taskTitle}" for ${selection.selectedPath}`);
    navigate('/');
  }

  return (
    <ApplicationShell title="New Deletion">
      <div className="form-page" style={{ padding: '36px 52px 28px', maxWidth: '800px', margin: '0 auto' }}>
        <Link to="/" className="back-link" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '24px', fontWeight: 600 }}>
          <ArrowLeft aria-hidden="true" size={16} />Back to workspace
        </Link>
        
        <header className="page-heading">
          <div>
            <p className="eyebrow" style={{ color: 'var(--status-danger)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Secure Deletion</p>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', letterSpacing: '-0.02em' }}>Start a new deletion task</h1>
            <p className="page-heading__description" style={{ color: 'var(--text-secondary)' }}>
              Choose a folder. We will securely traverse it and list its contents for deletion.
            </p>
          </div>
        </header>

        <form onSubmit={submit} className="case-form" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--surface-panel)', padding: '28px', border: '1px solid var(--border-subtle)', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {error && <p className="form-error" role="alert" style={{ color: 'var(--status-danger)', padding: '12px', background: 'rgba(255,0,0,0.05)', borderRadius: '6px' }}>{error}</p>}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontWeight: 600, fontSize: '14px' }}>1. Select Target Folder</label>
            {!selection ? (
              <button type="button" className="button button--secondary" onClick={chooseFolder} disabled={selectingFolder} style={{ alignSelf: 'flex-start' }}>
                <FolderOpen size={16} style={{ marginRight: '8px' }} />
                {selectingFolder ? 'Opening picker...' : 'Choose folder'}
              </button>
            ) : (
              <div style={{ padding: '16px', background: 'var(--surface-app)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                    <FolderOpen size={18} /> {selection.selectedPath}
                  </strong>
                  <button type="button" className="button button--secondary" onClick={chooseFolder}>Change folder</button>
                </div>
                
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <p style={{ margin: 0 }}><strong>Drive:</strong> {selection.rootLabel}</p>
                  <p style={{ margin: 0 }}><strong>Subdirectories found:</strong> {selection.directories.length}</p>
                </div>
                
                {selection.directories.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Traversal Preview:</p>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: 'var(--text-secondary)', maxHeight: '200px', overflowY: 'auto' }}>
                      {selection.directories.map(d => (
                        <li key={d.relativePath} style={{ padding: '4px 0' }}>{d.relativePath}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label htmlFor="taskTitle" style={{ fontWeight: 600, fontSize: '14px' }}>2. Task Title</label>
            <input 
              id="taskTitle"
              value={taskTitle} 
              onChange={e => setTaskTitle(e.target.value)} 
              placeholder="Select a folder to auto-fill..."
              style={{ padding: '12px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px', width: '100%', fontSize: '14px', background: 'var(--surface-app)', color: 'var(--text-primary)' }}
              disabled={!selection}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', paddingTop: '24px', borderTop: '1px solid var(--border-subtle)' }}>
            <button type="submit" className="button button--primary" disabled={!selection} style={{ background: 'var(--status-danger)', border: 'none', gap: '8px', padding: '0 24px', height: '40px' }}>
              <ShieldAlert size={18} />
              Create Deletion Task
            </button>
          </div>
        </form>
      </div>
    </ApplicationShell>
  );
}
