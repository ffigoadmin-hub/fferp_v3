/**
 * Standard Operating Procedures (SOP) Module Types
 * Defines all TypeScript interfaces for SOP management system
 */

export type SOPCategory = 'Safety' | 'Operations' | 'HR' | 'Finance' | 'General';

export interface SOP {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  category?: SOPCategory | null;
  content: string;
  attachment_url?: string | null;
  version: number;
  is_active: boolean;
  created_by: string;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SOPAssignment {
  id: string;
  sop_id: string;
  assigned_to_user_id?: string | null;
  assigned_to_department?: string | null;
  assigned_by: string;
  assigned_at: string;
  is_active: boolean;
  acknowledged_at?: string | null;
  acknowledged_by_user_id?: string | null;
  updated_at: string;
}

export interface SOPAssignmentWithRelations extends SOPAssignment {
  sop?: SOP;
  assigned_user?: {
    id: string;
    full_name: string;
    email: string;
    department: string;
  };
  assigned_by_user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface SOPWithAssignments extends SOP {
  assignments?: SOPAssignmentWithRelations[];
}

export interface CreateSOPPayload {
  name: string;
  code?: string | null;
  description?: string | null;
  category?: SOPCategory | null;
  content: string;
  attachment_url?: string | null;
  is_active?: boolean;
}

export interface UpdateSOPPayload extends Partial<CreateSOPPayload> {
  version?: number;
  updated_by?: string;
  updated_at?: string;
}

export interface CreateSOPAssignmentPayload {
  sop_id: string;
  assigned_to_user_id?: string | null;
  assigned_to_department?: string | null;
  assigned_by: string;
  is_active?: boolean;
}

export interface SOPStats {
  totalSOPs: number;
  activeSOPs: number;
  totalAssignments: number;
  acknowledgedAssignments: number;
  pendingAcknowledgments: number;
}

export interface SOPFilters {
  searchQuery?: string;
  category?: SOPCategory | 'all' | null;
  isActive?: boolean | null;
}

export interface SOPAssignmentFilters {
  sopId?: string | null;
  assignmentType?: 'user' | 'department' | null;
  acknowledged?: boolean | null;
  department?: string | null;
}

export interface SOPManagementState {
  sops: SOP[];
  assignments: SOPAssignmentWithRelations[];
  loading: boolean;
  error: string | null;
  filters: SOPFilters;
}
