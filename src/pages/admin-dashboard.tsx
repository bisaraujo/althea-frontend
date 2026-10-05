import {
  ArrowLeft,
  ArrowRight,
  Building2,
  FolderKanban,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import {
  createCompany,
  createUser,
  getCompanies,
  getForms,
  getProducts,
  getProjectManagerDeliveries,
  getProjects,
  getResponses,
  getUsers,
  importProjectEmployees,
  listMeetings,
  uploadMeetingAta,
} from '../api/services';
import type {
  ClientUserCreatePayload,
  Company,
  CompanyCreatePayload,
  EmployeeImportResult,
  FormSummary,
  ManagerDeliveries,
  Meeting,
  Product,
  Project,
  ResponseRecord,
  UserRecord,
} from '../api/types';
import { useAuth } from '../auth/auth-context';
import { AppShell } from '../components/app-shell';
import { AdminProjectWorkspace } from '../components/admin-project-workspace';
import { EmptyState } from '../components/empty-state';
import { SectionPanel } from '../components/section-panel';
import { StatCard } from '../components/stat-card';
import { InfoTooltip } from '../components/info-tooltip';
import { StatusPill } from '../components/status-pill';
import { useToast } from '../components/toast';
import { platformAdminNavigation, productAdminNavigation } from '../components/admin-navigation';

type AdminSection = 'home' | 'companies' | 'projects' | 'project-detail' | 'project-users';
type SavingTarget = 'company' | 'context-user' | null;
type UserForm = Pick<ClientUserCreatePayload, 'name' | 'email' | 'role'>;
type InitialUserDraft = UserForm & { localId: string };
type InitialUserField = 'name' | 'email';

export const adminNavigation = productAdminNavigation;

const screenMeta = {
  home: {
    title: 'Dashboard',
    description: 'Visão geral dos clientes, projetos e acessos cadastrados.',
  },
  companies: {
    title: 'Cadastro de cliente',
    description: 'Registre a empresa cliente, o projeto principal e os acessos iniciais.',
  },
  projects: {
    title: 'Clientes',
    description: 'Procure empresas e projetos cadastrados em uma galeria simples.',
  },
  'project-detail': {
    title: 'Informações do cliente',
    description: 'Veja o resumo da empresa, do projeto e da equipe vinculada.',
  },
  'project-users': {
    title: 'Usuários do cliente',
    description: 'Adicione gestores ou colaboradores diretamente no projeto selecionado.',
  },
} satisfies Record<AdminSection, { title: string; description: string }>;

const initialCompanyForm: CompanyCreatePayload = {
  name: '',
  description: '',
  email: '',
};

const initialUserForm: UserForm = {
  name: '',
  email: '',
  role: 'employee',
};

function createInitialUserDraft(role: InitialUserDraft['role']): InitialUserDraft {
  return {
    ...initialUserForm,
    localId: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
  };
}

function roleLabel(role: UserRecord['role']) {
  if (role === 'company') return 'Empresa';
  if (role === 'manager') return 'Gestor';
  if (role === 'employee') return 'Colaborador';
  return 'Admin';
}

function formatApiError(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export function AdminDashboard({ section, mode = 'product' }: { section: AdminSection; mode?: 'platform' | 'product' }) {
  const { projectId } = useParams<{ projectId: string }>();
  const { token, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [productCatalog, setProductCatalog] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [newCompanyProductIds, setNewCompanyProductIds] = useState<string[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [companyForm, setCompanyForm] = useState<CompanyCreatePayload>(initialCompanyForm);
  const [initialManagers, setInitialManagers] = useState<InitialUserDraft[]>([]);
  const [initialEmployees, setInitialEmployees] = useState<InitialUserDraft[]>([]);
  const [contextUserForm, setContextUserForm] = useState<UserForm>(initialUserForm);
  const [clientSearch, setClientSearch] = useState('');
  const [managerDeliveries, setManagerDeliveries] = useState<ManagerDeliveries | null>(null);
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingBusyId, setMeetingBusyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<SavingTarget>(null);
  const [error, setError] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResetKey, setImportResetKey] = useState(0);
  const [importResult, setImportResult] = useState<EmployeeImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const meta =
    section === 'companies' && mode === 'platform'
      ? {
          title: 'Cadastrar empresa',
          description: 'Registre a empresa, escolha os produtos que ela contratou e cadastre os primeiros acessos.',
        }
      : screenMeta[section];

  useEffect(() => {
    if (section !== 'companies' || !token) return;
    let active = true;
    setProductsLoading(true);
    getProducts(token)
      .then((items) => active && setProductCatalog(items))
      .catch(() => active && toast.error('Não foi possível carregar o catálogo de produtos.'))
      .finally(() => active && setProductsLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, token]);

  function toggleNewCompanyProduct(productId: string) {
    setNewCompanyProductIds((current) =>
      current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId],
    );
  }

  async function loadAdminData() {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [companyData, projectData, userData, formData, responseData] = await Promise.all([
        getCompanies(token),
        getProjects(token),
        getUsers(token),
        getForms(token),
        getResponses(token),
      ]);

      // No admin de Jornadas, empresas sem o produto Jornadas não aparecem como clientes.
      setCompanies(mode === 'product' ? companyData.filter((c) => c.has_jornadas !== false) : companyData);
      setProjects(sortByName(projectData.projects));
      setUsers(sortByName(userData));
      setForms(formData.forms);
      setResponses(responseData.responses);
    } catch (err) {
      setError(formatApiError(err, 'Não foi possível carregar os dados administrativos.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleEmployeeImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !projectId || !importFile) {
      setImportError('Selecione uma planilha CSV ou XLSX para importar.');
      return;
    }

    const payload = new FormData();
    payload.append('file', importFile);

    setIsImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      const result = await importProjectEmployees(token, projectId, payload);
      setImportResult(result);
      setImportFile(null);
      setImportResetKey((current) => current + 1);
      await loadAdminData();
    } catch (err) {
      setImportError(formatApiError(err, 'Não foi possível importar os colaboradores.'));
    } finally {
      setIsImporting(false);
    }
  }

  useEffect(() => {
    if (!token || !projectId || !['project-detail', 'project-users'].includes(section)) {
      setManagerDeliveries(null);
      return;
    }

    async function loadProjectContext() {
      if (!token || !projectId) return;

      try {
        const [deliveryData, meetingData] = await Promise.all([
          getProjectManagerDeliveries(token, projectId),
          listMeetings(token, projectId),
        ]);
        setManagerDeliveries(deliveryData);
        setMeetings(meetingData.meetings);
      } catch (err) {
        setError(formatApiError(err, 'Não foi possível carregar as entregas do gestor.'));
      }
    }

    void loadProjectContext();
  }, [projectId, section, token]);


  const managers = useMemo(() => users.filter((item) => item.role === 'manager'), [users]);
  const employees = useMemo(() => users.filter((item) => item.role === 'employee'), [users]);
  const companyUsers = useMemo(() => users.filter((item) => item.role === 'company'), [users]);

  const projectCards = useMemo(
    () =>
      projects.map((project) => {
        const company = companies.find((item) => item.id === project.company_id);
        const projectUsers = users.filter((item) => item.project_id === project.id);

        return {
          project,
          company,
          managers: projectUsers.filter((item) => item.role === 'manager'),
          employees: projectUsers.filter((item) => item.role === 'employee'),
        };
      }),
    [companies, projects, users],
  );

  const companyRows = useMemo(
    () =>
      companies.map((company) => {
        const project = projects.find((item) => item.company_id === company.id) ?? null;
        const projectUsers = project ? users.filter((item) => item.project_id === project.id) : [];

        return {
          company,
          project,
          managers: projectUsers.filter((item) => item.role === 'manager'),
          employees: projectUsers.filter((item) => item.role === 'employee'),
        };
      }),
    [companies, projects, users],
  );
  const recentCompanyRows = useMemo(() => companyRows.slice(-5).reverse(), [companyRows]);

  const filteredProjectCards = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return projectCards;

    return projectCards.filter(({ project, company }) => {
      const searchable = [
        company?.name,
        company?.email,
        project.name,
        project.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [clientSearch, projectCards]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? null,
    [projects, projectId],
  );
  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedProject?.company_id) ?? null,
    [companies, selectedProject],
  );
  const selectedManagers = useMemo(
    () => users.filter((item) => item.project_id === selectedProject?.id && item.role === 'manager'),
    [selectedProject, users],
  );
  const selectedEmployees = useMemo(
    () => users.filter((item) => item.project_id === selectedProject?.id && item.role === 'employee'),
    [selectedProject, users],
  );
  async function handleProjectAta(meetingId: string, file: File | null) {
    if (!token || !projectId || !file) return;
    const payload = new FormData();
    payload.append('file', file);
    setMeetingBusyId(meetingId);
    setError(null);
    try {
      await uploadMeetingAta(token, meetingId, payload);
      setMeetings((await listMeetings(token, projectId)).meetings);
    } catch (err) {
      setError(formatApiError(err, 'Não foi possível anexar a ata.'));
    } finally {
      setMeetingBusyId(null);
    }
  }

  function addInitialUser(role: InitialUserDraft['role']) {
    const setter = role === 'manager' ? setInitialManagers : setInitialEmployees;
    setter((current) => [...current, createInitialUserDraft(role)]);
  }

  function updateInitialUser(
    role: InitialUserDraft['role'],
    localId: string,
    field: InitialUserField,
    value: string,
  ) {
    const setter = role === 'manager' ? setInitialManagers : setInitialEmployees;
    setter((current) =>
      current.map((draft) => (draft.localId === localId ? { ...draft, [field]: value } : draft)),
    );
  }

  function removeInitialUser(role: InitialUserDraft['role'], localId: string) {
    const setter = role === 'manager' ? setInitialManagers : setInitialEmployees;
    setter((current) => current.filter((draft) => draft.localId !== localId));
  }

  async function handleCreateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setSaving('company');

    const initialUsers = [...initialManagers, ...initialEmployees];

    try {
      const company = await createCompany(token, {
        ...companyForm,
        description: companyForm.description?.trim() || null,
        product_ids: newCompanyProductIds,
      });
      const projectData = await getProjects(token);
      const createdProject = projectData.projects.find((project) => project.company_id === company.id);

      if (initialUsers.length) {
        if (!createdProject) {
          throw new Error('Projeto automático não localizado.');
        }

        await Promise.all(
          initialUsers.map(({ localId: _localId, ...draft }) =>
            createUser(token, {
              ...draft,
              company_id: company.id,
              project_id: createdProject.id,
            }),
          ),
        );
      }

      setCompanyForm(initialCompanyForm);
      setInitialManagers([]);
      setInitialEmployees([]);
      setNewCompanyProductIds([]);
      toast.success(
        initialUsers.length
          ? `Empresa criada com ${initialUsers.length} acesso${initialUsers.length > 1 ? 's' : ''} inicia${initialUsers.length > 1 ? 'is' : 'l'}.`
          : 'Empresa criada.',
      );
      if (mode === 'platform') {
        navigate(`/platform-admin/companies/${company.id}`);
        return;
      }
      await loadAdminData();
    } catch (err) {
      toast.error(formatApiError(err, 'Não foi possível concluir o cadastro da empresa.'));
    } finally {
      setSaving(null);
    }
  }

  async function handleCreateContextUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedCompany || !selectedProject) return;

    setSaving('context-user');
    setError(null);

    try {
      await createUser(token, {
        ...contextUserForm,
        company_id: selectedCompany.id,
        project_id: selectedProject.id,
      });
      setContextUserForm(initialUserForm);
      toast.success(`${roleLabel(contextUserForm.role)} criado em ${selectedProject.name}.`);
      await loadAdminData();
      setManagerDeliveries(await getProjectManagerDeliveries(token, selectedProject.id));
    } catch (err) {
      setError(formatApiError(err, 'Não foi possível criar o usuário.'));
    } finally {
      setSaving(null);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <AppShell
      eyebrow={mode === 'platform' ? 'Administração geral' : 'Administração de Jornadas'}
      title={meta.title}
      description={meta.description}
      navigation={mode === 'platform' ? platformAdminNavigation : adminNavigation}
    >
      {error ? <div className="form-error">{error}</div> : null}

      {section === 'home' ? (
        <>
          <div className="stats-grid">
            <StatCard
              label="Clientes"
              value={companies.length}
              meta={`${companyUsers.length} contas company`}
              icon={<Building2 size={18} />}
            />
            <StatCard
              label="Projetos"
              value={projects.length}
              meta="Um projeto por cliente"
              icon={<FolderKanban size={18} />}
            />
            <StatCard
              label="Gestores"
              value={managers.length}
              meta="Usuários manager"
              icon={<ShieldCheck size={18} />}
            />
            <StatCard
              label="Colaboradores"
              value={employees.length}
              meta="Usuários employee"
              icon={<Users size={18} />}
            />
          </div>

          <div className="admin-toolbar">
            <button type="button" className="secondary-button admin-toolbar__button" onClick={loadAdminData}>
              <RefreshCw size={16} />
              <span>{isLoading ? 'Atualizando...' : 'Atualizar dados'}</span>
            </button>
          </div>

          <SectionPanel
            title="Clientes recentes"
            eyebrow="Resumo"
            action={<StatusPill>{companies.length} clientes</StatusPill>}
          >
            {recentCompanyRows.length ? (
              <div className="admin-list">
                {recentCompanyRows.map(({ company, project, managers: rowManagers, employees: rowEmployees }) => (
                  <article key={company.id} className="list-item list-item--rich">
                    <span className="list-item__icon">
                      <Building2 size={16} />
                    </span>
                    <div className="list-item__copy">
                      <strong>{company.name}</strong>
                      <p>{company.email}</p>
                      <span className="entity-meta">
                        {project ? project.name : 'Projeto automático pendente'} | {rowManagers.length} gestores |{' '}
                        {rowEmployees.length} colaboradores
                      </span>
                    </div>
                    <StatusPill tone={project ? 'success' : 'warning'}>{project ? 'Projeto criado' : 'Pendente'}</StatusPill>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nenhum cliente cadastrado"
                description="Crie a primeira empresa para liberar o projeto principal."
              />
            )}
          </SectionPanel>
        </>
      ) : null}

      {section === 'companies' ? (
        <div className="admin-registration">
          <SectionPanel title="Cadastrar empresa" eyebrow="Cadastro completo">
            <form className="admin-form admin-form--registration" onSubmit={handleCreateCompany}>
              <div className="field-grid">
                <label>
                  <span>Nome da empresa</span>
                  <input
                    value={companyForm.name}
                    onChange={(event) => setCompanyForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Nome da empresa"
                    required
                  />
                </label>

                <label>
                  <span>E-mail de acesso da empresa</span>
                  <input
                    type="email"
                    value={companyForm.email}
                    onChange={(event) => setCompanyForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="empresa@cliente.com"
                    required
                  />
                </label>
              </div>

              <label>
                <span>Descrição</span>
                <textarea
                  rows={4}
                  value={companyForm.description ?? ''}
                  onChange={(event) =>
                    setCompanyForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Contexto da empresa, unidade ou escopo principal."
                />
              </label>

              <div className="ca-create-products">
                <div className="ca-create-products__head">
                  <span>Produtos contratados</span>
                  <InfoTooltip text="Nenhum produto vem marcado por padrão. Escolha apenas o que a empresa contratou; você pode mudar isso depois na página da empresa. O conteúdo padrão de Jornadas só é criado se o produto for marcado." />
                </div>
                {productsLoading ? (
                  <div className="ca-skeletons" aria-busy="true"><div className="ca-skeleton" /></div>
                ) : !productCatalog.length ? (
                  <p className="form-hint">Nenhum produto no catálogo ainda. A empresa será criada sem produtos.</p>
                ) : (
                  <div className="ca-products">
                    {productCatalog.map((product) => {
                      const on = newCompanyProductIds.includes(product.id);
                      return (
                        <label key={product.id} className={`ca-product${on ? ' ca-product--on' : ''}`}>
                          <input type="checkbox" checked={on} onChange={() => toggleNewCompanyProduct(product.id)} />
                          <span className="ca-product__copy">
                            <strong>{product.name}</strong>
                            <p>{product.description || 'Sem descrição.'}</p>
                          </span>
                          <span />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className="form-hint">A senha temporária será gerada com segurança e enviada para o email da empresa.</p>

              <div className="admin-initial-users">
                <div className="admin-user-column">
                  <div className="admin-user-column__head">
                    <span className="list-item__icon">
                      <ShieldCheck size={16} />
                    </span>
                    <div>
                      <strong>Gestores iniciais</strong>
                      <p>{initialManagers.length} cadastrados neste registro</p>
                    </div>
                  </div>

                  {initialManagers.length ? (
                    <div className="admin-user-list">
                      {initialManagers.map((draft, index) => (
                        <div key={draft.localId} className="admin-user-row">
                          <div className="admin-user-row__head">
                            <strong>Gestor {index + 1}</strong>
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => removeInitialUser('manager', draft.localId)}
                              aria-label="Remover gestor"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                          <label>
                            <span>Nome</span>
                            <input
                              value={draft.name}
                              onChange={(event) =>
                                updateInitialUser('manager', draft.localId, 'name', event.target.value)
                              }
                              placeholder="Nome completo"
                              required
                            />
                          </label>
                          <label>
                            <span>Email</span>
                            <input
                              type="email"
                              value={draft.email}
                              onChange={(event) =>
                                updateInitialUser('manager', draft.localId, 'email', event.target.value)
                              }
                              placeholder="gestor@empresa.com"
                              required
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="admin-user-empty">Nenhum gestor inicial.</div>
                  )}

                  <button type="button" className="secondary-button admin-add-button" onClick={() => addInitialUser('manager')}>
                    <Plus size={16} />
                    <span>Adicionar gestor</span>
                  </button>
                </div>

                <div className="admin-user-column">
                  <div className="admin-user-column__head">
                    <span className="list-item__icon">
                      <Mail size={16} />
                    </span>
                    <div>
                      <strong>Colaboradores iniciais</strong>
                      <p>{initialEmployees.length} cadastrados neste registro</p>
                    </div>
                  </div>

                  {initialEmployees.length ? (
                    <div className="admin-user-list">
                      {initialEmployees.map((draft, index) => (
                        <div key={draft.localId} className="admin-user-row">
                          <div className="admin-user-row__head">
                            <strong>Colaborador {index + 1}</strong>
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => removeInitialUser('employee', draft.localId)}
                              aria-label="Remover colaborador"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                          <label>
                            <span>Nome</span>
                            <input
                              value={draft.name}
                              onChange={(event) =>
                                updateInitialUser('employee', draft.localId, 'name', event.target.value)
                              }
                              placeholder="Nome completo"
                              required
                            />
                          </label>
                          <label>
                            <span>Email</span>
                            <input
                              type="email"
                              value={draft.email}
                              onChange={(event) =>
                                updateInitialUser('employee', draft.localId, 'email', event.target.value)
                              }
                              placeholder="colaborador@empresa.com"
                              required
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="admin-user-empty">Nenhum colaborador inicial.</div>
                  )}

                  <button type="button" className="secondary-button admin-add-button" onClick={() => addInitialUser('employee')}>
                    <Plus size={16} />
                    <span>Adicionar colaborador</span>
                  </button>
                </div>
              </div>

              <button type="submit" className="primary-button" disabled={saving === 'company'}>
                <Plus size={16} />
                <span>{saving === 'company' ? 'Criando...' : 'Criar empresa'}</span>
              </button>
            </form>
          </SectionPanel>
        </div>
      ) : null}

      {section === 'projects' ? (
        <>
          <div className="admin-client-toolbar">
            <label className="admin-search">
              <Search size={17} />
              <input
                aria-label="Pesquisar clientes de Jornadas"
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
                placeholder="Pesquisar por empresa, e-mail, projeto ou descrição"
              />
            </label>
          </div>

          {filteredProjectCards.length ? (
            <div className="admin-client-gallery">
              {filteredProjectCards.map(({ project, company, managers: projectManagers, employees: projectEmployees }) => (
                <Link key={project.id} to={`/admin/projects/${project.id}`} className="admin-client-card">
                  <div className="admin-client-card__head">
                    <span className="list-item__icon">
                      <Building2 size={16} />
                    </span>
                    <StatusPill tone="success">Ativo</StatusPill>
                  </div>
                  <div className="admin-client-card__copy">
                    <strong>{company?.name ?? 'Empresa não localizada'}</strong>
                    <p>{project.name}</p>
                    <span>{project.description || company?.email || 'Sem descrição cadastrada.'}</span>
                  </div>
                  <div className="admin-client-card__footer">
                    <span>{projectManagers.length} gestores</span>
                    <span>{projectEmployees.length} colaboradores</span>
                    <ArrowRight size={16} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhum cliente encontrado"
              description="Ajuste a busca ou cadastre uma nova empresa."
            />
          )}
        </>
      ) : null}

      {section === 'project-detail' ? (
        selectedProject && selectedCompany ? (
          <div className="admin-detail">
            <Link to="/admin/projects" className="secondary-link admin-back-link admin-back-link--prominent">
              <ArrowLeft size={18} />
              <span>Voltar para clientes</span>
            </Link>
            <AdminProjectWorkspace
              key={selectedProject.id}
              company={selectedCompany}
              project={selectedProject}
              managers={selectedManagers}
              employees={selectedEmployees}
              deliveries={managerDeliveries}
              forms={forms}
              responses={responses}
              meetings={meetings}
              meetingBusyId={meetingBusyId}
              onAta={(meetingId, file) => void handleProjectAta(meetingId, file)}
            />
          </div>
        ) : (
          <EmptyState
            title="Cliente não encontrado"
            description="Volte para a galeria e selecione uma empresa cadastrada."
          />
        )
      ) : null}

      {section === 'project-users' ? (
        selectedProject && selectedCompany ? (
          <div className="admin-detail">
            <Link to={`/admin/projects/${selectedProject.id}`} className="secondary-link admin-back-link">
              <ArrowLeft size={16} />
              <span>Voltar para informações</span>
            </Link>

            <SectionPanel title={`Adicionar usuários em ${selectedCompany.name}`} eyebrow="Equipe do projeto">
              <form className="admin-form" onSubmit={handleCreateContextUser}>
                <div className="field-grid">
                  <label>
                    <span>Perfil</span>
                    <select
                      value={contextUserForm.role}
                      onChange={(event) =>
                        setContextUserForm((current) => ({
                          ...current,
                          role: event.target.value as UserForm['role'],
                        }))
                      }
                      required
                    >
                      <option value="employee">Colaborador</option>
                      <option value="manager">Gestor</option>
                    </select>
                  </label>

                  <label>
                    <span>Nome</span>
                    <input
                      value={contextUserForm.name}
                      onChange={(event) =>
                        setContextUserForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Nome completo"
                      required
                    />
                  </label>
                </div>

                <div className="field-grid">
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={contextUserForm.email}
                      onChange={(event) =>
                        setContextUserForm((current) => ({ ...current, email: event.target.value }))
                      }
                      placeholder="colaborador@empresa.com"
                      required
                    />
                  </label>

                  <p className="form-hint">O colaborador receberá uma senha temporária por email.</p>
                </div>

                <button type="submit" className="primary-button" disabled={saving === 'context-user'}>
                  <UserPlus size={16} />
                  <span>{saving === 'context-user' ? 'Criando...' : 'Criar usuário'}</span>
                </button>
              </form>
            </SectionPanel>

            <SectionPanel
              title="Importar colaboradores"
              eyebrow="Planilha"
              action={<StatusPill tone="muted">CSV ou XLSX</StatusPill>}
            >
              <p className="admin-form__hint">
                Suba uma planilha com uma coluna de nomes e outra de e-mail para cadastrar todos os
                colaboradores deste projeto de uma vez. Cada colaborador receberá uma senha temporária exclusiva por email.
              </p>

              <form className="employee-import" onSubmit={handleEmployeeImport}>
                <label className="employee-import__file">
                  <input
                    key={importResetKey}
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                  />
                  <span className="employee-import__dropzone">
                    <Upload size={18} />
                    <strong>{importFile?.name ?? 'Selecionar planilha'}</strong>
                    <small>Colunas aceitas: nome / email</small>
                  </span>
                </label>

                <button type="submit" className="primary-button" disabled={isImporting}>
                  <Upload size={16} />
                  <span>{isImporting ? 'Importando...' : 'Cadastrar todos'}</span>
                </button>
              </form>

              {importError ? <div className="form-error">{importError}</div> : null}
              {importResult ? (
                <div className="employee-import__summary">
                  <span className="employee-import__stat employee-import__stat--ok">
                    {importResult.created} criados
                  </span>
                  <span className="employee-import__stat">{importResult.skipped} já existiam</span>
                  <span className="employee-import__stat">{importResult.invalid} inválidos</span>
                </div>
              ) : null}
            </SectionPanel>

            <div className="admin-people-grid">
              <SectionPanel title="Gestores" eyebrow="Manager" action={<StatusPill>{selectedManagers.length}</StatusPill>}>
                {selectedManagers.length ? (
                  <div className="admin-list">
                    {selectedManagers.map((item) => (
                      <article key={item.id} className="list-item list-item--rich">
                        <span className="list-item__icon">
                          <ShieldCheck size={16} />
                        </span>
                        <div className="list-item__copy">
                          <strong>{item.name}</strong>
                          <p>{item.email}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Sem gestores" description="Nenhum gestor vinculado a este projeto." />
                )}
              </SectionPanel>

              <SectionPanel title="Colaboradores" eyebrow="Employee" action={<StatusPill>{selectedEmployees.length}</StatusPill>}>
                {selectedEmployees.length ? (
                  <div className="admin-list">
                    {selectedEmployees.map((item) => (
                      <article key={item.id} className="list-item list-item--rich">
                        <span className="list-item__icon">
                          <Mail size={16} />
                        </span>
                        <div className="list-item__copy">
                          <strong>{item.name}</strong>
                          <p>{item.email}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Sem colaboradores" description="Nenhum colaborador vinculado a este projeto." />
                )}
              </SectionPanel>
            </div>
          </div>
        ) : (
          <EmptyState
            title="Cliente não encontrado"
            description="Volte para a galeria e selecione uma empresa cadastrada."
          />
        )
      ) : null}
    </AppShell>
  );
}
