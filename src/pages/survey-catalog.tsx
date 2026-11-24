import { ChevronRight, ClipboardList, Plus } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { AUDIENCE_LABEL, canonicalType, createSurvey, listSurveys, type Survey, type SurveyAudience, type TargetCompany } from '../api/surveys';
import { EmptyState } from '../components/empty-state';
import { SectionPanel } from '../components/section-panel';
import { SurveyStatusPill } from '../components/survey/survey-status-pill';
import { useToast } from '../components/toast';
import { ErrorState, FilterBar, LoadingState, Modal, SearchInput, SegmentedFilter } from '../components/ui';
import { plural } from '../lib/plural';
import '../components/survey/survey.css';

type StatusFilter = 'all' | 'draft' | 'review' | 'published' | 'archived' | 'template';
const STATUS_GROUP: Record<string, StatusFilter> = {
  draft: 'draft', changes_requested: 'draft', in_review: 'review', approved: 'review', published: 'published', archived: 'archived',
};
const FILTER_LABEL: Record<StatusFilter, string> = { all: 'Todas', draft: 'Rascunhos', review: 'Em revisão', published: 'Publicadas', archived: 'Encerradas', template: 'Modelos' };
/** Pesquisa sem empresa e um modelo, qualquer que seja a situacao. */
const groupOf = (survey: Survey): StatusFilter => (survey.company_id ? STATUS_GROUP[survey.status] : 'template');

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Lista de pesquisas da Turi com filtros e criacao; cada linha abre o construtor. */
export function SurveyCatalog({ token, companies }: { token: string; companies: TargetCompany[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [surveys, setSurveys] = useState<Survey[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ title: '', company_id: '', audience: 'all' as SurveyAudience, closes_at: '' });

  const load = useCallback(() => {
    setFailed(false);
    listSurveys(token).then(setSurveys).catch(() => setFailed(true));
  }, [token]);
  useEffect(load, [load]);

  const visible = useMemo(() => (surveys ?? []).filter((survey) => (status === 'all' || groupOf(survey) === status)
    && (!query || normalize(`${survey.title} ${survey.company_name ?? ''}`).includes(normalize(query)))), [surveys, status, query]);
  const count = (key: StatusFilter) => (surveys ?? []).filter((survey) => key === 'all' || groupOf(survey) === key).length;

  async function create(event: FormEvent) {
    event.preventDefault();
    if (saving || !draft.title.trim()) return;
    setSaving(true);
    try {
      const created = await createSurvey(token, { title: draft.title.trim(), company_id: draft.company_id || null, audience: draft.audience, closes_at: draft.closes_at || null });
      navigate(`/admin/research/${created.id}`);
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Não foi possível criar a pesquisa.');
      setSaving(false);
    }
  }

  if (failed) return <ErrorState message="Não foi possível carregar as pesquisas." onRetry={load} />;
  if (!surveys) return <LoadingState />;

  return (
    <SectionPanel title="Pesquisas" eyebrow={plural(surveys.length, 'pesquisa', 'pesquisas')}
      action={<button type="button" className="primary-button" onClick={() => setCreating(true)}><Plus size={16} />Nova pesquisa</button>}>
      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar por título ou empresa" label="Buscar pesquisa" />
        <SegmentedFilter<StatusFilter> label="Situação" value={status} onChange={setStatus}
          options={(Object.keys(FILTER_LABEL) as StatusFilter[]).map((key) => ({ value: key, label: FILTER_LABEL[key], count: count(key) }))} />
      </FilterBar>
      {visible.length ? (
        <ul className="sv-catalog">
          {visible.map((survey) => {
            const questions = survey.questions.filter((q) => canonicalType(q.question_type) !== 'section').length;
            return (
              <li key={survey.id}>
                <Link to={`/admin/research/${survey.id}`} className="sv-catalog__row">
                  <span className="sv-catalog__icon" aria-hidden><ClipboardList size={17} /></span>
                  <span className="sv-catalog__copy">
                    <strong>{survey.title} <em>v{survey.version}</em></strong>
                    <span>{survey.company_name ?? 'Modelo sem empresa'} · {AUDIENCE_LABEL[survey.audience]} · {plural(questions, 'pergunta', 'perguntas')}</span>
                  </span>
                  <span className="sv-catalog__responses">{survey.status === 'published' || survey.status === 'archived' ? plural(survey.response_count, 'resposta', 'respostas') : ''}</span>
                  <SurveyStatusPill survey={survey} />
                  <ChevronRight size={16} className="sv-catalog__chevron" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={ClipboardList} title={surveys.length ? 'Nada com esse filtro' : 'Nenhuma pesquisa ainda'}
          description={surveys.length ? 'Mude a busca ou a situação.' : 'Crie a primeira pesquisa: escolha a empresa, monte as perguntas, revise e publique.'} />
      )}

      <Modal open={creating} onClose={saving ? () => undefined : () => setCreating(false)} title="Nova pesquisa" description="Depois você monta as perguntas no construtor." size="sm"
        footer={<>
          <button type="button" className="secondary-button" onClick={() => setCreating(false)} disabled={saving}>Cancelar</button>
          <button type="submit" form="survey-create" className="primary-button" disabled={saving || !draft.title.trim()}>{saving ? 'Criando…' : 'Criar e montar'}</button>
        </>}>
        <form id="survey-create" className="admin-form" onSubmit={(event) => void create(event)}>
          <label><span>Título</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required maxLength={255} autoFocus placeholder="Ex.: Pulso de clima — novembro" /></label>
          <label><span>Empresa</span>
            <select value={draft.company_id} onChange={(e) => setDraft({ ...draft, company_id: e.target.value })}>
              <option value="">Modelo (sem empresa)</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
            <em className="sv-optional">Vai para várias empresas? Deixe como modelo e, depois de montar, use “Enviar para empresas”.</em>
          </label>
          <label><span>Quem responde</span>
            <select value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as SurveyAudience })}>
              {(Object.keys(AUDIENCE_LABEL) as SurveyAudience[]).map((key) => <option key={key} value={key}>{AUDIENCE_LABEL[key]}</option>)}
            </select>
          </label>
          <label><span>Encerrar em <em className="sv-optional">(opcional · dá para definir depois)</em></span>
            <input type="date" value={draft.closes_at} onChange={(e) => setDraft({ ...draft, closes_at: e.target.value })} />
          </label>
        </form>
      </Modal>
    </SectionPanel>
  );
}
