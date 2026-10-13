import { CheckCircle2, CircleDot, Clock3, EyeOff, MessageSquareText, StickyNote } from 'lucide-react';

import { type IntegrityEvent, INTEGRITY_STATUS_LABEL, type IntegrityStatus } from '../api/integrity';

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
}

export function statusLabel(value: string | null | undefined) {
  return value ? INTEGRITY_STATUS_LABEL[value as IntegrityStatus] ?? value : '';
}

export function StatusIcon({ status, size = 15 }: { status: string; size?: number }) {
  if (status === 'concluido') return <CheckCircle2 size={size} aria-hidden />;
  if (status === 'em_analise') return <Clock3 size={size} aria-hidden />;
  return <CircleDot size={size} aria-hidden />;
}

function describe(event: IntegrityEvent) {
  if (event.event_type === 'note') return 'Nota interna do comitê';
  if (event.event_type === 'anonymized') return 'Dados do denunciante removidos (prazo de retenção)';
  if (!event.from_status) return `Denúncia ${statusLabel(event.to_status).toLowerCase()}`;
  return `Situação alterada para "${statusLabel(event.to_status)}"`;
}

/** Linha do tempo de um caso. No acompanhamento publico so chegam mudancas de situacao. */
export function CaseTimeline({ events, audience }: { events: IntegrityEvent[]; audience: 'public' | 'committee' }) {
  if (!events.length) return <p className="int-hint">Nenhum registro ainda.</p>;
  return (
    <ol className="int-timeline">
      {events.map((event) => {
        const isNote = event.event_type === 'note';
        const Icon = isNote ? StickyNote : event.event_type === 'anonymized' ? EyeOff : MessageSquareText;
        return (
          <li key={event.id}>
            <span className={`int-timeline__icon${isNote ? ' int-timeline__icon--note' : ''}`}><Icon size={14} aria-hidden /></span>
            <div className="int-timeline__copy">
              <strong>{describe(event)}</strong>
              <span className="int-timeline__meta">{formatDateTime(event.created_at)}</span>
              {event.note ? (
                <>
                  {audience === 'committee' ? (
                    <span className={`int-tag${isNote ? '' : ' int-tag--public'}`}>{isNote ? 'Só o comitê vê' : 'Visível para quem denunciou'}</span>
                  ) : null}
                  <p className="int-timeline__note">{event.note}</p>
                </>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
