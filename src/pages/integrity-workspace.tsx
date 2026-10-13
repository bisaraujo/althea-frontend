import { ArrowDown, ArrowUp, CheckCircle2, Clock3, Copy, Download, ExternalLink, Inbox, ListChecks, Paperclip, Plus, Save, ShieldAlert, Trash2 } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError } from '../api/client';
import {
  addIntegrityNote, categoryLabel, CHOICE_TYPES, downloadIntegrityAttachment, getIntegrityCase, getIntegrityQuestions,
  INTEGRITY_CATEGORIES, INTEGRITY_QUESTION_TYPE_LABEL, INTEGRITY_RESOLUTION_LABEL, type IntegrityCase, type IntegrityCaseDetail,
  type IntegrityQuestion, type IntegrityQuestionType, type IntegrityResolution, type IntegrityStatus, listIntegrityCases,
  publicReportUrl, publicTrackUrl, saveIntegrityQuestions, updateIntegrityStatus,
} from '../api/integrity';
import { EmptyState } from '../components/empty-state';
import { InfoTooltip } from '../components/info-tooltip';
import { SectionPanel } from '../components/section-panel';
import { StatCard } from '../components/stat-card';
import { StatusPill } from '../components/status-pill';
import { useToast } from '../components/toast';
import { DataTable, Drawer, ErrorState, FilterBar, LoadingState, NoPermissionState, SearchInput, SegmentedFilter, useConfirm } from '../components/ui';
import { CaseTimeline, copyText, formatDate, formatDateTime, statusLabel } from './integrity-shared';
import './integrity.css';

type Tab = 'cases' | 'form' | 'share';

function errorText(reason: unknown, fallback: string) {
  return reason instanceof ApiError ? reason.message : fallback;
}

function statusTone(status: string): 'success' | 'warning' | 'default' {
  return status === 'concluido' ? 'success' : status === 'em_analise' ? 'warning' : 'default';
}

function CaseStatusPill({ item }: { item: Pick<IntegrityCase, 'status' | 'resolution'> }) {
  const text = item.status === 'concluido' && item.resolution ? `Concluída · ${INTEGRITY_RESOLUTION_LABEL[item.resolution]}` : statusLabel(item.status);
  return <StatusPill tone={statusTone(item.status)}>{text}</StatusPill>;
}

// --- Detalhe do caso ---------------------------------------------------------

