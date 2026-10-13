import { KeyRound, UserPlus } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import { createPlatformUser, getPlatformUsers, PLATFORM_ROLE_LABEL, type PlatformUser, type PlatformUserRole } from '../api/organization';
import { getProjects } from '../api/services';
import type { Project } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { EmptyState } from './empty-state';
import { InfoTooltip } from './info-tooltip';
import { SectionPanel } from './section-panel';
import { StatusPill } from './status-pill';
import { useToast } from './toast';
import { DataTable, ErrorState, Modal, NoPermissionState } from './ui';

function errorText(reason: unknown, fallback: string) {
  return reason instanceof ApiError ? reason.message : fallback;
}

/**
 * Logins (gestores e colaboradores) da empresa. O login nao depende de produto: se a empresa
 * tem Jornadas a pessoa ja entra nas jornadas; senao, so ve o que a gestao de acessos liberar.
 */
export function CompanyUsersPanel({ companyId, allowProjectChoice = false }: { companyId: string; allowProjectChoice?: boolean }) {
  const { token } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<PlatformUser[] | null>(null);
  const [failure, setFailure] = useState<{ message: string; forbidden: boolean } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PlatformUserRole>('employee');
  const [projectId, setProjectId] = useState('');

  const load = useCallback(() => {
    if (!token || !companyId) return;
    setFailure(null);
    getPlatformUsers(token, companyId)
      .then(setUsers)
      .catch((reason) => setFailure({ message: errorText(reason, 'Não foi possível carregar os logins.'), forbidden: reason instanceof ApiError && reason.status === 403 }));
  }, [token, companyId]);
  useEffect(() => { setUsers(null); load(); }, [load]);

  useEffect(() => {
    if (!token || !allowProjectChoice) return;
    getProjects(token).then((data) => setProjects(data.projects.filter((item) => item.company_id === companyId))).catch(() => setProjects([]));
  }, [token, companyId, allowProjectChoice]);

  function openNew() {
    setName(''); setEmail(''); setRole('employee'); setProjectId(''); setCreating(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token || saving) return;
    setSaving(true);
    try {
      await createPlatformUser(token, companyId, { name: name.trim(), email: email.trim(), role, project_id: projectId || null });
      toast.success(`Login criado. A senha temporária foi enviada para ${email.trim()}.`);
      setCreating(false);
      load();
    } catch (reason) {
      toast.error(errorText(reason, 'Não foi possível criar o login.'));
    } finally {
      setSaving(false);
    }
  }

  if (failure) return failure.forbidden ? <NoPermissionState message="Você não tem permissão para ver os logins desta empresa." /> : <ErrorState message={failure.message} onRetry={load} />;

  return (
    <SectionPanel
      title="Logins da empresa"
      eyebrow={users ? `${users.length} login(s)` : undefined}
      action={<button type="button" className="primary-button" onClick={openNew}><UserPlus size={16} />Novo login</button>}
    >
      <p className="panel-intro">
        Quem tem login entra na plataforma. O que cada pessoa vê depende dos produtos da empresa (com Jornadas, gestores e colaboradores já recebem as jornadas) e dos perfis de acesso ligados ao colaborador dela.
        <InfoTooltip text="Para um perfil de acesso valer para alguém, o login precisa estar ligado a um colaborador. Faça isso no cadastro do colaborador, campo “Login na plataforma”." label="Como o login se liga aos acessos" />
      </p>
      <DataTable<PlatformUser>
        rows={users ?? []}
        rowKey={(item) => item.id}
        loading={users === null}
        dense
        empty={<EmptyState icon={KeyRound} title="Nenhum login ainda" description="Crie o login de um gestor ou colaborador. A senha temporária vai por e-mail." />}
        columns={[
          { key: 'name', header: 'Nome', render: (item) => <span><strong>{item.name}</strong><br /><span className="admin-form__hint">{item.email}</span></span> },
          { key: 'role', header: 'Papel', width: '120px', render: (item) => PLATFORM_ROLE_LABEL[item.role] ?? item.role },
          { key: 'person', header: 'Colaborador ligado', render: (item) => item.linked_person_name ? item.linked_person_name : <StatusPill tone="warning">Sem colaborador</StatusPill> },
          ...(allowProjectChoice ? [{ key: 'project', header: 'Projeto', hideOnMobile: true, render: (item: PlatformUser) => item.project_name ?? '—' }] : []),
        ]}
      />
      <Modal
        open={creating}
        onClose={saving ? () => undefined : () => setCreating(false)}
        title="Novo login"
        description="A pessoa recebe por e-mail uma senha temporária para entrar."
        size="sm"
        footer={<>
          <button type="button" className="secondary-button" onClick={() => setCreating(false)} disabled={saving}>Cancelar</button>
          <button type="submit" form="company-user-form" className="primary-button" disabled={saving || !name.trim() || !email.trim()}>{saving ? 'Criando…' : 'Criar login'}</button>
        </>}
      >
        <form id="company-user-form" className="admin-form" onSubmit={(event) => void submit(event)}>
          <label><span>Nome</span><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} autoFocus /></label>
          <label><span>E-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={255} /></label>
          <label><span>Papel</span>
            <select value={role} onChange={(event) => setRole(event.target.value as PlatformUserRole)}>
              <option value="employee">Colaborador</option>
              <option value="manager">Gestor</option>
            </select>
          </label>
          {allowProjectChoice && projects.length > 1 ? (
            <label><span>Projeto de Jornadas</span>
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">Projeto principal da empresa</option>
                {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          ) : null}
          <p className="admin-form__hint">Gestor e colaborador só fazem diferença nos produtos (por exemplo, a jornada do gestor em Jornadas). Os demais acessos vêm dos perfis de acesso.</p>
        </form>
      </Modal>
    </SectionPanel>
  );
}
