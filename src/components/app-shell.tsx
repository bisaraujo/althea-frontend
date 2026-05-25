import { Building2, ClipboardList, DoorOpen, House, Presentation, Route, ShieldCheck, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { PropsWithChildren } from 'react';

import type { AuthenticatedUser } from '../api/types';

type AppShellProps = PropsWithChildren<{
  user: AuthenticatedUser;
  title: string;
  subtitle: string;
  onSignOut: () => void;
}>;

const roleNavigation = {
  company: [
    { to: '/company', label: 'Visão geral', icon: House },
    { to: '/company#projects', label: 'Projetos', icon: Route },
    { to: '/company#forms', label: 'Formulários', icon: ClipboardList },
    { to: '/company#presentations', label: 'Apresentações', icon: Presentation },
  ],
  manager: [
    { to: '/manager', label: 'Jornada', icon: House },
    { to: '/manager#team', label: 'Equipe', icon: Users },
    { to: '/manager#responses', label: 'Respostas', icon: ClipboardList },
  ],
  employee: [
    { to: '/employee', label: 'Visão geral', icon: House },
    { to: '/employee/journey', label: 'Minha jornada', icon: Route },
    { to: '/employee#forms', label: 'Pesquisas', icon: ClipboardList },
    { to: '/employee#presentations', label: 'Conteúdos', icon: Presentation },
  ],
  admin: [{ to: '/admin', label: 'Painel', icon: Building2 }],
} as const;

function roleLabel(role: AuthenticatedUser['role']) {
  switch (role) {
    case 'company':
      return 'Conta institucional';
    case 'manager':
      return 'Gestão de projeto';
    case 'employee':
      return 'Experiência do colaborador';
    default:
      return 'Administração da plataforma';
  }
}

export function AppShell({ user, title, subtitle, onSignOut, children }: AppShellProps) {
  const items = roleNavigation[user.role];

  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="shell__brand">
          <span className="shell__brand-mark">A</span>
          <div>
            <strong>Althea</strong>
            <p>{roleLabel(user.role)}</p>
          </div>
        </div>

        <div className="shell__sidebar-note">
          <span className="shell__sidebar-note-label">Plataforma</span>
          <p>Conteúdo, pesquisas e entregas organizados por perfil e projeto.</p>
        </div>

        <div className="shell__nav-section">
          <span className="shell__nav-section-label">Navegação</span>
        </div>

        <nav className="shell__nav">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className="shell__nav-link">
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <button type="button" className="shell__logout" onClick={onSignOut}>
          <DoorOpen size={18} />
          <span>Sair</span>
        </button>
      </aside>

      <main className="shell__main">
        <div className="shell__topbar">
          <div className="shell__crumbs">
            <span>Plataforma</span>
            <span>/</span>
            <span>{roleLabel(user.role)}</span>
          </div>

          <div className="shell__topbar-chip">
            <ShieldCheck size={16} />
            <span>Sessão ativa</span>
          </div>
        </div>

        <header className="shell__header">
          <div className="shell__headline">
            <span className="shell__eyebrow">Plataforma Althea</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="shell__user-card">
            <span className="shell__user-role">{user.role}</span>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
        </header>

        <div className="shell__content">{children}</div>
      </main>
    </div>
  );
}
