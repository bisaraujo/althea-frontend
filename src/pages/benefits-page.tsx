import { useState } from 'react';

import { useMyPermissions } from '../api/workspace-access';
import { useAuth } from '../auth/auth-context';
import { AppShell } from '../components/app-shell';
import { companyNavigation } from '../components/company-navigation';
import { employeeNavigation, managerNavigation } from '../components/role-navigation';
import { LoadingState, NoPermissionState } from '../components/ui';
import { BenefitsWorkspace, MyBenefits } from './benefits-workspace';

/** Beneficios para empresa, gestores e colaboradores: catalogo (com permissao) e "Meus beneficios". */
export function BenefitsPage() {
  const { token, user } = useAuth();
  const companyId = user?.company_id ?? '';
  const permissions = useMyPermissions(token, companyId);
  const isCompany = user?.role === 'company';
  const canSeeCatalog = Boolean(permissions?.has('beneficios.view'));
  const [tab, setTab] = useState<'mine' | 'catalog'>(isCompany ? 'catalog' : 'mine');
  const navigation = isCompany ? companyNavigation : user?.role === 'manager' ? managerNavigation : employeeNavigation;
  const current = isCompany ? 'catalog' : canSeeCatalog ? tab : 'mine';

  return (
    <AppShell eyebrow="Benefícios" title={isCompany ? 'Benefícios da empresa' : 'Benefícios'} description={isCompany ? 'O que a empresa oferece, quem tem direito e quanto custa por mês.' : 'Os benefícios que valem para você e como usar cada um.'} navigation={navigation}>
      {!token || !companyId ? <NoPermissionState message="Esta conta não está vinculada a uma empresa." /> : permissions === null ? <LoadingState /> : (
        <>
          {!isCompany && canSeeCatalog ? (
            <div className="organization-toolbar organization-toolbar--tabs-only">
              <div className="organization-tabs" role="tablist" aria-label="Seções de benefícios">
                <button type="button" role="tab" aria-selected={current === 'mine'} className={current === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>Meus benefícios</button>
                <button type="button" role="tab" aria-selected={current === 'catalog'} className={current === 'catalog' ? 'active' : ''} onClick={() => setTab('catalog')}>Benefícios da empresa</button>
              </div>
            </div>
          ) : null}
          {current === 'catalog' ? <BenefitsWorkspace token={token} companyId={companyId} canManage={Boolean(permissions?.has('beneficios.manage'))} /> : <MyBenefits token={token} />}
        </>
      )}
    </AppShell>
  );
}
