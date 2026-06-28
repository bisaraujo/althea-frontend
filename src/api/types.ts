export type UserRole = 'admin' | 'company' | 'manager' | 'employee';

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  company_id: string | null;
  project_id: string | null;
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
};

export type CompanyCreatePayload = {
  name: string;
  description?: string | null;
  email: string;
  senha: string;
};

export type ProjectCreatePayload = {
  name: string;
  company_id: string;
  description?: string | null;
};

export type ClientUserCreatePayload = {
  name: string;
  email: string;
  senha: string;
  role: 'manager' | 'employee';
  company_id: string;
  project_id: string;
};

export type JourneyItemType =
  | 'text'
  | 'video'
  | 'presentation'
  | 'survey'
  | 'document_request';

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
  delivery_status: 'pending' | 'overdue' | 'submitted' | 'submitted_late' | null;
  response_count: number | null;
  expected_count: number | null;
  last_response_at: string | null;
  latest_submission: DocumentSubmission | null;
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
