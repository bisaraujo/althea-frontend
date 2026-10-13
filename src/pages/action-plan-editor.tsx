import { ClipboardList, Pencil, Plus, Send, X } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import {
  ACTION_STATUS_LABEL, ACTION_TYPE_LABEL, type ActionItemType, type ActionStatus, createPlanItem, getPlan, type Plan, type PlanItem,
  type PlanItemPayload, RECURRENCE_LABEL, type RecurrenceType, submitPlan, updatePlanItem,
} from '../api/action-plan';
import { type Benefit, listBenefits } from '../api/benefits';
import { ApiError } from '../api/client';
import { EmptyState } from '../components/empty-state';
import { SectionPanel } from '../components/section-panel';
import { StatusPill } from '../components/status-pill';
import { useToast } from '../components/toast';
import { Drawer, ErrorState, LoadingState } from '../components/ui';
import './benefits-agenda.css';

const emptyDraft: PlanItemPayload = { title: '', description: null, owner_name: null, item_type: 'acao', recurrence_type: 'once', start_date: null, custom_dates: [], benefit_id: null };

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
      {draft.recurrence_type === 'custom_dates' ? (
        <div className="agd-dates">
          {(draft.custom_dates ?? []).length ? (draft.custom_dates ?? []).map((value) => (
            <span key={value} className="agd-date-tag">{shortDate(value)}<button type="button" aria-label={`Remover ${shortDate(value)}`} onClick={() => set('custom_dates', (draft.custom_dates ?? []).filter((item) => item !== value))}><X size={12} /></button></span>
          )) : <span className="ben-hint">Nenhuma data escolhida.</span>}
        </div>
      ) : null}
      {draft.recurrence_type !== 'once' && draft.recurrence_type !== 'custom_dates' ? <p className="ben-hint">As datas são geradas para os próximos 12 meses e aparecem na agenda da empresa.</p> : null}
      <label><span>Descrição <em className="ben-optional">(opcional)</em></span><textarea rows={2} value={draft.description ?? ''} onChange={(event) => set('description', event.target.value || null)} maxLength={2000} /></label>
    </>
  );
}

/** Plano de acao do projeto (admin de Jornadas): acoes com tipo, recorrencia e datas. */
export function ActionPlanEditor({ token, projectId, companyId }: { token: string; projectId: string; companyId: string | null }) {
  const toast = useToast();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [failed, setFailed] = useState(false);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [draft, setDraft] = useState<PlanItemPayload>(emptyDraft);
  const [editing, setEditing] = useState<{ item: PlanItem; draft: PlanItemPayload } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => { setFailed(false); getPlan(token, projectId).then(setPlan).catch(() => setFailed(true)); }, [token, projectId]);
  useEffect(load, [load]);
  useEffect(() => { if (companyId) listBenefits(token, companyId).then(setBenefits).catch(() => setBenefits([])); }, [token, companyId]);

  async function run(action: () => Promise<unknown>, message: string) {
    if (saving) return false;
    setSaving(true);
    try { await action(); toast.success(message); load(); return true; }
    catch (reason) { toast.error(errorText(reason, 'Não foi possível salvar.')); return false; }
    finally { setSaving(false); }
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    if (await run(() => createPlanItem(token, projectId, { ...draft, title: draft.title.trim() }), 'Ação criada e datas adicionadas à agenda.')) setDraft(emptyDraft);
  }
  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (await run(() => updatePlanItem(token, editing.item.id, { ...editing.draft, title: editing.draft.title.trim() }), 'Ação atualizada. As datas futuras foram reprogramadas.')) setEditing(null);
  }
  function startEdit(item: PlanItem) {
    setEditing({ item, draft: { title: item.title, description: item.description, owner_name: item.owner_name, item_type: item.item_type, recurrence_type: item.recurrence_type, start_date: item.start_date, custom_dates: item.custom_dates, benefit_id: item.benefit_id } });
  }

  if (failed) return <ErrorState message="Não foi possível carregar o plano de ação." onRetry={load} />;
  if (!plan) return <LoadingState />;

  return (
    <div className="content-grid">
      <SectionPanel title="Nova ação" eyebrow="Programação">
        <form className="admin-form" onSubmit={(event) => void add(event)}>
          <fieldset disabled={saving} className="ben-fieldset"><ItemForm draft={draft} onChange={setDraft} benefits={benefits} /></fieldset>
          <button className="primary-button" disabled={saving || !draft.title.trim()}><Plus size={16} />Adicionar ação</button>
        </form>
      </SectionPanel>
      <SectionPanel title="Plano de ação" eyebrow={plan.status === 'submitted' ? 'Enviado' : 'Rascunho'}>
        {plan.items.length ? (
          <div className="agd-plan-list">
            {plan.items.map((item) => (
              <article key={item.id} className={`agd-plan-item${item.status === 'cancelled' ? ' is-cancelled' : ''}`}>
                <span className={`agd-dot agd-dot--${item.item_type}`} aria-hidden />
                <div className="agd-plan-item__copy">
                  <strong>{item.title}</strong>
                  <span>{ACTION_TYPE_LABEL[item.item_type]} · {RECURRENCE_LABEL[item.recurrence_type]}{item.owner_name ? ` · ${item.owner_name}` : ''}{item.benefit_name ? ` · ${item.benefit_name}` : ''}</span>
                  <span className="ben-hint">{item.occurrence_count ? `${item.occurrences_done} de ${item.occurrence_count} feita(s) · próxima: ${shortDate(item.next_occurrence)}` : 'Sem datas na agenda'}</span>
                </div>
                <div className="agd-plan-item__side">
                  <select className="action-status-select" aria-label={`Situação de ${item.title}`} value={item.status} disabled={saving} onChange={(event) => void run(() => updatePlanItem(token, item.id, { status: event.target.value as ActionStatus }), 'Situação atualizada.')}>
                    {(Object.keys(ACTION_STATUS_LABEL) as ActionStatus[]).map((key) => <option key={key} value={key}>{ACTION_STATUS_LABEL[key]}</option>)}
                  </select>
                  <button type="button" className="org-icon-btn" aria-label={`Editar ${item.title}`} title="Editar" onClick={() => startEdit(item)}><Pencil size={14} /></button>
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState icon={ClipboardList} title="Plano vazio" description="Adicione a primeira ação. Ações com data ou recorrência aparecem na agenda da empresa." />}
        {plan.items.length && plan.status !== 'submitted' ? (
          <button type="button" className="primary-button" style={{ marginTop: '0.8rem' }} disabled={saving} onClick={() => void run(() => submitPlan(token, projectId), 'Plano enviado.')}><Send size={16} />Enviar plano</button>
        ) : plan.status === 'submitted' ? <p className="ben-hint" style={{ marginTop: '0.6rem' }}><StatusPill tone="success">Enviado</StatusPill></p> : null}
      </SectionPanel>
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
