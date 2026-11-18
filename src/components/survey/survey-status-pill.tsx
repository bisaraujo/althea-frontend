import type { Survey } from '../../api/surveys';
import { StatusPill } from '../status-pill';

const LABEL: Record<string, string> = {
  draft: 'Rascunho', changes_requested: 'Ajustes pedidos', in_review: 'Em revisão', approved: 'Aprovada', published: 'Publicada', archived: 'Encerrada',
};
const TONE: Record<string, 'default' | 'success' | 'warning' | 'muted'> = {
  draft: 'warning', changes_requested: 'warning', in_review: 'warning', approved: 'warning', published: 'success', archived: 'muted',
};

/** Situacao de uma pesquisa; sem empresa ela e um modelo. */
export function SurveyStatusPill({ survey }: { survey: Pick<Survey, 'status' | 'company_id'> }) {
  if (!survey.company_id) return <StatusPill tone="muted">Modelo</StatusPill>;
  return <StatusPill tone={TONE[survey.status] ?? 'default'}>{LABEL[survey.status] ?? survey.status}</StatusPill>;
}
