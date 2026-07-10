import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CirclePlay,
  FileText,
  FileUp,
  House,
  MoveRight,
  Route as RouteIcon,
  Upload,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getManagerCompanyJourney, getManagerEmployees } from '../api/services';
import type { EmployeeRecord, Journey, JourneyItem } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { AppShell } from '../components/app-shell';
import { EmptyState } from '../components/empty-state';
import { SectionPanel } from '../components/section-panel';
import { StatCard } from '../components/stat-card';
import { StatusPill } from '../components/status-pill';

const managerNavigation = [
  { to: '/manager', label: 'Visão geral', icon: House },
  { to: '/manager/journey', label: 'Minha jornada', icon: RouteIcon },
  { to: '/manager/company-journey', label: 'Jornada da empresa', icon: FileUp },
  { to: '/manager/schedule', label: 'Cronograma', icon: CalendarClock },
];

type JourneyItemWithSection = JourneyItem & {
  sectionTitle: string;
};

function isDeliveryItem(item: JourneyItem) {
  return item.item_type === 'document_request';
}

function isDelivered(item: JourneyItem) {
  return ['submitted', 'submitted_late', 'completed'].includes(item.user_status ?? '');
}

function itemTypeIcon(item: JourneyItem) {
  if (item.item_type === 'document_request') return <FileUp size={16} />;
  if (item.item_type === 'text') return <FileText size={16} />;
  return <CirclePlay size={16} />;
}

function itemTypeLabel(item: JourneyItem) {
  if (item.item_type === 'document_request') return 'Documento';
  if (item.item_type === 'text') return 'Orientação';
  return 'Etapa';
}

function statusLabel(status?: string) {
  if (status === 'submitted') return 'Enviado';
  if (status === 'submitted_late') return 'Enviado atrasado';
  if (status === 'overdue') return 'Atrasado';
  if (status === 'pending') return 'Pendente';
  if (status === 'available') return 'Disponível';
  return 'Não iniciado';
}

function statusTone(status?: string) {
  if (status === 'submitted' || status === 'completed') return 'success' as const;
  if (status === 'submitted_late' || status === 'overdue' || status === 'pending') {
    return 'warning' as const;
  }
  return 'muted' as const;
}

function itemLink(item: JourneyItem | null) {
  if (!item) return '/manager/company-journey';
  return `/manager/company-journey?item=${item.id}`;
}

