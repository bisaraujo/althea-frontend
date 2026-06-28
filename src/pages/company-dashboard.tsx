import { Building2, ClipboardList, FolderKanban, House, Presentation, Reply } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import { getForms, getMyCompany, getPresentations, getProjects, getResponses } from '../api/services';
import type { Company, FormSummary, Presentation as PresentationType, Project, ResponseRecord } from '../api/types';
import { AppShell } from '../components/app-shell';
import { EmptyState } from '../components/empty-state';
import { SectionPanel } from '../components/section-panel';
import { StatCard } from '../components/stat-card';
import { StatusPill } from '../components/status-pill';
import { useAuth } from '../auth/auth-context';

const companyNavigation = [
  { to: '/company', label: 'Visao geral', icon: House },
];

export function CompanyDashboard() {
  const { token, user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [presentations, setPresentations] = useState<PresentationType[]>([]);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    const authToken: string = token;

    async function load() {
      try {
        const [companyData, projectData, formData, presentationData, responseData] = await Promise.all([
          getMyCompany(authToken),
          getProjects(authToken),
          getForms(authToken),
          getPresentations(authToken),
          getResponses(authToken),
        ]);

        setCompany(companyData);
        setProjects(projectData.projects);
        setForms(formData.forms);
        setPresentations(presentationData.presentations);
        setResponses(responseData.responses);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar a área da empresa.');
      }
    }

    void load();
  }, [token]);

  if (!user) {
    return null;
  }

  return (
    <AppShell
      eyebrow="Plataforma Althea"
      title="Área da empresa"
      description="Uma visão consolidada da operação da própria empresa, com projetos, conteúdos e respostas."
      navigation={companyNavigation}
    >
      {error ? <div className="form-error">{error}</div> : null}

      <div className="stats-grid">
        <StatCard label="Projetos" value={projects.length} icon={<FolderKanban size={18} />} />
        <StatCard label="Formulários" value={forms.length} icon={<ClipboardList size={18} />} />
        <StatCard label="Apresentações" value={presentations.length} icon={<Presentation size={18} />} />
        <StatCard label="Respostas" value={responses.length} icon={<Reply size={18} />} />
      </div>

      <SectionPanel title="Conta institucional" eyebrow="Empresa">
        {company ? (
          <div className="company-card">
            <div>
              <span className="company-card__icon">
                <Building2 size={18} />
              </span>
              <div>
                <strong>{company.name}</strong>
                <p>{company.email}</p>
              </div>
            </div>
            <StatusPill tone="success">Conta company vinculada</StatusPill>
          </div>
        ) : (
          <EmptyState
            title="Empresa ainda não carregada"
            description="A relação company-empresa foi formalizada no backend. Quando a API responder, os dados aparecem aqui."
          />
        )}
      </SectionPanel>

      <div className="content-grid">
        <SectionPanel title="Projetos" eyebrow="Escopo" action={<StatusPill>{projects.length} ativos</StatusPill>}>
          {projects.length ? (
            <div className="list">
              {projects.map((project) => (
                <article key={project.id} className="list-item">
                  <div>
                    <strong>{project.name}</strong>
                    <p>{project.description || 'Sem descrição cadastrada.'}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhum projeto encontrado"
              description="Quando o admin criar projetos para esta empresa, eles aparecem aqui."
            />
          )}
        </SectionPanel>

        <SectionPanel title="Formulários e pesquisas" eyebrow="Conteúdo" action={<StatusPill>{forms.length} itens</StatusPill>}>
          {forms.length ? (
            <div className="list">
              {forms.map((form) => (
                <article key={form.id} className="list-item">
                  <div>
                    <strong>{form.title}</strong>
                    <p>{form.description || 'Sem descrição.'}</p>
                  </div>
                  <StatusPill>{form.audience}</StatusPill>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Sem formulários ainda"
              description="A empresa vai acompanhar por aqui os formulários ligados aos projetos dela."
            />
          )}
        </SectionPanel>
      </div>

      <div className="content-grid">
        <SectionPanel title="Apresentações" eyebrow="Biblioteca" action={<StatusPill>{presentations.length} itens</StatusPill>}>
          {presentations.length ? (
            <div className="list">
              {presentations.map((presentation) => (
                <article key={presentation.id} className="list-item">
                  <div>
                    <strong>{presentation.title}</strong>
                    <p>{presentation.description || 'Sem descrição.'}</p>
                  </div>
                  {presentation.file_url ? (
                    <a href={presentation.file_url} target="_blank" rel="noreferrer" className="secondary-link">
                      abrir
                    </a>
                  ) : (
                    <span className="secondary-link">em breve</span>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Sem apresentações ainda"
              description="As apresentações vinculadas aos projetos da empresa vão aparecer aqui."
            />
          )}
        </SectionPanel>

        <SectionPanel title="Respostas recentes" eyebrow="Acompanhamento" action={<StatusPill>{responses.length} registros</StatusPill>}>
          {responses.length ? (
            <div className="list">
              {responses.slice(0, 6).map((response) => (
                <article key={response.id} className="list-item">
                  <div>
                    <strong>Resposta {response.id.slice(0, 8)}</strong>
                    <p>Formulário {response.form_id.slice(0, 8)} • Usuário {response.user_id.slice(0, 8)}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Sem respostas registradas"
              description="Quando os colaboradores responderem pesquisas, os registros vão aparecer aqui."
            />
          )}
        </SectionPanel>
      </div>
    </AppShell>
  );
}
