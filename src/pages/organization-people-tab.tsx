import { BriefcaseBusiness, ChevronRight, Network, Pencil, UserMinus, UserPlus, Users } from 'lucide-react';
import { type FormEvent, Fragment, useEffect, useMemo, useState } from 'react';

import { apiErrorMessage, endEmployment, updateEmployment, updatePerson } from '../api/organization';
import { assignEmploymentAccessScope, createEmployment, createPerson, getOrganizationalAccessProfiles } from '../api/services';
import type { Employment, OrganizationalAccessProfile, OrganizationalStructure, Person } from '../api/types';
import { ApiError } from '../api/client';
import { EmptyState } from '../components/empty-state';
import { InfoTooltip } from '../components/info-tooltip';
import { StatusPill } from '../components/status-pill';
import { useToast } from '../components/toast';
import { DataTable, type DataTableColumn, Drawer, FilterBar, SearchInput, SegmentedFilter, useConfirm } from '../components/ui';
import { CONCEPT_HELP } from './organization-structure-tab';

/** Mostra a alocação como Unidade › Área › Cargo, omitindo o que não existe. */
export function HierarchyPath({ unit, area, position, empty = 'Sem alocação' }: { unit?: string | null; area?: string | null; position?: string | null; empty?: string }) {
  const parts = [
    { kind: 'unit', label: unit, Icon: Network }, { kind: 'area', label: area, Icon: Users }, { kind: 'position', label: position, Icon: BriefcaseBusiness },
  ].filter((part) => part.label);
  if (!parts.length) return <span className="org-path org-path--empty">{empty}</span>;
  return (
    <span className="org-path">
      {parts.map(({ kind, label, Icon }, index) => (
        <Fragment key={kind}>
          {index > 0 ? <ChevronRight size={12} aria-hidden className="org-path__sep" /> : null}
          <span className={`org-path__part org-path__part--${kind}`}><Icon size={12} aria-hidden />{label}</span>
        </Fragment>
      ))}
    </span>
  );
}

