import { ShieldCheck } from 'lucide-react';

import { AppShell } from '../components/app-shell';
import { SectionPanel } from '../components/section-panel';
import { StatCard } from '../components/stat-card';
import { useAuth } from '../auth/auth-context';

export function AdminDashboard() {
  const { user, signOut } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <AppShell
      user={user}
      title="Painel administrativo"
      subtitle="O backend ja esta pronto para empresas, jornadas, formularios, apresentacoes e permissoes."
      onSignOut={signOut}
    >
      <div className="stats-grid">
        <StatCard
          label="Acesso"
          value="Total"
          meta="Admin continua com permissao plena sobre a plataforma."
          icon={<ShieldCheck size={18} />}
        />
      </div>

      <SectionPanel title="Proximo passo no admin" eyebrow="Visao geral">
        <div className="stack-text">
          <p>
            O papel de admin ja esta funcional no backend, mas este primeiro corte do frontend
            prioriza as areas operacionais de empresa, gestor e funcionario.
          </p>
          <p>
            Quando a gente voltar para o admin, o ideal e criar telas para cadastro e edicao de
            jornadas, secoes e itens diretamente pela interface.
          </p>
        </div>
      </SectionPanel>
    </AppShell>
  );
}
