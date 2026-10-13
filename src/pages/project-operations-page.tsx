import { ArrowLeft, Check, Plus, Route as RouteIcon } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { createJourney, createJourneyItem, createJourneySection, getJourney, getProjects, listJourneys, updateJourney } from '../api/services';
import type { Journey, JourneyItemType, Project } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { productAdminNavigation } from '../components/admin-navigation';
import { AppShell } from '../components/app-shell';
import { SectionPanel } from '../components/section-panel';
import { StatusPill } from '../components/status-pill';
import { ActionPlanAgenda } from './action-plan-agenda';
import { ActionPlanEditor } from './action-plan-editor';

type View = 'flow' | 'plan' | 'agenda';
const itemTypes: Array<{ value: JourneyItemType; label: string }> = [
  { value: 'text', label: 'Conteúdo' }, { value: 'video', label: 'Vídeo' },
  { value: 'survey', label: 'Pesquisa' }, { value: 'document_request', label: 'Solicitação de documento' },
  { value: 'meeting_approval', label: 'Aprovação de reunião' }, { value: 'schedule_approval', label: 'Aprovação de cronograma' },
];
function errorText(error: unknown) { return error instanceof ApiError ? error.message : 'Não foi possível concluir.'; }

export function ProjectOperationsPage() {
  const { projectId = '' } = useParams(); const { token } = useAuth();
  const [view, setView] = useState<View>('flow'); const [project, setProject] = useState<Project | null>(null);
  const [journeys, setJourneys] = useState<Journey[]>([]); const [journey, setJourney] = useState<Journey | null>(null); 
  const [roleTarget, setRoleTarget] = useState<'manager' | 'employee'>('manager'); const [journeyTitle, setJourneyTitle] = useState('Jornada do gestor');
  const [sectionTitle, setSectionTitle] = useState(''); const [selectedSectionId, setSelectedSectionId] = useState(''); const [itemTitle, setItemTitle] = useState(''); const [itemType, setItemType] = useState<JourneyItemType>('text');
  const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null); const [saving, setSaving] = useState(false);

  async function load() {
    if (!token || !projectId) return;
    const [{ projects }, allJourneys] = await Promise.all([getProjects(token), listJourneys(token)]);
    setProject(projects.find((item) => item.id === projectId) || null); const projectJourneys = allJourneys.filter((item) => item.project_id === projectId); setJourneys(projectJourneys);
    const selected = projectJourneys.find((item) => item.role_target === roleTarget) || projectJourneys[0];
    if (selected) { const detail = await getJourney(token, selected.id); setJourney(detail); setSelectedSectionId((current) => current || detail.sections[0]?.id || ''); } else setJourney(null);
  }
  useEffect(() => { void load().catch((reason) => setError(errorText(reason))); }, [token, projectId]);
  useEffect(() => { if (!token) return; const selected = journeys.find((item) => item.role_target === roleTarget); if (selected) void getJourney(token, selected.id).then((detail) => { setJourney(detail); setSelectedSectionId(detail.sections[0]?.id || ''); }); else setJourney(null); }, [roleTarget]);

  async function act(action: () => Promise<unknown>, message: string) { if (saving) return; setSaving(true); setError(null); setSuccess(null); try { await action(); setSuccess(message); await load(); } catch (reason) { setError(errorText(reason)); } finally { setSaving(false); } }
  async function addJourney(event: FormEvent) { event.preventDefault(); if (!token) return; await act(() => createJourney(token, { project_id: projectId, role_target: roleTarget, title: journeyTitle, status: 'draft' }), 'Jornada criada.'); }
  async function addSection(event: FormEvent) { event.preventDefault(); if (!token || !journey) return; await act(() => createJourneySection(token, journey.id, { title: sectionTitle, order: journey.sections.length + 1 }), 'Etapa adicionada.'); setSectionTitle(''); }
  async function addItem(event: FormEvent) { event.preventDefault(); if (!token || !selectedSectionId) return; const section = journey?.sections.find((item) => item.id === selectedSectionId); await act(() => createJourneyItem(token, selectedSectionId, { title: itemTitle, item_type: itemType, order: (section?.items.length || 0) + 1, is_required: true, status: 'draft' }), 'Item adicionado.'); setItemTitle(''); }
  async function publishJourney() { if (!token || !journey) return; await act(() => updateJourney(token, journey.id, { status: journey.status === 'active' ? 'draft' : 'active' }), journey.status === 'active' ? 'Jornada voltou para rascunho.' : 'Jornada publicada.'); }

  return <AppShell eyebrow="Administração de Jornadas" title={project?.name || 'Operação da Jornada'} description="Edite o fluxo e organize o plano de ação do cliente." navigation={productAdminNavigation}>
    {error ? <div className="form-error">{error}</div> : null}{success ? <div className="form-success"><Check size={16}/>{success}</div> : null}
    <div className="project-operations-head"><Link to={`/admin/projects/${projectId}`} className="secondary-button"><ArrowLeft size={16}/>Voltar ao cliente</Link><div className="organization-tabs" role="tablist" aria-label="Operação do projeto"><button type="button" role="tab" aria-selected={view === 'flow'} className={view === 'flow' ? 'active' : ''} onClick={() => setView('flow')}>Fluxo da Jornada</button><button type="button" role="tab" aria-selected={view === 'plan'} className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}>Plano de ação</button><button type="button" role="tab" aria-selected={view === 'agenda'} className={view === 'agenda' ? 'active' : ''} onClick={() => setView('agenda')}>Agenda</button></div></div>
    {view === 'flow' ? <><SectionPanel title="Público da Jornada" eyebrow="Editor operacional"><div className="journey-role-switch"><button type="button" className={roleTarget === 'manager' ? 'active' : ''} onClick={() => setRoleTarget('manager')}>Gestores</button><button type="button" className={roleTarget === 'employee' ? 'active' : ''} onClick={() => setRoleTarget('employee')}>Colaboradores</button></div>{journey ? <div className="admin-action-link-group"><StatusPill>{journey.status}</StatusPill><button type="button" className="secondary-button" onClick={() => void publishJourney()} disabled={saving}>{journey.status === 'active' ? 'Voltar para rascunho' : 'Publicar Jornada'}</button></div> : <form className="compact-create-form" onSubmit={addJourney}><input value={journeyTitle} onChange={(e) => setJourneyTitle(e.target.value)} required/><button className="primary-button" disabled={saving}><RouteIcon size={16}/>Criar Jornada</button></form>}</SectionPanel>
    {journey ? <div className="content-grid"><SectionPanel title="Etapas" eyebrow={`${journey.sections.length}`}><form className="compact-create-form" onSubmit={addSection}><input placeholder="Nome da etapa" value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} required/><button className="primary-button" disabled={saving}><Plus size={16}/>Adicionar</button></form><div className="admin-list">{journey.sections.map((section) => <button type="button" key={section.id} className={`journey-editor-section ${selectedSectionId === section.id ? 'active' : ''}`} onClick={() => setSelectedSectionId(section.id)}><strong>{section.order}. {section.title}</strong><span>{section.items.length} item(ns)</span></button>)}</div></SectionPanel><SectionPanel title="Itens da etapa" eyebrow="Conteúdos e tarefas"><form className="admin-form" onSubmit={addItem}><label><span>Título</span><input value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} required/></label><label><span>Tipo</span><select value={itemType} onChange={(e) => setItemType(e.target.value as JourneyItemType)}>{itemTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><button className="primary-button" disabled={!selectedSectionId || saving}><Plus size={16}/>Adicionar item</button></form><div className="admin-list">{journey.sections.find((section) => section.id === selectedSectionId)?.items.map((item) => <article className="list-item" key={item.id}><div className="list-item__copy"><strong>{item.title}</strong><p>{itemTypes.find((type) => type.value === item.item_type)?.label || item.item_type}</p></div><StatusPill>{item.status}</StatusPill></article>)}</div></SectionPanel></div> : null}</> : null}
    {view === 'plan' && token ? <ActionPlanEditor token={token} projectId={projectId} companyId={project?.company_id ?? null} /> : null}
    {view === 'agenda' && token && project?.company_id ? <ActionPlanAgenda token={token} companyId={project.company_id} /> : null}
  </AppShell>;
}
