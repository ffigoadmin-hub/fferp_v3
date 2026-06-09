// Escalation Types for WhatsApp SLA Governance

export type EscalationStatus = 'pending' | 'gm_viewing' | 'resolved' | 'breached';

export type ComplaintSource = 'whatsapp' | 'call' | 'email' | 'in_person';

export type EscalationVertical = 'civil' | 'agri';

export interface Escalation {
  id: string;
  escalation_number: number;
  
  // Complaint details
  customer_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  project_id: string | null;
  complaint_text: string;
  complaint_source: ComplaintSource;
  vertical: EscalationVertical;
  
  // SMO submission
  smo_id: string;
  smo_submitted_at: string;
  site_evidence_url: string | null;
  
  // GM resolution
  gm_id: string | null;
  gm_viewed_at: string | null;
  gm_resolved_at: string | null;
  resolution_text: string | null;
  resolution_evidence_url: string | null;
  
  // SLA tracking
  sla_deadline: string;
  sla_breached: boolean;
  sla_breach_notified_at: string | null;
  
  status: EscalationStatus;
  created_at: string;
  updated_at: string;
  
  // Joined data
  project?: {
    project_name: string;
    project_id: string;
  };
  smo?: {
    name: string;
    email: string;
  };
  gm?: {
    name: string;
    email: string;
  };
}

export interface EscalationTimelineEntry {
  id: string;
  escalation_id: string;
  action: string;
  performed_by: string | null;
  performed_by_name: string | null;
  performed_by_role: string | null;
  details: any;
  created_at: string;
}

export interface CreateEscalationInput {
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  project_id?: string;
  complaint_text: string;
  complaint_source?: ComplaintSource;
  site_evidence_url?: string;
  vertical: EscalationVertical;
}

export interface ResolveEscalationInput {
  resolution_text: string;
  resolution_evidence_url: string; // Must be Google Drive link
}

// SLA Timer helpers
export function getSLATimeRemaining(slaDeadline: string): number {
  const deadline = new Date(slaDeadline).getTime();
  const now = Date.now();
  return Math.max(0, deadline - now);
}

export function getSLAStatus(slaDeadline: string): 'green' | 'yellow' | 'red' | 'breached' {
  const remaining = getSLATimeRemaining(slaDeadline);
  const minutes = remaining / (1000 * 60);
  
  if (remaining === 0) return 'breached';
  if (minutes < 10) return 'red';
  if (minutes < 30) return 'yellow';
  return 'green';
}

export function formatSLATime(milliseconds: number): string {
  if (milliseconds <= 0) return '00:00';
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function isValidGoogleDriveLink(url: string): boolean {
  return url.includes('drive.google.com');
}
