import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CirclePlay,
  ClipboardList,
  FileText,
  Lock,
  PlayCircle,
  Presentation as PresentationIcon,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getEmployeeFormDetail, getEmployeeJourney, submitEmployeeForm } from '../api/services';
import type { FormDetail, FormQuestion, Journey, JourneyItem } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { StatusPill } from '../components/status-pill';

/* ===================== Helpers ===================== */

function getItemIcon(item: JourneyItem) {
  if (item.item_type === 'survey') return <ClipboardList size={14} />;
  if (item.item_type === 'text') return <FileText size={14} />;
  if (item.item_type === 'video') return <PlayCircle size={14} />;
  if (item.item_type === 'presentation') return <PresentationIcon size={14} />;
  if (item.item_type === 'document_request') return <Upload size={14} />;
  return <CirclePlay size={14} />;
}

function getItemTypeLabel(item: JourneyItem) {
  switch (item.item_type) {
    case 'survey': return 'Pesquisa';
    case 'text': return 'Leitura';
    case 'video': return 'Vídeo';
    case 'presentation': return 'Apresentação';
    case 'document_request': return 'Documento';
    default: return 'Conteúdo';
  }
}

function isCompleted(item: JourneyItem) {
  return item.user_status === 'submitted' || item.user_status === 'completed';
}

function getStatusTone(status?: string) {
  if (status === 'submitted' || status === 'completed') return 'success' as const;
  if (status === 'pending' || status === 'in_progress') return 'warning' as const;
  if (status === 'locked') return 'muted' as const;
  return 'default' as const;
}

function getStatusLabel(status?: string) {
  if (status === 'submitted') return 'Respondido';
  if (status === 'completed') return 'Concluído';
  if (status === 'pending') return 'Pendente';
  if (status === 'in_progress') return 'Em andamento';
  if (status === 'available') return 'Disponível';
  if (status === 'locked') return 'Bloqueado';
  return 'Não iniciado';
}

