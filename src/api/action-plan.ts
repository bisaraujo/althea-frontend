import { request } from './client';
import { downloadAuthenticated, fetchAuthenticatedBlob } from './files';
import { uploadWithProgress } from './organization';

export type ActionItemType = 'acao' | 'evento' | 'pesquisa' | 'beneficio';
export type RecurrenceType = 'once' | 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom_dates';
export type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type Priority = 'alta' | 'media' | 'baixa' | 'oportunidade';
export type ActionKind = 'continua' | 'pontual';
export type EvidenceKind = 'memorial' | 'photo' | 'video' | 'document';

/** Campos da planilha de plano de acao (NR-01) que a Turi preenche no planejamento. */
export type SheetFields = {
  risk_factor: string | null; exposure_group: string | null; objective: string | null; priority: Priority | null; indicator: string | null;
  initial_value: string | null; action_kind: ActionKind | null; monitoring_owner: string | null; resources: string | null;
};
/** O que a empresa preenche ao acompanhar a acao. */
export type ProgressFields = { final_value: string | null; result: string | null; comments: string | null };
export type Evidence = {
  id: string; action_plan_item_id: string; kind: EvidenceKind; text: string | null; file_name: string | null; mime_type: string | null;
  size: number | null; created_by: string | null; created_by_name: string | null; created_at: string;
};

export type PlanItem = {
  id: string; action_plan_id: string; title: string; description: string | null; owner_name: string | null; due_at: string | null;
  frequency: string | null; status: ActionStatus; item_type: ActionItemType; recurrence_type: RecurrenceType; start_date: string | null;
  custom_dates: string[]; benefit_id: string | null; benefit_name: string | null; occurrence_count: number; occurrences_done: number;
  next_occurrence: string | null; created_at: string; updated_at: string;
  progress_updated_at: string | null; progress_updated_by_name: string | null; evidences: Evidence[];
} & SheetFields & ProgressFields;
/** Plano de acao da empresa (um por empresa, existe com ou sem produto). */
export type Plan = { id: string; company_id: string; status: string; items: PlanItem[] };
export type PlanItemPayload = {
  title: string; description?: string | null; owner_name?: string | null; item_type: ActionItemType; recurrence_type: RecurrenceType;
  start_date?: string | null; custom_dates?: string[]; benefit_id?: string | null; due_at?: string | null;
} & Partial<SheetFields>;
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
export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = { pending: 'A iniciar', in_progress: 'Em andamento', completed: 'Concluída', cancelled: 'Cancelada' };
export const PRIORITY_LABEL: Record<Priority, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa', oportunidade: 'Oportunidade de melhoria' };
export const ACTION_KIND_LABEL: Record<ActionKind, string> = { continua: 'Contínua', pontual: 'Pontual' };
export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = { memorial: 'Memorial', photo: 'Foto', video: 'Vídeo', document: 'Documento' };
/** Rotulos dos campos, na ordem e com os nomes da planilha. */
export const SHEET_FIELD_LABEL: Record<keyof SheetFields, string> = {
  risk_factor: 'Perigo / fator de risco psicossocial', exposure_group: 'GES (grupo de exposição similar)', objective: 'Objetivo',
  priority: 'Prioridade', indicator: 'Indicador de monitoramento', initial_value: 'Valor inicial (antes da ação)', action_kind: 'Tipo da ação',
  monitoring_owner: 'Responsável pelo monitoramento', resources: 'Recursos necessários',
};

export type SheetImportRow = Partial<SheetFields & ProgressFields> & {
  line: number; title?: string; owner_name?: string; due_at?: string | null; status?: ActionStatus | null; evidence_text?: string;
  errors: string[]; warnings: string[]; skipped: boolean;
};
export type SheetImport = { dry_run: boolean; columns: string[]; rows: SheetImportRow[]; to_create: number; created: number };

const json = { 'Content-Type': 'application/json' };

export function getPlan(token: string, companyId: string) {
  return request<Plan>(`/companies/${companyId}/action-plan`, { token });
}
export function createPlanItem(token: string, companyId: string, payload: PlanItemPayload) {
  return request<PlanItem>(`/companies/${companyId}/action-plan/items`, { token, method: 'POST', body: JSON.stringify(payload), headers: json });
}
export function updatePlanItem(token: string, itemId: string, payload: Partial<PlanItemPayload> & Partial<ProgressFields> & { status?: ActionStatus }) {
  return request<PlanItem>(`/action-plan/items/${itemId}`, { token, method: 'PATCH', body: JSON.stringify(payload), headers: json });
}
export function getAgenda(token: string, companyId: string, dateFrom: string, dateTo: string) {
  return request<Agenda>(`/companies/${companyId}/action-plan/agenda?date_from=${dateFrom}&date_to=${dateTo}`, { token });
}
export function updateOccurrence(token: string, occurrenceId: string, payload: { status: 'scheduled' | 'done'; note?: string | null }) {
  return request<{ id: string; status: string }>(`/action-plan/occurrences/${occurrenceId}`, { token, method: 'PATCH', body: JSON.stringify(payload), headers: json });
}
export function getPlanItem(token: string, itemId: string) {
  return request<PlanItem>(`/action-plan/items/${itemId}`, { token });
}
export function updateProgress(token: string, itemId: string, payload: Partial<ProgressFields> & { status?: ActionStatus }) {
  return request<PlanItem>(`/action-plan/items/${itemId}/progress`, { token, method: 'PATCH', body: JSON.stringify(payload), headers: json });
}
/** Memorial (texto), arquivo, ou os dois juntos. Videos podem levar mais tempo para subir. */
export function addEvidence(token: string, itemId: string, payload: { text?: string; file?: File | null }, onProgress?: (percent: number) => void) {
  const form = new FormData();
  if (payload.text) form.append('text', payload.text);
  if (payload.file) form.append('file', payload.file);
  return uploadWithProgress<Evidence>(`/action-plan/items/${itemId}/evidences`, token, form, onProgress, 15 * 60 * 1000);
}
export function deleteEvidence(token: string, evidenceId: string) {
  return request<string>(`/action-plan/evidences/${evidenceId}`, { token, method: 'DELETE' });
}
export function evidenceBlob(token: string, evidenceId: string) {
  return fetchAuthenticatedBlob(token, `/action-plan/evidences/${evidenceId}/file`);
}
export function downloadEvidence(token: string, evidence: Evidence) {
  return downloadAuthenticated(token, `/action-plan/evidences/${evidence.id}/file`, evidence.file_name ?? 'evidencia');
}
export function importPlanSheet(token: string, companyId: string, file: File, dryRun: boolean) {
  const form = new FormData();
  form.append('file', file);
  return request<SheetImport>(`/companies/${companyId}/action-plan/import?dry_run=${dryRun}`, { token, method: 'POST', body: form });
}
export function exportPlanSheet(token: string, companyId: string) {
  return downloadAuthenticated(token, `/companies/${companyId}/action-plan/export`, 'plano_de_acao.csv');
}
