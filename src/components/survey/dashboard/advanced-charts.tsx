import { useState } from 'react';

import { NPS_COLORS, SERIES } from './charts';

/** Cores divergentes (mesmos polos validados do NPS): desfavoravel vermelho, neutro cinza, favoravel azul. */
export const LIKERT = { unfavorable: NPS_COLORS.detractors, neutral: NPS_COLORS.passives, favorable: NPS_COLORS.promoters };

function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
/** 0-100 -> vermelho (0) ... cinza claro (50) ... azul (100). */
export function divergingColor(value: number) {
  const mid = '#eeebe6';
  return value < 50 ? mix(LIKERT.unfavorable, mid, value / 50) : mix(mid, LIKERT.favorable, (value - 50) / 50);
}
function inkFor(value: number) {
  return value <= 22 || value >= 78 ? '#fff' : '#21172d';
}

/** Medidor semicircular do indice de bem-estar (favorabilidade geral). */
export function Gauge({ value, label }: { value: number; label: string }) {
  const r = 80, cx = 100, cy = 92, len = Math.PI * r;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <figure className="sd-gauge" aria-label={`${label}: ${value}%`}>
      <svg viewBox="-14 0 228 112" role="img">
        <path d={arc} fill="none" stroke="var(--tr-surface-3)" strokeWidth="14" strokeLinecap="round" />
        <path d={arc} fill="none" stroke={SERIES.single} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(value / 100) * len} ${len}`} />
        {[0, 50, 100].map((tick) => {
          const angle = Math.PI * (1 - tick / 100);
          return <text key={tick} x={cx + (r + 16) * Math.cos(angle)} y={cy - (r + 16) * Math.sin(angle) + 4} textAnchor="middle" className="sd-gauge__tick">{tick}</text>;
        })}
        <text x={cx} y={cy - 12} textAnchor="middle" className="sd-gauge__value">{value}%</text>
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

/** Adesao acumulada (% do publico) ao longo dos dias, com a linha de meta. */
export function AdherenceChart({ timeline, eligible, target = 70 }: { timeline: { date: string; responses: number; cumulative: number }[]; eligible: number; target?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!timeline.length || !eligible) return null;
  const W = 600, H = 200, P = { l: 34, r: 12, t: 12, b: 26 };
  const pts = timeline.map((d, i) => ({
    x: P.l + (timeline.length === 1 ? (W - P.l - P.r) / 2 : (i / (timeline.length - 1)) * (W - P.l - P.r)),
    y: P.t + (1 - Math.min(100, (d.cumulative * 100) / eligible) / 100) * (H - P.t - P.b),
    pct: Math.min(100, Math.round((d.cumulative * 100) / eligible)), d,
  }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  const area = `${line} L ${pts[pts.length - 1].x} ${H - P.b} L ${pts[0].x} ${H - P.b} Z`;
  const yOf = (v: number) => P.t + (1 - v / 100) * (H - P.t - P.b);
  const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  const every = Math.max(1, Math.ceil(timeline.length / 6));
  const active = hover !== null ? pts[hover] : null;
  return (
    <figure className="sd-chart sd-svgchart" aria-label="Adesão acumulada">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" onMouseLeave={() => setHover(null)}>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={yOf(v)} y2={yOf(v)} className="sd-grid" />
            <text x={P.l - 6} y={yOf(v) + 4} textAnchor="end" className="sd-axis">{v}%</text>
          </g>
        ))}
        <line x1={P.l} x2={W - P.r} y1={yOf(target)} y2={yOf(target)} className="sd-target" />
        <text x={P.l + 6} y={yOf(target) - 5} className="sd-target__label">meta {target}%</text>
        <path d={area} fill={SERIES.single} opacity="0.12" />
        <path d={line} fill="none" stroke={SERIES.single} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (i % every === 0 || i === pts.length - 1) && (pts.length - 1 - i >= every / 2 || i === pts.length - 1) ? (
          <text key={p.d.date} x={p.x} y={H - 6} textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'} className="sd-axis">{fmt(p.d.date)}</text>
        ) : null)}
        {active ? (
          <>
            <line x1={active.x} x2={active.x} y1={P.t} y2={H - P.b} className="sd-crosshair" />
            <circle cx={active.x} cy={active.y} r="5" fill={SERIES.single} stroke="#fffdfa" strokeWidth="2" />
          </>
        ) : null}
        {pts.map((p, i) => (
          <rect key={`hit-${p.d.date}`} x={p.x - (W - P.l - P.r) / Math.max(1, pts.length - 1) / 2} y={P.t} width={(W - P.l - P.r) / Math.max(1, pts.length - 1)} height={H - P.t - P.b}
            fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {active ? (
        <div className="sd-tooltip sd-tooltip--chart" style={{ left: `${(active.x / W) * 100}%` }} role="status">
          <strong>{fmt(active.d.date)}</strong>
          <span>{active.pct}% do público respondeu</span>
          <span>{active.d.responses} {active.d.responses === 1 ? 'resposta' : 'respostas'} no dia · {active.d.cumulative} no total</span>
        </div>
      ) : null}
    </figure>
  );
}

/** Barras Likert divergentes: desfavoravel para a esquerda, favoravel para a direita, neutro no centro. */
export function LikertChart({ rows }: { rows: { question_id: string; title: string; unfavorable: number; neutral: number; favorable: number; responses: number; benchmark?: number | null }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="sd-likert">
      <ul className="sd-legend">
        <li><span className="sd-legend__swatch" style={{ background: LIKERT.unfavorable }} aria-hidden />Discorda</li>
        <li><span className="sd-legend__swatch" style={{ background: LIKERT.neutral }} aria-hidden />Neutro</li>
        <li><span className="sd-legend__swatch" style={{ background: LIKERT.favorable }} aria-hidden />Concorda</li>
      </ul>
      <ul className="sd-likert__rows">
        {rows.map((row) => (
          <li key={row.question_id} onMouseEnter={() => setHover(row.question_id)} onMouseLeave={() => setHover(null)}>
            <span className="sd-likert__label" title={row.title}>{row.title}</span>
            <span className="sd-likert__bar" tabIndex={0} aria-label={`${row.title}: ${row.unfavorable}% discorda, ${row.neutral}% neutro, ${row.favorable}% concorda`}
              onFocus={() => setHover(row.question_id)} onBlur={() => setHover(null)}>
              <span className="sd-likert__half sd-likert__half--neg">
                <span style={{ width: `${row.unfavorable + row.neutral / 2}%` }}>
                  <span style={{ flexGrow: row.unfavorable, background: LIKERT.unfavorable }} />
                  <span style={{ flexGrow: row.neutral / 2, background: LIKERT.neutral }} />
                </span>
              </span>
              <span className="sd-likert__axis" aria-hidden />
              <span className="sd-likert__half sd-likert__half--pos">
                <span style={{ width: `${row.favorable + row.neutral / 2}%` }}>
                  <span style={{ flexGrow: row.neutral / 2, background: LIKERT.neutral }} />
                  <span style={{ flexGrow: row.favorable, background: LIKERT.favorable }} />
                </span>
              </span>
              {hover === row.question_id ? (
                <span className="sd-tooltip sd-tooltip--inline" role="status">
                  <strong>{row.favorable}% concorda</strong>
                  <span>{row.neutral}% neutro · {row.unfavorable}% discorda · {row.responses} respostas</span>
                  {row.benchmark !== undefined && row.benchmark !== null ? <span>média das outras empresas: {row.benchmark}%</span> : null}
                </span>
              ) : null}
            </span>
            <span className="sd-likert__values"><b className="is-neg">{row.unfavorable}%</b><b className="is-pos">{row.favorable}%</b></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const QUADRANT_LABEL = { priority: 'Agir primeiro', strength: 'Pontos fortes', monitor: 'Acompanhar', maintain: 'Manter' };

/** Matriz de prioridades: favorabilidade (x) x impacto no NPS (y). Pontos numerados, lista ao lado. */
export function PriorityMatrix({ items }: { items: { question_id: string; title: string; favorability: number; impact: number; quadrant: keyof typeof QUADRANT_LABEL }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 420, H = 300, P = { l: 40, r: 14, t: 14, b: 38 };
  const maxImpact = Math.max(0.6, ...items.map((i) => i.impact));
  const x = (v: number) => P.l + (v / 100) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - v / maxImpact) * (H - P.t - P.b);
  const midY = y(0.3);
  return (
    <div className="sd-matrix">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Matriz de prioridades">
        <rect x={P.l} y={P.t} width={x(50) - P.l} height={midY - P.t} className="sd-matrix__q sd-matrix__q--priority" />
        <text x={P.l + 8} y={P.t + 16} className="sd-matrix__qlabel sd-matrix__qlabel--priority">{QUADRANT_LABEL.priority}</text>
        <text x={W - P.r - 8} y={P.t + 16} textAnchor="end" className="sd-matrix__qlabel">{QUADRANT_LABEL.strength}</text>
        <text x={P.l + 8} y={H - P.b - 8} className="sd-matrix__qlabel">{QUADRANT_LABEL.monitor}</text>
        <text x={W - P.r - 8} y={H - P.b - 8} textAnchor="end" className="sd-matrix__qlabel">{QUADRANT_LABEL.maintain}</text>
        <line x1={x(50)} x2={x(50)} y1={P.t} y2={H - P.b} className="sd-matrix__divider" />
        <line x1={P.l} x2={W - P.r} y1={midY} y2={midY} className="sd-matrix__divider" />
        <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} className="sd-matrix__axisline" />
        <line x1={P.l} x2={P.l} y1={P.t} y2={H - P.b} className="sd-matrix__axisline" />
        {[0, 50, 100].map((v) => <text key={v} x={x(v)} y={H - P.b + 14} textAnchor="middle" className="sd-axis">{v}%</text>)}
        <text x={(P.l + W - P.r) / 2} y={H - 4} textAnchor="middle" className="sd-axis sd-axis--title">Favorabilidade →</text>
        <text x={12} y={(P.t + H - P.b) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(P.t + H - P.b) / 2})`} className="sd-axis sd-axis--title">Impacto no NPS →</text>
        {items.map((item, i) => (
          <g key={item.question_id} onMouseEnter={() => setHover(item.question_id)} onMouseLeave={() => setHover(null)} className="sd-matrix__dot">
            <circle cx={x(item.favorability)} cy={y(item.impact)} r={hover === item.question_id ? 13 : 11}
              fill={item.quadrant === 'priority' ? LIKERT.unfavorable : '#6a4bb0'} stroke="#fffdfa" strokeWidth="2" />
            <text x={x(item.favorability)} y={y(item.impact) + 4} textAnchor="middle" className="sd-matrix__num">{i + 1}</text>
          </g>
        ))}
      </svg>
      <ol className="sd-matrix__list">
        {items.map((item, i) => (
          <li key={item.question_id} className={hover === item.question_id ? 'is-hover' : ''} onMouseEnter={() => setHover(item.question_id)} onMouseLeave={() => setHover(null)}>
            <span className={`sd-matrix__badge${item.quadrant === 'priority' ? ' is-priority' : ''}`}>{i + 1}</span>
            <span><strong>{item.title}</strong><em>{QUADRANT_LABEL[item.quadrant]} · {item.favorability}% favorável · impacto {item.impact.toLocaleString('pt-BR')}</em></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Mapa de calor: favorabilidade por afirmacao (linhas) x empresa/perfil (colunas), com o numero na celula. */
export function Heatmap({ columns, rows }: { columns: { id: string; label: string; highlight?: boolean }[]; rows: { id: string; title: string; values: Record<string, number | null | undefined> }[] }) {
  return (
    <div className="sd-heat-wrap">
      <table className="sd-heat">
        <thead>
          <tr><th />{columns.map((c) => <th key={c.id} className={c.highlight ? 'is-current' : ''}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row" title={row.title}>{row.title}</th>
              {columns.map((c) => {
                const v = row.values[c.id];
                return (
                  <td key={c.id} style={v === null || v === undefined ? undefined : { background: divergingColor(v), color: inkFor(v) }} title={v === null || v === undefined ? 'Sem dados' : `${v}% favorável`}>
                    {v === null || v === undefined ? '—' : `${v}%`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sd-heat__scale" aria-hidden>
        <span>0%</span><span className="sd-heat__ramp" style={{ background: `linear-gradient(90deg, ${divergingColor(0)}, ${divergingColor(50)}, ${divergingColor(100)})` }} /><span>100% favorável</span>
      </div>
    </div>
  );
}

/** Evolucao entre versoes: uma linha so (favorabilidade ou NPS), valores rotulados. */
export function TrendChart({ points, field, label, domain }: { points: { label: string; date: string | null; favorability: number | null; nps: number | null; is_current: boolean; suppressed: boolean }[]; field: 'favorability' | 'nps'; label: string; domain: [number, number] }) {
  const W = 360, H = 170, P = { l: 30, r: 16, t: 22, b: 30 }, INSET = 26;
  const valid = points.map((p, i) => ({ ...p, i, v: p[field] })).filter((p) => p.v !== null && !p.suppressed) as (typeof points[number] & { i: number; v: number })[];
  if (valid.length < 2) return null;
  const x = (i: number) => P.l + INSET + (points.length === 1 ? 0.5 : i / (points.length - 1)) * (W - P.l - P.r - INSET * 2);
  const y = (v: number) => P.t + (1 - (v - domain[0]) / (domain[1] - domain[0])) * (H - P.t - P.b);
  const d = valid.map((p, k) => `${k ? 'L' : 'M'} ${x(p.i)} ${y(p.v)}`).join(' ');
  return (
    <figure className="sd-chart" aria-label={label}>
      <figcaption className="sd-trend__title">{label}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        {[domain[0], (domain[0] + domain[1]) / 2, domain[1]].map((v) => (
          <g key={v}><line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="sd-grid" /><text x={P.l - 6} y={y(v) + 4} textAnchor="end" className="sd-axis">{v}</text></g>
        ))}
        <path d={d} fill="none" stroke={SERIES.single} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {valid.map((p) => (
          <g key={p.label}>
            <circle cx={x(p.i)} cy={y(p.v)} r="5" fill={SERIES.single} stroke="#fffdfa" strokeWidth="2" />
            <text x={x(p.i)} y={y(p.v) - 10} textAnchor="middle" className="sd-trend__value">{field === 'nps' && p.v > 0 ? `+${p.v}` : p.v}{field === 'favorability' ? '%' : ''}</text>
          </g>
        ))}
        {points.map((p, i) => <text key={p.label} x={x(i)} y={H - 8} textAnchor="middle" className={`sd-axis${p.is_current ? ' sd-axis--strong' : ''}`}>{p.label}</text>)}
      </svg>
    </figure>
  );
}
