import { ShieldAlert } from 'lucide-react';

import { INTEGRITY_PRODUCT_ID, useMyPermissions, useMyProducts } from '../api/workspace-access';
import { useAuth } from '../auth/auth-context';
import { AppShell } from '../components/app-shell';
import { companyNavigation } from '../components/company-navigation';
import { EmptyState } from '../components/empty-state';
import { employeeNavigation, managerNavigation } from '../components/role-navigation';
import { LoadingState, NoPermissionState } from '../components/ui';
import { IntegrityWorkspace } from './integrity-workspace';

/** Canal de Denuncias da propria empresa: conta da empresa e membros do comite (perfil com integrity.cases.*). */
export function IntegrityPage() {
  const { token, user } = useAuth();
  const companyId = user?.company_id ?? '';
  const permissions = useMyPermissions(token, companyId);
  const products = useMyProducts(token);
  const navigation = user?.role === 'company' ? companyNavigation : user?.role === 'manager' ? managerNavigation : employeeNavigation;
  const loading = Boolean(companyId) && (permissions === null || products === null);

  let content;
  if (!companyId) content = <NoPermissionState message="Esta conta não está vinculada a uma empresa." />;
  else if (loading) content = <LoadingState label="Carregando…" />;
  else if (!permissions?.has('integrity.cases.view')) content = <NoPermissionState message="Você não faz parte do comitê do Canal de Denúncias. Fale com a empresa se precisar desse acesso." />;
  else if (!products?.has(INTEGRITY_PRODUCT_ID)) content = <EmptyState icon={ShieldAlert} title="Canal de Denúncias não contratado" description="Esta empresa ainda não contratou o Canal de Integridade. Fale com a Turi para ativar." />;
  else if (token) content = <IntegrityWorkspace token={token} companyId={companyId} canManage={permissions.has('integrity.cases.manage')} />;

  return (
    <AppShell eyebrow="Canal de Integridade" title="Canal de Denúncias" description="Denúncias recebidas, apuração pelo comitê e divulgação do canal para os colaboradores." navigation={navigation}>
      {content}
    </AppShell>
  );
}
