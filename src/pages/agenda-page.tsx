import { useState } from 'react';

import { useMyPermissions } from '../api/workspace-access';
import { useAuth } from '../auth/auth-context';
import { AppShell } from '../components/app-shell';
import { companyNavigation } from '../components/company-navigation';
import { employeeNavigation, managerNavigation } from '../components/role-navigation';
import { LoadingState, NoPermissionState } from '../components/ui';
import { ActionPlanAgenda } from './action-plan-agenda';
import { ActionPlanEditor } from './action-plan-editor';
import './benefits-agenda.css';

type Tab = 'agenda' | 'actions';

/**
 * Plano de acao da empresa (qualquer empresa, com ou sem produto). A Turi monta e reprograma as acoes;
 * aqui a empresa acompanha a agenda e marca o que foi feito. Gestores e colaboradores entram com a
 * permissao plano_acao.view (e plano_acao.update para marcar como feito).
 */
export function AgendaPage() {
  const { token, user } = useAuth();
  const companyId = user?.company_id ?? '';
  const permissions = useMyPermissions(token, companyId);
  const [tab, setTab] = useState<Tab>('agenda');
  const navigation = user?.role === 'company' ? companyNavigation : user?.role === 'manager' ? managerNavigation : employeeNavigation;

  let content;
  if (!token || !companyId) content = <NoPermissionState message="Esta conta não está vinculada a uma empresa." />;
  else if (permissions === null) content = <LoadingState />;
  else if (!permissions.has('plano_acao.view')) content = <NoPermissionState message="Você não tem acesso ao plano de ação da empresa. Peça a permissão a quem gerencia os acessos." />;
  else content = (
    <>
      <div className="agd-toolbar">
        <div className="agd-tabs" role="tablist" aria-label="Plano de ação">
          <button type="button" role="tab" aria-selected={tab === 'agenda'} className={tab === 'agenda' ? 'active' : ''} onClick={() => setTab('agenda')}>Agenda</button>
          <button type="button" role="tab" aria-selected={tab === 'actions'} className={tab === 'actions' ? 'active' : ''} onClick={() => setTab('actions')}>Ações do plano</button>
        </div>
      </div>
      {tab === 'agenda'
        ? <ActionPlanAgenda token={token} companyId={companyId} canMark={permissions.has('plano_acao.update')} />
        : <ActionPlanEditor token={token} companyId={companyId} readOnly />}
    </>
  );

  return (
    <AppShell eyebrow="Plano de ação" title="Plano de ação" description="As ações combinadas com a Turi, dia a dia." navigation={navigation}>
      {content}
    </AppShell>
  );
}