function CaseDrawer({ token, companyId, caseId, questions, canManage, onClose, onChanged }: {
  token: string; companyId: string; caseId: string; questions: IntegrityQuestion[]; canManage: boolean; onClose: () => void; onChanged: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [detail, setDetail] = useState<IntegrityCaseDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [nextStatus, setNextStatus] = useState<IntegrityStatus>('em_analise');
  const [resolution, setResolution] = useState<IntegrityResolution>('procedente');
  const [publicMessage, setPublicMessage] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    getIntegrityCase(token, companyId, caseId)
      .then((data) => { setDetail(data); setNextStatus(data.status === 'recebido' ? 'em_analise' : data.status); if (data.resolution) setResolution(data.resolution); })
      .catch(() => setFailed(true));
  }, [token, companyId, caseId]);
  useEffect(load, [load]);

  async function changeStatus(event: FormEvent) {
    event.preventDefault();
    if (!detail || saving) return;
    if (nextStatus === 'concluido') {
      const ok = await confirm({ title: `Concluir a denúncia ${detail.protocol}?`, description: `Resultado: ${INTEGRITY_RESOLUTION_LABEL[resolution]}. A partir da conclusão começa a contar o prazo de retenção dos dados de quem denunciou.`, confirmLabel: 'Concluir denúncia' });
      if (!ok) return;
    }
    setSaving(true);
    try {
      await updateIntegrityStatus(token, companyId, detail.id, { status: nextStatus, note: publicMessage.trim() || null, resolution: nextStatus === 'concluido' ? resolution : null });
      toast.success('Situação atualizada.');
      setPublicMessage('');
      load(); onChanged();
    } catch (reason) {
      toast.error(errorText(reason, 'Não foi possível atualizar a situação.'));
    } finally {
      setSaving(false);
    }
  }

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    if (!detail || saving || !note.trim()) return;
    setSaving(true);
    try {
      setDetail(await addIntegrityNote(token, companyId, detail.id, note.trim()));
      setNote('');
      toast.success('Nota interna registrada.');
      onChanged();
    } catch (reason) {
      toast.error(errorText(reason, 'Não foi possível registrar a nota.'));
    } finally {
      setSaving(false);
    }
  }

  async function download() {
    if (!detail) return;
    try { await downloadIntegrityAttachment(token, companyId, detail); }
    catch (reason) { toast.error(errorText(reason, 'Não foi possível baixar o anexo.')); }
  }

  const answers = detail ? Object.entries(detail.custom_answers ?? {}) : [];
  const labelOf = (key: string) => questions.find((question) => question.key === key)?.label ?? key;
  const statusChanged = detail ? nextStatus !== detail.status || (nextStatus === 'concluido' && resolution !== detail.resolution) : false;

  return (
    <Drawer open onClose={saving ? () => undefined : onClose} title={detail ? `Denúncia ${detail.protocol}` : 'Denúncia'} description={detail ? `${categoryLabel(detail.category)} · recebida em ${formatDateTime(detail.created_at)}` : undefined} size="lg">
      {failed ? <ErrorState message="Não foi possível carregar a denúncia." onRetry={load} /> : null}
      {!failed && !detail ? <LoadingState /> : null}
      {detail ? (
        <div className="int-workspace">
          <div className="int-case-head"><CaseStatusPill item={detail} />{detail.anonymized_at ? <span className="int-tag">Dados pessoais removidos</span> : null}</div>
          <dl className="int-facts">
            <div><dt>Assunto</dt><dd>{categoryLabel(detail.category)}</dd></div>
            <div><dt>Data do fato</dt><dd>{detail.incident_date ? formatDate(detail.incident_date) : 'Não informada'}</dd></div>
            <div><dt>Quem denunciou</dt><dd>{detail.identified ? `${detail.reporter_name ?? '—'}${detail.reporter_email ? ` · ${detail.reporter_email}` : ''}` : detail.anonymized_at ? 'Removido por retenção' : 'Anônimo'}</dd></div>
            <div><dt>Última atualização</dt><dd>{formatDateTime(detail.updated_at)}</dd></div>
          </dl>
          <div className="int-drawer-section">
            <h3>Relato</h3>
            <p className="int-description">{detail.description}</p>
            {answers.length ? (
              <dl className="int-facts">
                {answers.map(([key, value]) => <div key={key}><dt>{labelOf(key)}</dt><dd>{Array.isArray(value) ? value.join(', ') : String(value)}</dd></div>)}
              </dl>
            ) : null}
            {detail.attachment_file_name ? (
              <button type="button" className="secondary-button" style={{ justifySelf: 'start' }} onClick={() => void download()}><Download size={15} />Baixar anexo: {detail.attachment_file_name}</button>
            ) : <p className="int-hint">Sem anexo.</p>}
          </div>

          {canManage ? (
            <form className="int-drawer-section int-form" onSubmit={(event) => void changeStatus(event)}>
              <h3>Situação</h3>
              <fieldset disabled={saving}>
                <div className="int-question__row">
                  <label>Nova situação
                    <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as IntegrityStatus)}>
                      <option value="recebido">Recebida</option>
                      <option value="em_analise">Em análise</option>
                      <option value="concluido">Concluída</option>
                    </select>
                  </label>
                  {nextStatus === 'concluido' ? (
                    <label>Resultado
                      <select value={resolution} onChange={(event) => setResolution(event.target.value as IntegrityResolution)}>
                        {(Object.keys(INTEGRITY_RESOLUTION_LABEL) as IntegrityResolution[]).map((key) => <option key={key} value={key}>{INTEGRITY_RESOLUTION_LABEL[key]}</option>)}
                      </select>
                    </label>
                  ) : null}
                </div>
                <label>Mensagem para quem denunciou <span className="int-optional">(opcional)</span>
                  <textarea value={publicMessage} onChange={(event) => setPublicMessage(event.target.value)} maxLength={2000} placeholder="Ex.: Sua denúncia está sendo apurada pelo comitê." style={{ minHeight: 80 }} />
                </label>
                <p className="int-hint">Esta mensagem aparece no acompanhamento público. Não escreva nada que identifique pessoas ou detalhes da apuração.</p>
                <button type="submit" className="primary-button int-submit" disabled={saving || (!statusChanged && !publicMessage.trim())}>Atualizar situação</button>
              </fieldset>
            </form>
          ) : null}

          {canManage ? (
            <form className="int-drawer-section int-form" onSubmit={(event) => void saveNote(event)}>
              <h3>Nota interna <InfoTooltip text="Notas internas ficam só para o comitê. Quem denunciou nunca vê." label="Sobre notas internas" /></h3>
              <fieldset disabled={saving}>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} placeholder="Registre andamento da apuração, entrevistas, decisões…" style={{ minHeight: 90 }} />
                <button type="submit" className="secondary-button int-submit" disabled={saving || !note.trim()}>Adicionar nota</button>
              </fieldset>
            </form>
          ) : <p className="int-hint">Você pode ver as denúncias, mas não alterar a situação nem registrar notas.</p>}

          <div className="int-drawer-section">
            <h3>Histórico</h3>
            <CaseTimeline events={detail.events} audience="committee" />
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}

