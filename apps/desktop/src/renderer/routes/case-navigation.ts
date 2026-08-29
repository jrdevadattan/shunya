import type { NavigationGroup, NavigationItem } from '@recovery/ui';
import {
  Activity,
  BriefcaseBusiness,
  Cpu,
  FileOutput,
  FileText,
  FolderSearch,
  HardDrive,
  LayoutDashboard,
} from 'lucide-react';

export function caseNavigation(caseId: string, pathname: string): NavigationGroup[] {
  const base = `#/cases/${caseId}`;
  const item = (value: Omit<NavigationItem, 'active'>, activePaths: string[]): NavigationItem => ({
    ...value,
    active: activePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)),
  });
  const route = (suffix: string) => `/cases/${caseId}/${suffix}`;

  return [
    {
      id: 'workspace',
      label: 'Workspace',
      items: [
        item({ id: 'overview', label: 'Overview', href: `${base}/overview`, icon: LayoutDashboard }, [route('overview')]),
        item({ id: 'sources', label: 'Sources', href: `${base}/sources`, icon: HardDrive }, [route('sources'), route('recovery')]),
        item({ id: 'jobs', label: 'Recovery Jobs', href: `${base}/jobs`, icon: Activity }, [route('jobs')]),
        item({ id: 'results', label: 'Recovered Files', href: `${base}/results`, icon: FolderSearch }, [route('results')]),
      ],
    },
    {
      id: 'analysis',
      label: 'Analysis',
      items: [
        item({ id: 'memory', label: 'Memory Analysis', href: `${base}/memory`, icon: Cpu, disabledReason: 'Volatility is unavailable.' }, [route('memory')]),
      ],
    },
    {
      id: 'output',
      label: 'Output',
      items: [
        item({ id: 'exports', label: 'Exports', href: `${base}/exports`, icon: FileOutput }, [route('exports')]),
        item({ id: 'reports', label: 'Reports', href: `${base}/reports`, icon: FileText }, [route('reports')]),
        item({ id: 'activity', label: 'Case Activity', href: `${base}/activity`, icon: BriefcaseBusiness, disabledReason: 'Case activity is not exposed by this daemon.' }, [route('activity')]),
      ],
    },
  ];
}

export function activeNavigationItem(groups: NavigationGroup[]): NavigationItem | undefined {
  return groups.flatMap((group) => group.items).find((item) => item.active);
}
