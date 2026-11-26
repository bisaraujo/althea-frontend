import { CalendarDays, CheckCircle2, CircleAlert, Download, FileText, History, Image as ImageIcon, Paperclip, PlayCircle, Save, Trash2, TrendingUp, Video } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import {
  ACTION_KIND_LABEL, ACTION_STATUS_LABEL, ACTION_TYPE_LABEL, type ActionStatus, ACTOR_ROLE_LABEL, addEvidence, addKpiReading, deleteEvidence, deleteKpiReading,
  downloadEvidence, type Evidence, EVIDENCE_KIND_LABEL, evidenceBlob, getPlanItem, getPlanItemHistory, type HistoryEntry, type KpiReading, kpiIntervalLabel,
  type PlanItem, PRIORITY_LABEL, RECURRENCE_LABEL, setPlanItemDate, SHEET_FIELD_LABEL, updateProgress,
} from '../api/action-plan';
import { ApiError } from '../api/client';
import { StatusPill } from '../components/status-pill';
import { useToast } from '../components/toast';
import { Drawer, ErrorState, LoadingState } from '../components/ui';
import './benefits-agenda.css';

const PROGRESS_STATUSES: ActionStatus[] = ['pending', 'in_progress', 'completed'];
const EVIDENCE_ACCEPT = '.jpg,.jpeg,.png,.webp,.mp4,.mov,.m4v,.webm,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.csv';

function errorText(reason: unknown, fallback: string) {
  return reason instanceof ApiError ? reason.message : fallback;
}
function shortDate(value: string | null) {
  return value ? new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('pt-BR') : '—';
}
function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function dateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function clip(value: string | null) {
  return value && value.length > 160 ? `${value.slice(0, 160)}…` : value;
}
const HISTORY_PREVIEW = 6;
function emptyKpi() {
  return { value: '', reference_date: todayIso(), note: '' };
}
function fileSize(bytes: number | null) {
  if (!bytes) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
export function priorityTone(priority: PlanItem['priority']) {
  return priority === 'alta' ? 'warning' : priority === 'oportunidade' ? 'muted' : 'default';
}
export function statusTone(status: ActionStatus) {
  return status === 'completed' ? 'success' : status === 'cancelled' ? 'muted' : 'default';
}

/** Foto ou video guardado na plataforma: busca com o token e mostra na tela (o arquivo nao e publico). */
function EvidenceMedia({ token, evidence }: { token: string; evidence: Evidence }) {
  const [url, setUrl] = useState<string | null>(null);
  const [requested, setRequested] = useState(evidence.kind === 'photo');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!requested) return undefined;
    let objectUrl: string | null = null;
    let alive = true;
    evidenceBlob(token, evidence.id)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(evidence.mime_type ? new Blob([blob], { type: evidence.mime_type }) : blob);
        setUrl(objectUrl);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [token, evidence.id, evidence.mime_type, requested]);

  if (failed) return <p className="ben-hint">Não foi possível carregar o arquivo.</p>;
  if (evidence.kind === 'video') {
    if (!requested) return <button type="button" className="secondary-button apd-play" onClick={() => setRequested(true)}><PlayCircle size={16} />Assistir vídeo</button>;
    return url ? <video className="apd-media" src={url} controls preload="metadata" /> : <LoadingState />;
  }
  return url ? <a href={url} target="_blank" rel="noreferrer"><img className="apd-media apd-media--photo" src={url} alt={evidence.file_name ?? 'Foto da evidência'} /></a> : <div className="apd-media apd-media--loading" />;
}

function EvidenceIcon({ kind }: { kind: Evidence['kind'] }) {
  const Icon = kind === 'photo' ? ImageIcon : kind === 'video' ? Video : kind === 'document' ? Paperclip : FileText;
  return <Icon size={15} aria-hidden />;
}

type DetailProps = {
  token: string;
  itemId: string | null;
  onClose: () => void;
  /** A empresa (ou quem tem plano_acao.update) preenche o acompanhamento e envia evidencias. */
  canUpdate: boolean;
  /** Turi: pode apagar qualquer evidencia. */
  isAdmin?: boolean;
  currentUserId?: string | null;
  onChanged?: () => void;
};

