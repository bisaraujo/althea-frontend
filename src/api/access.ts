import { request } from './client';
import type { CompanyCustomCapability, CompanyCustomCapabilityStatus, OrganizationalAccessProfile } from './types';

const json = { 'Content-Type': 'application/json' };

export type ProfileWritePayload = { name?: string; description?: string | null; permissions?: string[]; active?: boolean };

export function createCompanyProfile(token: string, companyId: string, payload: ProfileWritePayload & { name: string }) {
  return request<OrganizationalAccessProfile>(`/companies/${companyId}/access-profiles`, { token, method: 'POST', body: JSON.stringify(payload), headers: json });
}
export function updateCompanyProfile(token: string, profileId: string, payload: ProfileWritePayload) {
  return request<OrganizationalAccessProfile>(`/access-profiles/${profileId}`, { token, method: 'PATCH', body: JSON.stringify(payload), headers: json });
}
export function createPackage(token: string, payload: ProfileWritePayload & { name: string }) {
  return request<OrganizationalAccessProfile>('/access-profiles/global', { token, method: 'POST', body: JSON.stringify(payload), headers: json });
}
export function updatePackage(token: string, packageId: string, payload: ProfileWritePayload) {
  return request<OrganizationalAccessProfile>(`/access-profiles/global/${packageId}`, { token, method: 'PATCH', body: JSON.stringify(payload), headers: json });
}

export type RequestFilters = {
  companyId?: string;
  status?: CompanyCustomCapabilityStatus | '';
  kind?: string;
  dateFrom?: string;
  dateTo?: string;
};

/** Central de solicitações: todas as empresas (somente Administrador Geral). */
export function listCapabilityRequests(token: string, filters: RequestFilters = {}) {
  const params = new URLSearchParams();
  if (filters.companyId) params.set('company_id', filters.companyId);
  if (filters.status) params.set('status', filters.status);
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);
  const query = params.toString();
  return request<CompanyCustomCapability[]>(`/custom-capabilities${query ? `?${query}` : ''}`, { token });
}

export function decideCapabilityRequest(token: string, id: string, decision: 'approve' | 'reject', note?: string) {
  return request<CompanyCustomCapability>(`/custom-capabilities/${id}/${decision}`, {
    token, method: 'POST', body: JSON.stringify({ note: note?.trim() || null }), headers: json,
  });
}
