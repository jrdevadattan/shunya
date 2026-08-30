import type { NavigationGroup, NavigationItem } from '@recovery/ui';
import {
  BadgeCheck,
  BriefcaseBusiness,
  CircleHelp,
  CirclePlus,
  Cpu,
  FileOutput,
  FileText,
  Folder,
  FolderSearch,
  HardDrive,
  History,
  Info,
  Settings,
  SlidersHorizontal,
} from 'lucide-react';

export function caseNavigation(caseId: string | null, pathname: string): NavigationGroup[] {
  const base = caseId ? `#/cases/${caseId}` : '#/';
  const item = (value: Omit<NavigationItem, 'active'>, activePaths: string[]): NavigationItem => ({
    ...value,
    active: activePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)),
  });
  const route = (suffix: string) => caseId ? `/cases/${caseId}/${suffix}` : '/case-unavailable';
  const caseOnly = (value: Omit<NavigationItem, 'active'>): Omit<NavigationItem, 'active'> => caseId
    ? value
    : { ...value, href: '#/', disabledReason: 'Open or create a case to use this workspace.' };

  return [
    {
      id: 'cases',
      label: 'Cases',
      items: [
        item({ id: 'cases', label: 'Cases', href: '#/', icon: Folder }, ['/', '/cases/open']),
        item({ id: 'new-case', label: 'New case', href: '#/cases/new', icon: CirclePlus }, ['/cases/new']),
        item(caseOnly({ id: 'case-setup', label: 'Case setup', href: `${base}/overview`, icon: SlidersHorizontal }), [route('overview')]),
      ],
    },
    {
      id: 'recovery',
      label: 'Recovery',
      items: [
        item(caseOnly({ id: 'recovery', label: 'Recovery', href: `${base}/sources`, icon: History }), [route('sources'), route('recovery'), route('jobs'), route('memory')]),
        item(caseOnly({ id: 'verify', label: 'Verify', href: `${base}/results`, icon: BadgeCheck }), [route('results'), route('exports')]),
        item(caseOnly({ id: 'reports', label: 'Reports', href: `${base}/reports`, icon: FileText }), [route('reports')]),
      ],
    },
    {
      id: 'support',
      label: 'Support',
      items: [
        item({ id: 'settings', label: 'Settings', href: '#/settings', icon: Settings }, ['/settings']),
        item({ id: 'help', label: 'Help', href: '#/help', icon: CircleHelp }, ['/help']),
        item({ id: 'about', label: 'About', href: '#/about', icon: Info }, ['/about']),
      ],
    },
  ];
}

export function activeNavigationItem(groups: NavigationGroup[]): NavigationItem | undefined {
  return groups.flatMap((group) => group.items).find((item) => item.active);
}

export function caseCommandNavigation(caseId: string, pathname: string): NavigationGroup[] {
  const base = `#/cases/${caseId}`;
  const route = (suffix: string) => `/cases/${caseId}/${suffix}`;
  const command = (id: string, label: string, suffix: string, icon: NavigationItem['icon'], disabledReason?: string): NavigationItem => ({
    id: `command-${id}`,
    label,
    href: `${base}/${suffix}`,
    icon,
    active: pathname === route(suffix) || pathname.startsWith(`${route(suffix)}/`),
    disabledReason,
  });

  return [
    ...caseNavigation(caseId, pathname),
    {
      id: 'case-tools',
      label: 'Case tools',
      items: [
        command('sources', 'Sources', 'sources', HardDrive),
        command('jobs', 'Recovery Jobs', 'jobs', History),
        command('results', 'Recovered Files', 'results', FolderSearch),
        command('memory', 'Memory Analysis', 'memory', Cpu),
        command('exports', 'Exports', 'exports', FileOutput),
        command('activity', 'Case Activity', 'activity', BriefcaseBusiness),
      ],
    },
  ];
}
