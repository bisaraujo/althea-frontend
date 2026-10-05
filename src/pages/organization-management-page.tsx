import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getCompanies, getEmployments, getOrganizationalStructure, getPeople } from '../api/services';
import type { Company, Employment, OrganizationalStructure, Person } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { platformAdminNavigation } from '../components/admin-navigation';
import { AppShell } from '../components/app-shell';
import { ErrorState, NoPermissionState } from '../components/ui';
import { AuditTab } from './organization-audit-tab';
import { DocumentsTab } from './organization-documents-tab';
import { ImportTab } from './organization-import-tab';
import { OrganizationAccessTab } from './organization-access-tab';
import { PeopleTab } from './organization-people-tab';
import { StructureTab } from './organization-structure-tab';
import './organization-management.css';

type Tab = 'structure' | 'people' | 'documents' | 'access' | 'governance' | 'import';
const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'structure', label: 'Estrutura' }, { id: 'people', label: 'Colaboradores e vínculos' },
  { id: 'documents', label: 'Documentos' }, { id: 'access', label: 'Acessos' },
  { id: 'governance', label: 'Campos e auditoria' },
  { id: 'import', label: 'Importação' },
];

function errorText(error: unknown) { return error instanceof ApiError ? error.message : 'Não foi possível carregar os dados. Tente novamente.'; }

export function OrganizationManagementPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCompanyId = searchParams.get('company') || '';
  const loadSeq = useRef(0);
  const [tab, setTab] = useState<Tab>('structure');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [structure, setStructure] = useState<OrganizationalStructure>({ units: [], areas: [], positions: [] });
  const [people, setPeople] = useState<Person[]>([]);
  const [employments, setEmployments] = useState<Employment[]>([]);
  const [loadError, setLoadError] = useState<{ message: string; forbidden: boolean } | null>(null); const [loading, setLoading] = useState(false);

  function failure(reason: unknown) { return { message: errorText(reason), forbidden: reason instanceof ApiError && reason.status === 403 }; }

  async function loadCompany(nextCompanyId: string) {
    if (!token || !nextCompanyId) return;
    const seq = ++loadSeq.current;
    const [nextStructure, nextPeople, nextEmployments] = await Promise.all([
      getOrganizationalStructure(token, nextCompanyId), getPeople(token, nextCompanyId), getEmployments(token, nextCompanyId),
    ]);
    if (seq !== loadSeq.current) return;
    setStructure(nextStructure); setPeople(nextPeople); setEmployments(nextEmployments);
  }
  function reload() { setLoadError(null); setLoading(true); void loadCompany(companyId).catch((reason) => setLoadError(failure(reason))).finally(() => setLoading(false)); }

  useEffect(() => { if (!token) return; getCompanies(token).then((data) => { setCompanies(data); setCompanyId((current) => current || (data.some((item) => item.id === requestedCompanyId) ? requestedCompanyId : data[0]?.id || '')); }).catch((reason) => setLoadError(failure(reason))); }, [token]);
  useEffect(() => {
    if (!companyId) return;
    // Zera os dados ao trocar de empresa para nunca exibir a estrutura de outra.
    setStructure({ units: [], areas: [], positions: [] }); setPeople([]); setEmployments([]);
    reload();
  }, [companyId, token]);
  // Mantém ?company= em sincronia (e aceita a troca vinda de um link externo).
  useEffect(() => { if (requestedCompanyId && requestedCompanyId !== companyId && companies.some((item) => item.id === requestedCompanyId)) setCompanyId(requestedCompanyId); }, [requestedCompanyId, companies]);
  function changeCompany(nextId: string) {
    setCompanyId(nextId);
    setSearchParams((current) => { const next = new URLSearchParams(current); next.set('company', nextId); return next; }, { replace: true });
  }

  // Recarrega estrutura/colaboradores após uma ação; os erros de recarga viram toast dentro de cada aba.
  async function refresh() { await loadCompany(companyId); }
  const showProblem = loadError && (tab === 'structure' || tab === 'people');
  const currentCompany = companies.find((item) => item.id === companyId);
  const ready = Boolean(token && companyId);

  return (
    <AppShell eyebrow="Administração geral" title="Gestão organizacional" description="Estrutura, colaboradores, documentos e acessos operacionais da empresa, sem duplicar o CRM." navigation={platformAdminNavigation}>
      <div className="organization-toolbar"><label><span>Empresa</span><select value={companyId} onChange={(event) => changeCompany(event.target.value)}>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><div className="organization-tabs" role="tablist" aria-label="Seções da gestão organizacional">{tabs.map((item) => <button type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)} key={item.id}>{item.label}</button>)}</div></div>
      {showProblem && loadError ? (loadError.forbidden ? <NoPermissionState message="Você não tem permissão para ver a organização desta empresa." /> : <ErrorState message={loadError.message} onRetry={reload} />) : null}
      {!showProblem && ready && tab === 'structure' && token ? <StructureTab token={token} companyId={companyId} company={currentCompany} structure={structure} employments={employments} loading={loading} onReload={refresh} /> : null}
      {!showProblem && ready && tab === 'people' && token ? <PeopleTab token={token} companyId={companyId} structure={structure} people={people} employments={employments} loading={loading} onReload={refresh} onGoToStructure={() => setTab('structure')} /> : null}
      {ready && tab === 'documents' && token ? <DocumentsTab key={companyId} token={token} companyId={companyId} /> : null}
      {tab === 'access' ? <OrganizationAccessTab companyId={companyId} mode="admin" /> : null}
      {ready && tab === 'governance' && token ? <AuditTab key={companyId} token={token} companyId={companyId} /> : null}
      {ready && tab === 'import' && token ? <ImportTab key={companyId} token={token} companyId={companyId} onImported={refresh} /> : null}
    </AppShell>
  );
}
