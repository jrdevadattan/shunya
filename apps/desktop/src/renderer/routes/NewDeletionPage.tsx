import { useEffect, useState } from 'react';
import { AdvancedSection, PageHeader } from '@recovery/ui';
import { ArrowLeft, BookOpen, FolderOpen, Loader2, ShieldAlert, ShieldCheck, Trash2, Usb } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DeletionPlan, DeletionResult } from '../../main/secure-erase/folderDeletion.js';
import { rememberRecentDeletion } from '../features/cases/recent-deletions.js';
import { CertificatePanel } from '../features/certificate/CertificatePanel.js';
import { trackOperation, useOperationByKind } from '../features/operations/operations-store.js';
import { ApplicationShell } from './ApplicationShell.js';

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

const REASONS: Record<string, string> = {
  DELETION_TARGET_NOT_FOUND: 'The folder could not be found.',
  DELETION_TARGET_NOT_A_FOLDER: 'The selected path is not a folder.',
  DELETION_DEVICE_UNRESOLVED: 'The physical device hosting this folder could not be identified.',
  DELETION_SYSTEM_DEVICE_BLOCKED: 'This folder is on the system disk. Secure deletion is limited to removable media.',
  DELETION_NON_REMOVABLE_BLOCKED: 'This folder is on an internal drive. Secure deletion is limited to removable (USB) media.',
  DELETION_DRIVE_ROOT_BLOCKED: 'The whole drive was selected. Use "Erase a device" to sanitize an entire drive.',
  DELETION_CONFIRMATION_MISMATCH: 'The typed confirmation did not match the folder path.',
  DELETION_DEVICE_CHANGED: 'The device changed after planning. Re-plan the deletion.',
  DELETION_PLAN_NOT_FOUND: 'The plan expired. Choose the folder again.',
  DELETION_UNSUPPORTED_PLATFORM: 'Folder deletion is not supported on this platform.',
};

export function explainDeletionError(message: string): string {
  // Electron wraps main-process errors ("Error invoking remote method 'x': Error: CODE"),
  // so look for a known code anywhere in the text.
  const code = /DELETION_[A-Z_]+/.exec(message)?.[0];
  return (code && REASONS[code]) ?? message;
}