function normalizeAnswerValue(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function parseApiError(error: unknown) {
  if (!(error instanceof Error)) return 'Não foi possível concluir a ação.';
  try {
    const parsed = JSON.parse(error.message);
    const detail = parsed.detail;
    if (typeof detail === 'string') return detail;
    if (detail?.message && Array.isArray(detail.missing_questions)) {
      return `${detail.message}: ${detail.missing_questions.join(', ')}`;
    }
    if (detail?.message && Array.isArray(detail.invalid_answers)) {
      const invalid = detail.invalid_answers
        .map((item: { question?: string }) => item.question)
        .filter(Boolean).join(', ');
      return invalid ? `${detail.message}: ${invalid}` : detail.message;
    }
    if (detail?.message) return detail.message;
  } catch { /* mensagem plana */ }
  return error.message;
}

function isAnswered(q: FormQuestion, value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return false;
}

/* ===================== Survey (stepper: 1 pergunta por vez) ===================== */

type AnswersState = Record<string, string | string[]>;

type SurveyStepperProps = {
  form: FormDetail;
  item: JourneyItem;
  submitting: boolean;
  submitError: string | null;
  submitSuccess: string | null;
  answers: AnswersState;
  onAnswerChange: (key: string, value: string | string[]) => void;
  onSubmit: () => void;
};

function SurveyStepper({
  form, item, submitting, submitError, submitSuccess,
  answers, onAnswerChange, onSubmit,
}: SurveyStepperProps) {
  const isSubmitted = item.user_status === 'submitted';
  const total = form.questions.length;
  const [step, setStep] = useState(0);

  // Reset step quando o form muda
  useEffect(() => { setStep(0); }, [form.id]);

  const answeredCount = useMemo(
    () => form.questions.reduce((acc, q) => acc + (isAnswered(q, answers[q.key]) ? 1 : 0), 0),
    [answers, form.questions],
  );
  const pct = total ? Math.round((answeredCount / total) * 100) : 0;

  // ---- Tela de conclusão ----
  if (isSubmitted) {
    return (
      <div className="survey">
        <div className="survey__done">
          <div className="survey__done-icon"><CheckCircle2 size={28} /></div>
          <h2>Pesquisa concluída</h2>
          <p>
            Você respondeu este formulário
            {item.submitted_at ? ` em ${new Date(item.submitted_at).toLocaleString('pt-BR')}` : ''}.
            Obrigado pela contribuição.
          </p>
        </div>
      </div>
    );
  }

  // ---- Tela de revisão (após a última pergunta) ----
  const isReview = step === total;

  if (isReview) {
    return (
      <div className="survey">
        <div className="survey__topbar">
          <span className="survey__count">Revisão final</span>
          <div className="survey__bar"><div className="survey__bar-fill" style={{ width: `${pct}%` }} /></div>
        </div>

        <div className="survey__card survey__card--review">
          <h2>Revise antes de enviar</h2>
          <p className="survey__lead">
            {answeredCount} de {total} perguntas respondidas. Você pode voltar e ajustar qualquer resposta.
          </p>

          <ul className="survey__review-list">
            {form.questions.map((q, i) => {
              const v = answers[q.key];
              const answered = isAnswered(q, v);
              const display = Array.isArray(v) ? v.join(', ') : (v ?? '');
              return (
                <li key={q.id} className={`survey__review-item ${answered ? 'is-ok' : 'is-empty'}`}>
                  <button type="button" className="survey__review-jump" onClick={() => setStep(i)}>
                    <span className="survey__review-index">{String(i + 1).padStart(2, '0')}</span>
                    <span className="survey__review-body">
                      <strong>{q.title}</strong>
                      <em>{answered ? display : 'Sem resposta'}</em>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {submitError ? <div className="form-error">{submitError}</div> : null}
          {submitSuccess ? (
            <div className="survey__note">
              <CheckCircle2 size={16} /> <span>{submitSuccess}</span>
            </div>
          ) : null}

          <div className="survey__actions">
            <button type="button" className="ghost-button" onClick={() => setStep(total - 1)}>
              <ArrowLeft size={16} /> Voltar
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={submitting || answeredCount < total}
              onClick={onSubmit}
            >
              {submitting ? 'Enviando...' : 'Enviar respostas'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Pergunta atual ----
  const q = form.questions[step];
  const currentValue = normalizeAnswerValue(answers[q.key]);
  const answeredNow = isAnswered(q, answers[q.key]);

  function renderField() {
    if (q.question_type === 'single_choice') {
      return (
        <div className="survey__options">
          {q.options.map((option) => {
            const selected = currentValue === option.value;
            return (
              <button
                key={option.id}
                type="button"
                className={`survey__option ${selected ? 'is-selected' : ''}`}
                onClick={() => onAnswerChange(q.key, option.value)}
              >
                <span className="survey__radio" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      );
    }

    if (q.question_type === 'multi_select') {
      const selectedValues = Array.isArray(currentValue) ? currentValue : [];
      return (
        <div className="survey__options">
          {q.options.map((option) => {
            const selected = selectedValues.includes(option.value);
            return (
              <button
                key={option.id}
                type="button"
                className={`survey__option ${selected ? 'is-selected' : ''}`}
                onClick={() => {
                  const next = selected
                    ? selectedValues.filter((v) => v !== option.value)
                    : [...selectedValues, option.value];
                  onAnswerChange(q.key, next);
                }}
              >
                <span className="survey__check" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      );
    }

    if (q.question_type === 'number') {
      return (
        <input
          className="survey__input"
          type="number"
          value={typeof currentValue === 'string' ? currentValue : ''}
          onChange={(e) => onAnswerChange(q.key, e.target.value)}
          autoFocus
        />
      );
    }

    return (
      <textarea
        className="survey__input survey__input--area"
        rows={5}
        value={typeof currentValue === 'string' ? currentValue : ''}
        onChange={(e) => onAnswerChange(q.key, e.target.value)}
        placeholder="Digite sua resposta"
        autoFocus
      />
    );
  }

  const goNext = () => setStep((s) => Math.min(s + 1, total));
  const goPrev = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="survey">
      <div className="survey__topbar">
        <span className="survey__count">
          Pergunta {String(step + 1).padStart(2, '0')} de {String(total).padStart(2, '0')}
        </span>
        <div className="survey__bar"><div className="survey__bar-fill" style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="survey__card" key={q.id /* re-anima ao trocar */}>
        <header className="survey__qhead">
          <h2>{q.title}</h2>
          {q.description ? <p>{q.description}</p> : null}
        </header>

        <div className="survey__field">{renderField()}</div>

        <div className="survey__actions">
          <button
            type="button"
            className="ghost-button"
            disabled={step === 0}
            onClick={goPrev}
          >
            <ArrowLeft size={16} /> Anterior
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={goNext}
            disabled={q.required && !answeredNow}
          >
            {step === total - 1 ? 'Revisar' : 'Próxima'} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Video ===================== */

function VideoBlock({ item }: { item: JourneyItem }) {
  return (
    <div className="content-block">
      <span className="content-chip"><PlayCircle size={13} /> Vídeo</span>
      <h2>{item.title}</h2>
      <p>{item.description ?? 'Conteúdo em vídeo desta etapa.'}</p>
      {item.video_url ? (
        <a href={item.video_url} target="_blank" rel="noreferrer" className="secondary-link">
          abrir o vídeo
        </a>
      ) : null}
    </div>
  );
}

/* ===================== Page ===================== */

export function EmployeeHandoutPage() {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('item'));
  const [formDetail, setFormDetail] = useState<FormDetail | null>(null);
  const [answers, setAnswers] = useState<AnswersState>({});
  const [loadingJourney, setLoadingJourney] = useState(true);
  const [loadingForm, setLoadingForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const allItems = useMemo(
    () => journey?.sections.flatMap((s) => s.items) ?? [],
    [journey],
  );

  const selected = useMemo(() => {
    if (!allItems.length) return null;
    return allItems.find((i) => i.id === selectedId) ?? allItems[0];
  }, [allItems, selectedId]);

  const selectedSection = useMemo(() => {
    if (!journey || !selected) return null;
    return journey.sections.find((s) => s.id === selected.section_id) ?? null;
  }, [journey, selected]);

  const completedTotal = useMemo(() => allItems.filter(isCompleted).length, [allItems]);
  const progressPct = allItems.length ? Math.round((completedTotal / allItems.length) * 100) : 0;

  const currentIndex = useMemo(() => {
    if (!selected) return -1;
    return allItems.findIndex((i) => i.id === selected.id);
  }, [allItems, selected]);

  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null;
  const nextItem =
    currentIndex >= 0 && currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null;

  async function loadJourney(nextSelectedId?: string | null) {
    if (!token) return;
    setLoadingJourney(true);
    setError(null);
    try {
      const data = await getEmployeeJourney(token);
      setJourney(data);
      const items = data.sections.flatMap((s) => s.items);
      const itemFromParam = nextSelectedId ? items.find((i) => i.id === nextSelectedId) : null;
      const firstItem = itemFromParam ?? items[0] ?? null;
      if (firstItem) {
        setSelectedId(firstItem.id);
        setSearchParams({ item: firstItem.id });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a jornada.');
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
    if (item && item !== selectedId) setSelectedId(item);
  }, [searchParams, selectedId]);

  useEffect(() => {
    async function loadSelectedForm() {
      if (!token || !selected || selected.item_type !== 'survey' || !selected.form_id) {
        setFormDetail(null);
        setAnswers({});
        return;
      }
      setLoadingForm(true);
      setSubmitError(null);
      setSubmitSuccess(null);
      try {
        const data = await getEmployeeFormDetail(token, selected.form_id);
        setFormDetail(data);
        const initial = Object.fromEntries(
          data.questions.map((q) => [q.key, q.question_type === 'multi_select' ? [] : '']),
        ) as AnswersState;
        setAnswers(initial);
      } catch (err) {
        setFormDetail(null);
        setSubmitError(parseApiError(err));
      } finally {
        setLoadingForm(false);
      }
    }
    void loadSelectedForm();
  }, [token, selected?.id, selected?.form_id, selected?.item_type]);

  function handleSelect(itemId: string) {
    setSelectedId(itemId);
    setSearchParams({ item: itemId });
  }

  function handleAnswerChange(key: string, value: string | string[]) {
    setAnswers((cur) => ({ ...cur, [key]: value }));
  }

  async function handleSubmitSurvey() {
    if (!token || !selected?.form_id) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      await submitEmployeeForm(token, selected.form_id, answers);
      setSubmitSuccess('Respostas enviadas com sucesso.');
      await loadJourney(selected.id);
    } catch (err) {
      setSubmitError(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  if (loadingJourney) {
    return (
      <div className="journey-workspace">
        <main className="journey-main">
          <div className="journey-stage">
            <section className="content-block">
              <h2>Carregando jornada...</h2>
              <p>Estamos buscando as etapas disponíveis para você.</p>
            </section>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="journey-workspace">
        <main className="journey-main">
          <div className="journey-stage"><div className="form-error">{error}</div></div>
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
              <p>A jornada deste projeto ainda não possui itens ativos.</p>
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="journey-workspace">
      {/* ============ Sidebar ============ */}
      <aside className="journey-nav">
        <div className="journey-nav__top">
          <div className="journey-nav__brand">
            <div className="journey-nav__brand-mark">A</div>
            <div>
              <strong>Althea</strong>
              <p>Jornada do colaborador</p>
            </div>
          </div>

          <Link to="/employee" className="journey-nav__back">
            <ArrowLeft size={16} />
            <span>Voltar para a visão geral</span>
          </Link>

          <div className="journey-nav__progress">
            <div className="journey-nav__progress-head">
              <span>Progresso</span>
              <strong>{progressPct}%</strong>
            </div>
            <div className="journey-nav__progress-track">
              <div className="journey-nav__progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="journey-nav__progress-meta">
              {completedTotal} de {allItems.length} etapas concluídas
            </span>
          </div>
        </div>

        <div className="journey-nav__menu">
          {journey.sections.map((section, index) => {
            const sectionDone = section.items.filter(isCompleted).length;
            return (
              <div key={section.id} className="journey-nav__group">
                <div className="journey-nav__group-head">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{section.title}</strong>
                  <em>{sectionDone}/{section.items.length}</em>
                </div>

                <div className="journey-nav__group-items">
                  {section.items.map((item) => {
                    const isActive = item.id === selected.id;
                    const done = isCompleted(item);
                    const locked = item.user_status === 'locked';
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`journey-nav__item ${isActive ? 'is-active' : ''} ${
                          done ? 'is-done' : ''
                        } ${locked ? 'is-locked' : ''}`}
                        onClick={() => handleSelect(item.id)}
                        title={locked ? 'Etapa ainda bloqueada — pré-visualização' : undefined}
                      >
                        <div className="journey-nav__item-icon">
                          {done ? <CheckCircle2 size={14} />
                            : locked ? <Lock size={14} />
                            : getItemIcon(item)}
                        </div>
                        <div className="journey-nav__item-copy">
                          <strong>{item.title}</strong>
                          <span>{getItemTypeLabel(item)} · {getStatusLabel(item.user_status)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* ============ Main ============ */}
      <main className="journey-main">
        <div className="journey-stage">
          <header className="journey-head">
            <div className="journey-head__crumbs">
              <span>{journey.title}</span>
              <span aria-hidden>/</span>
              <span>{selectedSection?.title}</span>
            </div>

            <div className="journey-head__title-row">
              <div>
                <span className="journey-head__eyebrow">
                  {getItemTypeLabel(selected)} · Etapa {currentIndex + 1} de {allItems.length}
                </span>
                <h1>{selected.title}</h1>
                {selected.description ? (
                  <p className="journey-head__desc">{selected.description}</p>
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

          {/* ===== Conteúdo por tipo ===== */}
          {selected.item_type === 'text' ? (
            <div className="content-block">
              <span className="content-chip"><FileText size={13} /> Leitura</span>
              <h2>{selected.title}</h2>
              <p>{selected.content_text ?? selected.description ?? 'Conteúdo em preparação.'}</p>
            </div>
          ) : null}

          {selected.item_type === 'video' ? <VideoBlock item={selected} /> : null}

          {selected.item_type === 'presentation' ? (
            <div className="content-block">
              <span className="content-chip"><PresentationIcon size={13} /> Apresentação</span>
              <h2>{selected.title}</h2>
              <p>{selected.description ?? 'Apresentação em preparação.'}</p>
            </div>
          ) : null}

          {selected.item_type === 'document_request' ? (
            <div className="content-block">
              <span className="content-chip"><Upload size={13} /> Documento</span>
              <h2>{selected.document_title ?? selected.title}</h2>
              <p>{selected.description ?? 'Envie o documento solicitado pela consultoria.'}</p>

              {selected.accepted_formats?.length ? (
                <div className="journey-formats">
                  <span>Formatos aceitos:</span>
                  {selected.accepted_formats.map((fmt) => <em key={fmt}>{fmt}</em>)}
                </div>
              ) : null}

              <div className="journey-upload">
                <Upload size={20} />
                <strong>Arraste seu arquivo aqui ou clique para selecionar</strong>
                <span>O upload completo será habilitado em breve.</span>
              </div>
            </div>
          ) : null}

          {selected.item_type === 'survey' ? (
            loadingForm ? (
              <div className="content-block">
                <h2>Carregando formulário...</h2>
                <p>Estamos buscando as perguntas desta pesquisa.</p>
              </div>
            ) : formDetail ? (
              <SurveyStepper
                form={formDetail}
                item={selected}
                answers={answers}
                submitting={submitting}
                submitError={submitError}
                submitSuccess={submitSuccess}
                onAnswerChange={handleAnswerChange}
                onSubmit={handleSubmitSurvey}
              />
            ) : (
              <div className="form-error">
                {submitError ?? 'Não foi possível carregar este formulário.'}
              </div>
            )
          ) : null}

          {/* ===== Navegação entre etapas ===== */}
          <nav className="journey-pager" aria-label="Navegação entre etapas">
            {prevItem ? (
              <button type="button" className="journey-pager__btn" onClick={() => handleSelect(prevItem.id)}>
                <ArrowLeft size={16} />
                <span>
                  <em>Anterior</em>
                  <strong>{prevItem.title}</strong>
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
                  <strong>{nextItem.title}</strong>
                </span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <Link to="/employee" className="journey-pager__btn journey-pager__btn--next">
                <span>
                  <em>Finalizar</em>
                  <strong>Voltar à visão geral</strong>
                </span>
                <ArrowRight size={16} />
              </Link>
            )}
          </nav>
        </div>
      </main>
    </div>
  );
}
