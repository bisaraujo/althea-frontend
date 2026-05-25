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
  description: string;
};

export type FormAudience = 'all' | 'manager' | 'employee';

export type FormSummary = {
  id: string;
  title: string;
  company_id: string;
  project_id: string;
  description: string;
  status: string;
  audience: FormAudience;
};

export type Presentation = {
  id: string;
  title: string;
  company_id: string;
  project_id: string;
  description: string;
  file_url: string;
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