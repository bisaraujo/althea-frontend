import {
  AlertTriangle, ArrowRight, Building2, CalendarDays, CheckCircle2, Gift, Network, Route as RouteIcon, ShieldAlert, ShieldCheck, Sparkles, Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { AGENDA_TYPE_LABEL, type AgendaEntry, getAgenda } from '../api/action-plan';
import { type Benefit, formatMoney, listBenefits } from '../api/benefits';
import { getMyCompanyProducts, type MyCompanyProducts } from '../api/company';
import { type IntegrityCase, listIntegrityCases } from '../api/integrity';
import { getCompanyCustomCapabilities, getEmployments, getForms, getMyCompany, getOrganizationalStructure, getResponses } from '../api/services';
import type { Company, CompanyCustomCapability, Employment, OrganizationalStructure } from '../api/types';
import { INTEGRITY_PRODUCT_ID, JORNADAS_PRODUCT_ID } from '../api/workspace-access';
import { useAuth } from '../auth/auth-context';
import { AppShell } from '../components/app-shell';
import { CompanyAvatar } from '../components/company-avatar';
import { companyNavigation } from '../components/company-navigation';
import { SectionPanel } from '../components/section-panel';
import { StatCard } from '../components/stat-card';
import { StatusPill } from '../components/status-pill';
import { ErrorState, LoadingState } from '../components/ui';
import './benefits-agenda.css';
import './company-home.css';

type Overview = {
  company: Company;
  products: MyCompanyProducts;
  agenda: AgendaEntry[] | null;
  benefits: Benefit[] | null;
  structure: OrganizationalStructure | null;
  employments: Employment[] | null;
  cases: IntegrityCase[] | null;
  requests: CompanyCustomCapability[] | null;
  jornadas: { forms: number; responses: number } | null;
};

function iso(day: Date) {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}
function shiftDays(amount: number) {
  const day = new Date(); day.setDate(day.getDate() + amount); return iso(day);
}
function shortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}
/** Um pedaco que falhar (sem permissao, fora do ar) nao derruba a pagina: vira null. */
async function optional<T>(promise: Promise<T>): Promise<T | null> {
  try { return await promise; } catch { return null; }
}

type Attention = { key: string; icon: typeof AlertTriangle; text: string; to: string };

/** Pagina inicial da empresa: um resumo de tudo, para qualquer cliente, com ou sem produto. */
export function CompanyHomePage() {
  const { token, user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [company, products] = await Promise.all([getMyCompany(token), getMyCompanyProducts(token)]);
      const has = (id: string) => products.product_ids.includes(id) || (id === JORNADAS_PRODUCT_ID && products.has_jornadas);
      const [agenda, benefits, structure, employments, cases, requests, forms, responses] = await Promise.all([
        optional(getAgenda(token, company.id, shiftDays(-90), shiftDays(30)).then((result) => result.entries)),
        optional(listBenefits(token, company.id)),
        optional(getOrganizationalStructure(token, company.id)),
        optional(getEmployments(token, company.id)),
        has(INTEGRITY_PRODUCT_ID) ? optional(listIntegrityCases(token, company.id)) : Promise.resolve(null),
        optional(getCompanyCustomCapabilities(token, company.id)),
        has(JORNADAS_PRODUCT_ID) ? optional(getForms(token)) : Promise.resolve(null),
        has(JORNADAS_PRODUCT_ID) ? optional(getResponses(token)) : Promise.resolve(null),
      ]);
      setData({
        company, products, agenda, benefits, structure, employments, cases, requests,
        jornadas: forms && responses ? { forms: forms.forms.length, responses: responses.responses.length } : null,
      });
    } catch {
      setError('Não foi possível carregar a visão geral da empresa.');
    }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  if (!user) return null;

  return (
    <AppShell eyebrow="Visão geral" title={data?.company.name ?? 'Visão geral'} description="Um resumo do que está acontecendo na empresa: pendências, próximas datas, pessoas e benefícios." navigation={companyNavigation}>
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : !data ? <LoadingState /> : <OverviewContent data={data} />}
    </AppShell>
  );
}

