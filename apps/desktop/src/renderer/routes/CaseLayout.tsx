import { AppShell, RuntimeModeBadge } from '@recovery/ui';
import { RecoveryCaseSchema, RuntimeInfoSchema, type RecoveryCase } from '@recovery/contracts';
import { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { activeWorkspace } from '../application-state.js';

export function CaseLayout() {
  const { caseId = 'case' } = useParams();
  const [runtimeMode, setRuntimeMode] = useState<'installed' | 'rescue'>('installed');
  const [recoveryCase, setRecoveryCase] = useState<RecoveryCase>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const workspace = activeWorkspace(caseId);
    void window.recoveryApi.getRuntimeInfo().then((value) => setRuntimeMode(RuntimeInfoSchema.parse(value).mode)).catch((cause) => setError(message(cause)));
    if (workspace) void window.recoveryApi.openCase(workspace).then((value) => setRecoveryCase(RecoveryCaseSchema.parse(value))).catch((cause) => setError(message(cause)));
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
  return <AppShell header={<div className="case-header"><div><strong>{recoveryCase?.title ?? 'Recovery case'}</strong><span>{caseId}</span>{error ? <span role="alert">{error}</span> : null}</div><RuntimeModeBadge mode={runtimeMode} /></div>} navigation={navigation}><Outlet /></AppShell>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'The case could not be opened.'; }
