import { Users } from 'lucide-react';

import { useAuth } from '../auth/auth-context';
import { AppShell } from '../components/app-shell';
import { companyNavigation } from '../components/company-navigation';
import { EmptyState } from '../components/empty-state';
import { OrganizationAccessTab } from './organization-access-tab';

export function CompanyAccessPage() {
  const { user } = useAuth();
  const companyId = user?.company_id ?? '';

  return (
    <AppShell
      eyebrow="Área da empresa"
      title="Acessos e permissões"
      description="Decida quem da sua equipe pode fazer o quê, usando pacotes de acesso da Turi ou perfis de acesso criados por você."
      navigation={companyNavigation}
    >
      {companyId ? (
        <OrganizationAccessTab companyId={companyId} mode="company" />
      ) : (
        <EmptyState title="Conta sem empresa" description="Esta conta não está vinculada a uma empresa." icon={Users} />
      )}
    </AppShell>
  );
}
