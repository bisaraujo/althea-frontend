import { ArrowRight, CalendarDays, Gift, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { AGENDA_TYPE_LABEL, type AgendaEntry, getAgenda } from '../api/action-plan';
import { type Benefit, BENEFIT_TYPE_LABEL, listMyBenefits } from '../api/benefits';
import { publicReportUrl } from '../api/integrity';
import { INTEGRITY_PRODUCT_ID, useMyPermissions, useMyProducts } from '../api/workspace-access';
import { useAuth } from '../auth/auth-context';
import { SectionPanel } from '../components/section-panel';
import { LoadingState } from '../components/ui';
import './benefits-agenda.css';
import './company-home.css';

function iso(day: Date) {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

/**
 * Tela inicial de gestor e colaborador quando a empresa nao tem Jornadas: em vez de um aviso vazio,
 * o que vale para a pessoa hoje (beneficios, proximas acoes do plano, Canal de Denuncias).
 */
export function TeamHomeWithoutJornadas() {
  const { token, user } = useAuth();
  const companyId = user?.company_id ?? '';
  const permissions = useMyPermissions(token, companyId);
  const products = useMyProducts(token);
  const canSeePlan = Boolean(permissions?.has('plano_acao.view'));
  const [benefits, setBenefits] = useState<Benefit[] | null>(null);
  const [upcoming, setUpcoming] = useState<AgendaEntry[] | null>(null);

  useEffect(() => {
    if (!token) return;
    listMyBenefits(token).then(setBenefits).catch(() => setBenefits([]));
  }, [token]);

  useEffect(() => {
    if (!token || !companyId || !canSeePlan) return;
    const today = new Date();
    const until = new Date(); until.setDate(until.getDate() + 30);
    getAgenda(token, companyId, iso(today), iso(until))
      .then((agenda) => setUpcoming(agenda.entries.filter((entry) => entry.status === 'scheduled').slice(0, 6)))
      .catch(() => setUpcoming([]));
  }, [token, companyId, canSeePlan]);

  if (benefits === null || permissions === null) return <LoadingState />;

  return (
    <div className="ch-layout">
      <SectionPanel title="Seus benefícios" eyebrow={`${benefits.length} disponível(is)`} action={<Link className="ch-link" to="/benefits">Ver detalhes</Link>}>
        {benefits.length ? (
          <ul className="ch-list">
            {benefits.slice(0, 6).map((benefit) => (
              <li key={benefit.id}>
                <Gift size={15} className="ch-list__icon" aria-hidden />
                <span className="ch-list__copy">
                  <strong>{benefit.name}</strong>
                  <span>{benefit.how_to_use || BENEFIT_TYPE_LABEL[benefit.benefit_type] || 'Benefício'}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="ch-muted">Nenhum benefício cadastrado para você ainda. Quando a empresa cadastrar, ele aparece aqui.</p>}
      </SectionPanel>

      {canSeePlan ? (
        <SectionPanel title="Próximas ações do plano" eyebrow="Próximos 30 dias" action={<Link className="ch-link" to="/agenda">Ver agenda</Link>}>
          {upcoming === null ? <LoadingState /> : upcoming.length ? (
            <ul className="ch-list">
              {upcoming.map((entry) => (
                <li key={entry.id}>
                  <span className={`agd-dot agd-dot--${entry.item_type}`} aria-hidden />
                  <span className="ch-list__copy">
                    <strong>{entry.title}</strong>
                    <span>{new Date(`${entry.date}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} · {AGENDA_TYPE_LABEL[entry.item_type]}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="ch-muted">Nenhuma ação prevista para os próximos 30 dias.</p>}
        </SectionPanel>
      ) : null}

      {products?.has(INTEGRITY_PRODUCT_ID) && companyId ? (
        <SectionPanel title="Canal de Denúncias" eyebrow="Sigiloso">
          <p className="ch-muted">Viu ou passou por algo que não está certo? Você pode fazer um relato, inclusive sem se identificar.</p>
          <a className="ch-product" href={publicReportUrl(companyId)} target="_blank" rel="noreferrer" style={{ marginTop: '0.7rem' }}>
            <ShieldAlert size={18} aria-hidden />
            <span className="ch-product__copy"><strong>Fazer um relato</strong><span>Abre o formulário do Canal de Denúncias</span></span>
            <ArrowRight size={15} aria-hidden />
          </a>
        </SectionPanel>
      ) : null}

      {!canSeePlan && !benefits.length && !products?.has(INTEGRITY_PRODUCT_ID) ? (
        <p className="ch-muted"><CalendarDays size={14} aria-hidden /> Seu acesso está ativo. O que a empresa liberar para você aparece aqui e no menu.</p>
      ) : null}
    </div>
  );
}
