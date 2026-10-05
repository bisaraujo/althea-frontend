import { request } from './client';
import type { CompanyPortfolio } from './types';

export async function getCompanyPortfolioEntry(token: string, companyId: string) {
  return request<CompanyPortfolio>(`/platform-admin/companies/${companyId}`, { token });
}
