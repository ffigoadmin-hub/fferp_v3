// ============================================
// Client Escalation & Hourly Critical Types
// ============================================

export type ClientEscalationStatus =
  | 'open'
  | 'acknowledged'
  | 'in_progress'
  | 'grace_period'
  | 'proof_submitted'
  | 'pending_closure_approval'
  | 'waiting_audit'
  | 'escalated_gm'
  | 'escalated_ceo'
  | 'resolved'
  | 'closed';

export type HourlyCriticalStatus =
  | 'open'
  | 'acknowledged'
  | 'in_progress'
  | 'proof_submitted'
  | 'pending_closure_approval'
  | 'waiting_audit'
  | 'breached'
  | 'resolved'
  | 'closed';

// NEW: Escalation type tags for NSM
export type EscalationType = 'escalation' | 'critical';
export type BusinessUnit = 'AMC' | 'JV';
export type VerticalType = 'engineering' | 'agri';

// Closure approval status
export type ClosureApprovalStatus = 'pending' | 'proof_submitted' | 'closure_approved' | 'rejected';

// Escalation Bucket for refined system
export type EscalationBucket =
  | 'eng_jv'
  | 'eng_direct'
  | 'agri_jv'
  | 'agri_direct'
  | 'farm_manager'
  | 'buy_back'
  | 'business_development'
  | 'hr'
  | 'head_office'
  | 'rental_sourcing'
  | 'tnskill'
  | 'nursery_landscaping'
  | 'site_visit'
  | 'purchase'
  | 'vendor_sourcing'
  | 'mts'
  | 'marketing'
  | 'crm'
  | 'data_analytics_legal'
  | 'farmers_factory'
  | 'agrimart'
  | 'palm_cafe'
  | 'finance'
  | 'rnd'
  | 'accounts'
  | 'ceo_office'
  | 'admin'
  | 'it_ai'
  | 'management_ops'
  | 'valluvam';

// Bucket display helpers
export const ESCALATION_BUCKETS: { value: EscalationBucket; label: string }[] = [
  { value: 'eng_jv', label: 'Engineering - JV' },
  { value: 'eng_direct', label: 'Engineering - Direct' },
  { value: 'agri_jv', label: 'Agri - JV' },
  { value: 'agri_direct', label: 'Agri - Direct' },
  { value: 'farm_manager', label: 'Farm Manager' },
  { value: 'buy_back', label: 'Buy Back' },
  { value: 'business_development', label: 'Business Development' },
  { value: 'hr', label: 'HR' },
  { value: 'head_office', label: 'Head Office' },
  { value: 'rental_sourcing', label: 'Rental Sourcing' },
  { value: 'tnskill', label: 'TNSkill' },
  { value: 'nursery_landscaping', label: 'Nursery & Landscaping' },
  { value: 'site_visit', label: 'Site Visit' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'vendor_sourcing', label: 'Vendor Sourcing' },
  { value: 'mts', label: 'MTS' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'crm', label: 'CRM' },
  { value: 'data_analytics_legal', label: 'Data Analytics & Legal' },
  { value: 'farmers_factory', label: 'Farmers Factory' },
  { value: 'agrimart', label: 'AgriMart' },
  { value: 'palm_cafe', label: 'Palm Cafe' },
  { value: 'finance', label: 'Finance' },
  { value: 'rnd', label: 'R&D' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'ceo_office', label: 'CEO Office' },
  { value: 'admin', label: 'Admin' },
  { value: 'it_ai', label: 'IT & AI' },
  { value: 'management_ops', label: 'Management Operations Team' },
  { value: 'valluvam', label: 'Valluvam' },
];

export type WorkflowDepartment =
  | 'Agri Operations' | 'Engineering' | 'Farm Manager' | 'Buy-Back'
  | 'Rental Sourcing' | 'TNSkill' | 'Nursery & Landscaping' | 'HR'
  | 'Head Office' | 'Business Development' | 'Site Visit'
  | 'Purchase' | 'Vendor Sourcing' | 'MTS' | 'Marketing' | 'CRM'
  | 'Data Analytics & Legal' | 'Farmers Factory' | 'AgriMart'
  | 'Palm Cafe' | 'Finance' | 'R&D' | 'Accounts' | 'CEO Office' | 'Admin'
  | 'IT & AI' | 'Management Operations Team' | 'Valluvam';

