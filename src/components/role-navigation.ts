import { CalendarClock, ClipboardCheck, FileUp, House, Route as RouteIcon } from 'lucide-react';

import type { NavigationItem } from './app-shell';

export const managerNavigation: NavigationItem[] = [
  { to: '/manager', label: 'Visão geral', icon: House },
  { to: '/manager/journey', label: 'Minha jornada', icon: RouteIcon },
  { to: '/manager/company-journey', label: 'Jornada da empresa', icon: FileUp },
  { to: '/manager/schedule', label: 'Cronograma', icon: CalendarClock },
  { to: '/manager/meetings', label: 'Reuniões', icon: ClipboardCheck },
];

export const employeeNavigation: NavigationItem[] = [
  { to: '/employee', label: 'Visão geral', icon: House },
  { to: '/employee/journey', label: 'Minha jornada', icon: RouteIcon },
];
