import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getCompanyPortfolio } from '../api/services';
import type { CompanyPortfolio } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { platformAdminNavigation } from '../components/admin-navigation';
import { AppShell } from '../components/app-shell';
import { ErrorState, LoadingState } from '../components/ui';
import { BenefitsWorkspace } from './benefits-workspace';
import './integrity.css';

/** Administrador Geral cadastrando e acompanhando os beneficios de cada empresa. */
export function PlatformBenefitsPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [companies, setCompanies] = useState<CompanyPortfolio[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!token) return;
    setError(null);
    getCompanyPortfolio(token).then(setCompanies).catch((reason) => setError(reason instanceof ApiError ? reason.message : 'Não foi possível carregar as empresas.'));
  }
  useEffect(load, [token]);

  const requested = searchParams.get('company') ?? '';
  const companyId = companies?.some((company) => company.id === requested) ? requested : companies?.[0]?.id ?? '';

  return (
    <AppShell eyebrow="Administração geral" title="Benefícios" description="Benefícios oferecidos por cada empresa cliente, com quem tem direito e custo estimado." navigation={platformAdminNavigation}>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!error && !companies ? <LoadingState /> : null}
      {companies?.length ? (
        <>
          <div className="int-company-picker">
            <label>Empresa
              <select value={companyId} onChange={(event) => setSearchParams((current) => { const next = new URLSearchParams(current); next.set('company', event.target.value); return next; }, { replace: true })}>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
            <Link className="secondary-link" to={`/platform-admin/companies/${companyId}`}>Ver página da empresa</Link>
          </div>
          {token && companyId ? <BenefitsWorkspace key={companyId} token={token} companyId={companyId} canManage /> : null}
        </>
      ) : null}
    </AppShell>
  );
}