export function NewDeletionPage() {
  const [targetPath, setTargetPath] = useState<string>();
  const [plan, setPlan] = useState<DeletionPlan>();
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmText, setConfirmText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');

  const latest = useOperationByKind('deletion');
  const op = latest && plan && latest.device === plan.targetPath ? latest : undefined;
  const running = op?.status === 'running';
  const result = op?.status === 'done' ? (op.result as DeletionResult | undefined) : undefined;
  const runError = op?.status === 'error' ? op.error : undefined;

  useEffect(() => {
    if (result) {
      rememberRecentDeletion({
        id: result.planId, title: taskTitle || `Deletion: ${folderName(result.targetPath)}`, targetPath: result.targetPath,
        totalFiles: result.fileCount, createdAt: result.startedAt, completedAt: result.completedAt,
        status: result.failures.length ? 'completed_with_failures' : 'completed', filesDeleted: result.filesDeleted,
        bytesOverwritten: result.bytesOverwritten, failures: result.failures.length, deviceModel: result.device.device.model,
        auditLogPath: result.auditLogPath,
      });
    }
    // The title is captured when the result lands; later edits are not re-saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  async function chooseFolder() {
    setError(undefined);
    let selected: string | null;
    try {
      selected = await window.deletionApi.chooseFolder();
    } catch (cause) {
      setError(cause instanceof Error ? explainDeletionError(cause.message) : 'The folder picker could not be opened.');
      return;
    }
    if (!selected) return;
    await planFolder(selected);
  }

  async function planFolder(selected: string) {
    setTargetPath(selected);
    setPlan(undefined);
    setConfirmText('');
    setPlanning(true);
    try {
      const next = await window.deletionApi.plan(selected);
      setPlan(next);
      setTaskTitle(`Deletion: ${folderName(next.targetPath)}`);
    } catch (cause) {
      setError(cause instanceof Error ? explainDeletionError(cause.message) : 'The folder could not be planned for deletion.');
    } finally {
      setPlanning(false);
    }
  }

  const confirmed = Boolean(plan) && confirmText === plan?.targetPath;

  async function execute() {
    if (!plan || !confirmed) return;
    setError(undefined);
    try {
      await trackOperation(
        { id: `deletion:${plan.targetPath}`, kind: 'deletion', label: `Deleting ${folderName(plan.targetPath)}`, route: '/deletion/new', device: plan.targetPath },
        window.deletionApi.execute(plan.planId, { confirmation: plan.targetPath }),
      );
    } catch { /* surfaced through the operation store */ }
  }

  return (
    <ApplicationShell title="Securely delete">
      <div className="page page--narrow">
        <Link to="/" className="back-link"><ArrowLeft aria-hidden="true" />Home</Link>
        <PageHeader
          eyebrow="Securely delete"
          title="Securely delete a folder"
          description="Every file in the folder is overwritten with random data, renamed and removed, so it cannot be recovered. Works on USB drives only; your system drive is never touched."
          actions={<Link className="button button--secondary" to="/secure-erase"><ShieldAlert aria-hidden="true" />Wipe a whole drive instead</Link>}
        />

        {error ? <p role="alert" className="form-error">{error}</p> : null}

        <section className="card deletion-steps" aria-label="Deletion">
          <div className="deletion-step">
            <span className="deletion-step__number" aria-hidden="true">1</span>
            <div className="deletion-step__body">
              <strong>Choose the folder</strong>
              <div className="deletion-page__target">
                <button type="button" className="button button--secondary" onClick={() => void chooseFolder()} disabled={planning || running}>
                  {planning ? <Loader2 className="spin" aria-hidden="true" /> : <FolderOpen aria-hidden="true" />}
                  {planning ? 'Inspecting folder…' : plan ? 'Change folder' : 'Choose folder'}
                </button>
                {targetPath ? <code className="deletion-page__path">{targetPath}</code> : <span className="deletion-page__hint">Nothing is changed until you confirm in step 3.</span>}
              </div>
              {plan ? <>
                <div className="deletion-page__facts" aria-label="Deletion plan">
                  <article><Usb aria-hidden="true" /><span><strong>{plan.device.device.model}</strong><small>{plan.device.device.busType ?? 'Removable'} · {formatBytes(plan.device.device.sizeBytes)} · mounted at {plan.device.mountRoot}</small></span><em>Removable</em></article>
                  <article><Trash2 aria-hidden="true" /><span><strong>{plan.fileCount.toLocaleString('en-US')} files · {formatBytes(plan.totalBytes)}</strong><small>{plan.directoryCount.toLocaleString('en-US')} subfolders will be removed once emptied</small></span></article>
                </div>
                {plan.sample.length ? <details className="deletion-page__sample"><summary>Preview of files to delete ({Math.min(plan.sample.length, plan.fileCount)} of {plan.fileCount})</summary><ul>{plan.sample.map((file) => <li key={file}>{file}</li>)}</ul></details> : <p className="deletion-page__hint">The folder contains no files; its empty subfolders will be removed.</p>}
                {plan.skipped.length ? <p className="flash-erase__warn"><ShieldAlert aria-hidden="true" />{plan.skipped.length} entries will be skipped (links, special files, or unreadable) and left in place.</p> : null}
              </> : null}
            </div>
          </div>

          {plan ? <>
            <div className="deletion-step">
              <span className="deletion-step__number" aria-hidden="true">2</span>
              <div className="deletion-step__body">
                <strong>Name this deletion</strong>
                <p>Shown in your history and on the certificate.</p>
                <input className="input" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} aria-label="Deletion task title" disabled={running || Boolean(result)} />
              </div>
            </div>

            <div className="deletion-step">
              <span className="deletion-step__number" aria-hidden="true">3</span>
              <div className="deletion-step__body">
                <strong>Confirm</strong>
                <div className="danger-zone">
                  <ShieldAlert aria-hidden="true" />
                  <div>
                    <strong>This cannot be undone</strong>
                    <p>Type the full folder path exactly as shown to enable deletion.</p>
                    <input
                      className="flash-erase__confirm"
                      aria-label="Type the folder path to confirm"
                      placeholder={plan.targetPath}
                      value={confirmText}
                      onChange={(event) => setConfirmText(event.target.value)}
                      spellCheck={false}
                      autoComplete="off"
                      disabled={running || Boolean(result)}
                    />
                  </div>
                </div>
                <div className="flash-erase__actions">
                  <button type="button" className="button button--danger button--large" disabled={!confirmed || running || Boolean(result)} onClick={() => void execute()}>
                    <Trash2 aria-hidden="true" />{running ? 'Deleting…' : `Securely delete ${plan.fileCount.toLocaleString('en-US')} files`}
                  </button>
                </div>
              </div>
            </div>

            {running || result ? (
              <div className="flash-erase__progress">
                <div className={`job-progress__bar${running ? ' job-progress__bar--running' : ''}`} role="progressbar" aria-label="Deletion progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(op?.percent ?? 0)}>
                  <span style={{ width: `${op?.percent ?? 0}%` }} />
                </div>
                <p className="flash-erase__status">{op?.statusText ?? 'Working…'} ({Math.round(op?.percent ?? 0)}%)</p>
              </div>
            ) : null}

            {runError ? <p role="alert" className="form-error">{explainDeletionError(runError)}</p> : null}

            {result ? (
              <div className="flash-erase__result" data-tone={result.failures.length ? 'warning' : undefined}>
                <ShieldCheck aria-hidden="true" />
                <div>
                  <strong>{result.failures.length ? `Deletion finished with ${result.failures.length} failure(s)` : 'Secure deletion complete'}</strong>
                  <small>{result.filesDeleted.toLocaleString('en-US')} of {result.fileCount.toLocaleString('en-US')} files overwritten and removed · {formatBytes(result.bytesOverwritten)} of random data written · {result.directoriesRemoved} folders removed</small>
                  <small>Audit log: <code className="flash-erase__path">{result.auditLogPath}</code></small>
                  {result.failures.length ? <ul className="deletion-page__failures">{result.failures.slice(0, 8).map((failure) => <li key={failure.path}><code>{failure.path}</code> — {failure.error}</li>)}</ul> : null}
                </div>
              </div>
            ) : null}

            {result ? <CertificatePanel record={{
              kind: 'sanitization',
              title: taskTitle || `Secure deletion of ${folderName(result.targetPath)}`,
              device: result.device.device.device,
              model: result.device.device.model,
              serial: result.device.device.serial ?? undefined,
              method: 'Per-file CSPRNG overwrite (AES-256-CTR keystream), rename and unlink',
              assurance: result.failures.length ? 'clear (partial: see audit log)' : 'clear',
              standard: 'NIST SP 800-88 Rev. 2 · Clear (file level)',
              details: `${result.filesDeleted} of ${result.fileCount} files, ${formatBytes(result.bytesOverwritten)} overwritten under ${result.targetPath}`,
              completedAt: result.completedAt,
            }} /> : null}
          </> : null}
        </section>

        <AdvancedSection title="How deletion works" summary="Method, standard and the honest limitation for flash media" icon={BookOpen} quiet>
          <p className="form-hint">File contents are overwritten with an AES-256-CTR keystream before removal — a NIST SP 800-88 Rev. 2 <strong>Clear</strong> at file level. The file is then truncated, renamed to a random name and unlinked, and emptied folders are removed.</p>
          <p className="note" data-tone="warning"><ShieldAlert aria-hidden="true" />On flash media, wear-levelling can leave stale copies in unmapped cells. For full assurance, erase the whole drive instead.</p>
        </AdvancedSection>
      </div>
    </ApplicationShell>
  );
}

function folderName(target: string): string {
  return target.split(/[\\/]/).filter(Boolean).pop() ?? target;
}
