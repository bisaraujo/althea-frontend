import { request } from './client';

export type ActionItemType = 'acao' | 'evento' | 'pesquisa' | 'beneficio';
export type RecurrenceType = 'once' | 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom_dates';
export type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type PlanItem = {
  id: string; action_plan_id: string; title: string; description: string | null; owner_name: string | null; due_at: string | null;
  frequency: string | null; status: ActionStatus; item_type: ActionItemType; recurrence_type: RecurrenceType; start_date: string | null;
  custom_dates: string[]; benefit_id: string | null; benefit_name: string | null; occurrence_count: number; occurrences_done: number;
  next_occurrence: string | null; created_at: string; updated_at: string;
};
/** Plano de acao da empresa (um por empresa, existe com ou sem produto). */
export type Plan = { id: string; company_id: string; status: string; items: PlanItem[] };
export type PlanItemPayload = {
  title: string; description?: string | null; owner_name?: string | null; item_type: ActionItemType; recurrence_type: RecurrenceType;
  start_date?: string | null; custom_dates?: string[]; benefit_id?: string | null;
};
/** "plano" = acao do plano de acao; "jornada" = entrega do cronograma das Jornadas (so leitura). */
export type AgendaSource = 'plano' | 'jornada';
export type AgendaItemType = ActionItemType | 'jornada';
export type AgendaEntry = {
  id: string; source: AgendaSource; item_id: string; date: string; status: 'scheduled' | 'done'; overdue: boolean; completed_at: string | null;
  note: string | null; title: string; description: string | null; item_type: AgendaItemType; recurrence_type: RecurrenceType;
  owner_name: string | null; benefit_name: string | null;
  project_id: string | null; project_name: string | null; section_title: string | null; role_target: 'manager' | 'employee' | null;
  journey_item_type: string | null; delivery_status: string | null;
};
export type Agenda = { company_id: string; date_from: string; date_to: string; entries: AgendaEntry[] };

export const ACTION_TYPE_LABEL: Record<ActionItemType, string> = { acao: 'Ação', evento: 'Evento', pesquisa: 'Pesquisa', beneficio: 'Benefício' };
export const AGENDA_TYPE_LABEL: Record<AgendaItemType, string> = { ...ACTION_TYPE_LABEL, jornada: 'Entrega da jornada' };
export const AGENDA_SOURCE_LABEL: Record<AgendaSource, string> = { plano: 'Plano de ação', jornada: 'Entregas da jornada' };
export const DELIVERY_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', overdue: 'Atrasada', submitted: 'Entregue', submitted_late: 'Entregue com atraso',
  approved: 'Aprovada', rejected: 'Recusada', changes_requested: 'Ajustes pedidos',
};
export const RECURRENCE_LABEL: Record<RecurrenceType, string> = {
  once: 'Uma vez', weekly: 'Semanal', biweekly: 'Quinzenal', monthly: 'Mensal', bimonthly: 'Bimestral',
  quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual', custom_dates: 'Datas escolhidas',
};
export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = { pending: 'Pendente', in_progress: 'Em andamento', completed: 'Concluída', cancelled: 'Cancelada' };

const json = { 'Content-Type': 'application/json' };

export function getPlan(token: string, companyId: string) {
  return request<Plan>(`/companies/${companyId}/action-plan`, { token });
}
export function createPlanItem(token: string, companyId: string, payload: PlanItemPayload) {
  return request<PlanItem>(`/companies/${companyId}/action-plan/items`, { token, method: 'POST', body: JSON.stringify(payload), headers: json });
}
export function updatePlanItem(token: string, itemId: string, payload: Partial<PlanItemPayload> & { status?: ActionStatus }) {
  return request<PlanItem>(`/action-plan/items/${itemId}`, { token, method: 'PATCH', body: JSON.stringify(payload), headers: json });
}
export function getAgenda(token: string, companyId: string, dateFrom: string, dateTo: string) {
  return request<Agenda>(`/companies/${companyId}/action-plan/agenda?date_from=${dateFrom}&date_to=${dateTo}`, { token });
}
export function updateOccurrence(token: string, occurrenceId: string, payload: { status: 'scheduled' | 'done'; note?: string | null }) {
  return request<{ id: string; status: string }>(`/action-plan/occurrences/${occurrenceId}`, { token, method: 'PATCH', body: JSON.stringify(payload), headers: json });
}
