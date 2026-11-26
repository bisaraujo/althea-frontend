import { ChevronRight, ClipboardList, Download, FileSpreadsheet, Paperclip, Pencil, Plus, X } from 'lucide-react';
import { type FormEvent, Fragment, type ReactNode, useCallback, useEffect, useState } from 'react';

import {
  ACTION_KIND_LABEL, ACTION_STATUS_LABEL, ACTION_TYPE_LABEL, type ActionItemType, type ActionKind, type ActionStatus, createPlanItem, exportPlanSheet,
  getPlan, KPI_INTERVAL_OPTIONS, KPI_STATUS_LABEL, kpiIntervalLabel, type Plan, type PlanItem, type PlanItemPayload, type Priority, PRIORITY_LABEL,
  RECURRENCE_LABEL, type RecurrenceType, SHEET_FIELD_LABEL, type SheetFields, updatePlanItem,
} from '../api/action-plan';
import { type Benefit, listBenefits } from '../api/benefits';
import { ApiError } from '../api/client';
import { SectionPanel } from '../components/section-panel';
import { StatusPill } from '../components/status-pill';
import { useToast } from '../components/toast';
import { Drawer, ErrorState, LoadingState } from '../components/ui';
import { ActionPlanImport } from './action-plan-import';
import { ActionPlanItemDetail, priorityTone, statusTone } from './action-plan-item-detail';
import './benefits-agenda.css';

const emptySheet: SheetFields = { risk_factor: null, exposure_group: null, objective: null, priority: null, indicator: null, initial_value: null, action_kind: null, monitoring_owner: null, resources: null };
const emptyDraft: PlanItemPayload = { title: '', description: null, owner_name: null, item_type: 'acao', recurrence_type: 'once', start_date: null, custom_dates: [], benefit_id: null, due_at: null, ...emptySheet };
const SHEET_TEXT_FIELDS: (keyof SheetFields)[] = ['risk_factor', 'exposure_group', 'objective', 'indicator', 'initial_value', 'monitoring_owner', 'resources'];
const LONG_FIELDS = new Set<keyof SheetFields>(['objective', 'indicator', 'resources']);

function errorText(reason: unknown, fallback: string) {
  return reason instanceof ApiError ? reason.message : fallback;
}
function shortDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : '—';
}

