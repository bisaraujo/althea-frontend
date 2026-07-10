import { LogOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { useAuth } from '../auth/auth-context';
import { BrandLockup } from './brand';

type NavigationItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

const ROLE_LABELS: Record<string, string> = {
  employee: 'Colaborador',
  manager: 'Gestor',
  company: 'Empresa',
  admin: 'Administrador',
};

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

function userInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const initials = parts.slice(0, 2).map((word) => word[0]).join('');
  return initials.toUpperCase();
}

type AppShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  navigation: NavigationItem[];
  children: React.ReactNode;
};

export function AppShell({
  eyebrow,
  title,
  description,
  navigation,
  children,
}: AppShellProps) {
  const { user, signOut } = useAuth();

  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="shell__brand">
          <BrandLockup tone="light" />
        </div>

        <div className="shell__sidebar-note">
          <span className="shell__sidebar-note-label">hub de cuidado</span>
          <p>Dados, jornadas e evidências em um painel vivo para transformar cuidado em decisão.</p>
        </div>

        <nav className="shell__nav" aria-label="Navegação principal">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `shell__nav-link ${isActive ? 'active' : ''}`
                }
                end={['/admin', '/company', '/manager', '/employee'].includes(item.to)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <button type="button" className="shell__logout" onClick={signOut}>
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </aside>

      <main className="shell__main">
        <div className="shell__mobile-brand">
          <BrandLockup compact />
          <button type="button" className="shell__logout shell__logout--mobile" onClick={signOut}>
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>

        <nav className="shell__mobile-nav" aria-label="Navegação principal mobile">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `shell__mobile-nav-link ${isActive ? 'active' : ''}`
                }
                end={['/admin', '/company', '/manager', '/employee'].includes(item.to)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <header className="shell__header">
          <div className="shell__headline">
            {eyebrow ? <span className="shell__eyebrow">{eyebrow}</span> : null}
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
          </div>

          {user ? (
            <div className="shell__user">
              <span className="shell__user-copy">
                <span>{roleLabel(user.role)}</span>
                <strong>{user.name}</strong>
              </span>
              <span className="shell__user-avatar" aria-hidden>
                {userInitials(user.name)}
              </span>
            </div>
          ) : null}
        </header>

        <section className="shell__content">{children}</section>
      </main>
    </div>
  );
}
