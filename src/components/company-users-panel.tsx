import { KeyRound, Trash2, UserCheck, UserPlus, UserX } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import { createPlatformUser, deletePlatformUser, getPlatformUsers, PLATFORM_ROLE_LABEL, type PlatformUser, type PlatformUserRole, setPlatformUserActive } from '../api/organization';
import { getProjects } from '../api/services';
import type { Project } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { EmptyState } from './empty-state';
import { InfoTooltip } from './info-tooltip';
import { SectionPanel } from './section-panel';
import { StatusPill } from './status-pill';
import { useToast } from './toast';
import { DataTable, ErrorState, Modal, NoPermissionState, useConfirm } from './ui';
import { plural } from '../lib/plural';

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
  const confirm = useConfirm();
  const [acting, setActing] = useState<string | null>(null);
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

  async function setActive(item: PlatformUser, active: boolean) {
    if (!token || acting) return;
    if (!active) {
      const ok = await confirm({
        title: `Desativar o acesso de ${item.name}?`,
        description: 'A pessoa não consegue mais entrar na plataforma nem recebe e-mails de pesquisa. Tudo o que ela já fez continua no histórico. Dá para reativar depois.',
        confirmLabel: 'Desativar acesso', tone: 'danger',
      });
      if (!ok) return;
    }
    setActing(item.id);
    try {
      await setPlatformUserActive(token, companyId, item.id, active);
      toast.success(active ? `${item.name} voltou a ter acesso.` : `Acesso de ${item.name} desativado.`);
      load();
    } catch (reason) {
      toast.error(errorText(reason, 'Não foi possível mudar o acesso.'));
    } finally {
      setActing(null);
    }
  }

  async function remove(item: PlatformUser) {
    if (!token || acting) return;
    const ok = await confirm({
      title: `Excluir o login de ${item.name}?`,
      description: 'Só dá para excluir quem nunca usou a plataforma. Se a pessoa já respondeu algo ou mexeu no plano de ação, o acesso é desativado em vez de excluído.',
      confirmLabel: 'Excluir login', tone: 'danger',
    });
    if (!ok) return;
    setActing(item.id);
    try {
      await deletePlatformUser(token, companyId, item.id);
      toast.success(`Login de ${item.name} excluído.`);
      load();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        setActing(null);
        const deactivate = await confirm({
          title: 'Esta pessoa já usou a plataforma',
          description: 'Para manter o histórico (respostas, jornadas e plano de ação), o login não pode ser excluído. Quer desativar o acesso?',
          confirmLabel: 'Desativar acesso', tone: 'danger',
        });
        if (deactivate) {
          setActing(item.id);
          try {
            await setPlatformUserActive(token, companyId, item.id, false);
            toast.success(`Acesso de ${item.name} desativado.`);
            load();
          } catch (inner) {
            toast.error(errorText(inner, 'Não foi possível desativar o acesso.'));
          }
        }
      } else {
        toast.error(errorText(reason, 'Não foi possível excluir o login.'));
      }
    } finally {
      setActing(null);
    }
  }

  if (failure) return failure.forbidden ? <NoPermissionState message="Você não tem permissão para ver os logins desta empresa." /> : <ErrorState message={failure.message} onRetry={load} />;

  return (
    <SectionPanel
      title="Logins da empresa"
      eyebrow={users ? plural(users.length, 'login', 'logins') : undefined}
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
          { key: 'name', header: 'Nome', render: (item) => (
            <span className={item.deactivated_at ? 'cu-off' : undefined}>
              <strong>{item.name}</strong>
              {item.deactivated_at ? <span className="cu-pill" title={`Desativado em ${new Date(item.deactivated_at).toLocaleDateString('pt-BR')}`}><StatusPill tone="muted">Desativado</StatusPill></span> : null}
              <br /><span className="admin-form__hint cell-email" title={item.email}>{item.email}</span>
            </span>
          ) },
          { key: 'role', header: 'Papel', width: '130px', render: (item) => (
            <span className="cu-role">{PLATFORM_ROLE_LABEL[item.role] ?? item.role}{allowProjectChoice && item.project_name ? <span className="admin-form__hint" title={item.project_name}>{item.project_name}</span> : null}</span>
          ) },
          { key: 'person', header: 'Colaborador ligado', render: (item) => item.linked_person_name ? item.linked_person_name : <StatusPill tone="warning">Sem colaborador</StatusPill> },
          { key: 'actions', header: '', width: '80px', align: 'right', render: (item) => (
            <span className="cu-actions">
              {item.deactivated_at
                ? <button type="button" className="org-icon-btn" title="Reativar acesso" aria-label={`Reativar o acesso de ${item.name}`} disabled={acting !== null} onClick={() => void setActive(item, true)}><UserCheck size={15} /></button>
                : <button type="button" className="org-icon-btn" title="Desativar acesso" aria-label={`Desativar o acesso de ${item.name}`} disabled={acting !== null} onClick={() => void setActive(item, false)}><UserX size={15} /></button>}
              <button type="button" className="org-icon-btn" title="Excluir login" aria-label={`Excluir o login de ${item.name}`} disabled={acting !== null} onClick={() => void remove(item)}><Trash2 size={15} /></button>
            </span>
          ) },
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
