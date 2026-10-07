import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  CheckCircle2,
  CirclePlay,
  Download,
  FileText,
  Folder,
  FolderOpen,
  Lock,
  Menu,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import {
  approveManagerCompanyJourneyItem,
  completeManagerCompanyJourneyItem,
  getManagerCompanyJourney,
  uploadManagerDocumentFile,
} from '../api/services';
import type { Journey, JourneyItem, JourneySection } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { BrandLockup } from '../components/brand';
import { StatusPill } from '../components/status-pill';
import { StoredFileLink } from '../components/stored-file-link';

type JourneyItemWithSection = JourneyItem & {
  sectionTitle?: string;
};

type UploadDraft = {
  file: File | null;
  notes: string;
};

type ScheduleApprovalEvent = {
  kind: 'stage' | 'delivery' | 'approval' | string;
  title: string;
  section?: string | null;
  available_from?: string | null;
  due_at?: string | null;
};

type TemplateInfo = {
  title: string;
  description: string;
  href: string | null;
  formats: string[];
};

const TEMPLATE_CATALOG: Array<TemplateInfo & { keywords: string[] }> = [
  {
    keywords: ['colaboradores', 'participantes'],
    title: 'Modelo de quadro de colaboradores',
    description: 'Planilha padrão para nome, e-mail, cargo, área e dados de participação.',
    href: '/templates/quadro-colaboradores.csv',
    formats: ['csv'],
  },
  {
    keywords: ['kpi', 'indicadores'],
    title: 'Modelo de levantamento de KPIs',
    description: 'Base simples para indicadores, fonte, período e responsável pelo dado.',
    href: '/templates/kpis.csv',
    formats: ['csv'],
  },
  {
    keywords: ['benefícios', 'custos'],
    title: 'Modelo de benefícios e custos',
    description: 'Estrutura para registrar benefícios, abrangência, custo e observações.',
    href: '/templates/beneficios-custos.csv',
    formats: ['csv'],
  },
  {
    keywords: ['escalas', 'horas extras'],
    title: 'Modelo de escalas e horas extras',
    description: 'Planilha para turnos, jornada contratual, horas extras e período analisado.',
    href: '/templates/escalas-horas-extras.csv',
    formats: ['csv'],
  },
  {
    keywords: ['job descriptions', 'descrições de cargo', 'cargos'],
    title: 'Modelo de descrições de cargo',
    description: 'Base para cargo, área, responsabilidades, requisitos e objetivos.',
    href: '/templates/descricoes-cargo.csv',
    formats: ['csv'],
  },
];

function isDeliveryItem(item: JourneyItem) {
  return item.item_type === 'document_request';
}

function isDelivered(item: JourneyItem) {
  return ['submitted', 'submitted_late', 'completed', 'approved'].includes(item.user_status ?? '');
}

function isIntroItem(item: JourneyItem) {
  return item.item_type === 'text' && item.order === 0;
}

function isCompletableContentItem(item: JourneyItem) {
  return ['text', 'video', 'presentation'].includes(item.item_type);
}

function getResumeItem(items: JourneyItem[]) {
  return (
    items.find((item) => item.user_status !== 'locked' && !isDelivered(item)) ??
    items.find((item) => item.user_status !== 'locked') ??
    items[0] ??
    null
  );
}

function getActionItems(section: JourneySection) {
  return section.items.filter((item) => !isIntroItem(item) && item.item_type !== 'meeting_approval');
}

function getSidebarItems(section: JourneySection) {
  return section.items.filter((item) => item.item_type !== 'meeting_approval');
}

function getSidebarItemTitle(item: JourneyItem) {
  if (isIntroItem(item)) return 'Texto da sessão';
  return item.document_title ?? item.title;
}

function getItemIcon(item: JourneyItem) {
  if (item.item_type === 'document_request') return <Upload size={14} />;
  if (item.item_type === 'schedule_approval') return <CalendarDays size={14} />;
  if (item.item_type === 'text') return <FileText size={14} />;
  return <CirclePlay size={14} />;
}

