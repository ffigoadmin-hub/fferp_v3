import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NotificationService } from '@/services/NotificationService';
import { getNextPaymentStatus } from '@/lib/paymentWorkflow';

export type PaymentUrgency = 'emergency' | 'important' | 'normal';
// Status definitions following the multi-phase hierarchy
export type PaymentStatus =
  | 'pending'
  | 'smo_audit'
  | 'gmo_audit'
  | 'director_audit'
  | 'auditor_audit'      // New: Auditor verification stage
  | 'boi_audit'
  | 'gm_audit'
  | 'admin_audit'
  | 'ceo_audit'
  | 'ceo_hold'
  | 'gm_hold'
  | 'rejected'
  | 'paid'
  | 'bulk_prepared'       // New: Ready for batching
  | 'batch_ceo_approved'  // New: CEO confirmed batch
  | 'bank_uploaded'       // New: XLS uploaded to Kotak
  | 'reconciliation_exception' // New: Automated matching failed
  | 'hr_audit'               // New: HR verification stage for Salary Advance
  | 'draft'               // New: Manual or Auto-saved draft
  | 'smo_verified' | 'gm_approved' | 'admin_approved' | 'ceo_approved'; // Legacy

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Payment Requested',
  smo_audit: 'SMO Audit',
  gmo_audit: 'GMO Audit',
  auditor_audit: 'Auditor Audit',
  boi_audit: 'BOI Audit',
  director_audit: 'Director Audit',
  gm_audit: 'GM Audit',
  hr_audit: 'HR Audit',
  admin_audit: 'Admin Audit',
  ceo_audit: 'CEO Audit',
  ceo_approved: 'CEO Approved',
  paid: 'Payment Executed',
  rejected: 'Rejected',
  ceo_hold: 'CEO Hold',
  gm_hold: 'GM Hold',
  bulk_prepared: 'Bulk Prepared',
  batch_ceo_approved: 'Batch Approved',
  bank_uploaded: 'Bank Uploaded',
  reconciliation_exception: 'Reconciliation Alert',
  draft: 'Draft',
};

export interface PaymentTimelineEntry {
  status: PaymentStatus;
  user_id: string;
  user_name: string;
  role: string;
  notes?: string;
  timestamp: string;
}

export interface PaymentRequestData {
  id: string;
  requester_id: string;
  is_project_work: boolean;
  purpose: string;
  detailed_description?: string | null;
  wo_number: string | null;
  vendor_name: string;
  vendor_bank_details: string;
  amount: number;
  bill_url: string;
  work_proof_url: string;
  cutoff_date: string;
  cutoff_time: string;
  urgency: string;
  status: PaymentStatus;

  // Approval tracking
  smo_approved_by?: string | null;
  smo_approved_at?: string | null;
  gmo_approved_by?: string | null;
  gmo_approved_at?: string | null;
  director_approved_by?: string | null;
  director_approved_at?: string | null;
  boi_approved_by?: string | null;
  boi_approved_at?: string | null;
  gm_approved_by?: string | null;
  gm_approved_at?: string | null;
  hr_approved_by?: string | null;
  hr_approved_at?: string | null;
  admin_approved_at: string | null;
  auditor_approved_by?: string | null;
  auditor_approved_at?: string | null;
  ceo_approved_by: string | null;
  ceo_approved_at: string | null;

  audit_timeline?: PaymentTimelineEntry[];
  admin_rejection_reason: string | null;
  ceo_hold_reason: string | null;
  accounts_executed_by: string | null;
  utr_number: string | null;
  payment_proof_url: string | null;
  paid_at: string | null;
  created_at: string;

  // Enterprise Module Fields
  department?: 'engineering' | 'agri' | 'farmers_factory' | 'others' | string;
  is_petty_cash?: boolean;
  bulk_batch_id?: string | null; // FK to bulk_batches
  reconciliation_status?: {
    status: 'matched' | 'partial' | 'unmatched';
    confidence: number;
    requiresManualReview?: boolean;
  };
  project_id?: string | null;
  phase_id?: string | null;
  work_order_id?: string | null;
  requester?: {
    name: string;
    department: string;
  };
  project?: {
    id?: string;
    project_id?: string;
    project_name?: string;
    vertical?: string | null;
    client_name?: string | null;
    location_city?: string | null;
    location_state?: string | null;
    total_project_value?: number | null;
    status?: string | null;
    lifecycle_stage?: string | null;
    current_phase_id?: string | null;
    current_phase?: {
      id: string;
      phase_name: string;
      phase_order: number;
      status?: string | null;
    } | null;
    default_phase?: {
      id: string;
      phase_name: string;
      phase_order: number;
      status?: string | null;
    } | null;
  } | null;
  phase?: {
    id: string;
    phase_name: string;
    phase_order: number;
    status?: string | null;
  } | null;
  work_order?: {
    id: string;
    wo_number: number;
    work_description: string;
    estimated_amount: number;
    project_id: string;
    signed_document_url?: string | null;
    boq_item?: {
      id: string;
      phase_id?: string | null;
      phase?: {
        id: string;
        phase_name: string;
        phase_order: number;
        status?: string | null;
      } | null;
    } | null;
  } | null;
  // Added missing fields
  material_request_id?: string | null;
  payment_number?: number;
  vendor_phone?: string | null;
  vendor_contact_person?: string | null;
  vendor_upi?: string | null;
  payment_type?: string | null;
  vendor_account_number?: string | null;
  vendor_ifsc_code?: string | null;
  beneficiary_name?: string | null;
  bank_name?: string | null;
  bulk_prepared_at?: string | null;
  tags?: string[];
  // Reversal tracking
  accounts_reversal_reason?: string | null;
  accounts_reversed_by?: string | null;
  accounts_reversed_at?: string | null;

  // Conversion tracking
  converted_from_batch?: boolean;
  original_batch_id?: string | null;
  conversion_date?: string | null;
  converted_by?: string | null;
  payment_proof_screenshot?: string | null;
  // UTR verification tracking
  utr_verified_at?: string | null;
  utr_verified_by?: string | null;
  utr_match_confidence?: number | null;
  utr_requires_manual_review?: boolean | null;
  is_porter_payment?: boolean | null;
  porter_start_km?: number | null;
  porter_end_km?: number | null;
  porter_total_km?: number | null;
  // Transport Fields
  is_transport_payment?: boolean | null;
  transport_trips?: any[] | null;
  // Split Payment Fields
  is_split_payment?: boolean;
  split_batch_id?: string | null;
  total_splits?: number;
  splits?: SplitPaymentData[];
  // Duplicate Detection Fields
  override_reason?: string | null;
  is_overridden?: boolean;
}

