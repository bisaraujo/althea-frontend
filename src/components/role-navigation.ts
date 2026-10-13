import { CalendarClock, CalendarDays, ClipboardCheck, FileUp, Gift, House, Route as RouteIcon } from 'lucide-react';

import type { NavigationItem } from './app-shell';

const JORNADAS = 'product-jornadas';

export const managerNavigation: NavigationItem[] = [
  { to: '/manager', label: 'Visão geral', icon: House },
  { to: '/manager/journey', label: 'Minha jornada', icon: RouteIcon, product: JORNADAS },
  { to: '/manager/company-journey', label: 'Jornada da empresa', icon: FileUp, product: JORNADAS },
  { to: '/manager/schedule', label: 'Cronograma', icon: CalendarClock, product: JORNADAS },
  { to: '/manager/meetings', label: 'Reuniões', icon: ClipboardCheck, product: JORNADAS },
  { to: '/agenda', label: 'Agenda do plano de ação', icon: CalendarDays, product: JORNADAS },
  { to: '/benefits', label: 'Benefícios', icon: Gift },
];

export const employeeNavigation: NavigationItem[] = [
  { to: '/employee', label: 'Visão geral', icon: House },
  { to: '/employee/journey', label: 'Minha jornada', icon: RouteIcon, product: JORNADAS },
  { to: '/benefits', label: 'Meus benefícios', icon: Gift },
];
