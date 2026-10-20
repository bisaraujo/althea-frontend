import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getCompanyPortfolio } from '../api/services';
import type { CompanyPortfolio } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { platformAdminNavigation } from '../components/admin-navigation';
import { AppShell } from '../components/app-shell';
import { ErrorState, LoadingState } from '../components/ui';
import { ActionPlanAgenda } from './action-plan-agenda';
import { ActionPlanEditor } from './action-plan-editor';
import './benefits-agenda.css';

type Tab = 'plan' | 'agenda';

/** Administrador Geral montando o plano de acao de cada empresa e acompanhando a agenda dela. */
export function PlatformActionPlanPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [companies, setCompanies] = useState<CompanyPortfolio[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tab: Tab = searchParams.get('tab') === 'agenda' ? 'agenda' : 'plan';

  function load() {
    if (!token) return;
    setError(null);
    getCompanyPortfolio(token).then(setCompanies).catch((reason) => setError(reason instanceof ApiError ? reason.message : 'Não foi possível carregar as empresas.'));
  }
  useEffect(load, [token]);

  const requested = searchParams.get('company') ?? '';
  const companyId = companies?.some((company) => company.id === requested) ? requested : companies?.[0]?.id ?? '';
  function setParam(key: string, value: string) {
    setSearchParams((current) => { const next = new URLSearchParams(current); next.set(key, value); return next; }, { replace: true });
  }

  return (
    <AppShell eyebrow="Administração geral" title="Plano de ação" description="Ações e datas combinadas com cada empresa. Quem tem Jornadas vê também as entregas do cronograma." navigation={platformAdminNavigation}>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!error && !companies ? <LoadingState /> : null}
      {companies?.length ? (
        <>
          <div className="agd-toolbar">
            <label className="agd-toolbar__company">
              <span>Empresa</span>
              <select value={companyId} onChange={(event) => setParam('company', event.target.value)}>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
              <Link className="agd-toolbar__link" to={`/platform-admin/companies/${companyId}`}>Ver empresa</Link>
            </label>
            <div className="agd-tabs" role="tablist" aria-label="Plano de ação">
              <button type="button" role="tab" aria-selected={tab === 'plan'} className={tab === 'plan' ? 'active' : ''} onClick={() => setParam('tab', 'plan')}>Ações</button>
              <button type="button" role="tab" aria-selected={tab === 'agenda'} className={tab === 'agenda' ? 'active' : ''} onClick={() => setParam('tab', 'agenda')}>Agenda</button>
            </div>
          </div>
          {token && companyId ? (tab === 'plan'
            ? <ActionPlanEditor key={companyId} token={token} companyId={companyId} />
            : <ActionPlanAgenda key={companyId} token={token} companyId={companyId} />) : null}
        </>
      ) : null}
    </AppShell>
  );
}
