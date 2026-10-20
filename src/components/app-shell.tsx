import { Building2, Flame, KeyRound, LogOut, Network, Route as RouteIcon, ShieldAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { hasWorkspaceAccess, INTEGRITY_PRODUCT_ID, useMyPermissions, useMyProducts } from '../api/workspace-access';
import { useAuth } from '../auth/auth-context';
import { BrandLockup } from './brand';
import { ChangePasswordModal } from './change-password-modal';

export type NavigationItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Sobrescreve o destaque quando a rota ativa é uma página filha (ex.: detalhe da empresa). */
  activeFor?: (pathname: string) => boolean;
  platformOnly?: boolean;
  /** Produto que a empresa precisa ter para o item aparecer (ex.: product-jornadas). */
  product?: string;
  /** Permissao que o usuario precisa ter na empresa para o item aparecer (ex.: plano_acao.view). */
  permission?: string;
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
  const { user, token, signOut } = useAuth();
  const location = useLocation();
  const [passwordOpen, setPasswordOpen] = useState(false);
  // Gestores e colaboradores so veem "Gestao organizacional" quando receberam alguma permissao dela por perfil.
  const isTeamMember = user?.role === 'manager' || user?.role === 'employee';
  const isCompanySide = isTeamMember || user?.role === 'company';
  const permissions = useMyPermissions(isCompanySide ? token : null, user?.company_id);
  const products = useMyProducts(isCompanySide ? token : null);
  const workspaceItem: NavigationItem[] = isTeamMember && hasWorkspaceAccess(permissions) && !navigation.some((item) => item.to === '/organization')
    ? [{ to: '/organization', label: 'Gestão organizacional', icon: Network }]
    : [];
  // Canal de Denuncias: so com o produto contratado e para quem ve os casos (conta da empresa ou comite).
  const integrityItem: NavigationItem[] = isCompanySide && products?.has(INTEGRITY_PRODUCT_ID) && permissions?.has('integrity.cases.view')
    ? [{ to: '/integrity', label: 'Canal de Denúncias', icon: ShieldAlert }]
    : [];
  const visibleNavigation = [...navigation, ...workspaceItem, ...integrityItem]
    .filter((item) => !item.platformOnly || user?.platform_admin)
    .filter((item) => !item.product || !products || products.has(item.product))
    .filter((item) => !item.permission || Boolean(permissions?.has(item.permission)));
  const showAdminWorkspaceSwitcher = user?.role === 'admin';
  const isPlatformWorkspace = location.pathname.startsWith('/platform-admin');
  const isFagulhaWorkspace = location.pathname.startsWith('/fagulha-admin');
  const canUseJornadas = Boolean(user?.platform_admin || user?.admin_product_ids?.includes('product-jornadas'));
  const canUseFagulha = Boolean(user?.platform_admin || user?.admin_product_ids?.includes('product-fagulha'));

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
          {visibleNavigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `shell__nav-link ${(item.activeFor ? item.activeFor(location.pathname) : isActive) ? 'active' : ''}`
                }
                end={item.exact ?? ['/admin', '/company', '/manager', '/employee'].includes(item.to)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="shell__account">
          <button type="button" className="shell__account-link" onClick={() => setPasswordOpen(true)}>
            <KeyRound size={16} />
            <span>Trocar senha</span>
          </button>
          <button type="button" className="shell__logout" onClick={signOut}>
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <main className="shell__main">
        <div className="shell__mobile-brand">
          <BrandLockup compact />
          <span className="shell__mobile-actions">
            <button type="button" className="shell__logout shell__logout--mobile" onClick={() => setPasswordOpen(true)} aria-label="Trocar senha" title="Trocar senha">
              <KeyRound size={16} />
            </button>
            <button type="button" className="shell__logout shell__logout--mobile" onClick={signOut}>
              <LogOut size={16} />
              <span>Sair</span>
            </button>
          </span>
        </div>

        {user?.must_change_password ? (
          <div className="shell__password-notice" role="status">
            <KeyRound size={18} aria-hidden />
            <span><strong>Você está usando a senha provisória que recebeu por e-mail.</strong> Crie a sua própria senha para manter o acesso seguro.</span>
            <button type="button" className="primary-button" onClick={() => setPasswordOpen(true)}>Criar minha senha</button>
          </div>
        ) : null}

        {showAdminWorkspaceSwitcher ? (
          <nav className="admin-workspace-switcher" aria-label="Ambiente administrativo">
            <span className="admin-workspace-switcher__label">Ambiente</span>
            <div className="admin-workspace-switcher__options">
              {user?.platform_admin ? <Link
                to="/platform-admin/companies"
                className={`admin-workspace-switcher__link ${isPlatformWorkspace ? 'active' : ''}`}
                aria-current={isPlatformWorkspace ? 'page' : undefined}
              >
                <Building2 size={16} />
                <span>Admin Geral</span>
              </Link> : null}
              {canUseJornadas ? <Link
                to="/admin"
                className={`admin-workspace-switcher__link ${!isPlatformWorkspace && !isFagulhaWorkspace ? 'active' : ''}`}
                aria-current={!isPlatformWorkspace && !isFagulhaWorkspace ? 'page' : undefined}
              >
                <RouteIcon size={16} />
                <span>Admin Jornadas</span>
              </Link> : null}
              {canUseFagulha ? <Link to="/fagulha-admin" className={`admin-workspace-switcher__link ${isFagulhaWorkspace ? 'active' : ''}`} aria-current={isFagulhaWorkspace ? 'page' : undefined}><Flame size={16}/><span>Admin Fagulha</span></Link> : null}
            </div>
          </nav>
        ) : null}

        <nav className="shell__mobile-nav" aria-label="Navegação principal mobile">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `shell__mobile-nav-link ${(item.activeFor ? item.activeFor(location.pathname) : isActive) ? 'active' : ''}`
                }
                end={item.exact ?? ['/admin', '/company', '/manager', '/employee'].includes(item.to)}
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
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