/**
 * Pop-up de uma acao do plano: o planejamento (campos da planilha), o acompanhamento que a empresa
 * preenche (situacao, valor final, resultado, comentarios) e as evidencias (memorial, fotos, videos, documentos).
 */
export function ActionPlanItemDetail({ token, itemId, onClose, canUpdate, isAdmin = false, currentUserId, onChanged }: DetailProps) {
  const toast = useToast();
  const [item, setItem] = useState<PlanItem | null>(null);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState({ status: 'pending' as ActionStatus, final_value: '', result: '', comments: '' });
  const [memorial, setMemorial] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [kpi, setKpi] = useState(emptyKpi);
  const [busy, setBusy] = useState(false);
  const [dates, setDates] = useState({ start_date: '', due_at: '' });
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [allHistory, setAllHistory] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const apply = useCallback((next: PlanItem) => {
    setItem(next);
    setDates({ start_date: next.start_date ?? '', due_at: next.due_at ?? '' });
    setProgress({ status: next.status === 'cancelled' ? 'pending' : next.status, final_value: next.final_value ?? '', result: next.result ?? '', comments: next.comments ?? '' });
  }, []);
  const load = useCallback(() => {
    if (!itemId) return;
    setFailed(false); setItem(null);
    getPlanItem(token, itemId).then(apply).catch(() => setFailed(true));
  }, [token, itemId, apply]);
  useEffect(load, [load]);
  useEffect(() => { setMemorial(''); setFile(null); setUploadPercent(null); setKpi(emptyKpi()); setHistory(null); setAllHistory(false); }, [itemId]);
  // O historico acompanha cada mudanca na acao (o item volta atualizado depois de cada uma).
  useEffect(() => {
    if (!item) return undefined;
    let alive = true;
    getPlanItemHistory(token, item.id).then((rows) => alive && setHistory(rows)).catch(() => alive && setHistory([]));
    return () => { alive = false; };
  }, [token, item]);

  async function saveDate(event: FormEvent) {
    event.preventDefault();
    if (!item || busy || !dates.start_date) return;
    setBusy(true);
    try {
      apply(await setPlanItemDate(token, item.id, { start_date: dates.start_date, due_at: dates.due_at || null }));
      toast.success('Data salva. Ela já aparece na agenda.');
      onChanged?.();
    } catch (reason) {
      toast.error(errorText(reason, 'Não foi possível salvar a data.'));
    } finally {
      setBusy(false);
    }
  }

  async function saveProgress(event: FormEvent) {
    event.preventDefault();
    if (!item || busy) return;
    setBusy(true);
    try {
      apply(await updateProgress(token, item.id, progress));
      toast.success('Acompanhamento salvo.');
      onChanged?.();
    } catch (reason) {
      toast.error(errorText(reason, 'Não foi possível salvar.'));
    } finally {
      setBusy(false);
    }
  }

  async function sendEvidence(event: FormEvent) {
    event.preventDefault();
    if (!item || busy || (!memorial.trim() && !file)) return;
    setBusy(true); setUploadPercent(file ? 0 : null);
    try {
      await addEvidence(token, item.id, { text: memorial.trim() || undefined, file }, file ? setUploadPercent : undefined);
      toast.success('Evidência enviada.');
      setMemorial(''); setFile(null); if (fileInput.current) fileInput.current.value = '';
      apply(await getPlanItem(token, item.id));
      onChanged?.();
    } catch (reason) {
      toast.error(errorText(reason, 'Não foi possível enviar a evidência.'));
    } finally {
      setBusy(false); setUploadPercent(null);
    }
  }

  async function sendReading(event: FormEvent) {
    event.preventDefault();
    if (!item || busy || !kpi.value.trim()) return;
    setBusy(true);
    try {
      apply(await addKpiReading(token, item.id, { value: kpi.value.trim(), reference_date: kpi.reference_date || null, note: kpi.note.trim() || null }));
      setKpi(emptyKpi());
      toast.success('Valor do KPI registrado.');
      onChanged?.();
    } catch (reason) {
      toast.error(errorText(reason, 'Não foi possível registrar o valor.'));
    } finally {
      setBusy(false);
    }
  }

  async function removeReading(reading: KpiReading) {
    if (!item || busy || !window.confirm(`Apagar o valor ${reading.value}?`)) return;
    setBusy(true);
    try {
      apply(await deleteKpiReading(token, reading.id));
      toast.success('Valor apagado.');
      onChanged?.();
    } catch (reason) {
      toast.error(errorText(reason, 'Não foi possível apagar.'));
    } finally {
      setBusy(false);
    }
  }

  async function removeEvidence(evidence: Evidence) {
    if (!item || busy || !window.confirm('Apagar esta evidência?')) return;
    setBusy(true);
    try {
      await deleteEvidence(token, evidence.id);
      toast.success('Evidência apagada.');
      apply(await getPlanItem(token, item.id));
      onChanged?.();
    } catch (reason) {
      toast.error(errorText(reason, 'Não foi possível apagar.'));
    } finally {
      setBusy(false);
    }
  }

  const facts: { label: string; value: string | null }[] = item ? [
    { label: SHEET_FIELD_LABEL.risk_factor, value: item.risk_factor },
    { label: SHEET_FIELD_LABEL.exposure_group, value: item.exposure_group },
    { label: SHEET_FIELD_LABEL.objective, value: item.objective },
    { label: SHEET_FIELD_LABEL.indicator, value: item.indicator },
    { label: SHEET_FIELD_LABEL.initial_value, value: item.initial_value },
    { label: SHEET_FIELD_LABEL.action_kind, value: item.action_kind ? ACTION_KIND_LABEL[item.action_kind] : null },
    { label: 'Responsável pela execução', value: item.owner_name },
    { label: SHEET_FIELD_LABEL.monitoring_owner, value: item.monitoring_owner },
    { label: 'Data limite / prazo de conclusão', value: item.due_at ? shortDate(item.due_at) : null },
    { label: SHEET_FIELD_LABEL.resources, value: item.resources },
  ] : [];
  const filled = facts.filter((fact) => fact.value);
  const editable = canUpdate && item?.status !== 'cancelled';

  return (
    <Drawer open={Boolean(itemId)} onClose={busy ? () => undefined : onClose} title={item?.title ?? 'Ação do plano'} size="lg"
      description={item ? `${ACTION_TYPE_LABEL[item.item_type]} · ${RECURRENCE_LABEL[item.recurrence_type]}${item.next_occurrence ? ` · próxima data: ${shortDate(item.next_occurrence)}` : ''}` : undefined}>
      {failed ? <ErrorState message="Não foi possível carregar a ação." onRetry={load} /> : null}
      {!failed && !item ? <LoadingState /> : null}
      {item ? (
        <div className="apd">
          <div className="apd-pills">
            <StatusPill tone={statusTone(item.status)}>{ACTION_STATUS_LABEL[item.status]}</StatusPill>
            {item.priority ? <StatusPill tone={priorityTone(item.priority)}>Prioridade {PRIORITY_LABEL[item.priority].toLowerCase()}</StatusPill> : null}
            {item.occurrence_count ? <span className="apd-meta"><CalendarDays size={13} aria-hidden />{item.occurrences_done} de {item.occurrence_count} data(s) feita(s)</span> : null}
          </div>
          {item.description ? <p className="apd-desc">{item.description}</p> : null}

          {item.company_sets_date && item.recurrence_type !== 'custom_dates' ? (
            <section className="apd-section">
              <h3><CalendarDays size={15} aria-hidden />Data da ação</h3>
              {editable ? (
                <form className="admin-form apd-upload" onSubmit={(event) => void saveDate(event)}>
                  <p className="ben-hint">{item.start_date ? 'A Turi deixou vocês ajustarem a data desta ação.' : 'A Turi deixou esta data para vocês definirem. Depois de salvar, ela aparece na agenda.'}</p>
                  <div className="field-grid">
                    <label><span>{item.recurrence_type === 'once' ? 'Data' : 'Começa em'}</span><input type="date" value={dates.start_date} onChange={(event) => setDates({ ...dates, start_date: event.target.value })} required disabled={busy} /></label>
                    <label><span>Prazo de conclusão <em className="ben-optional">(opcional)</em></span><input type="date" value={dates.due_at} onChange={(event) => setDates({ ...dates, due_at: event.target.value })} disabled={busy} /></label>
                  </div>
                  <button className="primary-button" disabled={busy || !dates.start_date || (dates.start_date === (item.start_date ?? '') && dates.due_at === (item.due_at ?? ''))}><CalendarDays size={15} />Salvar data</button>
                </form>
              ) : <p className="ben-hint">{item.start_date ? `${item.recurrence_type === 'once' ? 'Data' : 'Começa em'} ${shortDate(item.start_date)}, definida pela empresa.` : 'Data a definir pela empresa.'}</p>}
            </section>
          ) : null}

          <section className="apd-section">
            <h3>Planejamento</h3>
            {filled.length ? (
              <dl className="apd-facts">{filled.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
            ) : <p className="ben-hint">A Turi ainda não detalhou o planejamento desta ação.</p>}
          </section>

          {item.indicator ? (
            <section className="apd-section">
              <h3>Indicador (KPI) <span className="apd-count">{item.kpi_readings.length}</span></h3>
              <p className="ben-hint">{item.indicator} · {kpiIntervalLabel(item.kpi_interval_months).toLowerCase()}{item.initial_value ? ` · valor inicial: ${item.initial_value}` : ''}</p>
              {item.kpi_tracked && item.kpi_status && item.kpi_next_due ? (
                <p className={item.kpi_status === 'ok' ? 'agd-ok' : 'agd-alert'}>
                  {item.kpi_status === 'ok' ? <CheckCircle2 size={15} aria-hidden /> : <CircleAlert size={15} aria-hidden />}
                  {item.kpi_status === 'overdue' ? `O valor do KPI está atrasado: o prazo era ${shortDate(item.kpi_next_due)}.`
                    : item.kpi_status === 'due_soon' ? `Informe o valor do KPI até ${shortDate(item.kpi_next_due)}.`
                      : `KPI em dia. Próximo valor até ${shortDate(item.kpi_next_due)}.`}
                </p>
              ) : null}
              {item.kpi_readings.length ? (
                <ul className="apd-evidences">
                  {item.kpi_readings.map((reading) => {
                    const canDelete = canUpdate && (isAdmin || reading.created_by === currentUserId);
                    return (
                      <li key={reading.id} className="apd-evidence">
                        <div className="apd-evidence__head">
                          <span className="apd-evidence__kind"><TrendingUp size={15} aria-hidden /><strong>{reading.value}</strong></span>
                          <span className="ben-hint">em {shortDate(reading.reference_date)} · {reading.created_by_name ?? '—'}</span>
                          <span className="apd-evidence__actions">
                            {canDelete ? <button type="button" className="org-icon-btn" title="Apagar" aria-label={`Apagar o valor ${reading.value}`} disabled={busy} onClick={() => void removeReading(reading)}><Trash2 size={14} /></button> : null}
                          </span>
                        </div>
                        {reading.note ? <p className="apd-evidence__text">{reading.note}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="ben-hint">Nenhum valor informado ainda.</p>}
              {editable ? (
                <form className="admin-form apd-upload" onSubmit={(event) => void sendReading(event)}>
                  <div className="field-grid">
                    <label><span>Valor atual do indicador</span><input value={kpi.value} onChange={(event) => setKpi({ ...kpi, value: event.target.value })} maxLength={255} disabled={busy} required placeholder={item.kpi_readings[0] ? `Último: ${item.kpi_readings[0].value}` : item.initial_value ? `Inicial: ${item.initial_value}` : 'Ex.: 35%'} /></label>
                    <label><span>Medido em</span><input type="date" value={kpi.reference_date} max={todayIso()} onChange={(event) => setKpi({ ...kpi, reference_date: event.target.value })} disabled={busy} /></label>
                  </div>
                  <label><span>Observação <em className="ben-optional">(opcional)</em></span><textarea rows={2} value={kpi.note} onChange={(event) => setKpi({ ...kpi, note: event.target.value })} maxLength={2000} disabled={busy} /></label>
                  <button className="primary-button" disabled={busy || !kpi.value.trim()}><TrendingUp size={15} />Informar valor</button>
                </form>
              ) : null}
            </section>
          ) : null}

          <section className="apd-section">
            <h3>Acompanhamento</h3>
            {editable ? (
              <form className="admin-form apd-progress" onSubmit={(event) => void saveProgress(event)}>
                <div className="field-grid">
                  <label><span>Situação</span>
                    <select value={progress.status} onChange={(event) => setProgress({ ...progress, status: event.target.value as ActionStatus })} disabled={busy}>
                      {PROGRESS_STATUSES.map((key) => <option key={key} value={key}>{ACTION_STATUS_LABEL[key]}</option>)}
                    </select>
                  </label>
                  {/* Com indicador, o valor final e sempre o ultimo valor do KPI informado acima. */}
                  {item.indicator ? null : <label><span>Valor final (após a ação)</span><input value={progress.final_value} onChange={(event) => setProgress({ ...progress, final_value: event.target.value })} maxLength={255} disabled={busy} placeholder={item.initial_value ? `Antes: ${item.initial_value}` : 'Ex.: 35% de expostos'} /></label>}
                </div>
                <label><span>Resultado da ação</span><textarea rows={2} value={progress.result} onChange={(event) => setProgress({ ...progress, result: event.target.value })} maxLength={4000} disabled={busy} /></label>
                <label><span>Comentários / observações</span><textarea rows={2} value={progress.comments} onChange={(event) => setProgress({ ...progress, comments: event.target.value })} maxLength={4000} disabled={busy} /></label>
                <div className="apd-progress__footer">
                  <span className="ben-hint">{item.progress_updated_at ? `Atualizado em ${shortDate(item.progress_updated_at)}${item.progress_updated_by_name ? ` por ${item.progress_updated_by_name}` : ''}` : 'Ainda sem atualização da empresa.'}</span>
                  <button className="primary-button" disabled={busy}><Save size={15} />Salvar</button>
                </div>
              </form>
            ) : (
              <>
                {item.final_value || item.result || item.comments ? (
                  <dl className="apd-facts">
                    {item.final_value ? <div><dt>Valor final (após a ação)</dt><dd>{item.final_value}</dd></div> : null}
                    {item.result ? <div><dt>Resultado da ação</dt><dd>{item.result}</dd></div> : null}
                    {item.comments ? <div><dt>Comentários / observações</dt><dd>{item.comments}</dd></div> : null}
                  </dl>
                ) : <p className="ben-hint">A empresa ainda não preencheu o acompanhamento.</p>}
                {item.progress_updated_at ? <p className="ben-hint">Atualizado em {shortDate(item.progress_updated_at)}{item.progress_updated_by_name ? ` por ${item.progress_updated_by_name}` : ''}.</p> : null}
              </>
            )}
          </section>

          <section className="apd-section">
            <h3>Evidências <span className="apd-count">{item.evidences.length}</span></h3>
            {item.evidences.length ? (
              <ul className="apd-evidences">
                {item.evidences.map((evidence) => {
                  const canDelete = canUpdate && (isAdmin || evidence.created_by === currentUserId);
                  return (
                    <li key={evidence.id} className="apd-evidence">
                      <div className="apd-evidence__head">
                        <span className="apd-evidence__kind"><EvidenceIcon kind={evidence.kind} />{EVIDENCE_KIND_LABEL[evidence.kind]}</span>
                        <span className="ben-hint">{evidence.created_by_name ?? '—'} · {shortDate(evidence.created_at)}</span>
                        <span className="apd-evidence__actions">
                          {evidence.file_name ? <button type="button" className="org-icon-btn" title="Baixar" aria-label={`Baixar ${evidence.file_name}`} onClick={() => void downloadEvidence(token, evidence).catch((reason) => toast.error(errorText(reason, 'Não foi possível baixar.')))}><Download size={14} /></button> : null}
                          {canDelete ? <button type="button" className="org-icon-btn" title="Apagar" aria-label="Apagar evidência" disabled={busy} onClick={() => void removeEvidence(evidence)}><Trash2 size={14} /></button> : null}
                        </span>
                      </div>
                      {evidence.text ? <p className="apd-evidence__text">{evidence.text}</p> : null}
                      {evidence.kind === 'photo' || evidence.kind === 'video' ? <EvidenceMedia token={token} evidence={evidence} /> : null}
                      {evidence.kind === 'document' ? <span className="apd-evidence__file"><Paperclip size={13} aria-hidden />{evidence.file_name} {fileSize(evidence.size)}</span> : null}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="ben-hint">Nenhuma evidência ainda.</p>}

            {editable ? (
              <form className="admin-form apd-upload" onSubmit={(event) => void sendEvidence(event)}>
                <label><span>Memorial <em className="ben-optional">(o que foi feito, quando, quem participou)</em></span>
                  <textarea rows={3} value={memorial} onChange={(event) => setMemorial(event.target.value)} maxLength={10000} disabled={busy} placeholder="Ex.: Roda de conversa com 18 líderes em 10/11, conduzida pelo RH." />
                </label>
                <label><span>Foto, vídeo ou documento <em className="ben-optional">(opcional · vídeos até 100 MB, demais até 15 MB)</em></span>
                  <input ref={fileInput} type="file" accept={EVIDENCE_ACCEPT} onChange={(event) => setFile(event.target.files?.[0] ?? null)} disabled={busy} />
                </label>
                {uploadPercent !== null ? <div className="apd-progressbar" role="progressbar" aria-valuenow={uploadPercent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${uploadPercent}%` }} /></div> : null}
                <button className="primary-button" disabled={busy || (!memorial.trim() && !file)}>{uploadPercent !== null ? `Enviando ${uploadPercent}%` : 'Enviar evidência'}</button>
              </form>
            ) : null}
          </section>

          <section className="apd-section">
            <h3><History size={15} aria-hidden />Histórico {history ? <span className="apd-count">{history.length}</span> : null}</h3>
            {history === null ? <p className="ben-hint">Carregando o histórico…</p> : history.length ? (
              <>
                <ol className="apd-history">
                  {(allHistory ? history : history.slice(0, HISTORY_PREVIEW)).map((entry) => (
                    <li key={entry.id} className="apd-history__item">
                      <div className="apd-history__head">
                        <strong>{entry.actor_name ?? 'Alguém'}</strong>
                        {entry.actor_role ? <span className="apd-history__role">{ACTOR_ROLE_LABEL[entry.actor_role] ?? entry.actor_role}</span> : null}
                        <span className="ben-hint apd-history__when">{dateTime(entry.created_at)}</span>
                      </div>
                      <span className="apd-history__what">{entry.action_label}{entry.summary ? `: ${entry.summary}` : ''}</span>
                      {entry.changes.length ? (
                        <ul className="apd-history__changes">
                          {entry.changes.map((change) => (
                            <li key={change.field}>
                              <span className="apd-history__label">{change.label}:</span>{' '}
                              {change.old ? <span className="apd-history__old" title={change.old}>{clip(change.old)}</span> : <em className="apd-history__empty">vazio</em>}
                              {' → '}
                              {change.new ? <span title={change.new}>{clip(change.new)}</span> : <em className="apd-history__empty">vazio</em>}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ol>
                {history.length > HISTORY_PREVIEW ? (
                  <button type="button" className="secondary-button apd-history__more" onClick={() => setAllHistory(!allHistory)}>{allHistory ? 'Mostrar menos' : `Ver tudo (${history.length})`}</button>
                ) : null}
              </>
            ) : <p className="ben-hint">Nada registrado ainda.</p>}
            <p className="ben-hint">Cada alteração fica registrada com o nome de quem fez. Por isso cada pessoa entra com o próprio login.</p>
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}
