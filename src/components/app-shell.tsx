import { Building2, ClipboardList, DoorOpen, House, Presentation, Route, Users } from 'lucide-react';
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
    { to: '/company', label: 'Visao geral', icon: House },
    { to: '/company#projects', label: 'Projetos', icon: Route },
    { to: '/company#forms', label: 'Formularios', icon: ClipboardList },
    { to: '/company#presentations', label: 'Apresentacoes', icon: Presentation },
  ],
  manager: [
    { to: '/manager', label: 'Jornada', icon: House },
    { to: '/manager#team', label: 'Equipe', icon: Users },
    { to: '/manager#responses', label: 'Respostas', icon: ClipboardList },
  ],
  employee: [
    { to: '/employee', label: 'Minha jornada', icon: House },
    { to: '/employee#forms', label: 'Pesquisas', icon: ClipboardList },
    { to: '/employee#presentations', label: 'Conteudos', icon: Presentation },
  ],
  admin: [
    { to: '/admin', label: 'Painel', icon: Building2 },
  ],
} as const;

export function AppShell({ user, title, subtitle, onSignOut, children }: AppShellProps) {
  const items = roleNavigation[user.role];

  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="shell__brand">
          <span className="shell__brand-mark">A</span>
          <div>
            <strong>Althea</strong>
            <p>{user.role}</p>
          </div>
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
        <header className="shell__header">
          <div>
            <span className="shell__eyebrow">Plataforma Althea</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="shell__user-card">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
        </header>

        <div className="shell__content">{children}</div>
      </main>
    </div>
  );
}
