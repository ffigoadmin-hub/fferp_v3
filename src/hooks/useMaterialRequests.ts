import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface MaterialRequest {
  id: string;
  project_id: string;
  phase_id: string | null;
  requested_by: string;
  boq_items: any[];
  urgency: 'low' | 'normal' | 'high' | 'critical';
  notes: string | null;
  status: 'pending' | 'sourcing' | 'quoted' | 'approved' | 'ordered' | 'delivered' | 'cancelled';
  assigned_to_purchase: string | null;
  created_at: string;
  updated_at: string;
  // Approval fields
  selected_quote_id: string | null;
  approval_status: string | null;
  split_group_id: string | null;
  smo_approved_by: string | null;
  smo_approved_at: string | null;
  gmo_approved_by: string | null;
  gmo_approved_at: string | null;
  gm_approved_by: string | null;
  gm_approved_at: string | null;
  admin_approved_by: string | null;
  admin_approved_at: string | null;
  ceo_approved_by: string | null;
  ceo_approved_at: string | null;
  requester_department: string | null;
  delivery_status: string | null;
  delivery_notes: string | null;
  linked_payment_id: string | null;
  // Order tracking fields - extended with loading/unloading
  order_status: 'not_ordered' | 'ordered' | 'loading' | 'shipped' | 'unloading' | 'delivered' | 'delayed' | null;
  order_notes: string | null;
  invoice_url: string | null;
  actual_delivery_date: string | null;
  estimated_delivery_date: string | null;
  // Farm audit fields
  farm_audit_status: 'pending' | 'verified' | 'discrepancy' | 'rejected' | null;
  farm_audit_notes: string | null;
  farm_audited_by: string | null;
  farm_audited_at: string | null;
  added_to_inventory: boolean | null;
  // Assigned auditor fields
  assigned_auditor_id: string | null;
  assigned_auditor_at: string | null;
  assigned_auditor_by: string | null;
  // Joined fields
  project?: { project_name: string; project_id: string };
  phase?: { phase_name: string };
  requester?: { name: string; email: string; department: string };
  assignee?: { name: string; email: string };
}

