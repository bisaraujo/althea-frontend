import { BarChart3, CheckCircle2, ClipboardList, Lock, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getSurveysOverview, type SurveysOverview, type TargetCompany } from '../../../api/surveys';
import { plural } from '../../../lib/plural';
import { EmptyState } from '../../empty-state';
import { StatCard } from '../../stat-card';
import { ErrorState, LoadingState } from '../../ui';
import { SurveyStatusPill } from '../survey-status-pill';
import './dashboard.css';

function shortDate(value: string | null) {
  return value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR') : '—';
}

/** Painel geral das pesquisas aplicadas: KPIs somados e uma linha por pesquisa. */
export function SurveysOverviewView({ token, companies, surveyLink, showCompany = true }: {
  token: string;
  /** Com a lista, aparece o filtro por empresa (Turi). Sem ela, mostra a empresa da propria conta. */
  companies?: TargetCompany[];
  surveyLink: (surveyId: string) => string;
  showCompany?: boolean;
}) {
  const [companyId, setCompanyId] = useState('');
  const [data, setData] = useState<SurveysOverview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false); setData(null);
    getSurveysOverview(token, companyId || null).then(setData).catch(() => setFailed(true));
  }, [token, companyId]);

  if (failed) return <ErrorState message="Não foi possível carregar o painel." onRetry={() => setCompanyId((v) => v)} />;

  return (
    <div className="sd">
      {companies ? (
        <div className="sd-filter">
          <label><span>Empresa</span>
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">Todas as empresas</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
      ) : null}
      {!data ? <LoadingState /> : (
        <>
          <div className="stats-grid sd-kpis">
            <StatCard label="Pesquisas aplicadas" value={data.totals.applied} meta={`${plural(data.totals.open, 'aberta', 'abertas')} agora`} icon={<ClipboardList size={18} />} />
            <StatCard label="Respostas" value={data.totals.responses} meta="somando todas as pesquisas" icon={<Users size={18} />} />
            <StatCard label="Participação média" value={data.totals.participation !== null ? `${data.totals.participation}%` : '—'} meta="quem respondeu / público" icon={<BarChart3 size={18} />} />
            <StatCard label="Favorabilidade média" value={data.totals.favorability !== null ? `${data.totals.favorability}%` : '—'} meta={data.totals.nps !== null ? `NPS médio ${data.totals.nps > 0 ? '+' : ''}${data.totals.nps}` : 'pesquisas com escala'} icon={<Sparkles size={18} />} />
          </div>

          <section className="panel sd-panel">
            <header className="sd-panel__head"><h3>Pesquisas aplicadas</h3><span className="sd-panel__meta">abertas e encerradas · clique para ver o dashboard</span></header>
            {data.surveys.length ? (
              <div className="sd-table-wrap">
                <table className="sd-table sd-table--overview">
                  <thead>
                    <tr><th>Pesquisa</th>{showCompany ? <th>Empresa</th> : null}<th>Situação</th><th>Respostas</th><th>Participação</th><th>Favorabilidade</th><th>NPS</th><th>Última resposta</th></tr>
                  </thead>
                  <tbody>
                    {data.surveys.map((s) => (
                      <tr key={s.survey_id}>
                        <td data-label="Pesquisa"><Link to={surveyLink(s.survey_id)}><strong>{s.title}</strong></Link> <em>v{s.version}</em></td>
                        {showCompany ? <td data-label="Empresa">{s.company_name ?? '—'}</td> : null}
                        <td data-label="Situação"><SurveyStatusPill survey={{ status: s.status, company_id: s.company_id }} /></td>
                        <td data-label="Respostas">{s.responses}{s.eligible ? <em> / {s.eligible}</em> : null}</td>
                        <td data-label="Participação">{s.participation !== null ? `${s.participation}%` : '—'}</td>
                        <td data-label="Favorabilidade">{s.suppressed ? <span className="sd-muted">{s.responses ? <><Lock size={12} aria-hidden /> poucas respostas</> : 'sem respostas'}</span> : s.favorability !== null ? (
                          <span className="sd-inline-bar"><span className="sd-inline-bar__track"><span style={{ width: `${s.favorability}%` }} /></span><b>{s.favorability}%</b></span>
                        ) : '—'}</td>
                        <td data-label="NPS">{s.suppressed || s.nps === null ? '—' : s.nps > 0 ? `+${s.nps}` : s.nps}</td>
                        <td data-label="Última resposta">{shortDate(s.last_response)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={CheckCircle2} title="Nenhuma pesquisa aplicada ainda" description="Quando uma pesquisa for publicada, os resultados aparecem aqui." />}
          </section>
          <p className="sd-anon"><ShieldCheck size={15} aria-hidden />Respostas anônimas. Pesquisas com menos de 3 respostas não mostram resultados, para não identificar ninguém.</p>
        </>
      )}
    </div>
  );
}
