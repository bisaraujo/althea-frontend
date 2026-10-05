import { CheckCircle2, Clock3, Eye, PackagePlus, ShieldAlert, ShieldCheck, ShieldX, Trash2, XCircle } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

import type { AccessAssignment, CompanyCustomCapability, CompanyCustomCapabilityStatus, OrganizationalAccessProfile, PermissionCatalogEntry } from '../api/types';
import '../pages/access-admin.css';
import { InfoTooltip } from './info-tooltip';
import { EmptyState } from './empty-state';
import { DataTable, Drawer, Modal, SearchInput, useConfirm } from './ui';

/* ------------------------------------------------------------------ */
/* Vocabulário único da interface                                      */
/* ------------------------------------------------------------------ */

export const ACCESS_TERMS = {
  permission: {
    name: 'Permissão',
    definition: 'Uma ação específica que alguém pode fazer na plataforma, como “Visualizar colaboradores”.',
  },
  profile: {
    name: 'Perfil de acesso',
    definition: 'Conjunto de permissões que a empresa dá a um colaborador. Cada empresa cria e edita os seus.',
  },
  package: {
    name: 'Pacote de acesso',
    definition: 'Modelo pronto criado pela Turi. Ao usar um pacote, a empresa recebe uma cópia como perfil de acesso e pode ajustá-la.',
  },
  request: {
    name: 'Solicitação',
    definition: 'Pedido da empresa à Turi para criar uma permissão nova que ainda não existe no catálogo.',
  },
} as const;

export function AccessGlossary({ terms = ['permission', 'profile', 'package', 'request'] }: { terms?: Array<keyof typeof ACCESS_TERMS> }) {
  return (
    <div className="acc-glossary">
      {terms.map((key) => (
        <div className="acc-glossary__item" key={key}>
          <strong>{ACCESS_TERMS[key].name}</strong>
          <span>{ACCESS_TERMS[key].definition}</span>
        </div>
      ))}
    </div>
  );
}

export function TermLabel({ term, children }: { term: keyof typeof ACCESS_TERMS; children?: ReactNode }) {
  return <span className="acc-inline-info">{children ?? ACCESS_TERMS[term].name}<InfoTooltip text={ACCESS_TERMS[term].definition} /></span>;
}

/* ------------------------------------------------------------------ */
/* Catálogo e formatação                                               */
/* ------------------------------------------------------------------ */

export const CUSTOM_PERMISSIONS_MODULE = 'Personalizadas (aprovadas pela Turi)';
const OTHER_MODULE = 'Outras';

export function withApprovedCustomPermissions(catalog: PermissionCatalogEntry[], requests: CompanyCustomCapability[]): PermissionCatalogEntry[] {
  const approved = requests
    .filter((item) => item.status === 'approved')
    .map((item) => ({ key: item.capability_key, label: item.label, module: CUSTOM_PERMISSIONS_MODULE }));
  return [...catalog, ...approved];
}

export function permissionLabel(catalog: PermissionCatalogEntry[], key: string) {
  return catalog.find((entry) => entry.key === key)?.label ?? key;
}

export function slugifyPermissionKey(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.]+/g, '_').replace(/^[_.]+|[_.]+$/g, '');
}

export function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '';
}

export function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
}

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function groupByModule(entries: PermissionCatalogEntry[]) {
  const groups = new Map<string, PermissionCatalogEntry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.module) ?? [];
    list.push(entry);
    groups.set(entry.module, list);
  }
  return Array.from(groups.entries());
}

/** Permissões marcadas que não estão no catálogo (ex.: chave antiga) viram entradas do módulo "Outras". */
function resolvePermissions(catalog: PermissionCatalogEntry[], keys: string[]): PermissionCatalogEntry[] {
  return keys.map((key) => catalog.find((entry) => entry.key === key) ?? { key, label: key, module: OTHER_MODULE });
}

export function summarizeModules(catalog: PermissionCatalogEntry[], keys: string[]): Array<[string, number]> {
  return groupByModule(resolvePermissions(catalog, keys)).map(([moduleName, list]) => [moduleName, list.length]);
}

export function countLabel(count: number) {
  return `${count} permiss${count === 1 ? 'ão' : 'ões'}`;
}

/* ------------------------------------------------------------------ */
/* Seletor de permissões (escala para centenas)                        */
/* ------------------------------------------------------------------ */

