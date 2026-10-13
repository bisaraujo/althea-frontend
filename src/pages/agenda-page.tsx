import { CalendarDays } from 'lucide-react';

import { JORNADAS_PRODUCT_ID, useMyProducts } from '../api/workspace-access';
import { useAuth } from '../auth/auth-context';
import { AppShell } from '../components/app-shell';
import { companyNavigation } from '../components/company-navigation';
import { EmptyState } from '../components/empty-state';
import { managerNavigation } from '../components/role-navigation';
import { LoadingState, NoPermissionState } from '../components/ui';
import { ActionPlanAgenda } from './action-plan-agenda';

/** Agenda do plano de acao para a conta da empresa e para gestores (do proprio projeto). */
export function AgendaPage() {
  const { token, user } = useAuth();
  const companyId = user?.company_id ?? '';
  const products = useMyProducts(token);
  const navigation = user?.role === 'company' ? companyNavigation : managerNavigation;

  let content;
  if (!token || !companyId) content = <NoPermissionState message="Esta conta não está vinculada a uma empresa." />;
  else if (products === null) content = <LoadingState />;
  else if (!products.has(JORNADAS_PRODUCT_ID)) content = <EmptyState icon={CalendarDays} title="Plano de ação não contratado" description="A agenda do plano de ação faz parte da Plataforma de Jornadas, que esta empresa ainda não contratou." />;
  else content = <ActionPlanAgenda token={token} companyId={companyId} />;

  return (
    <AppShell eyebrow="Plano de ação" title="Agenda" description="As ações do plano de ação da empresa, dia a dia. Marque cada uma como feita quando acontecer." navigation={navigation}>
      {content}
    </AppShell>
  );
}
