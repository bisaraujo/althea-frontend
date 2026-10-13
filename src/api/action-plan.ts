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
export type Plan = { id: string; project_id: string; status: string; submitted_at: string | null; items: PlanItem[] };
export type PlanItemPayload = {
  title: string; description?: string | null; owner_name?: string | null; item_type: ActionItemType; recurrence_type: RecurrenceType;
  start_date?: string | null; custom_dates?: string[]; benefit_id?: string | null;
};
export type AgendaEntry = {
  id: string; item_id: string; date: string; status: 'scheduled' | 'done'; overdue: boolean; completed_at: string | null; note: string | null;
  title: string; description: string | null; item_type: ActionItemType; recurrence_type: RecurrenceType; owner_name: string | null;
  benefit_name: string | null; project_id: string; project_name: string | null;
};
export type Agenda = { company_id: string; date_from: string; date_to: string; entries: AgendaEntry[] };

export const ACTION_TYPE_LABEL: Record<ActionItemType, string> = { acao: 'Ação', evento: 'Evento', pesquisa: 'Pesquisa', beneficio: 'Benefício' };
export const RECURRENCE_LABEL: Record<RecurrenceType, string> = {
  once: 'Uma vez', weekly: 'Semanal', biweekly: 'Quinzenal', monthly: 'Mensal', bimonthly: 'Bimestral',
  quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual', custom_dates: 'Datas escolhidas',
};
export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = { pending: 'Pendente', in_progress: 'Em andamento', completed: 'Concluída', cancelled: 'Cancelada' };

const json = { 'Content-Type': 'application/json' };

export function getPlan(token: string, projectId: string) {
  return request<Plan>(`/projects/${projectId}/action-plan`, { token });
}
export function createPlanItem(token: string, projectId: string, payload: PlanItemPayload) {
  return request<PlanItem>(`/projects/${projectId}/action-plan/items`, { token, method: 'POST', body: JSON.stringify(payload), headers: json });
}
export function updatePlanItem(token: string, itemId: string, payload: Partial<PlanItemPayload> & { status?: ActionStatus }) {
  return request<PlanItem>(`/action-plan/items/${itemId}`, { token, method: 'PATCH', body: JSON.stringify(payload), headers: json });
}
export function submitPlan(token: string, projectId: string) {
  return request<Plan>(`/projects/${projectId}/action-plan/submit`, { token, method: 'POST' });
}
export function getAgenda(token: string, companyId: string, dateFrom: string, dateTo: string) {
  return request<Agenda>(`/companies/${companyId}/action-plan/agenda?date_from=${dateFrom}&date_to=${dateTo}`, { token });
}
export function updateOccurrence(token: string, occurrenceId: string, payload: { status: 'scheduled' | 'done'; note?: string | null }) {
  return request<{ id: string; status: string }>(`/action-plan/occurrences/${occurrenceId}`, { token, method: 'PATCH', body: JSON.stringify(payload), headers: json });
}
