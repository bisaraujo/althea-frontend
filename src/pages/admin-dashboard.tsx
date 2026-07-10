import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  FolderKanban,
  House,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { API_URL, ApiError } from '../api/client';
import {
  createCompany,
  createUser,
  getCompanies,
  getProjectManagerDeliveries,
  getProjects,
  getUsers,
} from '../api/services';
import type {
  ClientUserCreatePayload,
  Company,
  CompanyCreatePayload,
  ManagerDeliveries,
  Project,
  UserRecord,
} from '../api/types';
import { useAuth } from '../auth/auth-context';
import { AppShell } from '../components/app-shell';
import { EmptyState } from '../components/empty-state';
import { SectionPanel } from '../components/section-panel';
import { StatCard } from '../components/stat-card';
import { StatusPill } from '../components/status-pill';

type AdminSection = 'home' | 'companies' | 'projects' | 'project-detail' | 'project-users';
type SavingTarget = 'company' | 'context-user' | null;
type UserForm = Pick<ClientUserCreatePayload, 'name' | 'email' | 'senha' | 'role'>;
type InitialUserDraft = UserForm & { localId: string };
type InitialUserField = 'name' | 'email' | 'senha';

const adminNavigation = [
  { to: '/admin', label: 'Home', icon: House },
  { to: '/admin/companies', label: 'Cadastro', icon: Building2 },
  { to: '/admin/projects', label: 'Clientes', icon: FolderKanban },
  { to: '/admin/schedule', label: 'Cronograma', icon: CalendarClock },
];

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
    description: 'Adicione gestores ou funcionários diretamente no projeto selecionado.',
  },
} satisfies Record<AdminSection, { title: string; description: string }>;

const initialCompanyForm: CompanyCreatePayload = {
  name: '',
  description: '',
  email: '',
  senha: '',
};

const initialUserForm: UserForm = {
  name: '',
  email: '',
  senha: '',
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
  if (role === 'employee') return 'Funcionário';
  return 'Admin';
}

