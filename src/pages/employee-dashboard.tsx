import { ClipboardList, Route, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import { getEmployeeForms, getEmployeeJourney, getEmployeePresentations } from '../api/services';
import type { FormSummary, Journey, Presentation } from '../api/types';
import { AppShell } from '../components/app-shell';
import { EmptyState } from '../components/empty-state';
import { SectionPanel } from '../components/section-panel';
import { StatCard } from '../components/stat-card';
import { StatusPill } from '../components/status-pill';
import { useAuth } from '../auth/auth-context';

export function EmployeeDashboard() {
  const { token, user, signOut } = useAuth();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    const authToken: string = token;

    async function load() {
      try {
        const [journeyData, formData, presentationData] = await Promise.all([
          getEmployeeJourney(authToken),
          getEmployeeForms(authToken),
          getEmployeePresentations(authToken),
        ]);

        setJourney(journeyData);
        setForms(formData.forms);
        setPresentations(presentationData.presentations);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Nao foi possivel carregar a jornada do funcionario.');
      }
    }

    void load();
  }, [token]);

  if (!user) {
    return null;
  }

  return (
    <AppShell
      user={user}
      title="Minha jornada"
      subtitle="Conteudos, pesquisas e apresentacoes organizados de forma mais clara para o colaborador."
      onSignOut={signOut}
    >
      {error ? <div className="form-error">{error}</div> : null}

      <div className="stats-grid">
        <StatCard label="Secoes" value={journey?.sections.length ?? 0} icon={<Route size={18} />} />
        <StatCard label="Pesquisas" value={forms.length} icon={<ClipboardList size={18} />} />
        <StatCard label="Conteudos" value={presentations.length} icon={<Sparkles size={18} />} />
      </div>

      <SectionPanel
        title={journey?.title ?? 'Trilha do colaborador'}
        eyebrow="Handout"
        action={<StatusPill tone="success">{journey?.status ?? 'active'}</StatusPill>}
      >
        {journey ? (
          <div className="journey">
            {journey.sections.map((section) => (
              <article key={section.id} className="journey-section">
                <header className="journey-section__header">
                  <div>
                    <span className="journey-section__order">{section.order}</span>
                    <div>
                      <h3>{section.title}</h3>
                      <p>{section.description || 'Sem descricao para esta etapa.'}</p>
                    </div>
                  </div>
                </header>

                <div className="journey-items">
                  {section.items.map((item) => (
                    <div key={item.id} className="journey-item">
                      <div className="journey-item__meta">
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.description || 'Sem descricao do item.'}</p>
                        </div>
                        <div className="journey-item__badges">
                          <StatusPill>{item.item_type}</StatusPill>
                          <StatusPill tone={item.user_status === 'submitted' ? 'success' : 'muted'}>
                            {item.user_status ?? 'available'}
                          </StatusPill>
                        </div>
                      </div>

                      {item.content_text ? <p className="journey-item__content">{item.content_text}</p> : null}
                      {item.video_url ? (
                        <a className="secondary-link" href={item.video_url} target="_blank" rel="noreferrer">
                          abrir video
                        </a>
                      ) : null}

                      {item.item_type === 'survey' && item.form_id ? (
                        <div className="journey-item__hint">
                          <span>Este item esta vinculado ao formulario {item.form_id.slice(0, 8)}.</span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Sem jornada ativa"
            description="Quando existir uma jornada employee ativa para o projeto deste usuario, ela aparece aqui."
          />
        )}
      </SectionPanel>

      <div className="content-grid">
        <SectionPanel title="Pesquisas disponiveis" eyebrow="Formularios" action={<StatusPill>{forms.length} itens</StatusPill>}>
          {forms.length ? (
            <div className="list">
              {forms.map((form) => (
                <article key={form.id} className="list-item">
                  <div>
                    <strong>{form.title}</strong>
                    <p>{form.description || 'Sem descricao.'}</p>
                  </div>
                  <StatusPill>{form.audience}</StatusPill>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhuma pesquisa liberada"
              description="As pesquisas da jornada do colaborador vao aparecer aqui."
            />
          )}
        </SectionPanel>

        <SectionPanel
          title="Apresentacoes e conteudos"
          eyebrow="Material de apoio"
          action={<StatusPill>{presentations.length} itens</StatusPill>}
        >
          {presentations.length ? (
            <div className="list">
              {presentations.map((presentation) => (
                <article key={presentation.id} className="list-item">
                  <div>
                    <strong>{presentation.title}</strong>
                    <p>{presentation.description || 'Sem descricao.'}</p>
                  </div>
                  <a href={presentation.file_url} target="_blank" rel="noreferrer" className="secondary-link">
                    abrir
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Sem conteudos ainda"
              description="As apresentacoes e materiais da jornada vao aparecer aqui."
            />
          )}
        </SectionPanel>
      </div>
    </AppShell>
  );
}