function ItemForm({ draft, onChange, benefits }: { draft: PlanItemPayload; onChange: (next: PlanItemPayload) => void; benefits: Benefit[] }) {
  const [newDate, setNewDate] = useState('');
  const set = <K extends keyof PlanItemPayload>(key: K, value: PlanItemPayload[K]) => onChange({ ...draft, [key]: value });
  return (
    <>
      <label><span>Ação</span><input value={draft.title} onChange={(event) => set('title', event.target.value)} required maxLength={255} placeholder="Ex.: Roda de conversa sobre saúde mental" /></label>
      <div className="field-grid">
        <label><span>Tipo</span>
          <select value={draft.item_type} onChange={(event) => onChange({ ...draft, item_type: event.target.value as ActionItemType, benefit_id: event.target.value === 'beneficio' ? draft.benefit_id : null })}>
            {(Object.keys(ACTION_TYPE_LABEL) as ActionItemType[]).map((key) => <option key={key} value={key}>{ACTION_TYPE_LABEL[key]}</option>)}
          </select>
        </label>
        <label><span>Responsável</span><input value={draft.owner_name ?? ''} onChange={(event) => set('owner_name', event.target.value || null)} maxLength={255} /></label>
      </div>
      {draft.item_type === 'beneficio' ? (
        <label><span>Benefício</span>
          <select value={draft.benefit_id ?? ''} onChange={(event) => set('benefit_id', event.target.value || null)} required>
            <option value="">{benefits.length ? 'Escolha o benefício' : 'A empresa ainda não tem benefícios cadastrados'}</option>
            {benefits.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      ) : null}
      <div className="field-grid">
        <label><span>Recorrência</span>
          <select value={draft.recurrence_type} onChange={(event) => set('recurrence_type', event.target.value as RecurrenceType)}>
            {(Object.keys(RECURRENCE_LABEL) as RecurrenceType[]).map((key) => <option key={key} value={key}>{RECURRENCE_LABEL[key]}</option>)}
          </select>
        </label>
        {draft.recurrence_type !== 'custom_dates' ? (
          <label><span>{draft.recurrence_type === 'once' ? 'Data' : 'Começa em'}</span><input type="date" value={draft.start_date ?? ''} onChange={(event) => set('start_date', event.target.value || null)} required={draft.recurrence_type !== 'once'} /></label>
        ) : (
          <label><span>Adicionar data</span>
            <span className="agd-date-add">
              <input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} />
              <button type="button" className="secondary-button" disabled={!newDate} onClick={() => { if (newDate && !draft.custom_dates?.includes(newDate)) set('custom_dates', [...(draft.custom_dates ?? []), newDate].sort()); setNewDate(''); }}>Adicionar</button>
            </span>
          </label>
        )}
      </div>
      {draft.recurrence_type !== 'custom_dates' ? (
        <label className="apd-check">
          <input type="checkbox" checked={draft.company_sets_date ?? (draft.recurrence_type === 'once' && !draft.start_date)} onChange={(event) => set('company_sets_date', event.target.checked)} />
          <span>A empresa define a data <em className="ben-optional">({draft.start_date ? 'ela pode ajustar a data acima' : 'deixe a data em branco para ela escolher'})</em></span>
        </label>
      ) : null}
      {draft.recurrence_type === 'custom_dates' ? (
        <div className="agd-dates">
          {(draft.custom_dates ?? []).length ? (draft.custom_dates ?? []).map((value) => (
            <span key={value} className="agd-date-tag">{shortDate(value)}<button type="button" aria-label={`Remover ${shortDate(value)}`} onClick={() => set('custom_dates', (draft.custom_dates ?? []).filter((item) => item !== value))}><X size={12} /></button></span>
          )) : <span className="ben-hint">Nenhuma data escolhida.</span>}
        </div>
      ) : null}
      {draft.recurrence_type !== 'once' && draft.recurrence_type !== 'custom_dates' ? <p className="ben-hint">As datas são geradas para os próximos 12 meses e aparecem na agenda da empresa.</p> : null}
      <label><span>Descrição <em className="ben-optional">(opcional)</em></span><textarea rows={2} value={draft.description ?? ''} onChange={(event) => set('description', event.target.value || null)} maxLength={2000} /></label>
      <details className="apd-sheet-fields" open={SHEET_TEXT_FIELDS.some((key) => draft[key]) || Boolean(draft.priority || draft.action_kind || draft.due_at)}>
        <summary>Detalhes da planilha NR-01 <em className="ben-optional">(fator de risco, objetivo, indicador…)</em></summary>
        {/* <details> nao aplica grid nos filhos: o espacamento entre os campos vem deste bloco. */}
        <div className="apd-sheet-fields__body">
        <div className="field-grid">
          <label><span>{SHEET_FIELD_LABEL.priority}</span>
            <select value={draft.priority ?? ''} onChange={(event) => set('priority', (event.target.value || null) as Priority | null)}>
              <option value="">—</option>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((key) => <option key={key} value={key}>{PRIORITY_LABEL[key]}</option>)}
            </select>
          </label>
          <label><span>{SHEET_FIELD_LABEL.action_kind}</span>
            <select value={draft.action_kind ?? ''} onChange={(event) => set('action_kind', (event.target.value || null) as ActionKind | null)}>
              <option value="">—</option>
              {(Object.keys(ACTION_KIND_LABEL) as ActionKind[]).map((key) => <option key={key} value={key}>{ACTION_KIND_LABEL[key]}</option>)}
            </select>
          </label>
        </div>
        <label><span>Data limite / prazo de conclusão</span><input type="date" value={draft.due_at ?? ''} onChange={(event) => set('due_at', event.target.value || null)} /></label>
        {SHEET_TEXT_FIELDS.map((key) => (
          <Fragment key={key}>
            <label><span>{SHEET_FIELD_LABEL[key]}</span>
              {LONG_FIELDS.has(key)
                ? <textarea rows={2} value={draft[key] ?? ''} onChange={(event) => set(key, event.target.value || null)} maxLength={4000} />
                : <input value={draft[key] ?? ''} onChange={(event) => set(key, event.target.value || null)} maxLength={key === 'risk_factor' ? 2000 : 255} />}
              {key === 'indicator' && !draft.indicator ? <em className="ben-optional">Com um indicador, a empresa passa a informar o valor (KPI) periodicamente.</em> : null}
            </label>
            {/* Frequencia do KPI logo abaixo do indicador (so existe KPI quando ha indicador). */}
            {key === 'indicator' && draft.indicator ? (
              <label><span>Empresa informa o valor do indicador (KPI)</span>
                <select value={draft.kpi_interval_months ?? 2} onChange={(event) => set('kpi_interval_months', Number(event.target.value))}>
                  {KPI_INTERVAL_OPTIONS.map((months) => <option key={months} value={months}>{kpiIntervalLabel(months)}</option>)}
                </select>
              </label>
            ) : null}
          </Fragment>
        ))}
        </div>
      </details>
    </>
  );
}