function formatApiError(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

function formatDate(value?: string | null) {
  if (!value) return 'Sem prazo';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function deliveryStatusLabel(status?: string) {
  if (status === 'submitted') return 'Enviado';
  if (status === 'submitted_late') return 'Enviado atrasado';
  if (status === 'overdue') return 'Atrasado';
  return 'Pendente';
}

function deliveryStatusTone(status?: string) {
  if (status === 'submitted') return 'success';
  if (status === 'submitted_late' || status === 'overdue') return 'warning';
  return 'muted';
}

function fileHref(fileUrl?: string | null) {
  if (!fileUrl) return null;
  if (fileUrl.startsWith('http')) return fileUrl;
  return `${API_URL}${fileUrl}`;
}

export function AdminDashboard({ section }: { section: AdminSection }) {
  const { projectId } = useParams<{ projectId: string }>();
  const { token, user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [companyForm, setCompanyForm] = useState<CompanyCreatePayload>(initialCompanyForm);
  const [initialManagers, setInitialManagers] = useState<InitialUserDraft[]>([]);
  const [initialEmployees, setInitialEmployees] = useState<InitialUserDraft[]>([]);
  const [contextUserForm, setContextUserForm] = useState<UserForm>(initialUserForm);
  const [clientSearch, setClientSearch] = useState('');
  const [managerDeliveries, setManagerDeliveries] = useState<ManagerDeliveries | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<SavingTarget>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const meta = screenMeta[section];

  async function loadAdminData() {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [companyData, projectData, userData] = await Promise.all([
        getCompanies(token),
        getProjects(token),
        getUsers(token),
      ]);

      setCompanies(companyData);
      setProjects(sortByName(projectData.projects));
      setUsers(sortByName(userData));
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

  useEffect(() => {
    if (!token || !projectId || !['project-detail', 'project-users'].includes(section)) {
      setManagerDeliveries(null);
      return;
    }

    async function loadProjectContext() {
      if (!token || !projectId) return;

      try {
        setManagerDeliveries(await getProjectManagerDeliveries(token, projectId));
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
  const managerDeliveryItems = useMemo(
    () => managerDeliveries?.sections.flatMap((section) => section.items) ?? [],
    [managerDeliveries],
  );
  const submittedDeliveries = managerDeliveryItems.filter((item) =>
    ['submitted', 'submitted_late'].includes(item.delivery_status),
  ).length;

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
    setError(null);
    setSuccess(null);

    const initialUsers = [...initialManagers, ...initialEmployees];

    try {
      const company = await createCompany(token, {
        ...companyForm,
        description: companyForm.description?.trim() || null,
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
      setSuccess(
        initialUsers.length
          ? `Cliente, projeto e ${initialUsers.length} usuário${initialUsers.length > 1 ? 's' : ''} inicial${initialUsers.length > 1 ? 'is' : ''} criado${initialUsers.length > 1 ? 's' : ''}.`
          : 'Cliente e projeto criados.',
      );
      await loadAdminData();
    } catch (err) {
      setError(formatApiError(err, 'Não foi possível concluir o cadastro do cliente.'));
    } finally {
      setSaving(null);
    }
  }

  async function handleCreateContextUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedCompany || !selectedProject) return;

    setSaving('context-user');
    setError(null);
    setSuccess(null);

    try {
      await createUser(token, {
        ...contextUserForm,
        company_id: selectedCompany.id,
        project_id: selectedProject.id,
      });
      setContextUserForm(initialUserForm);
      setSuccess(`${roleLabel(contextUserForm.role)} criado em ${selectedProject.name}.`);
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
      eyebrow="Admin"
      title={meta.title}
      description={meta.description}
      navigation={adminNavigation}
    >
      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

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
              label="Funcionários"
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
                        {rowEmployees.length} funcionários
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
          <SectionPanel title="Cadastrar cliente" eyebrow="Cadastro completo">
            <form className="admin-form admin-form--registration" onSubmit={handleCreateCompany}>
              <div className="field-grid">
                <label>
                  <span>Nome da empresa</span>
                  <input
                    value={companyForm.name}
                    onChange={(event) => setCompanyForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Empresa cliente"
                    required
                  />
                </label>

                <label>
                  <span>Email de acesso da empresa</span>
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
                  placeholder="Contexto do cliente, unidade ou escopo principal."
                />
              </label>

              <label>
                <span>Senha inicial da empresa</span>
                <input
                  type="password"
                  value={companyForm.senha}
                  onChange={(event) => setCompanyForm((current) => ({ ...current, senha: event.target.value }))}
                  placeholder="Defina uma senha provisória"
                  required
                />
              </label>

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
                          <label>
                            <span>Senha inicial</span>
                            <input
                              type="password"
                              value={draft.senha}
                              onChange={(event) =>
                                updateInitialUser('manager', draft.localId, 'senha', event.target.value)
                              }
                              placeholder="Senha provisória"
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
                      <strong>Funcionários iniciais</strong>
                      <p>{initialEmployees.length} cadastrados neste registro</p>
                    </div>
                  </div>

                  {initialEmployees.length ? (
                    <div className="admin-user-list">
                      {initialEmployees.map((draft, index) => (
                        <div key={draft.localId} className="admin-user-row">
                          <div className="admin-user-row__head">
                            <strong>Funcionário {index + 1}</strong>
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => removeInitialUser('employee', draft.localId)}
                              aria-label="Remover funcionário"
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
                              placeholder="funcionario@empresa.com"
                              required
                            />
                          </label>
                          <label>
                            <span>Senha inicial</span>
                            <input
                              type="password"
                              value={draft.senha}
                              onChange={(event) =>
                                updateInitialUser('employee', draft.localId, 'senha', event.target.value)
                              }
                              placeholder="Senha provisória"
                              required
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="admin-user-empty">Nenhum funcionário inicial.</div>
                  )}

                  <button type="button" className="secondary-button admin-add-button" onClick={() => addInitialUser('employee')}>
                    <Plus size={16} />
                    <span>Adicionar funcionário</span>
                  </button>
                </div>
              </div>

              <button type="submit" className="primary-button" disabled={saving === 'company'}>
                <Plus size={16} />
                <span>{saving === 'company' ? 'Criando...' : 'Criar cliente'}</span>
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
                    <span>{projectEmployees.length} funcionários</span>
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
            <Link to="/admin/projects" className="secondary-link admin-back-link">
              <ArrowLeft size={16} />
              <span>Voltar para clientes</span>
            </Link>

            <SectionPanel
              title={selectedCompany.name}
              eyebrow="Cliente selecionado"
              action={
                <Link to={`/admin/projects/${selectedProject.id}/users/new`} className="primary-button admin-action-link">
                  <UserPlus size={16} />
                  <span>Adicionar usuários</span>
                </Link>
              }
            >
              <div className="admin-detail__hero">
                <div>
                  <span className="admin-detail__label">Projeto principal</span>
                  <strong>{selectedProject.name}</strong>
                  <p>{selectedProject.description || 'Sem descrição cadastrada.'}</p>
                </div>
                <div className="admin-detail__meta">
                  <span>{selectedCompany.email}</span>
                  <span>{selectedManagers.length} gestores</span>
                  <span>{selectedEmployees.length} funcionários</span>
                </div>
              </div>
            </SectionPanel>

            <SectionPanel
              title="Entregas do gestor"
              eyebrow="Cronograma"
              action={<StatusPill>{submittedDeliveries}/{managerDeliveryItems.length} enviadas</StatusPill>}
            >
              {managerDeliveryItems.length ? (
                <div className="admin-delivery-list">
                  {managerDeliveries?.sections.map((section) => (
                    <div key={section.id} className="admin-delivery-section">
                      <div className="admin-delivery-section__head">
                        <strong>{section.title}</strong>
                        <span>{section.items.length} entregas</span>
                      </div>

                      {section.items.map((item) => {
                        const latest = item.latest_submission;
                        const href = fileHref(latest?.file_url);

                        return (
                          <article key={item.id} className="admin-delivery-item">
                            <div className="admin-delivery-item__main">
                              <div>
                                <strong>{item.document_title ?? item.title}</strong>
                                <p>{item.description || 'Sem descrição cadastrada.'}</p>
                              </div>
                              <div className="admin-delivery-item__badges">
                                <StatusPill tone={deliveryStatusTone(item.delivery_status)}>
                                  {deliveryStatusLabel(item.delivery_status)}
                                </StatusPill>
                                <StatusPill>Prazo {formatDate(item.due_at)}</StatusPill>
                              </div>
                            </div>

                            {latest ? (
                              <div className="admin-delivery-submission">
                                <span>
                                  {latest.user_name} enviou em {formatDate(latest.submitted_at)}
                                  {latest.is_late ? ' (atrasado)' : ''}
                                </span>
                                {href ? (
                                  <a href={href} target="_blank" rel="noreferrer" className="admin-delivery-file-link">
                                    {latest.file_name}
                                  </a>
                                ) : null}
                                {latest.notes ? <p>{latest.notes}</p> : null}
                              </div>
                            ) : (
                              <div className="admin-delivery-submission admin-delivery-submission--empty">
                                Nenhum envio registrado.
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Sem cronograma de entregas"
                  description="Quando houver uma jornada ativa do gestor com pedidos de documento, os registros aparecem aqui."
                />
              )}
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
                        <StatusPill>Gestor</StatusPill>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Sem gestores" description="Nenhum gestor vinculado a este projeto." />
                )}
              </SectionPanel>

              <SectionPanel title="Funcionários" eyebrow="Employee" action={<StatusPill>{selectedEmployees.length}</StatusPill>}>
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
                        <StatusPill>Funcionário</StatusPill>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Sem funcionários" description="Nenhum funcionário vinculado a este projeto." />
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
                      <option value="employee">Funcionário</option>
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
                      placeholder="pessoa@empresa.com"
                      required
                    />
                  </label>

                  <label>
                    <span>Senha inicial</span>
                    <input
                      type="password"
                      value={contextUserForm.senha}
                      onChange={(event) =>
                        setContextUserForm((current) => ({ ...current, senha: event.target.value }))
                      }
                      placeholder="Senha provisória"
                      required
                    />
                  </label>
                </div>

                <button type="submit" className="primary-button" disabled={saving === 'context-user'}>
                  <UserPlus size={16} />
                  <span>{saving === 'context-user' ? 'Criando...' : 'Criar usuário'}</span>
                </button>
              </form>
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

              <SectionPanel title="Funcionários" eyebrow="Employee" action={<StatusPill>{selectedEmployees.length}</StatusPill>}>
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
                  <EmptyState title="Sem funcionários" description="Nenhum funcionário vinculado a este projeto." />
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