// Department display helpers
export const WORKFLOW_DEPARTMENTS: { value: WorkflowDepartment; label: string; icon: string }[] = [
  { value: 'Agri Operations', label: 'Agri', icon: 'Leaf' },
  { value: 'Engineering', label: 'Engineering', icon: 'Building2' },
  { value: 'Farm Manager', label: 'Farm Manager', icon: 'Tractor' },
  { value: 'Buy-Back', label: 'Buy-Back', icon: 'RefreshCcw' },
  { value: 'Rental Sourcing', label: 'Rental Sourcing', icon: 'Key' },
  { value: 'TNSkill', label: 'TNSkill', icon: 'GraduationCap' },
  { value: 'Nursery & Landscaping', label: 'Nursery & Landscaping', icon: 'Sprout' },
  { value: 'HR', label: 'HR', icon: 'Users' },
  { value: 'Head Office', label: 'Head Office', icon: 'Building' },
  { value: 'Business Development', label: 'Business Development', icon: 'Briefcase' },
  { value: 'Site Visit', label: 'Site Visit', icon: 'MapPin' },
  { value: 'Purchase', label: 'Purchase', icon: 'ShoppingBag' },
  { value: 'Vendor Sourcing', label: 'Vendor Sourcing', icon: 'Truck' },
  { value: 'MTS', label: 'MTS', icon: 'Tool' },
  { value: 'Marketing', label: 'Marketing', icon: 'Megaphone' },
  { value: 'CRM', label: 'CRM', icon: 'PhoneCall' },
  { value: 'Data Analytics & Legal', label: 'Data Analytics & Legal', icon: 'Scale' },
  { value: 'Farmers Factory', label: 'Farmers Factory', icon: 'Factory' },
  { value: 'AgriMart', label: 'AgriMart', icon: 'Store' },
  { value: 'Palm Cafe', label: 'Palm Cafe', icon: 'Coffee' },
  { value: 'Finance', label: 'Finance', icon: 'Banknote' },
  { value: 'R&D', label: 'R&D', icon: 'FlaskConical' },
  { value: 'Accounts', label: 'Accounts', icon: 'Calculator' },
  { value: 'CEO Office', label: 'CEO Office', icon: 'ShieldCheck' },
  { value: 'Admin', label: 'Admin', icon: 'Settings' },
  { value: 'IT & AI', label: 'IT & AI', icon: 'Cpu' },
  { value: 'Management Operations Team', label: 'Management Operations Team', icon: 'Briefcase' },
  { value: 'Valluvam', label: 'Valluvam', icon: 'Shield' },
];

export type CriticalIssueType = string; // Free text - no restrictions

export type TicketOwner = 'solver' | 'gm' | 'ceo';

// ============================================
// Client Escalation (NSM-Led Workflow)
// SLA: 10 Min Acknowledge | 3 Hour Resolve
// ============================================
export interface ClientEscalation {
  id: string;
  ticket_number: number;

  // Creator
  created_by: string;
  department: WorkflowDepartment;

  // Client info
  client_name: string;
  client_phone: string | null;
  issue_title: string;
  issue_description: string;
  priority: 'high' | 'critical';
  urgency?: 'low' | 'medium' | 'high' | 'critical';

  // NEW: Escalation type tags (Phase 4)
  escalation_type?: EscalationType;
  business_unit?: BusinessUnit;
  vertical?: VerticalType;

  // NEW: Project Intelligence (Refined System)
  project_id?: string;
  escalation_proof_url?: string; // Mandatory proof image for creation
  call_record_url?: string; // NEW: Mandatory call recording
  bucket?: EscalationBucket;

  rejection_reason?: string; // NEW: Reason if Admin rejects proof
  raw?: any; // NEW: Raw response data for flexibility

  // NEW: BOI Assignment (Refined System)
  assigned_smo_id?: string;
  assigned_gmo_id?: string;
  assigned_by_boi_id?: string;
  assigned_at?: string;
  assigned_to?: string;
  assigned_user_id?: string;
  assigned_user_names?: string[];
  assigned_role?: string;

  // NEW: Resolution proof media
  resolution_proof_audio_url?: string;
  resolution_proof_screenshot_urls?: string[];

  // NEW: Admin closure gate
  closure_admin_id?: string;
  closure_verified_at?: string;

  // Joined assignment data
  project?: { project_name: string; client_name: string; onboarded_date?: string; location_city?: string; location_state?: string };
  assigned_smo?: { name: string; email: string };
  assigned_gmo?: { name: string; email: string };
  assigned_user?: { name: string; email: string; department?: string };

  // Timestamps
  created_at: string;
  ack_deadline: string;
  resolve_deadline: string;
  grace_deadline: string | null;

  // Acknowledgment
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  ack_late: boolean;

  // Resolution
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_text: string | null;
  resolution_evidence_url: string | null;

  // NEW: Proof submission fields (Phase 3)
  proof_submitted_at?: string | null;
  proof_submitted_by?: string | null;
  proof_screenshot_urls?: string[] | null;
  proof_audio_url?: string | null;

  // NEW: Closure approval fields (Phase 3)
  closure_approved_at?: string | null;
  closure_approved_by?: string | null;
  closure_approval_status?: ClosureApprovalStatus;

