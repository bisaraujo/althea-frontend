import { ArrowLeft, ChevronRight, Clock3, FolderKanban, Mail, Network, PackageCheck, Save, Sparkles, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { listCapabilityRequests } from '../api/access';
import { getProducts, updateCompanyProducts } from '../api/services';
import { getCompanyPortfolioEntry } from '../api/platform-admin';
import type { CompanyPortfolio, Product } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { platformAdminNavigation } from '../components/admin-navigation';
import { AppShell } from '../components/app-shell';
import { CompanyAvatar } from '../components/company-avatar';
import { EmptyState } from '../components/empty-state';
import { InfoTooltip } from '../components/info-tooltip';
import { SectionPanel } from '../components/section-panel';
import { StatCard } from '../components/stat-card';
import { useToast } from '../components/toast';
import { CompanyUsersPanel } from '../components/company-users-panel';
import './companies-admin.css';

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function PlatformCompanyDetailPage() {
  const { companyId = '' } = useParams<{ companyId: string }>();
  const { token } = useAuth();
  const toast = useToast();
  const [company, setCompany] = useState<CompanyPortfolio | null>(null);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token || !companyId) return;
    const [entry, products] = await Promise.all([getCompanyPortfolioEntry(token, companyId), getProducts(token)]);
    setCompany(entry);
    setCatalog(products);
    setSelected(entry.products.map((product) => product.id));
  }, [token, companyId]);

  useEffect(() => {
    if (!token || !companyId) return;
    let active = true;
    setLoading(true);
    setCompany(null);
    load()
      .then(() => active && setLoadError(null))
      .catch((reason: unknown) => active && setLoadError(errorText(reason, 'Não foi possível carregar a empresa.')))
      .finally(() => active && setLoading(false));
    listCapabilityRequests(token, { companyId, status: 'pending' })
      .then((items) => active && setPendingCount(items.length))
      .catch(() => active && setPendingCount(null));
    return () => {
      active = false;
    };
  }, [token, companyId, load]);

  const contractedIds = useMemo(() => new Set(company?.products.map((product) => product.id) ?? []), [company]);
  const dirty = useMemo(() => {
    if (selected.length !== contractedIds.size) return true;
    return selected.some((id) => !contractedIds.has(id));
  }, [selected, contractedIds]);
  const hasJornadas = contractedIds.has('product-jornadas');
  const hasFagulha = contractedIds.has('product-fagulha');

  function toggle(productId: string) {
    setSelected((current) => (current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]));
  }

  async function save() {
    if (!token || !company || saving || !dirty) return;
    setSaving(true);
    try {
      await updateCompanyProducts(token, company.id, selected);
      await load();
      toast.success('Produtos da empresa atualizados.');
    } catch (reason) {
      toast.error(errorText(reason, 'Não foi possível atualizar os produtos da empresa.'));
    } finally {
      setSaving(false);
    }
  }

  const shellProps = {
    eyebrow: 'Administração geral',
    navigation: platformAdminNavigation,
  };

  if (loading) {
    return (
      <AppShell {...shellProps} title="Empresa" description="Carregando os dados da empresa.">
        <div className="ca-page" aria-busy="true"><div className="ca-skeleton" style={{ height: 110 }} /><div className="ca-skeleton" /><div className="ca-skeleton" /></div>
      </AppShell>
    );
  }

  if (!company) {
    return (
      <AppShell {...shellProps} title="Empresa" description="Não foi possível abrir esta empresa.">
        <div className="ca-page">
          <Link className="ca-back" to="/platform-admin/companies"><ArrowLeft size={15} /> Voltar para Empresas</Link>
          {loadError ? <div className="form-error">{loadError}</div> : null}
          <EmptyState title="Empresa indisponível" description="Ela pode ter sido removida ou o endereço está incorreto." />
        </div>
      </AppShell>
    );
  }

  const people = company.manager_count + company.employee_count;

  return (
    <AppShell {...shellProps} title={company.name} description="Você está administrando esta empresa.">
      <div className="ca-page">
        <Link className="ca-back" to="/platform-admin/companies"><ArrowLeft size={15} /> Voltar para Empresas</Link>

        <header className="ca-header">
          <div className="ca-header__main">
            <CompanyAvatar name={company.name} size="lg" />
            <div className="ca-header__text">
              <span className="ca-header__eyebrow">Empresa</span>
              <h2>{company.name}</h2>
              <span className="ca-header__email"><Mail size={14} /> {company.email}</span>
              <div className="ca-chips">
                {company.products.map((product) => <span className="ca-chip" key={product.id}>{product.name}</span>)}
                {!company.products.length ? <span className="ca-chip ca-chip--muted">Nenhum produto contratado</span> : null}
              </div>
            </div>
          </div>
          <div className="ca-header__actions">
            <Link className="primary-button" to={`/platform-admin/organization?company=${company.id}`}>
              <Network size={16} /><span>Gestão organizacional</span>
            </Link>
          </div>
        </header>

        <div className="stats-grid stats-grid--three">
          <StatCard label="Colaboradores vinculados" value={people} meta={`${company.employee_count} colaborador(es) · ${company.manager_count} gestor(es)`} icon={<Users size={18} />} />
          <StatCard label="Produtos contratados" value={company.products.length} meta={`de ${catalog.length} no catálogo`} icon={<PackageCheck size={18} />} />
          <StatCard
            label="Solicitações pendentes"
            value={pendingCount === null ? '—' : pendingCount}
            meta={pendingCount === null ? 'Indisponível no momento' : 'Pedidos de nova permissão'}
            icon={<Clock3 size={18} />}
          />
        </div>

        <div className="ca-detail-grid">
          <SectionPanel
            title="Produtos"
            eyebrow="Contratação"
            action={<InfoTooltip text="Produto é o que a empresa contrata (ex.: Jornadas, Fagulha). Ele é diferente de Perfil de acesso, que define o que cada colaborador pode fazer dentro dos produtos, e de Pacote de acesso, que é um modelo de perfil de acesso da Turi." />}
          >
            {!catalog.length ? (
              <EmptyState icon={PackageCheck} title="Catálogo vazio" description="Cadastre produtos no catálogo para poder liberá-los às empresas." />
            ) : (
              <>
                <div className="ca-products">
                  {catalog.map((product) => {
                    const on = selected.includes(product.id);
                    return (
                      <label className={`ca-product${on ? ' ca-product--on' : ''}`} key={product.id}>
                        <input type="checkbox" checked={on} onChange={() => toggle(product.id)} disabled={saving} />
                        <span className="ca-product__copy">
                          <strong>{product.name}</strong>
                          <p>{product.description || 'Sem descrição.'}</p>
                        </span>
                        <span className={`ca-chip ${contractedIds.has(product.id) ? '' : 'ca-chip--muted'}`}>
                          {contractedIds.has(product.id) ? 'Contratado' : 'Não contratado'}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="ca-savebar">
                  <p>{dirty ? 'Há alterações não salvas.' : 'Nenhuma alteração pendente.'}</p>
                  <button type="button" className="primary-button" onClick={() => void save()} disabled={saving || !dirty}>
                    <Save size={16} /><span>{saving ? 'Salvando...' : 'Salvar produtos'}</span>
                  </button>
                </div>
              </>
            )}
          </SectionPanel>

          <div className="ca-stack">
            <SectionPanel title="Atalhos" eyebrow="Administrar esta empresa">
              <div className="ca-links">
                <Link className="ca-link" to={`/platform-admin/organization?company=${company.id}`}>
                  <Network size={18} />
                  <span><strong>Gestão organizacional</strong><span className="ca-link__desc">Unidades, áreas, cargos, vínculos e perfis de acesso da empresa.</span></span>
                  <ChevronRight size={16} />
                </Link>
                <Link className="ca-link" to={`/platform-admin/requests?company=${company.id}`}>
                  <Clock3 size={18} />
                  <span><strong>Solicitações desta empresa</strong><span className="ca-link__desc">{pendingCount === null ? 'Pedidos de nova permissão feitos por ela.' : `${pendingCount} pendente(s) de análise. Abre a Central de solicitações já filtrada.`}</span></span>
                  <ChevronRight size={16} />
                </Link>
                {hasJornadas ? (
                  <Link className="ca-link" to="/admin/projects">
                    <FolderKanban size={18} />
                    <span><strong>Clientes de Jornadas</strong><span className="ca-link__desc">{company.project_count} projeto(s) de Jornadas nesta empresa.</span></span>
                    <ChevronRight size={16} />
                  </Link>
                ) : null}
                {hasFagulha ? (
                  <Link className="ca-link" to="/fagulha-admin">
                    <Sparkles size={18} />
                    <span><strong>Operação Fagulha</strong><span className="ca-link__desc">Liberação e acompanhamento do Fagulha.</span></span>
                    <ChevronRight size={16} />
                  </Link>
                ) : null}
                <Link className="ca-link" to="/platform-admin/products">
                  <PackageCheck size={18} />
                  <span><strong>Catálogo de produtos</strong><span className="ca-link__desc">Criar ou editar os produtos disponíveis.</span></span>
                  <ChevronRight size={16} />
                </Link>
              </div>
            </SectionPanel>

            <CompanyUsersPanel companyId={company.id} allowProjectChoice />

            <SectionPanel title="Colaboradores" eyebrow="Vínculos com a empresa">
              <dl className="ca-facts">
                <div><dt>Gestores</dt><dd>{company.manager_count}</dd></div>
                <div><dt>Colaboradores</dt><dd>{company.employee_count}</dd></div>
                <div><dt>Projetos</dt><dd>{company.project_count}</dd></div>
                {company.total_module_count ? <div><dt>Módulos liberados</dt><dd>{company.granted_module_count}/{company.total_module_count}</dd></div> : null}
              </dl>
            </SectionPanel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
