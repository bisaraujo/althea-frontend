import { request } from './client';

/** Tipos de pergunta do construtor. "text" e "multi_select" sao de pesquisas antigas. */
export type QuestionType =
  | 'section' | 'short_text' | 'long_text' | 'number' | 'date'
  | 'single_choice' | 'multiple_choice' | 'yes_no' | 'scale' | 'nps'
  | 'text' | 'multi_select';
export type SurveyAudience = 'all' | 'manager' | 'employee';
export type SurveyStatus = 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'published' | 'archived';
export type ScaleSettings = { min?: number; max?: number; min_label?: string; max_label?: string };
export type QuestionSettings = ScaleSettings & Record<string, unknown>;

export type SurveyQuestion = {
  id: string; survey_id: string; question_key: string; title: string; description: string | null;
  question_type: QuestionType; order: number; required: boolean; options: string[]; settings: QuestionSettings;
};
export type Survey = {
  id: string; company_id: string | null; company_name: string | null; title: string; description: string | null;
  status: SurveyStatus; version: number; audience: SurveyAudience; created_at: string; updated_at: string;
  response_count: number; answered?: boolean | null; questions: SurveyQuestion[];
  closes_at: string | null; participation_target: number; invitations_sent_at: string | null; reminder_sent_at: string | null;
};
export type ReminderStatus = { pending: number; email_configured: boolean; invitations_sent_at: string | null; reminder_sent_at: string | null; closes_at: string | null };
export type QuestionPayload = {
  title: string; description?: string | null; question_type: QuestionType; required?: boolean; options?: string[]; settings?: QuestionSettings;
};
export type QuestionResult = {
  question_id: string; question_key: string; title: string; question_type: QuestionType; response_count: number;
  option_counts: Record<string, number>; options: string[]; settings: QuestionSettings; average: number | null;
  distribution: Record<string, number>; nps: { score: number; promoters: number; passives: number; detractors: number } | null; text_answers: string[];
};
export type SurveyResults = { survey_id: string; total_responses: number; questions: QuestionResult[]; suppressed?: boolean; min_responses?: number };
export type Answers = Record<string, string | number | string[]>;

/** Rotulos e descricao curta de cada tipo, na ordem em que aparecem no seletor. */
export const QUESTION_TYPE_INFO: { type: QuestionType; label: string; hint: string }[] = [
  { type: 'single_choice', label: 'Escolha única', hint: 'Uma opção entre várias' },
  { type: 'multiple_choice', label: 'Múltipla escolha', hint: 'Marca quantas quiser' },
  { type: 'scale', label: 'Escala', hint: 'De 1 a 5 (ou outro intervalo)' },
  { type: 'nps', label: 'NPS', hint: 'De 0 a 10, recomendaria?' },
  { type: 'yes_no', label: 'Sim ou não', hint: 'Resposta direta' },
  { type: 'short_text', label: 'Texto curto', hint: 'Uma linha' },
  { type: 'long_text', label: 'Texto longo', hint: 'Comentário aberto' },
  { type: 'number', label: 'Número', hint: 'Valor numérico' },
  { type: 'date', label: 'Data', hint: 'Dia, mês e ano' },
  { type: 'section', label: 'Título de seção', hint: 'Separa a pesquisa em partes' },
];
export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  ...Object.fromEntries(QUESTION_TYPE_INFO.map((item) => [item.type, item.label])) as Record<QuestionType, string>,
  text: 'Texto curto', multi_select: 'Múltipla escolha',
};
export const AUDIENCE_LABEL: Record<SurveyAudience, string> = { all: 'Gestores e colaboradores', manager: 'Só gestores', employee: 'Só colaboradores' };
export const YES_NO_OPTIONS = [{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }];