function OverviewContent({ data }: { data: Overview }) {
  const today = iso(new Date());
  const in15 = shiftDays(15);
  const monthPrefix = today.slice(0, 7);

  const agenda = data.agenda ?? [];
  const overduePlan = agenda.filter((entry) => entry.overdue && entry.source === 'plano');
  const overdueJourney = agenda.filter((entry) => entry.overdue && entry.source === 'jornada');
  const upcoming = agenda.filter((entry) => entry.status === 'scheduled' && entry.date >= today && entry.date <= in15).slice(0, 7);
  const planThisMonth = agenda.filter((entry) => entry.source === 'plano' && entry.date.startsWith(monthPrefix));
  const planDone = planThisMonth.filter((entry) => entry.status === 'done').length;

  const activeBenefits = (data.benefits ?? []).filter((benefit) => benefit.active);
  const monthlyCost = activeBenefits.reduce((sum, benefit) => sum + (benefit.monthly_estimate ?? 0), 0);
  const benefitsWithoutPeople = activeBenefits.filter((benefit) => benefit.eligible_count === 0);

  const activeEmployments = (data.employments ?? []).filter((employment) => employment.status === 'active');
  const units = data.structure?.units.length ?? 0;
  const areas = data.structure?.areas.length ?? 0;
  const positions = data.structure?.positions.length ?? 0;

  const newCases = (data.cases ?? []).filter((item) => item.status === 'recebido');
  const casesInReview = (data.cases ?? []).filter((item) => item.status === 'em_analise');
  const pendingRequests = (data.requests ?? []).filter((request) => request.status === 'pending');

  const attention: Attention[] = [
    overduePlan.length ? { key: 'plan', icon: AlertTriangle, text: `${overduePlan.length} ação(ões) do plano atrasada(s)`, to: '/agenda' } : null,
    overdueJourney.length ? { key: 'journey', icon: RouteIcon, text: `${overdueJourney.length} entrega(s) da jornada atrasada(s)`, to: '/agenda' } : null,
    newCases.length ? { key: 'cases', icon: ShieldAlert, text: `${newCases.length} denúncia(s) nova(s) aguardando análise`, to: '/integrity' } : null,
    pendingRequests.length ? { key: 'requests', icon: ShieldCheck, text: `${pendingRequests.length} pedido(s) de permissão aguardando a Turi`, to: '/company/access' } : null,
    data.structure && units === 0 ? { key: 'structure', icon: Network, text: 'A estrutura da empresa ainda não foi cadastrada', to: '/organization' } : null,
    benefitsWithoutPeople.length ? { key: 'benefits', icon: Gift, text: `${benefitsWithoutPeople.length} benefício(s) ativo(s) sem ninguém com direito`, to: '/benefits' } : null,
  ].filter((item): item is Attention => item !== null);

  const contracted = data.products.products;

  return (
    <div className="ch-layout">
      <section className="panel ch-company">
        <CompanyAvatar name={data.company.name} size="lg" />
        <div className="ch-company__copy">
          <strong>{data.company.name}</strong>
          <span>{data.company.email}</span>
        </div>
        <div className="ch-company__products">
          {contracted.length ? contracted.map((product) => <StatusPill key={product.id} tone="success">{product.name}</StatusPill>) : <StatusPill tone="muted">Nenhum produto contratado</StatusPill>}
        </div>
      </section>

      <SectionPanel title="Precisa de atenção" eyebrow={attention.length ? `${attention.length} item(ns)` : 'Tudo em dia'}>
        {attention.length ? (
          <div className="ch-attention">
            {attention.map(({ key, icon: Icon, text, to }) => (
              <Link key={key} to={to} className="ch-attention__item">
                <Icon size={17} aria-hidden />
                <span>{text}</span>
                <ArrowRight size={15} aria-hidden />
              </Link>
            ))}
          </div>
        ) : <p className="ch-ok"><CheckCircle2 size={16} aria-hidden />Nada pendente agora.</p>}
      </SectionPanel>

      <div className="stats-grid">
        <StatCard label="Colaboradores" value={data.employments ? activeEmployments.length : '—'} meta="Vínculos ativos" icon={<Users size={18} />} />
        <StatCard label="Estrutura" value={data.structure ? `${units} unid.` : '—'} meta={data.structure ? `${areas} áreas · ${positions} cargos` : 'Sem acesso'} icon={<Building2 size={18} />} />
        <StatCard label="Benefícios ativos" value={data.benefits ? activeBenefits.length : '—'} meta={data.benefits ? `${formatMoney(monthlyCost)} por mês` : 'Sem acesso'} icon={<Gift size={18} />} />
        <StatCard label="Plano de ação no mês" value={data.agenda ? `${planDone}/${planThisMonth.length}` : '—'} meta={planThisMonth.length ? `${Math.round((planDone / planThisMonth.length) * 100)}% feito` : 'Nada previsto este mês'} icon={<CalendarDays size={18} />} />
      </div>

      <div className="ch-columns">
        <SectionPanel title="Próximos 15 dias" eyebrow="Agenda" action={<Link className="ch-link" to="/agenda">Ver agenda</Link>}>
          {data.agenda === null ? <p className="ch-muted">Sem acesso à agenda.</p> : upcoming.length ? (
            <ul className="ch-list">
              {upcoming.map((entry) => (
                <li key={entry.id}>
                  <span className={`agd-dot agd-dot--${entry.item_type}`} aria-hidden />
                  <span className="ch-list__copy">
                    <strong>{entry.title}</strong>
                    <span>{shortDate(entry.date)} · {entry.source === 'jornada' ? (entry.section_title ?? 'Jornada') : AGENDA_TYPE_LABEL[entry.item_type]}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="ch-muted">Nada marcado para os próximos 15 dias.</p>}
        </SectionPanel>

        <SectionPanel title="Benefícios" eyebrow={data.benefits ? `${formatMoney(monthlyCost)} por mês` : 'Benefícios'} action={<Link className="ch-link" to="/benefits">Ver todos</Link>}>
          {data.benefits === null ? <p className="ch-muted">Sem acesso aos benefícios.</p> : activeBenefits.length ? (
            <ul className="ch-list">
              {activeBenefits.slice(0, 6).map((benefit) => (
                <li key={benefit.id}>
                  <Gift size={15} className="ch-list__icon" aria-hidden />
                  <span className="ch-list__copy">
                    <strong>{benefit.name}</strong>
                    <span>{benefit.eligible_count ?? 0} pessoa(s) com direito{benefit.is_psychosocial ? ' · NR-01' : ''}</span>
                  </span>
                  <span className="ch-list__value">{formatMoney(benefit.monthly_estimate ?? 0)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="ch-muted">Nenhum benefício cadastrado. <Link className="ch-link" to="/benefits">Cadastrar</Link></p>}
        </SectionPanel>
      </div>

      <SectionPanel title="Produtos" eyebrow={`${contracted.length} contratado(s)`}>
        {contracted.length ? (
          <div className="ch-products">
            {contracted.map((product) => {
              if (product.id === JORNADAS_PRODUCT_ID) {
                return (
                  <Link key={product.id} to="/company/jornadas" className="ch-product">
                    <RouteIcon size={18} aria-hidden />
                    <span className="ch-product__copy"><strong>{product.name}</strong><span>{data.jornadas ? `${data.jornadas.forms} formulário(s) · ${data.jornadas.responses} resposta(s)` : 'Jornadas, formulários e entregas'}</span></span>
                    <ArrowRight size={15} aria-hidden />
                  </Link>
                );
              }
              if (product.id === INTEGRITY_PRODUCT_ID) {
                return (
                  <Link key={product.id} to="/integrity" className="ch-product">
                    <ShieldAlert size={18} aria-hidden />
                    <span className="ch-product__copy"><strong>{product.name}</strong><span>{data.cases ? `${newCases.length} nova(s) · ${casesInReview.length} em análise · ${data.cases.length} no total` : 'Relatos e acompanhamento'}</span></span>
                    <ArrowRight size={15} aria-hidden />
                  </Link>
                );
              }
              return (
                <div key={product.id} className="ch-product ch-product--static">
                  <Sparkles size={18} aria-hidden />
                  <span className="ch-product__copy"><strong>{product.name}</strong><span>{product.description || 'Operado pela Turi'}</span></span>
                </div>
              );
            })}
          </div>
        ) : <p className="ch-muted">A empresa ainda não contratou produtos. O plano de ação, os benefícios e a gestão organizacional já estão disponíveis.</p>}
      </SectionPanel>
    </div>
  );
}