// --- Aba Casos ---------------------------------------------------------------

type StatusFilter = 'all' | IntegrityStatus;

function CasesTab({ token, companyId, canManage }: { token: string; companyId: string; canManage: boolean }) {
  const [cases, setCases] = useState<IntegrityCase[] | null>(null);
  const [questions, setQuestions] = useState<IntegrityQuestion[]>([]);
  const [failure, setFailure] = useState<{ message: string; forbidden: boolean } | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailure(null);
    Promise.all([listIntegrityCases(token, companyId), getIntegrityQuestions(token, companyId)])
      .then(([nextCases, form]) => { setCases(nextCases); setQuestions(form.questions); })
      .catch((reason) => setFailure({ message: errorText(reason, 'Não foi possível carregar as denúncias.'), forbidden: reason instanceof ApiError && reason.status === 403 }));
  }, [token, companyId]);
  useEffect(() => { setCases(null); load(); }, [load]);

  const counts = useMemo(() => {
    const all = cases ?? [];
    return { all: all.length, recebido: all.filter((item) => item.status === 'recebido').length, em_analise: all.filter((item) => item.status === 'em_analise').length, concluido: all.filter((item) => item.status === 'concluido').length };
  }, [cases]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (cases ?? []).filter((item) =>
      (status === 'all' || item.status === status)
      && (!category || item.category === category)
      && (!term || item.protocol.toLowerCase().includes(term) || item.description.toLowerCase().includes(term) || categoryLabel(item.category).toLowerCase().includes(term)));
  }, [cases, query, status, category]);

  if (failure) return failure.forbidden ? <NoPermissionState message="Você não tem permissão para ver as denúncias desta empresa." /> : <ErrorState message={failure.message} onRetry={load} />;

  return (
    <div className="int-workspace">
      <div className="int-status-strip">
        <StatCard label="Denúncias" value={counts.all} icon={<Inbox size={18} />} />
        <StatCard label="Aguardando análise" value={counts.recebido} meta="Recebidas e ainda não abertas" icon={<ShieldAlert size={18} />} />
        <StatCard label="Em análise" value={counts.em_analise} icon={<Clock3 size={18} />} />
        <StatCard label="Concluídas" value={counts.concluido} icon={<CheckCircle2 size={18} />} />
      </div>
      <SectionPanel title="Denúncias recebidas" eyebrow={cases ? `${filtered.length} de ${cases.length}` : undefined}>
        <FilterBar>
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar por protocolo, assunto ou trecho do relato" label="Buscar denúncia" />
          <select className="org-filter-select" aria-label="Filtrar por assunto" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Todos os assuntos</option>
            {INTEGRITY_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <SegmentedFilter<StatusFilter> label="Situação" value={status} onChange={setStatus} options={[
            { value: 'all', label: 'Todas', count: counts.all }, { value: 'recebido', label: 'Recebidas', count: counts.recebido },
            { value: 'em_analise', label: 'Em análise', count: counts.em_analise }, { value: 'concluido', label: 'Concluídas', count: counts.concluido },
          ]} />
        </FilterBar>
        <DataTable<IntegrityCase>
          rows={filtered}
          rowKey={(item) => item.id}
          loading={cases === null}
          onRowClick={(item) => setOpenId(item.id)}
          empty={cases?.length
            ? <EmptyState icon={Inbox} title="Nada encontrado" description="Ajuste a busca ou os filtros." />
            : <EmptyState icon={Inbox} title="Nenhuma denúncia recebida" description="Quando alguém usar o canal, a denúncia aparece aqui. Divulgue o link na aba “Divulgação”." />}
          columns={[
            { key: 'protocol', header: 'Protocolo', width: '170px', render: (item) => <span className="int-protocol">{item.protocol}</span> },
            { key: 'category', header: 'Assunto', render: (item) => categoryLabel(item.category) },
            { key: 'created', header: 'Recebida em', width: '150px', hideOnMobile: true, render: (item) => formatDateTime(item.created_at) },
            { key: 'flags', header: 'Detalhes', width: '130px', hideOnMobile: true, render: (item) => (
              <span className="int-case-head">{item.attachment_file_name ? <span className="int-tag"><Paperclip size={11} />Anexo</span> : null}<span className="int-tag">{item.identified ? 'Identificada' : 'Anônima'}</span></span>
            ) },
            { key: 'status', header: 'Situação', width: '190px', render: (item) => <CaseStatusPill item={item} /> },
          ]}
        />
      </SectionPanel>
      {openId ? <CaseDrawer token={token} companyId={companyId} caseId={openId} questions={questions} canManage={canManage} onClose={() => setOpenId(null)} onChanged={load} /> : null}
    </div>
  );
}

