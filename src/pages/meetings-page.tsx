import {
  Building2,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  FileUp,
  FolderKanban,
  House,
  Plus,
  Route as RouteIcon,
  Trash2,
  Upload,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { API_URL, ApiError } from '../api/client';
import {
  approveMeeting,
  createMeeting,
  deleteMeeting,
  getCompanies,
  getProjects,
  listMeetings,
  uploadMeetingAta,
} from '../api/services';
import type { Company, Meeting, Project } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { AppShell } from '../components/app-shell';
import { EmptyState } from '../components/empty-state';
import { SectionPanel } from '../components/section-panel';
import { StatusPill } from '../components/status-pill';

type MeetingsMode = 'admin' | 'manager';

const adminNavigation = [
  { to: '/admin', label: 'Home', icon: House },
  { to: '/admin/companies', label: 'Cadastro', icon: Building2 },
  { to: '/admin/projects', label: 'Clientes', icon: FolderKanban },
  { to: '/admin/schedule', label: 'Cronograma', icon: CalendarClock },
  { to: '/admin/meetings', label: 'Reuniões', icon: ClipboardCheck },
];

const managerNavigation = [
  { to: '/manager', label: 'Visão geral', icon: House },
  { to: '/manager/journey', label: 'Minha jornada', icon: RouteIcon },
  { to: '/manager/company-journey', label: 'Jornada da empresa', icon: FileUp },
  { to: '/manager/schedule', label: 'Cronograma', icon: CalendarClock },
  { to: '/manager/meetings', label: 'Reuniões', icon: ClipboardCheck },
];

function fileHref(fileUrl?: string | null) {
  if (!fileUrl) return null;
  if (fileUrl.startsWith('http')) return fileUrl;
  return `${API_URL}${fileUrl}`;
}

function formatDate(value?: string | null) {
  if (!value) return 'Sem data';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function parseError(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export function MeetingsPage({ mode }: { mode: MeetingsMode }) {
  const { token, user } = useAuth();
  const isAdmin = mode === 'admin';

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadMeetings() {
    if (!token) return;
    try {
      const data = await listMeetings(token);
      setMeetings(data.meetings);
    } catch (err) {
      setError(parseError(err, 'Não foi possível carregar as reuniões.'));
    }
  }

  useEffect(() => {
    async function load() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const requests: [Promise<{ meetings: Meeting[] }>, Promise<{ projects: Project[] }> | null, Promise<Company[]> | null] = [
          listMeetings(token),
          isAdmin ? getProjects(token) : null,
          isAdmin ? getCompanies(token) : null,
        ];
        const [meetingData, projectData, companyData] = await Promise.all(requests);
        setMeetings(meetingData.meetings);
        if (projectData) setProjects(projectData.projects);
        if (companyData) setCompanies(companyData);
      } catch (err) {
        setError(parseError(err, 'Não foi possível carregar as reuniões.'));
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [token, isAdmin]);

  const projectLabel = useMemo(() => {
    return (id: string) => {
      const project = projects.find((item) => item.id === id);
      if (!project) return 'Projeto';
      const company = companies.find((item) => item.id === project.company_id);
      return company ? `${company.name} · ${project.name}` : project.name;
    };
  }, [projects, companies]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    if (!title.trim() || !meetingDate) {
      setFormError('Informe o título e a data da reunião.');
      return;
    }
    if (isAdmin && !projectId) {
      setFormError('Selecione o projeto da reunião.');
      return;
    }

    setIsCreating(true);
    setFormError(null);
    try {
      await createMeeting(token, {
        title: title.trim(),
        meeting_date: meetingDate,
        description: description.trim() || null,
        project_id: isAdmin ? projectId : null,
      });
      setTitle('');
      setMeetingDate('');
      setDescription('');
      setProjectId('');
      await loadMeetings();
    } catch (err) {
      setFormError(parseError(err, 'Não foi possível criar a reunião.'));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleAta(meetingId: string, file: File | null) {
    if (!token || !file) return;
    const payload = new FormData();
    payload.append('file', file);
    setBusyId(meetingId);
    try {
      await uploadMeetingAta(token, meetingId, payload);
      await loadMeetings();
    } catch (err) {
      setError(parseError(err, 'Não foi possível anexar a ata.'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleApprove(meetingId: string) {
    if (!token) return;
    setBusyId(meetingId);
    try {
      await approveMeeting(token, meetingId);
      await loadMeetings();
    } catch (err) {
      setError(parseError(err, 'Não foi possível registrar a aprovação.'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(meetingId: string) {
    if (!token) return;
    setBusyId(meetingId);
    try {
      await deleteMeeting(token, meetingId);
      await loadMeetings();
    } catch (err) {
      setError(parseError(err, 'Não foi possível remover a reunião.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell
      eyebrow="Reuniões e atas"
      title="Reuniões"
      description="Registre as reuniões do projeto, anexe a ata e aprove em conjunto. A ata só é aprovada quando o admin e o gestor confirmam."
      navigation={isAdmin ? adminNavigation : managerNavigation}
    >
      <SectionPanel title="Nova reunião" eyebrow="Agendar">
        <form className="meeting-form" onSubmit={handleCreate}>
          <div className="meeting-form__grid">
            <label>
              <span>Data</span>
              <input type="date" value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} required />
            </label>
            <label>
              <span>Título</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Reunião de alinhamento"
                required
              />
            </label>
            {isAdmin ? (
              <label>
                <span>Projeto</span>
                <select value={projectId} onChange={(event) => setProjectId(event.target.value)} required>
                  <option value="">Selecione um projeto</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {projectLabel(project.id)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <label>
            <span>Descrição (opcional)</span>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Pauta, participantes ou observações da reunião."
            />
          </label>

          {formError ? <div className="form-error">{formError}</div> : null}

          <button type="submit" className="primary-button" disabled={isCreating}>
            <Plus size={16} />
            <span>{isCreating ? 'Criando...' : 'Criar reunião'}</span>
          </button>
        </form>
      </SectionPanel>

      <SectionPanel
        title="Reuniões registradas"
        eyebrow="Atas"
        action={<StatusPill>{meetings.length} reuniões</StatusPill>}
      >
        {error ? <div className="form-error">{error}</div> : null}

        {isLoading ? (
          <EmptyState title="Carregando reuniões..." description="Buscando as reuniões do projeto." />
        ) : meetings.length ? (
          <div className="meeting-list">
            {meetings.map((meeting) => {
              const href = fileHref(meeting.ata_file_url);
              const canApprove =
                (isAdmin && !meeting.admin_approved) || (!isAdmin && !meeting.manager_approved);
              const canDelete = isAdmin || meeting.created_by === user?.id;
              const busy = busyId === meeting.id;

              return (
                <article key={meeting.id} className="meeting-card">
                  <div className="meeting-card__head">
                    <div>
                      <span className="meeting-card__date">
                        <CalendarCheck size={14} /> {formatDate(meeting.meeting_date)}
                      </span>
                      <strong>{meeting.title}</strong>
                      {isAdmin ? <em>{projectLabel(meeting.project_id)}</em> : null}
                    </div>
                    <StatusPill tone={meeting.status === 'approved' ? 'success' : 'warning'}>
                      {meeting.status === 'approved' ? 'Aprovada' : 'Pendente'}
                    </StatusPill>
                  </div>

                  {meeting.description ? <p className="meeting-card__desc">{meeting.description}</p> : null}

                  <div className="meeting-card__ata">
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer" className="meeting-card__file">
                        <Download size={15} /> {meeting.ata_file_name ?? 'Baixar ata'}
                      </a>
                    ) : (
                      <span className="meeting-card__file meeting-card__file--empty">Nenhuma ata anexada</span>
                    )}
                    <label className="meeting-card__upload">
                      <input
                        type="file"
                        onChange={(event) => handleAta(meeting.id, event.target.files?.[0] ?? null)}
                        disabled={busy}
                      />
                      <span className="secondary-button">
                        <Upload size={15} /> {href ? 'Substituir ata' : 'Anexar ata'}
                      </span>
                    </label>
                  </div>

                  <div className="meeting-card__approvals">
                    <span className={`meeting-approval ${meeting.admin_approved ? 'is-done' : ''}`}>
                      {meeting.admin_approved ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                      Admin {meeting.admin_approved ? 'aprovou' : 'pendente'}
                    </span>
                    <span className={`meeting-approval ${meeting.manager_approved ? 'is-done' : ''}`}>
                      {meeting.manager_approved ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                      Gestor {meeting.manager_approved ? 'aprovou' : 'pendente'}
                    </span>
                  </div>

                  <div className="meeting-card__actions">
                    {canApprove ? (
                      <button
                        type="button"
                        className="primary-button"
                        disabled={busy || !meeting.ata_file_url}
                        onClick={() => handleApprove(meeting.id)}
                        title={meeting.ata_file_url ? undefined : 'Anexe a ata antes de aprovar'}
                      >
                        <CheckCircle2 size={16} />
                        <span>Aprovar como {isAdmin ? 'admin' : 'gestor'}</span>
                      </button>
                    ) : (
                      <span className="meeting-card__done">
                        <CheckCircle2 size={16} /> Você já aprovou
                      </span>
                    )}

                    {canDelete ? (
                      <button
                        type="button"
                        className="icon-button"
                        disabled={busy}
                        onClick={() => handleDelete(meeting.id)}
                        aria-label="Remover reunião"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Nenhuma reunião registrada"
            description="Crie uma reunião, anexe a ata e acompanhe as aprovações aqui."
          />
        )}
      </SectionPanel>
    </AppShell>
  );
}
