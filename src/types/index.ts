export type LeadStage =
  | 'New Lead'
  | 'Contacted'
  | 'Discovery Scheduled'
  | 'Discovery Complete'
  | 'Proposal Drafting'
  | 'Proposal Sent'
  | 'Negotiation'
  | 'Verbal Agreement'
  | 'Agreement Signed'
  | 'Invoice Sent'
  | 'Client Onboarding'
  | 'Project Created'
  | 'Proposal Lost'
  | 'No Response'
  | 'Not a Fit'
  | 'Future Opportunity';

export type ProjectStatus =
  | 'Project Acceptance'
  | 'Data Acquisition / Validation'
  | 'Analysis'
  | 'Analysis QC'
  | 'Report Generation'
  | 'Final Product QC'
  | 'Delivery'
  | 'Completed'
  | 'On Hold';

export type WaitingOn =
  | 'Waiting on Client Data'
  | 'Waiting on Payment'
  | 'Waiting on Internal Analysis'
  | 'Waiting on QC'
  | 'Waiting on Report Review'
  | 'Ready for Delivery'
  | null;

export type TaskPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type TaskStatus = 'Open' | 'In Progress' | 'Completed' | 'Cancelled';
export type TaskType = 'Lead' | 'Client' | 'Project' | 'Billing' | 'Internal Operations';

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Cancelled';

export type OpportunityType =
  | 'Market Expansion Analysis'
  | 'Competitor Landscape Analysis'
  | 'Site Selection'
  | 'Territory Optimization'
  | 'Demographic Analysis'
  | 'Commercial Real Estate Intelligence';

export type ServiceType = OpportunityType;

export type CommunicationType = 'note' | 'email' | 'call';

export type DocType = 'Contract' | 'Proposal' | 'Report' | 'Other';

export interface Lead {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  service_area: string | null;
  business_size: string | null;
  crm_used: string | null;
  opportunity_type: string | null;
  problem_being_solved: string | null;
  lead_source: string | null;
  estimated_deal_value: number | null;
  expected_close_date: string | null;
  stage: LeadStage;
  notes: string | null;
  next_action: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  service_area: string | null;
  business_size: string | null;
  notes: string | null;
  status: string;
  lifetime_value: number;
  google_maps_url?: string;
  facebook_url?: string;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataChecklist {
  crm_data_received: boolean;
  crm_data_validated: boolean;
  reference_solutions_acquired: boolean;
  census_data_acquired: boolean;
  google_places_acquired: boolean;
  review_data_acquired: boolean;
  additional_sources_acquired: boolean;
}

export interface Project {
  id: string;
  client_id: string;
  project_name: string;
  service_type: string | null;
  project_summary: string | null;
  status: ProjectStatus;
  waiting_on: WaitingOn;
  start_date: string | null;
  due_date: string | null;
  delivery_date: string | null;
  invoice_status: string;
  payment_status: string;
  internal_notes: string | null;
  data_checklist: DataChecklist;
  analysis_data?: Record<string, any> | null;
  master_report_html?: string | null;
  created_at: string;
  updated_at: string;
  clients?: { business_name: string };
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_date: string | null;
  status: TaskStatus;
  assigned_to: string | null;
  lead_id: string | null;
  client_id: string | null;
  project_id: string | null;
  task_type: TaskType;
  created_at: string;
  updated_at: string;
  clients?: { business_name: string } | null;
  projects?: { project_name: string } | null;
  leads?: { business_name: string } | null;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  project_id: string | null;
  amount: number;
  due_date: string | null;
  status: InvoiceStatus;
  payment_date: string | null;
  deposit_required: boolean;
  deposit_amount: number | null;
  deposit_received: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  clients?: { business_name: string };
  projects?: { project_name: string } | null;
}

export interface Communication {
  id: string;
  client_id: string | null;
  lead_id: string | null;
  type: CommunicationType;
  subject: string | null;
  body: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  client_id: string | null;
  project_id: string | null;
  name: string;
  doc_type: DocType;
  url: string | null;
  notes: string | null;
  created_at: string;
  clients?: { business_name: string } | null;
  projects?: { project_name: string } | null;
}

export interface ActivityLog {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  created_at: string;
}

export interface CrmCustomer {
  id: string;
  customer_id: string;
  first_name: string;
  last_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  lat: number;
  lng: number;
  total_revenue: number;
  total_visits: number;
  primary_service_type: string;
  business_owner_id: string;
  last_service_date?: string;
  lifetime_value?: number;
  email?: string;
  phone?: string;
}

export interface BusinessRecord {
  id: string;
  project_id: string;
  name: string;
  competitor_landscape?: any[];
  bbb_rating?: string;
  competitor_avg_bbb?: string;
  reported_complaints?: number;
}
