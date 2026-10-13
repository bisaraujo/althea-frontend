import { request } from './client';

export type BenefitScope = 'all' | 'units' | 'areas' | 'positions';
export type Benefit = {
  id: string; company_id: string; name: string; benefit_type: string; provider: string | null; description: string | null;
  how_to_use: string | null; site_url: string | null; monthly_cost_per_person: number | null; eligibility_scope: BenefitScope;
  eligibility_ids: string[]; is_psychosocial: boolean; active: boolean; eligible_count: number | null; monthly_estimate: number | null;
  created_at: string; updated_at: string;
};
export type BenefitPayload = {
  name: string; benefit_type: string; provider: string | null; description: string | null; how_to_use: string | null; site_url: string | null;
  monthly_cost_per_person: number | null; eligibility_scope: BenefitScope; eligibility_ids: string[]; is_psychosocial: boolean; active: boolean;
};

export const BENEFIT_TYPE_LABEL: Record<string, string> = {
  saude: 'Saúde', odontologico: 'Odontológico', alimentacao: 'Alimentação (VR/VA)', transporte: 'Transporte',
  educacao: 'Educação', bem_estar: 'Bem-estar', saude_mental: 'Saúde mental', seguro_vida: 'Seguro de vida',
  previdencia: 'Previdência', fitness: 'Atividade física', cultura_lazer: 'Cultura e lazer', home_office: 'Home office',
  premiacao: 'Premiação e reconhecimento', outros: 'Outros',
};
export const BENEFIT_SCOPE_LABEL: Record<BenefitScope, string> = {
  all: 'Toda a empresa', units: 'Unidades escolhidas', areas: 'Áreas escolhidas', positions: 'Cargos escolhidos',
};

export function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function listBenefits(token: string, companyId: string) {
  return request<Benefit[]>(`/companies/${companyId}/benefits`, { token });
}
export function createBenefit(token: string, companyId: string, payload: BenefitPayload) {
  return request<Benefit>(`/companies/${companyId}/benefits`, { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
}
export function updateBenefit(token: string, id: string, payload: Partial<BenefitPayload>) {
  return request<Benefit>(`/benefits/${id}`, { token, method: 'PATCH', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
}
export function deleteBenefit(token: string, id: string) {
  return request<unknown>(`/benefits/${id}`, { token, method: 'DELETE' });
}
export function listMyBenefits(token: string) {
  return request<Benefit[]>('/me/benefits', { token });
}
