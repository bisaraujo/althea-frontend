import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export type ProjectCalendarEvent = {
  id: string;
  title: string;
  sectionTitle: string;
  startsAt: string | null;
  endsAt: string | null;
  group: 'manager' | 'employee';
  itemType: 'survey' | 'document_request' | string;
  status?: string | null;
  href?: string | null;
  responseCount?: number | null;
  expectedCount?: number | null;
  submittedAt?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  submissionNotes?: string | null;
  submittedBy?: string | null;
  submittedByEmail?: string | null;
};

type CalendarDay = {
  date: Date;
  key: string;
  inMonth: boolean;
};

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

function parseDate(value?: string | null) {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(date, mondayOffset);
}

function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 6);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return 'sem data';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function formatFullDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(date);
}

function formatDayNumber(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
  }).format(date);
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function eventDate(event: ProjectCalendarEvent) {
  return parseDate(event.endsAt) ?? parseDate(event.startsAt);
}

function buildMonthDays(monthDate: Date): CalendarDay[] {
  const monthStart = startOfMonth(monthDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(endOfMonth(monthDate));
  const days: CalendarDay[] = [];

  for (let date = calendarStart; date <= calendarEnd; date = addDays(date, 1)) {
    const current = new Date(date);
    days.push({
      date: current,
      key: dateKey(current),
      inMonth: current.getMonth() === monthDate.getMonth(),
    });
  }

  return days;
}

function eventLabel(event: ProjectCalendarEvent) {
  if (event.itemType === 'document_request') return 'Documento';
  if (event.itemType === 'survey') return 'Formulário';
  return event.group === 'manager' ? 'Empresa' : 'Colaborador';
}

function eventStatusClass(status?: string | null) {
  if (status === 'submitted') return 'is-submitted';
  if (status === 'submitted_late') return 'is-submitted-late';
  if (status === 'overdue') return 'is-overdue';
  if (status === 'pending') return 'is-pending';
  return 'is-planned';
}

function statusLabel(status?: string | null) {
  if (status === 'submitted') return 'Concluído';
  if (status === 'submitted_late') return 'Concluído com atraso';
  if (status === 'overdue') return 'Atrasado';
  if (status === 'pending') return 'Pendente';
  return 'Planejado';
}

function StatusIcon({ status }: { status?: string | null }) {
  if (status === 'submitted' || status === 'submitted_late') return <CheckCircle2 size={14} />;
  if (status === 'overdue') return <AlertTriangle size={14} />;
  return <Clock3 size={14} />;
}

function formatRange(event: ProjectCalendarEvent) {
  const start = formatDate(event.startsAt);
  const end = formatDate(event.endsAt);
  if (start === end) return `Prazo ${end}`;
  return `${start} até ${end}`;
}

function eventProgress(event: ProjectCalendarEvent) {
  if (event.itemType === 'survey') {
    const done = event.responseCount ?? 0;
    const expected = event.expectedCount ?? 0;
    return `${done}/${expected} respostas`;
  }

  if (event.submittedAt) {
    return `Enviado em ${formatDate(event.submittedAt)}`;
  }

  return event.group === 'manager' ? 'Entrega da empresa' : 'Entrega do colaborador';
}

function sortEventsByDate(events: ProjectCalendarEvent[]) {
  return [...events].sort((a, b) => {
    const aDate = eventDate(a)?.getTime() ?? 0;
    const bDate = eventDate(b)?.getTime() ?? 0;
    if (aDate !== bDate) return aDate - bDate;
    return a.title.localeCompare(b.title);
  });
}

export function ProjectCalendar({
  events,
  projectName,
}: {
  events: ProjectCalendarEvent[];
  projectName?: string;
}) {
  const visibleEvents = useMemo(
    () => sortEventsByDate(events.filter((event) => eventDate(event))),
    [events],
  );
  const eventSignature = visibleEvents
    .map((event) => `${event.id}:${event.endsAt ?? event.startsAt ?? ''}:${event.status ?? ''}`)
    .join('|');
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const firstDate = visibleEvents[0] ? eventDate(visibleEvents[0]) : null;
    return startOfMonth(firstDate ?? new Date());
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() => {
    const firstDate = visibleEvents[0] ? eventDate(visibleEvents[0]) : null;
    return dateKey(firstDate ?? new Date());
  });
  const [documentPreview, setDocumentPreview] = useState<ProjectCalendarEvent | null>(null);

  useEffect(() => {
    const today = new Date();
    const todayKey = dateKey(today);
    const eventToday = visibleEvents.find((event) => {
      const date = eventDate(event);
      return date ? dateKey(date) === todayKey : false;
    });
    const preferredEvent = eventToday ?? visibleEvents[0];
    const preferredDate = preferredEvent ? eventDate(preferredEvent) ?? today : today;

    setVisibleMonth(startOfMonth(preferredDate));
    setSelectedDateKey(dateKey(preferredDate));
  }, [eventSignature]);

  if (!visibleEvents.length) {
    return (
      <div className="project-calendar project-calendar--empty">
        <CalendarClock size={20} />
        <strong>Cronograma em preparação</strong>
        <span>As datas aparecem aqui quando as entregas tiverem início e prazo definidos.</span>
      </div>
    );
  }

  const days = buildMonthDays(visibleMonth);
  const selectedDate = parseDate(selectedDateKey) ?? visibleMonth;
  const selectedEvents = visibleEvents.filter((event) => {
    const date = eventDate(event);
    return date ? dateKey(date) === selectedDateKey : false;
  });
  const monthEvents = visibleEvents.filter((event) => {
    const date = eventDate(event);
    return date ? date.getMonth() === visibleMonth.getMonth() && date.getFullYear() === visibleMonth.getFullYear() : false;
  });

  return (
    <div className="project-calendar">
      <div className="project-calendar__top">
        <div>
          <span className="project-calendar__eyebrow">Calendário</span>
          <strong>{formatMonth(visibleMonth)}</strong>
          {projectName ? <small>{projectName}</small> : null}
        </div>

        <div className="project-calendar__controls">
          <button type="button" onClick={() => setVisibleMonth((current) => addMonths(current, -1))} aria-label="Mês anterior">
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              setVisibleMonth(startOfMonth(today));
              setSelectedDateKey(dateKey(today));
            }}
          >
            Hoje
          </button>
          <button type="button" onClick={() => setVisibleMonth((current) => addMonths(current, 1))} aria-label="Próximo mês">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="project-calendar__legend" aria-label="Legenda do cronograma">
        <span className="project-calendar__legend-item project-calendar__legend-item--pending">Pendente</span>
        <span className="project-calendar__legend-item project-calendar__legend-item--overdue">Atrasado</span>
        <span className="project-calendar__legend-item project-calendar__legend-item--submitted">Concluído</span>
      </div>

      <div className="project-calendar__body">
        <div className="project-calendar__grid">
          {WEEKDAYS.map((weekday) => (
            <span key={weekday} className="project-calendar__weekday">{weekday}</span>
          ))}

          {days.map((day) => {
            const dayEvents = visibleEvents.filter((event) => {
              const date = eventDate(event);
              return date ? dateKey(date) === day.key : false;
            });
            const shownDots = dayEvents.slice(0, 5);
            const hiddenCount = Math.max(dayEvents.length - shownDots.length, 0);
            const isSelected = day.key === selectedDateKey;
            const isToday = day.key === dateKey(new Date());

            return (
              <button
                type="button"
                key={day.key}
                className={[
                  'project-calendar__day',
                  day.inMonth ? '' : 'is-outside',
                  dayEvents.length ? 'has-events' : '',
                  isSelected ? 'is-selected' : '',
                  isToday ? 'is-today' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => setSelectedDateKey(day.key)}
                aria-pressed={isSelected}
              >
                <span className="project-calendar__day-number">{formatDayNumber(day.date)}</span>
                <span className="project-calendar__dots" aria-label={`${dayEvents.length} entregas neste dia`}>
                  {shownDots.map((event) => (
                    <span
                      key={`${event.id}-${day.key}`}
                      className={`project-calendar__dot ${eventStatusClass(event.status)}`}
                      title={`${event.title} - ${statusLabel(event.status)}`}
                    />
                  ))}
                  {hiddenCount ? <span className="project-calendar__more">+{hiddenCount}</span> : null}
                </span>
              </button>
            );
          })}
        </div>

        <aside className="project-calendar__day-panel">
          <div className="project-calendar__day-panel-head">
            <span>{formatFullDate(selectedDate)}</span>
            <strong>
              {selectedEvents.length
                ? `${selectedEvents.length} entrega${selectedEvents.length === 1 ? '' : 's'}`
                : 'Nenhuma entrega'}
            </strong>
            <em>{monthEvents.length} entrega{monthEvents.length === 1 ? '' : 's'} neste mês</em>
          </div>

          {selectedEvents.length ? (
            <div className="project-calendar__day-list">
              {selectedEvents.map((event) => {
                const eventNode = (
                  <article className={`project-calendar__detail-item ${eventStatusClass(event.status)}`}>
                    <div className="project-calendar__detail-status">
                      <StatusIcon status={event.status} />
                      <span>{statusLabel(event.status)}</span>
                    </div>
                    <strong>{event.title}</strong>
                    <p>{event.sectionTitle}</p>
                    <div className="project-calendar__detail-meta">
                      <span>{eventLabel(event)}</span>
                      <span>{formatRange(event)}</span>
                      <span>{eventProgress(event)}</span>
                    </div>
                    {event.fileUrl ? (
                      <button
                        type="button"
                        className="project-calendar__file-button"
                        onClick={() => setDocumentPreview(event)}
                      >
                        <FileText size={14} />
                        <span>Ver arquivo enviado</span>
                      </button>
                    ) : null}
                  </article>
                );

                return event.href && !event.fileUrl ? (
                  <a key={event.id} href={event.href} className="project-calendar__detail-link">
                    {eventNode}
                  </a>
                ) : (
                  <div key={event.id} className="project-calendar__detail-link">
                    {eventNode}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="project-calendar__day-empty">
              <CalendarClock size={18} />
              <span>Selecione outro dia com marcador para ver as entregas do projeto.</span>
            </div>
          )}
        </aside>
      </div>

      {documentPreview ? createPortal(
        <div className="document-preview" role="presentation" onClick={() => setDocumentPreview(null)}>
          <section
            className="document-preview__dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Arquivo enviado"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="document-preview__close"
              aria-label="Fechar"
              onClick={() => setDocumentPreview(null)}
            >
              <X size={16} />
            </button>

            <div className="document-preview__icon">
              <FileText size={22} />
            </div>

            <div className="document-preview__copy">
              <span>{statusLabel(documentPreview.status)}</span>
              <h3>{documentPreview.title}</h3>
              <p>{documentPreview.sectionTitle}</p>
            </div>

            <dl className="document-preview__meta">
              <div>
                <dt>Arquivo</dt>
                <dd>{documentPreview.fileName ?? 'Arquivo enviado'}</dd>
              </div>
              <div>
                <dt>Enviado por</dt>
                <dd>
                  {documentPreview.submittedBy ?? 'Gestor'}
                  {documentPreview.submittedByEmail ? <small>{documentPreview.submittedByEmail}</small> : null}
                </dd>
              </div>
              <div>
                <dt>Data</dt>
                <dd>{documentPreview.submittedAt ? formatDate(documentPreview.submittedAt) : 'Sem registro'}</dd>
              </div>
            </dl>

            {documentPreview.submissionNotes ? (
              <div className="document-preview__notes">
                <strong>Observações</strong>
                <p>{documentPreview.submissionNotes}</p>
              </div>
            ) : null}

            {documentPreview.fileUrl ? (
              <a href={documentPreview.fileUrl} target="_blank" rel="noreferrer" className="primary-button">
                <ExternalLink size={16} />
                Abrir arquivo
              </a>
            ) : null}
          </section>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
