import { ArrowLeft, CheckCircle2, ChevronRight, ClipboardList, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { type Answers, canonicalType, listAvailableSurveys, submitSurveyResponse, type Survey } from '../api/surveys';
import { useAuth } from '../auth/auth-context';
import { AppShell } from '../components/app-shell';
import { EmptyState } from '../components/empty-state';
import { employeeNavigation, managerNavigation } from '../components/role-navigation';
import { SectionPanel } from '../components/section-panel';
import { missingRequired, SurveyForm } from '../components/survey/survey-form';
import { useToast } from '../components/toast';
import { ErrorState, LoadingState } from '../components/ui';
import { plural } from '../lib/plural';
import '../components/survey/survey.css';

function useNavigation() {
  const { user } = useAuth();
  return user?.role === 'manager' ? managerNavigation : employeeNavigation;
}

function useAvailable() {
  const { token } = useAuth();
  const [surveys, setSurveys] = useState<Survey[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    if (!token) return;
    setFailed(false);
    listAvailableSurveys(token).then(setSurveys).catch(() => setFailed(true));
  }, [token]);
  useEffect(load, [load]);
  return { surveys, failed, load };
}

/** Pesquisas que o gestor ou colaborador pode responder. */
export function SurveysPage() {
  const navigation = useNavigation();
  const { surveys, failed, load } = useAvailable();
  const pending = (surveys ?? []).filter((survey) => !survey.answered);
  const done = (surveys ?? []).filter((survey) => survey.answered);
  return (
    <AppShell eyebrow="Pesquisas" title="Pesquisas" description="Sua opinião ajuda a empresa a cuidar melhor das pessoas. As respostas são confidenciais e só aparecem somadas às dos colegas." navigation={navigation}>
      {failed ? <ErrorState message="Não foi possível carregar as pesquisas." onRetry={load} /> : null}
      {!failed && !surveys ? <LoadingState /> : null}
      {surveys ? (
        <>
          <SectionPanel title="Para responder" eyebrow={pending.length ? plural(pending.length, 'pesquisa aberta', 'pesquisas abertas') : done.length ? 'Tudo respondido' : 'Nenhuma no momento'}>
            {pending.length ? (
              <ul className="sv-catalog">
                {pending.map((survey) => (
                  <li key={survey.id}>
                    <Link to={`/surveys/${survey.id}`} className="sv-catalog__row">
                      <span className="sv-catalog__icon" aria-hidden><ClipboardList size={17} /></span>
                      <span className="sv-catalog__copy">
                        <strong>{survey.title}</strong>
                        <span>{plural(survey.questions.filter((q) => canonicalType(q.question_type) !== 'section').length, 'pergunta', 'perguntas')}{survey.description ? ` · ${survey.description}` : ''}</span>
                      </span>
                      <span className="primary-button sv-catalog__cta">Responder</span>
                      <ChevronRight size={16} className="sv-catalog__chevron" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={CheckCircle2} title="Nenhuma pesquisa aberta" description="Quando houver uma nova pesquisa para você, ela aparece aqui." />}
          </SectionPanel>
          {done.length ? (
            <SectionPanel title="Já respondidas" eyebrow={plural(done.length, 'pesquisa', 'pesquisas')}>
              <ul className="sv-catalog">
                {done.map((survey) => (
                  <li key={survey.id}>
                    <div className="sv-catalog__row is-static">
                      <span className="sv-catalog__icon is-done" aria-hidden><CheckCircle2 size={17} /></span>
                      <span className="sv-catalog__copy"><strong>{survey.title}</strong><span>Obrigado por responder.</span></span>
                    </div>
                  </li>
                ))}
              </ul>
            </SectionPanel>
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}

/** Tela para responder uma pesquisa. */
export function SurveyRespondPage() {
  const { surveyId = '' } = useParams();
  const { token } = useAuth();
  const toast = useToast();
  const navigation = useNavigation();
  const { surveys, failed, load } = useAvailable();
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const survey = surveys?.find((item) => item.id === surveyId) ?? null;

  function change(key: string, value: Answers[string] | undefined) {
    setAnswers((current) => {
      const next = { ...current };
      if (value === undefined) delete next[key]; else next[key] = value;
      return next;
    });
    setErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  }

  async function submit() {
    if (!token || !survey || sending) return;
    const outOfRange = survey.questions.filter((q) => canonicalType(q.question_type) === 'number' && answers[q.question_key] !== undefined).filter((q) => {
      const value = Number(String(answers[q.question_key]).replace(',', '.'));
      const { min, max } = q.settings as { min?: number; max?: number };
      return Number.isNaN(value) || (min !== undefined && value < min) || (max !== undefined && value > max);
    });
    if (outOfRange.length) {
      setErrors(Object.fromEntries(outOfRange.map((q) => {
        const { min, max } = q.settings as { min?: number; max?: number };
        return [q.question_key, min !== undefined && max !== undefined ? `Informe um número entre ${min} e ${max}.` : 'Informe um número válido.'];
      })));
      document.getElementById(`sv-question-${outOfRange[0].question_key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const missing = missingRequired(survey.questions, answers);
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((key) => [key, 'Esta pergunta é obrigatória.'])));
      document.getElementById(`sv-question-${missing[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast.error(missing.length === 1 ? 'Falta responder 1 pergunta obrigatória.' : `Faltam ${missing.length} perguntas obrigatórias.`);
      return;
    }
    setSending(true);
    try {
      await submitSurveyResponse(token, survey.id, answers);
      setSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (reason) {
      const detail = reason instanceof ApiError ? reason.detail : undefined;
      if (detail && typeof detail === 'object' && 'errors' in detail) setErrors((detail as { errors: Record<string, string> }).errors);
      toast.error(reason instanceof ApiError ? reason.message : 'Não foi possível enviar as respostas.');
    } finally {
      setSending(false);
    }
  }

  const back = <Link to="/surveys" className="sv-back"><ArrowLeft size={15} />Pesquisas</Link>;

  if (failed) return <AppShell title="Pesquisa" navigation={navigation}><ErrorState message="Não foi possível carregar a pesquisa." onRetry={load} /></AppShell>;
  if (!surveys) return <AppShell title="Pesquisa" navigation={navigation}><LoadingState /></AppShell>;
  if (!survey) {
    return (
      <AppShell title="Pesquisa" navigation={navigation}>
        {back}
        <EmptyState icon={ClipboardList} title="Pesquisa indisponível" description="Ela pode ter sido encerrada ou não ser para o seu perfil." />
      </AppShell>
    );
  }
  if (sent || survey.answered) {
    return (
      <AppShell eyebrow="Pesquisa" title={survey.title} navigation={navigation}>
        {back}
        <div className="sv-thanks">
          <CheckCircle2 size={36} aria-hidden />
          <h2>{sent ? 'Respostas enviadas. Obrigado!' : 'Você já respondeu esta pesquisa.'}</h2>
          <p>Suas respostas são confidenciais: a empresa só vê os resultados somados aos dos colegas.</p>
          <Link to="/surveys" className="secondary-button">Voltar para as pesquisas</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell eyebrow="Pesquisa" title={survey.title} description={survey.description ?? undefined} navigation={navigation}>
      {back}
      <article className="sv-paper">
        <p className="sv-paper__privacy">Responda com sinceridade: ninguém da empresa vê a sua resposta individual. As perguntas com <span className="sv-required">*</span> são obrigatórias.</p>
        <SurveyForm questions={survey.questions} answers={answers} onChange={change} errors={errors} disabled={sending} />
        <div className="sv-paper__footer">
          <button type="button" className="primary-button" disabled={sending} onClick={() => void submit()}><Send size={15} />{sending ? 'Enviando…' : 'Enviar respostas'}</button>
        </div>
      </article>
    </AppShell>
  );
}
