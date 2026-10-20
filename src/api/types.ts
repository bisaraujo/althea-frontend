export type UserRole = 'admin' | 'company' | 'manager' | 'employee';

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  company_id: string | null;
  project_id: string | null;
  platform_admin: boolean;
  admin_product_ids: string[];
  /** Verdadeiro enquanto a pessoa usa a senha provisoria recebida por e-mail. */
  must_change_password?: boolean;
};

export type LoginResponse = {
  access_token: string;
  token_type: 'bearer';
  user: AuthenticatedUser;
};

export type Project = {
  id: string;
  name: string;
  company_id: string;
  description: string | null;
};

export type FormAudience = 'all' | 'manager' | 'employee';

export type FormSummary = {
  id: string;
  title: string;
  company_id: string;
  project_id: string;
  description: string | null;
  status: string;
  audience: FormAudience;
};

export type Presentation = {
  id: string;
  title: string;
  company_id: string;
  project_id: string;
  description: string | null;
  file_url: string | null;
  status: string;
  audience: FormAudience;
};

export type Company = {
  id: string;
  name: string;
  email: string;
  user_id: string;
  /** Preenchido só na listagem do admin. */
  has_jornadas?: boolean | null;
};

export type ResponseRecord = {
  id: string;
  form_id: string;
  user_id: string;
  company_id: string;
  project_id: string;
  answers: Record<string, string>;
};

export type EmployeeRecord = {
  id: string;
  name: string;
  email: string;
  role: 'employee';
  company_id: string;
  project_id: string;
};

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  company_id: string | null;
  project_id: string | null;
  platform_admin: boolean;
  admin_product_ids: string[];
};

export type CompanyPortfolio = Company & {
  products: Product[];
  project_count: number;
  manager_count: number;
  employee_count: number;
  granted_module_count: number;
  total_module_count: number;
};

export type AdminAccessPayload = {
  platform_admin: boolean;
  product_ids: string[];
};

export type AdminCreatePayload = AdminAccessPayload & {
  name: string;
  email: string;
};

export type OrganizationalUnit = { id: string; company_id: string; name: string; unit_type: string; parent_id: string | null; active: boolean; created_at: string; updated_at: string };
export type OrganizationalArea = { id: string; company_id: string; name: string; unit_id: string | null; active: boolean; created_at: string; updated_at: string };
export type OrganizationalPosition = { id: string; company_id: string; name: string; area_id: string | null; active: boolean; created_at: string; updated_at: string };
export type OrganizationalStructure = { units: OrganizationalUnit[]; areas: OrganizationalArea[]; positions: OrganizationalPosition[] };
export type Person = { id: string; company_id: string; name: string; email: string | null; phone: string | null; status: string; custom_values: Record<string, unknown>; created_at: string; updated_at: string };
export type Employment = { id: string; company_id: string; person_id: string; person_name: string | null; person_email: string | null; unit_id: string | null; unit_name: string | null; area_id: string | null; area_name: string | null; position_id: string | null; position_name: string | null; user_id: string | null; status: string; started_at: string | null; ended_at: string | null; created_at: string; updated_at: string };
export type OrganizationalDocument = { id: string; company_id: string; title: string; document_type: string; entity_type: string; entity_id: string | null; status: string; current_version: number; file_name: string; file_url: string; created_at: string; updated_at: string };
export type OrganizationalAccessProfile = { id: string; company_id: string | null; name: string; description?: string | null; permissions: string[]; active: boolean; created_at: string; updated_at: string };
export type PermissionCatalogEntry = { key: string; label: string; module: string };
export type CompanyCustomCapabilityStatus = 'pending' | 'approved' | 'rejected';
export type CompanyCustomCapability = { id: string; company_id: string; capability_key: string; label: string; reason: string | null; requested_by: string | null; requested_at: string; approved_by: string | null; approved_at: string | null; rejected_by: string | null; rejected_at: string | null; status: CompanyCustomCapabilityStatus; company_name?: string | null; kind?: string; kind_label?: string; requested_by_name?: string | null; requested_by_email?: string | null; decided_by?: string | null; decided_by_name?: string | null; decided_at?: string | null; decision_note?: string | null; responsible_label?: string };
export type AccessAssignment = { id: string; employment_id: string; profile_id: string; unit_id: string | null; area_id: string | null; created_at: string; profile_name: string; person_name: string; person_email: string | null; unit_name: string | null; area_name: string | null; position_name?: string | null; employment_unit_name?: string | null; employment_area_name?: string | null };
export type EffectiveAccess = { company_id: string; role: UserRole; permissions: string[] };
export type OrganizationalImport = { id: string; company_id: string; file_name: string; status: string; rows: Array<Record<string, unknown>>; summary: Record<string, number>; created_at: string; committed_at: string | null };
export type CustomFieldDefinition = { id: string; company_id: string; entity_type: string; field_key: string; label: string; field_type: string; required: boolean; active: boolean };
export type OrganizationalAuditLog = { id: string; company_id: string; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; details: Record<string, unknown>; created_at: string };
export type ActionPlanItem = { id: string; action_plan_id: string; title: string; description: string | null; owner_name: string | null; due_at: string | null; frequency: string | null; status: string; created_at: string; updated_at: string };
export type ActionPlan = { id: string; project_id: string; status: string; submitted_at: string | null; created_at: string; updated_at: string; items: ActionPlanItem[] };
export type OperationalSurveyQuestion = { id: string; survey_id: string; question_key: string; title: string; question_type: string; order: number; required: boolean; options: string[] };
export type OperationalSurvey = { id: string; company_id: string | null; title: string; description: string | null; status: string; version: number; created_at: string; updated_at: string; questions: OperationalSurveyQuestion[] };
export type ResearchStage = { id: string; cycle_id: string; name: string; survey_id: string | null; stage_type: string; order: number; status: string; due_at: string | null };
export type ResearchCycle = { id: string; plan_id: string; name: string; frequency: string; status: string; starts_at: string | null; ends_at: string | null; stages: ResearchStage[] };
export type ResearchPlan = { id: string; company_id: string; project_id: string | null; name: string; status: string; starts_at: string | null; ends_at: string | null; created_at: string; updated_at: string; cycles: ResearchCycle[] };
export type FagulhaQuestion = { key: string; title: string; question_type: string; required: boolean; options: string[] };
export type FagulhaCampaign = { id: string; company_id: string; slug: string; title: string; description: string | null; status: string; starts_at: string | null; ends_at: string | null; questions: FagulhaQuestion[]; created_at: string; updated_at: string };
export type FagulhaAccess = { company_id: string; company_name: string; contracted: boolean; active: boolean; updated_at: string | null };
export type FagulhaAchievement = { id: string; company_id: string; name: string; description: string | null; badge: string | null; active: boolean; created_at: string };
export type FagulhaActivation = { id: string; company_id: string; name: string; email: string; token: string; status: string; activated_at: string | null; expires_at: string | null; created_at: string };