// --- Aba Formulario ----------------------------------------------------------

type DraftQuestion = { id: string; key: string | null; label: string; type: IntegrityQuestionType; required: boolean; optionsText: string };

function toDraft(question: IntegrityQuestion): DraftQuestion {
  return { id: question.key, key: question.key, label: question.label, type: question.type, required: question.required, optionsText: (question.options ?? []).join('\n') };
}

function FormTab({ token, companyId, canManage }: { token: string; companyId: string; canManage: boolean }) {
  const toast = useToast();
  const [drafts, setDrafts] = useState<DraftQuestion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    getIntegrityQuestions(token, companyId).then((form) => { setDrafts(form.questions.map(toDraft)); setDirty(false); }).catch(() => setFailed(true));
  }, [token, companyId]);
  useEffect(() => { setDrafts(null); load(); }, [load]);

  function update(id: string, change: Partial<DraftQuestion>) {
    setDrafts((current) => current?.map((item) => (item.id === id ? { ...item, ...change } : item)) ?? null);
    setDirty(true);
  }
  function move(index: number, delta: number) {
    setDrafts((current) => {
      if (!current) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });
    setDirty(true);
  }
  function add() {
    setDrafts((current) => [...(current ?? []), { id: `nova-${Date.now()}`, key: null, label: '', type: 'short_text', required: false, optionsText: '' }]);
    setDirty(true);
  }
  function remove(id: string) {
    setDrafts((current) => current?.filter((item) => item.id !== id) ?? null);
    setDirty(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!drafts || saving) return;
    const invalid = drafts.find((item) => !item.label.trim() || (CHOICE_TYPES.includes(item.type) && !item.optionsText.split('\n').some((line) => line.trim())));
    if (invalid) {
      toast.error(invalid.label.trim() ? `Inclua ao menos uma opção em "${invalid.label}".` : 'Toda pergunta precisa de um texto.');
      return;
    }
    setSaving(true);
    try {
      const form = await saveIntegrityQuestions(token, companyId, drafts.map((item) => ({
        key: item.key, label: item.label.trim(), type: item.type, required: item.required,
        options: CHOICE_TYPES.includes(item.type) ? item.optionsText.split('\n').map((line) => line.trim()).filter(Boolean) : null,
      })));
      setDrafts(form.questions.map(toDraft));
      setDirty(false);
      toast.success('Formulário salvo. As próximas denúncias já usam estas perguntas.');
    } catch (reason) {
      toast.error(errorText(reason, 'Não foi possível salvar o formulário.'));
    } finally {
      setSaving(false);
    }
  }

  if (failed) return <ErrorState message="Não foi possível carregar o formulário." onRetry={load} />;
  if (!drafts) return <LoadingState />;

  return (
    <SectionPanel title="Perguntas do formulário" eyebrow="Formulário público" action={canManage ? <button type="button" className="secondary-button" onClick={add}><Plus size={15} />Nova pergunta</button> : undefined}>
      <p className="int-hint" style={{ marginBottom: '0.8rem' }}>Assunto, relato, data do fato, anexo e identificação opcional sempre aparecem. Aqui você inclui perguntas extras específicas da empresa.</p>
      <form className="int-form" onSubmit={(event) => void save(event)}>
        <fieldset disabled={saving || !canManage}>
          {!drafts.length ? <EmptyState icon={ListChecks} title="Sem perguntas extras" description="O formulário usa só os campos padrão. Inclua perguntas se a empresa precisar de mais informações." /> : null}
          <div className="int-question-list">
            {drafts.map((item, index) => (
              <div className="int-question" key={item.id}>
                <div className="int-question__row">
                  <label>Pergunta<input value={item.label} onChange={(event) => update(item.id, { label: event.target.value })} placeholder="Ex.: Em qual unidade aconteceu?" maxLength={300} /></label>
                  <label>Tipo de resposta
                    <select value={item.type} onChange={(event) => update(item.id, { type: event.target.value as IntegrityQuestionType })}>
                      {(Object.keys(INTEGRITY_QUESTION_TYPE_LABEL) as IntegrityQuestionType[]).map((type) => <option key={type} value={type}>{INTEGRITY_QUESTION_TYPE_LABEL[type]}</option>)}
                    </select>
                  </label>
                </div>
                {CHOICE_TYPES.includes(item.type) ? (
                  <label>Opções (uma por linha)<textarea value={item.optionsText} onChange={(event) => update(item.id, { optionsText: event.target.value })} style={{ minHeight: 80 }} /></label>
                ) : null}
                {canManage ? (
                  <div className="int-question__footer">
                    <label><input type="checkbox" checked={item.required} onChange={(event) => update(item.id, { required: event.target.checked })} />Obrigatória</label>
                    <div className="int-actions">
                      <button type="button" className="org-icon-btn" aria-label="Mover para cima" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} /></button>
                      <button type="button" className="org-icon-btn" aria-label="Mover para baixo" disabled={index === drafts.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></button>
                      <button type="button" className="org-icon-btn org-icon-btn--danger" aria-label={`Remover pergunta ${item.label}`} onClick={() => remove(item.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ) : <p className="int-hint">{item.required ? 'Obrigatória' : 'Opcional'}</p>}
              </div>
            ))}
          </div>
          {canManage ? (
            <div className="int-actions">
              <button type="submit" className="primary-button" disabled={saving || !dirty}><Save size={15} />{saving ? 'Salvando…' : 'Salvar formulário'}</button>
              {dirty ? <button type="button" className="secondary-button" onClick={load} disabled={saving}>Descartar alterações</button> : null}
            </div>
          ) : <p className="int-hint">Só quem gerencia o Canal de Denúncias pode alterar as perguntas.</p>}
        </fieldset>
      </form>
    </SectionPanel>
  );
}

// --- Aba Divulgacao ----------------------------------------------------------

function ShareTab({ companyId }: { companyId: string }) {
  const toast = useToast();
  const reportUrl = publicReportUrl(companyId);
  const trackUrl = publicTrackUrl();
  async function copy(text: string) {
    if (await copyText(text)) toast.success('Link copiado.');
    else toast.error('Não foi possível copiar. Selecione o link e copie manualmente.');
  }
  return (
    <SectionPanel title="Divulgue o canal" eyebrow="Links públicos">
      <div className="int-share">
        <p className="int-hint">Os links não exigem login. Compartilhe por e-mail, intranet, mural ou QR code. Quem denuncia recebe um protocolo e uma chave para acompanhar o andamento.</p>
        <label className="int-field">Formulário de denúncia
          <span className="int-share__row">
            <input readOnly value={reportUrl} onFocus={(event) => event.target.select()} />
            <button type="button" className="secondary-button" onClick={() => void copy(reportUrl)}><Copy size={14} />Copiar</button>
            <a className="secondary-button" href={reportUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />Abrir</a>
          </span>
        </label>
        <label className="int-field">Acompanhamento por protocolo
          <span className="int-share__row">
            <input readOnly value={trackUrl} onFocus={(event) => event.target.select()} />
            <button type="button" className="secondary-button" onClick={() => void copy(trackUrl)}><Copy size={14} />Copiar</button>
            <a className="secondary-button" href={trackUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />Abrir</a>
          </span>
        </label>
      </div>
    </SectionPanel>
  );
}

// --- Componente principal ----------------------------------------------------

export function IntegrityWorkspace({ token, companyId, canManage }: { token: string; companyId: string; canManage: boolean }) {
  const [tab, setTab] = useState<Tab>('cases');
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'cases', label: 'Denúncias' }, { id: 'form', label: 'Formulário' }, { id: 'share', label: 'Divulgação' },
  ];
  return (
    <div className="int-workspace">
      <div className="organization-toolbar organization-toolbar--tabs-only">
        <div className="organization-tabs" role="tablist" aria-label="Seções do Canal de Denúncias">
          {tabs.map((item) => <button type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)} key={item.id}>{item.label}</button>)}
        </div>
      </div>
      {tab === 'cases' ? <CasesTab key={companyId} token={token} companyId={companyId} canManage={canManage} /> : null}
      {tab === 'form' ? <FormTab key={companyId} token={token} companyId={companyId} canManage={canManage} /> : null}
      {tab === 'share' ? <ShareTab companyId={companyId} /> : null}
    </div>
  );
}
