import { Activity, FileText, KeyRound, ListChecks, Network, Plus, Upload, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '../api/client';
import { type AuditEntry, apiErrorMessage, getAudit } from '../api/organization';
import { createCustomField, getCustomFields } from '../api/services';
import type { CustomFieldDefinition } from '../api/types';
import { EmptyState } from '../components/empty-state';
import { SectionPanel } from '../components/section-panel';
import { useToast } from '../components/toast';
import { DataTable, ErrorState, FilterBar, LoadingState, Modal, NoPermissionState, SearchInput, SectionHeader, SegmentedFilter } from '../components/ui';

/* ---------------------------------------------------------- Linguagem humana */

type Category = 'structure' | 'people' | 'access' | 'documents' | 'imports' | 'fields' | 'other';
const CATEGORY_LABEL: Record<Category, string> = { structure: 'Estrutura', people: 'Colaboradores', access: 'Acessos', documents: 'Documentos', imports: 'Importações', fields: 'Campos', other: 'Outros' };
const CATEGORY_ICON: Record<Category, LucideIcon> = { structure: Network, people: Users, access: KeyRound, documents: FileText, imports: Upload, fields: ListChecks, other: Activity };
const ENTITY_CATEGORY: Record<string, Category> = {
  organizational_unit: 'structure', area: 'structure', position: 'structure', person: 'people', employment: 'people',
  access_profile: 'access', access_scope: 'access', document: 'documents', import_batch: 'imports', custom_field: 'fields',
};
const STRUCTURE_LABEL: Record<string, string> = { organizational_unit: 'Unidade', area: 'Área', position: 'Cargo' };

const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const num = (value: unknown) => (typeof value === 'number' ? value : null);
const quote = (value: string | null, fallback: string) => (value ? `“${value}”` : fallback);
function shortDate(value: string | null) { if (!value) return null; const [year, month, day] = value.slice(0, 10).split('-'); return year && month && day ? `${day}/${month}/${year}` : value; }

export function categoryOf(entry: AuditEntry): Category { return ENTITY_CATEGORY[entry.entity_type] ?? 'other'; }

/** Traduz um evento técnico de auditoria em uma frase para o administrador. */
export function describeAudit(entry: AuditEntry): string {
  const { action, entity_type: entity, details: d, resolved: r } = entry;
  const name = str(d.name);
  if (entity in STRUCTURE_LABEL) {
    const label = STRUCTURE_LABEL[entity]; const feminine = entity !== 'position';
    if (action === 'create') return `${label} ${quote(name, '')} criad${feminine ? 'a' : 'o'}`.replace('  ', ' ');
    if (action === 'update') {
      const realigned = Array.isArray(d.realigned_employment_ids) ? d.realigned_employment_ids.length : 0;
      const suffix = realigned ? ` (${realigned} vínculo(s) realinhado(s))` : '';
      if (name) return `${label} renomead${feminine ? 'a' : 'o'} para ${quote(name, '')}${suffix}`;
      if (d.active === false) return `${label} desativad${feminine ? 'a' : 'o'}${suffix}`;
      if (d.active === true) return `${label} reativad${feminine ? 'a' : 'o'}${suffix}`;
      if ('unit_id' in d || 'area_id' in d || 'parent_id' in d) return `${label} movid${feminine ? 'a' : 'o'} na estrutura${suffix}`;
      return `${label} atualizad${feminine ? 'a' : 'o'}${suffix}`;
    }
  }
  if (entity === 'person') {
    if (action === 'create') return `Colaborador ${quote(name, '')} cadastrado`.replace('  ', ' ');
    return `Dados de ${r.person_name ? quote(r.person_name, '') : 'um colaborador'} atualizados`;
  }
  if (entity === 'employment') {
    const who = r.person_name ? ` de ${quote(r.person_name, '')}` : '';
    if (action === 'create') return r.person_name ? `Vínculo criado para ${quote(r.person_name, '')}` : 'Vínculo criado';
    if (action === 'end') return `Vínculo${who} encerrado${shortDate(str(d.ended_at)) ? ` em ${shortDate(str(d.ended_at))}` : ''}`;
    if (d.status === 'inactive') return `Vínculo${who} desativado`;
    if (d.status === 'active') return `Vínculo${who} reativado`;
    return `Vínculo${who} atualizado`;
  }
  if (entity === 'access_profile') {
    const label = quote(name || r.profile_name || null, '');
    if (action === 'create_from_template') return `Perfil de acesso ${label} criado a partir do pacote ${quote(r.template_name || null, 'da Turi')}`.replace('  ', ' ');
    if (action === 'create') return `Perfil de acesso ${label} criado`.replace('  ', ' ');
    if (d.active === false) return `Perfil de acesso ${label} desativado`.replace('  ', ' ');
    if (d.active === true && Object.keys(d).length === 1) return `Perfil de acesso ${label} reativado`.replace('  ', ' ');
    return `Perfil de acesso ${label} atualizado`.replace('  ', ' ');
  }
  if (entity === 'access_scope') {
    const profile = quote(r.profile_name || null, 'de acesso');
    const scope = r.unit_name ? ` (somente a unidade ${r.unit_name})` : r.area_name ? ` (somente a área ${r.area_name})` : '';
    if (action === 'grant') return `Acesso ${profile} concedido a ${quote(r.person_name || null, 'um colaborador')}${scope}`;
    if (action === 'revoke') return `Acesso ${profile} removido de ${quote(r.person_name || null, 'um colaborador')}`;
  }
  if (entity === 'document') {
    const title = quote(str(d.title), '');
    const origin = d.origin === 'file' ? 'arquivo' : d.origin === 'link' ? 'link' : null;
    if (action === 'create') return `Documento ${title} registrado${origin ? ` (${origin})` : ''}`.replace('  ', ' ');
    if (action === 'version') return `Nova versão${num(d.version) ? ` (v${num(d.version)})` : ''} do documento ${title}`.replace('  ', ' ');
    if (action === 'delete') return `Documento ${title} removido`.replace('  ', ' ');
  }
  if (entity === 'import_batch') {
    const file = str(d.file_name);
    if (action === 'validate') { const invalid = num(d.invalid) ?? 0; return `Importação${file ? ` de ${quote(file, '')}` : ''} validada: ${num(d.total) ?? 0} linha(s), ${invalid ? `${invalid} com erro` : 'nenhum erro'}`; }
    if (action === 'commit') return `Importação concluída: ${num(d.created) ?? 0} colaborador(es) cadastrado(s)`;
  }
  if (entity === 'custom_field') return `Campo personalizado${str(d.key) ? ` ${quote(str(d.key), '')}` : ''} criado`;
  return `Alteração registrada em ${CATEGORY_LABEL[categoryOf(entry)].toLowerCase()}`;
}

/* ------------------------------------------------------------------ Período */

type Period = 'all' | '7' | '30' | 'today';
const PERIODS: Array<{ value: Period; label: string }> = [{ value: 'all', label: 'Todo o período' }, { value: 'today', label: 'Hoje' }, { value: '7', label: 'Últimos 7 dias' }, { value: '30', label: 'Últimos 30 dias' }];
function startOf(period: Period): number {
  if (period === 'all') return 0;
  const date = new Date(); date.setHours(0, 0, 0, 0);
  if (period !== 'today') date.setDate(date.getDate() - (Number(period) - 1));
  return date.getTime();
}
function dayLabel(value: string) {
  const date = new Date(value); if (Number.isNaN(date.getTime())) return 'Data desconhecida';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86400000);
  if (diff === 0) return 'Hoje'; if (diff === 1) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function timeLabel(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function slugify(value: string) { return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }

const PAGE_SIZE = 60;

function errorKind(reason: unknown) { return reason instanceof ApiError && reason.status === 403 ? 'forbidden' : 'error'; }

/* --------------------------------------------------------- Campos personalizados */

function FieldsSection({ token, companyId, canManage }: { token: string; companyId: string; canManage: boolean }) {
  const toast = useToast();
  const [fields, setFields] = useState<CustomFieldDefinition[] | null>(null);
  const [failure, setFailure] = useState<'forbidden' | 'error' | null>(null);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  const load = useCallback(() => {
    const current = ++seq.current; setFailure(null);
    getCustomFields(token, companyId).then((data) => { if (current === seq.current) setFields(data); }).catch((reason) => { if (current === seq.current) setFailure(errorKind(reason)); });
  }, [token, companyId]);
  useEffect(() => { setFields(null); load(); }, [load]);

  function open() { setLabel(''); setKey(''); setKeyTouched(false); setCreating(true); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !label.trim() || !key.trim()) return;
    setSaving(true);
    try { await createCustomField(token, companyId, { entity_type: 'person', field_key: key.trim(), label: label.trim(), field_type: 'text', required: false }); toast.success('Campo personalizado criado.'); setCreating(false); load(); }
    catch (reason) { toast.error(apiErrorMessage(reason)); }
    finally { setSaving(false); }
  }

  return (
    <SectionPanel title="Campos personalizados" eyebrow="Cadastro de colaboradores">
      <SectionHeader title="Campos extras do colaborador" info="Use para guardar dados que a empresa precisa e que não existem no cadastro padrão, como matrícula ou centro de custo." count={fields?.length} actions={failure || !canManage ? null : <button type="button" className="secondary-button" onClick={open}><Plus size={15} />Novo campo</button>} />
      {failure === 'forbidden' ? <NoPermissionState message="Você não tem permissão para ver os campos desta empresa." /> : null}
      {failure === 'error' ? <ErrorState message="Não foi possível carregar os campos." onRetry={load} /> : null}
      {!failure ? (
        <DataTable<CustomFieldDefinition>
          dense caption="Campos personalizados" rows={fields ?? []} rowKey={(item) => item.id} loading={fields === null}
          empty={<EmptyState icon={ListChecks} title="Nenhum campo personalizado" description="Crie um campo para guardar dados extras dos colaboradores." />}
          columns={[
            { key: 'label', header: 'Campo', render: (item) => <strong>{item.label}</strong> },
            { key: 'key', header: 'Chave', hideOnMobile: true, render: (item) => <code className="org-code">{item.field_key}</code> },
            { key: 'entity', header: 'Vale para', render: (item) => (item.entity_type === 'person' ? 'Colaborador' : item.entity_type) },
            { key: 'type', header: 'Formato', hideOnMobile: true, render: (item) => (item.field_type === 'text' ? 'Texto' : item.field_type) },
            { key: 'required', header: 'Obrigatório', hideOnMobile: true, render: (item) => (item.required ? 'Sim' : 'Não') },
          ]}
        />
      ) : null}
      <Modal open={creating} onClose={() => setCreating(false)} title="Novo campo personalizado" description="O campo passa a existir no cadastro de colaboradores desta empresa." size="sm"
        footer={<><button type="button" className="secondary-button" onClick={() => setCreating(false)}>Cancelar</button><button type="submit" form="org-field-form" className="primary-button" disabled={saving || !label.trim() || !key.trim()}>Criar campo</button></>}>
        <form id="org-field-form" className="admin-form" onSubmit={(event) => void submit(event)}>
          <label><span>Nome do campo</span><input value={label} maxLength={80} autoFocus required placeholder="Ex.: Matrícula" onChange={(event) => { setLabel(event.target.value); if (!keyTouched) setKey(slugify(event.target.value)); }} /></label>
          <label><span>Chave interna</span><input value={key} maxLength={60} required onChange={(event) => { setKeyTouched(true); setKey(slugify(event.target.value)); }} /></label>
          <p className="org-hint">A chave é gerada a partir do nome e não muda depois. O campo é de texto e opcional.</p>
        </form>
      </Modal>
    </SectionPanel>
  );
}

/* ------------------------------------------------------------------ Auditoria */

function AuditSection({ token, companyId }: { token: string; companyId: string }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [failure, setFailure] = useState<'forbidden' | 'error' | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | Category>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const seq = useRef(0);

  const load = useCallback(() => {
    const current = ++seq.current; setFailure(null);
    getAudit(token, companyId).then((data) => { if (current === seq.current) setEntries(data); }).catch((reason) => { if (current === seq.current) setFailure(errorKind(reason)); });
  }, [token, companyId]);
  useEffect(() => { setEntries(null); load(); }, [load]);

  const described = useMemo(() => (entries ?? []).map((entry) => ({ entry, text: describeAudit(entry), category: categoryOf(entry) })), [entries]);
  const counts = useMemo(() => {
    const map = new Map<Category, number>();
    described.forEach((item) => map.set(item.category, (map.get(item.category) || 0) + 1));
    return map;
  }, [described]);
  const needle = query.trim().toLowerCase();
  const since = startOf(period);
  const filtered = described.filter((item) => (category === 'all' || item.category === category) && new Date(item.entry.created_at).getTime() >= since && (!needle || `${item.text} ${item.entry.actor_name ?? ''}`.toLowerCase().includes(needle)));
  const shown = filtered.slice(0, limit);
  const groups = useMemo(() => {
    const result: Array<{ day: string; items: typeof shown }> = [];
    shown.forEach((item) => {
      const day = dayLabel(item.entry.created_at);
      const last = result[result.length - 1];
      if (last && last.day === day) last.items.push(item); else result.push({ day, items: [item] });
    });
    return result;
  }, [shown]);

  const categories = (Object.keys(CATEGORY_LABEL) as Category[]).filter((item) => counts.get(item));

  return (
    <SectionPanel title="Histórico de alterações" eyebrow={entries ? `${entries.length} evento(s)` : 'Auditoria'}>
      {failure === 'forbidden' ? <NoPermissionState message="Você não tem permissão para ver o histórico desta empresa." /> : null}
      {failure === 'error' ? <ErrorState message="Não foi possível carregar o histórico." onRetry={load} /> : null}
      {!failure && entries === null ? <LoadingState /> : null}
      {!failure && entries ? (
        entries.length === 0 ? <EmptyState icon={Activity} title="Nenhuma alteração registrada" description="Quando alguém criar, editar ou remover algo na organização, o histórico aparece aqui." /> : (
          <>
            <FilterBar>
              <SearchInput value={query} onChange={(value) => { setQuery(value); setLimit(PAGE_SIZE); }} placeholder="Buscar por pessoa, item ou autor" label="Buscar no histórico" />
              <select className="org-filter-select" aria-label="Período" value={period} onChange={(event) => { setPeriod(event.target.value as Period); setLimit(PAGE_SIZE); }}>
                {PERIODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <SegmentedFilter<'all' | Category> label="Tipo de alteração" value={category} onChange={(value) => { setCategory(value); setLimit(PAGE_SIZE); }} options={[{ value: 'all', label: 'Tudo', count: described.length }, ...categories.map((item) => ({ value: item, label: CATEGORY_LABEL[item], count: counts.get(item) }))]} />
            </FilterBar>
            {!filtered.length ? <EmptyState icon={Activity} title="Nada encontrado" description="Nenhuma alteração corresponde à busca e aos filtros escolhidos." /> : (
              <div className="org-timeline">
                {groups.map((group) => (
                  <section key={group.day} aria-label={group.day}>
                    <h4 className="org-timeline__day">{group.day}</h4>
                    <ol>
                      {group.items.map(({ entry, text, category: itemCategory }) => {
                        const Icon = CATEGORY_ICON[itemCategory];
                        return (
                          <li key={entry.id}>
                            <span className={`org-timeline__icon org-timeline__icon--${itemCategory}`} aria-hidden><Icon size={14} /></span>
                            <div className="org-timeline__copy">
                              <span>{text}</span>
                              <span className="org-hint">{timeLabel(entry.created_at)} · {entry.actor_name ? entry.actor_name : entry.actor_id ? 'Usuário não identificado' : 'Sistema'} · {CATEGORY_LABEL[itemCategory]}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                ))}
                {filtered.length > shown.length ? <button type="button" className="secondary-button org-more" onClick={() => setLimit((value) => value + PAGE_SIZE)}>Mostrar mais ({filtered.length - shown.length})</button> : null}
              </div>
            )}
          </>
        )
      ) : null}
    </SectionPanel>
  );
}

type AuditTabProps = { token: string; companyId: string; showFields?: boolean; canManageFields?: boolean; showAudit?: boolean };

export function AuditTab({ token, companyId, showFields = true, canManageFields = true, showAudit = true }: AuditTabProps) {
  return (
    <div className="org-governance">
      {showFields ? <FieldsSection token={token} companyId={companyId} canManage={canManageFields} /> : null}
      {showAudit ? <AuditSection token={token} companyId={companyId} /> : null}
    </div>
  );
}
