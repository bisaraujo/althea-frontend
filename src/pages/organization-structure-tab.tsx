import { AlertTriangle, BriefcaseBusiness, Building2, ChevronDown, ChevronRight, Network, Pencil, Plus, Power, Users } from 'lucide-react';
import { type FormEvent, type ReactNode, useMemo, useRef, useState } from 'react';

import {
  apiErrorMessage, moveOrganizationalArea, moveOrganizationalPosition,
  updateOrganizationalArea, updateOrganizationalPosition, updateOrganizationalUnit,
} from '../api/organization';
import { createOrganizationalArea, createOrganizationalPosition, createOrganizationalUnit } from '../api/services';
import type { Company, Employment, OrganizationalArea, OrganizationalPosition, OrganizationalStructure, OrganizationalUnit } from '../api/types';
import { EmptyState } from '../components/empty-state';
import { InfoTooltip } from '../components/info-tooltip';
import { SectionPanel } from '../components/section-panel';
import { useToast } from '../components/toast';
import { LoadingState, Modal, useConfirm } from '../components/ui';

export type StructureKind = 'unit' | 'area' | 'position';

export const CONCEPT_HELP = {
  company: 'A empresa cliente. Tudo abaixo dela é isolado: unidades, áreas, cargos e colaboradores de uma empresa nunca aparecem em outra.',
  unit: 'Filial, estabelecimento, operação ou agrupamento principal da empresa (matriz, filial São Paulo, diretoria). Uma unidade pode ter subunidades.',
  area: 'Departamento ou setor que pertence a uma unidade (Financeiro, RH, Operações). O mesmo nome pode existir em unidades diferentes.',
  position: 'Função exercida por um colaborador dentro de uma área (Analista Financeiro). Ao vincular um colaborador a um cargo, a área e a unidade são preenchidas automaticamente.',
} as const;

const KIND_LABEL: Record<StructureKind, string> = { unit: 'unidade', area: 'área', position: 'cargo' };

type Adding = { kind: StructureKind; parentId: string | null } | null;
type Target = { kind: StructureKind; id: string; name: string; active: boolean };

type StructureTabProps = {
  token: string;
  companyId: string;
  company: Company | undefined;
  structure: OrganizationalStructure;
  employments: Employment[];
  loading: boolean;
  onReload: () => Promise<void>;
};

function plural(count: number, one: string, many: string) { return `${count} ${count === 1 ? one : many}`; }

function InlineAdd({ label, placeholder, saving, onSubmit, onCancel }: { label: string; placeholder: string; saving: boolean; onSubmit: (name: string) => Promise<boolean>; onCancel: () => void }) {
  const [name, setName] = useState('');
  const input = useRef<HTMLInputElement>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    if (await onSubmit(name.trim())) { setName(''); input.current?.focus(); }
  }
  return (
    <form className="org-inline-add" onSubmit={(event) => void submit(event)} onKeyDown={(event) => { if (event.key === 'Escape') onCancel(); }}>
      <input ref={input} autoFocus aria-label={label} placeholder={placeholder} value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
      <button type="submit" className="primary-button" disabled={saving || !name.trim()}>Adicionar</button>
      <button type="button" className="secondary-button" onClick={onCancel}>Fechar</button>
    </form>
  );
}

