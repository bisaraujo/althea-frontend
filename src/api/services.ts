import { request } from './client';
import type {
  Company,
  DocumentSubmissionPayload,
  EmployeeRecord,
  FormSummary,
  Journey,
  LoginResponse,
  Presentation,
  Project,
  ResponseRecord,
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

export async function getProjects(token: string) {
  return request<{ projects: Project[] }>('/projects', { token });
}

export async function getForms(token: string) {
  return request<{ forms: FormSummary[] }>('/forms', { token });
}

export async function getPresentations(token: string) {
  return request<{ presentations: Presentation[] }>('/presentations', { token });
}

export async function getResponses(token: string) {
  return request<{ responses: ResponseRecord[] }>('/responses', { token });
}

export async function getManagerJourney(token: string) {
  return request<Journey>('/manager/journey', { token });
}

export async function getEmployeeJourney(token: string) {
  return request<Journey>('/employee/journey', { token });
}

export async function getManagerEmployees(token: string) {
  return request<{ employees: EmployeeRecord[] }>('/manager/employees', { token });
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
  return request(`/manager/journey/items/${itemId}/upload-document`, {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
