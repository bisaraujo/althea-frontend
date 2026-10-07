import {
  Building2,
  CalendarCheck,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileText,
  Mail,
  ShieldCheck,
  Upload,
  UserPlus,
  Route as RouteIcon,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type { Company, FormSummary, ManagerDeliveries, Meeting, Project, ResponseRecord, UserRecord } from '../api/types';
import { EmptyState } from './empty-state';
import { SectionPanel } from './section-panel';
import { StatusPill } from './status-pill';
import { StoredFileLink } from './stored-file-link';

type ProjectView = 'overview' | 'manager-deliveries' | 'employee-deliveries' | 'team' | 'meetings';

type Props = {
  company: Company;
  project: Project;
  managers: UserRecord[];
  employees: UserRecord[];
  deliveries: ManagerDeliveries | null;
  forms: FormSummary[];
  responses: ResponseRecord[];
  meetings: Meeting[];
  meetingBusyId: string | null;
  onAta: (meetingId: string, file: File | null) => void;
};

function formatDate(value?: string | null) {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function deliveryLabel(status?: string) {
  if (status === 'submitted') return 'Enviado';
  if (status === 'submitted_late') return 'Enviado atrasado';
  if (status === 'overdue') return 'Atrasado';
  return 'Pendente';
}

function deliveryTone(status?: string) {
  if (status === 'submitted') return 'success' as const;
  if (status === 'submitted_late' || status === 'overdue') return 'warning' as const;
  return 'muted' as const;
}

export function AdminProjectWorkspace({ company, project, managers, employees, deliveries, forms, responses, meetings, meetingBusyId, onAta }: Props) {
  const [view, setView] = useState<ProjectView>('overview');
  const deliveryItems = useMemo(() => deliveries?.sections.flatMap((section) => section.items) ?? [], [deliveries]);
  const submitted = deliveryItems.filter((item) => ['submitted', 'submitted_late'].includes(item.delivery_status)).length;
  const projectResponses = responses.filter((response) => response.project_id === project.id);
  const responseGroups = employees.map((employee) => ({ employee, responses: projectResponses.filter((response) => response.user_id === employee.id) }));

  const tabs = [
    ['overview', 'Visão geral', Building2],
    ['manager-deliveries', 'Entregas do gestor', FileCheck2],
    ['employee-deliveries', 'Entregas dos colaboradores', FileText],
    ['team', 'Equipe', Users],
    ['meetings', 'Reuniões e atas', ClipboardCheck],
  ] as const;

  return (
    <>
      <div className="admin-client-summary">
        <div className="admin-client-summary__identity">
          <span className="list-item__icon"><Building2 size={18} /></span>
          <div><span className="admin-detail__label">Empresa cliente</span><h2>{company.name}</h2><p>{company.email}</p></div>
        </div>
        <div className="admin-client-summary__project">
          <span className="admin-detail__label">Projeto principal</span>
          <strong>{project.name}</strong>
          <p>{project.description || 'Sem descrição cadastrada.'}</p>
        </div>
        <div className="admin-action-link-group"><Link to={`/admin/projects/${project.id}/operations`} className="secondary-button admin-action-link"><RouteIcon size={16}/><span>Fluxo e plano</span></Link><Link to={`/admin/projects/${project.id}/users/new`} className="primary-button admin-action-link"><UserPlus size={16} /><span>Adicionar usuários</span></Link></div>
      </div>

      <div className="admin-project-tabs" role="tablist" aria-label="Áreas do cliente">
        {tabs.map(([value, label, Icon]) => (
          <button key={value} type="button" role="tab" aria-selected={view === value} className={view === value ? 'is-active' : ''} onClick={() => setView(value)}><Icon size={16} /><span>{label}</span></button>
        ))}
      </div>

      {view === 'overview' ? (
        <div className="admin-project-overview">
          <button type="button" className="admin-overview-tile" onClick={() => setView('manager-deliveries')}><FileCheck2 size={20} /><span>Entregas do gestor</span><strong>{submitted}/{deliveryItems.length}</strong><small>documentos enviados</small></button>
          <button type="button" className="admin-overview-tile" onClick={() => setView('employee-deliveries')}><FileText size={20} /><span>Colaboradores</span><strong>{projectResponses.length}</strong><small>respostas registradas</small></button>
          <button type="button" className="admin-overview-tile" onClick={() => setView('team')}><Users size={20} /><span>Equipe</span><strong>{managers.length + employees.length}</strong><small>{managers.length} gestores e {employees.length} funcionários</small></button>
          <button type="button" className="admin-overview-tile" onClick={() => setView('meetings')}><CalendarCheck size={20} /><span>Reuniões</span><strong>{meetings.length}</strong><small>atas e pareceres</small></button>
        </div>
      ) : null}

      {view === 'manager-deliveries' ? (
        <SectionPanel title="Entregas do gestor" eyebrow="Organizadas por etapa" action={<StatusPill>{submitted}/{deliveryItems.length} enviadas</StatusPill>}>
          {deliveryItems.length ? <div className="admin-delivery-board">{deliveries?.sections.map((section) => (
            <section key={section.id} className="admin-delivery-column">
              <header><strong>{section.title}</strong><span>{section.items.length}</span></header>
              <div className="admin-delivery-column__items">{section.items.map((item) => {
                const latest = item.latest_submission;
                const fileUrl = latest?.file_url ?? null;
                return <article key={item.id} className="admin-delivery-compact">
                  <div><strong>{item.document_title ?? item.title}</strong><StatusPill tone={deliveryTone(item.delivery_status)}>{deliveryLabel(item.delivery_status)}</StatusPill></div>
                  <p>{item.description || 'Sem descrição cadastrada.'}</p><small>Prazo {formatDate(item.due_at)}</small>
                  {latest ? <div className="admin-delivery-compact__submission"><span>{latest.user_name} · {formatDate(latest.submitted_at)}</span>{fileUrl ? <StoredFileLink fileUrl={fileUrl} fileName={latest.file_name}>{latest.file_name}</StoredFileLink> : null}</div> : null}
                </article>;
              })}</div>
            </section>
          ))}</div> : <EmptyState title="Sem entregas" description="As entregas da jornada do gestor aparecerão aqui." />}
        </SectionPanel>
      ) : null}

      {view === 'employee-deliveries' ? (
        <SectionPanel title="Entregas dos colaboradores" eyebrow="Pesquisas respondidas" action={<StatusPill>{projectResponses.length} respostas</StatusPill>}>
          {responseGroups.length ? <div className="admin-response-grid">{responseGroups.map(({ employee, responses: employeeResponses }) => (
            <article key={employee.id} className="admin-response-card">
              <header><div><strong>{employee.name}</strong><span>{employee.email}</span></div><StatusPill tone={employeeResponses.length ? 'success' : 'muted'}>{employeeResponses.length}</StatusPill></header>
              {employeeResponses.length ? <div className="admin-response-card__forms">{employeeResponses.map((response) => <span key={response.id}><FileText size={14} />{forms.find((form) => form.id === response.form_id)?.title ?? 'Pesquisa respondida'}</span>)}</div> : <p>Nenhuma pesquisa respondida.</p>}
            </article>
          ))}</div> : <EmptyState title="Sem colaboradores" description="Adicione colaboradores para acompanhar suas respostas." />}
        </SectionPanel>
      ) : null}

      {view === 'team' ? <div className="admin-people-grid">
        <SectionPanel title="Gestores" eyebrow="Equipe de gestão" action={<StatusPill>{managers.length}</StatusPill>}><div className="admin-scroll-list">{managers.length ? managers.map((item) => <article key={item.id} className="list-item list-item--rich"><span className="list-item__icon"><ShieldCheck size={16} /></span><div className="list-item__copy"><strong>{item.name}</strong><p>{item.email}</p></div></article>) : <EmptyState title="Sem gestores" description="Nenhum gestor vinculado." />}</div></SectionPanel>
        <SectionPanel title="Funcionários" eyebrow="Colaboradores" action={<StatusPill>{employees.length}</StatusPill>}><div className="admin-scroll-list">{employees.length ? employees.map((item) => <article key={item.id} className="list-item list-item--rich"><span className="list-item__icon"><Mail size={16} /></span><div className="list-item__copy"><strong>{item.name}</strong><p>{item.email}</p></div></article>) : <EmptyState title="Sem funcionários" description="Nenhum funcionário vinculado." />}</div></SectionPanel>
      </div> : null}

      {view === 'meetings' ? (
        <SectionPanel title="Reuniões, atas e pareceres" eyebrow="Histórico do cliente" action={<StatusPill>{meetings.length} reuniões</StatusPill>}>
          {meetings.length ? <div className="admin-meeting-grid">{meetings.map((meeting) => {
            const ataUrl = meeting.ata_file_url ?? null;
            const statusLabel = meeting.status === 'approved' ? 'Aprovada' : meeting.status === 'changes_requested' ? 'Ajustes solicitados' : 'Aguardando parecer';
            return <article key={meeting.id} className="admin-meeting-card">
              <header><div><span><CalendarCheck size={14} />{formatDate(meeting.meeting_date)}</span><strong>{meeting.title}</strong></div><StatusPill tone={meeting.status === 'approved' ? 'success' : meeting.status === 'changes_requested' ? 'warning' : 'muted'}>{statusLabel}</StatusPill></header>
              {meeting.description ? <p>{meeting.description}</p> : null}
              <div className="admin-meeting-card__ata">{ataUrl ? <StoredFileLink fileUrl={ataUrl} fileName={meeting.ata_file_name}><Download size={15} />{meeting.ata_file_name ?? 'Baixar ata'}</StoredFileLink> : <span>Nenhuma ata anexada</span>}<label className="secondary-button"><input type="file" disabled={meetingBusyId === meeting.id} onChange={(event) => onAta(meeting.id, event.target.files?.[0] ?? null)} /><Upload size={15} />{ataUrl ? 'Substituir ata' : 'Anexar ata'}</label></div>
              <div className="admin-meeting-history"><strong>Histórico de pareceres</strong>{meeting.reviews.length ? meeting.reviews.map((review) => <div key={review.id}><span>{review.reviewer_name} · {formatDate(review.created_at)}</span><StatusPill tone={review.decision === 'approved' ? 'success' : 'warning'}>{review.decision === 'approved' ? 'Aprovou' : 'Solicitou ajustes'}</StatusPill>{review.notes ? <p>{review.notes}</p> : null}</div>) : <p>Nenhum parecer do gestor registrado.</p>}</div>
            </article>;
          })}</div> : <EmptyState title="Nenhuma reunião" description="Crie reuniões pela área Reuniões; elas aparecerão aqui organizadas por cliente." />}
        </SectionPanel>
      ) : null}
    </>
  );
}