export function canonicalType(type: QuestionType): QuestionType {
  return type === 'text' ? 'short_text' : type === 'multi_select' ? 'multiple_choice' : type;
}
export function isChoiceType(type: QuestionType) {
  const kind = canonicalType(type);
  return kind === 'single_choice' || kind === 'multiple_choice';
}
export function scaleRange(question: Pick<SurveyQuestion, 'question_type' | 'settings'>): [number, number] {
  if (canonicalType(question.question_type) === 'nps') return [0, 10];
  return [Number(question.settings.min ?? 1), Number(question.settings.max ?? 5)];
}
/** Valores iniciais ao trocar para um tipo (opcoes de exemplo, escala 1-5). */
export function defaultsFor(type: QuestionType): Pick<QuestionPayload, 'options' | 'settings'> {
  if (type === 'single_choice' || type === 'multiple_choice') return { options: ['Opção 1', 'Opção 2'], settings: {} };
  if (type === 'scale') return { options: [], settings: { min: 1, max: 5, min_label: 'Discordo totalmente', max_label: 'Concordo totalmente' } };
  return { options: [], settings: {} };
}

const json = { 'Content-Type': 'application/json' };

export type TargetCompany = { id: string; name: string };
/** Empresas para as quais quem monta pode publicar (Admin Geral: todas; admin de Jornadas: as que tem Jornadas). */
export function listTargetCompanies(token: string) {
  return request<TargetCompany[]>('/operational-surveys/target-companies', { token });
}
export function listSurveys(token: string) {
  return request<Survey[]>('/operational-surveys', { token });
}
export function getSurvey(token: string, surveyId: string) {
  return request<Survey>(`/operational-surveys/${surveyId}`, { token });
}
export function createSurvey(token: string, payload: { title: string; description?: string | null; company_id?: string | null; audience?: SurveyAudience; closes_at?: string | null; participation_target?: number }) {
  return request<Survey>('/operational-surveys', { token, method: 'POST', body: JSON.stringify(payload), headers: json });
}
export function updateSurvey(token: string, surveyId: string, payload: Partial<{ title: string; description: string | null; company_id: string | null; audience: SurveyAudience; closes_at: string | null; participation_target: number }>) {
  return request<Survey>(`/operational-surveys/${surveyId}`, { token, method: 'PATCH', body: JSON.stringify(payload), headers: json });
}
export function transitionSurvey(token: string, surveyId: string, action: 'submit' | 'approve' | 'request-changes' | 'publish' | 'archive') {
  return request<Survey>(`/operational-surveys/${surveyId}/transition/${action}`, { token, method: 'POST' });
}
export function newSurveyVersion(token: string, surveyId: string) {
  return request<Survey>(`/operational-surveys/${surveyId}/versions`, { token, method: 'POST' });
}
/** Novo rascunho com as mesmas perguntas (usar um modelo com uma empresa ou duplicar). */
export function copySurvey(token: string, surveyId: string, payload: { company_id?: string | null; title?: string | null }) {
  return request<Survey>(`/operational-surveys/${surveyId}/copy`, { token, method: 'POST', body: JSON.stringify(payload), headers: json });
}
/** Envia a mesma pesquisa para varias empresas: cria uma pesquisa por empresa (publicada ou rascunho). */
export function sendSurveyToCompanies(token: string, surveyId: string, payload: { company_ids: string[]; title?: string | null; publish: boolean }) {
  return request<{ created: Survey[] }>(`/operational-surveys/${surveyId}/send`, { token, method: 'POST', body: JSON.stringify(payload), headers: json });
}
export function getReminderStatus(token: string, surveyId: string) {
  return request<ReminderStatus>(`/operational-surveys/${surveyId}/reminder`, { token });
}
export function sendReminder(token: string, surveyId: string) {
  return request<{ sent: number; pending: number }>(`/operational-surveys/${surveyId}/reminder`, { token, method: 'POST' });
}
export function addQuestion(token: string, surveyId: string, payload: QuestionPayload) {
  return request<SurveyQuestion>(`/operational-surveys/${surveyId}/questions`, { token, method: 'POST', body: JSON.stringify(payload), headers: json });
}
export function updateQuestion(token: string, surveyId: string, questionId: string, payload: Partial<QuestionPayload>) {
  return request<SurveyQuestion>(`/operational-surveys/${surveyId}/questions/${questionId}`, { token, method: 'PATCH', body: JSON.stringify(payload), headers: json });
}
export function deleteQuestion(token: string, surveyId: string, questionId: string) {
  return request<string>(`/operational-surveys/${surveyId}/questions/${questionId}`, { token, method: 'DELETE' });
}
export function reorderQuestions(token: string, surveyId: string, questionIds: string[]) {
  return request<Survey>(`/operational-surveys/${surveyId}/questions/order`, { token, method: 'PUT', body: JSON.stringify({ question_ids: questionIds }), headers: json });
}
export function getSurveyResults(token: string, surveyId: string) {
  return request<SurveyResults>(`/operational-surveys/${surveyId}/results`, { token });
}
export function listAvailableSurveys(token: string) {
  return request<Survey[]>('/operational-surveys/available', { token });
}
export function submitSurveyResponse(token: string, surveyId: string, answers: Answers) {
  return request<{ id: string }>(`/operational-surveys/${surveyId}/responses`, { token, method: 'POST', body: JSON.stringify({ answers }), headers: json });
}