function PlanRow({ item, onOpen, side }: { item: PlanItem; onOpen: () => void; side: ReactNode }) {
  return (
    <article className={`agd-plan-item${item.status === 'cancelled' ? ' is-cancelled' : ''}`}>
      <span className={`agd-dot agd-dot--${item.item_type}`} aria-hidden />
      <button type="button" className="agd-plan-item__copy agd-plan-item__open" onClick={onOpen} title="Abrir a ação">
        <strong>{item.title}</strong>
        <span>{[ACTION_TYPE_LABEL[item.item_type], RECURRENCE_LABEL[item.recurrence_type], item.risk_factor, item.owner_name, item.benefit_name].filter(Boolean).join(' · ')}</span>
        <span className="agd-plan-item__tags">
          {item.priority ? <StatusPill tone={priorityTone(item.priority)}>{PRIORITY_LABEL[item.priority]}</StatusPill> : null}
          {item.due_at ? <span className="ben-hint">Prazo {shortDate(item.due_at)}</span> : null}
          {item.occurrence_count ? <span className="ben-hint">{`${item.occurrences_done} de ${item.occurrence_count} data(s) feita(s)${item.next_occurrence ? ` · próxima: ${shortDate(item.next_occurrence)}` : ''}`}</span>
            : item.company_sets_date ? <StatusPill tone="warning">Data a definir pela empresa</StatusPill> : <span className="ben-hint">Sem datas na agenda</span>}
          {item.evidences.length ? <span className="ben-hint"><Paperclip size={12} aria-hidden /> {item.evidences.length}</span> : null}
          {item.kpi_status && item.kpi_status !== 'ok' ? <StatusPill tone="warning">{KPI_STATUS_LABEL[item.kpi_status]}</StatusPill> : null}
        </span>
      </button>
      <div className="agd-plan-item__side">{side}<ChevronRight size={16} className="agd-plan-item__chevron" aria-hidden /></div>
    </article>
  );
}

/**
 * Plano de acao da empresa: acoes com tipo, recorrencia e datas.
 * A Turi (admin) cria e reprograma; a empresa ve a mesma lista em modo leitura (readOnly).
 */
type EditorProps = {
  token: string; companyId: string;
  /** Visao da empresa: so acompanha (preenche o acompanhamento e evidencias se tiver plano_acao.update). */
  readOnly?: boolean; canUpdate?: boolean; currentUserId?: string | null;
};

