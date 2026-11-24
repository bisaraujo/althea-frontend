import {
  AlertTriangle, BarChart3, CheckCircle2, ClipboardPlus, Compass, Download, Gauge as GaugeIcon, GitCompareArrows, Info, Lightbulb, Lock,
  MessageSquareText, Search, ShieldCheck, Sparkles, Target, Users, X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { createPlanItem } from '../../../api/action-plan';
import { ApiError } from '../../../api/client';
import {
  canonicalType, getSurveyDashboard, getSurveyResults, QUESTION_TYPE_LABEL, type SurveyDashboard, type SurveyResults, YES_NO_OPTIONS,
} from '../../../api/surveys';
import { plural } from '../../../lib/plural';
import { StatCard } from '../../stat-card';
import { useToast } from '../../toast';
import { ErrorState, LoadingState, SegmentedFilter } from '../../ui';
import { SurveyResultsView } from '../survey-results';
import { AdherenceChart, Gauge, Heatmap, LikertChart, PriorityMatrix, TrendChart } from './advanced-charts';
import { NpsBar, SERIES } from './charts';
import './dashboard.css';
import './dashboard-advanced.css';

type Section = 'overview' | 'statements' | 'drivers' | 'comments' | 'compare';
type RoleFilter = 'all' | 'manager' | 'employee';

function csvCell(value: string | number) {
  const text = String(value);
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Planilha (CSV) com os resultados agregados por pergunta. */
function downloadCsv(title: string, results: SurveyResults) {
  const rows: (string | number)[][] = [['Pergunta', 'Tipo', 'Resposta', 'Quantidade', '% de quem respondeu']];
  for (const q of results.questions) {
    const kind = canonicalType(q.question_type);
    const type = QUESTION_TYPE_LABEL[q.question_type];
    const pct = (n: number) => (q.response_count ? Math.round((n * 100) / q.response_count) : 0);
    if (kind === 'single_choice' || kind === 'multiple_choice') {
      for (const option of q.options) rows.push([q.title, type, option, q.option_counts[option] ?? 0, pct(q.option_counts[option] ?? 0)]);
    } else if (kind === 'yes_no') {
      for (const option of YES_NO_OPTIONS) rows.push([q.title, type, option.label, q.option_counts[option.value] ?? 0, pct(q.option_counts[option.value] ?? 0)]);
    } else if (kind === 'scale' || kind === 'nps') {
      for (const [point, count] of Object.entries(q.distribution)) rows.push([q.title, type, point, count, pct(count)]);
      rows.push([q.title, type, kind === 'nps' && q.nps ? `NPS ${q.nps.score}` : `Média ${q.average ?? '—'}`, q.response_count, '']);
    } else if (kind === 'number') {
      rows.push([q.title, type, `Média ${q.average ?? '—'}`, q.response_count, '']);
    } else {
      for (const answer of q.text_answers) rows.push([q.title, type, answer, 1, '']);
    }
  }
  const csv = `﻿${rows.map((row) => row.map(csvCell).join(';')).join('\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `resultados_${title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const INSIGHT_ICON = { good: CheckCircle2, warning: AlertTriangle, neutral: Lightbulb };
const ZONE = (score: number) => (score >= 75 ? 'Zona de excelência' : score >= 50 ? 'Zona de qualidade' : score >= 0 ? 'Zona de aperfeiçoamento' : 'Zona crítica');
const INDEX_ZONE = (value: number) => (value >= 75 ? 'Muito favorável' : value >= 60 ? 'Favorável' : value >= 40 ? 'Em atenção' : 'Crítico');
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const ACTION_STATUS: Record<string, string> = { pending: 'a iniciar', in_progress: 'em andamento', completed: 'concluída', cancelled: 'cancelada' };
function isoInDays(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Dashboard de uma pesquisa: visao geral, afirmacoes, motivadores, comentarios e comparacao. */
export function SurveyDashboardView({ token, surveyId, title, companyId, canCreateActions = false, linkToSurvey }: {
  token: string; surveyId: string; title: string;
  /** Empresa da pesquisa (para criar acoes no plano). */
  companyId?: string | null;
  /** Turi: mostra "Criar ação no plano" nas recomendacoes. */
  canCreateActions?: boolean;
  linkToSurvey?: (surveyId: string) => string;
}) {
  const toast = useToast();
  const [role, setRole] = useState<RoleFilter>('all');
  const [section, setSection] = useState<Section>('overview');
  const [dashboard, setDashboard] = useState<SurveyDashboard | null>(null);
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [created, setCreated] = useState<Set<string>>(new Set());
  const [term, setTerm] = useState<string | null>(null);
  const [commentQuery, setCommentQuery] = useState('');

  useEffect(() => {
    setFailed(false); setDashboard(null);
    getSurveyDashboard(token, surveyId, role === 'all' ? null : role).then(setDashboard).catch(() => setFailed(true));
  }, [token, surveyId, role, reload]);
  useEffect(() => { getSurveyResults(token, surveyId).then(setResults).catch(() => setResults(null)); }, [token, surveyId, reload]);
  useEffect(() => { setRole('all'); setSection('overview'); setTerm(null); }, [surveyId]);

  const comments = useMemo(() => {
    if (!dashboard) return [];
    const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return dashboard.comments.filter((c) => (!term || plain(c.text).includes(term)) && (!commentQuery || plain(c.text).includes(plain(commentQuery))));
  }, [dashboard, term, commentQuery]);

  if (failed) return <ErrorState message="Não foi possível carregar o dashboard." onRetry={() => setReload((n) => n + 1)} />;
  if (!dashboard) return <LoadingState />;
  const d = dashboard;

  async function createAction(rec: SurveyDashboard['recommendations'][number]) {
    if (!companyId) return;
    try {
      await createPlanItem(token, companyId, {
        title: `Melhorar: ${rec.title}`.slice(0, 255), item_type: 'acao', recurrence_type: 'once',
        // Prazo de 60 dias: a acao entra na agenda e o KPI comeca a contar.
        start_date: isoInDays(60), due_at: isoInDays(60),
        description: `Criada a partir da pesquisa “${title}”. ${rec.reason}.`,
        indicator: `% favorável em “${rec.title}”`, initial_value: `${rec.favorability}%`, kpi_interval_months: 2, priority: rec.favorability < 40 ? 'alta' : 'media',
      });
      setCreated((current) => new Set(current).add(rec.question_id));
      toast.success('Ação criada no plano da empresa, com o indicador para acompanhar.');
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Não foi possível criar a ação.');
    }
  }

  const totalComments = d.comments.reduce((sum, c) => sum + c.count, 0);
  const sections: { value: Section; label: string; show: boolean }[] = [
    { value: 'overview', label: 'Visão geral', show: true },
    { value: 'statements', label: 'Afirmações', show: d.likert.length > 0 },
    { value: 'drivers', label: 'Motivadores', show: d.drivers.items.length > 0 || d.option_impact.length > 0 },
    { value: 'comments', label: `Comentários${totalComments ? ` (${totalComments})` : ''}`, show: d.comments.length > 0 },
    { value: 'compare', label: 'Comparação', show: d.comparison.length > 0 || d.trend.length > 0 },
  ];
  const visibleSections = sections.filter((s) => s.show);
  const current = visibleSections.some((s) => s.value === section) ? section : 'overview';

  const toolbar = (
    <div className="sd-toolbar">
      {visibleSections.length > 1 ? (
        <nav className="sd-subnav" aria-label="Seções do dashboard">
          {visibleSections.map((s) => (
            <button key={s.value} type="button" className={current === s.value ? 'is-active' : ''} aria-current={current === s.value ? 'page' : undefined} onClick={() => setSection(s.value)}>{s.label}</button>
          ))}
        </nav>
      ) : <span />}
      {d.role_filter_available ? (
        <SegmentedFilter<RoleFilter> label="Perfil" value={role} onChange={setRole}
          options={[{ value: 'all', label: 'Todos' }, { value: 'manager', label: 'Gestores' }, { value: 'employee', label: 'Colaboradores' }]} />
      ) : null}
    </div>
  );
  const anonymity = (
    <p className="sd-anon"><ShieldCheck size={15} aria-hidden />Respostas anônimas: ninguém (nem a Turi) consegue ver quem respondeu o quê. Os números só aparecem com {d.min_responses} ou mais respostas, por pesquisa e por recorte.</p>
  );
  const roleNote = role !== 'all' ? <p className="sd-role-note"><Users size={14} aria-hidden />Mostrando só <b>{role === 'manager' ? 'gestores' : 'colaboradores'}</b>. <button type="button" className="text-button" onClick={() => setRole('all')}>Ver todos</button></p> : null;

  if (d.suppressed) {
    return (
      <div className="sd">
        {toolbar}
        <div className="sd-suppressed">
          <Lock size={22} aria-hidden />
          <div>
            <strong>{d.responses ? `Só ${plural(d.responses, 'resposta', 'respostas')} até agora` : 'Ainda sem respostas'}</strong>
            <p>Para proteger o anonimato, os resultados aparecem a partir de {d.min_responses} respostas. Com menos, daria para saber o que cada pessoa respondeu.{d.eligible ? ` Público: ${plural(d.eligible, 'pessoa', 'pessoas')}.` : ''}</p>
          </div>
        </div>
        {d.comparison.length ? <ComparisonTable d={d} linkToSurvey={linkToSurvey} /> : null}
        {anonymity}
      </div>
    );
  }

  return (
    <div className="sd">
      {toolbar}
      {roleNote}

      {current === 'overview' ? (
        <>
          <div className="sd-hero">
            <section className="panel sd-panel sd-hero__gauge">
              <header className="sd-panel__head"><h3><GaugeIcon size={17} aria-hidden />Índice de bem-estar</h3></header>
              {d.favorability !== null ? <Gauge value={d.favorability} label={INDEX_ZONE(d.favorability)} /> : <p className="sd-muted">Sem afirmações de escala nesta pesquisa.</p>}
              <p className="sd-muted sd-center"><Info size={13} aria-hidden /> % médio de concordância nas afirmações</p>
            </section>
            <div className="sd-hero__tiles">
              <StatCard label="Respostas" value={d.responses} meta={d.eligible ? `de ${plural(d.eligible, 'pessoa', 'pessoas')} no público` : 'Público não definido'} icon={<Users size={18} />} />
              <StatCard label="Participação" value={d.participation !== null ? `${d.participation}%` : '—'} meta={d.participation === null ? 'Sem público para comparar' : d.participation < 50 ? 'Abaixo da metade' : d.participation >= 75 ? 'Boa adesão' : 'Adesão moderada'} icon={<BarChart3 size={18} />} />
              <StatCard label="NPS" value={d.nps ? signed(d.nps.score) : '—'} meta={d.nps ? ZONE(d.nps.score) : 'Sem pergunta de NPS'} icon={<Sparkles size={18} />} />
              <StatCard label="Comentários" value={totalComments} meta={d.themes.terms.length ? `tema mais citado: “${d.themes.terms[0].term}”` : 'respostas abertas'} icon={<MessageSquareText size={18} />} />
            </div>
          </div>

          {d.insights.length ? (
            <section className="panel sd-panel">
              <header className="sd-panel__head"><h3><Lightbulb size={17} aria-hidden />O que os dados mostram</h3></header>
              <ul className="sd-insights">
                {d.insights.map((insight, index) => {
                  const Icon = INSIGHT_ICON[insight.tone];
                  return <li key={index} className={`sd-insight sd-insight--${insight.tone}`}><Icon size={17} aria-hidden /><span><strong>{insight.title}</strong> {insight.text}</span></li>;
                })}
              </ul>
            </section>
          ) : null}

          {d.recommendations.length ? (
            <section className="panel sd-panel">
              <header className="sd-panel__head"><h3><Target size={17} aria-hidden />Onde agir</h3><span className="sd-panel__meta">afirmações com menor concordância ou que mais pesam no NPS</span></header>
              <ul className="sd-recs">
                {d.recommendations.map((rec, index) => (
                  <li key={rec.question_id}>
                    <span className="sd-recs__rank">{index + 1}</span>
                    <span className="sd-recs__copy"><strong>{rec.title}</strong><em>{rec.favorability}% favorável · {rec.reason}</em></span>
                    {rec.action || created.has(rec.question_id) ? (
                      <span className="sd-recs__done"><CheckCircle2 size={15} aria-hidden />No plano{rec.action ? ` · ${ACTION_STATUS[rec.action.status] ?? rec.action.status}` : ''}</span>
                    ) : canCreateActions && companyId && role === 'all' ? (
                      created.has(rec.question_id)
                        ? null
                        : <button type="button" className="secondary-button" onClick={() => void createAction(rec)}><ClipboardPlus size={15} />Criar ação no plano</button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="sd-grid">
            {d.timeline.length && d.eligible ? (
              <section className="panel sd-panel">
                <header className="sd-panel__head"><h3>Adesão ao longo do tempo</h3><span className="sd-panel__meta">% do público que já respondeu</span></header>
                <AdherenceChart timeline={d.timeline} eligible={d.eligible} target={d.participation_target} />
              </section>
            ) : null}
            <section className="panel sd-panel">
              <header className="sd-panel__head"><h3>Participação por perfil</h3></header>
              <ul className="sd-progress">
                {d.participation_by_role.map((g) => (
                  <li key={g.role}>
                    <span className="sd-progress__label"><span className="sd-legend__swatch" style={{ background: g.role === 'manager' ? SERIES.manager : SERIES.employee }} aria-hidden />{g.label}</span>
                    <span className="sd-progress__track"><span style={{ width: `${g.participation ?? 0}%`, background: g.role === 'manager' ? SERIES.manager : SERIES.employee }} /></span>
                    <span className="sd-progress__value"><b>{g.participation ?? 0}%</b> {g.participants} de {g.eligible}</span>
                  </li>
                ))}
              </ul>
              {d.nps ? (
                <div className="sd-nps-block">
                  <div className="sd-nps-hero"><strong>{signed(d.nps.score)}</strong><span>NPS · {ZONE(d.nps.score)}</span></div>
                  <NpsBar nps={d.nps} />
                </div>
              ) : null}
            </section>
          </div>

          {d.highlights.length ? (
            <section className="panel sd-panel">
              <header className="sd-panel__head"><h3>Respostas mais escolhidas</h3></header>
              <ul className="sd-highlights">
                {d.highlights.map((h) => <li key={h.question_id}><span>{h.title}</span><strong>{h.option}</strong><em>{h.percent}% de {plural(h.responses, 'resposta', 'respostas')}</em></li>)}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      {current === 'statements' ? (
        <>
          <section className="panel sd-panel">
            <header className="sd-panel__head"><h3>Concordância por afirmação</h3><span className="sd-panel__meta">da menos para a mais favorável · passe o mouse para ver os números</span></header>
            <LikertChart rows={d.likert} />
          </section>
          {d.segments && !d.segments.hidden ? (
            <section className="panel sd-panel">
              <header className="sd-panel__head"><h3>Mapa de calor por perfil</h3><span className="sd-panel__meta">% favorável em cada afirmação</span></header>
              <Heatmap columns={d.segments.groups.map((g) => ({ id: g.role, label: `${g.label} (${g.responses})` }))}
                rows={d.scales.map((s) => ({ id: s.question_id, title: s.title, values: Object.fromEntries(d.segments!.groups.map((g) => [g.role, g.scales.find((x) => x.question_id === s.question_id)?.favorability])) }))} />
            </section>
          ) : d.segments?.hidden ? <p className="sd-muted"><Lock size={14} aria-hidden /> Recorte por perfil oculto: um dos grupos tem menos de {d.min_responses} respostas.</p> : null}
          <section className="sd-detail">
            <header className="sd-panel__head">
              <h3>Resultados por pergunta</h3>
              {results && !results.suppressed ? <button type="button" className="secondary-button" onClick={() => downloadCsv(title, results)}><Download size={15} />Baixar planilha</button> : null}
            </header>
            {role !== 'all' ? <p className="sd-muted"><Info size={13} aria-hidden /> O detalhe por pergunta mostra todos os perfis.</p> : null}
            {results ? <SurveyResultsView results={results} /> : <LoadingState />}
          </section>
        </>
      ) : null}

      {current === 'drivers' ? (
        <>
          {d.drivers.items.length ? (
            <section className="panel sd-panel">
              <header className="sd-panel__head">
                <h3><Compass size={17} aria-hidden />Matriz de prioridades</h3>
                <span className="sd-panel__meta"><Info size={13} aria-hidden />Impacto = o quanto a nota da afirmação acompanha a nota de recomendação (NPS), pessoa a pessoa</span>
              </header>
              <PriorityMatrix items={d.drivers.items} />
            </section>
          ) : d.drivers.available === false && d.nps ? (
            <p className="sd-muted"><Info size={14} aria-hidden /> A matriz de prioridades aparece a partir de {d.drivers.min_responses} respostas.</p>
          ) : null}
          {d.option_impact.length ? (
            <section className="panel sd-panel">
              <header className="sd-panel__head"><h3>O que muda a percepção</h3><span className="sd-panel__meta">favorabilidade de quem marcou a opção × de quem não marcou</span></header>
              <ul className="sd-impact">
                {d.option_impact.map((item) => (
                  <li key={`${item.question_id}-${item.option}`}>
                    <span className="sd-impact__copy"><strong>“{item.option}”</strong><em>{item.question} · {plural(item.picked, 'pessoa marcou', 'pessoas marcaram')}</em></span>
                    <span className="sd-impact__bars">
                      <span><i style={{ width: `${item.with_option}%`, background: item.difference < 0 ? '#e34948' : '#2a78d6' }} /><small><b>{item.with_option}%</b> marcou</small></span>
                      <span><i style={{ width: `${item.without_option}%`, background: '#cfcbc4' }} /><small><b>{item.without_option}%</b> não marcou</small></span>
                    </span>
                    <span className={`sd-impact__delta ${item.difference < 0 ? 'is-neg' : 'is-pos'}`}>{signed(item.difference)} pts</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      {current === 'comments' ? (
        <section className="panel sd-panel">
          <header className="sd-panel__head"><h3><MessageSquareText size={17} aria-hidden />Comentários</h3><span className="sd-panel__meta">em ordem alfabética, sem autor</span></header>
          {d.themes.terms.length ? (
            <div className="sd-themes" aria-label="Temas mais citados">
              {d.themes.terms.map((t) => {
                const max = d.themes.terms[0].count;
                return (
                  <button key={t.key} type="button" className={`sd-theme${term === t.key ? ' is-active' : ''}`} style={{ fontSize: `${0.8 + (t.count / max) * 0.45}rem` }}
                    onClick={() => setTerm(term === t.key ? null : t.key)} aria-pressed={term === t.key}>{t.term}<em>{t.count}</em></button>
                );
              })}
            </div>
          ) : null}
          <div className="sd-comment-search">
            <Search size={15} aria-hidden />
            <input value={commentQuery} onChange={(e) => setCommentQuery(e.target.value)} placeholder="Buscar nos comentários" aria-label="Buscar nos comentários" />
            {term ? <button type="button" className="sd-chip" onClick={() => setTerm(null)}>tema: {term}<X size={12} aria-hidden /></button> : null}
          </div>
          <p className="sd-muted">{plural(comments.reduce((s, c) => s + c.count, 0), 'comentário', 'comentários')}{term || commentQuery ? ' com esse filtro' : ''}</p>
          <ul className="sv-text-answers sd-comments">
            {comments.map((c) => <li key={c.text}><MessageSquareText size={14} aria-hidden /><span>{c.text}</span>{c.count > 1 ? <em className="sd-count">{c.count}×</em> : null}</li>)}
          </ul>
        </section>
      ) : null}

      {current === 'compare' ? (
        <>
          {d.trend.length ? (
            <section className="panel sd-panel">
              <header className="sd-panel__head"><h3><GitCompareArrows size={17} aria-hidden />Evolução entre aplicações</h3><span className="sd-panel__meta">versões desta pesquisa na mesma empresa</span></header>
              <div className="sd-grid sd-grid--even">
                <TrendChart points={d.trend} field="favorability" label="Índice de bem-estar (%)" domain={[0, 100]} />
                <TrendChart points={d.trend} field="nps" label="NPS" domain={[-100, 100]} />
              </div>
            </section>
          ) : null}
          {d.heatmap ? (
            <section className="panel sd-panel">
              <header className="sd-panel__head"><h3>Mapa de calor entre empresas</h3><span className="sd-panel__meta">% favorável por afirmação · só a Turi vê</span></header>
              <Heatmap columns={d.heatmap.columns.map((c) => ({ id: c.survey_id, label: `${c.company_name ?? '—'} (${c.responses})`, highlight: c.is_current }))}
                rows={d.heatmap.rows.map((r) => ({ id: r.key, title: r.title, values: r.values }))} />
            </section>
          ) : null}
          {d.comparison.length ? <ComparisonTable d={d} linkToSurvey={linkToSurvey} /> : null}
        </>
      ) : null}

      {anonymity}
    </div>
  );
}

function ComparisonTable({ d, linkToSurvey }: { d: SurveyDashboard; linkToSurvey?: (surveyId: string) => string }) {
  return (
    <section className="panel sd-panel">
      <header className="sd-panel__head"><h3>Comparação entre empresas</h3><span className="sd-panel__meta">mesma pesquisa enviada a várias empresas · só a Turi vê</span></header>
      <div className="sd-table-wrap">
        <table className="sd-table sd-table--overview">
          <thead><tr><th>Empresa</th><th>Respostas</th><th>Participação</th><th>Favorabilidade</th><th>NPS</th></tr></thead>
          <tbody>
            {d.comparison.map((row) => (
              <tr key={row.survey_id} className={row.is_current ? 'is-current' : ''}>
                <td data-label="Empresa">{linkToSurvey && !row.is_current ? <Link to={linkToSurvey(row.survey_id)}>{row.company_name}</Link> : <strong>{row.company_name}</strong>}{row.is_current ? <em> (esta)</em> : null}</td>
                <td data-label="Respostas">{row.responses}</td>
                <td data-label="Participação">{row.participation !== null ? `${row.participation}%` : '—'}</td>
                <td data-label="Favorabilidade">{row.suppressed ? <span className="sd-muted">{row.responses ? <><Lock size={12} aria-hidden /> poucas respostas</> : 'sem respostas'}</span> : row.favorability !== null ? (
                  <span className="sd-inline-bar"><span className="sd-inline-bar__track"><span style={{ width: `${row.favorability}%` }} /></span><b>{row.favorability}%</b></span>
                ) : '—'}</td>
                <td data-label="NPS">{row.suppressed || row.nps === null ? '—' : signed(row.nps)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
