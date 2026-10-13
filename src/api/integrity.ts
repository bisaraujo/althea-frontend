import { request } from './client';
import { downloadAuthenticated } from './files';

export type IntegrityQuestionType = 'short_text' | 'long_text' | 'select' | 'radio' | 'checkbox';
export type IntegrityQuestion = { key: string; label: string; type: IntegrityQuestionType; required: boolean; options?: string[] | null };
export type IntegrityQuestionInput = { key?: string | null; label: string; type: IntegrityQuestionType; required: boolean; options?: string[] | null };
export type IntegrityForm = { company_id: string; company_name?: string | null; questions: IntegrityQuestion[] };
export type IntegrityStatus = 'recebido' | 'em_analise' | 'concluido';
export type IntegrityResolution = 'procedente' | 'improcedente' | 'inconclusivo';
export type IntegrityEvent = { id: string; event_type: 'status_change' | 'note' | 'anonymized' | string; from_status: string | null; to_status: string | null; note: string | null; created_at: string };
export type IntegrityCase = {
  id: string; company_id: string; protocol: string; status: IntegrityStatus; category: string; description: string;
  incident_date: string | null; attachment_file_name: string | null; attachment_file_url: string | null;
  identified: boolean; reporter_name: string | null; reporter_email: string | null; custom_answers: Record<string, unknown>;
  resolution: IntegrityResolution | null; concluded_at: string | null; anonymized_at: string | null; created_at: string; updated_at: string;
};
export type IntegrityCaseDetail = IntegrityCase & { events: IntegrityEvent[] };
export type IntegritySubmitResult = { protocol: string; access_key: string; status: IntegrityStatus };
export type IntegrityTrackResult = { protocol: string; status: IntegrityStatus; category: string; created_at: string; updated_at: string; events: IntegrityEvent[] };

export const INTEGRITY_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'assedio_moral', label: 'Assédio moral' },
  { value: 'assedio_sexual', label: 'Assédio sexual' },
  { value: 'discriminacao', label: 'Discriminação' },
  { value: 'corrupcao', label: 'Fraude ou corrupção' },
  { value: 'conflito_interesses', label: 'Conflito de interesses' },
  { value: 'seguranca_trabalho', label: 'Saúde e segurança no trabalho' },
  { value: 'violacao_politicas', label: 'Descumprimento de políticas internas' },
  { value: 'outro', label: 'Outro assunto' },
];

export const INTEGRITY_STATUS_LABEL: Record<IntegrityStatus, string> = { recebido: 'Recebida', em_analise: 'Em análise', concluido: 'Concluída' };
export const INTEGRITY_RESOLUTION_LABEL: Record<IntegrityResolution, string> = { procedente: 'Procedente', improcedente: 'Improcedente', inconclusivo: 'Inconclusiva' };
export const INTEGRITY_QUESTION_TYPE_LABEL: Record<IntegrityQuestionType, string> = {
  short_text: 'Resposta curta', long_text: 'Resposta longa', select: 'Lista de opções', radio: 'Escolha única', checkbox: 'Múltipla escolha',
};
export const CHOICE_TYPES: IntegrityQuestionType[] = ['select', 'radio', 'checkbox'];
export const INTEGRITY_ATTACHMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.csv';
export const INTEGRITY_ATTACHMENT_MAX_MB = 15;

export function categoryLabel(value: string) {
  return INTEGRITY_CATEGORIES.find((item) => item.value === value)?.label ?? value;
}

export function publicReportUrl(companyId: string) {
  return `${window.location.origin}/denuncia/${companyId}`;
}

export function publicTrackUrl() {
  return `${window.location.origin}/denuncia/acompanhar`;
}

// --- Publico (sem login) ---
export function getPublicIntegrityForm(companyId: string) {
  return request<IntegrityForm>(`/public/integrity/${companyId}/form`);
}

export function submitIntegrityReport(companyId: string, payload: {
  description: string; category: string; incident_date?: string | null; identified: boolean;
  reporter_name?: string | null; reporter_email?: string | null; custom_answers: Record<string, unknown>; file?: File | null;
}) {
  const body = new FormData();
  body.set('description', payload.description);
  body.set('category', payload.category);
  if (payload.incident_date) body.set('incident_date', payload.incident_date);
  body.set('identified', payload.identified ? 'true' : 'false');
  if (payload.identified && payload.reporter_name) body.set('reporter_name', payload.reporter_name);
  if (payload.identified && payload.reporter_email) body.set('reporter_email', payload.reporter_email);
  body.set('custom_answers', JSON.stringify(payload.custom_answers));
  if (payload.file) body.set('file', payload.file);
  return request<IntegritySubmitResult>(`/public/integrity/${companyId}/reports`, { method: 'POST', body });
}

export function trackIntegrityReport(protocol: string, accessKey: string) {
  return request<IntegrityTrackResult>('/public/integrity/reports/track', {
    method: 'POST', body: JSON.stringify({ protocol, access_key: accessKey }), headers: { 'Content-Type': 'application/json' },
  });
}

// --- Comite / empresa (com login) ---
export function getIntegrityQuestions(token: string, companyId: string) {
  return request<IntegrityForm>(`/companies/${companyId}/integrity/questions`, { token });
}

export function saveIntegrityQuestions(token: string, companyId: string, questions: IntegrityQuestionInput[]) {
  return request<IntegrityForm>(`/companies/${companyId}/integrity/questions`, {
    token, method: 'PUT', body: JSON.stringify({ questions }), headers: { 'Content-Type': 'application/json' },
  });
}

export function listIntegrityCases(token: string, companyId: string) {
  return request<IntegrityCase[]>(`/companies/${companyId}/integrity/cases`, { token });
}

export function getIntegrityCase(token: string, companyId: string, caseId: string) {
  return request<IntegrityCaseDetail>(`/companies/${companyId}/integrity/cases/${caseId}`, { token });
}

export function updateIntegrityStatus(token: string, companyId: string, caseId: string, payload: { status: IntegrityStatus; note?: string | null; resolution?: IntegrityResolution | null }) {
  return request<IntegrityCase>(`/companies/${companyId}/integrity/cases/${caseId}/status`, {
    token, method: 'PATCH', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' },
  });
}

export function addIntegrityNote(token: string, companyId: string, caseId: string, note: string) {
  return request<IntegrityCaseDetail>(`/companies/${companyId}/integrity/cases/${caseId}/notes`, {
    token, method: 'POST', body: JSON.stringify({ note }), headers: { 'Content-Type': 'application/json' },
  });
}

export function downloadIntegrityAttachment(token: string, companyId: string, item: IntegrityCase) {
  return downloadAuthenticated(token, `/companies/${companyId}/integrity/cases/${item.id}/attachment`, item.attachment_file_name || 'anexo');
}
