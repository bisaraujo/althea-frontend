import { Brain, ExternalLink, Gift, Pencil, Plus, Trash2, Users, Wallet } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import {
  type Benefit, BENEFIT_SCOPE_LABEL, BENEFIT_TYPE_LABEL, type BenefitPayload, type BenefitScope, createBenefit, deleteBenefit,
  formatMoney, listBenefits, listMyBenefits, updateBenefit,
} from '../api/benefits';
import { ApiError } from '../api/client';
import { getOrganizationalStructure } from '../api/services';
import type { OrganizationalStructure } from '../api/types';
import { EmptyState } from '../components/empty-state';
import { InfoTooltip } from '../components/info-tooltip';
import { SectionPanel } from '../components/section-panel';
import { StatCard } from '../components/stat-card';
import { StatusPill } from '../components/status-pill';
import { useToast } from '../components/toast';
import { Drawer, ErrorState, FilterBar, LoadingState, NoPermissionState, SearchInput, useConfirm } from '../components/ui';
import './benefits-agenda.css';

function errorText(reason: unknown, fallback: string) {
  return reason instanceof ApiError ? reason.message : fallback;
}

const emptyDraft: BenefitPayload = {
  name: '', benefit_type: 'saude', provider: null, description: null, how_to_use: null, site_url: null,
  monthly_cost_per_person: null, eligibility_scope: 'all', eligibility_ids: [], is_psychosocial: false, active: true,
};

function scopeNames(benefit: Benefit, structure: OrganizationalStructure | null) {
  if (benefit.eligibility_scope === 'all' || !structure) return BENEFIT_SCOPE_LABEL[benefit.eligibility_scope];
  const source = benefit.eligibility_scope === 'units' ? structure.units : benefit.eligibility_scope === 'areas' ? structure.areas : structure.positions;
  const names = source.filter((item) => benefit.eligibility_ids.includes(item.id)).map((item) => item.name);
  return names.length ? names.join(', ') : BENEFIT_SCOPE_LABEL[benefit.eligibility_scope];
}

