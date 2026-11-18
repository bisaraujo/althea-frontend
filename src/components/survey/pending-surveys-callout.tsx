import { ArrowRight, ClipboardList } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { listAvailableSurveys, type Survey } from '../../api/surveys';
import { useAuth } from '../../auth/auth-context';
import './survey.css';

/** Aviso no inicio do gestor/colaborador quando ha pesquisa para responder. Some quando nao ha nenhuma. */
export function PendingSurveysCallout() {
  const { token } = useAuth();
  const [pending, setPending] = useState<Survey[]>([]);
  useEffect(() => {
    if (!token) return;
    listAvailableSurveys(token).then((list) => setPending(list.filter((survey) => !survey.answered))).catch(() => setPending([]));
  }, [token]);
  if (!pending.length) return null;
  const one = pending.length === 1;
  return (
    <Link to={one ? `/surveys/${pending[0].id}` : '/surveys'} className="sv-callout">
      <span className="sv-callout__icon" aria-hidden><ClipboardList size={20} /></span>
      <span className="sv-callout__copy">
        <strong>{one ? 'Tem uma pesquisa esperando a sua resposta' : `Tem ${pending.length} pesquisas esperando a sua resposta`}</strong>
        <span>{one ? pending[0].title : pending.map((survey) => survey.title).slice(0, 2).join(' · ')}{pending.length > 2 ? ' e outras' : ''}. Leva poucos minutos e é confidencial.</span>
      </span>
      <span className="sv-callout__cta">Responder<ArrowRight size={15} aria-hidden /></span>
    </Link>
  );
}
