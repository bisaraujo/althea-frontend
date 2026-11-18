import {
  Archive, ArrowDown, ArrowLeft, ArrowUp, Building2, CheckCircle2, Copy, Eye, GitBranch, Lock, Pencil, Plus, Send, Settings2, Trash2, Undo2,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import {
  addQuestion, type Answers, AUDIENCE_LABEL, canonicalType, copySurvey, defaultsFor, deleteQuestion, getSurvey, getSurveyResults, newSurveyVersion,
  type QuestionPayload, QUESTION_TYPE_INFO, QUESTION_TYPE_LABEL, type QuestionType, reorderQuestions, type Survey, type SurveyAudience,
  type SurveyQuestion, type SurveyResults, type TargetCompany, transitionSurvey, updateQuestion, updateSurvey, listTargetCompanies,
} from '../api/surveys';
import { useAuth } from '../auth/auth-context';
import { productAdminNavigation } from '../components/admin-navigation';
import { AppShell } from '../components/app-shell';
import { EmptyState } from '../components/empty-state';
import { SurveyStatusPill } from '../components/survey/survey-status-pill';
import { QuestionEditor } from '../components/survey/question-editor';
import { QuestionTypeIcon } from '../components/survey/question-type-icon';
import { SurveyForm } from '../components/survey/survey-form';
import { SurveyResultsView } from '../components/survey/survey-results';
import { useToast } from '../components/toast';
import { ErrorState, LoadingState, Modal, useConfirm } from '../components/ui';
import { plural } from '../lib/plural';

type Tab = 'questions' | 'preview' | 'results' | 'settings';
const EDITABLE = new Set(['draft', 'changes_requested']);

function errorText(reason: unknown, fallback: string) {
  return reason instanceof ApiError ? reason.message : fallback;
}

/** O que cada situacao da pesquisa explica e quais passos o fluxo oferece. */
const FLOW: Record<string, { note: string; actions: { action: 'submit' | 'approve' | 'request-changes' | 'publish' | 'archive' | 'version'; label: string; primary?: boolean }[] }> = {
  draft: { note: 'Rascunho: monte as perguntas e envie para revisão.', actions: [{ action: 'submit', label: 'Enviar para revisão', primary: true }] },
  changes_requested: { note: 'Foram pedidos ajustes. Corrija e envie de novo.', actions: [{ action: 'submit', label: 'Enviar para revisão', primary: true }] },
  in_review: { note: 'Em revisão: confira a pré-visualização antes de aprovar.', actions: [{ action: 'request-changes', label: 'Pedir ajustes' }, { action: 'approve', label: 'Aprovar', primary: true }] },
  approved: { note: 'Aprovada: publique para liberar as respostas.', actions: [{ action: 'publish', label: 'Publicar', primary: true }] },
  published: { note: 'Publicada: recebendo respostas. Para mudar perguntas, crie uma nova versão.', actions: [{ action: 'archive', label: 'Encerrar' }, { action: 'version', label: 'Nova versão' }] },
  archived: { note: 'Encerrada: não recebe mais respostas.', actions: [{ action: 'version', label: 'Nova versão' }] },
};

function QuestionRow({ question, number, index, total, editable, busy, editing, onEdit, onMove, onDuplicate, onDelete }: {
  question: SurveyQuestion; number: number | null; index: number; total: number; editable: boolean; busy: boolean; editing: boolean;
  onEdit: () => void; onMove: (delta: number) => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const kind = canonicalType(question.question_type);
  const summary = kind === 'single_choice' || kind === 'multiple_choice' ? question.options.join(' · ')
    : kind === 'scale' ? `${question.settings.min ?? 1} a ${question.settings.max ?? 5}${question.settings.min_label ? ` · ${question.settings.min_label} → ${question.settings.max_label ?? ''}` : ''}`
      : kind === 'nps' ? '0 a 10'
        : kind === 'number' && (question.settings.min !== undefined || question.settings.max !== undefined) ? `${question.settings.min ?? '…'} a ${question.settings.max ?? '…'}`
          : question.description ?? '';
  const body = (
    <>
      {number !== null ? <span className="sv-question__number">{number}</span> : <span className="sv-qrow__section-mark" aria-hidden />}
      <span className="sv-qrow__copy">
        <strong>{question.title}{question.required && kind !== 'section' ? <span className="sv-required"> *</span> : null}</strong>
        <span className="sv-qrow__meta"><QuestionTypeIcon type={question.question_type} size={13} />{QUESTION_TYPE_LABEL[question.question_type]}{summary ? <em>{summary}</em> : null}</span>
      </span>
    </>
  );
  return (
    <div className={`sv-qrow${kind === 'section' ? ' sv-qrow--section' : ''}${editing ? ' is-editing' : ''}`}>
      {/* Publicada: a linha e so leitura (um botao desativado ficaria apagado). */}
      {editable ? <button type="button" className="sv-qrow__main" onClick={onEdit} title="Editar pergunta">{body}</button> : <div className="sv-qrow__main">{body}</div>}
      {editable ? (
        <div className="sv-qrow__actions">
          <button type="button" className="icon-button" aria-label="Subir" title="Subir" disabled={busy || index === 0} onClick={() => onMove(-1)}><ArrowUp size={15} /></button>
          <button type="button" className="icon-button" aria-label="Descer" title="Descer" disabled={busy || index === total - 1} onClick={() => onMove(1)}><ArrowDown size={15} /></button>
          <button type="button" className="icon-button" aria-label="Editar" title="Editar" disabled={busy} onClick={onEdit}><Pencil size={15} /></button>
          <button type="button" className="icon-button" aria-label="Duplicar" title="Duplicar" disabled={busy} onClick={onDuplicate}><Copy size={15} /></button>
          <button type="button" className="icon-button sv-danger" aria-label="Excluir" title="Excluir" disabled={busy} onClick={onDelete}><Trash2 size={15} /></button>
        </div>
      ) : null}
    </div>
  );
}

/** Construtor de uma pesquisa (Turi): perguntas, pre-visualizacao, resultados e configuracoes. */
export function SurveyBuilderPage() {
  const { surveyId = '' } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>('questions');
  const [editingId, setEditingId] = useState<string | null>(null);
  // Pergunta recem-adicionada e ainda nao salva: se a pessoa cancelar, ela sai da pesquisa.
  const [freshId, setFreshId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Answers>({});
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [companies, setCompanies] = useState<TargetCompany[]>([]);
  const [settings, setSettings] = useState({ title: '', description: '', company_id: '', audience: 'all' as SurveyAudience });
  // "Usar com uma empresa" (modelo) e "Duplicar": copia as perguntas para um novo rascunho.
  const [copying, setCopying] = useState<null | { mode: 'template' | 'duplicate'; title: string; company_id: string }>(null);

  const load = useCallback(() => {
    if (!token) return;
    setFailed(false);
    getSurvey(token, surveyId).then((data) => {
      setSurvey(data);
      setSettings({ title: data.title, description: data.description ?? '', company_id: data.company_id ?? '', audience: data.audience });
    }).catch(() => setFailed(true));
  }, [token, surveyId]);
  useEffect(load, [load]);
  useEffect(() => { if (token) listTargetCompanies(token).then(setCompanies).catch(() => setCompanies([])); }, [token]);
  useEffect(() => {
    if (tab !== 'results' || !token) return;
    setResults(null);
    getSurveyResults(token, surveyId).then(setResults).catch((reason) => toast.error(errorText(reason, 'Não foi possível carregar os resultados.')));
  }, [tab, token, surveyId, toast]);

  async function run<T>(action: () => Promise<T>, ok?: string): Promise<T | null> {
    if (!token || busy) return null;
    setBusy(true);
    try {
      const result = await action();
      if (ok) toast.success(ok);
      return result;
    } catch (reason) {
      toast.error(errorText(reason, 'Não foi possível concluir.'));
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (failed) return <AppShell title="Pesquisa" navigation={productAdminNavigation}><ErrorState message="Não foi possível carregar a pesquisa." onRetry={load} /></AppShell>;
  if (!survey || !token) return <AppShell title="Pesquisa" navigation={productAdminNavigation}><LoadingState /></AppShell>;

  const editable = EDITABLE.has(survey.status);
  const questions = survey.questions;
  let counter = 0;
  const numbers = questions.map((q) => (canonicalType(q.question_type) === 'section' ? null : ++counter));
  const answerable = counter;
  const isTemplate = !survey.company_id;
  const flow = isTemplate && survey.status !== 'published' && survey.status !== 'archived'
    ? { note: 'Modelo: não é publicado. Use com uma empresa para criar uma pesquisa pronta para revisar e publicar (o modelo continua aqui para outras empresas).', actions: [] }
    : FLOW[survey.status] ?? { note: '', actions: [] };

  async function addOfType(type: QuestionType) {
    const isSection = type === 'section';
    const created = await run(() => addQuestion(token!, survey!.id, { title: isSection ? 'Nova seção' : 'Nova pergunta', question_type: type, required: !isSection, ...defaultsFor(type) }));
    if (created) { setSurvey({ ...survey!, questions: [...questions, created] }); setEditingId(created.id); setFreshId(created.id); }
  }
  async function saveQuestion(question: SurveyQuestion, payload: QuestionPayload) {
    const saved = await run(() => updateQuestion(token!, survey!.id, question.id, payload), 'Pergunta salva.');
    if (saved) { setSurvey({ ...survey!, questions: questions.map((q) => (q.id === saved.id ? saved : q)) }); setEditingId(null); setFreshId(null); }
  }
  async function move(index: number, delta: number) {
    const ids = questions.map((q) => q.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id);
    const updated = await run(() => reorderQuestions(token!, survey!.id, ids));
    if (updated) setSurvey(updated);
  }
  async function duplicate(question: SurveyQuestion) {
    const created = await run(() => addQuestion(token!, survey!.id, {
      title: question.title, description: question.description, question_type: canonicalType(question.question_type),
      required: question.required, options: question.options, settings: question.settings,
    }));
    if (!created) return;
    const ids = [...questions.map((q) => q.id)];
    ids.splice(questions.findIndex((q) => q.id === question.id) + 1, 0, created.id);
    const updated = await run(() => reorderQuestions(token!, survey!.id, ids), 'Pergunta duplicada.');
    if (updated) setSurvey(updated);
  }
  async function cancelEdit(question: SurveyQuestion) {
    setEditingId(null);
    if (freshId !== question.id) return;
    setFreshId(null);
    const done = await run(() => deleteQuestion(token!, survey!.id, question.id));
    if (done !== null) setSurvey({ ...survey!, questions: questions.filter((q) => q.id !== question.id) });
  }
  async function remove(question: SurveyQuestion) {
    const ok = await confirm({ title: 'Excluir esta pergunta?', description: `"${question.title}" sai da pesquisa.`, confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    const done = await run(() => deleteQuestion(token!, survey!.id, question.id), 'Pergunta excluída.');
    if (done !== null) setSurvey({ ...survey!, questions: questions.filter((q) => q.id !== question.id) });
  }
  async function step(action: (typeof flow.actions)[number]['action']) {
    if (action === 'version') {
      const created = await run(() => newSurveyVersion(token!, survey!.id), 'Nova versão criada como rascunho.');
      if (created) navigate(`/admin/research/${created.id}`);
      return;
    }
    if (action === 'archive') {
      const ok = await confirm({ title: 'Encerrar a pesquisa?', description: 'Ela deixa de aceitar respostas. Os resultados continuam disponíveis.', confirmLabel: 'Encerrar' });
      if (!ok) return;
    }
    if (action === 'publish' && !survey!.company_id) {
      toast.error('Escolha a empresa em Configurações antes de publicar.');
      setTab('settings');
      return;
    }
    const labels = { submit: 'Enviada para revisão.', approve: 'Pesquisa aprovada.', 'request-changes': 'Ajustes pedidos.', publish: 'Pesquisa publicada. Já pode ser respondida.', archive: 'Pesquisa encerrada.' };
    const updated = await run(() => transitionSurvey(token!, survey!.id, action), labels[action]);
    if (updated) setSurvey(updated);
  }
  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    const updated = await run(() => updateSurvey(token!, survey!.id, {
      title: settings.title.trim(), description: settings.description.trim() || null, company_id: settings.company_id || null, audience: settings.audience,
    }), 'Configurações salvas.');
    if (updated) setSurvey(updated);
  }

  async function copy(event: FormEvent) {
    event.preventDefault();
    if (!copying) return;
    const created = await run(() => copySurvey(token!, survey!.id, { company_id: copying.company_id || null, title: copying.title.trim() || null }),
      copying.mode === 'template' ? 'Pesquisa criada a partir do modelo.' : 'Cópia criada como rascunho.');
    if (created) { setCopying(null); setTab('questions'); navigate(`/admin/research/${created.id}`); }
  }

  const flowIcon = { submit: Send, approve: CheckCircle2, 'request-changes': Undo2, publish: Send, archive: Archive, version: GitBranch };
  const actions = (
    <>
      <SurveyStatusPill survey={survey} />
      <button type="button" className="secondary-button" disabled={busy} onClick={() => setCopying({ mode: 'duplicate', title: `${survey.title} (cópia)`, company_id: survey.company_id ?? '' })}><Copy size={15} />Duplicar</button>
      {isTemplate ? (
        <button type="button" className="primary-button" disabled={busy || !answerable} title={answerable ? undefined : 'Adicione ao menos uma pergunta'}
          onClick={() => setCopying({ mode: 'template', title: survey.title, company_id: companies[0]?.id ?? '' })}><Building2 size={15} />Usar com uma empresa</button>
      ) : null}
      {flow.actions.map(({ action, label, primary }) => {
        const Icon = flowIcon[action];
        return <button key={action} type="button" className={primary ? 'primary-button' : 'secondary-button'} disabled={busy} onClick={() => void step(action)}><Icon size={15} />{label}</button>;
      })}
    </>
  );

  return (
    <AppShell eyebrow={`Pesquisa · versão ${survey.version}`} title={survey.title}
      description={`${survey.company_name ?? 'Modelo sem empresa'} · ${AUDIENCE_LABEL[survey.audience]} · ${plural(answerable, 'pergunta', 'perguntas')}`}
      actions={actions} navigation={productAdminNavigation}>
      <Link to="/admin/research" className="sv-back"><ArrowLeft size={15} />Todas as pesquisas</Link>
      <p className={`sv-flow-note sv-flow-note--${survey.status}`}>{editable ? null : <Lock size={14} aria-hidden />}{flow.note}
        {survey.version > 1 && !['published', 'archived'].includes(survey.status) && !isTemplate ? ` Ao publicar, a versão ${survey.version - 1} é encerrada e esta passa a valer.` : ''}</p>

      <div role="tablist" aria-label="Construtor da pesquisa">
        <button type="button" role="tab" aria-selected={tab === 'questions'} onClick={() => setTab('questions')}><Pencil size={15} />Perguntas</button>
        <button type="button" role="tab" aria-selected={tab === 'preview'} onClick={() => setTab('preview')}><Eye size={15} />Pré-visualização</button>
        <button type="button" role="tab" aria-selected={tab === 'results'} onClick={() => setTab('results')}><CheckCircle2 size={15} />Resultados{survey.response_count ? ` (${survey.response_count})` : ''}</button>
        <button type="button" role="tab" aria-selected={tab === 'settings'} onClick={() => setTab('settings')}><Settings2 size={15} />Configurações</button>
      </div>

      {tab === 'questions' ? (
        <div className="sv-builder">
          {questions.length ? (
            <div className="sv-qlist">
              {questions.map((question, index) => (
                <div key={question.id} className="sv-qitem">
                  <QuestionRow question={question} number={numbers[index]} index={index} total={questions.length} editable={editable} busy={busy} editing={editingId === question.id}
                    onEdit={() => setEditingId(editingId === question.id ? null : question.id)} onMove={(delta) => void move(index, delta)}
                    onDuplicate={() => void duplicate(question)} onDelete={() => void remove(question)} />
                  {editingId === question.id && editable ? (
                    <QuestionEditor question={question} saving={busy} onCancel={() => void cancelEdit(question)} onSave={(payload) => void saveQuestion(question, payload)} />
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Plus} title="Nenhuma pergunta ainda" description="Escolha abaixo o tipo da primeira pergunta. Dá para mudar o tipo, reordenar e duplicar depois." />
          )}
          {editable ? (
            <section className="sv-add">
              <h3>Adicionar</h3>
              <div className="sv-add__grid">
                {QUESTION_TYPE_INFO.map((item) => (
                  <button key={item.type} type="button" className="sv-add__type" disabled={busy} onClick={() => void addOfType(item.type)}>
                    <QuestionTypeIcon type={item.type} size={18} />
                    <span><strong>{item.label}</strong><em>{item.hint}</em></span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === 'preview' ? (
        <div className="sv-preview">
          <p className="sv-preview__note"><Eye size={14} aria-hidden />É assim que gestores e colaboradores veem a pesquisa. Nada do que você marcar aqui é salvo.</p>
          <article className="sv-paper">
            <header className="sv-paper__header">
              <h2>{survey.title}</h2>
              {survey.description ? <p>{survey.description}</p> : null}
            </header>
            {questions.length ? <SurveyForm questions={questions} answers={previewAnswers} onChange={(key, value) => setPreviewAnswers((current) => {
              const next = { ...current };
              if (value === undefined) delete next[key]; else next[key] = value;
              return next;
            })} /> : <p className="sv-muted">Adicione perguntas para ver a pré-visualização.</p>}
            <div className="sv-paper__footer"><button type="button" className="primary-button" disabled>Enviar respostas</button></div>
          </article>
        </div>
      ) : null}

      {tab === 'results' ? (results ? <SurveyResultsView results={results} /> : <LoadingState />) : null}

      {tab === 'settings' ? (
        <section className="panel sv-settings">
          <form className="admin-form" onSubmit={(event) => void saveSettings(event)}>
            <fieldset disabled={!editable || busy} className="ben-fieldset">
              <label><span>Título</span><input value={settings.title} onChange={(e) => setSettings({ ...settings, title: e.target.value })} required maxLength={255} /></label>
              <label><span>Descrição <em className="sv-optional">(aparece no topo da pesquisa)</em></span><textarea rows={3} value={settings.description} onChange={(e) => setSettings({ ...settings, description: e.target.value })} maxLength={2000} /></label>
              <div className="field-grid">
                <label><span>Empresa</span>
                  <select value={settings.company_id} onChange={(e) => setSettings({ ...settings, company_id: e.target.value })}>
                    <option value="">Modelo (sem empresa)</option>
                    {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                  </select>
                </label>
                <label><span>Quem responde</span>
                  <select value={settings.audience} onChange={(e) => setSettings({ ...settings, audience: e.target.value as SurveyAudience })}>
                    {(Object.keys(AUDIENCE_LABEL) as SurveyAudience[]).map((key) => <option key={key} value={key}>{AUDIENCE_LABEL[key]}</option>)}
                  </select>
                </label>
              </div>
              {!settings.company_id ? <p className="sv-muted">Sem empresa, a pesquisa é só um modelo: dá para montar e revisar, mas ninguém responde. Escolha a empresa para publicar.</p> : null}
            </fieldset>
            {editable ? <div className="sv-settings__footer"><button type="submit" className="primary-button" disabled={busy || !settings.title.trim()}>Salvar configurações</button></div>
              : <p className="sv-muted"><Lock size={13} aria-hidden /> Configurações travadas depois do envio para revisão. Para mudar, crie uma nova versão.</p>}
          </form>
        </section>
      ) : null}

      <Modal open={Boolean(copying)} onClose={busy ? () => undefined : () => setCopying(null)} size="sm"
        title={copying?.mode === 'template' ? 'Usar o modelo com uma empresa' : 'Duplicar pesquisa'}
        description={copying?.mode === 'template' ? 'Cria uma pesquisa em rascunho com estas perguntas para a empresa escolhida. O modelo continua disponível.' : 'Cria um rascunho novo (versão 1) com as mesmas perguntas. A pesquisa original não muda.'}
        footer={<>
          <button type="button" className="secondary-button" onClick={() => setCopying(null)} disabled={busy}>Cancelar</button>
          <button type="submit" form="survey-copy" className="primary-button" disabled={busy || (copying?.mode === 'template' && !copying.company_id)}>{copying?.mode === 'template' ? 'Criar pesquisa' : 'Duplicar'}</button>
        </>}>
        {copying ? (
          <form id="survey-copy" className="admin-form" onSubmit={(event) => void copy(event)}>
            <label><span>Título</span><input value={copying.title} onChange={(e) => setCopying({ ...copying, title: e.target.value })} maxLength={255} required /></label>
            <label><span>Empresa</span>
              <select value={copying.company_id} onChange={(e) => setCopying({ ...copying, company_id: e.target.value })}>
                {copying.mode === 'duplicate' ? <option value="">Modelo (sem empresa)</option> : null}
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
          </form>
        ) : null}
      </Modal>
    </AppShell>
  );
}
