import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface WorkOrder {
  id: string;
  wo_number: number;
  requester_id: string;
  project_id: string;
  project_phase_id?: string | null;
  project_milestone_id?: string | null;
  work_description: string;
  detailed_scope: string;
  estimated_amount: number;
  approved_budget: number;
  negotiated_amount?: number | null;
  advance_amount: number;
  final_amount: number;
  payment_stage: string;
  wo_document_url: string;
  status: string;
  
  // Budget Deviation
  has_budget_deviation?: boolean;
  deviation_amount?: number;
  deviation_percentage?: number;
  
  // Payment Tracking
  total_paid?: number;
  remaining_budget?: number;

  // Vendor Details (Sourced/Negotiated)
  vendor_name?: string | null;
  vendor_contact?: string | null;
  vendor_account_number?: string | null;
  vendor_ifsc_code?: string | null;
  vendor_upi?: string | null;
  vendor_gst?: string | null;
  vendor_sourced?: boolean;
  vendor_sourced_at?: string | null;
  vendor_sourced_by?: string | null;

  // Terms & Timeline
  terms_and_conditions?: string | null;
  start_date?: string | null;
  signed_document_url?: string | null;
  signed_uploaded_at?: string | null;
  signed_uploaded_by?: string | null;
  
  // 5-level approval
  smo_approved_by?: string | null;
  smo_approved_at?: string | null;
  gmo_approved_by?: string | null;
  gmo_approved_at?: string | null;
  gm_approved_by?: string | null;
  gm_approved_at?: string | null;
  admin_approved_by: string | null;
  admin_approved_at: string | null;
  admin_rejection_reason: string | null;
  ceo_approved_by: string | null;
  ceo_approved_at: string | null;
  ceo_hold_reason: string | null;
  smo_rejection_reason?: string | null;
  gmo_rejection_reason?: string | null;
  gm_rejection_reason?: string | null;
  
  // BOI fields
  boi_verified_by?: string | null;
  boi_verified_at?: string | null;
  boi_rejection_reason?: string | null;
  
  vendor_work_request_id?: string | null;
  linked_payment_id: string | null;
  created_at: string;
  updated_at: string;
  
  requester?: {
    name: string;
    department: string;
  };
  project?: {
    project_id: string;
    project_name: string;
  };
  phase?: {
    id: string;
    phase_name: string;
  };
  milestone?: {
    id: string;
    description: string;
  };
  boq_item_id?: string | null;
  boq_item?: {
    id: string;
    phase_id: string;
    phase: {
      id: string;
      phase_name: string;
    } | null;
  } | null;
  vendor_request?: {
    id: string;
    aligned_vendor_name: string;
    vendor_account_number: string;
    vendor_ifsc: string;
  } | null;
}

interface CreateWorkOrderData {
  projectId: string;
  phaseId?: string;
  milestoneId?: string;
  workDescription: string;
  detailedScope: string;
  approvedBudget: number;
  advanceAmount: number;
  woDocumentUrl?: string;
  termsAndConditions?: string;
  startDate?: string;
  bankAccount?: string;
  ifscCode?: string;
  vendorName?: string;
  vendorContact?: string;
  vendorUpi?: string;
  vendorGst?: string;
  vendorWorkRequestId?: string;
}

// Approval chain order
// Approval chain order refactored for the specific workflow:
// 1. Request (Status: pending_smo_pre_approval)
// 2. Sourcing (Status: pending_vendor_alignment)
// 3. Aligned (Status: vendor_aligned -> pending_gm_final_approval)
// 4. Final Approvals (GM -> Admin -> CEO)
const APPROVAL_CHAIN: { role: string; statusAfter: string; approvedByField: string; approvedAtField: string }[] = [
  // Stage 1: Pre-approval (Budget check before sourcing)
  { role: 'smo', statusAfter: 'pending_gmo_pre_approval', approvedByField: 'smo_approved_by', approvedAtField: 'smo_approved_at' },
  { role: 'gmo', statusAfter: 'pending_vendor_alignment', approvedByField: 'gmo_approved_by', approvedAtField: 'gmo_approved_at' },
  
  // Stage 2: Final Approval (After vendor sourcing aligns details)
  { role: 'gm', statusAfter: 'pending_admin', approvedByField: 'gm_approved_by', approvedAtField: 'gm_approved_at' },
  { role: 'admin', statusAfter: 'pending_ceo', approvedByField: 'admin_approved_by', approvedAtField: 'admin_approved_at' },
  { role: 'ceo', statusAfter: 'in_execution', approvedByField: 'ceo_approved_by', approvedAtField: 'ceo_approved_at' },
];