export type CompanyCreatePayload = {
  name: string;
  description?: string | null;
  email: string;
  /** Produtos contratados na criação. Lista vazia = nenhum produto. */
  product_ids?: string[];
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
};

export type ProductPayload = {
  name: string;
  description?: string | null;
};

export type CompanyProducts = {
  company_id: string;
  product_ids: string[];
};

export type ModuleOverrideMode = 'GRANT' | 'REVOKE';

export type ModuleEntitlement = {
  id: string;
  code: string;
  name: string;
  tier: string;
  product_id: string | null;
  created_at: string;
  granted: boolean;
  override_mode: ModuleOverrideMode | null;
  override_reason: string | null;
};

export type ModuleOverrideHistoryEntry = {
  id: string;
  company_id: string;
  module_code: string;
  module_name: string;
  mode: ModuleOverrideMode;
  granted_by: string | null;
  granted_by_name: string | null;
  reason: string | null;
  created_at: string;
};

export type ProjectCreatePayload = {
  name: string;
  company_id: string;
  description?: string | null;
};

export type ClientUserCreatePayload = {
  name: string;
  email: string;
  role: 'manager' | 'employee';
  company_id: string;
  project_id: string;
};

export type JourneyItemType =
  | 'text'
  | 'video'
  | 'presentation'
  | 'survey'
  | 'document_request'
  | 'meeting_approval'
  | 'schedule_approval';

export type JourneyItem = {
  id: string;
  section_id: string;
  title: string;
  description: string;
  item_type: JourneyItemType;
  order: number;
  is_required: boolean;
  status: string;
  available_from: string | null;
  due_at: string | null;
  form_id: string | null;
  presentation_id: string | null;
  video_url: string | null;
  content_text: string | null;
  document_title: string | null;
  accepted_formats: string[];
  extra_metadata: Record<string, unknown> | null;
  user_status?: string;
  response_id?: string | null;
  submitted_at?: string | null;
  submission_file_name?: string | null;
  submission_file_url?: string | null;
  submission_mime_type?: string | null;
  submission_notes?: string | null;
};

export type JourneySection = {
  id: string;
  journey_id: string;
  title: string;
  description: string;
  order: number;
  items: JourneyItem[];
};