function BenefitDrawer({ token, companyId, structure, benefit, onClose, onSaved }: {
  token: string; companyId: string; structure: OrganizationalStructure | null; benefit: Benefit | null; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<BenefitPayload>(benefit ? {
    name: benefit.name, benefit_type: benefit.benefit_type, provider: benefit.provider, description: benefit.description, how_to_use: benefit.how_to_use,
    site_url: benefit.site_url, monthly_cost_per_person: benefit.monthly_cost_per_person, eligibility_scope: benefit.eligibility_scope,
    eligibility_ids: benefit.eligibility_ids, is_psychosocial: benefit.is_psychosocial, active: benefit.active,
  } : emptyDraft);
  const [costText, setCostText] = useState(benefit?.monthly_cost_per_person != null ? String(benefit.monthly_cost_per_person).replace('.', ',') : '');
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof BenefitPayload>(key: K, value: BenefitPayload[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const options = !structure ? [] : draft.eligibility_scope === 'units' ? structure.units : draft.eligibility_scope === 'areas' ? structure.areas : draft.eligibility_scope === 'positions' ? structure.positions : [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const cost = costText.trim() ? Number(costText.replace(/\./g, '').replace(',', '.')) : null;
    if (cost !== null && (Number.isNaN(cost) || cost < 0)) { toast.error('Informe o custo como número, por exemplo 450,00.'); return; }
    if (draft.eligibility_scope !== 'all' && !draft.eligibility_ids.length) { toast.error('Escolha quem tem direito ao benefício.'); return; }
    const payload = { ...draft, name: draft.name.trim(), monthly_cost_per_person: cost, eligibility_ids: draft.eligibility_scope === 'all' ? [] : draft.eligibility_ids };
    setSaving(true);
    try {
      if (benefit) await updateBenefit(token, benefit.id, payload);
      else await createBenefit(token, companyId, payload);
      toast.success(benefit ? 'Benefício atualizado.' : 'Benefício cadastrado.');
      onSaved(); onClose();
    } catch (reason) {
      toast.error(errorText(reason, 'Não foi possível salvar o benefício.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open onClose={saving ? () => undefined : onClose} title={benefit ? 'Editar benefício' : 'Novo benefício'} description="O que a empresa oferece, para quem e quanto custa." size="md"
      footer={<>
        <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="submit" form="benefit-form" className="primary-button" disabled={saving || !draft.name.trim()}>{saving ? 'Salvando…' : benefit ? 'Salvar' : 'Cadastrar benefício'}</button>
      </>}>
      <form id="benefit-form" className="admin-form" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={saving} className="ben-fieldset">
          <label><span>Nome</span><input value={draft.name} onChange={(event) => set('name', event.target.value)} placeholder="Ex.: Plano de saúde" required maxLength={255} autoFocus /></label>
          <div className="field-grid">
            <label><span>Tipo</span>
              <select value={draft.benefit_type} onChange={(event) => set('benefit_type', event.target.value)}>
                {Object.entries(BENEFIT_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label><span>Fornecedor <em className="ben-optional">(opcional)</em></span><input value={draft.provider ?? ''} onChange={(event) => set('provider', event.target.value || null)} maxLength={255} /></label>
          </div>
          <label><span>Descrição <em className="ben-optional">(opcional)</em></span><textarea rows={2} value={draft.description ?? ''} onChange={(event) => set('description', event.target.value || null)} maxLength={2000} /></label>
          <label><span>Como usar <em className="ben-optional">(aparece para o colaborador)</em></span><textarea rows={3} value={draft.how_to_use ?? ''} onChange={(event) => set('how_to_use', event.target.value || null)} placeholder="Ex.: apresente a carteirinha digital no app da operadora." maxLength={4000} /></label>
          <div className="field-grid">
            <label><span>Site <em className="ben-optional">(opcional)</em></span><input value={draft.site_url ?? ''} onChange={(event) => set('site_url', event.target.value || null)} placeholder="https://" maxLength={512} /></label>
            <label><span>Custo mensal por pessoa <InfoTooltip text="Usado só para estimar o custo mensal (custo × pessoas com direito). O colaborador não vê esse valor." label="Sobre o custo" /></span><input inputMode="decimal" value={costText} onChange={(event) => setCostText(event.target.value)} placeholder="Ex.: 450,00" /></label>
          </div>
          <label><span>Quem tem direito</span>
            <select value={draft.eligibility_scope} onChange={(event) => { set('eligibility_scope', event.target.value as BenefitScope); set('eligibility_ids', []); }}>
              {Object.entries(BENEFIT_SCOPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {draft.eligibility_scope !== 'all' ? (
            options.length ? (
              <div className="ben-choices" role="group" aria-label="Escolha quem tem direito">
                {options.filter((item) => item.active || draft.eligibility_ids.includes(item.id)).map((item) => (
                  <label key={item.id}>
                    <input type="checkbox" checked={draft.eligibility_ids.includes(item.id)} onChange={() => set('eligibility_ids', draft.eligibility_ids.includes(item.id) ? draft.eligibility_ids.filter((id) => id !== item.id) : [...draft.eligibility_ids, item.id])} />
                    <span>{item.name}</span>
                  </label>
                ))}
              </div>
            ) : <p className="ben-hint">Esta empresa ainda não tem {draft.eligibility_scope === 'units' ? 'unidades' : draft.eligibility_scope === 'areas' ? 'áreas' : 'cargos'} cadastrados na estrutura.</p>
          ) : null}
          <label className="ben-toggle">
            <input type="checkbox" checked={draft.is_psychosocial} onChange={(event) => set('is_psychosocial', event.target.checked)} />
            <span><strong>Apoio à saúde psicossocial (NR-01)</strong><small>Marque se o benefício faz parte das ações de riscos psicossociais da empresa.</small></span>
          </label>
          {benefit ? (
            <label className="ben-toggle">
              <input type="checkbox" checked={draft.active} onChange={(event) => set('active', event.target.checked)} />
              <span><strong>Benefício ativo</strong><small>Desative para tirar da lista dos colaboradores sem apagar o histórico.</small></span>
            </label>
          ) : null}
        </fieldset>
      </form>
    </Drawer>
  );
}

function BenefitCard({ benefit, structure, showCosts, onEdit, onDelete }: { benefit: Benefit; structure: OrganizationalStructure | null; showCosts: boolean; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <article className={`ben-card${benefit.active ? '' : ' is-inactive'}`}>
      <header className="ben-card__head">
        <span className="ben-card__icon" aria-hidden><Gift size={18} /></span>
        <div className="ben-card__title">
          <strong>{benefit.name}</strong>
          <span>{BENEFIT_TYPE_LABEL[benefit.benefit_type] ?? benefit.benefit_type}{benefit.provider ? ` · ${benefit.provider}` : ''}</span>
        </div>
        <div className="ben-card__badges">
          {benefit.is_psychosocial ? <span className="ben-tag ben-tag--nr01"><Brain size={12} />NR-01</span> : null}
          {!benefit.active ? <StatusPill status="inactive" /> : null}
        </div>
      </header>
      {benefit.description ? <p className="ben-card__desc">{benefit.description}</p> : null}
      {!showCosts && benefit.how_to_use ? <div className="ben-card__howto"><strong>Como usar</strong><p>{benefit.how_to_use}</p></div> : null}
      {showCosts ? (
        <dl className="ben-card__facts">
          <div><dt>Quem tem direito</dt><dd>{scopeNames(benefit, structure)}</dd></div>
          <div><dt>Pessoas</dt><dd>{benefit.eligible_count ?? '—'}</dd></div>
          <div><dt>Custo por pessoa</dt><dd>{formatMoney(benefit.monthly_cost_per_person)}</dd></div>
          <div><dt>Custo mensal estimado</dt><dd>{formatMoney(benefit.monthly_estimate)}</dd></div>
        </dl>
      ) : null}
      {benefit.site_url || onEdit || onDelete ? (
        <footer className="ben-card__footer">
          {benefit.site_url ? <a href={benefit.site_url} target="_blank" rel="noreferrer" className="secondary-link"><ExternalLink size={13} />Site do benefício</a> : <span />}
          <span className="ben-card__actions">
            {onEdit ? <button type="button" className="org-icon-btn" aria-label={`Editar ${benefit.name}`} title="Editar" onClick={onEdit}><Pencil size={14} /></button> : null}
            {onDelete ? <button type="button" className="org-icon-btn org-icon-btn--danger" aria-label={`Remover ${benefit.name}`} title="Remover" onClick={onDelete}><Trash2 size={14} /></button> : null}
          </span>
        </footer>
      ) : null}
    </article>
  );
}

/** Beneficios da empresa para quem os gerencia ou ve (empresa, Admin Geral, perfil com beneficios.view). */
export function BenefitsWorkspace({ token, companyId, canManage }: { token: string; companyId: string; canManage: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [benefits, setBenefits] = useState<Benefit[] | null>(null);
  const [structure, setStructure] = useState<OrganizationalStructure | null>(null);
  const [failure, setFailure] = useState<{ message: string; forbidden: boolean } | null>(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [editing, setEditing] = useState<Benefit | 'new' | null>(null);

  const load = useCallback(() => {
    setFailure(null);
    listBenefits(token, companyId).then(setBenefits).catch((reason) => setFailure({ message: errorText(reason, 'Não foi possível carregar os benefícios.'), forbidden: reason instanceof ApiError && reason.status === 403 }));
    getOrganizationalStructure(token, companyId).then(setStructure).catch(() => setStructure(null));
  }, [token, companyId]);
  useEffect(() => { setBenefits(null); load(); }, [load]);

  const active = (benefits ?? []).filter((item) => item.active);
  const monthly = active.reduce((sum, item) => sum + (item.monthly_estimate ?? 0), 0);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (benefits ?? []).filter((item) => (!type || item.benefit_type === type) && (!term || item.name.toLowerCase().includes(term) || (item.provider ?? '').toLowerCase().includes(term)));
  }, [benefits, query, type]);

  async function remove(benefit: Benefit) {
    const ok = await confirm({ title: `Remover "${benefit.name}"?`, description: 'O benefício sai do catálogo da empresa. Se só quiser tirar da lista dos colaboradores, desative em vez de remover.', confirmLabel: 'Remover', tone: 'danger' });
    if (!ok) return;
    try { await deleteBenefit(token, benefit.id); toast.success('Benefício removido.'); load(); }
    catch (reason) { toast.error(errorText(reason, 'Não foi possível remover.')); }
  }

  if (failure) return failure.forbidden ? <NoPermissionState message="Você não tem permissão para ver os benefícios desta empresa." /> : <ErrorState message={failure.message} onRetry={load} />;
  if (!benefits) return <LoadingState />;

  return (
    <div className="ben-workspace">
      <div className="stats-grid stats-grid--three">
        <StatCard label="Benefícios ativos" value={active.length} meta={`${benefits.length - active.length} desativado(s)`} icon={<Gift size={18} />} />
        <StatCard label="Custo mensal estimado" value={formatMoney(monthly)} meta="Custo por pessoa × pessoas com direito" icon={<Wallet size={18} />} />
        <StatCard label="Apoio psicossocial (NR-01)" value={active.filter((item) => item.is_psychosocial).length} meta="Benefícios marcados" icon={<Brain size={18} />} />
      </div>
      <SectionPanel title="Benefícios da empresa" eyebrow={`${filtered.length} de ${benefits.length}`} action={canManage ? <button type="button" className="primary-button" onClick={() => setEditing('new')}><Plus size={16} />Novo benefício</button> : undefined}>
        <FilterBar>
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar por nome ou fornecedor" label="Buscar benefício" />
          <select className="org-filter-select" aria-label="Filtrar por tipo" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">Todos os tipos</option>
            {Object.entries(BENEFIT_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FilterBar>
        {!benefits.length ? (
          <EmptyState icon={Gift} title="Nenhum benefício cadastrado" description={canManage ? 'Cadastre os benefícios que a empresa oferece: tipo, fornecedor, quem tem direito e quanto custa.' : 'A empresa ainda não cadastrou benefícios.'} />
        ) : !filtered.length ? <EmptyState icon={Gift} title="Nada encontrado" description="Ajuste a busca ou o filtro de tipo." /> : (
          <div className="ben-grid">
            {filtered.map((benefit) => (
              <BenefitCard key={benefit.id} benefit={benefit} structure={structure} showCosts onEdit={canManage ? () => setEditing(benefit) : undefined} onDelete={canManage ? () => void remove(benefit) : undefined} />
            ))}
          </div>
        )}
      </SectionPanel>
      {editing ? <BenefitDrawer token={token} companyId={companyId} structure={structure} benefit={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={load} /> : null}
    </div>
  );
}

/** "Meus beneficios": o que vale para quem esta logado, sem custos. */
export function MyBenefits({ token }: { token: string }) {
  const [benefits, setBenefits] = useState<Benefit[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => { setFailed(false); listMyBenefits(token).then(setBenefits).catch(() => setFailed(true)); }, [token]);
  useEffect(load, [load]);
  if (failed) return <ErrorState message="Não foi possível carregar seus benefícios." onRetry={load} />;
  if (!benefits) return <LoadingState />;
  return (
    <SectionPanel title="Meus benefícios" eyebrow={`${benefits.length} disponível(is)`}>
      {benefits.length ? (
        <div className="ben-grid">{benefits.map((benefit) => <BenefitCard key={benefit.id} benefit={benefit} structure={null} showCosts={false} />)}</div>
      ) : <EmptyState icon={Users} title="Nenhum benefício para você ainda" description="Quando a empresa cadastrar benefícios que valem para você, eles aparecem aqui com as instruções de uso." />}
    </SectionPanel>
  );
}
