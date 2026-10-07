import { useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '../api/client';
import { getMyCompanyProducts } from '../api/company';
import { getEmployments, getOrganizationalStructure, getPeople } from '../api/services';
import type { Company, Employment, OrganizationalStructure, Person } from '../api/types';
import { useMyPermissions } from '../api/workspace-access';
import { useAuth } from '../auth/auth-context';
import { AppShell } from '../components/app-shell';
import { companyNavigation } from '../components/company-navigation';
import { employeeNavigation, managerNavigation } from '../components/role-navigation';
import { ErrorState, LoadingState, NoPermissionState } from '../components/ui';
import { AuditTab } from './organization-audit-tab';
import { DocumentsTab } from './organization-documents-tab';
import { ImportTab } from './organization-import-tab';
import { OrganizationAccessTab } from './organization-access-tab';
import { PeopleTab } from './organization-people-tab';
import { StructureTab } from './organization-structure-tab';
import './organization-management.css';

type Tab = 'structure' | 'people' | 'documents' | 'governance' | 'import' | 'access';

function errorText(error: unknown) { return error instanceof ApiError ? error.message : 'Não foi possível carregar os dados. Tente novamente.'; }

/**
 * Gestao organizacional da propria empresa (conta da empresa, gestores e colaboradores).
 * Cada aba e cada botao de edicao aparecem conforme as permissoes efetivas do usuario;
 * o backend aplica as mesmas regras (inclusive o limite por unidade/area).
 */
export function OrganizationWorkspacePage() {
  const { token, user } = useAuth();
  const companyId = user?.company_id ?? '';
  const permissions = useMyPermissions(token, companyId);
  const can = (key: string) => Boolean(permissions?.has(key));
  const loadSeq = useRef(0);
  const [tab, setTab] = useState<Tab>('structure');
  const [company, setCompany] = useState<Company | undefined>(undefined);
  const [structure, setStructure] = useState<OrganizationalStructure>({ units: [], areas: [], positions: [] });
  const [people, setPeople] = useState<Person[]>([]);
  const [employments, setEmployments] = useState<Employment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<{ message: string; forbidden: boolean } | null>(null);

  const canSeePeople = can('colaboradores.view');
  const tabs = useMemo(() => {
    if (!permissions) return [];
    const list: Array<{ id: Tab; label: string }> = [{ id: 'structure', label: 'Estrutura' }];
    if (permissions.has('colaboradores.view')) list.push({ id: 'people', label: 'Colaboradores e vínculos' });
    if (permissions.has('documentos.view')) list.push({ id: 'documents', label: 'Documentos' });
    if (permissions.has('colaboradores.custom_fields.view') || permissions.has('organizacao.audit.view')) list.push({ id: 'governance', label: 'Campos e auditoria' });
    if (permissions.has('colaboradores.manage') && permissions.has('organizacao.manage')) list.push({ id: 'import', label: 'Importação' });
    // A conta da empresa ja tem a pagina "Acessos e permissoes"; aqui a aba e para quem recebeu acessos.manage por perfil.
    if (permissions.has('acessos.manage') && user?.role !== 'company') list.push({ id: 'access', label: 'Acessos' });
    return list;
  }, [permissions, user?.role]);

  useEffect(() => {
    if (!token) return;
    getMyCompanyProducts(token)
      .then((data) => setCompany(data.company_name ? ({ id: data.company_id, name: data.company_name } as Company) : undefined))
      .catch(() => undefined);
  }, [token]);

  async function load() {
    if (!token || !companyId || !permissions) return;
    const seq = ++loadSeq.current;
    const [nextStructure, nextPeople, nextEmployments] = await Promise.all([
      getOrganizationalStructure(token, companyId),
      canSeePeople ? getPeople(token, companyId) : Promise.resolve([] as Person[]),
      canSeePeople ? getEmployments(token, companyId) : Promise.resolve([] as Employment[]),
    ]);
    if (seq !== loadSeq.current) return;
    setStructure(nextStructure); setPeople(nextPeople); setEmployments(nextEmployments);
  }

  function reload() {
    setLoadError(null); setLoading(true);
    void load()
      .catch((reason) => setLoadError({ message: errorText(reason), forbidden: reason instanceof ApiError && reason.status === 403 }))
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); }, [token, companyId, permissions]);
  useEffect(() => { if (tabs.length && !tabs.some((item) => item.id === tab)) setTab('structure'); }, [tabs, tab]);

  const navigation = user?.role === 'company' ? companyNavigation : user?.role === 'manager' ? managerNavigation : employeeNavigation;
  const ready = Boolean(token && companyId && permissions);
  const showProblem = loadError && (tab === 'structure' || tab === 'people');

  return (
    <AppShell
      eyebrow={company?.name ?? 'Sua empresa'}
      title="Gestão organizacional"
      description="Estrutura, colaboradores e documentos da empresa, de acordo com os acessos que você recebeu."
      navigation={navigation}
    >
      {!companyId ? <NoPermissionState message="Esta conta não está vinculada a uma empresa." /> : null}
      {companyId && !permissions ? <LoadingState label="Carregando seus acessos…" /> : null}
      {ready && renderTabs(tabs, tab, setTab)}
      {showProblem && loadError ? (loadError.forbidden ? <NoPermissionState message="Você não tem permissão para ver esta parte da organização." /> : <ErrorState message={loadError.message} onRetry={reload} />) : null}
      {ready && token && !showProblem && tab === 'structure' ? (
        <StructureTab token={token} companyId={companyId} company={company} structure={structure} employments={employments} loading={loading} onReload={load} canManage={can('organizacao.manage')} showPeopleCounts={canSeePeople} />
      ) : null}
      {ready && token && !showProblem && tab === 'people' ? (
        <PeopleTab token={token} companyId={companyId} structure={structure} people={people} employments={employments} loading={loading} onReload={load} onGoToStructure={() => setTab('structure')} canManage={can('colaboradores.manage')} />
      ) : null}
      {ready && token && tab === 'documents' ? <DocumentsTab token={token} companyId={companyId} canManage={can('documentos.manage')} /> : null}
      {ready && token && tab === 'governance' ? (
        <AuditTab token={token} companyId={companyId} showFields={can('colaboradores.custom_fields.view')} canManageFields={can('colaboradores.custom_fields.manage')} showAudit={can('organizacao.audit.view')} />
      ) : null}
      {ready && token && tab === 'import' ? <ImportTab token={token} companyId={companyId} onImported={load} /> : null}
      {ready && tab === 'access' ? <OrganizationAccessTab companyId={companyId} mode="company" /> : null}
    </AppShell>
  );
}

function renderTabs(tabs: Array<{ id: Tab; label: string }>, current: Tab, onChange: (tab: Tab) => void) {
  if (tabs.length < 2) return null;
  return (
    <div className="organization-toolbar organization-toolbar--tabs-only">
      <div className="organization-tabs" role="tablist" aria-label="Seções da gestão organizacional">
        {tabs.map((item) => (
          <button type="button" role="tab" aria-selected={current === item.id} className={current === item.id ? 'active' : ''} onClick={() => onChange(item.id)} key={item.id}>{item.label}</button>
        ))}
      </div>
    </div>
  );
}
