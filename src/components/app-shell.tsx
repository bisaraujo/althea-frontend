import { Building2, Flame, KeyRound, LogOut, Menu, Network, Route as RouteIcon, ShieldAlert, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { hasWorkspaceAccess, INTEGRITY_PRODUCT_ID, useMyPermissions, useMyProducts } from '../api/workspace-access';
import { useAuth } from '../auth/auth-context';
import { BrandLockup } from './brand';
import { ChangePasswordModal } from './change-password-modal';
import { PageHeader } from './page-header';

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
  /** Grupo do menu (ex.: "Clientes"). Itens sem grupo ficam no topo, sem titulo. */
  section?: string;
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
  return parts.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

/** Agrupa os itens do menu pela secao, mantendo a ordem em que aparecem. */
function groupBySection(items: NavigationItem[]) {
  const groups: { section: string | null; items: NavigationItem[] }[] = [];
  for (const item of items) {
    const section = item.section ?? null;
    const last = groups[groups.length - 1];
    if (last && last.section === section) last.items.push(item);
    else groups.push({ section, items: [item] });
  }
  return groups;
}

type AppShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Botoes no canto direito do cabecalho da pagina. */
  actions?: ReactNode;
  navigation: NavigationItem[];
  children: React.ReactNode;
};

export function AppShell({ eyebrow, title, description, actions, navigation, children }: AppShellProps) {
  const { user, token, signOut } = useAuth();
  const location = useLocation();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // A gaveta do celular fecha ao trocar de pagina; enquanto aberta, a pagina atras nao rola.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
  }, [menuOpen]);
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

  const isAdmin = user?.role === 'admin';
  const isPlatformWorkspace = location.pathname.startsWith('/platform-admin');
  const isFagulhaWorkspace = location.pathname.startsWith('/fagulha-admin');
  const workspaces = isAdmin ? [
    user?.platform_admin ? { to: '/platform-admin/companies', label: 'Geral', title: 'Administração geral', icon: Building2, active: isPlatformWorkspace } : null,
    user?.platform_admin || user?.admin_product_ids?.includes('product-jornadas')
      ? { to: '/admin', label: 'Jornadas', title: 'Administração de Jornadas', icon: RouteIcon, active: !isPlatformWorkspace && !isFagulhaWorkspace } : null,
    user?.platform_admin || user?.admin_product_ids?.includes('product-fagulha')
      ? { to: '/fagulha-admin', label: 'Fagulha', title: 'Administração do Fagulha', icon: Flame, active: isFagulhaWorkspace } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null) : [];

  return (
    <div className={`tr-shell${menuOpen ? ' is-menu-open' : ''}`}>
      {/* No computador e a barra lateral; no celular vira a gaveta aberta pelo botao de menu. */}
      <aside id="shell-menu" className={`tr-sidebar${menuOpen ? ' is-open' : ''}`} aria-label="Menu">
        <div className="tr-sidebar__brand">
          <BrandLockup tone="light" subtitle="Jornada psicossocial" />
          <button type="button" className="tr-sidebar__close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu">
            <X size={18} />
          </button>
        </div>

        {workspaces.length > 1 ? (
          <nav className="tr-workspaces" aria-label="Ambiente administrativo">
            {workspaces.map(({ to, label, title: workspaceTitle, icon: Icon, active }) => (
              <Link key={to} to={to} title={workspaceTitle} className={`tr-workspaces__item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                <Icon size={14} aria-hidden />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        ) : null}

        <nav className="tr-nav" aria-label="Navegação principal">
          {groupBySection(visibleNavigation).map((group) => (
            <div key={group.section ?? 'main'} className="tr-nav__group">
              {group.section ? <span className="tr-nav__section">{group.section}</span> : null}
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `tr-nav__link${(item.activeFor ? item.activeFor(location.pathname) : isActive) ? ' is-active' : ''}`}
                    end={item.exact ?? ['/admin', '/company', '/manager', '/employee'].includes(item.to)}
                  >
                    <Icon size={17} aria-hidden />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {user ? (
          <div className="tr-account">
            <div className="tr-account__user">
              <span className="tr-avatar" aria-hidden>{userInitials(user.name)}</span>
              <span className="tr-account__copy">
                <strong title={user.name}>{user.name}</strong>
                <span>{roleLabel(user.role)}</span>
              </span>
            </div>
            <div className="tr-account__actions">
              <button type="button" className="tr-account__button" onClick={() => { setMenuOpen(false); setPasswordOpen(true); }}>
                <KeyRound size={15} aria-hidden />
                <span>Trocar senha</span>
              </button>
              <button type="button" className="tr-account__button" onClick={signOut}>
                <LogOut size={15} aria-hidden />
                <span>Sair</span>
              </button>
            </div>
          </div>
        ) : null}
      </aside>
      {menuOpen ? <div className="tr-backdrop" onClick={() => setMenuOpen(false)} aria-hidden /> : null}

      <main className="tr-main">
        <div className="tr-topbar">
          <BrandLockup compact />
          <button type="button" className="tr-topbar__menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menu" aria-expanded={menuOpen} aria-controls="shell-menu">
            <Menu size={18} aria-hidden />
            <span>Menu</span>
          </button>
        </div>

        <div className="tr-page">
          {user?.must_change_password ? (
            <div className="tr-notice" role="status">
              <KeyRound size={18} aria-hidden />
              <span><strong>Você está usando a senha provisória que recebeu por e-mail.</strong> Crie a sua própria senha para manter o acesso seguro.</span>
              <button type="button" className="primary-button" onClick={() => setPasswordOpen(true)}>Criar minha senha</button>
            </div>
          ) : null}

          <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />

          <section className="tr-content shell__content">{children}</section>
        </div>
      </main>
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
