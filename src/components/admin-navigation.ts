import {
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FolderKanban,
  Inbox,
  PackageCheck,
  ShieldCheck,
  Network,
  UserCog,
  ShieldAlert,
  Gift,
  UserPlus,
  ClipboardList,
  Sparkles,
} from 'lucide-react';
import type { NavigationItem } from './app-shell';

export const platformAdminNavigation: NavigationItem[] = [
  { to: '/platform-admin/companies', label: 'Empresas', icon: Building2, exact: true, section: 'Clientes', activeFor: (pathname) => pathname.startsWith('/platform-admin/companies') && pathname !== '/platform-admin/companies/new' },
  { to: '/platform-admin/companies/new', label: 'Cadastrar empresa', icon: UserPlus, section: 'Clientes' },
  { to: '/platform-admin/action-plans', label: 'Plano de ação', icon: CalendarDays, section: 'Operação' },
  { to: '/platform-admin/benefits', label: 'Benefícios', icon: Gift, section: 'Operação' },
  { to: '/platform-admin/integrity', label: 'Canal de Denúncias', icon: ShieldAlert, section: 'Operação' },
  { to: '/platform-admin/organization', label: 'Gestão organizacional', icon: Network, section: 'Operação' },
  { to: '/platform-admin/access-packages', label: 'Pacotes de acesso', icon: ShieldCheck, section: 'Acessos' },
  { to: '/platform-admin/requests', label: 'Central de solicitações', icon: Inbox, section: 'Acessos' },
  { to: '/platform-admin/administrators', label: 'Administradores', icon: UserCog, section: 'Acessos' },
  { to: '/platform-admin/products', label: 'Catálogo de produtos', icon: PackageCheck, section: 'Plataforma' },
];

export const productAdminNavigation: NavigationItem[] = [
  { to: '/admin', label: 'Clientes de Jornadas', icon: FolderKanban },
  { to: '/admin/schedule', label: 'Cronograma', icon: CalendarClock },
  { to: '/admin/meetings', label: 'Reuniões', icon: ClipboardCheck },
  { to: '/admin/research', label: 'Pesquisas', icon: ClipboardList, activeFor: (pathname) => pathname.startsWith('/admin/research') },
];

export const fagulhaAdminNavigation: NavigationItem[] = [
  { to: '/fagulha-admin', label: 'Operação Fagulha', icon: Sparkles, exact: true },
];
