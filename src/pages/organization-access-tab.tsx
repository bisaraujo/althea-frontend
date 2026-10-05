import { Clock3, ExternalLink, KeyRound, Pencil, Plus, Send, ShieldCheck, UserCheck } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { createCompanyProfile, decideCapabilityRequest, updateCompanyProfile } from '../api/access';
import { ApiError } from '../api/client';
import {
  assignEmploymentAccessScope, createAccessProfileFromTemplate, getAccessAssignments, getAccessProfileTemplates,
  getCompanyCustomCapabilities, getEmployments, getOrganizationalAccessProfiles, getOrganizationalStructure,
  getPermissionCatalog, requestCustomCapability, revokeAccessAssignment,
} from '../api/services';
import type { AccessAssignment, CompanyCustomCapability, Employment, OrganizationalAccessProfile, OrganizationalStructure, PermissionCatalogEntry } from '../api/types';
import { useAuth } from '../auth/auth-context';
import {
  AccessCard, AccessGlossary, AssignmentTable, PermissionPicker, RequestDrawer, RequestTable, TemplateGallery, TermLabel,
  slugifyPermissionKey, withApprovedCustomPermissions,
} from '../components/access-ui';
import { EmptyState } from '../components/empty-state';
import { SectionPanel } from '../components/section-panel';
import { StatCard } from '../components/stat-card';
import { StatusPill } from '../components/status-pill';
import { useToast } from '../components/toast';
import { Drawer, ErrorState, LoadingState, SectionHeader, useConfirm } from '../components/ui';
import './access-admin.css';

type Tab = 'profiles' | 'people' | 'requests';
const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'profiles', label: 'Perfis de acesso' },
  { id: 'people', label: 'Quem tem acesso' },
  { id: 'requests', label: 'Solicitações' },
];

function errorText(error: unknown) { return error instanceof ApiError ? error.message : 'Não foi possível concluir a operação.'; }

function employmentLabel(item: Employment) {
  return [item.person_name, item.position_name, item.area_name, item.unit_name].filter(Boolean).join(' · ');
}

/**
 * Gestão de acessos de UMA empresa. Carrega tudo sozinho a partir do companyId.
 * mode="company": a própria empresa (pode solicitar nova permissão à Turi).
 * mode="admin": Administrador Geral olhando a empresa (pode decidir as solicitações).
 */