  // GM Escalation (L2)
  forwarded_to_gm_at: string | null;
  gm_id: string | null;
  gm_ack_at: string | null;
  gm_ack_late: boolean;
  gm_resolved_at: string | null;
  gm_resolution_text: string | null;

  // CEO Escalation (L3)
  pushed_to_ceo_at: string | null;
  ceo_id: string | null;

  // Status
  status: ClientEscalationStatus;
  current_owner: TicketOwner;
  updated_at: string;

  // Joined data
  creator?: { name: string; email: string; department?: string; role?: string };
  acknowledger?: { name: string; email: string };
  resolver?: { name: string; email: string };
  gm?: { name: string; email: string };
  ceo?: { name: string; email: string };

  // Site Visit Specific (Unified System)
  site_visit_target_id?: string | null;
  issue_proof_url?: string | null;
  raised_by_rsh_id?: string | null;
  current_layer?: 'layer_1' | 'layer_2' | 'layer_3' | 'boi';
  assigned_layer_1_id?: string | null;
  assigned_layer_2_id?: string | null;
  assigned_layer_3_id?: string | null;
  layer_1_resolved_at?: string | null;
  layer_2_resolved_at?: string | null;
  layer_3_resolved_at?: string | null;

  // Accountability & Enhanced Escalation (Phase 4)
  priority_level?: 'P0' | 'P1' | 'P2' | 'P3';
  is_war_room?: boolean;
  war_room_url?: string;
  reminder_count?: number;
  tags?: string[];
  is_overdue?: boolean;
}

// ============================================
// Hourly Critical (Data Team-Led Workflow)
// SLA: 10 Min Acknowledge | 45 Min Resolve
// ============================================
export interface HourlyCritical {
  id: string;
  ticket_number: number;

  // Creator
  created_by: string;
  department: WorkflowDepartment;

  // Issue details
  issue_type: CriticalIssueType;
  issue_title: string;
  issue_description: string;
  proof_url: string;
  urgency?: string;

  // Timestamps
  created_at: string;
  ack_deadline: string;
  resolve_deadline: string;

  // Acknowledgment
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  ack_late: boolean;

  // Resolution
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_text: string | null;
  rejection_reason?: string;

  // Blast protocol
  blast_triggered_at: string | null;
  blast_notified_gm: boolean;
  blast_notified_admin: boolean;
  blast_notified_ceo: boolean;

  // NEW: Project Intelligence (Refined System)
  project_id?: string;
  bucket?: EscalationBucket;

  // NEW: BOI Assignment (Refined System)
  assigned_smo_id?: string;
  assigned_gmo_id?: string;
  assigned_by_boi_id?: string;
  assigned_at?: string;
  assigned_to?: string;
  assigned_by?: string;
  assigned_user_id?: string;
  assigned_user_ids?: string[];
  assigned_user_names?: string[];
  assigned_role?: string;

  // NEW: Resolution proof (mandatory)
  resolution_proof_url?: string;
  resolution_proof_audio_url?: string;
  resolution_proof_screenshot_urls?: string[];
  call_record_url?: string;

  // NEW: Admin audit gate
  audit_admin_id?: string;
  audit_verified_at?: string;

  // Joined assignment data
  assigned_smo?: { name: string; email: string };
  assigned_gmo?: { name: string; email: string };

  // Status
  status: HourlyCriticalStatus;
  updated_at: string;

  // Joined data
  creator?: { name: string; email: string };
  acknowledger?: { name: string; email: string };
  resolver?: { name: string; email: string };

  // Accountability & Enhanced Escalation (Phase 4)
  priority_level?: 'P0' | 'P1' | 'P2' | 'P3';
  is_war_room?: boolean;
  war_room_url?: string;
  reminder_count?: number;
  tags?: string[];
  is_overdue?: boolean;
}

// ============================================
// Timeline Entry
// ============================================
export interface WorkflowTimelineEntry {
  id: string;
  action: string;
  performed_by: string | null;
  performed_by_name: string | null;
  performed_by_role: string | null;
  details: any;
  created_at: string;
}

// ============================================
// Input Types
// ============================================
export interface CreateClientEscalationInput {
  department: WorkflowDepartment;
  client_name: string;
  client_phone?: string;
  issue_title: string;
  issue_description: string;
  evidence_url?: string;
  priority?: 'high' | 'critical';
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  // Escalation type tags
  escalation_type?: EscalationType;
  business_unit?: BusinessUnit;
  vertical?: VerticalType;
  // NEW: Project Intelligence (Refined System)
  project_id?: string;
  escalation_proof_url?: string; // Mandatory proof image
  call_record_url?: string; // NEW: Mandatory call recording
  bucket?: EscalationBucket;
}

export interface CreateHourlyCriticalInputRefined {
  department: WorkflowDepartment;
  issue_type: string;
  issue_title: string;
  issue_description: string;
  proof_url: string;
  project_id?: string;
  bucket?: EscalationBucket;
}

