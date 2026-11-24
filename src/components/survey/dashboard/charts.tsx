import { useState } from 'react';

/**
 * Graficos do dashboard de pesquisas. Paleta validada (scripts do guia de dataviz, superficie #fffdfa):
 * - serie unica: laranja #e8710a
 * - gestores x colaboradores (ordem fixa): roxo #6a4bb0, laranja #e8710a
 * - NPS (divergente): detratores #e34948, neutros cinza, promotores #2a78d6
 */
export const SERIES = { single: '#e8710a', manager: '#6a4bb0', employee: '#e8710a' };
export const NPS_COLORS = { detractors: '#e34948', passives: '#cfcbc4', promoters: '#2a78d6' };

function dateLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

/** Respostas por dia (colunas) com o acumulado no tooltip. */
export function ParticipationChart({ timeline }: { timeline: { date: string; responses: number; cumulative: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!timeline.length) return null;
  const max = Math.max(1, ...timeline.map((d) => d.responses));
  const ticks = [0, Math.ceil(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const labelEvery = Math.max(1, Math.ceil(timeline.length / 6));
  // A ultima data so ganha rotulo se nao encostar no rotulo anterior.
  const showLabel = (i: number) => i % labelEvery === 0 || (i === timeline.length - 1 && (timeline.length - 1) % labelEvery >= labelEvery / 2 + 1);
  const active = hover !== null ? timeline[hover] : null;
  return (
    <figure className="sd-chart" aria-label="Respostas por dia">
      <div className="sd-cols">
        <div className="sd-cols__axis" aria-hidden>{[...ticks].reverse().map((t) => <span key={t}>{t}</span>)}</div>
        <div className="sd-cols__plot" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => <span key={t} className="sd-cols__grid" style={{ bottom: `${(t / max) * 100}%` }} aria-hidden />)}
          {timeline.map((d, i) => (
            <button key={d.date} type="button" className={`sd-cols__slot${hover === i ? ' is-hover' : ''}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              aria-label={`${dateLabel(d.date)}: ${d.responses} resposta(s), ${d.cumulative} no total`}>
              <span className="sd-cols__bar" style={{ height: `${(d.responses / max) * 100}%`, background: SERIES.single }} />
            </button>
          ))}
          {active ? (
            <div className="sd-tooltip" style={{ left: `${((hover! + 0.5) / timeline.length) * 100}%` }} role="status">
              <strong>{dateLabel(active.date)}</strong>
              <span>{active.responses} {active.responses === 1 ? 'resposta' : 'respostas'} no dia</span>
              <span>{active.cumulative} no total</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="sd-cols__x" aria-hidden>
        {timeline.map((d, i) => <span key={d.date}>{showLabel(i) ? dateLabel(d.date) : ''}</span>)}
      </div>
    </figure>
  );
}

/** Ranking horizontal de favorabilidade (0-100%), do menor para o maior. */
export function FavorabilityChart({ rows }: { rows: { id: string; label: string; value: number; detail?: string }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <ul className="sd-hbars" aria-label="Favorabilidade por afirmação">
      {rows.map((row) => (
        <li key={row.id} className={hover === row.id ? 'is-hover' : ''} onMouseEnter={() => setHover(row.id)} onMouseLeave={() => setHover(null)}>
          <span className="sd-hbars__label" title={row.label}>{row.label}</span>
          <span className="sd-hbars__track" tabIndex={0} onFocus={() => setHover(row.id)} onBlur={() => setHover(null)}
            aria-label={`${row.label}: ${row.value}% favorável${row.detail ? `, ${row.detail}` : ''}`}>
            <span className="sd-hbars__fill" style={{ width: `${Math.max(row.value, 1)}%`, background: SERIES.single }} />
            {hover === row.id && row.detail ? <span className="sd-tooltip sd-tooltip--inline" role="status">{row.detail}</span> : null}
          </span>
          <span className="sd-hbars__value">{row.value}%</span>
        </li>
      ))}
    </ul>
  );
}

/** NPS: barra segmentada detratores | neutros | promotores, com legenda e numeros. */
export function NpsBar({ nps }: { nps: { promoters: number; passives: number; detractors: number; total: number } }) {
  const parts = [
    { key: 'detractors', label: 'Detratores (0–6)', value: nps.detractors, color: NPS_COLORS.detractors },
    { key: 'passives', label: 'Neutros (7–8)', value: nps.passives, color: NPS_COLORS.passives },
    { key: 'promoters', label: 'Promotores (9–10)', value: nps.promoters, color: NPS_COLORS.promoters },
  ];
  return (
    <div className="sd-nps">
      <div className="sd-nps__bar" role="img" aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(', ')}>
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.key} style={{ flexGrow: p.value, background: p.color }} title={`${p.label}: ${p.value} (${Math.round((p.value * 100) / nps.total)}%)`} />
        ))}
      </div>
      <ul className="sd-legend">
        {parts.map((p) => (
          <li key={p.key}><span className="sd-legend__swatch" style={{ background: p.color }} aria-hidden />{p.label}<b>{Math.round((p.value * 100) / nps.total)}%</b></li>
        ))}
      </ul>
    </div>
  );
}

/** Gestores x colaboradores por afirmacao (barras agrupadas, legenda + valores). */
export function SegmentChart({ rows, groups }: { rows: { id: string; label: string; values: Record<string, number | undefined> }[]; groups: { role: string; label: string }[] }) {
  const color = (role: string) => (role === 'manager' ? SERIES.manager : SERIES.employee);
  return (
    <div className="sd-segments">
      <ul className="sd-legend">
        {groups.map((g) => <li key={g.role}><span className="sd-legend__swatch" style={{ background: color(g.role) }} aria-hidden />{g.label}</li>)}
      </ul>
      <ul className="sd-hbars sd-hbars--grouped">
        {rows.map((row) => (
          <li key={row.id}>
            <span className="sd-hbars__label" title={row.label}>{row.label}</span>
            <span className="sd-hbars__stack">
              {groups.map((g) => {
                const value = row.values[g.role];
                return (
                  <span key={g.role} className="sd-hbars__pair">
                    <span className="sd-hbars__track" title={`${g.label}: ${value ?? '—'}%`}>
                      <span className="sd-hbars__fill" style={{ width: `${Math.max(value ?? 0, 1)}%`, background: color(g.role) }} />
                    </span>
                    <span className="sd-hbars__value">{value ?? '—'}%</span>
                  </span>
                );
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
