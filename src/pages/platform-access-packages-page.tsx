import { PackagePlus, Pencil, ShieldCheck } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { createPackage, updatePackage } from '../api/access';
import { ApiError } from '../api/client';
import { getGlobalAccessProfiles, getPermissionCatalog } from '../api/services';
import type { OrganizationalAccessProfile, PermissionCatalogEntry } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { AccessCard, AccessGlossary, PermissionPicker, TermLabel, countLabel } from '../components/access-ui';
import { platformAdminNavigation } from '../components/admin-navigation';
import { AppShell } from '../components/app-shell';
import { EmptyState } from '../components/empty-state';
import { StatusPill } from '../components/status-pill';
import { useToast } from '../components/toast';
import { Drawer, ErrorState, FilterBar, LoadingState, SearchInput, SectionHeader, SegmentedFilter } from '../components/ui';
import './access-admin.css';

type Visibility = 'all' | 'active' | 'inactive';

function errorText(error: unknown) { return error instanceof ApiError ? error.message : 'Não foi possível concluir a operação.'; }

export function PlatformAccessPackagesPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [packages, setPackages] = useState<OrganizationalAccessProfile[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [active, setActive] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    const [nextPackages, nextCatalog] = await Promise.all([getGlobalAccessProfiles(token), getPermissionCatalog(token)]);
    setPackages(nextPackages);
    setCatalog(nextCatalog);
  }, [token]);

  const reload = useCallback(() => {
    setLoading(true);
    load().then(() => setLoadError(null)).catch((reason) => setLoadError(errorText(reason))).finally(() => setLoading(false));
  }, [load]);

  useEffect(() => { reload(); }, [reload]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return packages.filter((item) => {
      if (visibility === 'active' && !item.active) return false;
      if (visibility === 'inactive' && item.active) return false;
      return !needle || `${item.name} ${item.description ?? ''}`.toLowerCase().includes(needle);
    });
  }, [packages, query, visibility]);

  function openNew() {
    setEditingId(null); setName(''); setDescription(''); setPermissions([]); setActive(true); setFormOpen(true);
  }
  function openEdit(item: OrganizationalAccessProfile) {
    setEditingId(item.id); setName(item.name); setDescription(item.description ?? ''); setPermissions(item.permissions); setActive(item.active); setFormOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!token || saving) return;
    setSaving(true);
    try {
      if (editingId) {
        await updatePackage(token, editingId, { name, description: description.trim() || null, permissions, active });
        toast.success('Pacote de acesso atualizado. Perfis de acesso já criados a partir dele não mudam.');
      } else {
        await createPackage(token, { name, description: description.trim() || null, permissions });
        toast.success('Pacote de acesso criado e disponível para as empresas.');
      }
      setFormOpen(false);
      await load();
    } catch (reason) {
      toast.error(errorText(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      eyebrow="Administração geral"
      title="Pacotes de acesso"
      description="Modelos prontos de perfil de acesso que as empresas podem copiar e ajustar."
      navigation={platformAdminNavigation}
    >
      <div className="acc-page-stack">
        <AccessGlossary terms={['permission', 'package', 'profile']} />

        <SectionHeader
          title="Pacotes da Turi"
          count={packages.length}
          info="Editar um pacote muda só o modelo: as empresas que já copiaram o pacote mantêm o perfil de acesso como está."
          description="Pacotes valem para todas as empresas. Só permissões do catálogo padrão podem entrar."
          actions={<button type="button" className="primary-button" onClick={openNew} disabled={loading || Boolean(loadError)}><PackagePlus size={16} />Novo pacote</button>}
        />

        <FilterBar>
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar pacote..." label="Buscar pacote" />
          <SegmentedFilter
            label="Situação do pacote"
            value={visibility}
            onChange={setVisibility}
            options={[
              { value: 'all', label: 'Todos', count: packages.length },
              { value: 'active', label: 'Ativos', count: packages.filter((item) => item.active).length },
              { value: 'inactive', label: 'Inativos', count: packages.filter((item) => !item.active).length },
            ]}
          />
        </FilterBar>

        {loading ? <LoadingState variant="rows" rows={3} label="Carregando pacotes..." /> : loadError ? (
          <ErrorState message={loadError} onRetry={reload} />
        ) : visible.length ? (
          <div className="acc-grid">
            {visible.map((item) => (
              <AccessCard
                key={item.id}
                icon={<ShieldCheck size={18} />}
                title={item.name}
                description={item.description}
                emptyDescription="Sem objetivo descrito. Edite o pacote para explicar quando usá-lo."
                catalog={catalog}
                permissions={item.permissions}
                badge={<StatusPill status={item.active ? 'active' : 'inactive'} />}
                muted={!item.active}
                actions={<button type="button" className="secondary-button acc-btn-sm" onClick={() => openEdit(item)}><Pencil size={13} />Editar</button>}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title={packages.length ? 'Nenhum pacote encontrado' : 'Nenhum pacote ainda'}
            description={packages.length ? 'Ajuste a busca ou o filtro de situação.' : 'Crie o primeiro pacote de acesso para as empresas usarem.'}
          />
        )}
      </div>

      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        size="lg"
        title={editingId ? 'Editar pacote de acesso' : 'Novo pacote de acesso'}
        description="Modelo da Turi para todas as empresas"
        footer={(
          <div className="acc-footer-actions">
            <button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancelar</button>
            <button type="submit" form="access-package-form" className="primary-button" disabled={saving || !name.trim()}>{saving ? 'Salvando...' : editingId ? 'Salvar pacote' : 'Criar pacote'}</button>
          </div>
        )}
      >
        <form id="access-package-form" className="admin-form" onSubmit={save}>
          <label><span>Nome do pacote</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: RH / Gestão de Pessoas" required /></label>
          <label><span>Objetivo (para que serve)</span><textarea rows={3} maxLength={400} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explique em uma frase quando a empresa deve usar este pacote." /></label>
          <div>
            <span className="admin-form__hint"><TermLabel term="permission">Permissões</TermLabel> incluídas · {countLabel(permissions.length)}</span>
            <PermissionPicker catalog={catalog} selected={permissions} onChange={setPermissions} />
          </div>
          {editingId ? (
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              <span>Pacote ativo (inativos deixam de aparecer para as empresas)</span>
            </label>
          ) : null}
        </form>
      </Drawer>
    </AppShell>
  );
}
