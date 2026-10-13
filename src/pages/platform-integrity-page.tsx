import { ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getCompanyPortfolio } from '../api/services';
import type { CompanyPortfolio } from '../api/types';
import { INTEGRITY_PRODUCT_ID } from '../api/workspace-access';
import { useAuth } from '../auth/auth-context';
import { platformAdminNavigation } from '../components/admin-navigation';
import { AppShell } from '../components/app-shell';
import { EmptyState } from '../components/empty-state';
import { ErrorState, LoadingState } from '../components/ui';
import { IntegrityWorkspace } from './integrity-workspace';
import './integrity.css';

/** Administrador Geral acompanhando o Canal de Denuncias das empresas que contrataram o produto. */
export function PlatformIntegrityPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [companies, setCompanies] = useState<CompanyPortfolio[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!token) return;
    setError(null);
    getCompanyPortfolio(token)
      .then(setCompanies)
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : 'Não foi possível carregar as empresas.'));
  }
  useEffect(load, [token]);

  const contracted = useMemo(
    () => (companies ?? []).filter((company) => company.products.some((product) => product.id === INTEGRITY_PRODUCT_ID)),
    [companies],
  );
  const requested = searchParams.get('company') ?? '';
  const companyId = contracted.some((company) => company.id === requested) ? requested : contracted[0]?.id ?? '';

  function changeCompany(nextId: string) {
    setSearchParams((current) => { const next = new URLSearchParams(current); next.set('company', nextId); return next; }, { replace: true });
  }

  return (
    <AppShell eyebrow="Administração geral" title="Canal de Denúncias" description="Denúncias das empresas que contrataram o Canal de Integridade." navigation={platformAdminNavigation}>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!error && companies === null ? <LoadingState /> : null}
      {companies && !contracted.length ? (
        <EmptyState icon={ShieldAlert} title="Nenhuma empresa com o Canal de Integridade" description="Ative o produto na página da empresa para ela começar a receber denúncias." />
      ) : null}
      {companies && contracted.length ? (
        <>
          <div className="int-company-picker">
            <label>Empresa
              <select value={companyId} onChange={(event) => changeCompany(event.target.value)}>
                {contracted.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
            <Link className="secondary-link" to={`/platform-admin/companies/${companyId}`}>Ver página da empresa</Link>
          </div>
          {token && companyId ? <IntegrityWorkspace key={companyId} token={token} companyId={companyId} canManage /> : null}
        </>
      ) : null}
    </AppShell>
  );
}
