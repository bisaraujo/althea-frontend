import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ACTION_TYPE_LABEL, type ActionItemType, type AgendaEntry, getAgenda, RECURRENCE_LABEL, updateOccurrence } from '../api/action-plan';
import { ApiError } from '../api/client';
import { EmptyState } from '../components/empty-state';
import { SectionPanel } from '../components/section-panel';
import { useToast } from '../components/toast';
import { ErrorState, LoadingState, Modal, NoPermissionState, SegmentedFilter } from '../components/ui';
import './benefits-agenda.css';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function iso(day: Date) {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}
function addDays(day: Date, amount: number) {
  const next = new Date(day); next.setDate(next.getDate() + amount); return next;
}
function longDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function EntryChip({ entry, onOpen }: { entry: AgendaEntry; onOpen: () => void }) {
  const state = entry.status === 'done' ? 'done' : entry.overdue ? 'overdue' : 'scheduled';
  return (
    <button type="button" className={`agd-chip agd-chip--${entry.item_type} agd-chip--${state}`} onClick={onOpen} title={`${ACTION_TYPE_LABEL[entry.item_type]}: ${entry.title}`}>
      {entry.status === 'done' ? <CheckCircle2 size={11} aria-hidden /> : null}
      <span>{entry.title}</span>
    </button>
  );
}

function EntryRow({ entry, onOpen }: { entry: AgendaEntry; onOpen: () => void }) {
  return (
    <button type="button" className={`agd-row${entry.overdue ? ' is-overdue' : ''}`} onClick={onOpen}>
      <span className={`agd-dot agd-dot--${entry.item_type}`} aria-hidden />
      <span className="agd-row__copy">
        <strong>{entry.title}</strong>
        <span>{longDate(entry.date)} · {ACTION_TYPE_LABEL[entry.item_type]}{entry.owner_name ? ` · ${entry.owner_name}` : ''}</span>
      </span>
    </button>
  );
}