export type Journey = {
  id: string;
  project_id: string;
  role_target: 'manager' | 'employee';
  title: string;
  description: string;
  status: string;
  sections: JourneySection[];
};

export type DocumentSubmissionPayload = {
  file_name: string;
  file_url: string;
  mime_type: string;
  notes: string;
};

export type DocumentSubmission = {
  id: string;
  journey_item_id: string;
  user_id: string;
  company_id: string;
  project_id: string | null;
  file_name: string;
  file_url: string;
  mime_type: string | null;
  notes: string | null;
  submitted_at: string;
  status: string;
  user_name?: string;
  user_email?: string | null;
  is_late?: boolean;
};

export type JourneyApprovalPayload = {
  decision: 'approved' | 'changes_requested';
  notes?: string | null;
};

export type JourneyApproval = {
  id: string;
  journey_item_id: string;
  user_id: string;
  company_id: string;
  project_id: string | null;
  decision: 'approved' | 'changes_requested';
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeImportRow = {
  name: string | null;
  email: string | null;
  status: 'created' | 'skipped' | 'invalid';
  detail: string | null;
  user_id: string | null;
};

export type EmployeeImportResult = {
  created: number;
  skipped: number;
  invalid: number;
  rows: EmployeeImportRow[];
};

export type Meeting = {
  id: string;
  company_id: string;
  project_id: string;
  title: string;
  meeting_date: string;
  description: string | null;
  ata_file_name: string | null;
  ata_file_url: string | null;
  admin_approved: boolean;
  admin_approved_by: string | null;
  admin_approved_at: string | null;
  manager_approved: boolean;
  manager_approved_by: string | null;
  manager_approved_at: string | null;
  manager_decision: 'approved' | 'changes_requested' | null;
  status: 'pending' | 'approved' | 'changes_requested';
  reviews: MeetingReview[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MeetingReview = {
  id: string;
  reviewer_id: string | null;
  reviewer_name: string;
  decision: 'approved' | 'changes_requested';
  notes: string | null;
  created_at: string;
};

export type MeetingCreatePayload = {
  title: string;
  meeting_date: string;
  description?: string | null;
  project_id?: string | null;
};

export type ManagerDeliveryItem = JourneyItem & {
  delivery_status: 'pending' | 'overdue' | 'submitted' | 'submitted_late';
  is_overdue: boolean;
  latest_submission: DocumentSubmission | null;
  submissions: DocumentSubmission[];
};

export type ManagerDeliverySection = {
  id: string;
  journey_id: string;
  title: string;
  description: string | null;
  order: number;
  items: ManagerDeliveryItem[];
};

export type ManagerDeliveries = {
  project: Project;
  journey: Omit<Journey, 'sections'> | null;
  managers: UserRecord[];
  sections: ManagerDeliverySection[];
};

export type ProjectScheduleItem = {
  id: string;
  journey_id: string;
  role_target: 'manager' | 'employee';
  section_id: string;
  section_title: string;
  title: string;
  description: string | null;
  item_type: JourneyItemType;
  document_title: string | null;
  available_from: string | null;
  due_at: string | null;
  is_required: boolean;
  delivery_status: 'pending' | 'overdue' | 'submitted' | 'submitted_late' | 'approved' | 'changes_requested' | null;
  response_count: number | null;
  expected_count: number | null;
  last_response_at: string | null;
  latest_submission: DocumentSubmission | null;
  latest_approval?: JourneyApproval | null;
};

export type ProjectSchedule = {
  project: Project;
  items: ProjectScheduleItem[];
  summary: {
    total: number;
    manager: number;
    employee: number;
  };
};

export type FormOption = {
  id: string;
  question_id: string;
  value: string;
  label: string;
  order: number;
  extra_metadata: Record<string, unknown> | null;
};

export type FormQuestion = {
  id: string;
  form_id: string;
  key: string;
  title: string;
  question_type: 'single_choice' | 'multi_select' | 'text' | 'number';
  order: number;
  required: boolean;
  description: string | null;
  extra_metadata: Record<string, unknown> | null;
  options: FormOption[];
};

export type FormDetail = FormSummary & {
  questions: FormQuestion[];
};

export type FormResponseOut = {
  id: string;
  form_id: string;
  answers: Record<string, string | string[]>;
};

export type FormDraft = {
  id: string;
  form_id: string;
  user_id: string;
  company_id: string;
  project_id: string | null;
  answers: Record<string, string | string[]>;
  current_question_key: string | null;
  created_at: string;
  updated_at: string;
};

export type JourneyProgress = {
  id: string;
  journey_item_id: string;
  user_id: string;
  company_id: string;
  project_id: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