export function ManagerDashboard() {
  const { token, user } = useAuth();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
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
        const [journeyData, employeeData] = await Promise.all([
          getManagerCompanyJourney(authToken),
          getManagerEmployees(authToken),
        ]);

        setJourney(journeyData);
        setEmployees(employeeData.employees);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : 'Não foi possível carregar a área do gestor.',
        );
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [token]);

  const allItems = useMemo<JourneyItemWithSection[]>(
    () =>
      journey?.sections.flatMap((section) =>
        section.items.map((item) => ({ ...item, sectionTitle: section.title })),
      ) ?? [],
    [journey],
  );

  const deliveries = useMemo(
    () => allItems.filter(isDeliveryItem),
    [allItems],
  );

  const deliveredCount = useMemo(
    () => deliveries.filter(isDelivered).length,
    [deliveries],
  );
  const pendingCount = deliveries.filter((item) => item.user_status === 'pending').length;
  const overdueCount = deliveries.filter((item) => item.user_status === 'overdue').length;
  const progressPct = deliveries.length ? Math.round((deliveredCount / deliveries.length) * 100) : 0;

  const nextItem = useMemo<JourneyItem | null>(
    () => deliveries.find((item) => !isDelivered(item)) ?? allItems[0] ?? null,
    [allItems, deliveries],
  );

  const firstGuidance = useMemo<JourneyItem | null>(
    () => allItems.find((item) => item.item_type === 'text') ?? null,
    [allItems],
  );

  const visibleSteps = useMemo(() => {
    const pending = allItems.filter((item) => item.item_type === 'text' || !isDelivered(item));
    return (pending.length ? pending : allItems).slice(0, 5);
  }, [allItems]);

  const firstName = user?.name?.split(' ')[0] ?? 'gestor';

  if (!user) {
    return null;
  }

  return (
    <AppShell
      eyebrow="Gestor"
      title={`Olá, ${firstName}`}
      description="Acompanhe o projeto, veja as próximas entregas e avance pela jornada documental."
      navigation={managerNavigation}
    >
      {error ? <div className="form-error">{error}</div> : null}

      {isLoading ? (
        <section className="emp-hero">
          <div className="emp-hero__copy">
            <span className="emp-hero__eyebrow">Sua jornada</span>
            <h2>Preparando sua visão geral...</h2>
            <p>Estamos buscando as etapas, prazos e entregas disponíveis para o seu projeto.</p>
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
              <span className="emp-hero__eyebrow">Entregas do projeto</span>
              <h2>
                {deliveries.length === 0
                  ? 'Sua jornada ainda está sendo preparada'
                  : deliveredCount === deliveries.length
                    ? 'Todas as entregas foram registradas'
                    : `${deliveredCount} de ${deliveries.length} entregas enviadas`}
              </h2>
              <p>
                {deliveries.length === 0
                  ? 'Quando o cronograma documental estiver ativo, as entregas aparecem aqui.'
                  : 'Use a jornada para baixar modelos, enviar arquivos e manter o registro do projeto em dia.'}
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
                to={itemLink(nextItem)}
                className="emp-hero__next"
                aria-label={`Continuar: ${nextItem.title}`}
              >
                <span className="emp-hero__next-eyebrow">
                  {deliveredCount === 0 ? 'Começar pela' : 'Próxima ação'}
                </span>
                <div className="emp-hero__next-row">
                  <span className="emp-hero__next-icon">{itemTypeIcon(nextItem)}</span>
                  <div className="emp-hero__next-copy">
                    <strong>{nextItem.document_title ?? nextItem.title}</strong>
                    <span>
                      {itemTypeLabel(nextItem)}
                      {nextItem.is_required ? ' - Obrigatório' : ''}
                    </span>
                  </div>
                  <MoveRight size={18} className="emp-hero__next-arrow" />
                </div>
              </Link>
            ) : (
              <Link to="/manager/company-journey" className="emp-hero__next emp-hero__next--done">
                <span className="emp-hero__next-eyebrow">Revisitar</span>
                <div className="emp-hero__next-row">
                  <span className="emp-hero__next-icon">
                    <CheckCircle2 size={18} />
                  </span>
                  <div className="emp-hero__next-copy">
                    <strong>Jornada em preparação</strong>
                    <span>Ver detalhes</span>
                  </div>
                  <MoveRight size={18} className="emp-hero__next-arrow" />
                </div>
              </Link>
            )}
          </section>

          <div className="stats-grid">
            <Link to="/manager/company-journey" className="stat-link">
              <StatCard
                label="Entregas"
                value={deliveries.length}
                meta={`${deliveredCount} enviadas`}
                icon={<FileUp size={18} />}
              />
            </Link>

            <Link to="/manager/company-journey" className="stat-link">
              <StatCard
                label="Pendentes"
                value={pendingCount}
                meta="Dentro do prazo"
                icon={<CalendarClock size={18} />}
              />
            </Link>

            <Link to="/manager/company-journey" className="stat-link">
              <StatCard
                label="Atrasadas"
                value={overdueCount}
                meta="Precisam de atenção"
                icon={<Upload size={18} />}
              />
            </Link>

            <StatCard
              label="Equipe"
              value={employees.length}
              meta="Colaboradores vinculados"
              icon={<Users size={18} />}
            />
          </div>

          <SectionPanel
            title="Próximas etapas"
            eyebrow="Continuar a jornada"
            action={
              <Link to="/manager/company-journey" className="secondary-link">
                ver jornada completa
              </Link>
            }
          >
            {visibleSteps.length ? (
              <ul className="emp-steps">
                {visibleSteps.map((item) => {
                  const done = isDelivered(item);

                  return (
                    <li key={item.id} className={`emp-step ${done ? 'is-done' : ''}`}>
                      <Link to={itemLink(item)} className="emp-step__link">
                        <span className="emp-step__icon" aria-hidden>
                          {done ? <CheckCircle2 size={16} /> : itemTypeIcon(item)}
                        </span>
                        <div className="emp-step__copy">
                          <strong>{item.document_title ?? item.title}</strong>
                          <span>
                            {item.sectionTitle} - {statusLabel(item.user_status)}
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
                description="Quando as entregas do projeto forem liberadas, elas aparecerão aqui."
              />
            )}
          </SectionPanel>

          <div className="content-grid">
            <SectionPanel
              title="Alinhamento"
              eyebrow="Início do projeto"
              action={
                <Link to={itemLink(firstGuidance)} className="secondary-link">
                  abrir na jornada
                </Link>
              }
            >
              {firstGuidance ? (
                <article className="list-item list-item--rich">
                  <span className="list-item__icon">
                    <FileText size={16} />
                  </span>
                  <div className="list-item__copy">
                    <strong>{firstGuidance.title}</strong>
                    <p>{firstGuidance.description || firstGuidance.content_text || 'Orientação inicial do projeto.'}</p>
                  </div>
                  <StatusPill tone={statusTone(firstGuidance.user_status)}>
                    {statusLabel(firstGuidance.user_status)}
                  </StatusPill>
                </article>
              ) : (
                <EmptyState
                  title="Sem orientações ainda"
                  description="As orientações iniciais do gestor aparecerão aqui."
                />
              )}
            </SectionPanel>

            <SectionPanel
              title="Equipe do projeto"
              eyebrow="Pessoas"
              action={<StatusPill>{employees.length} pessoas</StatusPill>}
            >
              {employees.length ? (
                <div className="list">
                  {employees.slice(0, 4).map((employee) => (
                    <article key={employee.id} className="list-item">
                      <div>
                        <strong>{employee.name}</strong>
                        <p>{employee.email}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Sem funcionários vinculados"
                  description="Quando o projeto tiver colaboradores associados, eles aparecerão aqui."
                />
              )}
            </SectionPanel>
          </div>
        </>
      )}
    </AppShell>
  );
}
