import {
  ArrowUpRight,
  CheckCircle2,
  CirclePlay,
  ClipboardList,
  FileText,
  House,
  MoveRight,
  PlayCircle,
  Presentation as PresentationIcon,
  Route as RouteIcon,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getEmployeeForms, getEmployeeJourney, getEmployeePresentations } from '../api/services';
import type { FormSummary, Journey, JourneyItem, Presentation } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { AppShell } from '../components/app-shell';
import { EmptyState } from '../components/empty-state';
import { SectionPanel } from '../components/section-panel';
import { StatCard } from '../components/stat-card';
import { StatusPill } from '../components/status-pill';

const employeeNavigation = [
  { to: '/employee', label: 'Visão geral', icon: House },
  { to: '/employee/journey', label: 'Minha jornada', icon: RouteIcon },
];

function itemTypeIcon(item: JourneyItem) {
  if (item.item_type === 'survey') return <ClipboardList size={16} />;
  if (item.item_type === 'text') return <FileText size={16} />;
  if (item.item_type === 'video') return <PlayCircle size={16} />;
  if (item.item_type === 'presentation') return <PresentationIcon size={16} />;
  return <CirclePlay size={16} />;
}

function itemTypeLabel(item: JourneyItem) {
  switch (item.item_type) {
    case 'survey':
      return 'Pesquisa';
    case 'text':
      return 'Leitura';
    case 'video':
      return 'Vídeo';
    case 'presentation':
      return 'Apresentação';
    case 'document_request':
      return 'Documento';
    default:
      return 'Conteúdo';
  }
}

function isCompleted(item: JourneyItem) {
  return item.user_status === 'submitted' || item.user_status === 'completed';
}

function isTrackableItem(item: JourneyItem) {
  return item.item_type === 'survey' || item.item_type === 'document_request';
}

function getJourneyItemLink(item: JourneyItem | null) {
  if (!item) return '/employee/journey';
  return `/employee/journey?item=${item.id}`;
}

