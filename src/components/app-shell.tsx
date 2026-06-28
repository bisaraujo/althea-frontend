import { LogOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { useAuth } from '../auth/auth-context';

type NavigationItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

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
          <div className="shell__brand-mark">A</div>
          <div>
            <strong>Althea</strong>
            <p>Plataforma de acompanhamento psicossocial</p>
          </div>
        </div>

        <div className="shell__sidebar-note">
          <span className="shell__sidebar-note-label">Workspace</span>
          <p>
            Navegue pelas áreas da plataforma e acompanhe as ações mais importantes do seu projeto.
          </p>
        </div>

        <nav className="shell__nav">
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
        <header className="shell__header">
          <div className="shell__headline">
            {eyebrow ? <span className="shell__eyebrow">{eyebrow}</span> : null}
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
          </div>

          {user ? (
            <div className="shell__user-card">
              <span className="shell__user-role">{user.role}</span>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
          ) : null}
        </header>

        <section className="shell__content">{children}</section>
      </main>
    </div>
  );
}