export function ActionPlanEditor({ token, companyId, readOnly = false, canUpdate = false, currentUserId = null }: EditorProps) {
  const toast = useToast();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [failed, setFailed] = useState(false);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [draft, setDraft] = useState<PlanItemPayload>(emptyDraft);
  const [editing, setEditing] = useState<{ item: PlanItem; draft: PlanItemPayload } | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => { setFailed(false); getPlan(token, companyId).then(setPlan).catch(() => setFailed(true)); }, [token, companyId]);
  useEffect(load, [load]);
  useEffect(() => { if (!readOnly) listBenefits(token, companyId).then(setBenefits).catch(() => setBenefits([])); }, [token, companyId, readOnly]);

  async function run(action: () => Promise<unknown>, message: string) {
    if (saving) return false;
    setSaving(true);
    try { await action(); toast.success(message); load(); return true; }
    catch (reason) { toast.error(errorText(reason, 'Não foi possível salvar.')); return false; }
    finally { setSaving(false); }
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    if (await run(() => createPlanItem(token, companyId, { ...draft, title: draft.title.trim() }), 'Ação criada e datas adicionadas à agenda.')) setDraft(emptyDraft);
  }
  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (await run(() => updatePlanItem(token, editing.item.id, { ...editing.draft, title: editing.draft.title.trim() }), 'Ação atualizada. As datas futuras foram reprogramadas.')) setEditing(null);
  }
  function startEdit(item: PlanItem) {
    const sheet = Object.fromEntries((Object.keys(emptySheet) as (keyof SheetFields)[]).map((key) => [key, item[key]])) as SheetFields;
    setEditing({ item, draft: { title: item.title, description: item.description, owner_name: item.owner_name, item_type: item.item_type, recurrence_type: item.recurrence_type, start_date: item.start_date, custom_dates: item.custom_dates, benefit_id: item.benefit_id, due_at: item.due_at, kpi_interval_months: item.kpi_interval_months, company_sets_date: item.company_sets_date, ...sheet } });
  }
  function exportSheet() {
    exportPlanSheet(token, companyId).catch((reason) => toast.error(errorText(reason, 'Não foi possível exportar.')));
  }
  const exportButton = <button type="button" className="secondary-button" onClick={exportSheet} disabled={!plan?.items.length}><Download size={15} />Exportar planilha</button>;
  const detail = <ActionPlanItemDetail token={token} itemId={openId} onClose={() => setOpenId(null)} canUpdate={readOnly ? canUpdate : true} isAdmin={!readOnly} currentUserId={currentUserId} onChanged={load} />;

  if (failed) return <ErrorState message="Não foi possível carregar o plano de ação." onRetry={load} />;
  if (!plan) return <LoadingState />;

  const active = plan.items.filter((item) => item.status !== 'cancelled');

  if (readOnly) {
    return (
      <SectionPanel title="Ações do plano" eyebrow={`${active.length} ativa(s)`} action={exportButton}>
        {plan.items.length ? (
          <>
            <p className="ben-hint agd-plan-hint">Toque numa ação para ver o planejamento{canUpdate ? ', definir as datas que ficaram com vocês, atualizar o andamento e enviar evidências (memorial, fotos, vídeos)' : ' e as evidências'}. Cada alteração fica no histórico da ação com o nome de quem fez.</p>
            <div className="agd-plan-list agd-plan-list--scroll">
              {plan.items.map((item) => (
                <PlanRow key={item.id} item={item} onOpen={() => setOpenId(item.id)} side={<StatusPill tone={statusTone(item.status)}>{ACTION_STATUS_LABEL[item.status]}</StatusPill>} />
              ))}
            </div>
          </>
        ) : <p className="agd-empty"><ClipboardList size={16} aria-hidden />A Turi vai montar o plano de ação com vocês. As ações aparecem aqui e na agenda.</p>}
        {detail}
      </SectionPanel>
    );
  }

  return (
    <div className="agd-editor">
      <SectionPanel title="Nova ação" eyebrow="Programação">
        <form className="admin-form" onSubmit={(event) => void add(event)}>
          <fieldset disabled={saving} className="ben-fieldset"><ItemForm draft={draft} onChange={setDraft} benefits={benefits} /></fieldset>
          <button className="primary-button" disabled={saving || !draft.title.trim()}><Plus size={16} />Adicionar ação</button>
        </form>
      </SectionPanel>
      <SectionPanel title="Plano de ação da empresa" eyebrow={`${active.length} ativa(s)`} action={
        <span className="agd-plan-actions">
          <button type="button" className="secondary-button" onClick={() => setImporting(true)}><FileSpreadsheet size={15} />Importar planilha</button>
          {exportButton}
        </span>
      }>
        {plan.items.length ? (
          <div className="agd-plan-list agd-plan-list--scroll">
            {plan.items.map((item) => (
              <PlanRow key={item.id} item={item} onOpen={() => setOpenId(item.id)} side={<>
                <select className="action-status-select" aria-label={`Situação de ${item.title}`} value={item.status} disabled={saving} onChange={(event) => void run(() => updatePlanItem(token, item.id, { status: event.target.value as ActionStatus }), 'Situação atualizada.')}>
                  {(Object.keys(ACTION_STATUS_LABEL) as ActionStatus[]).map((key) => <option key={key} value={key}>{ACTION_STATUS_LABEL[key]}</option>)}
                </select>
                <button type="button" className="org-icon-btn" aria-label={`Editar ${item.title}`} title="Editar" onClick={() => startEdit(item)}><Pencil size={14} /></button>
              </>} />
            ))}
          </div>
        ) : <p className="agd-empty"><ClipboardList size={16} aria-hidden />Nenhuma ação ainda. Crie a primeira ao lado ou importe a planilha do plano; as datas aparecem na agenda da empresa.</p>}
      </SectionPanel>
      {detail}
      <ActionPlanImport token={token} companyId={companyId} open={importing} onClose={() => setImporting(false)} onImported={load} />
      {editing ? (
        <Drawer open onClose={saving ? () => undefined : () => setEditing(null)} title="Editar ação" description="Mudar a recorrência ou as datas refaz só as datas futuras ainda não feitas." size="md"
          footer={<>
            <button type="button" className="secondary-button" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
            <button type="submit" form="plan-item-edit" className="primary-button" disabled={saving || !editing.draft.title.trim()}>Salvar</button>
          </>}>
          <form id="plan-item-edit" className="admin-form" onSubmit={(event) => void saveEdit(event)}>
            <fieldset disabled={saving} className="ben-fieldset"><ItemForm draft={editing.draft} onChange={(next) => setEditing({ ...editing, draft: next })} benefits={benefits} /></fieldset>
          </form>
        </Drawer>
      ) : null}
    </div>
  );
}