function initials(name: string | null) { return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?'; }
function formatDate(value: string | null) { if (!value) return '—'; const [year, month, day] = value.slice(0, 10).split('-'); return year && month && day ? `${day}/${month}/${year}` : value; }

type Row = { key: string; person: Person; employment: Employment | null };
type DrawerState = { mode: 'create' } | { mode: 'edit'; row: Row } | null;
type StatusFilter = 'active' | 'ended' | 'unlinked' | 'all';

type PeopleTabProps = {
  token: string;
  companyId: string;
  structure: OrganizationalStructure;
  people: Person[];
  employments: Employment[];
  loading: boolean;
  onReload: () => Promise<void>;
  onGoToStructure: () => void;
  canManage?: boolean;
};

export function PeopleTab({ token, companyId, structure, people, employments, loading, onReload, onGoToStructure, canManage = true }: PeopleTabProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [query, setQuery] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    const byPerson = new Map(people.map((person) => [person.id, person]));
    const linked = employments.flatMap((employment) => { const person = byPerson.get(employment.person_id); return person ? [{ key: employment.id, person, employment }] : []; });
    const linkedIds = new Set(employments.map((item) => item.person_id));
    const unlinked = people.filter((person) => !linkedIds.has(person.id)).map((person) => ({ key: `p-${person.id}`, person, employment: null }));
    return [...linked, ...unlinked];
  }, [people, employments]);

  const counts = useMemo(() => ({
    active: rows.filter((row) => row.employment?.status === 'active').length,
    ended: rows.filter((row) => row.employment && row.employment.status !== 'active').length,
    unlinked: rows.filter((row) => !row.employment).length,
    all: rows.length,
  }), [rows]);

  const areaOptions = structure.areas.filter((area) => !unitFilter || area.unit_id === unitFilter);
  const needle = query.trim().toLowerCase();
  const visible = rows.filter(({ person, employment }) => {
    if (status === 'active' && employment?.status !== 'active') return false;
    if (status === 'ended' && (!employment || employment.status === 'active')) return false;
    if (status === 'unlinked' && employment) return false;
    if (unitFilter && employment?.unit_id !== unitFilter) return false;
    if (areaFilter && employment?.area_id !== areaFilter) return false;
    return !needle || [person.name, person.email, employment?.unit_name, employment?.area_name, employment?.position_name].some((value) => value?.toLowerCase().includes(needle));
  });

  async function end(row: Row) {
    if (!row.employment) return;
    const ok = await confirm({
      title: `Encerrar o vínculo de ${row.person.name}?`,
      description: 'O vínculo passa a constar como encerrado hoje e o colaborador deixa de ter acessos por ele. O histórico é mantido.',
      confirmLabel: 'Encerrar vínculo', tone: 'danger',
    });
    if (!ok) return;
    setBusyId(row.key);
    try { await endEmployment(token, row.employment.id); toast.success('Vínculo encerrado.'); await onReload(); }
    catch (reason) { toast.error(apiErrorMessage(reason)); }
    finally { setBusyId(null); }
  }

  const emptyMessage = !rows.length ? (
    <div className="org-empty-action">
      <EmptyState icon={Users} title="Nenhum colaborador ainda" description={canManage ? 'Cadastre o primeiro colaborador: nome, onde ele atua e, se quiser, o acesso, tudo em uma tela.' : 'Nenhum colaborador dentro do que você pode ver.'} />
      {canManage ? <button type="button" className="primary-button" onClick={() => setDrawer({ mode: 'create' })}><UserPlus size={16} />Novo colaborador</button> : null}
    </div>
  ) : (
    <EmptyState icon={Users} title="Nenhum colaborador encontrado" description="Ajuste a busca ou os filtros para ver outros colaboradores." />
  );

  return (
    <div className="org-people">
      <FilterBar actions={canManage ? <button type="button" className="primary-button" onClick={() => setDrawer({ mode: 'create' })}><UserPlus size={16} />Novo colaborador</button> : undefined}>
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar por nome, e-mail, unidade, área ou cargo" label="Buscar colaborador" />
        <select className="org-filter-select" aria-label="Filtrar por unidade" value={unitFilter} onChange={(event) => { setUnitFilter(event.target.value); setAreaFilter(''); }}>
          <option value="">Todas as unidades</option>
          {structure.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select>
        <select className="org-filter-select" aria-label="Filtrar por área" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)} disabled={!areaOptions.length}>
          <option value="">Todas as áreas</option>
          {areaOptions.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
        </select>
        <SegmentedFilter<StatusFilter> label="Situação do vínculo" value={status} onChange={setStatus} options={[
          { value: 'active', label: 'Ativos', count: counts.active }, { value: 'ended', label: 'Encerrados', count: counts.ended },
          { value: 'unlinked', label: 'Sem vínculo', count: counts.unlinked }, { value: 'all', label: 'Todos', count: counts.all },
        ]} />
      </FilterBar>

      <DataTable<Row>
        caption="Colaboradores e vínculos"
        rows={visible}
        rowKey={(row) => row.key}
        loading={loading && !rows.length}
        empty={emptyMessage}
        onRowClick={canManage ? (row) => setDrawer({ mode: 'edit', row }) : undefined}
        columns={([
          { key: 'person', header: 'Colaborador', render: ({ person }) => (
            <span className="org-person-cell"><span className="org-avatar" aria-hidden>{initials(person.name)}</span><span className="org-person__copy"><strong>{person.name}</strong><span className="org-person__email">{person.email || 'Sem e-mail'}</span></span></span>
          ) },
          { key: 'placement', header: 'Unidade › Área › Cargo', render: ({ employment }) => <HierarchyPath unit={employment?.unit_name} area={employment?.area_name} position={employment?.position_name} empty={employment ? 'Sem alocação' : 'Sem vínculo'} /> },
          { key: 'start', header: 'Início', hideOnMobile: true, width: '110px', render: ({ employment }) => formatDate(employment?.started_at ?? null) },
          { key: 'status', header: 'Situação', width: '120px', render: ({ employment }) => employment ? <StatusPill status={employment.status} tone={employment.status === 'active' ? 'success' : 'muted'} /> : <StatusPill tone="warning">Sem vínculo</StatusPill> },
          { key: 'actions', header: 'Ações', width: '96px', align: 'right', render: (row) => (
            <span className="org-row-actions" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="org-icon-btn" aria-label={`Editar ${row.person.name}`} title="Editar" onClick={() => setDrawer({ mode: 'edit', row })}><Pencil size={14} aria-hidden /></button>
              {row.employment?.status === 'active' ? <button type="button" className="org-icon-btn" aria-label={`Encerrar vínculo de ${row.person.name}`} title="Encerrar vínculo" disabled={busyId === row.key} onClick={() => void end(row)}><UserMinus size={14} aria-hidden /></button> : null}
            </span>
          ) },
        ] satisfies DataTableColumn<Row>[]).filter((column) => canManage || column.key !== 'actions')}
      />

      {drawer ? (
        <ColaboradorDrawer
          key={drawer.mode === 'edit' ? drawer.row.key : 'new'}
          token={token} companyId={companyId} structure={structure}
          row={drawer.mode === 'edit' ? drawer.row : null}
          onClose={() => setDrawer(null)} onSaved={onReload} onGoToStructure={() => { setDrawer(null); onGoToStructure(); }}
        />
      ) : null}
    </div>
  );
}