export function OrganizationAccessTab({ companyId, mode = 'admin' }: { companyId: string; mode?: 'admin' | 'company' }) {
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>('profiles');
  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([]);
  const [templates, setTemplates] = useState<OrganizationalAccessProfile[]>([]);
  const [profiles, setProfiles] = useState<OrganizationalAccessProfile[]>([]);
  const [requests, setRequests] = useState<CompanyCustomCapability[]>([]);
  const [assignments, setAssignments] = useState<AccessAssignment[]>([]);
  const [employments, setEmployments] = useState<Employment[]>([]);
  const [structure, setStructure] = useState<OrganizationalStructure>({ units: [], areas: [], positions: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [profileFormOpen, setProfileFormOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileDescription, setProfileDescription] = useState('');
  const [profilePermissions, setProfilePermissions] = useState<string[]>([]);
  const [profileActive, setProfileActive] = useState(true);

  const [assignEmploymentId, setAssignEmploymentId] = useState('');
  const [assignProfileId, setAssignProfileId] = useState('');
  const [assignUnitId, setAssignUnitId] = useState('');
  const [assignAreaId, setAssignAreaId] = useState('');

  const [requestLabel, setRequestLabel] = useState('');
  const [requestKey, setRequestKey] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);

  const pickerCatalog = useMemo(() => withApprovedCustomPermissions(catalog, requests), [catalog, requests]);
  const activeProfiles = profiles.filter((item) => item.active);
  const pendingCount = requests.filter((item) => item.status === 'pending').length;
  const peopleWithAccess = new Set(assignments.map((item) => item.employment_id)).size;
  const packageNames = useMemo(() => new Set(templates.map((item) => item.name.trim().toLowerCase())), [templates]);
  const openRequest = requests.find((item) => item.id === openRequestId) ?? null;

  const load = useCallback(async () => {
    if (!token || !companyId) return;
    const [nextCatalog, nextTemplates, nextProfiles, nextRequests, nextAssignments, nextEmployments, nextStructure] = await Promise.all([
      getPermissionCatalog(token), getAccessProfileTemplates(token), getOrganizationalAccessProfiles(token, companyId),
      getCompanyCustomCapabilities(token, companyId), getAccessAssignments(token, companyId), getEmployments(token, companyId),
      getOrganizationalStructure(token, companyId),
    ]);
    setCatalog(nextCatalog); setTemplates(nextTemplates); setProfiles(nextProfiles); setRequests(nextRequests);
    setAssignments(nextAssignments); setEmployments(nextEmployments); setStructure(nextStructure);
    setAssignEmploymentId((current) => nextEmployments.some((item) => item.id === current) ? current : nextEmployments[0]?.id || '');
    setAssignProfileId((current) => nextProfiles.some((item) => item.id === current && item.active) ? current : nextProfiles.find((item) => item.active)?.id || '');
  }, [token, companyId]);

  const reload = useCallback(() => {
    setLoading(true);
    load().then(() => setLoadError(null)).catch((reason) => setLoadError(errorText(reason))).finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    setTab('profiles'); setProfileFormOpen(false); setOpenRequestId(null);
    reload();
  }, [reload]);

  async function act(action: () => Promise<unknown>, message: string): Promise<boolean> {
    if (saving) return false;
    setSaving(true);
    try { await action(); toast.success(message); await load(); return true; }
    catch (reason) { toast.error(errorText(reason)); return false; }
    finally { setSaving(false); }
  }

  function openNewProfile() {
    setEditingProfileId(null); setProfileName(''); setProfileDescription(''); setProfilePermissions([]); setProfileActive(true); setProfileFormOpen(true);
  }
  function openEditProfile(item: OrganizationalAccessProfile) {
    setEditingProfileId(item.id); setProfileName(item.name); setProfileDescription(item.description ?? ''); setProfilePermissions(item.permissions); setProfileActive(item.active); setProfileFormOpen(true);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); if (!token) return;
    const description = profileDescription.trim() || null;
    const ok = editingProfileId
      ? await act(() => updateCompanyProfile(token, editingProfileId, { name: profileName, description, permissions: profilePermissions, active: profileActive }), 'Perfil de acesso atualizado.')
      : await act(() => createCompanyProfile(token, companyId, { name: profileName, description, permissions: profilePermissions }), 'Perfil de acesso criado.');
    if (ok) setProfileFormOpen(false);
  }

  async function applyTemplate(template: OrganizationalAccessProfile) {
    if (!token) return;
    await act(() => createAccessProfileFromTemplate(token, companyId, template.id), `Pacote “${template.name}” copiado para os perfis de acesso da empresa. Você pode ajustá-lo quando quiser.`);
  }

  async function assign(event: FormEvent) {
    event.preventDefault(); if (!token) return;
    const ok = await act(
      () => assignEmploymentAccessScope(token, assignEmploymentId, { profile_id: assignProfileId, unit_id: assignUnitId || null, area_id: assignAreaId || null }),
      'Acesso concedido ao colaborador.',
    );
    if (ok) { setAssignUnitId(''); setAssignAreaId(''); }
  }

  async function revoke(item: AccessAssignment) {
    if (!token) return;
    const ok = await confirm({
      title: 'Remover perfil de acesso?',
      description: `${item.person_name} deixará de ter o perfil de acesso “${item.profile_name}”${item.area_name ? ` (área ${item.area_name})` : item.unit_name ? ` (unidade ${item.unit_name})` : ''}.`,
      confirmLabel: 'Remover',
      tone: 'danger',
    });
    if (ok) await act(() => revokeAccessAssignment(token, item.id), 'Perfil de acesso removido do colaborador.');
  }

  async function sendRequest(event: FormEvent) {
    event.preventDefault(); if (!token) return;
    const ok = await act(
      () => requestCustomCapability(token, companyId, { capability_key: requestKey.trim(), label: requestLabel.trim(), reason: requestReason.trim() || null }),
      'Solicitação enviada ao Administrador Geral da Turi. A resposta aparece no histórico.',
    );
    if (ok) { setRequestLabel(''); setRequestKey(''); setRequestReason(''); }
  }

  async function decide(item: CompanyCustomCapability, decision: 'approve' | 'reject', note: string): Promise<boolean> {
    if (!token) return false;
    return act(() => decideCapabilityRequest(token, item.id, decision, note), decision === 'approve' ? 'Permissão aprovada.' : 'Solicitação recusada.');
  }

  if (!companyId) return <EmptyState title="Selecione uma empresa" description="Escolha uma empresa para ver os acessos dela." />;
  if (loading) return <LoadingState variant="rows" rows={4} label="Carregando acessos..." />;
  if (loadError) return <ErrorState message={loadError} onRetry={reload} />;

  return (
    <div className="acc-page-stack">
      <AccessGlossary />

      <div className="stats-grid stats-grid--three">
        <StatCard label="Perfis de acesso" value={profiles.length} meta={`${activeProfiles.length} ativo(s)`} icon={<KeyRound size={18} />} />
        <StatCard label="Colaboradores com acesso" value={peopleWithAccess} meta={`${assignments.length} perfil(is) concedido(s)`} icon={<UserCheck size={18} />} />
        <StatCard label="Solicitações pendentes" value={pendingCount} meta={`${requests.length} no histórico`} icon={<Clock3 size={18} />} />
      </div>

      <div className="organization-toolbar organization-toolbar--tabs-only">
        <div className="organization-tabs" role="tablist" aria-label="Seções de acessos">
          {tabs.map((item) => (
            <button type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)} key={item.id}>{item.label}</button>
          ))}
        </div>
      </div>

      {tab === 'profiles' ? (
        <>
          <SectionPanel title="Pacotes de acesso da Turi" eyebrow="Comece por aqui" action={<TermLabel term="package" />}>
            <p className="panel-intro">Modelos prontos para os casos mais comuns. Ao usar um pacote, uma cópia entra nos perfis de acesso da empresa e pode ser ajustada: mudanças futuras no pacote não alteram a cópia.</p>
            <TemplateGallery templates={templates.filter((item) => item.active)} catalog={pickerCatalog} existingProfiles={profiles} onUse={(template) => void applyTemplate(template)} saving={saving} />
          </SectionPanel>

          <SectionPanel title="Perfis de acesso da empresa" eyebrow={`${profiles.length}`} action={<TermLabel term="profile" />}>
            <SectionHeader
              title="Perfis criados nesta empresa"
              description="Cada perfil de acesso é um conjunto de permissões que pode ser dado a colaboradores."
              actions={<button type="button" className="primary-button" onClick={openNewProfile}><Plus size={16} />Novo perfil de acesso</button>}
            />
            {profiles.length ? (
              <div className="acc-grid">
                {profiles.map((item) => (
                  <AccessCard
                    key={item.id}
                    icon={<KeyRound size={18} />}
                    title={item.name}
                    description={item.description}
                    emptyDescription="Sem descrição. Edite o perfil de acesso para explicar o que ele libera."
                    catalog={pickerCatalog}
                    permissions={item.permissions}
                    badge={<StatusPill status={item.active ? 'active' : 'inactive'} />}
                    muted={!item.active}
                    actions={<button type="button" className="secondary-button acc-btn-sm" onClick={() => openEditProfile(item)}><Pencil size={13} />Editar</button>}
                  />
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhum perfil de acesso ainda" description="Use um pacote da Turi acima ou crie um perfil de acesso do zero." />
            )}
          </SectionPanel>
        </>
      ) : null}

      {tab === 'people' ? (
        <div className="content-grid">
          <SectionPanel title="Dar acesso a colaborador" eyebrow="Atribuição">
            {!employments.length ? (
              <EmptyState title="Nenhum colaborador cadastrado" description="Cadastre os colaboradores e seus vínculos na estrutura da empresa antes de dar acessos." />
            ) : !activeProfiles.length ? (
              <EmptyState title="Nenhum perfil de acesso ativo" description="Crie um perfil de acesso ou use um pacote da Turi na aba “Perfis de acesso”." />
            ) : (
              <form className="admin-form" onSubmit={assign}>
                <label><span>Colaborador (cargo · área · unidade)</span><select value={assignEmploymentId} onChange={(e) => setAssignEmploymentId(e.target.value)} required>{employments.map((item) => <option value={item.id} key={item.id}>{employmentLabel(item)}</option>)}</select></label>
                <label>
                  <span>Perfil de acesso</span>
                  <select value={assignProfileId} onChange={(e) => setAssignProfileId(e.target.value)} required>
                    {activeProfiles.map((item) => <option value={item.id} key={item.id}>{item.name}{packageNames.has(item.name.trim().toLowerCase()) ? ' (do pacote da Turi)' : ''} · {item.permissions.length} perm.</option>)}
                  </select>
                </label>
                <div className="field-grid">
                  <label><span>Limitar a uma unidade</span><select value={assignUnitId} onChange={(e) => { setAssignUnitId(e.target.value); if (e.target.value) setAssignAreaId(''); }} disabled={Boolean(assignAreaId)}><option value="">Empresa inteira</option>{structure.units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                  <label><span>Limitar a uma área</span><select value={assignAreaId} onChange={(e) => { setAssignAreaId(e.target.value); if (e.target.value) setAssignUnitId(''); }} disabled={Boolean(assignUnitId)}><option value="">Empresa inteira</option>{structure.areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                </div>
                <p className="admin-form__hint">Uma unidade inclui as sub-unidades e as áreas dentro dela. Uma área vale só para ela mesma.</p>
                <button className="primary-button" disabled={saving || !assignEmploymentId || !assignProfileId}><ShieldCheck size={16} />Dar acesso</button>
              </form>
            )}
          </SectionPanel>
          <SectionPanel title="Quem tem acesso" eyebrow={`${assignments.length} perfil(is) concedido(s)`}>
            <AssignmentTable assignments={assignments} packageNames={packageNames} onRevoke={(item) => void revoke(item)} saving={saving} />
          </SectionPanel>
        </div>
      ) : null}

      {tab === 'requests' ? (
        <div className="content-grid">
          {mode === 'company' ? (
            <SectionPanel title="Solicitar nova permissão" eyebrow="Fora do catálogo" action={<TermLabel term="request" />}>
              <ol className="request-flow">
                <li><strong>Você pede</strong><span>Descreva a permissão que falta e por que a empresa precisa dela.</span></li>
                <li><strong>A Turi decide</strong><span>O Administrador Geral da Turi aprova ou recusa. Você vê a resposta no histórico.</span></li>
                <li><strong>Se aprovada</strong><span>A permissão pode ser marcada nos perfis de acesso da empresa. Hoje nenhuma funcionalidade da plataforma verifica permissões criadas assim: a aprovação apenas as torna selecionáveis.</span></li>
              </ol>
              <form className="admin-form" onSubmit={sendRequest}>
                <label><span>Nome da permissão</span><input value={requestLabel} onChange={(e) => { setRequestLabel(e.target.value); setRequestKey(slugifyPermissionKey(e.target.value)); }} placeholder="Ex.: Aprovar pagamentos" required /></label>
                <label><span>Código (gerado automaticamente)</span><input value={requestKey} onChange={(e) => setRequestKey(e.target.value)} placeholder="aprovar_pagamentos" required /></label>
                <label><span>Por que sua empresa precisa? (opcional)</span><textarea rows={3} value={requestReason} onChange={(e) => setRequestReason(e.target.value)} /></label>
                <button className="primary-button" disabled={saving}><Send size={16} />Solicitar nova permissão</button>
              </form>
            </SectionPanel>
          ) : null}
          <SectionPanel
            title="Histórico de solicitações"
            eyebrow={`${requests.length}`}
            action={mode === 'admin' ? <Link className="secondary-button acc-btn-sm" to={`/platform-admin/requests?company=${companyId}`}><ExternalLink size={13} />Central de solicitações</Link> : undefined}
          >
            <RequestTable
              items={requests}
              onOpen={(item) => setOpenRequestId(item.id)}
              emptyDescription={mode === 'company' ? 'Suas solicitações e as respostas da Turi aparecem aqui.' : 'Quando esta empresa pedir uma nova permissão, ela aparece aqui.'}
            />
          </SectionPanel>
        </div>
      ) : null}

      <Drawer
        open={profileFormOpen}
        onClose={() => setProfileFormOpen(false)}
        size="lg"
        title={editingProfileId ? 'Editar perfil de acesso' : 'Novo perfil de acesso'}
        description="Conjunto de permissões que pode ser dado a colaboradores"
        footer={(
          <div className="acc-footer-actions">
            <button type="button" className="secondary-button" onClick={() => setProfileFormOpen(false)}>Cancelar</button>
            <button type="submit" form="company-profile-form" className="primary-button" disabled={saving || !profileName.trim()}>{saving ? 'Salvando...' : editingProfileId ? 'Salvar perfil de acesso' : 'Criar perfil de acesso'}</button>
          </div>
        )}
      >
        <form id="company-profile-form" className="admin-form" onSubmit={saveProfile}>
          <label><span>Nome do perfil de acesso</span><input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Ex.: Coordenação de RH" required /></label>
          <label><span>Descrição (opcional)</span><textarea rows={2} maxLength={400} value={profileDescription} onChange={(e) => setProfileDescription(e.target.value)} placeholder="Para quem é e o que libera." /></label>
          <div>
            <span className="admin-form__hint">Permissões do perfil de acesso</span>
            <PermissionPicker catalog={pickerCatalog} selected={profilePermissions} onChange={setProfilePermissions} />
          </div>
          {editingProfileId ? (
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={profileActive} onChange={(e) => setProfileActive(e.target.checked)} />
              <span>Perfil ativo. Desativar suspende o acesso de todos que o têm, sem apagar nada.</span>
            </label>
          ) : null}
        </form>
      </Drawer>

      <RequestDrawer item={openRequest} onClose={() => setOpenRequestId(null)} onDecide={mode === 'admin' ? decide : undefined} saving={saving} />
    </div>
  );
}
