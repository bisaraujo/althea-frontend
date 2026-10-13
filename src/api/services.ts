import { request } from './client';
import type {
  ClientUserCreatePayload,
  Company,
  CompanyCreatePayload,
  DocumentSubmission,
  DocumentSubmissionPayload,
  EmployeeImportResult,
  EmployeeRecord,
  FormSummary,
  Journey,
  JourneyItem,
  JourneyItemType,
  JourneySection,
  JourneyApproval,
  JourneyApprovalPayload,
  LoginResponse,
  ManagerDeliveries,
  Meeting,
  MeetingCreatePayload,
  Presentation,
  Project,
  ProjectCreatePayload,
  ProjectSchedule,
  Product,
  ProductPayload,
  CompanyProducts,
  ModuleEntitlement,
  ModuleOverrideHistoryEntry,
  ModuleOverrideMode,
  ResponseRecord,
  FormDetail,
  FormDraft,
  FormResponseOut,
  JourneyProgress,
  UserRecord
} from './types';
import type { AdminAccessPayload, AdminCreatePayload, CompanyPortfolio } from './types';
import type { Employment, OrganizationalAccessProfile, OrganizationalArea, OrganizationalImport, OrganizationalPosition, OrganizationalStructure, OrganizationalUnit, Person } from './types';
import type { FagulhaAccess, FagulhaAchievement, FagulhaCampaign, FagulhaQuestion, OperationalSurvey, OperationalSurveyQuestion, ResearchCycle, ResearchPlan, ResearchStage } from './types';
import type { CustomFieldDefinition, FagulhaActivation } from './types';
import type { AccessAssignment, CompanyCustomCapability, CompanyCustomCapabilityStatus, EffectiveAccess, PermissionCatalogEntry } from './types';

export async function login(username: string, password: string) {
  const body = new URLSearchParams({
    username,
    password,
  });

  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
}

