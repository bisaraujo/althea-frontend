import { request } from './client';
import type {
  ClientUserCreatePayload,
  Company,
  CompanyCreatePayload,
  DocumentSubmissionPayload,
  EmployeeImportResult,
  EmployeeRecord,
  FormSummary,
  Journey,
  JourneyApproval,
  JourneyApprovalPayload,
  LoginResponse,
  ManagerDeliveries,
  Meeting,
  MeetingCreatePayload,
  Presentation,
  Project,
  ProjectCreatePayload,
  ProjectSchedule,
  ResponseRecord,
  FormDetail,
  FormDraft,
  FormResponseOut,
  JourneyProgress,
  UserRecord
} from './types';

export async function login(username: string, password: string) {
  const body = new URLSearchParams({
    username,
    password,
  });

  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
}

export async function getMyCompany(token: string) {
  return request<Company>('/companies/me', { token });
}

export async function getCompanies(token: string) {
  return request<Company[]>('/companies', { token });
}

export async function createCompany(token: string, payload: CompanyCreatePayload) {
  return request<Company>('/companies', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function getProjects(token: string) {
  const projects = await request<Project[]>('/projects', { token });
  return { projects };
}

export async function createProject(token: string, payload: ProjectCreatePayload) {
  return request<Project>('/projects', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function getUsers(token: string) {
  return request<UserRecord[]>('/users', { token });
}

export async function createUser(token: string, payload: ClientUserCreatePayload) {
  return request<UserRecord>('/users', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function getForms(token: string) {
  const forms = await request<FormSummary[]>('/forms', { token });
  return { forms };
}

export async function getPresentations(token: string) {
  const presentations = await request<Presentation[]>('/presentations', { token });
  return { presentations };
}

export async function getResponses(token: string) {
  return request<{ responses: ResponseRecord[] }>('/responses', { token });
}

export async function getManagerJourney(token: string) {
  return request<Journey>('/manager/journey', { token });
}

export async function getManagerCompanyJourney(token: string) {
  return request<Journey>('/manager/company-journey', { token });
}

export async function getEmployeeJourney(token: string) {
  return request<Journey>('/employee/journey', { token });
}

export async function completeEmployeeJourneyItem(token: string, itemId: string) {
  return request<JourneyProgress>(`/employee/journey/items/${itemId}/complete`, {
    token,
    method: 'POST',
  });
}

export async function completeManagerJourneyItem(token: string, itemId: string) {
  return request<JourneyProgress>(`/manager/journey/items/${itemId}/complete`, {
    token,
    method: 'POST',
  });
}

export async function completeManagerCompanyJourneyItem(token: string, itemId: string) {
  return request<JourneyProgress>(`/manager/company-journey/items/${itemId}/complete`, {
    token,
    method: 'POST',
  });
}

export async function approveManagerCompanyJourneyItem(
  token: string,
  itemId: string,
  payload: JourneyApprovalPayload,
) {
  return request<JourneyApproval>(`/manager/company-journey/items/${itemId}/approval`, {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function getManagerEmployees(token: string) {
  return request<{ employees: EmployeeRecord[] }>('/manager/employees', { token });
}

export async function importProjectEmployees(token: string, projectId: string, payload: FormData) {
  return request<EmployeeImportResult>(`/projects/${projectId}/employees/import`, {
    token,
    method: 'POST',
    body: payload,
  });
}

export async function listMeetings(token: string, projectId?: string) {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  return request<{ meetings: Meeting[] }>(`/meetings${query}`, { token });
}

export async function createMeeting(token: string, payload: MeetingCreatePayload) {
  return request<Meeting>('/meetings', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function uploadMeetingAta(token: string, meetingId: string, payload: FormData) {
  return request<Meeting>(`/meetings/${meetingId}/ata`, {
    token,
    method: 'POST',
    body: payload,
  });
}

export async function approveMeeting(token: string, meetingId: string) {
  return request<Meeting>(`/meetings/${meetingId}/approve`, {
    token,
    method: 'POST',
  });
}

export async function deleteMeeting(token: string, meetingId: string) {
  return request<{ status: string; id: string }>(`/meetings/${meetingId}`, {
    token,
    method: 'DELETE',
  });
}

export async function getManagerForms(token: string) {
  return request<{ forms: FormSummary[] }>('/manager/forms', { token });
}

export async function getEmployeeForms(token: string) {
  return request<{ forms: FormSummary[] }>('/employee/forms', { token });
}

export async function getManagerPresentations(token: string) {
  return request<{ presentations: Presentation[] }>('/manager/presentations', { token });
}

export async function getEmployeePresentations(token: string) {
  return request<{ presentations: Presentation[] }>('/employee/presentations', { token });
}

export async function getManagerResponses(token: string) {
  return request<{ responses: ResponseRecord[] }>('/manager/responses', { token });
}

export async function uploadManagerDocument(
  token: string,
  itemId: string,
  payload: DocumentSubmissionPayload,
) {
  return request(`/manager/company-journey/items/${itemId}/upload-document`, {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function uploadManagerDocumentFile(
  token: string,
  itemId: string,
  payload: FormData,
) {
  return request(`/manager/company-journey/items/${itemId}/upload-file`, {
    token,
    method: 'POST',
    body: payload,
  });
}

export async function getProjectManagerDeliveries(token: string, projectId: string) {
  return request<ManagerDeliveries>(`/projects/${projectId}/manager-deliveries`, { token });
}

export async function getProjectSchedule(token: string, projectId: string) {
  return request<ProjectSchedule>(`/projects/${projectId}/schedule`, { token });
}

export async function getEmployeeFormDetail(token: string, formId: string) {
  return request<FormDetail>(`/employee/forms/${formId}/detail`, { token });
}

export async function getManagerFormDetail(token: string, formId: string) {
  return request<FormDetail>(`/manager/forms/${formId}/detail`, { token });
}

export async function submitEmployeeForm(
  token: string,
  formId: string,
  answers: Record<string, string | string[]>,
) {
  return request<FormResponseOut>(`/employee/forms/${formId}/submit`, {
    token,
    method: 'POST',
    body: JSON.stringify({ answers }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function getEmployeeFormDraft(token: string, formId: string) {
  return request<FormDraft | null>(`/employee/forms/${formId}/draft`, { token });
}

export async function saveEmployeeFormDraft(
  token: string,
  formId: string,
  answers: Record<string, string | string[]>,
  currentQuestionKey: string | null,
) {
  return request<FormDraft>(`/employee/forms/${formId}/draft`, {
    token,
    method: 'PUT',
    body: JSON.stringify({ answers, current_question_key: currentQuestionKey }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function clearEmployeeFormDraft(token: string, formId: string) {
  return request<void>(`/employee/forms/${formId}/draft`, {
    token,
    method: 'DELETE',
  });
}

export async function submitManagerForm(
  token: string,
  formId: string,
  answers: Record<string, string | string[]>,
) {
  return request<FormResponseOut>(`/manager/forms/${formId}/submit`, {
    token,
    method: 'POST',
    body: JSON.stringify({ answers }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function getManagerFormDraft(token: string, formId: string) {
  return request<FormDraft | null>(`/manager/forms/${formId}/draft`, { token });
}

export async function saveManagerFormDraft(
  token: string,
  formId: string,
  answers: Record<string, string | string[]>,
  currentQuestionKey: string | null,
) {
  return request<FormDraft>(`/manager/forms/${formId}/draft`, {
    token,
    method: 'PUT',
    body: JSON.stringify({ answers, current_question_key: currentQuestionKey }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function clearManagerFormDraft(token: string, formId: string) {
  return request<void>(`/manager/forms/${formId}/draft`, {
    token,
    method: 'DELETE',
  });
}
