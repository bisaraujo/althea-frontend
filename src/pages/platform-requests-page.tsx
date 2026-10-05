import { X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { decideCapabilityRequest, listCapabilityRequests } from '../api/access';
import { ApiError } from '../api/client';
import { getCompanies } from '../api/services';
import type { Company, CompanyCustomCapability, CompanyCustomCapabilityStatus } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { REQUEST_KIND_LABEL, RequestDrawer, RequestTable, TermLabel } from '../components/access-ui';
import { platformAdminNavigation } from '../components/admin-navigation';
import { AppShell } from '../components/app-shell';
import { useToast } from '../components/toast';
import { ErrorState, FilterBar, SearchInput, SectionHeader, SegmentedFilter } from '../components/ui';
import './access-admin.css';

type StatusFilter = CompanyCustomCapabilityStatus | 'all';

function errorText(error: unknown) { return error instanceof ApiError ? error.message : 'Não foi possível concluir a operação.'; }

export function PlatformRequestsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const companyId = searchParams.get('company') || '';
  const [companies, setCompanies] = useState<Company[]>([]);
  const [items, setItems] = useState<CompanyCustomCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [kind, setKind] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getCompanies(token).then(setCompanies).catch(() => setCompanies([]));
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setItems(await listCapabilityRequests(token, { companyId, kind, dateFrom, dateTo }));
  }, [token, companyId, kind, dateFrom, dateTo]);

  const reload = useCallback(() => {
    setLoading(true);
    load().then(() => setLoadError(null)).catch((reason) => setLoadError(errorText(reason))).finally(() => setLoading(false));
  }, [load]);

  useEffect(() => { reload(); }, [reload]);

  function setCompany(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next) params.set('company', next); else params.delete('company');
    setSearchParams(params, { replace: true });
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (status !== 'all' && item.status !== status) return false;
      if (!needle) return true;
      return `${item.label} ${item.capability_key} ${item.company_name ?? ''} ${item.requested_by_name ?? ''} ${item.requested_by_email ?? ''} ${item.reason ?? ''}`.toLowerCase().includes(needle);
    });
  }, [items, status, query]);
  const count = (value: CompanyCustomCapabilityStatus) => items.filter((item) => item.status === value).length;
  const opened = items.find((item) => item.id === openId) ?? null;
  const hasFilters = Boolean(companyId || kind || dateFrom || dateTo || query);

  async function decide(item: CompanyCustomCapability, decision: 'approve' | 'reject', note: string): Promise<boolean> {
    if (!token || saving) return false;
    setSaving(true);
    try {
      await decideCapabilityRequest(token, item.id, decision, note);
      toast.success(decision === 'approve' ? 'Permissão aprovada.' : 'Solicitação recusada.');
      await load();
      return true;
    } catch (reason) {
      toast.error(errorText(reason));
      return false;
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setCompany(''); setKind(''); setDateFrom(''); setDateTo(''); setQuery(''); setStatus('all');
  }

  return (
    <AppShell
      eyebrow="Administração geral"
      title="Central de solicitações"
      description="Pedidos das empresas à Turi, com quem pediu, quem decide e o histórico de cada um."
      navigation={platformAdminNavigation}
    >
      <div className="acc-page-stack">
        <SectionHeader
          title="Solicitações das empresas"
          count={visible.length}
          info="Hoje existe um único tipo de solicitação: a empresa pede uma nova permissão que ainda não existe no catálogo. Quem decide é o Administrador Geral da Turi."
          description="Abra uma solicitação para ver o histórico e aprovar ou recusar."
        />

        <div className="acc-filters">
          <label>Empresa
            <select value={companyId} onChange={(e) => setCompany(e.target.value)}>
              <option value="">Todas as empresas</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
          <label>Tipo
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Todos os tipos</option>
              <option value="new_permission">{REQUEST_KIND_LABEL}</option>
            </select>
          </label>
          <label>De<input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} /></label>
          <label>Até<input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} /></label>
        </div>
        <p className="admin-form__hint" style={{ marginTop: -8 }}>
          Filtro por produto não se aplica: as solicitações não são ligadas a produtos, e sim a <TermLabel term="permission">permissões</TermLabel> de uma empresa.
        </p>

        <FilterBar actions={hasFilters ? <button type="button" className="secondary-button acc-btn-sm" onClick={clearFilters}><X size={13} />Limpar filtros</button> : undefined}>
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar por permissão, empresa ou solicitante..." label="Buscar solicitação" />
          <SegmentedFilter<StatusFilter>
            label="Situação"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'Todas', count: items.length },
              { value: 'pending', label: 'Pendentes', count: count('pending') },
              { value: 'approved', label: 'Aprovadas', count: count('approved') },
              { value: 'rejected', label: 'Recusadas', count: count('rejected') },
            ]}
          />
        </FilterBar>

        {loadError ? <ErrorState message={loadError} onRetry={reload} /> : (
          <RequestTable
            items={visible}
            showCompany
            loading={loading}
            onOpen={(item) => setOpenId(item.id)}
            emptyTitle={hasFilters || status !== 'all' ? 'Nenhuma solicitação com esses filtros' : 'Nenhuma solicitação ainda'}
            emptyDescription={hasFilters || status !== 'all' ? 'Ajuste ou limpe os filtros para ver mais.' : 'Quando uma empresa pedir uma nova permissão, ela aparece aqui.'}
          />
        )}
      </div>

      <RequestDrawer item={opened} onClose={() => setOpenId(null)} onDecide={decide} saving={saving} />
    </AppShell>
  );
}