export async function requestPasswordReset(email: string) {
  return request<{ message: string }>('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function confirmPasswordReset(email: string, code: string, newPassword: string) {
  return request<{ message: string }>('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ email, code, new_password: newPassword }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function getMyCompany(token: string) {
  return request<Company>('/companies/me', { token });
}

export async function getCompanies(token: string) {
  return request<Company[]>('/companies', { token });
}

export async function createCompany(token: string, payload: CompanyCreatePayload) {
  return request<Company>('/companies', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function getProjects(token: string) {
  const projects = await request<Project[]>('/projects', { token });
  return { projects };
}

export async function createProject(token: string, payload: ProjectCreatePayload) {
  return request<Project>('/projects', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function getUsers(token: string) {
  return request<UserRecord[]>('/users', { token });
}

export async function createUser(token: string, payload: ClientUserCreatePayload) {
  return request<UserRecord>('/users', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function getForms(token: string) {
  const forms = await request<FormSummary[]>('/forms', { token });
  return { forms };
}

export async function getPresentations(token: string) {
  const presentations = await request<Presentation[]>('/presentations', { token });
  return { presentations };
}

export async function getResponses(token: string) {
  return request<{ responses: ResponseRecord[] }>('/responses', { token });
}

export async function getManagerJourney(token: string) {
  return request<Journey>('/manager/journey', { token });
}

export async function getManagerCompanyJourney(token: string) {
  return request<Journey>('/manager/company-journey', { token });
}

export async function getEmployeeJourney(token: string) {
  return request<Journey>('/employee/journey', { token });
}

export async function completeEmployeeJourneyItem(token: string, itemId: string) {
  return request<JourneyProgress>(`/employee/journey/items/${itemId}/complete`, {
    token,
    method: 'POST',
  });
}

export async function completeManagerJourneyItem(token: string, itemId: string) {
  return request<JourneyProgress>(`/manager/journey/items/${itemId}/complete`, {
    token,
    method: 'POST',
  });
}

export async function uploadEmployeeDocumentFile(token: string, itemId: string, payload: FormData) {
  return request<DocumentSubmission>(`/employee/journey/items/${itemId}/upload-file`, {
    token,
    method: 'POST',
    body: payload,
  });
}

export async function uploadManagerJourneyDocumentFile(token: string, itemId: string, payload: FormData) {
  return request<DocumentSubmission>(`/manager/journey/items/${itemId}/upload-file`, {
    token,
    method: 'POST',
    body: payload,
  });
}

export async function completeManagerCompanyJourneyItem(token: string, itemId: string) {
  return request<JourneyProgress>(`/manager/company-journey/items/${itemId}/complete`, {
    token,
    method: 'POST',
  });
}

export async function approveManagerCompanyJourneyItem(
  token: string,
  itemId: string,
  payload: JourneyApprovalPayload,
) {
  return request<JourneyApproval>(`/manager/company-journey/items/${itemId}/approval`, {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function getManagerEmployees(token: string) {
  return request<{ employees: EmployeeRecord[] }>('/manager/employees', { token });
}

export async function importProjectEmployees(token: string, projectId: string, payload: FormData) {
  return request<EmployeeImportResult>(`/projects/${projectId}/employees/import`, {
    token,
    method: 'POST',
    body: payload,
  });
}

export async function listMeetings(token: string, projectId?: string) {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  return request<{ meetings: Meeting[] }>(`/meetings${query}`, { token });
}

export async function createMeeting(token: string, payload: MeetingCreatePayload) {
  return request<Meeting>('/meetings', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function uploadMeetingAta(token: string, meetingId: string, payload: FormData) {
  return request<Meeting>(`/meetings/${meetingId}/ata`, {
    token,
    method: 'POST',
    body: payload,
  });
}

export async function approveMeeting(token: string, meetingId: string) {
  return request<Meeting>(`/meetings/${meetingId}/approve`, {
    token,
    method: 'POST',
  });
}

export async function getCompanyPortfolio(token: string) {
  return request<CompanyPortfolio[]>('/platform-admin/companies', { token });
}

export async function getAdministrators(token: string) {
  return request<UserRecord[]>('/platform-admin/administrators', { token });
}

export async function createAdministrator(token: string, payload: AdminCreatePayload) {
  return request<UserRecord>('/platform-admin/administrators', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function updateAdministratorAccess(
  token: string,
  userId: string,
  payload: AdminAccessPayload,
) {
  return request<UserRecord>(`/platform-admin/administrators/${userId}/access`, {
    token,
    method: 'PUT',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function getOrganizationalStructure(token: string, companyId: string) { return request<OrganizationalStructure>(`/companies/${companyId}/organization`, { token }); }
export async function createOrganizationalUnit(token: string, companyId: string, payload: { name: string; unit_type: string; parent_id?: string | null }) { return request<OrganizationalUnit>(`/companies/${companyId}/organizational-units`, { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function createOrganizationalArea(token: string, companyId: string, payload: { name: string; unit_id?: string | null }) { return request<OrganizationalArea>(`/companies/${companyId}/areas`, { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function createOrganizationalPosition(token: string, companyId: string, payload: { name: string; area_id?: string | null }) { return request<OrganizationalPosition>(`/companies/${companyId}/positions`, { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function getPeople(token: string, companyId: string) { return request<Person[]>(`/companies/${companyId}/people`, { token }); }
export async function createPerson(token: string, companyId: string, payload: { name: string; email?: string | null; phone?: string | null }) { return request<Person>(`/companies/${companyId}/people`, { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function getEmployments(token: string, companyId: string) { return request<Employment[]>(`/companies/${companyId}/employments`, { token }); }
export async function createEmployment(token: string, personId: string, payload: { unit_id?: string | null; area_id?: string | null; position_id?: string | null; started_at?: string | null; user_id?: string | null }) { return request<Employment>(`/people/${personId}/employments`, { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function getOrganizationalAccessProfiles(token: string, companyId: string) { return request<OrganizationalAccessProfile[]>(`/companies/${companyId}/access-profiles`, { token }); }
export async function getPermissionCatalog(token: string) { return request<PermissionCatalogEntry[]>('/access-profiles/permission-catalog', { token }); }
export async function getGlobalAccessProfiles(token: string) { return request<OrganizationalAccessProfile[]>('/access-profiles/global', { token }); }
export async function requestCustomCapability(token: string, companyId: string, payload: { capability_key: string; label: string; reason?: string | null }) { return request<CompanyCustomCapability>(`/companies/${companyId}/custom-capabilities`, { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function getCompanyCustomCapabilities(token: string, companyId: string) { return request<CompanyCustomCapability[]>(`/companies/${companyId}/custom-capabilities`, { token }); }
export async function getAllCustomCapabilities(token: string, status?: CompanyCustomCapabilityStatus) { return request<CompanyCustomCapability[]>(`/custom-capabilities${status ? `?status=${status}` : ''}`, { token }); }
export async function getAccessProfileTemplates(token: string) { return request<OrganizationalAccessProfile[]>('/access-profiles/templates', { token }); }
export async function createAccessProfileFromTemplate(token: string, companyId: string, templateId: string, name?: string) { return request<OrganizationalAccessProfile>(`/companies/${companyId}/access-profiles/from-template/${templateId}`, { token, method: 'POST', body: JSON.stringify(name ? { name } : {}), headers: { 'Content-Type': 'application/json' } }); }
export async function getAccessAssignments(token: string, companyId: string) { return request<AccessAssignment[]>(`/companies/${companyId}/access-scopes`, { token }); }
export async function revokeAccessAssignment(token: string, scopeId: string) { return request<unknown>(`/access-scopes/${scopeId}`, { token, method: 'DELETE' }); }
export async function getMyEffectiveAccess(token: string, companyId: string) { return request<EffectiveAccess>(`/users/me/effective-access?company_id=${companyId}`, { token }); }
export async function getCustomFields(token: string, companyId: string) { return request<CustomFieldDefinition[]>(`/companies/${companyId}/custom-fields`, { token }); }
export async function createCustomField(token: string, companyId: string, payload: { entity_type: string; field_key: string; label: string; field_type: string; required: boolean }) { return request<CustomFieldDefinition>(`/companies/${companyId}/custom-fields`, { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function assignEmploymentAccessScope(token: string, employmentId: string, payload: { profile_id: string; unit_id?: string | null; area_id?: string | null }) { return request(`/employments/${employmentId}/access-scopes`, { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function createOrganizationalImport(token: string, companyId: string, payload: { file_name: string; rows: Array<{ name: string; email?: string; unit?: string; area?: string; position?: string; started_at?: string }> }) { return request<OrganizationalImport>(`/companies/${companyId}/organizational-imports`, { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function commitOrganizationalImport(token: string, batchId: string) { return request<OrganizationalImport>(`/organizational-imports/${batchId}/commit`, { token, method: 'POST' }); }
export async function listJourneys(token: string) { return request<Journey[]>('/journeys', { token }); }
export async function getJourney(token: string, journeyId: string) { return request<Journey>(`/journeys/${journeyId}`, { token }); }
export async function createJourney(token: string, payload: { project_id: string; role_target: 'manager' | 'employee'; title: string; description?: string | null; status?: 'draft' | 'active' | 'archived' }) { return request<Journey>('/journeys', { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function updateJourney(token: string, journeyId: string, payload: { title?: string; description?: string | null; status?: 'draft' | 'active' | 'archived' }) { return request<Journey>(`/journeys/${journeyId}`, { token, method: 'PUT', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function createJourneySection(token: string, journeyId: string, payload: { title: string; description?: string | null; order: number }) { return request<JourneySection>(`/journeys/${journeyId}/sections`, { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function createJourneyItem(token: string, sectionId: string, payload: { title: string; description?: string | null; item_type: JourneyItemType; order: number; is_required: boolean; status: 'draft' | 'active' | 'archived'; content_text?: string | null; due_at?: string | null }) { return request<JourneyItem>(`/journeys/sections/${sectionId}/items`, { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function getOperationalSurveys(token: string) { return request<OperationalSurvey[]>('/operational-surveys', { token }); }
export async function createOperationalSurvey(token: string, payload: { title: string; description?: string | null; company_id?: string | null }) { return request<OperationalSurvey>('/operational-surveys', { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function addOperationalSurveyQuestion(token: string, surveyId: string, payload: { question_key: string; title: string; question_type: string; order: number; required: boolean; options: string[] }) { return request<OperationalSurveyQuestion>(`/operational-surveys/${surveyId}/questions`, { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function transitionOperationalSurvey(token: string, surveyId: string, action: string) { return request<OperationalSurvey>(`/operational-surveys/${surveyId}/transition/${action}`, { token, method: 'POST' }); }
export async function createOperationalSurveyVersion(token: string, surveyId: string) { return request<OperationalSurvey>(`/operational-surveys/${surveyId}/versions`, { token, method: 'POST' }); }
export async function getResearchPlans(token: string, companyId: string) { return request<ResearchPlan[]>(`/companies/${companyId}/research-plans`, { token }); }
export async function createResearchPlan(token: string, payload: { company_id: string; project_id?: string | null; name: string; starts_at?: string | null; ends_at?: string | null }) { return request<ResearchPlan>('/research-plans', { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function addResearchCycle(token: string, planId: string, payload: { name: string; frequency: string; starts_at?: string | null; ends_at?: string | null }) { return request<ResearchCycle>(`/research-plans/${planId}/cycles`, { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function addResearchStage(token: string, cycleId: string, payload: { name: string; survey_id?: string | null; stage_type: string; order: number; due_at?: string | null }) { return request<ResearchStage>(`/research-cycles/${cycleId}/stages`, { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function transitionResearchPlan(token: string, planId: string, action: string) { return request<ResearchPlan>(`/research-plans/${planId}/transition/${action}`, { token, method: 'POST' }); }
export async function getFagulhaAccess(token: string) { return request<FagulhaAccess[]>('/fagulha-admin/access', { token }); }
export async function updateFagulhaAccess(token: string, companyId: string, active: boolean) { return request(`/fagulha-admin/companies/${companyId}/access`, { token, method: 'PUT', body: JSON.stringify({ active }), headers: { 'Content-Type': 'application/json' } }); }
export async function getFagulhaCampaigns(token: string, companyId: string) { return request<FagulhaCampaign[]>(`/fagulha-admin/companies/${companyId}/campaigns`, { token }); }
export async function createFagulhaCampaign(token: string, payload: { company_id: string; slug: string; title: string; description?: string | null; questions: FagulhaQuestion[] }) { return request<FagulhaCampaign>('/fagulha-admin/campaigns', { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function transitionFagulhaCampaign(token: string, campaignId: string, action: string) { return request<FagulhaCampaign>(`/fagulha-admin/campaigns/${campaignId}/transition/${action}`, { token, method: 'POST' }); }
export async function getFagulhaAchievements(token: string, companyId: string) { return request<FagulhaAchievement[]>(`/fagulha-admin/companies/${companyId}/achievements`, { token }); }
export async function createFagulhaAchievement(token: string, payload: { company_id: string; name: string; description?: string | null; badge?: string | null }) { return request<FagulhaAchievement>('/fagulha-admin/achievements', { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function createFagulhaActivation(token: string, payload: { company_id: string; name: string; email: string; expires_at?: string | null }) { return request<FagulhaActivation>('/fagulha-admin/activations', { token, method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }
export async function activateFagulhaInvite(inviteToken: string) { return request<FagulhaActivation>(`/public/fagulha/activate/${inviteToken}`, { method: 'POST' }); }
export async function getPublicFagulhaCampaign(companyId: string, slug: string) { return request<FagulhaCampaign>(`/public/fagulha/${companyId}/${slug}`); }
export async function submitPublicFagulhaResponse(companyId: string, slug: string, payload: { participant_name: string; participant_email: string; answers: Record<string, string | string[]> }) { return request(`/public/fagulha/${companyId}/${slug}/responses`, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }); }

export async function getProducts(token: string) {
  return request<Product[]>('/products', { token });
}

export async function updateProduct(token: string, productId: string, payload: ProductPayload) {
  return request<Product>(`/products/${productId}`, {
    token,
    method: 'PUT',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function getCompanyProducts(token: string, companyId: string) {
  return request<CompanyProducts>(`/companies/${companyId}/products`, { token });
}

export async function updateCompanyProducts(token: string, companyId: string, productIds: string[]) {
  return request<CompanyProducts>(`/companies/${companyId}/products`, {
    token,
    method: 'PUT',
    body: JSON.stringify({ product_ids: productIds }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function listCompanyModules(token: string, companyId: string) {
  return request<ModuleEntitlement[]>(`/companies/${companyId}/modules`, { token });
}

export async function listCompanyModuleHistory(token: string, companyId: string) {
  return request<ModuleOverrideHistoryEntry[]>(`/companies/${companyId}/modules/history`, { token });
}

export async function updateCompanyModule(
  token: string,
  companyId: string,
  moduleCode: string,
  mode: ModuleOverrideMode,
  reason?: string | null,
) {
  return request(`/companies/${companyId}/modules/${moduleCode}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({ mode, reason: reason || null }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function reviewMeeting(
  token: string,
  meetingId: string,
  decision: 'approved' | 'changes_requested',
  notes?: string,
) {
  return request<Meeting>(`/meetings/${meetingId}/review`, {
    token,
    method: 'POST',
    body: JSON.stringify({ decision, notes: notes?.trim() || null }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deleteMeeting(token: string, meetingId: string) {
  return request<{ status: string; id: string }>(`/meetings/${meetingId}`, {
    token,
    method: 'DELETE',
  });
}

export async function getManagerForms(token: string) {
  return request<{ forms: FormSummary[] }>('/manager/forms', { token });
}

export async function getEmployeeForms(token: string) {
  return request<{ forms: FormSummary[] }>('/employee/forms', { token });
}

export async function getManagerPresentations(token: string) {
  return request<{ presentations: Presentation[] }>('/manager/presentations', { token });
}

export async function getEmployeePresentations(token: string) {
  return request<{ presentations: Presentation[] }>('/employee/presentations', { token });
}

export async function getManagerResponses(token: string) {
  return request<{ responses: ResponseRecord[] }>('/manager/responses', { token });
}

export async function uploadManagerDocument(
  token: string,
  itemId: string,
  payload: DocumentSubmissionPayload,
) {
  return request(`/manager/company-journey/items/${itemId}/upload-document`, {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function uploadManagerDocumentFile(
  token: string,
  itemId: string,
  payload: FormData,
) {
  return request(`/manager/company-journey/items/${itemId}/upload-file`, {
    token,
    method: 'POST',
    body: payload,
  });
}

export async function getProjectManagerDeliveries(token: string, projectId: string) {
  return request<ManagerDeliveries>(`/projects/${projectId}/manager-deliveries`, { token });
}

export async function getProjectSchedule(token: string, projectId: string) {
  return request<ProjectSchedule>(`/projects/${projectId}/schedule`, { token });
}

export async function getEmployeeFormDetail(token: string, formId: string) {
  return request<FormDetail>(`/employee/forms/${formId}/detail`, { token });
}

export async function getManagerFormDetail(token: string, formId: string) {
  return request<FormDetail>(`/manager/forms/${formId}/detail`, { token });
}

export async function submitEmployeeForm(
  token: string,
  formId: string,
  answers: Record<string, string | string[]>,
) {
  return request<FormResponseOut>(`/employee/forms/${formId}/submit`, {
    token,
    method: 'POST',
    body: JSON.stringify({ answers }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function getEmployeeFormDraft(token: string, formId: string) {
  return request<FormDraft | null>(`/employee/forms/${formId}/draft`, { token });
}

export async function saveEmployeeFormDraft(
  token: string,
  formId: string,
  answers: Record<string, string | string[]>,
  currentQuestionKey: string | null,
) {
  return request<FormDraft>(`/employee/forms/${formId}/draft`, {
    token,
    method: 'PUT',
    body: JSON.stringify({ answers, current_question_key: currentQuestionKey }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function clearEmployeeFormDraft(token: string, formId: string) {
  return request<void>(`/employee/forms/${formId}/draft`, {
    token,
    method: 'DELETE',
  });
}

export async function submitManagerForm(
  token: string,
  formId: string,
  answers: Record<string, string | string[]>,
) {
  return request<FormResponseOut>(`/manager/forms/${formId}/submit`, {
    token,
    method: 'POST',
    body: JSON.stringify({ answers }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function getManagerFormDraft(token: string, formId: string) {
  return request<FormDraft | null>(`/manager/forms/${formId}/draft`, { token });
}

export async function saveManagerFormDraft(
  token: string,
  formId: string,
  answers: Record<string, string | string[]>,
  currentQuestionKey: string | null,
) {
  return request<FormDraft>(`/manager/forms/${formId}/draft`, {
    token,
    method: 'PUT',
    body: JSON.stringify({ answers, current_question_key: currentQuestionKey }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function clearManagerFormDraft(token: string, formId: string) {
  return request<void>(`/manager/forms/${formId}/draft`, {
    token,
    method: 'DELETE',
  });
}