export function PermissionPicker({ catalog, selected, onChange }: { catalog: PermissionCatalogEntry[]; selected: string[]; onChange: (next: string[]) => void }) {
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);

  const fullCatalog = useMemo(() => {
    const known = new Set(catalog.map((entry) => entry.key));
    const extra = selected.filter((key) => !known.has(key)).map((key) => ({ key, label: key, module: OTHER_MODULE }));
    return [...catalog, ...extra];
  }, [catalog, selected]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const modules = useMemo(() => Array.from(new Set(fullCatalog.map((entry) => entry.module))), [fullCatalog]);

  const visible = useMemo(() => {
    const needle = normalize(query.trim());
    return fullCatalog.filter((entry) => {
      if (moduleFilter && entry.module !== moduleFilter) return false;
      if (onlySelected && !selectedSet.has(entry.key)) return false;
      if (!needle) return true;
      return normalize(`${entry.label} ${entry.key} ${entry.module}`).includes(needle);
    });
  }, [fullCatalog, query, moduleFilter, onlySelected, selectedSet]);
  const groups = useMemo(() => groupByModule(visible), [visible]);

  function toggle(key: string) {
    onChange(selectedSet.has(key) ? selected.filter((item) => item !== key) : [...selected, key]);
  }
  function selectGroup(entries: PermissionCatalogEntry[]) {
    const next = new Set(selected);
    entries.forEach((entry) => next.add(entry.key));
    onChange(Array.from(next));
  }
  function clearGroup(entries: PermissionCatalogEntry[]) {
    const remove = new Set(entries.map((entry) => entry.key));
    onChange(selected.filter((key) => !remove.has(key)));
  }

  return (
    <div className="acc-picker">
      <div className="acc-picker__toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar permissão por nome ou código..." label="Buscar permissão" />
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} aria-label="Filtrar por módulo">
          <option value="">Todos os módulos</option>
          {modules.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>
      <div className="acc-picker__bar">
        <span><strong>{selected.length}</strong> de {fullCatalog.length} selecionada{selected.length === 1 ? '' : 's'}</span>
        <span style={{ display: 'inline-flex', gap: 12 }}>
          <button type="button" className="acc-link-button" onClick={() => setOnlySelected((value) => !value)}>{onlySelected ? 'Ver todas' : 'Ver só selecionadas'}</button>
          {selected.length ? <button type="button" className="acc-link-button" onClick={() => onChange([])}>Limpar tudo</button> : null}
        </span>
      </div>
      <div className="acc-picker__list">
        {groups.length ? groups.map(([moduleName, entries]) => {
          const chosen = entries.filter((entry) => selectedSet.has(entry.key)).length;
          return (
            <section className="acc-picker__group" key={moduleName}>
              <div className="acc-picker__group-head">
                <strong>{moduleName}<em>{chosen}/{entries.length}</em></strong>
                <span className="acc-picker__group-actions">
                  <button type="button" className="acc-link-button" onClick={() => selectGroup(entries)} disabled={chosen === entries.length}>Selecionar todas</button>
                  <button type="button" className="acc-link-button" onClick={() => clearGroup(entries)} disabled={!chosen}>Limpar</button>
                </span>
              </div>
              {entries.map((entry) => (
                <label className="acc-picker__row" key={entry.key}>
                  <input type="checkbox" checked={selectedSet.has(entry.key)} onChange={() => toggle(entry.key)} />
                  <span><strong>{entry.label}</strong><em>{entry.key}</em></span>
                </label>
              ))}
            </section>
          );
        }) : <div className="acc-picker__empty">Nenhuma permissão encontrada para esse filtro.</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ver permissões + cartão de pacote / perfil                          */
/* ------------------------------------------------------------------ */

export function PermissionsModal({ open, onClose, title, catalog, permissions }: { open: boolean; onClose: () => void; title: string; catalog: PermissionCatalogEntry[]; permissions: string[] }) {
  const groups = groupByModule(resolvePermissions(catalog, permissions));
  return (
    <Modal open={open} onClose={onClose} title={title} description={countLabel(permissions.length)} size="md">
      {groups.length ? (
        <div className="acc-permlist">
          {groups.map(([moduleName, entries]) => (
            <section key={moduleName}>
              <h4>{moduleName} ({entries.length})</h4>
              <ul>{entries.map((entry) => <li key={entry.key}>{entry.label}<code>{entry.key}</code></li>)}</ul>
            </section>
          ))}
        </div>
      ) : <p className="admin-form__hint">Nenhuma permissão selecionada.</p>}
    </Modal>
  );
}

export function AccessCard({
  icon, title, subtitle, badge, description, emptyDescription = 'Sem descrição.', catalog, permissions, note, actions, muted,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  description?: string | null;
  emptyDescription?: string;
  catalog: PermissionCatalogEntry[];
  permissions: string[];
  note?: ReactNode;
  actions?: ReactNode;
  muted?: boolean;
}) {
  const [showing, setShowing] = useState(false);
  const modules = summarizeModules(catalog, permissions);
  return (
    <article className={`acc-card${muted ? ' is-muted' : ''}`}>
      <header className="acc-card__head">
        <span className="acc-card__icon" aria-hidden>{icon}</span>
        <div className="acc-card__title">
          <strong>{title}</strong>
          <span>{subtitle ?? countLabel(permissions.length)}</span>
        </div>
        <span className="acc-card__badge">{badge}</span>
      </header>
      <p className={`acc-card__desc${description ? '' : ' is-empty'}`}>{description || emptyDescription}</p>
      <ul className="acc-card__modules" aria-label="Permissões por módulo">
        {modules.map(([name, count]) => <li key={name}>{name}<b>{count}</b></li>)}
        {!modules.length ? <li>Sem permissões</li> : null}
      </ul>
      <footer className="acc-card__foot">
        <button type="button" className="acc-link-button" onClick={() => setShowing(true)}><Eye size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />Ver permissões</button>
        {note ? <span className="acc-card__foot-note">{note}</span> : null}
        {actions ? <div className="acc-card__actions">{actions}</div> : null}
      </footer>
      <PermissionsModal open={showing} onClose={() => setShowing(false)} title={title} catalog={catalog} permissions={permissions} />
    </article>
  );
}

export function TemplateGallery({
  templates, catalog, existingProfiles, onUse, saving,
}: {
  templates: OrganizationalAccessProfile[];
  catalog: PermissionCatalogEntry[];
  existingProfiles: OrganizationalAccessProfile[];
  onUse: (template: OrganizationalAccessProfile) => void;
  saving: boolean;
}) {
  if (!templates.length) {
    return <EmptyState title="Nenhum pacote disponível" description="A Turi ainda não publicou pacotes de acesso." />;
  }
  const existingNames = new Set(existingProfiles.map((profile) => profile.name.trim().toLowerCase()));
  return (
    <div className="acc-grid">
      {templates.map((template) => {
        const alreadyAdded = existingNames.has(template.name.trim().toLowerCase());
        return (
          <AccessCard
            key={template.id}
            icon={<ShieldCheck size={18} />}
            title={template.name}
            description={template.description}
            catalog={catalog}
            permissions={template.permissions}
            note={alreadyAdded ? <><CheckCircle2 size={14} />Já está nos perfis</> : undefined}
            actions={alreadyAdded ? undefined : (
              <button type="button" className="secondary-button acc-btn-sm" onClick={() => onUse(template)} disabled={saving}>
                <PackagePlus size={14} />Usar pacote
              </button>
            )}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Atribuições: quem tem acesso                                        */
/* ------------------------------------------------------------------ */

function assignmentLimit(item: AccessAssignment) {
  if (item.area_name) return `Só a área ${item.area_name}`;
  if (item.unit_name) return `Só a unidade ${item.unit_name}`;
  return 'Empresa inteira';
}

export function AssignmentTable({ assignments, onRevoke, saving, loading, packageNames }: { assignments: AccessAssignment[]; onRevoke: (item: AccessAssignment) => void; saving: boolean; loading?: boolean; packageNames?: Set<string> }) {
  return (
    <DataTable
      dense
      loading={loading}
      rows={assignments}
      rowKey={(item) => item.id}
      caption="Colaboradores com perfil de acesso"
      empty={<EmptyState title="Ninguém com perfil de acesso ainda" description="Quando você der um perfil de acesso a um colaborador, ele aparece aqui." />}
      columns={[
        {
          key: 'person', header: 'Colaborador', render: (item) => (
            <div className="acc-person">
              <strong>{item.person_name}</strong>
              <span>{item.person_email || 'Sem email'}</span>
              <span className="acc-person__org">{[item.position_name, item.employment_area_name, item.employment_unit_name].filter(Boolean).join(' · ') || 'Sem cargo/área/unidade'}</span>
            </div>
          ),
        },
        { key: 'position', header: 'Cargo', hideOnMobile: true, render: (item) => item.position_name || '—' },
        { key: 'area', header: 'Área', hideOnMobile: true, render: (item) => item.employment_area_name || '—' },
        { key: 'unit', header: 'Unidade', hideOnMobile: true, render: (item) => item.employment_unit_name || '—' },
        {
          key: 'profile', header: 'Perfil de acesso', render: (item) => (
            <div className="acc-origin">
              <strong>{item.profile_name}</strong>
              <span>{packageNames?.has(item.profile_name.trim().toLowerCase()) ? 'Origem: pacote de acesso da Turi' : 'Origem: perfil próprio da empresa'}</span>
              <span>{assignmentLimit(item)} · desde {formatDate(item.created_at)}</span>
            </div>
          ),
        },
        {
          key: 'actions', header: '', align: 'right', width: '110px', render: (item) => (
            <button type="button" className="secondary-button acc-btn-sm" onClick={() => onRevoke(item)} disabled={saving}><Trash2 size={13} />Remover</button>
          ),
        },
      ]}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Solicitações                                                         */
/* ------------------------------------------------------------------ */

export const requestStatusMeta: Record<CompanyCustomCapabilityStatus, { label: string; className: string; icon: typeof Clock3 }> = {
  pending: { label: 'Pendente', className: 'status-pill--warning', icon: Clock3 },
  approved: { label: 'Aprovada', className: 'status-pill--success', icon: CheckCircle2 },
  rejected: { label: 'Recusada', className: 'status-pill--danger', icon: XCircle },
};

export const REQUEST_KIND_LABEL = 'Nova permissão no catálogo';

export function RequestStatusPill({ status }: { status: CompanyCustomCapabilityStatus }) {
  const meta = requestStatusMeta[status];
  const Icon = meta.icon;
  return <span className={`status-pill acc-status ${meta.className}`}><Icon size={13} />{meta.label}</span>;
}

export function RequestTable({
  items, showCompany = false, onOpen, loading, emptyTitle = 'Nenhuma solicitação', emptyDescription,
}: {
  items: CompanyCustomCapability[];
  showCompany?: boolean;
  onOpen: (item: CompanyCustomCapability) => void;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription: string;
}) {
  return (
    <DataTable
      dense
      loading={loading}
      rows={items}
      rowKey={(item) => item.id}
      onRowClick={onOpen}
      caption="Solicitações de nova permissão"
      empty={<EmptyState title={emptyTitle} description={emptyDescription} icon={ShieldAlert} />}
      columns={[
        { key: 'label', header: 'Permissão pedida', render: (item) => <div className="acc-req-title"><strong>{item.label}</strong><span className="acc-req-key">{item.capability_key}</span></div> },
        ...(showCompany ? [{ key: 'company', header: 'Empresa', render: (item: CompanyCustomCapability) => item.company_name || item.company_id }] : []),
        { key: 'by', header: 'Solicitante', hideOnMobile: true, render: (item) => item.requested_by_name || item.requested_by_email || '—' },
        { key: 'date', header: 'Data', hideOnMobile: true, render: (item) => formatDate(item.requested_at) },
        { key: 'status', header: 'Situação', render: (item) => <RequestStatusPill status={item.status} /> },
      ]}
    />
  );
}

/** Texto honesto sobre o efeito de uma solicitação (nenhum recurso do produto checa chaves personalizadas ainda). */
export function requestEffectText(item: CompanyCustomCapability) {
  if (item.status === 'approved') {
    return `A permissão “${item.label}” pode ser marcada nos perfis de acesso de ${item.company_name || 'esta empresa'}. Hoje nenhuma funcionalidade da plataforma verifica essa permissão: a aprovação apenas a torna selecionável e registrada.`;
  }
  if (item.status === 'rejected') {
    return 'Nada mudou no catálogo. A empresa pode enviar um novo pedido, com outro motivo, quando quiser.';
  }
  return `Se aprovada, “${item.label}” passa a poder ser marcada nos perfis de acesso de ${item.company_name || 'esta empresa'}. Hoje nenhuma funcionalidade da plataforma verifica essa permissão: a aprovação apenas a torna selecionável. Se recusada, o histórico é mantido.`;
}

export function RequestDrawer({
  item, onClose, onDecide, saving = false,
}: {
  item: CompanyCustomCapability | null;
  onClose: () => void;
  /** Só passado para o Administrador Geral. */
  onDecide?: (item: CompanyCustomCapability, decision: 'approve' | 'reject', note: string) => Promise<boolean> | boolean;
  saving?: boolean;
}) {
  const confirm = useConfirm();
  const [note, setNote] = useState('');
  const [noteFor, setNoteFor] = useState<string | null>(null);
  if (noteFor !== (item?.id ?? null)) { setNoteFor(item?.id ?? null); setNote(''); }

  async function decide(decision: 'approve' | 'reject') {
    if (!item || !onDecide) return;
    const approve = decision === 'approve';
    const ok = await confirm({
      title: approve ? 'Aprovar esta permissão?' : 'Recusar esta solicitação?',
      description: `${approve ? 'Aprovar' : 'Recusar'} “${item.label}” para ${item.company_name || 'a empresa'}. ${approve ? 'A permissão poderá ser marcada nos perfis de acesso dessa empresa.' : 'A empresa verá o pedido como recusado; o histórico é mantido.'}`,
      confirmLabel: approve ? 'Aprovar' : 'Recusar',
      tone: approve ? undefined : 'danger',
    });
    if (!ok) return;
    if (await onDecide(item, decision, note)) onClose();
  }

  const decisionWord = item?.status === 'approved' ? 'Aprovada' : 'Recusada';
  return (
    <Drawer
      open={Boolean(item)}
      onClose={onClose}
      title={item?.label ?? 'Solicitação'}
      description={item ? REQUEST_KIND_LABEL : undefined}
      footer={item && onDecide && item.status === 'pending' ? (
        <div className="acc-footer-actions">
          <button type="button" className="secondary-button" onClick={() => void decide('reject')} disabled={saving}><ShieldX size={15} />Recusar</button>
          <button type="button" className="primary-button" onClick={() => void decide('approve')} disabled={saving}><ShieldCheck size={15} />Aprovar</button>
        </div>
      ) : undefined}
    >
      {item ? (
        <div className="acc-drawer">
          <RequestStatusPill status={item.status} />
          <dl className="acc-drawer__facts">
            <div><dt>Empresa</dt><dd>{item.company_name || item.company_id}</dd></div>
            <div><dt>Tipo</dt><dd>{item.kind_label || REQUEST_KIND_LABEL}</dd></div>
            <div><dt>Solicitante</dt><dd>{item.requested_by_name || 'Usuário não identificado'}{item.requested_by_email ? ` · ${item.requested_by_email}` : ''}</dd></div>
            <div><dt>Data do pedido</dt><dd>{formatDateTime(item.requested_at)}</dd></div>
            <div><dt>Código da permissão</dt><dd><span className="acc-req-key">{item.capability_key}</span></dd></div>
            <div><dt>Quem decide</dt><dd>{item.responsible_label || 'Administrador Geral da Turi'}</dd></div>
            <div className="is-wide"><dt>Motivo informado</dt><dd>{item.reason || 'Sem motivo informado.'}</dd></div>
          </dl>
          <div className="acc-note"><strong>O que essa solicitação faz</strong>{requestEffectText(item)}</div>
          <section>
            <h4 style={{ margin: '0 0 10px', fontSize: '0.86rem' }}>Histórico</h4>
            <ol className="acc-timeline">
              <li>
                <strong>Solicitada</strong>
                <span>{formatDateTime(item.requested_at)} · {item.requested_by_name || 'usuário não identificado'}</span>
                {item.reason ? <span>“{item.reason}”</span> : null}
              </li>
              {item.status === 'pending' ? (
                <li className="is-waiting"><strong>Aguardando análise</strong><span>{item.responsible_label || 'Administrador Geral da Turi'}</span></li>
              ) : (
                <li className={item.status === 'approved' ? 'is-approved' : 'is-rejected'}>
                  <strong>{decisionWord}</strong>
                  <span>{formatDateTime(item.decided_at)} · {item.decided_by_name || 'Administrador Geral da Turi'}</span>
                  {item.decision_note ? <span>Observação: {item.decision_note}</span> : null}
                </li>
              )}
            </ol>
          </section>
          {onDecide && item.status === 'pending' ? (
            <label className="acc-decision">
              <span className="admin-form__hint">Observação da decisão (opcional, visível no histórico)</span>
              <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
