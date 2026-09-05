import { useState } from 'react';
import { Check, HardDriveDownload, Loader2, ShieldAlert, TriangleAlert, X } from 'lucide-react';
import { dismissOperation, useOperations, type OperationState } from './operations-store.js';

const KIND_ICON = {
  wipe: ShieldAlert,
  capture: HardDriveDownload,
  recovery: Loader2,
} as const;

function overallPercent(running: OperationState[]): number {
  if (running.length === 0) return 100;
  return running.reduce((sum, op) => sum + op.percent, 0) / running.length;
}

export function BackgroundOperationsWidget() {
  const operations = useOperations();
  const [open, setOpen] = useState(false);

  if (operations.length === 0) return null;

  const running = operations.filter((op) => op.status === 'running');
  const anyError = operations.some((op) => op.status === 'error');
  const percent = overallPercent(running);
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const dash = (percent / 100) * circumference;

  const tone = anyError && running.length === 0 ? 'error' : running.length > 0 ? 'running' : 'done';

  function openOperation(op: OperationState) {
    window.location.hash = op.route;
    setOpen(false);
  }

  return (
    <div className="bg-ops" data-tone={tone}>
      {open ? (
        <div className="bg-ops__panel" role="dialog" aria-label="Background operations">
          <header className="bg-ops__panel-head">
            <strong>Background tasks</strong>
            <button type="button" className="bg-ops__close" aria-label="Close" onClick={() => setOpen(false)}><X aria-hidden="true" size={15} /></button>
          </header>
          <ul className="bg-ops__list">
            {operations.map((op) => {
              const Icon = KIND_ICON[op.kind];
              return (
                <li key={op.id} className="bg-ops__item" data-status={op.status}>
                  <button type="button" className="bg-ops__item-main" onClick={() => openOperation(op)}>
                    <span className="bg-ops__item-icon" aria-hidden="true">
                      {op.status === 'running' ? <Loader2 className="spin" /> : op.status === 'error' ? <TriangleAlert /> : <Check />}
                    </span>
                    <span className="bg-ops__item-body">
                      <span className="bg-ops__item-title"><Icon aria-hidden="true" size={13} /> {op.label}</span>
                      <span className="bg-ops__item-status">{op.statusText}{op.status === 'running' ? ` · ${Math.round(op.percent)}%` : ''}</span>
                      {op.status === 'running' ? (
                        <span className="bg-ops__item-bar"><span style={{ width: `${op.percent}%` }} /></span>
                      ) : null}
                    </span>
                  </button>
                  {op.status !== 'running' ? (
                    <button type="button" className="bg-ops__dismiss" aria-label="Dismiss" onClick={() => dismissOperation(op.id)}><X aria-hidden="true" size={14} /></button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        className="bg-ops__fab"
        aria-label={running.length > 0 ? `${running.length} background task${running.length === 1 ? '' : 's'} running` : 'Background tasks'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
          <circle className="bg-ops__track" cx="24" cy="24" r={radius} fill="none" strokeWidth="4" />
          <circle
            className="bg-ops__meter"
            cx="24" cy="24" r={radius} fill="none" strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            transform="rotate(-90 24 24)"
          />
        </svg>
        <span className="bg-ops__fab-glyph" aria-hidden="true">
          {running.length > 0 ? <span className="bg-ops__fab-count">{running.length}</span>
            : anyError ? <TriangleAlert size={18} /> : <Check size={18} />}
        </span>
      </button>
    </div>
  );
}