type DrawerProps = {
  token: string;
  companyId: string;
  structure: OrganizationalStructure;
  row: Row | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onGoToStructure: () => void;
};

type ScopeMode = 'company' | 'unit' | 'area';

function ColaboradorDrawer({ token, companyId, structure, row, onClose, onSaved, onGoToStructure }: DrawerProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const editing = row !== null;
  const employment = row?.employment ?? null;
  const [name, setName] = useState(row?.person.name ?? '');
  const [email, setEmail] = useState(row?.person.email ?? '');
  const [phone, setPhone] = useState(row?.person.phone ?? '');
  const [unitId, setUnitId] = useState(employment?.unit_id ?? '');
  const [areaId, setAreaId] = useState(employment?.area_id ?? '');
  const [positionId, setPositionId] = useState(employment?.position_id ?? '');
  const [startedAt, setStartedAt] = useState(employment?.started_at?.slice(0, 10) ?? '');
  const [profileId, setProfileId] = useState('');
  const [scopeMode, setScopeMode] = useState<ScopeMode>('company');
  const [profiles, setProfiles] = useState<OrganizationalAccessProfile[] | null>(null);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createdPersonId, setCreatedPersonId] = useState<string | null>(null);
  const [createdEmploymentId, setCreatedEmploymentId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getOrganizationalAccessProfiles(token, companyId)
      .then((data) => { if (alive) setProfiles(data.filter((item) => item.active)); })
      .catch((reason) => { if (alive) { setProfiles([]); setProfilesError(reason instanceof ApiError && reason.status === 403 ? 'Você não tem permissão para dar acessos.' : 'Não foi possível carregar os perfis de acesso.'); } });
    return () => { alive = false; };
  }, [token, companyId]);

  const unitsById = useMemo(() => new Map(structure.units.map((item) => [item.id, item])), [structure.units]);
  const areasById = useMemo(() => new Map(structure.areas.map((item) => [item.id, item])), [structure.areas]);
  const positionsById = useMemo(() => new Map(structure.positions.map((item) => [item.id, item])), [structure.positions]);

  // Cada select só oferece o que é compatível com o nível acima já escolhido (e o que está ativo).
  const units = structure.units.filter((item) => item.active || item.id === unitId);
  const areaOptions = structure.areas.filter((area) => (area.active || area.id === areaId) && (!unitId || area.unit_id === unitId));
  const areaIdsOfUnit = new Set(areaOptions.map((area) => area.id));
  const positionOptions = structure.positions.filter((position) => (position.active || position.id === positionId) && (areaId ? position.area_id === areaId : unitId ? Boolean(position.area_id && areaIdsOfUnit.has(position.area_id)) : true));
  const derivedFromPosition = Boolean(positionId && positionsById.get(positionId)?.area_id);

  function pickUnit(next: string) {
    setUnitId(next);
    const area = areasById.get(areaId);
    if (!area || area.unit_id === next) return;
    setAreaId(''); setPositionId('');
  }
  function pickArea(next: string) {
    setAreaId(next);
    const area = areasById.get(next);
    if (area?.unit_id) setUnitId(area.unit_id);
    if (positionsById.get(positionId)?.area_id !== next) setPositionId('');
  }
  function pickPosition(next: string) {
    setPositionId(next);
    const position = positionsById.get(next);
    if (!position?.area_id) return;
    setAreaId(position.area_id);
    const area = areasById.get(position.area_id);
    if (area?.unit_id) setUnitId(area.unit_id);
  }

  const scopeUnitId = scopeMode === 'unit' ? unitId : '';
  const scopeAreaId = scopeMode === 'area' ? areaId : '';
  const scopeUnavailable = (scopeMode === 'unit' && !unitId) || (scopeMode === 'area' && !areaId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !name.trim() || scopeUnavailable) return;
    setSaving(true);
    let step = 'colaborador';
    try {
      const payload = { name: name.trim(), email: email.trim() || null, phone: phone.trim() || null };
      let personId = row?.person.id ?? createdPersonId;
      if (!personId) { const person = await createPerson(token, companyId, payload); personId = person.id; setCreatedPersonId(person.id); }
      else if (row && (payload.name !== row.person.name || payload.email !== row.person.email || payload.phone !== row.person.phone)) await updatePerson(token, personId, payload);

      step = 'vínculo';
      const draft = { unit_id: unitId || null, area_id: areaId || null, position_id: positionId || null, started_at: startedAt || null };
      let employmentId = employment?.id ?? createdEmploymentId;
      if (!employmentId) { const created = await createEmployment(token, personId, draft); employmentId = created.id; setCreatedEmploymentId(created.id); }
      else if (employment && (draft.unit_id !== employment.unit_id || draft.area_id !== employment.area_id || draft.position_id !== employment.position_id || draft.started_at !== (employment.started_at?.slice(0, 10) ?? null))) await updateEmployment(token, employmentId, draft);

      if (profileId) {
        step = 'acesso';
        await assignEmploymentAccessScope(token, employmentId, { profile_id: profileId, unit_id: scopeUnitId || null, area_id: scopeAreaId || null });
      }
      toast.success(editing ? 'Colaborador atualizado.' : profileId ? 'Colaborador cadastrado com acesso.' : 'Colaborador cadastrado.');
      await onSaved().catch(() => undefined);
      onClose();
    } catch (reason) {
      const message = apiErrorMessage(reason);
      toast.error(step === 'colaborador' ? message : `${step === 'acesso' ? 'Colaborador salvo, mas o acesso não foi concedido' : 'Colaborador salvo, mas o vínculo não foi salvo'}: ${message}`);
      if (step !== 'colaborador') await onSaved().catch(() => undefined);
    } finally { setSaving(false); }
  }

  async function endFromDrawer() {
    if (!employment || !row) return;
    const ok = await confirm({ title: `Encerrar o vínculo de ${row.person.name}?`, description: 'O vínculo passa a constar como encerrado hoje. O histórico é mantido.', confirmLabel: 'Encerrar vínculo', tone: 'danger' });
    if (!ok) return;
    setSaving(true);
    try { await endEmployment(token, employment.id); toast.success('Vínculo encerrado.'); await onSaved().catch(() => undefined); onClose(); }
    catch (reason) { toast.error(apiErrorMessage(reason)); }
    finally { setSaving(false); }
  }

  async function reactivate() {
    if (!employment) return;
    setSaving(true);
    try { await updateEmployment(token, employment.id, { status: 'active', ended_at: null }); toast.success('Vínculo reativado.'); await onSaved().catch(() => undefined); onClose(); }
    catch (reason) { toast.error(apiErrorMessage(reason)); }
    finally { setSaving(false); }
  }

  const ended = Boolean(employment && employment.status !== 'active');
  const title = editing ? row.person.name : 'Novo colaborador';
  const hasStructure = structure.units.length > 0;

  return (
    <Drawer
      open
      onClose={onClose}
      title={title}
      description={editing ? (employment ? 'Dados do colaborador, onde ele atua e o vínculo.' : 'Este colaborador ainda não tem vínculo. Escolha onde ele atua para criá-lo.') : 'Quem é, onde atua na empresa e, se quiser, o acesso inicial. Tudo em uma só tela.'}
      footer={<>
        {employment && !ended ? <button type="button" className="secondary-button org-danger-btn" onClick={() => void endFromDrawer()} disabled={saving}><UserMinus size={15} />Encerrar vínculo</button> : null}
        {ended ? <button type="button" className="secondary-button" onClick={() => void reactivate()} disabled={saving}>Reativar vínculo</button> : null}
        <span className="org-footer-spacer" />
        <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="submit" form="org-colaborador-form" className="primary-button" disabled={saving || !name.trim() || scopeUnavailable || ended}>{saving ? 'Salvando…' : editing ? 'Salvar' : 'Cadastrar colaborador'}</button>
      </>}
    >
      <form id="org-colaborador-form" className="org-drawer-form" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={saving}>
          <legend><span className="org-step">1</span>Quem é</legend>
          <label><span>Nome</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={255} autoFocus required /></label>
          <div className="field-grid">
            <label><span>E-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label><span>Telefone</span><input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          </div>
        </fieldset>

        <fieldset disabled={saving || ended}>
          <legend><span className="org-step">2</span>Onde atua</legend>
          {!hasStructure ? (
            <p className="org-hint">Ainda não há unidades. <button type="button" className="org-link" onClick={onGoToStructure}>Monte a estrutura</button> para alocar colaboradores. Você pode salvar sem alocação e alocar depois.</p>
          ) : (
            <>
              <label><span>Unidade<InfoTooltip text={CONCEPT_HELP.unit} label="O que é uma unidade" /></span>
                <select value={unitId} onChange={(event) => pickUnit(event.target.value)}>
                  <option value="">Sem unidade</option>
                  {units.map((item) => <option key={item.id} value={item.id}>{item.name}{item.active ? '' : ' (inativa)'}</option>)}
                </select>
              </label>
              <div className="field-grid">
                <label><span>Área<InfoTooltip text={CONCEPT_HELP.area} label="O que é uma área" /></span>
                  <select value={areaId} onChange={(event) => pickArea(event.target.value)} disabled={!areaOptions.length}>
                    <option value="">{areaOptions.length ? 'Sem área' : unitId ? 'Esta unidade não tem áreas' : 'Nenhuma área cadastrada'}</option>
                    {areaOptions.map((item) => { const unit = item.unit_id ? unitsById.get(item.unit_id) : null; return <option key={item.id} value={item.id}>{item.name}{!unitId && unit ? ` — ${unit.name}` : ''}</option>; })}
                  </select>
                </label>
                <label><span>Cargo<InfoTooltip text={CONCEPT_HELP.position} label="O que é um cargo" /></span>
                  <select value={positionId} onChange={(event) => pickPosition(event.target.value)} disabled={!positionOptions.length}>
                    <option value="">{positionOptions.length ? 'Sem cargo' : areaId ? 'Esta área não tem cargos' : 'Nenhum cargo disponível'}</option>
                    {positionOptions.map((item) => { const area = item.area_id ? areasById.get(item.area_id) : null; return <option key={item.id} value={item.id}>{item.name}{!areaId && area ? ` — ${area.name}` : ''}</option>; })}
                  </select>
                </label>
              </div>
              <div className="org-preview" aria-live="polite">
                <HierarchyPath unit={unitsById.get(unitId)?.name} area={areasById.get(areaId)?.name} position={positionsById.get(positionId)?.name} empty="Escolha onde o colaborador atua" />
                {derivedFromPosition ? <span className="org-hint">Área e unidade definidas pelo cargo.</span> : null}
              </div>
            </>
          )}
        </fieldset>

        <fieldset disabled={saving || ended}>
          <legend><span className="org-step">3</span>Vínculo</legend>
          <div className="field-grid">
            <label><span>Data de início</span><input type="date" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} /></label>
            <div className="org-readonly"><span>Situação</span>{employment ? <StatusPill status={employment.status} tone={employment.status === 'active' ? 'success' : 'muted'} /> : <StatusPill status="active" />}</div>
          </div>
          {ended ? <p className="org-hint">Vínculo encerrado em {formatDate(employment?.ended_at ?? null)}. Use “Reativar vínculo” para voltar a editá-lo.</p> : null}
        </fieldset>

        <fieldset disabled={saving || ended || !profiles?.length}>
          <legend><span className="org-step">4</span>Acesso <em>(opcional)</em><InfoTooltip text="Atribui um perfil de acesso ao vínculo agora. Você pode fazer isso depois na aba “Acessos”." label="Sobre o acesso" /></legend>
          {profiles === null ? <p className="org-hint" role="status">Carregando perfis…</p> : null}
          {profilesError ? <p className="org-hint">{profilesError}</p> : null}
          {profiles && !profilesError && !profiles.length ? <p className="org-hint">Nenhum perfil de acesso ativo nesta empresa. Crie um na aba “Acessos” para poder atribuí-lo aqui.</p> : null}
          {profiles?.length ? (
            <>
              <label><span>Perfil de acesso</span>
                <select value={profileId} onChange={(event) => setProfileId(event.target.value)}>
                  <option value="">Sem acesso por enquanto</option>
                  {profiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              {profileId ? (
                <label><span>Abrangência</span>
                  <select value={scopeMode} onChange={(event) => setScopeMode(event.target.value as ScopeMode)}>
                    <option value="company">Empresa inteira</option>
                    <option value="unit" disabled={!unitId}>Somente a unidade escolhida{!unitId ? ' (escolha uma unidade)' : ''}</option>
                    <option value="area" disabled={!areaId}>Somente a área escolhida{!areaId ? ' (escolha uma área)' : ''}</option>
                  </select>
                </label>
              ) : null}
            </>
          ) : null}
        </fieldset>
      </form>
    </Drawer>
  );
}