function getItemTypeLabel(item: JourneyItem) {
  if (item.item_type === 'document_request') return 'Documento';
  if (item.item_type === 'schedule_approval') return 'Aprovação do cronograma';
  if (item.item_type === 'text') return 'Orientação';
  return 'Etapa';
}

function getStatusTone(status?: string) {
  if (status === 'submitted' || status === 'completed' || status === 'approved') return 'success' as const;
  if (status === 'submitted_late' || status === 'overdue' || status === 'pending' || status === 'changes_requested') {
    return 'warning' as const;
  }
  if (status === 'locked') return 'muted' as const;
  return 'default' as const;
}

function getStatusLabel(status?: string) {
  if (status === 'submitted') return 'Enviado';
  if (status === 'submitted_late') return 'Enviado atrasado';
  if (status === 'completed') return 'Concluído';
  if (status === 'approved') return 'Aprovado';
  if (status === 'changes_requested') return 'Ajustes solicitados';
  if (status === 'overdue') return 'Atrasado';
  if (status === 'pending') return 'Pendente';
  if (status === 'available') return 'Disponível';
  if (status === 'locked') return 'Bloqueado';
  return 'Não iniciado';
}

function getTaskVisualState(item: JourneyItem) {
  if (item.user_status === 'overdue' || item.user_status === 'submitted_late') return 'overdue';
  if (isDelivered(item)) return 'done';
  return 'scheduled';
}

function getTaskVisualIcon(item: JourneyItem) {
  const state = getTaskVisualState(item);
  if (state === 'done') return <CheckCircle2 size={16} />;
  if (state === 'overdue') return <AlertTriangle size={16} />;
  return <CalendarClock size={16} />;
}

function normalizeSearchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getTemplateInfo(item: JourneyItem): TemplateInfo | null {
  const haystack = normalizeSearchText(
    `${item.title} ${item.document_title ?? ''} ${item.description ?? ''}`,
  );

  const template = TEMPLATE_CATALOG.find((entry) =>
    entry.keywords.some((keyword) => haystack.includes(normalizeSearchText(keyword))),
  );

  if (template) {
    const { keywords: _keywords, ...templateInfo } = template;
    return templateInfo;
  }

  const spreadsheetFormats = item.accepted_formats.filter((format) =>
    ['csv', 'xlsx', 'xls'].includes(format.toLowerCase()),
  );

  if (!spreadsheetFormats.length) {
    return null;
  }

  return {
    title: 'Modelo padrão da entrega',
    description: 'Use o formato combinado com a consultoria para manter os dados estruturados.',
    href: null,
    formats: spreadsheetFormats,
  };
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

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function acceptedFormatAttribute(formats: string[]) {
  const formatMap: Record<string, string> = {
    csv: '.csv',
    doc: '.doc',
    docx: '.docx',
    jpg: '.jpg,.jpeg',
    jpeg: '.jpg,.jpeg',
    pdf: '.pdf',
    png: '.png',
    xls: '.xls',
    xlsx: '.xlsx',
  };

  return formats
    .flatMap((format) => {
      const normalized = format.toLowerCase().replace(/^\./, '');
      return formatMap[normalized] ?? `.${normalized}`;
    })
    .join(',');
}

function parseApiError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Não foi possível concluir a ação.';
}

function getScheduleApprovalEvents(item: JourneyItem): ScheduleApprovalEvent[] {
  const events = item.extra_metadata?.events;
  if (!Array.isArray(events)) return [];

  return events.filter((event): event is ScheduleApprovalEvent => {
    if (!event || typeof event !== 'object') return false;
    const candidate = event as Record<string, unknown>;
    return typeof candidate.title === 'string' && typeof candidate.kind === 'string';
  });
}

function scheduleEventKindLabel(kind: string) {
  if (kind === 'stage') return 'Etapa';
  if (kind === 'delivery') return 'Entrega';
  if (kind === 'approval') return 'Aprovação';
  return 'Evento';
}

function RichText({ text }: { text?: string | null }) {
  if (!text) return null;

  return (
    <div className="rich-text">
      {text.split(/\n{2,}/).map((paragraph, index) => {
        const clean = paragraph.trim();
        if (!clean) return null;
        return <p key={`${index}-${clean.slice(0, 16)}`}>{clean}</p>;
      })}
    </div>
  );
}

