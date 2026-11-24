import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { AUDIENCE_LABEL, getSurvey, type Survey } from '../api/surveys';
import { useAuth } from '../auth/auth-context';
import { AppShell } from '../components/app-shell';
import { companyNavigation } from '../components/company-navigation';
import { SurveyDashboardView } from '../components/survey/dashboard/survey-dashboard-view';
import { SurveysOverviewView } from '../components/survey/dashboard/surveys-overview-view';
import { ErrorState, LoadingState } from '../components/ui';
import { plural } from '../lib/plural';
import '../components/survey/survey.css';

/** Conta da empresa: painel com todas as pesquisas aplicadas nela. */
export function CompanySurveysPage() {
  const { token } = useAuth();
  return (
    <AppShell eyebrow="Pesquisas" title="Resultados das pesquisas"
      description="O que gestores e colaboradores responderam, sempre agregado e anônimo. Abra uma pesquisa para ver o dashboard completo." navigation={companyNavigation}>
      {token ? <SurveysOverviewView token={token} showCompany={false} surveyLink={(id) => `/company/surveys/${id}`} /> : null}
    </AppShell>
  );
}

/** Conta da empresa: dashboard de uma pesquisa (so leitura). */
export function CompanySurveyDashboardPage() {
  const { surveyId = '' } = useParams();
  const { token } = useAuth();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!token) return;
    setFailed(false);
    getSurvey(token, surveyId).then(setSurvey).catch(() => setFailed(true));
  }, [token, surveyId]);
  const back = <Link to="/company/surveys" className="sv-back"><ArrowLeft size={15} />Todas as pesquisas</Link>;
  if (failed) return <AppShell title="Pesquisa" navigation={companyNavigation}>{back}<ErrorState message="Não foi possível carregar a pesquisa." /></AppShell>;
  if (!survey || !token) return <AppShell title="Pesquisa" navigation={companyNavigation}><LoadingState /></AppShell>;
  const questions = survey.questions.filter((q) => q.question_type !== 'section').length;
  return (
    <AppShell eyebrow={`Pesquisa · versão ${survey.version}`} title={survey.title}
      description={`${AUDIENCE_LABEL[survey.audience]} · ${plural(questions, 'pergunta', 'perguntas')}`} navigation={companyNavigation}>
      {back}
      <SurveyDashboardView token={token} surveyId={survey.id} title={survey.title} />
    </AppShell>
  );
}
