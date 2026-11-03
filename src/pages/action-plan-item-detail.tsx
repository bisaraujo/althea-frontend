import { CalendarDays, Download, FileText, Image as ImageIcon, Paperclip, PlayCircle, Save, Trash2, Video } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import {
  ACTION_KIND_LABEL, ACTION_STATUS_LABEL, ACTION_TYPE_LABEL, type ActionStatus, addEvidence, deleteEvidence, downloadEvidence, type Evidence,
  EVIDENCE_KIND_LABEL, evidenceBlob, getPlanItem, type PlanItem, PRIORITY_LABEL, RECURRENCE_LABEL, SHEET_FIELD_LABEL, updateProgress,
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
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const apply = useCallback((next: PlanItem) => {
    setItem(next);
    setProgress({ status: next.status === 'cancelled' ? 'pending' : next.status, final_value: next.final_value ?? '', result: next.result ?? '', comments: next.comments ?? '' });
  }, []);
  const load = useCallback(() => {
    if (!itemId) return;
    setFailed(false); setItem(null);
    getPlanItem(token, itemId).then(apply).catch(() => setFailed(true));
  }, [token, itemId, apply]);
  useEffect(load, [load]);
  useEffect(() => { setMemorial(''); setFile(null); setUploadPercent(null); }, [itemId]);

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

          <section className="apd-section">
            <h3>Planejamento</h3>
            {filled.length ? (
              <dl className="apd-facts">{filled.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
            ) : <p className="ben-hint">A Turi ainda não detalhou o planejamento desta ação.</p>}
          </section>

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
                  <label><span>Valor final (após a ação)</span><input value={progress.final_value} onChange={(event) => setProgress({ ...progress, final_value: event.target.value })} maxLength={255} disabled={busy} placeholder={item.initial_value ? `Antes: ${item.initial_value}` : 'Ex.: 35% de expostos'} /></label>
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
        </div>
      ) : null}
    </Drawer>
  );
}