function SectionActions({
  items,
  selectedId,
  onSelect,
}: {
  items: JourneyItem[];
  selectedId: string;
  onSelect: (itemId: string) => void;
}) {
  if (!items.length) {
    return (
      <div className="journey-section-actions journey-section-actions--empty">
        <CheckCircle2 size={18} />
        <span>Esta sessão é apenas informativa.</span>
      </div>
    );
  }

  return (
    <div className="journey-section-actions">
      <div className="journey-section-actions__head">
        <span>Ações desta sessão</span>
        <strong>{items.filter(isDelivered).length} de {items.length} concluídas</strong>
      </div>

      <div className="journey-section-actions__list">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`journey-section-action is-${getTaskVisualState(item)} ${
              item.id === selectedId ? 'is-active' : ''
            }`}
            onClick={() => onSelect(item.id)}
          >
            <span className="journey-section-action__icon">
              {getTaskVisualIcon(item)}
            </span>
            <span className="journey-section-action__copy">
              <strong>{item.document_title ?? item.title}</strong>
              <em>{getItemTypeLabel(item)} - {getStatusLabel(item.user_status)}</em>
            </span>
            <ArrowRight size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}

function JourneyLoadingShell() {
  return (
    <div className="journey-workspace">
      <aside className="journey-nav">
        <div className="journey-nav__top">
          <div className="journey-nav__brand">
            <BrandLockup tone="light" subtitle="Jornada da empresa" />
          </div>

          <Link to="/manager" className="journey-nav__back">
            <ArrowLeft size={16} />
            <span>Voltar para a visão geral</span>
          </Link>

          <div className="journey-nav__progress journey-skeleton">
            <div className="journey-skeleton__line" />
            <div className="journey-skeleton__bar" />
          </div>
        </div>

        <div className="journey-nav__menu">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="journey-skeleton__folder" />
          ))}
        </div>
      </aside>

      <main className="journey-main">
        <div className="journey-stage">
          <section className="content-block journey-skeleton">
            <div className="journey-skeleton__chip" />
            <div className="journey-skeleton__title" />
            <div className="journey-skeleton__paragraph" />
            <div className="journey-skeleton__paragraph journey-skeleton__paragraph--short" />
          </section>
        </div>
      </main>
    </div>
  );
}

