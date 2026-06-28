import { Building2, CalendarClock, FileUp, FolderKanban, House, Route as RouteIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { API_URL, ApiError } from '../api/client';
import { getCompanies, getProjectSchedule, getProjects } from '../api/services';
import type { Company, Project, ProjectSchedule } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { AppShell } from '../components/app-shell';
import { EmptyState } from '../components/empty-state';
import { ProjectCalendar, type ProjectCalendarEvent } from '../components/project-calendar';
import { SectionPanel } from '../components/section-panel';
import { StatusPill } from '../components/status-pill';

type ScheduleMode = 'admin' | 'manager';

const adminNavigation = [
  { to: '/admin', label: 'Home', icon: House },
  { to: '/admin/companies', label: 'Cadastro', icon: Building2 },
  { to: '/admin/projects', label: 'Clientes', icon: FolderKanban },
  { to: '/admin/schedule', label: 'Cronograma', icon: CalendarClock },
];

const managerNavigation = [
  { to: '/manager', label: 'Visao geral', icon: House },
  { to: '/manager/journey', label: 'Minha jornada', icon: RouteIcon },
  { to: '/manager/company-journey', label: 'Jornada da empresa', icon: FileUp },
  { to: '/manager/schedule', label: 'Cronograma', icon: CalendarClock },
];

function projectLabel(project: Project, companies: Company[]) {
  const company = companies.find((item) => item.id === project.company_id);
  if (!company) return project.name;
  if (company.name.trim().toLowerCase() === project.name.trim().toLowerCase()) return company.name;
  return `${company.name} - ${project.name}`;
}

function fileHref(fileUrl?: string | null) {
  if (!fileUrl) return null;
  if (fileUrl.startsWith('http')) return fileUrl;
  return `${API_URL}${fileUrl}`;
}

function mapScheduleEvents(schedule: ProjectSchedule | null, mode: ScheduleMode): ProjectCalendarEvent[] {
  return schedule?.items
    .filter((item) => item.item_type === 'document_request' || item.item_type === 'survey')
    .map((item) => ({
      id: item.id,
      title: item.document_title ?? item.title,
      sectionTitle: item.section_title,
      startsAt: item.available_from,
      endsAt: item.due_at,
      group: item.role_target,
      itemType: item.item_type,
      status: item.delivery_status,
      responseCount: item.response_count,
      expectedCount: item.expected_count,
      submittedAt: item.latest_submission?.submitted_at ?? item.last_response_at,
      fileName: item.latest_submission?.file_name ?? null,
      fileUrl: fileHref(item.latest_submission?.file_url),
      submissionNotes: item.latest_submission?.notes ?? null,
      submittedBy: item.latest_submission?.user_name ?? null,
      submittedByEmail: item.latest_submission?.user_email ?? null,
      href:
        mode === 'manager'
          ? item.role_target === 'manager'
            ? `/manager/company-journey?item=${item.id}`
            : `/manager/journey?item=${item.id}`
          : null,
    })) ?? [];
}

export function ProjectSchedulePage({ mode }: { mode: ScheduleMode }) {
  const { token, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [schedule, setSchedule] = useState<ProjectSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigation = mode === 'admin' ? adminNavigation : managerNavigation;
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const calendarEvents = useMemo(
    () => mapScheduleEvents(schedule, mode),
    [mode, schedule],
  );

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    async function loadProjects() {
      if (!token) return;

      setIsLoading(true);
      setError(null);

      try {
        const [projectData, companyData] = await Promise.all([
          getProjects(token),
          mode === 'admin' ? getCompanies(token) : Promise.resolve([]),
        ]);
        const sortedProjects = [...projectData.projects].sort((a, b) =>
          projectLabel(a, companyData).localeCompare(projectLabel(b, companyData)),
        );

        setProjects(sortedProjects);
        setCompanies(companyData);
        setSelectedProjectId((current) => current || sortedProjects[0]?.id || '');
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Nao foi possivel carregar os projetos.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadProjects();
  }, [mode, token]);

  useEffect(() => {
    if (!token || !selectedProjectId) {
      setSchedule(null);
      return;
    }

    async function loadSchedule() {
      if (!token || !selectedProjectId) return;

      setIsScheduleLoading(true);
      setError(null);

      try {
        setSchedule(await getProjectSchedule(token, selectedProjectId));
      } catch (err) {
        setSchedule(null);
        setError(err instanceof ApiError ? err.message : 'Nao foi possivel carregar o cronograma.');
      } finally {
        setIsScheduleLoading(false);
      }
    }

    void loadSchedule();
  }, [selectedProjectId, token]);

  if (!user) return null;

  return (
    <AppShell
      eyebrow={mode === 'admin' ? 'Admin' : 'Gestor'}
      title="Cronograma"
      description="Selecione a empresa/projeto e acompanhe as janelas de cada etapa."
      navigation={navigation}
    >
      {error ? <div className="form-error">{error}</div> : null}

      <SectionPanel
        title="Selecionar cronograma"
        eyebrow={mode === 'admin' ? 'Todos os clientes' : 'Projeto vinculado'}
        action={<StatusPill>{projects.length} projeto{projects.length === 1 ? '' : 's'}</StatusPill>}
      >
        <div className="schedule-toolbar">
          <label>
            <span>Empresa/projeto</span>
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              disabled={isLoading || !projects.length}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {projectLabel(project, companies)}
                </option>
              ))}
            </select>
          </label>

          {selectedProject ? (
            <div className="schedule-toolbar__meta">
              <strong>{projectLabel(selectedProject, companies)}</strong>
              <span>{selectedProject.description || 'Sem descricao cadastrada.'}</span>
            </div>
          ) : null}
        </div>
      </SectionPanel>

      <SectionPanel
        title="Calendario do projeto"
        eyebrow="Cronograma"
        action={<StatusPill>{calendarEvents.length} entregas</StatusPill>}
      >
        {isLoading || isScheduleLoading ? (
          <div className="project-calendar project-calendar--empty">
            <CalendarClock size={20} />
            <strong>Carregando cronograma...</strong>
            <span>Estamos buscando as etapas deste projeto.</span>
          </div>
        ) : projects.length ? (
          <ProjectCalendar events={calendarEvents} projectName={selectedProject ? projectLabel(selectedProject, companies) : undefined} />
        ) : (
          <EmptyState
            title="Nenhum projeto disponivel"
            description="Quando houver um projeto vinculado, o cronograma aparece aqui."
          />
        )}
      </SectionPanel>
    </AppShell>
  );
}
