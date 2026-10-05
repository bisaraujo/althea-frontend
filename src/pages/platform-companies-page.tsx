import { Building2, ChevronRight, Clock3, PackageCheck, Plus, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getAllCustomCapabilities, getCompanyPortfolio, getProducts } from '../api/services';
import type { CompanyCustomCapability, CompanyPortfolio, Product } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { platformAdminNavigation } from '../components/admin-navigation';
import { AppShell } from '../components/app-shell';
import { CompanyAvatar } from '../components/company-avatar';
import { EmptyState } from '../components/empty-state';
import { InfoTooltip } from '../components/info-tooltip';
import { SectionPanel } from '../components/section-panel';
import { StatCard } from '../components/stat-card';
import './companies-admin.css';

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function PlatformCompaniesPage() {
  const { token } = useAuth();
  const [companies, setCompanies] = useState<CompanyPortfolio[]>([]);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [pending, setPending] = useState<CompanyCustomCapability[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    Promise.all([getCompanyPortfolio(token), getProducts(token)])
      .then(([portfolio, products]) => {
        if (!active) return;
        setCompanies(portfolio);
        setCatalog(products);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof ApiError ? reason.message : 'Não foi possível carregar as empresas.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    // Indicador secundário: se falhar, o painel mostra apenas "indisponível".
    getAllCustomCapabilities(token, 'pending')
      .then((items) => active && setPending(items))
      .catch(() => active && setPending(null));
    return () => {
      active = false;
    };
  }, [token]);

  const stats = useMemo(() => {
    const collaborators = companies.reduce((sum, item) => sum + item.manager_count + item.employee_count, 0);
    const managers = companies.reduce((sum, item) => sum + item.manager_count, 0);
    const withoutProducts = companies.filter((item) => !item.products.length).length;
    const perProduct = catalog.map((product) => ({
      product,
      count: companies.filter((company) => company.products.some((item) => item.id === product.id)).length,
    }));
    return { collaborators, managers, withoutProducts, perProduct };
  }, [companies, catalog]);

  const pendingByCompany = useMemo(() => {
    const map = new Map<string, number>();
    (pending ?? []).forEach((item) => map.set(item.company_id, (map.get(item.company_id) ?? 0) + 1));
    return map;
  }, [pending]);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    return companies.filter((company) => {
      if (productFilter === '__none') {
        if (company.products.length) return false;
      } else if (productFilter && !company.products.some((item) => item.id === productFilter)) {
        return false;
      }
      return !term || normalize(`${company.name} ${company.email}`).includes(term);
    });
  }, [companies, search, productFilter]);

  const maxCount = Math.max(1, companies.length);

  return (
    <AppShell
      eyebrow="Administração geral"
      title="Empresas"
      description="Acompanhe as empresas clientes, os produtos que contrataram e quantos colaboradores usam a plataforma."
      navigation={platformAdminNavigation}
    >
      <div className="ca-page">
        {error ? <div className="form-error">{error}</div> : null}

        <div className="stats-grid">
          <StatCard
            label="Empresas"
            value={loading ? '—' : companies.length}
            meta={loading ? undefined : `${stats.withoutProducts} sem produto contratado`}
            icon={<Building2 size={18} />}
          />
          <StatCard
            label="Colaboradores"
            value={loading ? '—' : stats.collaborators}
            meta={loading ? undefined : `${stats.managers} gestor(es) incluído(s)`}
            icon={<Users size={18} />}
          />
          <StatCard
            label="Produtos no catálogo"
            value={loading ? '—' : catalog.length}
            meta={loading ? undefined : `${stats.perProduct.filter((item) => item.count > 0).length} em uso`}
            icon={<PackageCheck size={18} />}
          />
          <StatCard
            label="Solicitações pendentes"
            value={pending === null ? '—' : pending.length}
            meta={pending === null ? 'Indisponível no momento' : 'Solicitações de nova permissão aguardando análise'}
            icon={<Clock3 size={18} />}
          />
        </div>

        {!loading && catalog.length && companies.length ? (
          <SectionPanel
            title="Empresas por produto"
            eyebrow="Adoção"
            action={<InfoTooltip text="Produto é o que a empresa contrata. Cada barra mostra quantas empresas têm o produto liberado, em relação ao total de empresas." />}
          >
            <ul className="ca-bars">
              {stats.perProduct.map(({ product, count }) => (
                <li key={product.id}>
                  <div className="ca-bars__label"><span>{product.name}</span><span>{count} de {companies.length}</span></div>
                  <div className="ca-bars__track"><div className="ca-bars__fill" style={{ width: `${(count / maxCount) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </SectionPanel>
        ) : null}

        <SectionPanel
          title="Carteira de empresas"
          eyebrow={loading ? 'Carregando' : `${filtered.length} de ${companies.length}`}
          action={<Link className="primary-button" to="/platform-admin/companies/new"><Plus size={16} /><span>Cadastrar empresa</span></Link>}
        >
          {loading ? (
            <div className="ca-skeletons" aria-busy="true" aria-label="Carregando empresas">
              <div className="ca-skeleton" /><div className="ca-skeleton" /><div className="ca-skeleton" />
            </div>
          ) : !companies.length ? (
            <EmptyState icon={Building2} title="Nenhuma empresa cadastrada" description="Cadastre a primeira empresa para começar a liberar produtos e acessos." />
          ) : (
            <>
              <div className="ca-toolbar">
                <label className="ca-search">
                  <Search size={16} />
                  <input
                    aria-label="Buscar empresa"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nome ou e-mail"
                  />
                </label>
                <select className="ca-select" aria-label="Filtrar por produto" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
                  <option value="">Todos os produtos</option>
                  {catalog.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                  <option value="__none">Sem produto contratado</option>
                </select>
              </div>

              {!filtered.length ? (
                <EmptyState icon={Search} title="Nenhuma empresa encontrada" description="Ajuste a busca ou o filtro de produto." />
              ) : (
                <div className="ca-list" role="list">
                  <div className="ca-row ca-row--head" aria-hidden>
                    <span>Empresa</span><span>Produtos contratados</span>
                    <span className="ca-num">Gestores</span><span className="ca-num">Colaboradores</span><span />
                  </div>
                  {filtered.map((company) => {
                    const pendingCount = pendingByCompany.get(company.id) ?? 0;
                    return (
                      <Link className="ca-row" role="listitem" key={company.id} to={`/platform-admin/companies/${company.id}`} aria-label={`Administrar ${company.name}`}>
                        <div className="ca-identity">
                          <CompanyAvatar name={company.name} />
                          <div className="ca-identity__text">
                            <span className="ca-identity__name">{company.name}</span>
                            <span className="ca-identity__email">{company.email}</span>
                          </div>
                        </div>
                        <div className="ca-chips">
                          {company.products.map((product) => <span className="ca-chip" key={product.id}>{product.name}</span>)}
                          {!company.products.length ? <span className="ca-chip ca-chip--muted">Nenhum produto</span> : null}
                          {pendingCount ? <span className="ca-chip ca-chip--warn">{pendingCount} solicitação(ões)</span> : null}
                        </div>
                        <span className="ca-num">{company.manager_count}</span>
                        <span className="ca-num">{company.employee_count}</span>
                        <ChevronRight className="ca-chevron" size={18} aria-hidden />
                        <div className="ca-counts-inline">
                          <span>{company.manager_count} gestor(es)</span>
                          <span>{company.employee_count} colaborador(es)</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </SectionPanel>
      </div>
    </AppShell>
  );
}
