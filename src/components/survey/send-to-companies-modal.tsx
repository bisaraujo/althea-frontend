import { type FormEvent, useMemo, useState } from 'react';

import type { TargetCompany } from '../../api/surveys';
import { plural } from '../../lib/plural';
import { Modal, SearchInput } from '../ui';
import './survey.css';

type SendToCompaniesModalProps = {
  open: boolean;
  defaultTitle: string;
  companies: TargetCompany[];
  /** Empresa da propria pesquisa (fica fora da lista: ela ja tem esta pesquisa). */
  excludeCompanyId?: string | null;
  busy: boolean;
  onClose: () => void;
  onSend: (payload: { company_ids: string[]; title: string; publish: boolean }) => void;
};

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Escolhe varias empresas para receber a mesma pesquisa (uma pesquisa por empresa, resultados separados). */
export function SendToCompaniesModal({ open, defaultTitle, companies, excludeCompanyId, busy, onClose, onSend }: SendToCompaniesModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [publish, setPublish] = useState(true);

  const available = useMemo(() => companies.filter((company) => company.id !== excludeCompanyId), [companies, excludeCompanyId]);
  const visible = useMemo(() => available.filter((company) => !query || normalize(company.name).includes(normalize(query))), [available, query]);
  const allVisibleSelected = visible.length > 0 && visible.every((company) => selected.has(company.id));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current);
      for (const company of visible) {
        if (allVisibleSelected) next.delete(company.id); else next.add(company.id);
      }
      return next;
    });
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected.size || !title.trim()) return;
    onSend({ company_ids: [...selected], title: title.trim(), publish });
  }

  const count = selected.size;
  return (
    <Modal open={open} onClose={busy ? () => undefined : onClose} size="md" title="Enviar para empresas"
      description="Cada empresa recebe a sua própria pesquisa, com as mesmas perguntas. Os resultados ficam separados por empresa."
      footer={<>
        <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="submit" form="survey-send" className="primary-button" disabled={busy || !count || !title.trim()}>
          {busy ? 'Enviando…' : count ? `${publish ? 'Publicar' : 'Criar rascunho'} para ${plural(count, 'empresa', 'empresas')}` : 'Escolha as empresas'}
        </button>
      </>}>
      <form id="survey-send" className="admin-form sv-send" onSubmit={submit}>
        <label><span>Título</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} required /></label>
        <div className="sv-send__head">
          <span className="sv-editor__label">Empresas <em className="sv-optional">({count} de {available.length} escolhidas)</em></span>
          {visible.length ? <button type="button" className="ghost-button sv-send__all" onClick={toggleVisible}>{allVisibleSelected ? 'Desmarcar' : 'Marcar'} {query ? 'as encontradas' : 'todas'}</button> : null}
        </div>
        {available.length > 6 ? <SearchInput value={query} onChange={setQuery} placeholder="Buscar empresa" label="Buscar empresa" /> : null}
        <div className="sv-send__list" role="group" aria-label="Empresas">
          {visible.length ? visible.map((company) => (
            <label key={company.id} className={`sv-send__item${selected.has(company.id) ? ' is-selected' : ''}`}>
              <input type="checkbox" checked={selected.has(company.id)} onChange={() => toggle(company.id)} />
              <span>{company.name}</span>
            </label>
          )) : <p className="sv-muted">{available.length ? 'Nenhuma empresa com esse nome.' : 'Não há outras empresas disponíveis.'}</p>}
        </div>
        <label className="sv-switch">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          <span>Publicar agora <em className="sv-optional">(sem isso, cada uma fica como rascunho para revisar)</em></span>
        </label>
      </form>
    </Modal>
  );
}