function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="org-action" onClick={onClick}><Plus size={13} aria-hidden />{children}</button>;
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return <button type="button" className="org-icon-btn" aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function StructureTab({ token, companyId, company, structure, employments, loading, onReload }: StructureTabProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [adding, setAdding] = useState<Adding>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Target | null>(null);
  const [editName, setEditName] = useState('');

  async function run(action: () => Promise<unknown>, message: string): Promise<boolean> {
    if (saving) return false;
    setSaving(true);
    try { await action(); } catch (reason) { toast.error(apiErrorMessage(reason)); setSaving(false); return false; }
    toast.success(message);
    try { await onReload(); } catch (reason) { toast.error(apiErrorMessage(reason)); }
    setSaving(false);
    return true;
  }

  function create(kind: StructureKind, name: string, parentId: string | null) {
    if (kind === 'unit') return run(() => createOrganizationalUnit(token, companyId, { name, unit_type: 'unit', parent_id: parentId }), parentId ? 'Subunidade criada.' : 'Unidade criada.');
    if (kind === 'area') return run(() => createOrganizationalArea(token, companyId, { name, unit_id: parentId }), 'Área criada.');
    return run(() => createOrganizationalPosition(token, companyId, { name, area_id: parentId }), 'Cargo criado.');
  }

  function patch(target: Target, changes: { name?: string; active?: boolean }, message: string) {
    const call = target.kind === 'unit' ? updateOrganizationalUnit : target.kind === 'area' ? updateOrganizationalArea : updateOrganizationalPosition;
    return run(() => call(token, target.id, changes), message);
  }

  function startEdit(target: Target) { setEditing(target); setEditName(target.name); }
  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const name = editName.trim();
    if (!name || name === editing.name) { setEditing(null); return; }
    if (await patch(editing, { name }, 'Nome atualizado.')) setEditing(null);
  }

  async function toggleActive(target: Target) {
    if (target.active) {
      const ok = await confirm({
        title: `Desativar ${KIND_LABEL[target.kind]} “${target.name}”?`,
        description: 'Ela deixa de aparecer nas escolhas de novos vínculos e cadastros. Só é possível desativar quando não há colaboradores ativos nem itens ativos dentro dela. Você pode reativar depois.',
        confirmLabel: 'Desativar', tone: 'danger',
      });
      if (!ok) return;
      await patch(target, { active: false }, 'Desativado.');
    } else {
      await patch(target, { active: true }, 'Reativado.');
    }
  }

  const model = useMemo(() => {
    const unitIds = new Set(structure.units.map((item) => item.id));
    const areaIds = new Set(structure.areas.map((item) => item.id));
    const childUnits = new Map<string | null, OrganizationalUnit[]>();
    structure.units.forEach((unit) => {
      const key = unit.parent_id && unitIds.has(unit.parent_id) && unit.parent_id !== unit.id ? unit.parent_id : null;
      childUnits.set(key, [...(childUnits.get(key) || []), unit]);
    });
    const areasByUnit = new Map<string, OrganizationalArea[]>();
    const legacyAreas: OrganizationalArea[] = [];
    structure.areas.forEach((area) => {
      if (area.unit_id && unitIds.has(area.unit_id)) areasByUnit.set(area.unit_id, [...(areasByUnit.get(area.unit_id) || []), area]);
      else legacyAreas.push(area);
    });
    const positionsByArea = new Map<string, OrganizationalPosition[]>();
    const legacyPositions: OrganizationalPosition[] = [];
    structure.positions.forEach((position) => {
      if (position.area_id && areaIds.has(position.area_id)) positionsByArea.set(position.area_id, [...(positionsByArea.get(position.area_id) || []), position]);
      else legacyPositions.push(position);
    });
    const active = employments.filter((item) => item.status === 'active');
    const countBy = (pick: (item: Employment) => string | null) => {
      const counts = new Map<string, number>();
      active.forEach((item) => { const key = pick(item); if (key) counts.set(key, (counts.get(key) || 0) + 1); });
      return counts;
    };
    return { childUnits, areasByUnit, legacyAreas, positionsByArea, legacyPositions, peopleByUnit: countBy((i) => i.unit_id), peopleByArea: countBy((i) => i.area_id), peopleByPosition: countBy((i) => i.position_id) };
  }, [structure, employments]);

  const inactiveCount = structure.units.filter((i) => !i.active).length + structure.areas.filter((i) => !i.active).length + structure.positions.filter((i) => !i.active).length;
  const visible = <T extends { active: boolean }>(items: T[]) => (showInactive ? items : items.filter((item) => item.active));

  function subtreeUnitIds(unitId: string, seen = new Set<string>()): Set<string> {
    if (seen.has(unitId)) return seen;
    seen.add(unitId);
    (model.childUnits.get(unitId) || []).forEach((child) => subtreeUnitIds(child.id, seen));
    return seen;
  }

  function unitStats(unitId: string) {
    const ids = subtreeUnitIds(unitId);
    let areas = 0; let positions = 0; let people = 0;
    ids.forEach((id) => {
      const list = (model.areasByUnit.get(id) || []).filter((area) => area.active);
      areas += list.length;
      list.forEach((area) => { positions += (model.positionsByArea.get(area.id) || []).filter((position) => position.active).length; });
      people += model.peopleByUnit.get(id) || 0;
    });
    return { areas, positions, people };
  }

  function isAdding(kind: StructureKind, parentId: string | null) { return adding?.kind === kind && adding.parentId === parentId; }

  function toggle(unitId: string) {
    setCollapsed((current) => { const next = new Set(current); if (next.has(unitId)) next.delete(unitId); else next.add(unitId); return next; });
  }

  function unitPath(unit: OrganizationalUnit): string {
    const names: string[] = []; const seen = new Set<string>(); let cursor: OrganizationalUnit | undefined = unit;
    while (cursor && !seen.has(cursor.id)) { names.unshift(cursor.name); seen.add(cursor.id); cursor = cursor.parent_id ? structure.units.find((item) => item.id === cursor?.parent_id) : undefined; }
    return names.join(' › ');
  }

  function itemActions(kind: StructureKind, item: { id: string; name: string; active: boolean }) {
    const target: Target = { kind, id: item.id, name: item.name, active: item.active };
    return (
      <>
        <IconButton label={`Renomear ${KIND_LABEL[kind]} ${item.name}`} onClick={() => startEdit(target)} disabled={saving}><Pencil size={14} aria-hidden /></IconButton>
        <IconButton label={`${item.active ? 'Desativar' : 'Reativar'} ${KIND_LABEL[kind]} ${item.name}`} onClick={() => void toggleActive(target)} disabled={saving}><Power size={14} aria-hidden /></IconButton>
      </>
    );
  }

  function renderArea(area: OrganizationalArea, extra?: ReactNode) {
    const positions = visible(model.positionsByArea.get(area.id) || []);
    const people = model.peopleByArea.get(area.id) || 0;
    return (
      <div className={`org-area${area.active ? '' : ' is-inactive'}`} key={area.id}>
        <div className="org-area__head">
          <Users size={15} aria-hidden />
          <strong>{area.name}</strong>
          {!area.active ? <span className="org-tag">inativa</span> : null}
          <span className="org-meta">{plural(people, 'colaborador', 'colaboradores')}</span>
          <div className="org-area__actions">{extra}{area.active ? <AddButton onClick={() => setAdding({ kind: 'position', parentId: area.id })}>Cargo</AddButton> : null}{itemActions('area', area)}</div>
        </div>
        <div className="org-positions">
          {positions.map((position) => {
            const count = model.peopleByPosition.get(position.id) || 0;
            return (
              <span className={`org-chip${position.active ? '' : ' is-inactive'}`} key={position.id} title={plural(count, 'colaborador', 'colaboradores')}>
                <BriefcaseBusiness size={12} aria-hidden />{position.name}{count ? <em>{count}</em> : null}{!position.active ? <small>inativo</small> : null}
                <span className="org-chip__actions">{itemActions('position', position)}</span>
              </span>
            );
          })}
          {!positions.length && !isAdding('position', area.id) ? <span className="org-hint">Nenhum cargo nesta área.</span> : null}
        </div>
        {isAdding('position', area.id) ? <InlineAdd label={`Novo cargo em ${area.name}`} placeholder={`Novo cargo em ${area.name}`} saving={saving} onSubmit={(name) => create('position', name, area.id)} onCancel={() => setAdding(null)} /> : null}
      </div>
    );
  }

  function renderUnit(unit: OrganizationalUnit, depth: number) {
    const open = !collapsed.has(unit.id);
    const stats = unitStats(unit.id);
    const areas = visible(model.areasByUnit.get(unit.id) || []);
    const children = visible((model.childUnits.get(unit.id) || []).filter((child) => child.id !== unit.id));
    const legacyType = unit.unit_type && unit.unit_type !== 'unit' ? unit.unit_type : null;
    return (
      <li className={`org-unit${unit.active ? '' : ' is-inactive'}`} data-depth={depth} key={unit.id}>
        <div className="org-unit__head">
          <button type="button" className="org-unit__toggle" aria-expanded={open} onClick={() => toggle(unit.id)}>
            {open ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
            <Network size={16} aria-hidden />
            <strong>{unit.name}</strong>
            {legacyType ? <span className="org-tag">{legacyType}</span> : null}
            {!unit.active ? <span className="org-tag">inativa</span> : null}
          </button>
          <span className="org-meta">{plural(stats.areas, 'área', 'áreas')} · {plural(stats.positions, 'cargo', 'cargos')} · {plural(stats.people, 'colaborador', 'colaboradores')}</span>
          <div className="org-unit__actions">
            {unit.active ? <>
              <AddButton onClick={() => { setAdding({ kind: 'area', parentId: unit.id }); if (!open) toggle(unit.id); }}>Área</AddButton>
              <AddButton onClick={() => { setAdding({ kind: 'unit', parentId: unit.id }); if (!open) toggle(unit.id); }}>Subunidade</AddButton>
            </> : null}
            {itemActions('unit', unit)}
          </div>
        </div>
        {open ? (
          <div className="org-unit__body">
            {isAdding('area', unit.id) ? <InlineAdd label={`Nova área em ${unit.name}`} placeholder={`Nova área em ${unit.name} (ex.: Financeiro)`} saving={saving} onSubmit={(name) => create('area', name, unit.id)} onCancel={() => setAdding(null)} /> : null}
            {areas.map((area) => renderArea(area))}
            {!areas.length && !isAdding('area', unit.id) ? <p className="org-hint">Nenhuma área nesta unidade. Use “Área” para criar a primeira.</p> : null}
            {isAdding('unit', unit.id) ? <InlineAdd label={`Nova subunidade de ${unit.name}`} placeholder={`Subunidade de ${unit.name}`} saving={saving} onSubmit={(name) => create('unit', name, unit.id)} onCancel={() => setAdding(null)} /> : null}
            {children.length ? <ul className="org-units">{children.map((child) => renderUnit(child, depth + 1))}</ul> : null}
          </div>
        ) : null}
      </li>
    );
  }

  const rootUnits = visible(model.childUnits.get(null) || []);
  const legacyAreas = visible(model.legacyAreas);
  const legacyPositions = visible(model.legacyPositions);
  const hasLegacy = legacyAreas.length > 0 || legacyPositions.length > 0;
  const totalPeople = employments.filter((item) => item.status === 'active').length;
  const activeCount = (items: Array<{ active: boolean }>) => items.filter((item) => item.active).length;

  return (
    <div className="org-structure">
      <SectionPanel
        title={company?.name || 'Empresa'}
        eyebrow="Estrutura organizacional"
        action={<AddButton onClick={() => setAdding({ kind: 'unit', parentId: null })}>Nova unidade</AddButton>}
      >
        <ol className="org-legend" aria-label="Hierarquia da estrutura">
          <li><Building2 size={14} aria-hidden />Empresa<InfoTooltip text={CONCEPT_HELP.company} label="O que é a empresa" /></li>
          <li><ChevronRight size={13} aria-hidden className="org-legend__sep" /><Network size={14} aria-hidden />Unidade<InfoTooltip text={CONCEPT_HELP.unit} label="O que é uma unidade" /></li>
          <li><ChevronRight size={13} aria-hidden className="org-legend__sep" /><Users size={14} aria-hidden />Área<InfoTooltip text={CONCEPT_HELP.area} label="O que é uma área" /></li>
          <li><ChevronRight size={13} aria-hidden className="org-legend__sep" /><BriefcaseBusiness size={14} aria-hidden />Cargo<InfoTooltip text={CONCEPT_HELP.position} label="O que é um cargo" /></li>
        </ol>
        <div className="org-summary-row">
          <p className="org-summary">
            {plural(activeCount(structure.units), 'unidade', 'unidades')} · {plural(activeCount(structure.areas), 'área', 'áreas')} · {plural(activeCount(structure.positions), 'cargo', 'cargos')} · {plural(totalPeople, 'colaborador ativo', 'colaboradores ativos')}
          </p>
          {inactiveCount ? (
            <label className="org-check"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />Mostrar inativos ({inactiveCount})</label>
          ) : null}
        </div>
        {isAdding('unit', null) ? <InlineAdd label="Nome da nova unidade" placeholder="Nova unidade (ex.: Matriz, Filial São Paulo)" saving={saving} onSubmit={(name) => create('unit', name, null)} onCancel={() => setAdding(null)} /> : null}

        {loading && !structure.units.length ? <LoadingState /> : null}
        {!loading && !rootUnits.length && !hasLegacy ? (
          <EmptyState icon={Network} title="Nenhuma unidade cadastrada" description="Comece criando a primeira unidade (matriz, filial, operação). Depois adicione as áreas de cada unidade e os cargos de cada área." />
        ) : null}
        {rootUnits.length ? <ul className="org-units">{rootUnits.map((unit) => renderUnit(unit, 0))}</ul> : null}
      </SectionPanel>

      {hasLegacy ? (
        <SectionPanel title="Itens sem posição na hierarquia" eyebrow="Cadastros antigos">
          <p className="org-legacy-note">
            <AlertTriangle size={15} aria-hidden />Estes itens foram criados antes da regra Unidade › Área › Cargo. Continuam funcionando, mas vale movê-los para o lugar certo.
            <InfoTooltip text="Novas áreas exigem uma unidade e novos cargos exigem uma área. Mover um item também realinha automaticamente os vínculos dos colaboradores que o usam." label="Sobre cadastros antigos" />
          </p>
          {legacyAreas.length ? <h3 className="org-subtitle">Áreas sem unidade ({legacyAreas.length})</h3> : null}
          {legacyAreas.map((area) => (
            renderArea(area,
              <select className="org-move" aria-label={`Mover a área ${area.name} para uma unidade`} value="" disabled={saving || !structure.units.length} onChange={(event) => { const unitId = event.target.value; if (unitId) void run(() => moveOrganizationalArea(token, area.id, unitId), 'Área movida para a unidade.'); }}>
                <option value="">Mover para unidade…</option>
                {structure.units.filter((unit) => unit.active).map((unit) => <option value={unit.id} key={unit.id}>{unitPath(unit)}</option>)}
              </select>
            )
          ))}
          {legacyPositions.length ? <h3 className="org-subtitle">Cargos sem área ({legacyPositions.length})</h3> : null}
          {legacyPositions.map((position) => (
            <div className={`org-area${position.active ? '' : ' is-inactive'}`} key={position.id}>
              <div className="org-area__head">
                <BriefcaseBusiness size={15} aria-hidden /><strong>{position.name}</strong>
                {!position.active ? <span className="org-tag">inativo</span> : null}
                <span className="org-meta">{plural(model.peopleByPosition.get(position.id) || 0, 'colaborador', 'colaboradores')}</span>
                <div className="org-area__actions">
                  <select className="org-move" aria-label={`Mover o cargo ${position.name} para uma área`} value="" disabled={saving || !structure.areas.length} onChange={(event) => { const areaId = event.target.value; if (areaId) void run(() => moveOrganizationalPosition(token, position.id, areaId), 'Cargo movido para a área.'); }}>
                    <option value="">Mover para área…</option>
                    {structure.areas.filter((area) => area.active).map((area) => { const unit = structure.units.find((item) => item.id === area.unit_id); return <option value={area.id} key={area.id}>{area.name}{unit ? ` — ${unit.name}` : ''}</option>; })}
                  </select>
                  {itemActions('position', position)}
                </div>
              </div>
            </div>
          ))}
        </SectionPanel>
      ) : null}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Renomear ${KIND_LABEL[editing.kind]}` : 'Renomear'}
        description="O novo nome vale em todos os vínculos e telas que usam este item."
        size="sm"
        footer={<><button type="button" className="secondary-button" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" form="org-rename-form" className="primary-button" disabled={saving || !editName.trim()}>Salvar</button></>}
      >
        <form id="org-rename-form" className="admin-form" onSubmit={(event) => void saveEdit(event)}>
          <label><span>Nome</span><input value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={120} autoFocus required /></label>
        </form>
      </Modal>
    </div>
  );
}