export function EmployeeDashboard() {
  const { token, user } = useAuth();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const authToken = token;

    async function load() {
      setIsLoading(true);
      setError(null);

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
        setError(
          err instanceof ApiError ? err.message : 'Não foi possível carregar a área do colaborador.',
        );
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [token]);

  const allItems = useMemo<JourneyItem[]>(
    () => journey?.sections.flatMap((section) => section.items) ?? [],
    [journey],
  );

  const trackableItems = useMemo(
    () => allItems.filter(isTrackableItem),
    [allItems],
  );

  const completedCount = useMemo(() => trackableItems.filter(isCompleted).length, [trackableItems]);
  const totalCount = trackableItems.length;
  const progressPct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  const nextItem = useMemo<JourneyItem | null>(
    () => trackableItems.find((item) => !isCompleted(item)) ?? allItems[0] ?? null,
    [allItems, trackableItems],
  );

  const firstSurveyItem = useMemo<JourneyItem | null>(
    () => allItems.find((item) => item.item_type === 'survey') ?? null,
    [allItems],
  );

  const firstContentItem = useMemo<JourneyItem | null>(
    () =>
      allItems.find((item) =>
        ['text', 'video', 'presentation', 'document_request'].includes(item.item_type),
      ) ?? null,
    [allItems],
  );

  const firstName = user?.name?.split(' ')[0] ?? 'colaborador';

  return (
    <AppShell
      eyebrow="Plataforma turi"
      title={`Olá, ${firstName}`}
      description="Acompanhe sua jornada, retome de onde parou e responda às pesquisas no seu ritmo."
      navigation={employeeNavigation}
    >
      {error ? <div className="form-error">{error}</div> : null}

      {isLoading ? (
        <section className="emp-hero">
          <div className="emp-hero__copy">
            <span className="emp-hero__eyebrow">Sua jornada</span>
            <h2>Preparando sua visão geral...</h2>
            <p>Estamos buscando suas etapas, pesquisas e conteúdos disponíveis.</p>

            <div className="emp-progress" role="progressbar" aria-valuenow={0} aria-valuemin={0} aria-valuemax={100}>
              <div className="emp-progress__track">
                <div className="emp-progress__fill" style={{ width: '12%' }} />
              </div>
              <span className="emp-progress__value">...</span>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="emp-hero">
            <div className="emp-hero__copy">
              <span className="emp-hero__eyebrow">Sua jornada</span>
              <h2>
                {totalCount === 0
                  ? 'Sua jornada ainda está sendo preparada'
                  : completedCount === totalCount
                    ? 'Você concluiu todas as etapas 🎉'
                    : `Você concluiu ${completedCount} de ${totalCount} etapas`}
              </h2>
              <p>
                {totalCount === 0
                  ? 'Em breve liberaremos os primeiros conteúdos por aqui.'
                  : 'Continue avançando para liberar os próximos conteúdos e pesquisas.'}
              </p>

              <div
                className="emp-progress"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="emp-progress__track">
                  <div className="emp-progress__fill" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="emp-progress__value">{progressPct}%</span>
              </div>
            </div>

            {nextItem ? (
              <Link
                to={getJourneyItemLink(nextItem)}
                className="emp-hero__next"
                aria-label={`Continuar: ${nextItem.title}`}
              >
                <span className="emp-hero__next-eyebrow">
                  {completedCount === 0 ? 'Começar pela' : 'Continuar de onde parou'}
                </span>
                <div className="emp-hero__next-row">
                  <span className="emp-hero__next-icon">{itemTypeIcon(nextItem)}</span>
                  <div className="emp-hero__next-copy">
                    <strong>{nextItem.title}</strong>
                    <span>
                      {itemTypeLabel(nextItem)}
                      {nextItem.is_required ? ' · Obrigatório' : ''}
                    </span>
                  </div>
                  <MoveRight size={18} className="emp-hero__next-arrow" />
                </div>
              </Link>
            ) : (
              <Link to="/employee/journey" className="emp-hero__next emp-hero__next--done">
                <span className="emp-hero__next-eyebrow">Revisitar</span>
                <div className="emp-hero__next-row">
                  <span className="emp-hero__next-icon">
                    <CheckCircle2 size={18} />
                  </span>
                  <div className="emp-hero__next-copy">
                    <strong>{totalCount ? 'Jornada concluída' : 'Jornada em preparação'}</strong>
                    <span>{totalCount ? 'Acessar tudo novamente' : 'Ver detalhes'}</span>
                  </div>
                  <MoveRight size={18} className="emp-hero__next-arrow" />
                </div>
              </Link>
            )}
          </section>

          <div className="stats-grid">
            <Link to="/employee/journey" className="stat-link">
              <StatCard
                label="Etapas da jornada"
                value={totalCount}
                meta={`${completedCount} concluídas`}
                icon={<RouteIcon size={18} />}
              />
            </Link>

            <Link to={getJourneyItemLink(firstSurveyItem)} className="stat-link">
              <StatCard
                label="Pesquisas"
                value={forms.length}
                meta="Pulse e diagnósticos"
                icon={<ClipboardList size={18} />}
              />
            </Link>

            <Link to={getJourneyItemLink(firstContentItem)} className="stat-link">
              <StatCard
                label="Conteúdos"
                value={presentations.length}
                meta="Apresentações e materiais"
                icon={<Sparkles size={18} />}
              />
            </Link>
          </div>

          <SectionPanel
            title="Próximas etapas"
            eyebrow="Continuar a jornada"
            action={
              <Link to="/employee/journey" className="secondary-link">
                ver jornada completa
              </Link>
            }
          >
            {trackableItems.length ? (
              <ul className="emp-steps">
                {trackableItems.slice(0, 4).map((item) => {
                  const done = isCompleted(item);

                  return (
                    <li key={item.id} className={`emp-step ${done ? 'is-done' : ''}`}>
                      <Link to={getJourneyItemLink(item)} className="emp-step__link">
                        <span className="emp-step__icon" aria-hidden>
                          {done ? <CheckCircle2 size={16} /> : itemTypeIcon(item)}
                        </span>
                        <div className="emp-step__copy">
                          <strong>{item.title}</strong>
                          <span>
                            {itemTypeLabel(item)}
                            {item.description ? ` · ${item.description}` : ''}
                          </span>
                        </div>
                        <ArrowUpRight size={16} className="emp-step__arrow" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title="Jornada em preparação"
                description="Quando a consultoria liberar os conteúdos, eles aparecerão aqui."
              />
            )}
          </SectionPanel>

          <div className="content-grid">
            <SectionPanel
              title="Pesquisas disponíveis"
              eyebrow="Formulários"
              action={
                <Link to={getJourneyItemLink(firstSurveyItem)} className="secondary-link">
                  ver na jornada
                </Link>
              }
            >
              {forms.length ? (
                <div className="list">
                  {forms.slice(0, 3).map((form) => (
                    <article key={form.id} className="list-item list-item--rich">
                      <span className="list-item__icon">
                        <ClipboardList size={16} />
                      </span>
                      <div className="list-item__copy">
                        <strong>{form.title}</strong>
                        <p>{form.description || 'Pesquisa sem descrição.'}</p>
                      </div>
                      <StatusPill>{form.audience}</StatusPill>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Nenhuma pesquisa liberada"
                  description="As pesquisas da jornada do colaborador vão aparecer aqui."
                />
              )}
            </SectionPanel>

            <SectionPanel
              title="Conteúdos de apoio"
              eyebrow="Apresentações"
              action={
                <Link to={getJourneyItemLink(firstContentItem)} className="secondary-link">
                  ver na jornada
                </Link>
              }
            >
              {presentations.length ? (
                <div className="list">
                  {presentations.slice(0, 3).map((presentation) => (
                    <article key={presentation.id} className="list-item list-item--rich">
                      <span className="list-item__icon">
                        <PresentationIcon size={16} />
                      </span>
                      <div className="list-item__copy">
                        <strong>{presentation.title}</strong>
                        <p>{presentation.description || 'Sem descrição.'}</p>
                      </div>
                      {presentation.file_url ? (
                        <a
                          href={presentation.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="secondary-link"
                        >
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
                  title="Sem conteúdos ainda"
                  description="As apresentações e os materiais da jornada vão aparecer aqui."
                />
              )}
            </SectionPanel>
          </div>
        </>
      )}
    </AppShell>
  );
}
