import { AppShell, RuntimeModeBadge } from '@recovery/ui';
import { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';

export function CaseLayout() {
  const { caseId = 'case' } = useParams();
  const [runtimeMode, setRuntimeMode] = useState<'installed' | 'rescue'>('installed');
  useEffect(() => {
    void window.recoveryApi.getRuntimeInfo().then((value) => {
      if (value && typeof value === 'object' && 'mode' in value && value.mode === 'rescue') setRuntimeMode('rescue');
    }).catch(() => undefined);
  }, []);
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
  return <AppShell header={<div className="case-header"><div><strong>Recovery case</strong><span>{caseId}</span></div><RuntimeModeBadge mode={runtimeMode} /></div>} navigation={navigation}><Outlet /></AppShell>;
}