export function useMaterialRequests(projectId?: string) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const currentProjectIdRef = useRef<string | undefined>(undefined);
  const isMountedRef = useRef(false);

  const fetchRequests = useCallback(async () => {
    console.log('[useMaterialRequests] Fetching material requests for projectId:', projectId);
    setIsLoading(true);

    try {
      // Use simple select without complex joins to avoid PostgREST schema cache issues
      let query = (supabase
        .from('material_requests') as any)
        .select(`
          *,
          project:projects!material_requests_project_id_fkey(project_name, id, project_id),
          phase:project_phases(phase_name)
        `)
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log('[useMaterialRequests] Fetched', data?.length, 'requests');

      // Collect unique profile IDs for manual resolution
      const profileIds = new Set<string>();
      (data || []).forEach((r: any) => {
        if (r.requested_by) profileIds.add(r.requested_by);
        if (r.assigned_to_purchase) profileIds.add(r.assigned_to_purchase);
      });

      // Fetch all needed profiles in one query
      let profileMap: Record<string, any> = {};
      if (profileIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email, department')
          .in('id', Array.from(profileIds));

        (profiles || []).forEach((p: any) => {
          profileMap[p.id] = p;
        });
      }

      // Collect all BOQ item IDs across all requests for batch fetch
      const allBoqIds = new Set<string>();
      (data || []).forEach((r: any) => {
        if (r.boq_items && Array.isArray(r.boq_items)) {
          r.boq_items.forEach((item: any) => {
            if (item.id) allBoqIds.add(item.id);
          });
        }
      });

      // Batch fetch all BOQ details
      let boqMap: Record<string, any> = {};
      if (allBoqIds.size > 0) {
        const { data: boqDetails } = await supabase
          .from('project_boq')
          .select('id, material_name, specification, unit, estimated_unit_cost, quantity')
          .in('id', Array.from(allBoqIds));

        (boqDetails || []).forEach((b: any) => {
          boqMap[b.id] = b;
        });
      }

      // Enrich all requests with profiles and BOQ details
      const enrichedData = (data || []).map((request: any) => {
        // Attach requester and assignee profiles
        const requester = profileMap[request.requested_by] || null;
        const assignee = request.assigned_to_purchase ? profileMap[request.assigned_to_purchase] || null : null;

        // Enrich BOQ items
        let enrichedBoqItems = request.boq_items;
        if (request.boq_items && Array.isArray(request.boq_items)) {
          enrichedBoqItems = request.boq_items.map((item: any) => {
            const details = boqMap[item.id];
            if (details) {
              return {
                ...item,
                material_name: details.material_name,
                name: details.material_name,
                // Prefer non-empty custom specification, fallback to master BOQ spec
                specification: (item.specification && item.specification.trim()) || (details.specification && details.specification.trim()) || null,
                unit: details.unit,
                unit_cost: details.estimated_unit_cost,
                quantity: item.quantity_needed || item.quantity || details.quantity,
              };
            }
            return item;
          });
        }

        // Normalize phase and project if they are arrays (Supabase client quirk)
        const phase = Array.isArray(request.phase) ? request.phase[0] : request.phase;
        const project = Array.isArray(request.project) ? request.project[0] : request.project;

        return {
          ...request,
          phase,
          project,
          requester: requester ? { name: requester.name, email: requester.email, department: requester.department } : null,
          assignee: assignee ? { name: assignee.name, email: assignee.email } : null,
          boq_items: enrichedBoqItems,
        };
      });

      console.log('[useMaterialRequests] Sample enriched request:', enrichedData[0] ? {
        id: enrichedData[0].id,
        phase_id: enrichedData[0].phase_id,
        phase: enrichedData[0].phase,
        boq_items_sample: enrichedData[0].boq_items?.slice(0, 2),
      } : 'no data');
      setRequests(enrichedData as MaterialRequest[]);
    } catch (error: any) {
      console.error('Error fetching material requests:', error);
      if (!isMissingTable(error)) toast.error('Failed to load material requests');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Initial fetch on mount and when projectId changes
  useEffect(() => {
    // Always fetch on mount or when projectId changes
    if (!isMountedRef.current || projectId !== currentProjectIdRef.current) {
      isMountedRef.current = true;
      currentProjectIdRef.current = projectId;
      fetchRequests();
    }
  }, [projectId, fetchRequests]);

  // Real-time subscription
  useEffect(() => {
    const channelName = projectId
      ? `material-requests-${projectId}`
      : `material-requests-all`;

    console.log('[useMaterialRequests] Setting up subscription:', channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'material_requests',
          ...(projectId ? { filter: `project_id=eq.${projectId}` } : {})
        },
        (payload) => {
          console.log('[useMaterialRequests] Real-time update received:', payload.eventType);
          fetchRequests();
        }
      )
      .subscribe((status) => {
        console.log('[useMaterialRequests] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchRequests]);

  const createRequest = async (requestData: {
    project_id: string;
    phase_id?: string;
    boq_items: { id: string; quantity_needed: number; specification?: string }[];
    urgency: 'low' | 'normal' | 'high' | 'critical';
    notes?: string;
  }) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const response = await (supabase
        .from('material_requests') as any)
        .insert({
          ...requestData,
          requested_by: user.id,
          status: 'pending',
          approval_status: (user as any).role === 'smo' ? 'pending_gmo' : 'pending_smo',
        });

      if (response.error) throw response.error;
      toast.success('Material request created successfully');
      await fetchRequests();
    } catch (error: any) {
      console.error('Error creating material request:', error);
      toast.error('Failed to create material request');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const createInternalRequest = async (requestData: {
    requester_department: string;
    requester_name: string;
    boq_items: any[]; // Ad-hoc items
    urgency: 'low' | 'normal' | 'high' | 'critical';
    notes?: string;
    project_id?: string; // Optional, will try to find default if not provided
  }) => {
    if (!user) return;
    setIsSaving(true);

    try {
      // 1. Find a suitable project ID if not provided
      let targetProjectId = requestData.project_id;

      if (!targetProjectId) {
        // Try to find an "Internal" or "General" project
        const { data: projects } = await supabase
          .from('projects')
          .select('id, project_name')
          .ilike('project_name', '%Internal%')
          .limit(1);

        if (projects && projects.length > 0) {
          targetProjectId = projects[0].id;
        } else {
          // Fallback: Get ANY active project
          const { data: anyProject } = await supabase
            .from('projects')
            .select('id')
            .limit(1);

          if (anyProject && anyProject.length > 0) {
            targetProjectId = anyProject[0].id;
          } else {
            throw new Error('No active projects found. Cannot create request without a project context.');
          }
        }
      }

      // 2. Prepare payload
      const payload = {
        project_id: targetProjectId,
        requested_by: user.id, // The purchase user is technically the "creator" in system
        requester_department: requestData.requester_department, // Override with form data
        // We might need to store the "Real Requester Name" in notes or a custom field if schema doesn't support it directly
        // For now, let's append it to notes
        notes: `Requested by: ${requestData.requester_name}\n${requestData.notes || ''}`,
        boq_items: requestData.boq_items,
        urgency: requestData.urgency,
        status: 'pending', // Starts as pending
        approval_status: 'approved_for_sourcing', // BYPASS APPROVALS
        approved_for_sourcing_at: new Date().toISOString(),
      };

      const response = await (supabase
        .from('material_requests') as any)
        .insert(payload);

      if (response.error) throw response.error;
      toast.success('Internal request created & sent to sourcing');
      await fetchRequests();
    } catch (error: any) {
      console.error('Error creating internal request:', error);
      toast.error(error.message || 'Failed to create internal request');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const splitRequest = async (originalRequestId: string, itemsToMove: any[]) => {
    if (!user) return;
    setIsSaving(true);
    try {
      // 1. Get original request
      const { data: original, error: fetchError } = await supabase
        .from('material_requests')
        .select('*')
        .eq('id', originalRequestId)
        .single();

      if (fetchError || !original) throw fetchError || new Error("Original request not found");

      const metadata = original as any;
      const newRequestPayload = {
        project_id: metadata.project_id,
        phase_id: metadata.phase_id,
        requested_by: metadata.requested_by,
        requester_department: metadata.requester_department,
        urgency: metadata.urgency,
        notes: metadata.notes,
        assigned_to_purchase: metadata.assigned_to_purchase,
        split_group_id: metadata.split_group_id || metadata.id, // Link to original group or create new
        boq_items: itemsToMove,
        status: 'sourcing',
        approval_status: 'pending_smo',
        selected_quote_id: null,
      };

      const { error: insertError } = await (supabase
        .from('material_requests') as any)
        .insert(newRequestPayload);

      if (insertError) throw insertError;

      // 3. Update original request (remove itemsToMove)
      const moveIds = new Set(itemsToMove.map(item => item.id));
      const remainingItems = ((original.boq_items as any[]) || []).filter((item: any) => !moveIds.has(item.id));

      if (remainingItems.length === 0) {
        // Option A: Try to delete the empty original request
        const { error: deleteError } = await supabase
          .from('material_requests')
          .delete()
          .eq('id', originalRequestId);

        if (deleteError) {
          console.warn('Could not delete original request, marking as cancelled:', deleteError);
          // Option B: Fallback to cancelling it if there are foreign key constraints
          await (supabase
            .from('material_requests') as any)
            .update({
              boq_items: [],
              status: 'cancelled',
              notes: (original.notes || '') + '\n(All items moved to a split request)'
            })
            .eq('id', originalRequestId);
        }
      } else {
        const { error: updateError } = await (supabase
          .from('material_requests') as any)
          .update({ boq_items: remainingItems })
          .eq('id', originalRequestId);

        if (updateError) throw updateError;
      }

      toast.success('Successfully split request items into a new sourcing request');
      await fetchRequests();
    } catch (error: any) {
      console.error('Error splitting request:', error);
      toast.error('Failed to split request');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const updateRequest = async (id: string, updates: Partial<MaterialRequest>) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await (supabase
        .from('material_requests') as any)
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      toast.success('Material request updated');
      await fetchRequests();
    } catch (error: any) {
      console.error('Error updating material request:', error);
      toast.error('Failed to update material request');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const assignToPurchase = async (id: string, purchaseUserId: string) => {
    return updateRequest(id, {
      assigned_to_purchase: purchaseUserId,
      status: 'sourcing'
    });
  };

  const selectQuote = async (id: string, quoteId: string) => {
    // Direct routing: After quote selection, it goes straight to GM -> Admin -> CEO
    return updateRequest(id, {
      selected_quote_id: quoteId,
      status: 'quoted',
      approval_status: 'pending_gm'
    } as any);
  };

  const approveRequest = async (id: string, role: 'smo' | 'gmo' | 'boi' | 'gm' | 'admin' | 'ceo') => {
    if (!user) return;
    setIsSaving(true);

    try {
      const updates: any = {
        [`${role}_approved_at`]: new Date().toISOString(),
        [`${role}_approved_by`]: user.id,
      };

      // Determine next approval status
      if (role === 'smo') {
        updates.approval_status = 'pending_gmo';
      } else if (role === 'gmo') {
        // After GMO, it goes to GM for verification (standardizing with Payment flow)
        updates.approval_status = 'pending_gm';
        updates.approved_for_sourcing_at = new Date().toISOString();
      } else if (role === 'boi' || role === 'gm') {
        // BOI and GM are now consolidated in verification stage
        updates.approval_status = 'pending_admin';
      } else if (role === 'admin') {
        updates.approval_status = 'pending_ceo';
      } else if (role === 'ceo') {
        updates.approval_status = 'ceo_approved';
        updates.status = 'approved';
      }

      const { error } = await (supabase
        .from('material_requests') as any)
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // If CEO approved, auto-create payment
      if (role === 'ceo') {
        await createPaymentFromRequest(id);
      }

      toast.success(`${role.toUpperCase()} approval recorded`);
      await fetchRequests();
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast.error('Failed to approve request');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const rejectRequest = async (id: string, reason: string) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await (supabase
        .from('material_requests') as any)
        .update({
          approval_status: 'rejected_smo',
          notes: `REJECTED BY SMO: ${reason}`,
          smo_approved_at: new Date().toISOString(),
          smo_approved_by: user.id
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Material request rejected');
      await fetchRequests();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast.error('Failed to reject request');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const createPaymentFromRequest = async (requestId: string) => {
    try {
      // Get the material request first
      const { data: request, error: reqError } = await supabase
        .from('material_requests')
        .select(`
          *,
          project:projects(project_name, project_id)
        `)
        .eq('id', requestId)
        .single();

      if (reqError || !request) {
        console.error('Error fetching request:', reqError);
        throw reqError || new Error('Request not found');
      }

      // FIX: Fetch the selected quote separately using selected_quote_id
      if (!request.selected_quote_id) {
        console.error('No selected quote ID found on request:', requestId);
        toast.error('Cannot create payment - no quote selected');
        return;
      }

      const { data: quote, error: quoteError } = await supabase
        .from('vendor_quotes')
        .select('*')
        .eq('id', request.selected_quote_id)
        .single();

      if (quoteError || !quote) {
        console.error('No quote found for ID:', request.selected_quote_id, quoteError);
        toast.error('Cannot create payment - quote not found');
        return;
      }

      console.log('Creating payment from quote:', quote);

      // Construct bank details from vendor quote fields with clear formatting
      const bankDetails = [
        quote.vendor_bank_name && `Bank: ${quote.vendor_bank_name}`,
        quote.vendor_account_number && `A/C: ${quote.vendor_account_number}`,
        quote.vendor_ifsc && `IFSC: ${quote.vendor_ifsc}`,
        quote.vendor_gst && `GST: ${quote.vendor_gst}`,
      ].filter(Boolean).join('\n') || 'See vendor quote for bank details';

      // Create payment request - directly with ceo_approved status so it goes to Accounts
      const { data: payment, error: payError } = await (supabase
        .from('payment_requests') as any)
        .insert({
          requester_id: request.requested_by,
          project_id: request.project_id,
          phase_id: request.phase_id,
          amount: quote.quoted_total || 0,
          vendor_name: quote.vendor_name || 'Unknown Vendor',
          vendor_bank_details: bankDetails,
          // NEW: Include vendor phone and contact person for verification
          vendor_phone: quote.vendor_contact || null,
          vendor_contact_person: quote.vendor_contact || null,
          vendor_account_number: quote.vendor_account_number || null,
          vendor_ifsc_code: quote.vendor_ifsc || null,
          purpose: `Material Purchase - ${(request as any).project?.project_name || 'Project'}`,
          bill_url: quote.quote_document_url || quote.quote_drive_link || '',
          work_proof_url: quote.quote_document_url || quote.quote_drive_link || '',
          cutoff_date: new Date().toISOString().split('T')[0],
          cutoff_time: '18:00',
          urgency: request.urgency === 'critical' ? 'emergency' : request.urgency === 'high' ? 'important' : 'normal',
          is_project_work: true,
          // KEY FIX: Status directly to ceo_approved so it goes to Accounts Execution
          status: 'ceo_approved',
          ceo_approved_by: user?.id,
          ceo_approved_at: new Date().toISOString(),
          payment_type: 'material_purchase',
          // Link back to material request
          material_request_id: requestId,
        })
        .select()
        .single();

      if (payError) {
        console.error('Error creating payment:', payError);
        throw payError;
      }

      console.log('Payment created successfully:', payment);

      // Link payment to material request
      await (supabase
        .from('material_requests') as any)
        .update({
          linked_payment_id: payment.id,
          delivery_status: 'ordered'
        })
        .eq('id', requestId);

      // Log to procurement timeline
      await (supabase.from('procurement_timeline') as any).insert({
        material_request_id: requestId,
        action: 'payment_created',
        performed_by: user?.id,
        performed_by_name: user?.name,
        details: { payment_id: payment.id, amount: quote.quoted_total },
      });

      toast.success('Payment request auto-created from approved material request');
    } catch (error: any) {
      console.error('Error creating payment from request:', error);
      toast.error('Failed to create payment from material request');
    }
  };

  const updateDeliveryStatus = async (id: string, status: string, notes?: string) => {
    return updateRequest(id, {
      delivery_status: status,
      delivery_notes: notes,
      ...(status === 'delivered' ? { actual_delivery_date: new Date().toISOString().split('T')[0] } : {})
    } as any);
  };

  return {
    requests,
    isLoading,
    isSaving,
    createRequest,
    createInternalRequest,
    updateRequest,
    assignToPurchase,
    selectQuote,
    approveRequest,
    rejectRequest,
    updateDeliveryStatus,
    splitRequest,
    refetch: fetchRequests,
  };
}
// ... existing code ...

export function useMyMaterialRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMyRequests = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('material_requests')
        .select(`
          *,
          project:projects!material_requests_project_id_fkey(project_name, id, project_id),
          phase:project_phases(phase_name)
        `)
        .eq('requested_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;


      const normalizedData = (data || []).map((req: any) => ({
        ...req,
        project: Array.isArray(req.project) ? req.project[0] : req.project,
        phase: Array.isArray(req.phase) ? req.phase[0] : req.phase,
      }));

      setRequests(normalizedData as MaterialRequest[]);
    } catch (error) {
      console.error('Error fetching my material requests:', error);
      const _isMissing = (error as any)?.code === 'PGRST205' || (error as any)?.message?.includes('schema cache'); if (!_isMissing) if (!isMissingTable(error)) toast.error('Failed to fetch material requests');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyRequests();

    const channel = supabase
      .channel('my-material-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'material_requests',
          filter: `requested_by=eq.${user?.id}`
        },
        () => {
          fetchMyRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchMyRequests]);

  return { requests, isLoading, refetch: fetchMyRequests };
}