export interface CreateHourlyCriticalInput {
  department: WorkflowDepartment;
  issue_type: string; // Free text - no restrictions
  issue_title: string;
  issue_description: string;
  proof_url: string;
}

// ============================================
// SLA Timer Helpers
// ============================================
export function getTimeRemaining(deadline: string | null | undefined): number {
  if (!deadline) return 0;
  const deadlineTime = new Date(deadline).getTime();
  if (isNaN(deadlineTime)) return 0;
  const now = Date.now();
  return Math.max(0, deadlineTime - now);
}

export function getTimeOverdue(deadline: string | null | undefined): number {
  if (!deadline) return 0;
  const deadlineTime = new Date(deadline).getTime();
  if (isNaN(deadlineTime)) return 0;
  const now = Date.now();
  return Math.max(0, now - deadlineTime);
}

export function formatTimeRemaining(milliseconds: number): string {
  if (!milliseconds || isNaN(milliseconds) || milliseconds <= 0) return '00:00:00';

  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function formatMinutesRemaining(milliseconds: number): string {
  if (!milliseconds || isNaN(milliseconds) || milliseconds <= 0) return '00:00';

  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function getAckSLAStatus(deadline: string | null | undefined): 'ok' | 'warning' | 'critical' | 'breached' {
  if (!deadline) return 'breached';
  const remaining = getTimeRemaining(deadline);
  const minutes = remaining / (1000 * 60);

  if (remaining === 0) return 'breached';
  if (minutes < 2) return 'critical';
  if (minutes < 5) return 'warning';
  return 'ok';
}

export function getResolveSLAStatus(deadline: string | null | undefined, isHourlyCritical = false): 'ok' | 'warning' | 'critical' | 'breached' {
  if (!deadline) return 'breached';
  const remaining = getTimeRemaining(deadline);
  const minutes = remaining / (1000 * 60);

  if (remaining === 0) return 'breached';

  if (isHourlyCritical) {
    // 45 min SLA
    if (minutes < 10) return 'critical';
    if (minutes < 20) return 'warning';
  } else {
    // 3 hour SLA
    if (minutes < 15) return 'critical';
    if (minutes < 30) return 'warning';
  }

  return 'ok';
}

export function isValidProofUrl(url: string): boolean {
  return url.includes('drive.google.com') || url.includes('docs.google.com') || url.includes('sheets.google.com');
}

// Solver role mapping - deprecated solver roles removed
// GM now handles both departments
export const AGRI_SOLVERS: string[] = [];
export const ENG_SOLVERS: string[] = [];

export function isSolverForDepartment(role: string, department: WorkflowDepartment): boolean {
  const normalizedRole = role.toLowerCase().replace(/\s+/g, '_');
  // GM, Admin, CEO can work on all departments
  return ['gm', 'admin', 'ceo', 'gmo'].includes(normalizedRole);
}

// Helper to get department display info
export function getDepartmentInfo(department: string): { label: string; color: string } {
  const deptMap: Record<string, { label: string; color: string }> = {
    agri: { label: 'Agri', color: 'text-green-500' },
    'agri operations': { label: 'Agri Operations', color: 'text-green-500' },
    engineering: { label: 'Engineering', color: 'text-blue-500' },
    farm_manager: { label: 'Farm Manager', color: 'text-amber-500' },
    'farm manager': { label: 'Farm Manager', color: 'text-amber-500' },
    buy_back: { label: 'Buy-Back', color: 'text-purple-500' },
    'buy-back': { label: 'Buy-Back', color: 'text-purple-500' },
    rental_sourcing: { label: 'Rental Sourcing', color: 'text-rose-500' },
    'rental sourcing': { label: 'Rental Sourcing', color: 'text-rose-500' },
    tnskill: { label: 'TNSkill', color: 'text-indigo-500' },
    nursery_landscaping: { label: 'Nursery & Landscaping', color: 'text-emerald-500' },
    'nursery & landscaping': { label: 'Nursery & Landscaping', color: 'text-emerald-500' },
    hr: { label: 'HR', color: 'text-pink-500' },
    head_office: { label: 'Head Office', color: 'text-slate-400' },
    'head office': { label: 'Head Office', color: 'text-slate-400' },
    'business development': { label: 'Business Development', color: 'text-cyan-500' },
    'site visit': { label: 'Site Visit', color: 'text-orange-500' },
    'it & ai': { label: 'IT & AI', color: 'text-blue-400' },
    'management operations team': { label: 'Management Operations Team', color: 'text-sky-500' },
    valluvam: { label: 'Valluvam', color: 'text-orange-400' },
  };
  return deptMap[department?.toLowerCase()] || { label: department || 'Unknown', color: 'text-muted-foreground' };
}
