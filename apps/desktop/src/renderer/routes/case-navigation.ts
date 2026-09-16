import type { NavigationGroup, NavigationItem } from '@recovery/ui';
import {
  BriefcaseBusiness,
  CircleHelp,
  CirclePlus,
  Cpu,
  FileOutput,
  FileText,
  Files,
  FolderSearch,
  HardDrive,
  History,
  Home,
  Info,
  LayoutDashboard,
  Settings,
} from 'lucide-react';

export function caseNavigation(caseId: string | null, pathname: string): NavigationGroup[] {
  const base = caseId ? `#/cases/${caseId}` : '#/';
  const item = (value: Omit<NavigationItem, 'active'>, activePaths: string[]): NavigationItem => ({
    ...value,
    active: activePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)),
  });
  const route = (suffix: string) => caseId ? `/cases/${caseId}/${suffix}` : '/case-unavailable';
  // Outside a case the case group is simply not shown: five greyed-out items
  // with the same explanation each is noise for a first-time user.
  const caseGroup: NavigationGroup[] = caseId ? [{
    id: 'recovery',
    label: 'This case',
    items: [
      item({ id: 'case-setup', label: 'Overview', href: `${base}/overview`, icon: LayoutDashboard }, [route('overview')]),
      item({ id: 'recovery', label: 'Recover', href: `${base}/sources`, icon: FolderSearch }, [route('sources'), route('recovery'), route('jobs'), route('memory')]),
      item({ id: 'verify', label: 'Recovered files', href: `${base}/results`, icon: Files }, [route('results'), route('exports')]),
      item({ id: 'reports', label: 'Report', href: `${base}/reports`, icon: FileText }, [route('reports')]),
      item({ id: 'case-activity', label: 'Activity', href: `${base}/activity`, icon: History }, [route('activity')]),
    ],
  }] : [];

  return [
    {
      id: 'cases',
      label: 'Start',
      items: [
        item({ id: 'cases', label: 'Home', href: '#/', icon: Home }, ['/', '/cases/open']),
        item({ id: 'new-case', label: 'New case', href: '#/cases/new', icon: CirclePlus }, ['/cases/new']),
      ],
    },
    ...caseGroup,
    {
      id: 'support',
      label: 'More',
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
        command('setup', 'Recovery setup', 'recovery/setup', FolderSearch),
        command('jobs', 'Recovery Jobs', 'jobs', History),
        command('results', 'Recovered Files', 'results', Files),
        command('memory', 'Memory Analysis', 'memory', Cpu),
        command('exports', 'Exports', 'exports', FileOutput),
        command('activity', 'Case Activity', 'activity', BriefcaseBusiness),
      ],
    },
  ];
}