export function useWorkOrders(projectId?: string) {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const currentProjectIdRef = useRef<string | undefined>(undefined);
  const isMountedRef = useRef(false);

  const fetchWorkOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('work_orders')
        .select(`
          *,
          requester:profiles!work_orders_requester_id_fkey(name, department),
          project:projects!work_orders_project_id_fkey(project_id, project_name),
          phase:project_phases!work_orders_project_phase_id_fkey(id, phase_name),
          milestone:project_milestones!work_orders_project_milestone_id_fkey(id, description),
          boq_item:project_boq!work_orders_boq_item_id_fkey(
            id,
            phase_id,
            phase:project_phases!project_boq_phase_id_fkey(id, phase_name)
          ),
          vendor_request:vendor_work_requests!work_orders_vendor_work_request_id_fkey(
            id,
            aligned_vendor_name,
            vendor_account_number,
            vendor_ifsc
          )
        `)
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;

      setWorkOrders(data as unknown as WorkOrder[] || []);
    } catch (error) {
      console.error('Error fetching work orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!isMountedRef.current || projectId !== currentProjectIdRef.current) {
      isMountedRef.current = true;
      currentProjectIdRef.current = projectId;
      fetchWorkOrders();
    }
  }, [projectId, fetchWorkOrders]);

  useEffect(() => {
    const channelName = projectId
      ? `work-orders-${projectId}`
      : 'work-orders-all';

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'work_orders',
        ...(projectId ? { filter: `project_id=eq.${projectId}` } : {})
      }, () => {
        fetchWorkOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchWorkOrders]);

  const createWorkOrder = async (data: CreateWorkOrderData): Promise<{ success: boolean; data?: any }> => {
    if (!user) return { success: false };
    setIsSaving(true);
    try {
      const insertData: any = {
        requester_id: user.id,
        project_id: data.projectId,
        project_phase_id: data.phaseId,
        project_milestone_id: data.milestoneId,
        work_description: data.workDescription,
        detailed_scope: data.detailedScope,
        approved_budget: data.approvedBudget,
        estimated_amount: data.approvedBudget, // Initial estimate matches budget
        advance_amount: data.advanceAmount,
        wo_document_url: data.woDocumentUrl || '',
        payment_stage: 'advance',
        status: 'pending_smo_pre_approval', // Start at Pre-approval
      };
      if (data.termsAndConditions) insertData.terms_and_conditions = data.termsAndConditions;
      if (data.bankAccount) insertData.vendor_account_number = data.bankAccount;
      if (data.ifscCode) insertData.vendor_ifsc_code = data.ifscCode;
      if (data.startDate) insertData.start_date = data.startDate;
      if (data.vendorName) insertData.vendor_name = data.vendorName;
      if (data.vendorContact) insertData.vendor_contact = data.vendorContact;
      if (data.vendorUpi) insertData.vendor_upi = data.vendorUpi;
      if (data.vendorGst) insertData.vendor_gst = data.vendorGst;
      if (data.vendorWorkRequestId) insertData.vendor_work_request_id = data.vendorWorkRequestId;

      const { data: newWO, error } = await supabase
        .from('work_orders')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Step 2: Link back to the sourcing request if applicable
      if (data.vendorWorkRequestId && newWO) {
        await supabase
          .from('vendor_work_requests')
          .update({ 
            linked_wo_id: newWO.id,
            status: 'wo_created'
          })
          .eq('id', data.vendorWorkRequestId);
      }

      toast.success('Work Order created — pending SMO approval');
      await fetchWorkOrders();
      return { success: true, data: newWO };
    } catch (error: any) {
      console.error('Error creating work order:', error);
      toast.error(error.message || 'Failed to create work order');
      return { success: false };
    } finally {
      setIsSaving(false);
    }
  };

  // Align vendor (Stage 2: Sourcing Team work)
  const alignVendor = async (id: string, vendorData: {
    vendor_name: string;
    vendor_contact: string;
    negotiated_amount: number;
    vendor_account_number?: string;
    vendor_ifsc_code?: string;
    vendor_upi?: string;
    vendor_gst?: string;
  }) : Promise<{ success: boolean }> => {
    if (!user) return { success: false };
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({
          ...vendorData,
          status: 'vendor_aligned',
          vendor_sourced: true,
          vendor_sourced_at: new Date().toISOString(),
          vendor_sourced_by: user.id,
          total_amount: vendorData.negotiated_amount, // Update amount
          estimated_amount: vendorData.negotiated_amount // Update display amount
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Vendor aligned and negotiated amount recorded');
      await fetchWorkOrders();
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Failed to align vendor');
      return { success: false };
    } finally {
      setIsSaving(false);
    }
  };

  // Upload signed document
  const uploadSignedDocument = async (id: string, signedUrl: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({
          signed_document_url: signedUrl,
          signed_uploaded_at: new Date().toISOString(),
          signed_uploaded_by: user.id,
          status: 'signed',
        } as any)
        .eq('id', id);
      if (error) throw error;
      toast.success('Signed document uploaded');
      await fetchWorkOrders();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload signed document');
    }
  };

  // Send for approval (engineer triggers after signed doc is available)
  const sendForApproval = async (id: string) => {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: 'pending_gm_final_approval' } as any)
        .eq('id', id);
      if (error) throw error;
      toast.success('Work Order sent for approval — pending SMO');
      await fetchWorkOrders();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send for approval');
    }
  };

  // 5-level approval
  const approveWorkOrder = async (id: string, role: 'smo' | 'gmo' | 'gm' | 'admin' | 'ceo') => {
    if (!user) return;

    const step = APPROVAL_CHAIN.find(s => s.role === role);
    if (!step) return;

    try {
      const updates: any = {
        status: step.statusAfter,
        [step.approvedByField]: user.id,
        [step.approvedAtField]: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('work_orders')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      const roleLabels: Record<string, string> = { smo: 'SMO', gmo: 'GMO', gm: 'GM', admin: 'Admin', ceo: 'CEO' };
      toast.success(`Work Order approved by ${roleLabels[role]}`);
      await fetchWorkOrders();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve work order');
    }
  };

  const rejectWorkOrder = async (id: string, reason: string, role?: 'smo' | 'gmo' | 'gm' | 'admin' | 'ceo') => {
    try {
      const updates: any = {
        status: 'rejected',
      };

      if (role === 'smo') updates.smo_rejection_reason = reason;
      else if (role === 'gmo') updates.gmo_rejection_reason = reason;
      else if (role === 'gm') updates.gm_rejection_reason = reason;
      else if (role === 'admin') updates.admin_rejection_reason = reason;
      else if (role === 'ceo') updates.ceo_hold_reason = reason; // CEO usually uses hold, but if they reject, we can use hold_reason
      else updates.admin_rejection_reason = reason; // Default to admin for compatibility

      const { error } = await supabase
        .from('work_orders')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast.success('Work Order rejected');
      await fetchWorkOrders();
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject work order');
      return { success: false };
    }
  };

  const holdWorkOrder = async (id: string, reason: string) => {
    if (!user) return { success: false };

    try {
      const { error } = await supabase
        .from('work_orders')
        .update({
          status: 'ceo_hold',
          ceo_hold_reason: reason,
          ceo_approved_by: user.id
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Work Order put on hold');
      await fetchWorkOrders();
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Failed to hold work order');
      return { success: false };
    }
  };

  const resubmitWorkOrder = async (id: string, updatedData: any): Promise<{ success: boolean }> => {
    if (!user) return { success: false };

    setIsSaving(true);
    try {
      const updates: any = {
        status: 'pending_signature',
        smo_approved_by: null,
        smo_approved_at: null,
        gmo_approved_by: null,
        gmo_approved_at: null,
        gm_approved_by: null,
        gm_approved_at: null,
        admin_approved_by: null,
        admin_approved_at: null,
        admin_rejection_reason: null,
        ceo_approved_by: null,
        ceo_approved_at: null,
        ceo_hold_reason: null,
        smo_rejection_reason: null,
        gmo_rejection_reason: null,
        gm_rejection_reason: null,
      };

      if (updatedData.workDescription) updates.work_description = updatedData.workDescription;
      if (updatedData.detailedScope) updates.detailed_scope = updatedData.detailedScope;
      if (updatedData.approvedBudget) {
        updates.approved_budget = updatedData.approvedBudget;
        updates.estimated_amount = updatedData.approvedBudget;
      }
      if (updatedData.advanceAmount !== undefined) updates.advance_amount = updatedData.advanceAmount;
      if (updatedData.woDocumentUrl) updates.wo_document_url = updatedData.woDocumentUrl;
      if (updatedData.startDate) updates.start_date = updatedData.startDate;
      if (updatedData.termsAndConditions) updates.terms_and_conditions = updatedData.termsAndConditions;

      const { error } = await supabase
        .from('work_orders')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast.success('Work Order resubmitted');
      await fetchWorkOrders();
      return { success: true };
    } catch (error: any) {
      console.error('Error resubmitting work order:', error);
      toast.error(error.message || 'Failed to resubmit work order');
      return { success: false };
    } finally {
      setIsSaving(false);
    }
  };

  return {
    workOrders,
    isLoading,
    isSaving,
    createWorkOrder,
    uploadSignedDocument,
    sendForApproval,
    approveWorkOrder,
    rejectWorkOrder,
    holdWorkOrder,
    resubmitWorkOrder,
    alignVendor,
    refetch: fetchWorkOrders,
  };
}
