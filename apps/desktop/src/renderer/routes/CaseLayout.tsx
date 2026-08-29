import { AppShell, RuntimeModeBadge } from '@recovery/ui';
import { RecoveryCaseSchema, RuntimeInfoSchema, type RecoveryCase } from '@recovery/contracts';
import { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { activeWorkspace, forgetCase } from '../application-state.js';

export function CaseLayout() {
  const { caseId = 'case' } = useParams();
  const [runtimeMode, setRuntimeMode] = useState<'installed' | 'rescue'>('installed');
  const [recoveryCase, setRecoveryCase] = useState<RecoveryCase>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    const workspace = activeWorkspace(caseId);
    setRecoveryCase(undefined);
    setError(undefined);
    void window.recoveryApi.getRuntimeInfo().then((value) => { if (active) setRuntimeMode(RuntimeInfoSchema.parse(value).mode); }).catch((cause) => { if (active) setError(message(cause)); });
    if (!workspace) {
      forgetCase(caseId);
      setError('Case context is unavailable. Open or create the case again.');
    }
    else void window.recoveryApi.openCase(workspace).then((value) => {
      if (!active) return;
      const opened = RecoveryCaseSchema.parse(value);
      if (opened.caseId !== caseId) {
        forgetCase(caseId);
        setError('The opened case does not match the requested case. Open the intended case again.');
        return;
      }
      setRecoveryCase(opened);
    }).catch((cause) => {
      if (!active) return;
      forgetCase(caseId);
      setError(message(cause));
    });
    return () => { active = false; };
  }, [caseId]);
  const base = `#/cases/${caseId}`;
  const navigation = [
    { id: 'overview', label: 'Overview' },
    { id: 'sources', label: 'Sources' },
    { id: 'jobs', label: 'Recovery Jobs' },
    { id: 'results', label: 'Recovered Files' },
    { id: 'memory', label: 'Memory Analysis' },
    { id: 'exports', label: 'Exports' },
    { id: 'reports', label: 'Reports' },
    { id: 'activity', label: 'Case Activity' },
  ].map((item) => ({ ...item, href: `${base}/${item.id}` }));
  return <AppShell header={<div className="case-header"><div><strong>{recoveryCase?.title ?? 'Recovery case'}</strong><span>{caseId}</span>{error ? <span role="alert">{error}</span> : null}</div><RuntimeModeBadge mode={runtimeMode} /></div>} navigation={navigation}>{recoveryCase?.caseId === caseId ? <Outlet /> : <p role="status">{error ? 'Case content is unavailable.' : 'Opening case…'}</p>}</AppShell>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'The case could not be opened.'; }