// ---- Dashboard ----------------------------------------------------------------

export type InsightTone = 'good' | 'warning' | 'neutral';
export type SurveyInsight = { tone: InsightTone; title: string; text: string };
export type NpsSummary = { score: number; promoters: number; passives: number; detractors: number; total: number };
export type ScaleMetric = {
  question_id: string; title: string; favorability: number; average: number; min: number; max: number; responses: number;
  min_label?: string | null; max_label?: string | null;
};
export type SegmentGroup = { role: 'manager' | 'employee'; label: string; responses: number; favorability: number | null; nps: number | null; scales: { question_id: string; favorability: number }[] };
export type CompanyComparison = {
  survey_id: string; company_id: string; company_name: string | null; is_current: boolean; responses: number;
  participation: number | null; suppressed: boolean; favorability: number | null; nps: number | null;
};
export type SurveyDashboard = {
  survey_id: string; responses: number; eligible: number; participation: number | null; min_responses: number; suppressed: boolean;
  timeline: { date: string; responses: number; cumulative: number }[];
  favorability: number | null; nps: NpsSummary | null; scales: ScaleMetric[];
  highlights: { question_id: string; title: string; kind: string; option: string; percent: number; responses: number }[];
  segments: { hidden: boolean; groups: SegmentGroup[] } | null; insights: SurveyInsight[]; comparison: CompanyComparison[];
  role: 'manager' | 'employee' | null; role_filter_available: boolean;
  participation_by_role: { role: 'manager' | 'employee'; label: string; eligible: number; participants: number; participation: number | null }[];
  likert: { question_id: string; title: string; responses: number; min: number; max: number; min_label?: string | null; max_label?: string | null; unfavorable: number; neutral: number; favorable: number; points: Record<string, number> }[];
  drivers: { available: boolean; min_responses: number; items: { question_id: string; title: string; favorability: number; impact: number; quadrant: 'priority' | 'strength' | 'monitor' | 'maintain'; responses: number }[] };
  option_impact: { question_id: string; question: string; option: string; with_option: number; without_option: number; difference: number; picked: number }[];
  themes: { total: number; terms: { term: string; key: string; count: number }[] };
  comments: { text: string; count: number }[];
  recommendations: { question_id: string; title: string; favorability: number; reason: string; action?: { id: string; status: string } | null }[];
  participation_target: number; closes_at: string | null;
  trend: { survey_id: string; version: number; label: string; date: string | null; responses: number; suppressed: boolean; favorability: number | null; nps: number | null; is_current: boolean }[];
  heatmap: { columns: { survey_id: string; company_name: string | null; is_current: boolean; responses: number }[]; rows: { key: string; title: string; values: Record<string, number | null> }[] } | null;
};
export type OverviewSurvey = {
  survey_id: string; title: string; version: number; status: SurveyStatus; company_id: string; company_name: string | null;
  responses: number; eligible: number; participation: number | null; suppressed: boolean; favorability: number | null; nps: number | null;
  last_response: string | null; updated_at: string;
};
export type SurveysOverview = {
  company_id: string | null; surveys: OverviewSurvey[];
  totals: { applied: number; open: number; responses: number; participation: number | null; favorability: number | null; nps: number | null };
};

export function getSurveyDashboard(token: string, surveyId: string, role?: 'manager' | 'employee' | null) {
  return request<SurveyDashboard>(`/operational-surveys/${surveyId}/dashboard${role ? `?role=${role}` : ''}`, { token });
}
export function getSurveysOverview(token: string, companyId?: string | null) {
  return request<SurveysOverview>(`/operational-surveys/overview${companyId ? `?company_id=${companyId}` : ''}`, { token });
}