export interface SplitPaymentData {
  id: string;
  parent_payment_id: string;
  batch_id: string;
  split_number: number;
  split_title: string;
  payee_name: string;
  beneficiary_name?: string | null;
  amount: number;
  payment_method: string;
  account_number?: string | null;
  ifsc_code?: string | null;
  upi_id?: string | null;
  utr_number?: string | null;
  payment_proof_url?: string | null;
  paid_at?: string | null;
  status: string;
  created_at: string;
  bill_url?: string | null;
  work_proof_url?: string | null;
}

export function usePaymentRequests(filterStatus?: string[] | { skipFetch?: boolean }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PaymentRequestData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Normalize arguments
  const actualFilterStatuses = Array.isArray(filterStatus) ? filterStatus : undefined;
  const skipFetch = typeof filterStatus === 'object' && !Array.isArray(filterStatus) ? filterStatus.skipFetch : false;

  const fetchRequests = async () => {
    if (!user || skipFetch) {
      setIsLoading(false);
      return;
    }

    try {
      // Paginated fetch to bypass Supabase's 1000-row server limit
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = (supabase
          .from('payment_requests') as any)
          .select('*');

        // Server-side filtering for performance
        if (actualFilterStatuses && actualFilterStatuses.length > 0) {
          query = query.in('status', actualFilterStatuses);
        }

        // Exclude drafts by default (they are personal to the requester)
        query = query.neq('status', 'draft');

        const { data, error } = await query
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        const batch = data || [];
        allData = [...allData, ...batch];

        if (batch.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          from += PAGE_SIZE;
        }
      }

      const payments = allData;

      // Manual profile resolution to avoid join/schema-cache issues
      const requesterIds = [...new Set(payments.map((p: any) => p.requester_id).filter(Boolean))];
      let profileMap: Record<string, { name: string; department: string }> = {};

      if (requesterIds.length > 0) {
        const { data: profiles } = await (supabase
          .from('profiles') as any)
          .select('id, name, department')
          .in('id', requesterIds);

        if (profiles) {
          profileMap = Object.fromEntries(
            profiles.map((p: any) => [p.id, { name: p.name, department: p.department }])
          );
        }
      }

      const projectIds = [...new Set(payments.map((p: any) => p.project_id).filter(Boolean))];
      const phaseIds = [...new Set(payments.map((p: any) => p.phase_id).filter(Boolean))];
      const workOrderIds = [...new Set(payments.map((p: any) => p.work_order_id).filter(Boolean))];

      const [projectsRes, phasesRes, workOrdersRes, projectPhasesRes] = await Promise.all([
        projectIds.length > 0
          ? (supabase.from('projects') as any)
            .select('id, project_id, project_name, vertical, client_name, location_city, location_state, total_project_value, current_phase_id, status, lifecycle_stage')
            .in('id', projectIds)
          : Promise.resolve({ data: [], error: null }),
        phaseIds.length > 0
          ? (supabase.from('project_phases') as any)
            .select('id, project_id, phase_name, phase_order, status')
            .in('id', phaseIds)
          : Promise.resolve({ data: [], error: null }),
        workOrderIds.length > 0
          ? (supabase.from('work_orders') as any)
            .select(`
              id,
              wo_number,
              work_description,
              estimated_amount,
              project_id,
              signed_document_url,
              boq_item:project_boq!work_orders_boq_item_id_fkey(
                id,
                phase_id,
                phase:project_phases!project_boq_phase_id_fkey(id, phase_name, phase_order)
              )
            `)
            .in('id', workOrderIds)
          : Promise.resolve({ data: [], error: null }),
        projectIds.length > 0
          ? (supabase.from('project_phases') as any)
            .select('id, project_id, phase_name, phase_order, status')
            .in('project_id', projectIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (projectsRes.error) console.error('Error fetching projects:', projectsRes.error);
      if (phasesRes.error) console.error('Error fetching phases:', phasesRes.error);
      if (workOrdersRes.error) console.error('Error fetching work orders:', workOrdersRes.error);
      if (projectPhasesRes.error) console.error('Error fetching project phases:', projectPhasesRes.error);

      const projectMap = Object.fromEntries((projectsRes.data || []).map((p: any) => [p.id, p]));
      const phaseMap = Object.fromEntries((phasesRes.data || []).map((p: any) => [p.id, p]));
      const currentPhaseIds = [...new Set((projectsRes.data || []).map((p: any) => p.current_phase_id).filter(Boolean))];
      const missingCurrentPhaseIds = currentPhaseIds.filter((id: string) => !phaseMap[id]);
      if (missingCurrentPhaseIds.length > 0) {
        const { data: extraPhases, error: extraErr } = await (supabase
          .from('project_phases') as any)
          .select('id, project_id, phase_name, phase_order, status')
          .in('id', missingCurrentPhaseIds);
        if (extraErr) console.error('Error fetching current phases:', extraErr);
        if (extraPhases) {
          extraPhases.forEach((p: any) => { phaseMap[p.id] = p; });
        }
      }
      const phasesByProject: Record<string, any[]> = {};
      (projectPhasesRes.data || []).forEach((p: any) => {
        if (!phasesByProject[p.project_id]) phasesByProject[p.project_id] = [];
        phasesByProject[p.project_id].push(p);
      });
      Object.values(phasesByProject).forEach((list: any[]) => {
        list.sort((a, b) => (a.phase_order || 0) - (b.phase_order || 0));
      });
      const workOrderMap = Object.fromEntries((workOrdersRes.data || []).map((w: any) => [w.id, w]));

      const enriched = payments.map((p: any) => ({
        ...p,
        requester: profileMap[p.requester_id] || null,
        project: p.project_id ? {
          ...(projectMap[p.project_id] || null),
          current_phase: projectMap[p.project_id]?.current_phase_id
            ? phaseMap[projectMap[p.project_id].current_phase_id] || null
            : null,
          default_phase: (() => {
            const list = phasesByProject[p.project_id] || [];
            if (list.length === 0) return null;
            const inProgress = list.find((ph: any) => ph.status === 'in_progress');
            if (inProgress) return inProgress;
            const pending = list.find((ph: any) => ph.status === 'pending');
            if (pending) return pending;
            return list[list.length - 1];
          })(),
        } : null,
        phase: p.phase_id ? phaseMap[p.phase_id] || null : null,
        work_order: p.work_order_id ? workOrderMap[p.work_order_id] || null : null,
      }));

      // Fetch associated splits for split payments
      const splitPaymentIds = enriched.filter(p => p.is_split_payment).map(p => p.id);
      if (splitPaymentIds.length > 0) {
        const { data: splitsData, error: splitsError } = await supabase
          .from('split_payments' as any)
          .select('*')
          .in('parent_payment_id', splitPaymentIds)
          .order('split_number', { ascending: true });

        if (!splitsError && splitsData) {
          enriched.forEach(p => {
            if (p.is_split_payment) {
              p.splits = splitsData.filter((s: any) => s.parent_payment_id === p.id);
            }
          });
        }
      }

      setRequests(enriched as PaymentRequestData[]);
    } catch (error) {
      console.error('Error fetching payment requests:', error);
      if (!isMissingTable(error)) toast.error('Failed to load payments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // Removed internal real-time subscription to prevent double-fetching.
    // Real-time updates should be handled by the parent component using useRealtimePayments.
  }, [user, JSON.stringify(actualFilterStatuses), skipFetch]);

  const createRequest = async (requestData: {
    isProjectWork: boolean;
    purpose: string;
    woNumber?: string;
    vendorName: string;
    vendorBankDetails: string;
    amount: number;
    billUrl: string;
    workProofUrl: string;
    cutoffDate: string;
    cutoffTime: string;
    urgency: PaymentUrgency;
    projectId?: string;
    paymentType?: 'upi' | 'bank_account';
    vendorUpi?: string;
    vendorAccountNumber?: string;
    vendorIfscCode?: string;
    beneficiaryName?: string;
    workOrderId?: string;
    phaseId?: string;
    tags?: string[];
    detailedDescription?: string;
    isPorterPayment?: boolean;
    porterStartKm?: number;
    porterEndKm?: number;
    porterTotalKm?: number;
    // Split Payment Fields
    isSplitPayment?: boolean;
    splits?: Array<{
      split_title: string;
      payee_name: string;
      beneficiary_name?: string;
      amount: number;
      payment_method: string;
      account_number?: string;
      ifsc_code?: string;
      upi_id?: string;
      bill_url?: string;
      work_proof_url?: string;
    }>;
    id?: string; // Optional ID for existing drafts
    overrideReason?: string;
    isOverridden?: boolean;
    originalDuplicateScore?: number;
    isTransportPayment?: boolean;
    transportTrips?: any[];
  }) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);

    try {
      // Determine Department and Initial Status Logic
      const userDept = user.department?.toLowerCase() || 'others';

      // Normalize department for DB
      let requestDepartment = 'others';
      const userDeptLower = userDept.toLowerCase();
      if (userDeptLower.includes('jv') || userDeptLower.includes('joint venture')) requestDepartment = 'jv_engineering';
      else if (userDeptLower.includes('engineering') || userDeptLower === 'eng') requestDepartment = 'engineering';
      else if (userDeptLower.includes('agri')) requestDepartment = 'agri';
      else if (userDeptLower.includes('purchase')) requestDepartment = 'purchase';
      else if (userDeptLower.includes('logistics')) requestDepartment = 'logistics';
      else if (userDeptLower.includes('r&d') || userDeptLower.includes('r & d') || userDeptLower === 'rnd') requestDepartment = 'r_and_d';
      else requestDepartment = 'others';

      const initialStatus = getNextPaymentStatus({
        department: requestDepartment,
        tags: requestData.tags || []
      }, user.role);

      console.log('Payment Routing:', {
        userDept,
        requestDepartment,
        userRole: user.role,
        initialStatus
      });

      const splitBatchId = requestData.isSplitPayment ? crypto.randomUUID() : null;

      const payload: any = {
        requester_id: user.id,
        department: requestDepartment,
        is_project_work: requestData.isProjectWork,
        purpose: requestData.purpose,
        detailed_description: requestData.detailedDescription || null,
        wo_number: requestData.woNumber || null,
        vendor_name: requestData.isSplitPayment ? 'SPLIT PAYMENT BATCH' : requestData.vendorName,
        vendor_bank_details: requestData.isSplitPayment ? 'See Split Details' : requestData.vendorBankDetails,
        amount: requestData.amount,
        bill_url: requestData.billUrl,
        work_proof_url: requestData.workProofUrl,
        cutoff_date: requestData.cutoffDate,
        cutoff_time: requestData.cutoffTime,
        urgency: requestData.urgency,
        status: initialStatus, // EXPLICITLY SET INITIAL STATUS
        project_id: requestData.projectId || null,
        phase_id: requestData.phaseId || null,
        payment_type: requestData.isSplitPayment ? 'split' : (requestData.paymentType || 'bank_account'),
        vendor_upi: requestData.vendorUpi || null,
        vendor_account_number: requestData.vendorAccountNumber || null,
        vendor_ifsc_code: requestData.vendorIfscCode?.toUpperCase().trim() || null,
        beneficiary_name: requestData.beneficiaryName || requestData.vendorName || null,
        work_order_id: requestData.workOrderId || null,
        tags: requestData.tags || [],
        // Conditionally include split columns only if they exist in requestData
        ...(requestData.isSplitPayment ? {
          is_split_payment: true,
          split_batch_id: splitBatchId,
          total_splits: requestData.splits?.length || 0,
        } : {}),
        audit_timeline: [{
          status: initialStatus,
          user_id: user.id,
          user_name: user.name,
          role: 'requester',
          timestamp: new Date().toISOString(),
          notes: `Request ${requestData.id ? 'submitted from draft' : 'raised'} by ${user.name} (${requestDepartment})${requestData.isSplitPayment ? ` as a batch of ${requestData.splits?.length} splits` : ''}`
        }],
        is_porter_payment: requestData.isPorterPayment || false,
        porter_start_km: requestData.porterStartKm || null,
        porter_end_km: requestData.porterEndKm || null,
        porter_total_km: requestData.porterTotalKm || null,
        override_reason: requestData.overrideReason || null,
        is_overridden: requestData.isOverridden || false,
        original_duplicate_score: requestData.originalDuplicateScore || null,
        is_transport_payment: requestData.isTransportPayment || false,
        transport_trips: requestData.transportTrips || [],
        updated_at: new Date().toISOString() // Ensure updated_at is refreshed
      };

      console.log('Submission Payload:', payload);

      let query;
      if (requestData.id) {
        query = (supabase.from('payment_requests') as any).update(payload).eq('id', requestData.id);
      } else {
        query = (supabase.from('payment_requests') as any).insert(payload);
      }

      const { data, error } = await query.select().single();

      if (error) {
        console.error('Supabase Submission Error:', error);
        throw error;
      }

      // Handle split payments insertion
      if (requestData.isSplitPayment && requestData.splits && requestData.splits.length > 0) {
        // If updating an existing draft, clear old splits first
        if (requestData.id) {
          await (supabase as any)
            .from('split_payments')
            .delete()
            .eq('parent_payment_id', requestData.id);
        }

        const splitsToInsert = requestData.splits.map((s, index) => ({
          parent_payment_id: data.id,
          batch_id: splitBatchId,
          split_number: index + 1,
          split_title: s.split_title,
          payee_name: s.payee_name,
          beneficiary_name: s.beneficiary_name || s.payee_name,
          amount: s.amount,
          payment_method: s.payment_method,
          account_number: s.account_number,
          ifsc_code: s.ifsc_code,
          upi_id: s.upi_id,
          status: 'pending',
          bill_url: s.bill_url || null,
          work_proof_url: s.work_proof_url || null
        }));

        const { error: splitsError } = await (supabase as any)
          .from('split_payments')
          .insert(splitsToInsert);

        if (splitsError) {
          console.error('Error inserting splits:', splitsError);
          toast.error('Warning: Parent request created but splits failed. Please contact support.');
        }
      }

      // --- Send Initial Notification ---
      // Determine target role for notification based on initial status
      let targetRole = '';
      if (initialStatus === 'smo_audit') targetRole = 'smo';
      else if (initialStatus === 'gmo_audit') targetRole = 'gmo';
      else if (initialStatus === 'auditor_audit') targetRole = 'auditor';
      else if (initialStatus === 'boi_audit') targetRole = 'boi';
      else if (initialStatus === 'director_audit') targetRole = 'director';
      else if (initialStatus === 'gm_audit') targetRole = 'gm';
      else if (initialStatus === 'hr_audit') targetRole = 'hr';
      else if (initialStatus === 'admin_audit') targetRole = 'admin';
      else if (initialStatus === 'ceo_audit') targetRole = 'ceo';

      if (targetRole) {
        await NotificationService.notifyRole(
          targetRole,
          'New Payment Request',
          `A new ${requestDepartment} payment request (#${data.payment_number}) is awaiting your audit.`,
          data.id
        );
      }


      setRequests(prev => {
        const existingIndex = prev.findIndex(r => r.id === data.id);
        if (existingIndex >= 0) {
          const newRequests = [...prev];
          newRequests[existingIndex] = data as PaymentRequestData;
          return newRequests;
        }
        return [data as PaymentRequestData, ...prev];
      });
      toast.success('Payment request submitted for approval');

      return { success: true, data };
    } catch (error) {
      console.error('Error creating payment request:', error);
      const errorMessage = (error as any)?.message || 'Failed to submit payment request';
      const errorHint = (error as any)?.hint ? ` Hint: ${(error as any).hint}` : '';
      toast.error(`${errorMessage}${errorHint}`);
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (
    id: string,
    newStatus: PaymentStatus,
    additionalData?: {
      rejectionReason?: string;
      holdReason?: string;
      utrNumber?: string;
      paymentProofUrl?: string;
      // New Enterprise Fields
      isPettyCash?: boolean;
      department?: string;
      batchId?: string | null;
      tags?: string[];
    },
    options?: { skipRefetch?: boolean }
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);

    try {
      const { data: request } = await (supabase
        .from('payment_requests')
        .select('*')
        .eq('id', id)
        .single() as any);

      if (!request) throw new Error('Request not found');

      const updateData: Record<string, unknown> = { status: newStatus };
      const now = new Date().toISOString();

      /**
       * Enterprise Workflow Status Transition Recording
       * Records approval timestamps for each role in the chain
       */

      // SMO → GMO (Engineering)
      if (newStatus === 'gmo_audit') {
        updateData.smo_approved_by = user.id;
        updateData.smo_approved_at = now;
      }

      // Auditor → Admin (Farmers Factory)
      else if (newStatus === 'admin_audit' && request.status === 'auditor_audit') {
        updateData.auditor_approved_by = user.id;
        updateData.auditor_approved_at = now;
      }

      // BOI Audit - Multiple entry points based on flow
      else if (newStatus === 'boi_audit') {
        // Engineering: GMO → BOI
        if (request.status === 'gmo_audit') {
          updateData.gmo_approved_by = user.id;
          updateData.gmo_approved_at = now;
        }
        // Agri: SMO → BOI
        else if (request.status === 'smo_audit') {
          updateData.smo_approved_by = user.id;
          updateData.smo_approved_at = now;
        }
      }

      // Director Audit (Agri): BOI → Director
      else if (newStatus === 'director_audit') {
        updateData.boi_approved_by = user.id;
        updateData.boi_approved_at = now;
      }


      // GM Audit (Engineering): BOI → GM
      else if (newStatus === 'gm_audit') {
        // Engineering: BOI → GM - Record BOI approval timestamp
        if (request.status === 'boi_audit') {
          updateData.boi_approved_by = user.id;
          updateData.boi_approved_at = now;
        }
      }


      // Admin Audit - Multiple entry points
      else if (newStatus === 'admin_audit') {
        // Engineering: GM → Admin
        if (request.status === 'gm_audit' || request.status === 'gm_hold') {
          updateData.gm_approved_by = user.id;
          updateData.gm_approved_at = now;
        }
        // Agri & Agri Mart: Director → Admin
        else if (request.status === 'director_audit') {
          updateData.director_approved_by = user.id;
          updateData.director_approved_at = now;
        }
        // Others: BOI → Admin
        else if (request.status === 'boi_audit') {
          updateData.boi_approved_by = user.id;
          updateData.boi_approved_at = now;
        }
        // Salary Advance: HR → Admin
        else if (request.status === 'hr_audit') {
          updateData.hr_approved_by = user.id;
          updateData.hr_approved_at = now;
        }
      }
      else if (newStatus === 'ceo_audit') {
        // Standard Admin Approval -> CEO Queue
        updateData.admin_approved_by = user.id;
        updateData.admin_approved_at = now;

        // jumping from auditor_audit (Admin Override)
        if (request.status === 'auditor_audit') {
          updateData.auditor_approved_by = user.id;
          updateData.auditor_approved_at = now;
        }
      }
      else if (newStatus === 'ceo_approved') {
        // Handles multiple scenarios: 
        // 1. CEO approving normally 
        // 2. Admin marking as Petty Cash (Bypassing CEO Queue)
        // 3. Admin reverting from CEO audit (less common)

        // Petty Cash Bypass Logic:
        // If the current user is Admin, and they are moving it to 'ceo_approved', it MUST be petty cash or system override.
        if (newStatus === 'ceo_approved') {
          if (user.role === 'admin' && request.status === 'admin_audit') {
            // This is the Admin Gatekeeper Bypass
            updateData.admin_approved_by = user.id;
            updateData.admin_approved_at = now;
            // System auto-approves on behalf of CEO for petty cash
            updateData.ceo_approved_by = user.id; // Or a specific system UUID if preferred, keeping admin ID for traceability
            updateData.ceo_approved_at = now;
            // We assume 'is_petty_cash' was set via a separate update call or toggled in UI before this.
          } else {
            // Normal CEO Approval
            updateData.ceo_approved_by = user.id;
            updateData.ceo_approved_at = now;
          }
        } else {
          // Admin Revert logic or other flows
          updateData.admin_approved_by = user.id;
          updateData.admin_approved_at = now;
        }
      }
      else if (newStatus === 'paid') {
        updateData.accounts_executed_by = user.id;
        updateData.paid_at = now;
        updateData.utr_number = additionalData?.utrNumber;
        updateData.payment_proof_url = additionalData?.paymentProofUrl;
      }

      // Timeline update
      const timelineEntry = {
        status: newStatus,
        user_id: user.id,
        user_name: user.name,
        role: user.role,
        timestamp: now,
        notes: additionalData?.rejectionReason || additionalData?.holdReason || 'Status updated'
      };

      const currentTimeline = (request.audit_timeline || []) as any[];
      updateData.audit_timeline = [...currentTimeline, timelineEntry];

      if (newStatus === 'rejected') {
        updateData.admin_rejection_reason = additionalData?.rejectionReason;
      } else if (newStatus === 'ceo_hold' || newStatus === 'gm_hold') {
        updateData.ceo_hold_reason = additionalData?.holdReason;
      }

      // Enterprise Field Updates
      if (additionalData?.isPettyCash !== undefined) updateData.is_petty_cash = additionalData.isPettyCash;
      if (additionalData?.department) updateData.department = additionalData.department;
      if (additionalData?.batchId !== undefined) updateData.batch_id = additionalData.batchId;
      if (additionalData?.tags !== undefined) updateData.tags = additionalData.tags;

      const { error } = await (supabase
        .from('payment_requests') as any)
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Sync status to split payments if it's a split payment
      if (request.is_split_payment) {
        await (supabase as any)
          .from('split_payments')
          .update({ status: newStatus })
          .eq('parent_payment_id', id);
      }

      // --- Trigger Notifications ---
      const paymentNo = request.payment_number || '';

      if (newStatus === 'rejected') {
        await NotificationService.notifyUser(
          request.requester_id,
          'Payment Request Rejected',
          `Your payment request (#${paymentNo}) has been rejected. Reason: ${additionalData?.rejectionReason}`,
          'employee',
          id
        );
      } else if (newStatus === 'ceo_hold') {
        await NotificationService.notifyUser(
          request.requester_id,
          'Payment on Hold',
          `Your payment request (#${paymentNo}) has been put on hold by CEO.`,
          'employee',
          id
        );
        // Also notify Admin and Accounts
        await NotificationService.notifyRole('admin', 'Payment on Hold', `Payment #${paymentNo} put on hold by CEO.`, id);
        await NotificationService.notifyRole('accounts', 'Payment on Hold', `Payment #${paymentNo} put on hold by CEO.`, id);
      } else if (newStatus === 'gm_hold') {
        await NotificationService.notifyUser(
          request.requester_id,
          'Payment on Hold',
          `Your payment request (#${paymentNo}) has been put on hold by GM.`,
          'employee',
          id
        );
        // Also notify Admin
        await NotificationService.notifyRole('admin', 'Payment on Hold', `Payment #${paymentNo} put on hold by GM.`, id);
      } else {
        // Audit transition notifications
        let nextRole = '';
        if (newStatus === 'smo_audit') nextRole = 'smo';
        else if (newStatus === 'gmo_audit') nextRole = 'gmo';
        else if (newStatus === 'auditor_audit') nextRole = 'auditor';
        else if (newStatus === 'boi_audit') nextRole = 'boi';
        else if (newStatus === 'director_audit') nextRole = 'director';
        else if (newStatus === 'gm_audit') nextRole = 'gm';
        else if (newStatus === 'hr_audit') nextRole = 'hr';
        else if (newStatus === 'admin_audit') nextRole = 'admin';
        else if (newStatus === 'ceo_audit') nextRole = 'ceo';
        else if (newStatus === 'ceo_approved' || newStatus === 'paid') nextRole = 'accounts';

        if (nextRole) {
          await NotificationService.notifyRole(
            nextRole,
            'Payment Action Required',
            `Payment #${paymentNo} is now at ${newStatus.replace('_', ' ')} stage.`,
            id
          );
        }

        // Notify requester on final approval
        if (newStatus === 'ceo_approved') {
          await NotificationService.notifyUser(
            request.requester_id,
            'Payment Approved',
            `Your payment request (#${paymentNo}) has been approved and moved to accounts for payment.`,
            'employee',
            id
          );
        } else if (newStatus === 'paid') {
          await NotificationService.notifyUser(
            request.requester_id,
            'Payment Executed',
            `Your payment request (#${paymentNo}) has been processed. UTR: ${additionalData?.utrNumber || 'N/A'}`,
            'employee',
            id
          );
        }
      }

      // Optimistically remove from list immediately if status changes
      // setRequests(prev => prev.filter(r => r.id !== id));
      // Re-fetch to ensure sync with DB tags etc.
      await fetchRequests();

      return { success: true };
    } catch (error) {
      console.error('Error updating payment request:', error);
      toast.error('Failed to update payment request');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Accounts can reverse a payment back to Admin for review/correction
   * Used when there's a mismatch in payment details or CEO held the payment
   * Admin can then edit and resubmit for CEO approval
   */
  const reversePaymentToAdmin = async (
    id: string,
    reason: string,
    options?: { skipRefetch?: boolean }
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);

    try {
      const { data: request } = await (supabase
        .from('payment_requests')
        .select('*')
        .eq('id', id)
        .single() as any);

      if (!request) throw new Error('Request not found');

      const now = new Date().toISOString();

      // Add timeline entry for the reversal
      const timelineEntry = {
        status: 'admin_audit',
        user_id: user.id,
        user_name: user.name,
        role: user.role,
        timestamp: now,
        notes: `Reversed to Admin by Accounts: ${reason}`
      };

      const currentTimeline = (request.audit_timeline || []) as any[];

      const { error } = await (supabase
        .from('payment_requests') as any)
        .update({
          status: 'admin_audit',
          ceo_approved_by: null,
          ceo_approved_at: null,
          ceo_hold_reason: null,
          accounts_reversal_reason: reason,
          accounts_reversed_by: user.id,
          accounts_reversed_at: now,
          audit_timeline: [...currentTimeline, timelineEntry]
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Payment reversed to Admin for review');
      if (!options?.skipRefetch) {
        await fetchRequests();
      }
      return { success: true };
    } catch (error) {
      console.error('Error reversing payment:', error);
      toast.error('Failed to reverse payment');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Accounts can reject a payment completely
   * Used when payment should not be processed at all
   * Sets status to 'rejected' and records rejection reason
   */
  const rejectPayment = async (
    id: string,
    reason: string,
    options?: { skipRefetch?: boolean }
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);

    try {
      const { data: request } = await (supabase
        .from('payment_requests')
        .select('*')
        .eq('id', id)
        .single() as any);

      if (!request) throw new Error('Request not found');

      const now = new Date().toISOString();

      // Add timeline entry for the rejection
      const timelineEntry = {
        status: 'rejected',
        user_id: user.id,
        user_name: user.name,
        role: user.role,
        timestamp: now,
        notes: `Rejected by Accounts: ${reason}`
      };

      const currentTimeline = (request.audit_timeline || []) as any[];

      const { error } = await (supabase
        .from('payment_requests') as any)
        .update({
          status: 'rejected',
          admin_rejection_reason: reason,
          accounts_rejected_by: user.id,
          accounts_rejected_at: now,
          audit_timeline: [...currentTimeline, timelineEntry]
        })
        .eq('id', id);

      if (error) throw error;

      // Sync status to split payments if it's a split payment
      if (request.is_split_payment) {
        await (supabase as any)
          .from('split_payments')
          .update({ status: 'rejected' })
          .eq('parent_payment_id', id);
      }

      // Notify the requester about the rejection
      const paymentNo = request.payment_number || '';
      await NotificationService.notifyUser(
        request.requester_id,
        'Payment Request Rejected',
        `Your payment request (#${paymentNo}) has been rejected by Accounts. Reason: ${reason}`,
        'employee',
        id
      );

      toast.success('Payment rejected successfully');
      if (!options?.skipRefetch) {
        await fetchRequests();
      }
      return { success: true };
    } catch (error) {
      console.error('Error rejecting payment:', error);
      toast.error('Failed to reject payment');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const resubmitPaymentRequest = async (
    id: string,
    data: {
      purpose?: string;
      vendorName?: string;
      vendorBankDetails?: string;
      amount?: number;
      billUrl?: string;
      workProofUrl?: string;
      cutoffDate?: string;
      cutoffTime?: string;
      urgency?: PaymentUrgency;
      isProjectWork?: boolean;
      projectId?: string;
      phaseId?: string;
      workOrderId?: string;
      woNumber?: string;
      paymentType?: string;
      vendorUpi?: string;
      vendorAccountNumber?: string;
      vendorIfscCode?: string;
      beneficiaryName?: string;
      detailedDescription?: string;
      tags?: string[];
      isTransportPayment?: boolean;
      transportTrips?: any[];
    }
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);

    try {
      // Helper to determine initial status based on department and role
      const request = (requests as any[]).find(r => r.id === id);
      const requestDept = request?.department || 'others';

      const initialStatus = getNextPaymentStatus({
        department: requestDept,
        tags: data.tags || request?.tags || []
      }, user.role);



      const updateData: Record<string, unknown> = {
        status: initialStatus,
        smo_approved_by: null,
        smo_approved_at: null,
        gmo_approved_by: null,
        gmo_approved_at: null,
        boi_approved_by: null,
        boi_approved_at: null,
        gm_approved_by: null,
        gm_approved_at: null,
        gm_hold_reason: null,
        director_approved_by: null,
        director_approved_at: null,
        auditor_approved_by: null,
        auditor_approved_at: null,
        admin_approved_by: null,
        admin_approved_at: null,
        admin_rejection_reason: null,
        ceo_approved_by: null,
        ceo_approved_at: null,
        ceo_hold_reason: null,
        accounts_reversal_reason: null,
        paid_at: null,
        utr_number: null,
        utr_verified_at: null,
      };

      // Add timeline entry for resubmission
      const timelineEntry = {
        status: initialStatus,
        user_id: user.id,
        user_name: user.name,
        role: user.role,
        timestamp: new Date().toISOString(),
        notes: `Request resubmitted by ${user.name}`
      };

      const currentTimeline = (request?.audit_timeline || []) as any[];
      updateData.audit_timeline = [...currentTimeline, timelineEntry];

      if (data.purpose) updateData.purpose = data.purpose;
      if (data.vendorName) updateData.vendor_name = data.vendorName;
      if (data.vendorBankDetails) updateData.vendor_bank_details = data.vendorBankDetails;
      if (data.amount) updateData.amount = data.amount;
      if (data.billUrl) updateData.bill_url = data.billUrl;
      if (data.workProofUrl) updateData.work_proof_url = data.workProofUrl;
      if (data.cutoffDate) updateData.cutoff_date = data.cutoffDate;
      if (data.cutoffTime) updateData.cutoff_time = data.cutoffTime;
      if (data.urgency) updateData.urgency = data.urgency;
      if (data.isProjectWork !== undefined) updateData.is_project_work = data.isProjectWork;
      if (data.projectId) updateData.project_id = data.projectId;
      if (data.phaseId) updateData.phase_id = data.phaseId;
      if (data.workOrderId) updateData.work_order_id = data.workOrderId;
      if (data.woNumber) updateData.wo_number = data.woNumber;
      if (data.paymentType) updateData.payment_type = data.paymentType;
      if (data.vendorUpi) updateData.vendor_upi = data.vendorUpi;
      if (data.vendorAccountNumber) updateData.vendor_account_number = data.vendorAccountNumber;
      if (data.vendorIfscCode) updateData.vendor_ifsc_code = data.vendorIfscCode;
      if (data.beneficiaryName) updateData.beneficiary_name = data.beneficiaryName;
      if (data.detailedDescription) updateData.detailed_description = data.detailedDescription;
      if (data.tags) updateData.tags = data.tags;
      if (data.isTransportPayment !== undefined) updateData.is_transport_payment = data.isTransportPayment;
      if (data.transportTrips) updateData.transport_trips = data.transportTrips;

      const { error } = await (supabase
        .from('payment_requests') as any)
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast.success('Payment request resubmitted for approval');
      try {
        await fetchRequests();
      } catch (refreshError) {
        console.error('Non-critical refresh error:', refreshError);
      }
      return { success: true };
    } catch (error) {
      console.error('Error resubmitting payment request:', error);
      toast.error('Failed to resubmit payment request');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  return {
    requests,
    isLoading,
    isSaving,
    createRequest,
    updateStatus,
    resubmitPaymentRequest,
    reversePaymentToAdmin,
    reverseToAdmin: reversePaymentToAdmin, // Support both names if needed elsewhere
    rejectPayment,
    deletePaymentRequest: async (id: string) => {
      if (!user) return { success: false, error: 'Not authenticated' };
      setIsSaving(true);
      try {
        const { error } = await supabase
          .from('payment_requests')
          .delete()
          .eq('id', id);

        if (error) throw error;
        toast.success('Payment request deleted successfully');
        try {
          await fetchRequests();
        } catch (refreshError) {
          console.error('Non-critical refresh error:', refreshError);
        }
        return { success: true };
      } catch (error) {
        console.error('Error deleting payment request:', error);
        toast.error('Failed to delete payment request');
        return { success: false, error };
      } finally {
        setIsSaving(false);
      }
    },
    deleteDraft: async (id: string) => {
      if (!user) return { success: false, error: 'Not authenticated' };
      setIsSaving(true);
      try {
        const { error } = await supabase
          .from('payment_requests')
          .delete()
          .eq('id', id)
          .eq('status', 'draft'); // Only allow deleting drafts

        if (error) throw error;
        toast.success('Draft deleted successfully');
        try {
          await fetchRequests();
        } catch (refreshError) {
          console.error('Non-critical refresh error:', refreshError);
        }
        return { success: true };
      } catch (error) {
        console.error('Error deleting draft:', error);
        toast.error('Failed to delete draft');
        return { success: false, error };
      } finally {
        setIsSaving(false);
      }
    },
    refetch: fetchRequests,
    saveDraft: useCallback(async (requestData: {
      id?: string;
      isProjectWork: boolean;
      purpose: string;
      woNumber?: string;
      vendorName: string;
      vendorBankDetails: string;
      amount: number;
      billUrl?: string;
      workProofUrl?: string;
      cutoffDate?: string;
      cutoffTime?: string;
      urgency: PaymentUrgency;
      projectId?: string;
      phaseId?: string;
      paymentType?: string;
      vendorUpi?: string;
      vendorAccountNumber?: string;
      vendorIfscCode?: string;
      beneficiaryName?: string;
      workOrderId?: string;
      tags?: string[];
      detailedDescription?: string;
      // Split Payment Fields
      isSplitPayment?: boolean;
      splits?: Array<{
        split_title: string;
        payee_name: string;
        beneficiary_name?: string;
        amount: number;
        payment_method: string;
        account_number?: string;
        ifsc_code?: string;
        upi_id?: string;
        bill_url?: string;
        work_proof_url?: string;
      }>;
      // Porter Fields
      isPorterPayment?: boolean;
      porterStartKm?: number;
      porterEndKm?: number;
      porterTotalKm?: number;
      // Transport Fields
      isTransportPayment?: boolean;
      transportTrips?: Array<{
        trip_date: string;
        from_location: string;
        to_location: string;
        distance_km: number;
        amount: number;
        notes?: string;
      }>;
    }) => {
      if (!user) return { success: false, error: 'Not authenticated' };

      setIsSaving(true);
      try {
        const generateUUID = () => {
          if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };

        const splitBatchId = requestData.isSplitPayment ? (requests.find(r => r.id === requestData.id)?.split_batch_id || generateUUID()) : null;

        const draftData: any = {
          requester_id: user.id,
          is_project_work: requestData.isProjectWork,
          purpose: requestData.purpose || 'Untitled Draft',
          detailed_description: requestData.detailedDescription || null,
          wo_number: requestData.woNumber || null,
          vendor_name: requestData.isSplitPayment ? 'SPLIT PAYMENT BATCH' : (requestData.vendorName || 'New Payee'),
          vendor_bank_details: requestData.isSplitPayment ? 'See Split Details' : (requestData.vendorBankDetails || ''),
          amount: requestData.amount || 0,
          bill_url: requestData.billUrl || '',
          work_proof_url: requestData.workProofUrl || '',
          cutoff_date: requestData.cutoffDate || null,
          cutoff_time: requestData.cutoffTime || null,
          urgency: requestData.urgency || 'normal',
          status: 'draft', // Draft must stay as draft
          project_id: requestData.projectId || null,
          phase_id: requestData.phaseId || null,
          payment_type: requestData.isSplitPayment ? 'split' : (requestData.paymentType || 'bank_account'),
          vendor_upi: requestData.vendorUpi || null,
          vendor_account_number: requestData.vendorAccountNumber || null,
          vendor_ifsc_code: requestData.vendorIfscCode?.toUpperCase().trim() || null,
          beneficiary_name: requestData.beneficiaryName || requestData.vendorName || null,
          work_order_id: requestData.workOrderId || null,
          tags: requestData.tags || [],
          // Conditionally include split columns only if they exist in requestData
          ...(requestData.isSplitPayment ? {
            is_split_payment: true,
            split_batch_id: splitBatchId,
            total_splits: requestData.splits?.length || 0,
          } : {}),
          // Porter Payment Support
          ...(requestData.isPorterPayment ? {
            is_porter_payment: true,
            porter_start_km: requestData.porterStartKm || 0,
            porter_end_km: requestData.porterEndKm || 0,
            porter_total_km: requestData.porterTotalKm || 0,
          } : {}),
          // Transport Payment Support
          ...(requestData.isTransportPayment ? {
            is_transport_payment: true,
            transport_trips: requestData.transportTrips || [],
          } : {}),
          updated_at: new Date().toISOString()
        };

        let result;
        if (requestData.id) {
          // Double check that we are not updating a non-draft record
          result = await (supabase
            .from('payment_requests') as any)
            .update(draftData)
            .eq('id', requestData.id)
            .eq('status', 'draft') // Safety: only update if it is still a draft
            .select()
            .single();
        } else {
          draftData.created_at = new Date().toISOString();
          // Normalize department for DB (must match database constraint)
          const deptLower = user.department?.toLowerCase() || 'others';
          if (deptLower.includes('jv') || deptLower.includes('joint venture')) draftData.department = 'jv_engineering';
          else if (deptLower.includes('engineering') || deptLower === 'eng') draftData.department = 'engineering';
          else if (deptLower.includes('agri') && !deptLower.includes('mart')) draftData.department = 'agri';
          else if (deptLower.includes('agrimart') || deptLower.includes('agri mart')) draftData.department = 'agri_mart';
          else if (deptLower.includes('purchase')) draftData.department = 'purchase';
          else if (deptLower.includes('logistics')) draftData.department = 'logistics';
          else if (deptLower.includes('farmers') || deptLower.includes('factory')) draftData.department = 'farmers_factory';
          else if (deptLower.includes('accounts') || deptLower.includes('finance')) draftData.department = 'accounts';
          else if (deptLower.includes('hr') || deptLower.includes('human resources')) draftData.department = 'hr';
          else draftData.department = 'others';

          result = await (supabase
            .from('payment_requests') as any)
            .insert(draftData)
            .select()
            .single();
        }

        if (result.error) {
          console.error('Supabase Draft Error:', result.error);
          throw result.error;
        }

        // Handle split payments insertion for draft
        if (requestData.isSplitPayment && requestData.splits && requestData.splits.length > 0) {
          const parentId = result.data.id;

          // Clear old splits
          const { error: deleteError } = await supabase
            .from('split_payments' as any)
            .delete()
            .eq('parent_payment_id', parentId);

          if (deleteError) {
            console.error('Error clearing old splits:', deleteError);
            throw new Error(`Failed to clear old splits: ${deleteError.message}`);
          }

          const splitsToInsert = requestData.splits.map((s, index) => ({
            parent_payment_id: parentId,
            batch_id: splitBatchId,
            split_number: index + 1,
            split_title: s.split_title,
            payee_name: s.payee_name,
            beneficiary_name: s.beneficiary_name || s.payee_name,
            amount: s.amount,
            payment_method: s.payment_method,
            account_number: s.account_number,
            ifsc_code: s.ifsc_code,
            upi_id: s.upi_id,
            status: 'pending',
            bill_url: s.bill_url || null,
            work_proof_url: s.work_proof_url || null
          }));

          const { error: splitsError } = await supabase
            .from('split_payments' as any)
            .insert(splitsToInsert);

          if (splitsError) {
            console.error('Error inserting splits for draft:', splitsError);
          }
        }

        try {
          await fetchRequests();
        } catch (refreshError) {
          console.error('Non-critical refresh error:', refreshError);
        }
        return { success: true, data: result.data };
      } catch (error: any) {
        console.error('Error saving draft:', error);
        toast.error(`Failed to save draft: ${error.message || 'Unknown error'}`);
        return { success: false, error };
      } finally {
        setIsSaving(false);
      }
    }, [user, requests, fetchRequests]),
  };
}

export function useMyPaymentRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PaymentRequestData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchMyRequests = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('requester_id', user.id)
        .neq('status', 'draft')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const enriched = (data || []) as unknown as PaymentRequestData[];

      // Fetch associated splits
      const splitPaymentIds = enriched.filter(p => p.is_split_payment).map(p => p.id);
      if (splitPaymentIds.length > 0) {
        const { data: splitsData, error: splitsError } = await supabase
          .from('split_payments' as any)
          .select('*')
          .in('parent_payment_id', splitPaymentIds)
          .order('split_number', { ascending: true });

        if (!splitsError && splitsData) {
          enriched.forEach(p => {
            if (p.is_split_payment) {
              p.splits = (splitsData as any[]).filter((s: any) => s.parent_payment_id === p.id);
            }
          });
        }
      }

      setRequests(enriched);
    } catch (error) {
      console.error('Error fetching my payment requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyRequests();

    // Subscribe to real-time updates for user's own requests
    const channel = supabase
      .channel('my-payment-requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_requests',
        },
        () => {
          fetchMyRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const resubmitPaymentRequest = async (
    id: string,
    data: {
      purpose?: string;
      vendorName?: string;
      vendorBankDetails?: string;
      amount?: number;
      billUrl?: string;
      workProofUrl?: string;
      cutoffDate?: string;
      cutoffTime?: string;
      urgency?: string;
      isProjectWork?: boolean;
      projectId?: string;
      phaseId?: string;
      workOrderId?: string;
      woNumber?: string;
      paymentType?: string;
      vendorUpi?: string;
      vendorAccountNumber?: string;
      vendorIfscCode?: string;
      beneficiaryName?: string;
      detailedDescription?: string;
      tags?: string[];
      splits?: Array<{
        id?: string;
        split_title?: string;
        payee_name?: string;
        beneficiary_name?: string;
        account_number?: string;
        ifsc_code?: string;
        upi_id?: string;
      }>;
    }
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);

    try {
      const request = (requests as any[]).find(r => r.id === id);

      const requestDept = request?.department || 'others';
      const initialStatus = getNextPaymentStatus({
        department: requestDept,
        tags: data.tags || request?.tags || []
      }, user.role);

      const updateData: Record<string, unknown> = {
        status: initialStatus,
        admin_approved_by: null,
        admin_approved_at: null,
        admin_rejection_reason: null,
        ceo_approved_by: null,
        ceo_approved_at: null,
        ceo_hold_reason: null,
      };

      // Add timeline entry for resubmission
      const timelineEntry = {
        status: initialStatus,
        user_id: user.id,
        user_name: user.name,
        role: user.role,
        timestamp: new Date().toISOString(),
        notes: `Request resubmitted by ${user.name}`
      };

      const currentTimeline = (request?.audit_timeline || []) as any[];
      updateData.audit_timeline = [...currentTimeline, timelineEntry];

      if (data.purpose) updateData.purpose = data.purpose;
      if (data.vendorName) updateData.vendor_name = data.vendorName;
      if (data.vendorBankDetails) updateData.vendor_bank_details = data.vendorBankDetails;
      if (data.amount) updateData.amount = data.amount;
      if (data.billUrl) updateData.bill_url = data.billUrl;
      if (data.workProofUrl) updateData.work_proof_url = data.workProofUrl;
      if (data.cutoffDate) updateData.cutoff_date = data.cutoffDate;
      if (data.cutoffTime) updateData.cutoff_time = data.cutoffTime;
      if (data.urgency) updateData.urgency = data.urgency;
      if (data.isProjectWork !== undefined) updateData.is_project_work = data.isProjectWork;
      if (data.projectId) updateData.project_id = data.projectId;
      if (data.phaseId) updateData.phase_id = data.phaseId;
      if (data.workOrderId) updateData.work_order_id = data.workOrderId;
      if (data.woNumber) updateData.wo_number = data.woNumber;
      if (data.paymentType) updateData.payment_type = data.paymentType;
      if (data.vendorUpi) updateData.vendor_upi = data.vendorUpi;
      if (data.vendorAccountNumber) updateData.vendor_account_number = data.vendorAccountNumber;
      if (data.vendorIfscCode) updateData.vendor_ifsc_code = data.vendorIfscCode;
      if (data.beneficiaryName) updateData.beneficiary_name = data.beneficiaryName;
      if (data.detailedDescription) updateData.detailed_description = data.detailedDescription;
      if (data.tags) updateData.tags = data.tags;

      const { error } = await (supabase
        .from('payment_requests') as any)
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Sync split payments: update status + bank details if edited
      if (request?.is_split_payment) {
        // Sync status to all splits 
        await (supabase as any)
          .from('split_payments')
          .update({ status: initialStatus })
          .eq('parent_payment_id', id);

        // Update individual split bank details if provided
        if (data.splits && data.splits.length > 0) {
          for (const split of data.splits) {
            if (split.id) {
              const splitUpdate: Record<string, unknown> = {};
              if (split.split_title) splitUpdate.split_title = split.split_title;
              if (split.payee_name) splitUpdate.payee_name = split.payee_name;
              if (split.beneficiary_name) splitUpdate.beneficiary_name = split.beneficiary_name;
              if (split.account_number) splitUpdate.account_number = split.account_number;
              if (split.ifsc_code) splitUpdate.ifsc_code = split.ifsc_code;
              if (split.upi_id) splitUpdate.upi_id = split.upi_id;

              if (Object.keys(splitUpdate).length > 0) {
                await (supabase as any)
                  .from('split_payments')
                  .update(splitUpdate)
                  .eq('id', split.id);
              }
            }
          }
        }
      }

      toast.success('Payment request resubmitted for approval');
      await fetchMyRequests();
      return { success: true };
    } catch (error) {
      console.error('Error resubmitting payment request:', error);
      toast.error('Failed to resubmit payment request');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  return { requests, isLoading, isSaving, resubmitPaymentRequest, refetch: fetchMyRequests };
}
