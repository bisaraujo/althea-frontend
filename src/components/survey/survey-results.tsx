import { MessageSquareText, Users } from 'lucide-react';

import { canonicalType, type QuestionResult, QUESTION_TYPE_LABEL, type SurveyResults, YES_NO_OPTIONS } from '../../api/surveys';
import { EmptyState } from '../empty-state';
import { plural } from '../../lib/plural';
import { QuestionTypeIcon } from './question-type-icon';

function percent(part: number, total: number) {
  return total ? Math.round((part * 100) / total) : 0;
}

function Bars({ rows, total }: { rows: { label: string; count: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <ul className="sv-bars">
      {rows.map((row) => (
        <li key={row.label}>
          <span className="sv-bars__label">{row.label}</span>
          <span className="sv-bars__track"><span className="sv-bars__fill" style={{ width: `${(row.count / max) * 100}%` }} /></span>
          <span className="sv-bars__value">{row.count} <em>({percent(row.count, total)}%)</em></span>
        </li>
      ))}
    </ul>
  );
}

function ResultBody({ result }: { result: QuestionResult }) {
  const kind = canonicalType(result.question_type);
  const total = result.response_count;
  if (!total) return <p className="sv-muted">Ainda sem respostas para esta pergunta.</p>;

  if (kind === 'single_choice' || kind === 'multiple_choice') {
    const known = result.options.map((option) => ({ label: option, count: result.option_counts[option] ?? 0 }));
    const extra = Object.entries(result.option_counts).filter(([label]) => !result.options.includes(label)).map(([label, count]) => ({ label, count }));
    return (
      <>
        <Bars rows={[...known, ...extra]} total={total} />
        {kind === 'multiple_choice' ? <p className="sv-muted">Cada pessoa pode marcar mais de uma opção; o percentual é sobre quem respondeu.</p> : null}
      </>
    );
  }
  if (kind === 'yes_no') {
    return <Bars rows={YES_NO_OPTIONS.map((option) => ({ label: option.label, count: result.option_counts[option.value] ?? 0 }))} total={total} />;
  }
  if (kind === 'scale' || kind === 'nps') {
    const rows = Object.entries(result.distribution).map(([label, count]) => ({ label, count }));
    return (
      <div className="sv-result-scale">
        <div className="sv-result-scale__summary">
          {kind === 'nps' && result.nps ? (
            <>
              <strong className={`sv-nps-score${result.nps.score >= 50 ? ' is-good' : result.nps.score < 0 ? ' is-bad' : ''}`}>{result.nps.score > 0 ? `+${result.nps.score}` : result.nps.score}</strong>
              <span>NPS</span>
              <ul className="sv-nps-split">
                <li><b>{result.nps.promoters}</b> {result.nps.promoters === 1 ? 'promotor' : 'promotores'}</li>
                <li><b>{result.nps.passives}</b> {result.nps.passives === 1 ? 'neutro' : 'neutros'}</li>
                <li><b>{result.nps.detractors}</b> {result.nps.detractors === 1 ? 'detrator' : 'detratores'}</li>
              </ul>
            </>
          ) : (
            <>
              <strong>{result.average?.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</strong>
              <span>média</span>
              {result.settings.min_label || result.settings.max_label ? <p className="sv-muted">{result.settings.min ?? 1} = {result.settings.min_label || '—'} · {result.settings.max ?? 5} = {result.settings.max_label || '—'}</p> : null}
            </>
          )}
        </div>
        <Bars rows={rows} total={total} />
      </div>
    );
  }
  if (kind === 'number') {
    return <p className="sv-result-number"><strong>{result.average?.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</strong> média de {plural(total, 'resposta', 'respostas')}</p>;
  }
  return (
    <ul className="sv-text-answers">
      {[...new Set(result.text_answers)].map((answer) => {
        const count = result.text_answers.filter((a) => a === answer).length;
        return <li key={answer}><MessageSquareText size={14} aria-hidden /><span>{kind === 'date' ? new Date(`${answer}T00:00:00`).toLocaleDateString('pt-BR') : answer}</span>{count > 1 ? <em className="sd-count">{count}×</em> : null}</li>;
      })}
    </ul>
  );
}

/** Resultados agregados de uma pesquisa. Nunca mostra quem respondeu. */
export function SurveyResultsView({ results }: { results: SurveyResults }) {
  if (!results.total_responses) {
    return <EmptyState icon={Users} title="Ainda sem respostas" description="Quando gestores e colaboradores responderem, os resultados aparecem aqui, sempre agregados (sem mostrar quem respondeu o quê)." />;
  }
  return (
    <div className="sv-results">
      <p className="sv-results__total"><Users size={16} aria-hidden /><strong>{results.total_responses}</strong> {results.total_responses === 1 ? 'pessoa respondeu' : 'pessoas responderam'}. Os resultados são agregados: ninguém é identificado.</p>
      {results.questions.map((result, index) => (
        <article key={result.question_id} className="sv-result">
          <header>
            <span className="sv-question__number">{index + 1}</span>
            <div>
              <h3>{result.title}</h3>
              <span className="sv-result__meta"><QuestionTypeIcon type={result.question_type} size={13} />{QUESTION_TYPE_LABEL[result.question_type]} · {plural(result.response_count, 'resposta', 'respostas')}</span>
            </div>
          </header>
          <ResultBody result={result} />
        </article>
      ))}
    </div>
  );
}
