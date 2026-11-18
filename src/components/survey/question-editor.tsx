import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import {
  canonicalType, defaultsFor, isChoiceType, type QuestionPayload, QUESTION_TYPE_INFO, type QuestionType, type SurveyQuestion,
} from '../../api/surveys';

type QuestionEditorProps = {
  question: SurveyQuestion;
  saving: boolean;
  onSave: (payload: QuestionPayload) => void;
  onCancel: () => void;
};

const SCALE_STARTS = [0, 1];
const SCALE_ENDS = [2, 3, 4, 5, 6, 7, 10];

/** Edicao de uma pergunta: texto, ajuda, tipo, obrigatoria, opcoes (escolha) e escala. */
export function QuestionEditor({ question, saving, onSave, onCancel }: QuestionEditorProps) {
  const [draft, setDraft] = useState<QuestionPayload>({
    title: question.title, description: question.description, question_type: canonicalType(question.question_type),
    required: question.required, options: question.options, settings: question.settings,
  });
  const kind = draft.question_type;
  const options = draft.options ?? [];
  const settings = draft.settings ?? {};
  const set = (patch: Partial<QuestionPayload>) => setDraft((current) => ({ ...current, ...patch }));
  const setOption = (index: number, text: string) => set({ options: options.map((item, i) => (i === index ? text : item)) });
  const moveOption = (index: number, delta: number) => {
    const next = [...options];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    set({ options: next });
  };

  function changeType(next: QuestionType) {
    // Mantem as opcoes ao trocar entre escolha unica e multipla; nos demais casos usa os valores iniciais do tipo.
    if (isChoiceType(next) && isChoiceType(kind)) set({ question_type: next });
    else set({ question_type: next, ...defaultsFor(next) });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const cleanOptions = options.map((item) => item.trim()).filter(Boolean);
    onSave({ ...draft, title: draft.title.trim(), options: isChoiceType(kind) ? cleanOptions : [], description: draft.description?.trim() || null });
  }

  const isSection = kind === 'section';
  const choiceProblem = isChoiceType(kind) && options.filter((item) => item.trim()).length < 2;

  return (
    <form className="sv-editor" onSubmit={submit}>
      <div className="sv-editor__row">
        <label className="sv-editor__title"><span>{isSection ? 'Título da seção' : 'Pergunta'}</span>
          <textarea rows={2} value={draft.title} onChange={(e) => set({ title: e.target.value })} required maxLength={500} autoFocus onFocus={(e) => { if (['Nova pergunta', 'Nova seção'].includes(e.target.value)) e.target.select(); }}
            placeholder={isSection ? 'Ex.: Sobre o seu dia a dia' : 'Ex.: Como você avalia a sua carga de trabalho?'} />
        </label>
        <label className="sv-editor__type"><span>Tipo</span>
          <select value={kind} onChange={(e) => changeType(e.target.value as QuestionType)}>
            {QUESTION_TYPE_INFO.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
          </select>
        </label>
      </div>

      <label><span>{isSection ? 'Texto de apoio' : 'Texto de ajuda'} <em className="sv-optional">(opcional)</em></span>
        <input value={draft.description ?? ''} onChange={(e) => set({ description: e.target.value })} maxLength={500}
          placeholder={isSection ? 'Uma frase que apresenta esta parte' : 'Ex.: Considere as últimas duas semanas.'} />
      </label>

      {isChoiceType(kind) ? (
        <div className="sv-editor__options">
          <span className="sv-editor__label">Opções de resposta</span>
          {options.map((option, index) => (
            <div key={index} className="sv-editor__option">
              <span className={`sv-option__mark${kind === 'multiple_choice' ? ' is-square' : ''}`} aria-hidden />
              <input value={option} onChange={(e) => setOption(index, e.target.value)} maxLength={200} aria-label={`Opção ${index + 1}`} />
              <button type="button" className="icon-button" aria-label="Subir opção" disabled={index === 0} onClick={() => moveOption(index, -1)}><ArrowUp size={14} /></button>
              <button type="button" className="icon-button" aria-label="Descer opção" disabled={index === options.length - 1} onClick={() => moveOption(index, 1)}><ArrowDown size={14} /></button>
              <button type="button" className="icon-button" aria-label="Remover opção" disabled={options.length <= 2} onClick={() => set({ options: options.filter((_, i) => i !== index) })}><X size={14} /></button>
            </div>
          ))}
          <button type="button" className="ghost-button sv-editor__add" disabled={options.length >= 30} onClick={() => set({ options: [...options, `Opção ${options.length + 1}`] })}><Plus size={14} />Adicionar opção</button>
          {choiceProblem ? <p className="sv-editor__warning">Informe ao menos duas opções.</p> : null}
        </div>
      ) : null}

      {kind === 'scale' ? (
        <div className="sv-editor__scale">
          <label><span>De</span>
            <select value={settings.min ?? 1} onChange={(e) => set({ settings: { ...settings, min: Number(e.target.value) } })}>
              {SCALE_STARTS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label><span>Até</span>
            <select value={settings.max ?? 5} onChange={(e) => set({ settings: { ...settings, max: Number(e.target.value) } })}>
              {SCALE_ENDS.filter((n) => n > Number(settings.min ?? 1)).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label><span>Rótulo do início</span><input value={settings.min_label ?? ''} maxLength={80} onChange={(e) => set({ settings: { ...settings, min_label: e.target.value } })} placeholder="Ex.: Discordo totalmente" /></label>
          <label><span>Rótulo do fim</span><input value={settings.max_label ?? ''} maxLength={80} onChange={(e) => set({ settings: { ...settings, max_label: e.target.value } })} placeholder="Ex.: Concordo totalmente" /></label>
        </div>
      ) : null}

      {kind === 'number' ? (
        <div className="sv-editor__scale">
          <label><span>Mínimo <em className="sv-optional">(opcional)</em></span><input type="number" value={settings.min ?? ''} onChange={(e) => set({ settings: { ...settings, min: e.target.value === '' ? undefined : Number(e.target.value) } })} /></label>
          <label><span>Máximo <em className="sv-optional">(opcional)</em></span><input type="number" value={settings.max ?? ''} onChange={(e) => set({ settings: { ...settings, max: e.target.value === '' ? undefined : Number(e.target.value) } })} /></label>
        </div>
      ) : null}

      {kind === 'nps' ? <p className="sv-editor__hint">Escala de 0 a 10. No resultado: promotores (9–10), neutros (7–8) e detratores (0–6).</p> : null}

      <div className="sv-editor__footer">
        {!isSection ? (
          <label className="sv-switch">
            <input type="checkbox" checked={draft.required ?? true} onChange={(e) => set({ required: e.target.checked })} />
            <span>Resposta obrigatória</span>
          </label>
        ) : <span />}
        <div className="sv-editor__actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button type="submit" className="primary-button" disabled={saving || !draft.title.trim() || choiceProblem}>{saving ? 'Salvando…' : 'Salvar pergunta'}</button>
        </div>
      </div>
    </form>
  );
}
