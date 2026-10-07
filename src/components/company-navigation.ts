import { House, Network, ShieldCheck } from 'lucide-react';

import type { NavigationItem } from './app-shell';

export const companyNavigation: NavigationItem[] = [
  { to: '/company', label: 'Visão geral', icon: House, exact: true },
  { to: '/organization', label: 'Gestão organizacional', icon: Network },
  { to: '/company/access', label: 'Acessos e permissões', icon: ShieldCheck },
];