/** Agenda das acoes do plano de acao: calendario do mes + atrasadas + proximos 30 dias. */
export function ActionPlanAgenda({ token, companyId, canMark = true }: { token: string; companyId: string; canMark?: boolean }) {
  const toast = useToast();
  const today = iso(new Date());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [typeFilter, setTypeFilter] = useState<'all' | ActionItemType>('all');
  const [monthEntries, setMonthEntries] = useState<AgendaEntry[] | null>(null);
  const [nearEntries, setNearEntries] = useState<AgendaEntry[]>([]);
  const [failure, setFailure] = useState<{ message: string; forbidden: boolean } | null>(null);
  const [open, setOpen] = useState<AgendaEntry | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const grid = useMemo(() => monthGrid(month), [month]);
  const load = useCallback(() => {
    setFailure(null);
    const now = new Date();
    Promise.all([
      getAgenda(token, companyId, iso(grid[0]), iso(grid[grid.length - 1])),
      getAgenda(token, companyId, iso(addDays(now, -90)), iso(addDays(now, 30))),
    ]).then(([forMonth, near]) => { setMonthEntries(forMonth.entries); setNearEntries(near.entries); })
      .catch((reason) => setFailure({ message: reason instanceof ApiError ? reason.message : 'Não foi possível carregar a agenda.', forbidden: reason instanceof ApiError && reason.status === 403 }));
  }, [token, companyId, grid]);
  useEffect(load, [load]);

  const visible = (list: AgendaEntry[]) => list.filter((entry) => typeFilter === 'all' || entry.item_type === typeFilter);
  const byDay = useMemo(() => {
    const map = new Map<string, AgendaEntry[]>();
    for (const entry of visible(monthEntries ?? [])) map.set(entry.date, [...(map.get(entry.date) ?? []), entry]);
    return map;
  }, [monthEntries, typeFilter]);
  const overdue = visible(nearEntries).filter((entry) => entry.overdue);
  const upcoming = visible(nearEntries).filter((entry) => entry.status === 'scheduled' && entry.date >= today);

  function openEntry(entry: AgendaEntry) { setOpen(entry); setNote(entry.note ?? ''); }

  async function mark(status: 'done' | 'scheduled') {
    if (!open || saving) return;
    setSaving(true);
    try {
      await updateOccurrence(token, open.id, { status, note });
      toast.success(status === 'done' ? 'Marcada como feita.' : 'Reaberta.');
      setOpen(null); load();
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Não foi possível atualizar.');
    } finally {
      setSaving(false);
    }
  }

  if (failure) return failure.forbidden ? <NoPermissionState message="Você não tem acesso à agenda do plano de ação desta empresa." /> : <ErrorState message={failure.message} onRetry={load} />;
  if (!monthEntries) return <LoadingState />;

  const counts = (key: 'all' | ActionItemType) => (key === 'all' ? monthEntries.length : monthEntries.filter((entry) => entry.item_type === key).length);
  const monthLabel = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="agd-layout">
      <SectionPanel title="Agenda do plano de ação" eyebrow={monthLabel} action={
        <span className="agd-nav">
          <button type="button" className="org-icon-btn" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
          <button type="button" className="secondary-button agd-today" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoje</button>
          <button type="button" className="org-icon-btn" aria-label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
        </span>
      }>
        <SegmentedFilter<'all' | ActionItemType> label="Tipo" value={typeFilter} onChange={setTypeFilter} options={[
          { value: 'all', label: 'Tudo', count: counts('all') },
          ...(Object.keys(ACTION_TYPE_LABEL) as ActionItemType[]).map((key) => ({ value: key, label: ACTION_TYPE_LABEL[key], count: counts(key) })),
        ]} />
        {!monthEntries.length && !nearEntries.length ? (
          <EmptyState icon={CalendarDays} title="Agenda vazia" description="Quando o plano de ação tiver ações com datas, elas aparecem aqui." />
        ) : null}
        <div className="agd-month" role="grid" aria-label={`Agenda de ${monthLabel}`}>
          {WEEKDAYS.map((day) => <div key={day} className="agd-weekday" role="columnheader">{day}</div>)}
          {grid.map((day) => {
            const key = iso(day);
            const entries = byDay.get(key) ?? [];
            const outside = day.getMonth() !== month.getMonth();
            return (
              <div key={key} role="gridcell" className={`agd-day${outside ? ' is-outside' : ''}${key === today ? ' is-today' : ''}`}>
                <span className="agd-day__number">{day.getDate()}</span>
                {entries.slice(0, 3).map((entry) => <EntryChip key={entry.id} entry={entry} onOpen={() => openEntry(entry)} />)}
                {entries.length > 3 ? <span className="agd-more">+{entries.length - 3}</span> : null}
              </div>
            );
          })}
        </div>
      </SectionPanel>

      <div className="agd-side">
        <SectionPanel title="Atrasadas" eyebrow={`${overdue.length}`}>
          {overdue.length ? <div className="agd-list">{overdue.map((entry) => <EntryRow key={entry.id} entry={entry} onOpen={() => openEntry(entry)} />)}</div>
            : <p className="ben-hint"><CheckCircle2 size={14} aria-hidden /> Nada atrasado.</p>}
        </SectionPanel>
        <SectionPanel title="Próximos 30 dias" eyebrow={`${upcoming.length}`}>
          {upcoming.length ? <div className="agd-list">{upcoming.map((entry) => <EntryRow key={entry.id} entry={entry} onOpen={() => openEntry(entry)} />)}</div>
            : <p className="ben-hint">Nenhuma ação prevista.</p>}
        </SectionPanel>
      </div>

      <Modal open={Boolean(open)} onClose={saving ? () => undefined : () => setOpen(null)} title={open?.title ?? ''} description={open ? `${longDate(open.date)} · ${ACTION_TYPE_LABEL[open.item_type]} · ${RECURRENCE_LABEL[open.recurrence_type]}` : undefined} size="sm"
        footer={open && canMark ? (open.status === 'done'
          ? <button type="button" className="secondary-button" onClick={() => void mark('scheduled')} disabled={saving}><RotateCcw size={15} />Reabrir</button>
          : <button type="button" className="primary-button" onClick={() => void mark('done')} disabled={saving}><CheckCircle2 size={15} />Marcar como feita</button>) : undefined}>
        {open ? (
          <div className="agd-detail">
            {open.overdue ? <p className="agd-alert"><CircleAlert size={15} aria-hidden />Esta ação passou da data e ainda não foi marcada como feita.</p> : null}
            {open.status === 'done' ? <p className="agd-ok"><CheckCircle2 size={15} aria-hidden />Feita{open.completed_at ? ` em ${new Date(open.completed_at).toLocaleDateString('pt-BR')}` : ''}.</p> : null}
            {open.description ? <p>{open.description}</p> : null}
            <dl className="ben-card__facts">
              <div><dt>Responsável</dt><dd>{open.owner_name || '—'}</dd></div>
              <div><dt>Projeto</dt><dd>{open.project_name || '—'}</dd></div>
              {open.benefit_name ? <div><dt>Benefício</dt><dd>{open.benefit_name}</dd></div> : null}
            </dl>
            {canMark ? <label className="ben-field"><span>Observação</span><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="Ex.: realizado com 18 participantes." /></label>
              : open.note ? <p><strong>Observação:</strong> {open.note}</p> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
