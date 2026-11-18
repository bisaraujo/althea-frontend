import { Check } from 'lucide-react';

import { type Answers, canonicalType, scaleRange, type SurveyQuestion, YES_NO_OPTIONS } from '../../api/surveys';
import './survey.css';

type SurveyFormProps = {
  questions: SurveyQuestion[];
  answers: Answers;
  onChange: (key: string, value: Answers[string] | undefined) => void;
  /** Mensagem por pergunta (question_key -> texto). */
  errors?: Record<string, string>;
  disabled?: boolean;
};

function isEmpty(value: Answers[string] | undefined) {
  return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

/** Perguntas obrigatorias sem resposta (para avisar antes de enviar). */
export function missingRequired(questions: SurveyQuestion[], answers: Answers) {
  return questions.filter((q) => canonicalType(q.question_type) !== 'section' && q.required && isEmpty(answers[q.question_key])).map((q) => q.question_key);
}

/** Numera so as perguntas que tem resposta (secoes nao contam). */
function numbering(questions: SurveyQuestion[]) {
  let index = 0;
  return new Map(questions.map((q) => [q.id, canonicalType(q.question_type) === 'section' ? null : ++index]));
}

function ScaleInput({ question, value, onPick, disabled }: { question: SurveyQuestion; value: Answers[string] | undefined; onPick: (n: number) => void; disabled?: boolean }) {
  const [low, high] = scaleRange(question);
  const isNps = canonicalType(question.question_type) === 'nps';
  const points = Array.from({ length: high - low + 1 }, (_, i) => low + i);
  const minLabel = isNps ? 'Nada provável' : question.settings.min_label;
  const maxLabel = isNps ? 'Muito provável' : question.settings.max_label;
  return (
    <div className="sv-scale">
      <div className={`sv-scale__points${points.length > 7 ? ' is-dense' : ''}`} role="radiogroup" aria-label={question.title}>
        {points.map((point) => (
          <button key={point} type="button" role="radio" aria-checked={Number(value) === point} disabled={disabled}
            className={`sv-scale__point${Number(value) === point ? ' is-selected' : ''}`} onClick={() => onPick(point)}>{point}</button>
        ))}
      </div>
      {minLabel || maxLabel ? <div className="sv-scale__labels"><span>{minLabel}</span><span>{maxLabel}</span></div> : null}
    </div>
  );
}

/** Formulario de uma pesquisa: usado para responder e na pre-visualizacao do construtor. */
export function SurveyForm({ questions, answers, onChange, errors = {}, disabled = false }: SurveyFormProps) {
  const numbers = numbering(questions);
  return (
    <div className="sv-form">
      {questions.map((question) => {
        const kind = canonicalType(question.question_type);
        if (kind === 'section') {
          return (
            <div key={question.id} className="sv-section">
              <h3>{question.title}</h3>
              {question.description ? <p>{question.description}</p> : null}
            </div>
          );
        }
        const key = question.question_key;
        const value = answers[key];
        const error = errors[key];
        const set = (next: Answers[string] | undefined) => onChange(key, next);
        const inputId = `sv-${question.id}`;
        return (
          <fieldset key={question.id} className={`sv-question${error ? ' has-error' : ''}`} id={`sv-question-${key}`} disabled={disabled}>
            <legend className="sv-question__title">
              <span className="sv-question__number">{numbers.get(question.id)}</span>
              <span>{question.title}{question.required ? <span className="sv-required" aria-label="obrigatória"> *</span> : null}</span>
            </legend>
            {question.description ? <p className="sv-question__help">{question.description}</p> : null}

            {kind === 'short_text' ? <input id={inputId} aria-label={question.title} value={String(value ?? '')} maxLength={500} onChange={(e) => set(e.target.value)} /> : null}
            {kind === 'long_text' ? <textarea id={inputId} aria-label={question.title} rows={4} value={String(value ?? '')} maxLength={5000} onChange={(e) => set(e.target.value)} /> : null}
            {kind === 'number' ? <input id={inputId} aria-label={question.title} type="number" inputMode="decimal" value={value === undefined ? '' : String(value)}
              min={question.settings.min as number | undefined} max={question.settings.max as number | undefined} onChange={(e) => set(e.target.value === '' ? undefined : e.target.value)} /> : null}
            {kind === 'number' && (question.settings.min !== undefined || question.settings.max !== undefined) ? (
              <p className="sv-question__hint">{question.settings.min !== undefined && question.settings.max !== undefined ? `Entre ${question.settings.min} e ${question.settings.max}` : question.settings.min !== undefined ? `A partir de ${question.settings.min}` : `Até ${question.settings.max}`}</p>
            ) : null}
            {kind === 'date' ? <input id={inputId} aria-label={question.title} type="date" value={String(value ?? '')} onChange={(e) => set(e.target.value || undefined)} /> : null}

            {kind === 'single_choice' || kind === 'multiple_choice' ? (
              <div className="sv-options">
                {question.options.map((option) => {
                  const multiple = kind === 'multiple_choice';
                  const selected = multiple ? Array.isArray(value) && value.includes(option) : value === option;
                  const toggle = () => {
                    if (!multiple) { set(option); return; }
                    const current = Array.isArray(value) ? value : [];
                    set(selected ? current.filter((item) => item !== option) : [...current, option]);
                  };
                  return (
                    <button key={option} type="button" role={multiple ? 'checkbox' : 'radio'} aria-checked={selected}
                      className={`sv-option${selected ? ' is-selected' : ''}${multiple ? ' sv-option--multi' : ''}`} onClick={toggle}>
                      <span className="sv-option__mark" aria-hidden>{selected ? <Check size={12} strokeWidth={3} /> : null}</span>
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {kind === 'yes_no' ? (
              <div className="sv-yesno" role="radiogroup" aria-label={question.title}>
                {YES_NO_OPTIONS.map((option) => (
                  <button key={option.value} type="button" role="radio" aria-checked={value === option.value}
                    className={`sv-yesno__item${value === option.value ? ' is-selected' : ''}`} onClick={() => set(option.value)}>{option.label}</button>
                ))}
              </div>
            ) : null}

            {kind === 'scale' || kind === 'nps' ? <ScaleInput question={question} value={value} onPick={(n) => set(n)} disabled={disabled} /> : null}

            {error ? <p className="sv-question__error" role="alert">{error}</p> : null}
          </fieldset>
        );
      })}
    </div>
  );
}