export function ManagerHandoutPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('item'));
  const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>([]);
  const [isJourneyNavOpen, setIsJourneyNavOpen] = useState(false);
  const [uploadDrafts, setUploadDrafts] = useState<Record<string, UploadDraft>>({});
  const [approvalNotes, setApprovalNotes] = useState('');
  const [fileInputResetKey, setFileInputResetKey] = useState(0);
  const [loadingJourney, setLoadingJourney] = useState(true);
  const [submittingItem, setSubmittingItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const allItems = useMemo<JourneyItemWithSection[]>(
    () =>
      journey?.sections.flatMap((section) =>
        section.items
          .filter((item) => item.item_type !== 'meeting_approval')
          .map((item) => ({ ...item, sectionTitle: section.title })),
      ) ?? [],
    [journey],
  );

  const deliveryItems = useMemo(() => allItems.filter(isDeliveryItem), [allItems]);
  const completedDeliveries = useMemo(
    () => deliveryItems.filter(isDelivered).length,
    [deliveryItems],
  );
  const progressPct = deliveryItems.length
    ? Math.round((completedDeliveries / deliveryItems.length) * 100)
    : 0;

  const selected = useMemo(() => {
    if (!allItems.length) return null;
    return allItems.find((item) => item.id === selectedId) ?? allItems[0];
  }, [allItems, selectedId]);

  const selectedSection = useMemo(() => {
    if (!journey || !selected) return null;
    return journey.sections.find((section) => section.id === selected.section_id) ?? null;
  }, [journey, selected]);

  const selectedSectionActions = useMemo(
    () => (selectedSection ? getActionItems(selectedSection) : []),
    [selectedSection],
  );

  const selectedIsIntro = selected ? isIntroItem(selected) : false;

  const currentIndex = useMemo(() => {
    if (!selected) return -1;
    return allItems.findIndex((item) => item.id === selected.id);
  }, [allItems, selected]);

  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null;
  const nextItem =
    currentIndex >= 0 && currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null;

  async function loadJourney(nextSelectedId?: string | null) {
    if (!token) return;

    setLoadingJourney(true);
    setError(null);

    try {
      const data = await getManagerCompanyJourney(token);
      setJourney(data);

      const items = data.sections.flatMap((section) =>
        section.items.filter((item) => item.item_type !== 'meeting_approval'),
      );
      const itemFromParam = nextSelectedId ? items.find((item) => item.id === nextSelectedId) : null;
      const firstItem = itemFromParam ?? getResumeItem(items);

      if (firstItem) {
        setSelectedId(firstItem.id);
        setSearchParams({ item: firstItem.id });
      }
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoadingJourney(false);
    }
  }

  useEffect(() => {
    void loadJourney(searchParams.get('item'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const item = searchParams.get('item');
    if (item && item !== selectedId) {
      setSelectedId(item);
    }
  }, [searchParams, selectedId]);

  useEffect(() => {
    if (!selected?.id) return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, [selected?.id]);

  useEffect(() => {
    setUploadError(null);
    setUploadSuccess(null);
    setApprovalNotes(selected?.submission_notes ?? '');
  }, [selected?.id]);

  function setItemStatusLocally(itemId: string, status: string | undefined, submittedAt?: string | null) {
    setJourney((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((section) => ({
          ...section,
          items: section.items.map((item) =>
            item.id === itemId
              ? { ...item, user_status: status, submitted_at: submittedAt ?? item.submitted_at }
              : item,
          ),
        })),
      };
    });
  }

  function markItemCompletedLocally(itemId: string, completedAt?: string | null) {
    setItemStatusLocally(itemId, 'completed', completedAt ?? new Date().toISOString());
  }

  async function completeContentItem(item: JourneyItem | null): Promise<boolean> {
    if (!token || !item || !isCompletableContentItem(item) || isDelivered(item)) return true;

    const previousStatus = item.user_status;
    const previousSubmittedAt = item.submitted_at;
    markItemCompletedLocally(item.id);
    try {
      const progress = await completeManagerCompanyJourneyItem(token, item.id);
      markItemCompletedLocally(item.id, progress.completed_at);
      return true;
    } catch (err) {
      setItemStatusLocally(item.id, previousStatus, previousSubmittedAt);
      setError(parseApiError(err));
      return false;
    }
  }

  function handleSelect(itemId: string) {
    if (selected?.id && selected.id !== itemId) {
      void completeContentItem(selected);
    }
    setSelectedId(itemId);
    setSearchParams({ item: itemId });
    setIsJourneyNavOpen(false);
  }

  async function finishJourney() {
    setFinishing(true);
    const ok = await completeContentItem(selected);
    setFinishing(false);
    if (ok) navigate('/manager');
  }

  function toggleSection(sectionId: string) {
    setExpandedSectionIds((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );
  }

  useEffect(() => {
    if (!selectedSection?.id) return;
    setExpandedSectionIds((current) =>
      current.includes(selectedSection.id) ? current : [...current, selectedSection.id],
    );
  }, [selectedSection?.id]);

  function setUploadFile(itemId: string, file: File | null) {
    setUploadDrafts((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? { file: null, notes: '' }),
        file,
      },
    }));
  }

  function setUploadNotes(itemId: string, notes: string) {
    setUploadDrafts((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? { file: null, notes: '' }),
        notes,
      },
    }));
  }

  async function handleDocumentSubmit(event: FormEvent<HTMLFormElement>, item: JourneyItem) {
    event.preventDefault();

    if (!token) return;

    const draft = uploadDrafts[item.id];
    if (!draft?.file) {
      setUploadError('Selecione um arquivo antes de registrar a entrega.');
      setUploadSuccess(null);
      return;
    }

    const extension = draft.file.name.split('.').pop()?.toLowerCase() ?? '';
    if (item.accepted_formats.length && !item.accepted_formats.some((format) => format.toLowerCase() === extension)) {
      setUploadError(`Formato .${extension || '?'} não aceito. Use um dos formatos: ${item.accepted_formats.join(', ')}.`);
      setUploadSuccess(null);
      return;
    }
    const maxSizeBytes = 25 * 1024 * 1024;
    if (draft.file.size > maxSizeBytes) {
      setUploadError('Arquivo maior que 25 MB. Envie um arquivo menor.');
      setUploadSuccess(null);
      return;
    }

    const payload = new FormData();
    payload.append('file', draft.file);
    if (draft.notes.trim()) {
      payload.append('notes', draft.notes.trim());
    }

    setSubmittingItem(item.id);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      await uploadManagerDocumentFile(token, item.id, payload);
      setUploadDrafts((current) => ({
        ...current,
        [item.id]: { file: null, notes: '' },
      }));
      setFileInputResetKey((current) => current + 1);
      await loadJourney(item.id);
      setUploadSuccess('Entrega registrada com sucesso.');
    } catch (err) {
      setUploadError(parseApiError(err));
    } finally {
      setSubmittingItem(null);
    }
  }

  async function handleScheduleApproval(
    event: { preventDefault(): void },
    item: JourneyItem,
    decision: 'approved' | 'changes_requested',
  ) {
    event.preventDefault();
    if (!token) return;

    setSubmittingItem(item.id);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      await approveManagerCompanyJourneyItem(token, item.id, {
        decision,
        notes: approvalNotes.trim() || null,
      });
      await loadJourney(item.id);
      setUploadSuccess(
        decision === 'approved'
          ? 'Cronograma aprovado com sucesso.'
          : 'Solicitação de ajustes registrada.',
      );
    } catch (err) {
      setUploadError(parseApiError(err));
    } finally {
      setSubmittingItem(null);
    }
  }

  if (!user) return null;

  if (loadingJourney) {
    return <JourneyLoadingShell />;
  }

  if (error) {
    return (
      <div className="journey-workspace">
        <main className="journey-main">
          <div className="journey-stage">
            <div className="form-error">{error}</div>
          </div>
        </main>
      </div>
    );
  }

  if (!journey || !selected) {
    return (
      <div className="journey-workspace">
        <main className="journey-main">
          <div className="journey-stage">
            <section className="content-block">
              <h2>Nenhuma etapa disponível</h2>
              <p>A jornada documental deste projeto ainda não possui itens ativos.</p>
            </section>
          </div>
        </main>
      </div>
    );
  }

  const template = selected.item_type === 'document_request' ? getTemplateInfo(selected) : null;
  const draft = uploadDrafts[selected.id] ?? { file: null, notes: '' };
  const submissionUrl = selected.submission_file_url ?? null;
  const scheduleApprovalEvents = selected.item_type === 'schedule_approval'
    ? getScheduleApprovalEvents(selected)
    : [];

  return (
    <div className="journey-workspace">
      <aside className="journey-nav">
        <div className="journey-nav__top">
          <div className="journey-nav__brand">
            <BrandLockup tone="light" subtitle="Jornada da empresa" />
          </div>

          <Link to="/manager" className="journey-nav__back">
            <ArrowLeft size={16} />
            <span>Voltar para a visão geral</span>
          </Link>

          <div className="journey-nav__progress">
            <div className="journey-nav__progress-head">
              <span>Ações</span>
              <strong>{progressPct}%</strong>
            </div>
            <div className="journey-nav__progress-track">
              <div className="journey-nav__progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="journey-nav__progress-meta">
              {completedDeliveries} de {deliveryItems.length} ações concluídas
            </span>
          </div>
        </div>

        <button
          type="button"
          className="journey-nav__mobile-toggle"
          aria-controls="manager-journey-navigation"
          aria-expanded={isJourneyNavOpen}
          onClick={() => setIsJourneyNavOpen((current) => !current)}
        >
          <Menu size={16} />
          <span>{isJourneyNavOpen ? 'Ocultar etapas' : 'Ver etapas da jornada'}</span>
          <ChevronRight size={15} aria-hidden />
        </button>

        <div
          id="manager-journey-navigation"
          className={`journey-nav__menu ${isJourneyNavOpen ? 'is-mobile-open' : ''}`}
        >
          {journey.sections.map((section) => {
            const actionItems = getActionItems(section);
            const sidebarItems = getSidebarItems(section);
            const sectionDeliveries = actionItems.filter(isDeliveryItem);
            const sectionDone = sectionDeliveries.filter(isDelivered).length;
            const sectionActive = selectedSection?.id === section.id;
            const sectionOpen = expandedSectionIds.includes(section.id);

            return (
              <div key={section.id} className="journey-nav__group">
                <button
                  type="button"
                  className={`journey-nav__group-head ${sectionActive ? 'is-active' : ''} ${sectionOpen ? 'is-open' : ''}`}
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={sectionOpen}
                >
                  <span className="journey-nav__folder-icon" aria-hidden>
                    {sectionOpen ? <FolderOpen size={14} /> : <Folder size={14} />}
                  </span>
                  <strong>{section.title}</strong>
                  <em>
                    {sectionDeliveries.length
                      ? `${sectionDone}/${sectionDeliveries.length}`
                      : 'info'}
                  </em>
                  <ChevronRight size={14} className="journey-nav__chevron" aria-hidden />
                </button>

                <div className={`journey-nav__group-body ${sectionOpen ? 'is-open' : ''}`}>
                  <div className="journey-nav__group-items">
                    {sidebarItems.map((item) => {
                    const isActive = item.id === selected.id;
                    const done = isDelivered(item);
                    const locked = item.user_status === 'locked';

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`journey-nav__item ${isActive ? 'is-active' : ''} ${
                          done ? 'is-done' : ''
                        } ${locked ? 'is-locked' : ''}`}
                        onClick={() => handleSelect(item.id)}
                        title={locked ? 'Etapa ainda bloqueada' : undefined}
                      >
                        <div className="journey-nav__item-icon">
                          {done ? <CheckCircle2 size={14} />
                            : locked ? <Lock size={14} />
                            : getItemIcon(item)}
                        </div>
                        <div className="journey-nav__item-copy">
                          <strong>{getSidebarItemTitle(item)}</strong>
                          <span>{getItemTypeLabel(item)} - {getStatusLabel(item.user_status)}</span>
                        </div>
                      </button>
                    );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <main className="journey-main">
        <div className="journey-stage" key={selected.id}>
          <header className="journey-head">
            <div className="journey-head__crumbs">
              <span>Jornada da empresa</span>
              <span aria-hidden>/</span>
              <span>{selectedSection?.title}</span>
            </div>

            <div className="journey-head__title-row">
              <div>
                <span className="journey-head__eyebrow">
                  {selectedIsIntro ? 'Sessão' : getItemTypeLabel(selected)} - Etapa {currentIndex + 1} de {allItems.length}
                </span>
                <h1>{selectedIsIntro ? selectedSection?.title : selected.document_title ?? selected.title}</h1>
                {(selectedIsIntro ? selectedSection?.description : selected.description) ? (
                  <p className="journey-head__desc">
                    {selectedIsIntro ? selectedSection?.description : selected.description}
                  </p>
                ) : null}
              </div>

              <div className="journey-head__meta">
                <StatusPill tone={getStatusTone(selected.user_status)}>
                  {getStatusLabel(selected.user_status)}
                </StatusPill>
                {selected.is_required ? (
                  <StatusPill tone="muted">
                    <ShieldCheck size={12} /> Obrigatório
                  </StatusPill>
                ) : null}
              </div>
            </div>
          </header>

          {selected.item_type === 'text' ? (
            <div className="content-block">
              <span className="content-chip"><FileText size={13} /> Orientação</span>
              <h2>{selectedIsIntro ? selectedSection?.title : selected.title}</h2>
              <RichText text={selected.content_text ?? selected.description ?? 'Conteúdo em preparação.'} />
              {selectedIsIntro ? (
                <SectionActions
                  items={selectedSectionActions}
                  selectedId={selected.id}
                  onSelect={handleSelect}
                />
              ) : null}
            </div>
          ) : null}

          {selected.item_type === 'document_request' ? (
            <div className="content-block">
              <span className="content-chip"><Upload size={13} /> Entrega documental</span>
              <h2>{selected.document_title ?? selected.title}</h2>
              <p>{selected.description ?? 'Envie o documento solicitado pela consultoria.'}</p>

              <div className="manager-delivery-meta">
                <StatusPill tone={selected.user_status === 'overdue' ? 'warning' : 'muted'}>
                  <CalendarClock size={12} /> Prazo {formatDate(selected.due_at)}
                </StatusPill>
                {selected.submitted_at ? (
                  <StatusPill tone={getStatusTone(selected.user_status)}>
                    Enviado em {formatDate(selected.submitted_at)}
                  </StatusPill>
                ) : null}
              </div>

              {selected.accepted_formats.length ? (
                <div className="journey-formats">
                  <span>Formatos aceitos:</span>
                  {selected.accepted_formats.map((format) => <em key={format}>{format}</em>)}
                </div>
              ) : null}

              <div className={`manager-template ${template ? '' : 'manager-template--empty'}`}>
                <span className="manager-template__icon">
                  {template?.href ? <Download size={18} /> : <FileText size={18} />}
                </span>
                <div className="manager-template__copy">
                  <strong>{template?.title ?? 'Sem template obrigatório'}</strong>
                  <p>
                    {template?.description ??
                      'Esta entrega pode ser enviada no formato que a consultoria combinou com você.'}
                  </p>
                  {template?.formats.length ? (
                    <div className="journey-formats">
                      {template.formats.map((format) => <em key={format}>{format}</em>)}
                    </div>
                  ) : null}
                </div>
                {template?.href ? (
                  <a href={template.href} download className="secondary-button manager-template__button">
                    <Download size={16} /> Baixar modelo
                  </a>
                ) : (
                  <StatusPill tone="muted">Padrão do projeto</StatusPill>
                )}
              </div>

              {selected.submitted_at ? (
                <div className="manager-submission">
                  <div className="manager-submission__head">
                    <CheckCircle2 size={18} />
                    <div>
                      <strong>Último envio registrado</strong>
                      <span>{formatDateTime(selected.submitted_at)}</span>
                    </div>
                  </div>
                  {submissionUrl ? (
                    <StoredFileLink fileUrl={submissionUrl} fileName={selected.submission_file_name}>
                      {selected.submission_file_name ?? 'Abrir arquivo enviado'}
                    </StoredFileLink>
                  ) : null}
                  {selected.submission_notes ? <p>{selected.submission_notes}</p> : null}
                </div>
              ) : null}

              <form className="manager-upload-form" onSubmit={(event) => handleDocumentSubmit(event, selected)}>
                <div className="manager-upload-grid">
                  <label className="manager-upload__file">
                    <span>Arquivo da entrega</span>
                    <input
                      key={`${selected.id}-${fileInputResetKey}`}
                      type="file"
                      accept={acceptedFormatAttribute(selected.accepted_formats)}
                      onChange={(event) => setUploadFile(selected.id, event.target.files?.[0] ?? null)}
                    />
                    <div className={`manager-upload__dropzone ${draft.file ? 'has-file' : ''}`}>
                      <Upload size={18} />
                      <strong>{draft.file ? draft.file.name : 'Selecionar arquivo'}</strong>
                      <small>
                        {draft.file
                          ? 'Arquivo pronto para envio.'
                          : 'Clique para anexar o documento preenchido ou revisado.'}
                      </small>
                    </div>
                  </label>

                  <label>
                    <span>Observações</span>
                    <textarea
                      rows={4}
                      value={draft.notes}
                      onChange={(event) => setUploadNotes(selected.id, event.target.value)}
                      placeholder="Contexto opcional sobre a entrega."
                    />
                  </label>
                </div>

                {uploadError ? <div className="form-error">{uploadError}</div> : null}
                {uploadSuccess ? <div className="form-success">{uploadSuccess}</div> : null}

                <button type="submit" className="primary-button" disabled={submittingItem === selected.id}>
                  {submittingItem === selected.id
                    ? 'Enviando...'
                    : selected.submitted_at
                      ? 'Enviar nova versão'
                      : 'Registrar entrega'}
                </button>
              </form>
            </div>
          ) : null}

          {selected.item_type === 'schedule_approval' ? (
            <div className="content-block">
              <span className="content-chip"><CalendarDays size={13} /> Cronograma para aprovação</span>
              <h2>{selected.title}</h2>
              <p>
                {selected.description ??
                  'Revise as etapas, entregas e datas previstas para o projeto antes de confirmar.'}
              </p>

              {scheduleApprovalEvents.length ? (
                <div className="schedule-approval-list">
                  {scheduleApprovalEvents.map((scheduleEvent, index) => (
                    <article
                      key={`${scheduleEvent.kind}-${scheduleEvent.title}-${index}`}
                      className="schedule-approval-item"
                    >
                      <span className="schedule-approval-item__kind">
                        {scheduleEventKindLabel(scheduleEvent.kind)}
                      </span>
                      <div>
                        <strong>{scheduleEvent.title}</strong>
                        {scheduleEvent.section && scheduleEvent.section !== scheduleEvent.title ? (
                          <em>{scheduleEvent.section}</em>
                        ) : null}
                      </div>
                      <p>
                        {formatDate(scheduleEvent.available_from)}
                        {' — '}
                        {formatDate(scheduleEvent.due_at)}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="manager-template manager-template--empty">
                  <span className="manager-template__icon"><CalendarClock size={18} /></span>
                  <div className="manager-template__copy">
                    <strong>Cronograma em preparação</strong>
                    <p>As datas serão exibidas aqui assim que o planejamento estiver disponível.</p>
                  </div>
                </div>
              )}

              <form
                className="approval-form"
                onSubmit={(event) => handleScheduleApproval(event, selected, 'approved')}
              >
                <label>
                  <span>Observações sobre o cronograma</span>
                  <textarea
                    rows={4}
                    value={approvalNotes}
                    onChange={(event) => setApprovalNotes(event.target.value)}
                    placeholder="Opcional para aprovação; descreva o que deve mudar ao solicitar ajustes."
                  />
                </label>

                {uploadError ? <div className="form-error">{uploadError}</div> : null}
                {uploadSuccess ? <div className="form-success">{uploadSuccess}</div> : null}

                <div className="approval-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={submittingItem === selected.id}
                    onClick={(event) => {
                      void handleScheduleApproval(event, selected, 'changes_requested');
                    }}
                  >
                    Solicitar ajustes
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={submittingItem === selected.id || !scheduleApprovalEvents.length}
                  >
                    <CheckCircle2 size={16} />
                    {submittingItem === selected.id ? 'Salvando...' : 'Aprovar cronograma'}
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          <nav className="journey-pager" aria-label="Navegação entre etapas">
            {prevItem ? (
              <button type="button" className="journey-pager__btn" onClick={() => handleSelect(prevItem.id)}>
                <ArrowLeft size={16} />
                <span>
                  <em>Anterior</em>
                  <strong>{prevItem.document_title ?? prevItem.title}</strong>
                </span>
              </button>
            ) : <span />}

            {nextItem ? (
              <button
                type="button"
                className="journey-pager__btn journey-pager__btn--next"
                onClick={() => handleSelect(nextItem.id)}
              >
                <span>
                  <em>Próximo</em>
                  <strong>{nextItem.document_title ?? nextItem.title}</strong>
                </span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="journey-pager__btn journey-pager__btn--next"
                onClick={() => void finishJourney()}
                disabled={finishing}
              >
                <span>
                  <em>{finishing ? 'Salvando...' : 'Finalizar'}</em>
                  <strong>Voltar para a visão geral</strong>
                </span>
                <ArrowRight size={16} />
              </button>
            )}
          </nav>
        </div>
      </main>
    </div>
  );
}
