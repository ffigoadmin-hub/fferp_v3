import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

export interface BOIEscalation {
  id: string;
  ticket_number: number;
  client_name: string;
  issue_title: string;
  issue_description: string;
  department: string;
  status: string;
  priority: string;
  current_owner: string;
  created_at: string;
  ack_deadline: string;
  resolve_deadline: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  creator?: { name: string; email: string; department: string };
}

export interface BOICritical {
  id: string;
  ticket_number: number;
  issue_title: string;
  issue_description: string;
  department: string;
  issue_type: string;
  status: string;
  created_at: string;
  ack_deadline: string;
  resolve_deadline: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  creator?: { name: string; email: string };
}

export interface BOILeaveRequest {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  proof_url?: string | null;
  duration_category: 'full' | 'half' | 'hourly';
  start_time: string | null;
  end_time: string | null;
  shift: 'first' | 'second' | null;
  created_at: string;
  employee?: { name: string; department: string };
  leave_type?: { name: string };
}

export interface BOILOPEntry {
  id: string;
  employee_id: string;
  lop_date: string;
  lop_type: string;
  reason: string;
  status: string;
  created_at: string;
  employee?: { name: string; department: string };
}

export interface BOIPayment {
  id: string;
  payment_number: number;
  vendor_name: string;
  vendor_bank_details: string;
  vendor_account_number?: string | null;
  vendor_ifsc_code?: string | null;
  vendor_upi?: string | null;
  amount: number;
  purpose: string;
  status: string;
  urgency: string;
  created_at: string;
  cutoff_date: string;
  cutoff_time: string;
  is_project_work: boolean;
  wo_number?: string | null;
  payment_type?: string | null;
  bill_url: string;
  work_proof_url: string;
  requester?: { name: string; department: string };
}

export function useBOIEscalations() {
  const [escalations, setEscalations] = useState<BOIEscalation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const fetchEscalations = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_escalations')
        .select(`*, creator:profiles!client_escalations_created_by_fkey(name, email, department)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEscalations(data || []);
    } catch (error) {
      console.error('Error fetching escalations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEscalations();

    // Real-time subscription
    const channel = supabase
      .channel('boi-escalations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_escalations' }, (payload) => {
        console.log('[BOI] Escalation realtime update:', payload.eventType);
        fetchEscalations();
      })
      .subscribe((status) => {
        console.log('[BOI] Escalations channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEscalations]);

  return { escalations, isLoading, refetch: fetchEscalations };
}

export function useBOICriticals() {
  const [criticals, setCriticals] = useState<BOICritical[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCriticals = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('hourly_criticals')
        .select(`*, creator:profiles!hourly_criticals_created_by_fkey(name, email)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCriticals(data || []);
    } catch (error) {
      console.error('Error fetching criticals:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCriticals();

    const channel = supabase
      .channel('boi-criticals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hourly_criticals' }, (payload) => {
        console.log('[BOI] Critical realtime update:', payload.eventType);
        fetchCriticals();
      })
      .subscribe((status) => {
        console.log('[BOI] Criticals channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCriticals]);

  return { criticals, isLoading, refetch: fetchCriticals };
}

export function useBOILeaveRequests() {
  const [leaveRequests, setLeaveRequests] = useState<BOILeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeaveRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      // BOI sees requests pending BOI verification (after HR review)
      // Leave workflow: Employee → HR → BOI → Admin
      const { data, error } = await (supabase
        .from('leave_requests')
        .select(`
          id, 
          employee_id, 
          start_date, 
          end_date, 
          reason, 
          status, 
          proof_url, 
          duration_category, 
          start_time, 
          end_time, 
          shift, 
          created_at,
          employee:profiles!leave_requests_employee_id_fkey(name, department), 
          leave_type:leave_types(name)
        `)
        .eq('status', 'pending_boi')
        .order('created_at', { ascending: false }) as any);

      if (error) throw error;
      setLeaveRequests(data || []);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaveRequests();

    const channel = supabase
      .channel('boi-leave')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, (payload) => {
        console.log('[BOI] Leave request realtime update:', payload.eventType);
        fetchLeaveRequests();
      })
      .subscribe((status) => {
        console.log('[BOI] Leave channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeaveRequests]);

  return { leaveRequests, isLoading, refetch: fetchLeaveRequests };
}

export function useBOILOPEntries() {
  const [lopEntries, setLopEntries] = useState<BOILOPEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const fetchLopEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('lop_entries')
        .select(`*, employee:profiles!lop_entries_employee_id_fkey(name, department)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLopEntries(data || []);
    } catch (error) {
      console.error('Error fetching LOP entries:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create LOP - Manual LOPs require approval chain: BOI → Admin → CEO
  // System-generated LOPs are auto-approved
  const createLOP = async (employeeId: string, date: string, reason: string, lopType: '0.1_day' | '0.25_day' | '0.5_day' | '1_day' = '0.5_day', evidenceUrl: string = 'N/A') => {
    if (!user?.id) throw new Error('Not authenticated');

    const { error } = await supabase.from('lop_entries').insert({
      employee_id: employeeId,
      lop_date: date,
      lop_type: lopType,
      reason,
      evidence_url: evidenceUrl,
      created_by: user.id,
      status: 'pending_admin', // BOI creates, goes to Admin for verification (skip BOI step)
      source: 'manual',
    } as any);

    if (error) throw error;
    fetchLopEntries();
  };

  // BOI verifies and forwards to Admin
  const verifyLOP = async (id: string, action: 'verify' | 'reject', rejectionReason?: string) => {
    if (!user?.id) throw new Error('Not authenticated');

    // Get entry details for notification
    const entry = lopEntries.find(l => l.id === id);

    const updateData: any = {};
    if (action === 'verify') {
      updateData.status = 'pending_admin';
    } else {
      updateData.status = 'rejected';
      updateData.rejection_reason = rejectionReason || 'Rejected by BOI';
    }

    const { error } = await (supabase
      .from('lop_entries') as any)
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    // Send notification to employee on rejection
    if (entry && action === 'reject') {
      await (supabase.from('notifications') as any).insert({
        user_id: entry.employee_id,
        title: 'LOP Entry Rejected',
        message: `Your LOP entry for ${entry.lop_date} has been rejected by BOI. Reason: ${rejectionReason || 'Not specified'}`,
        type: 'lop_rejected',
        role: 'employee',
      });
    }

    fetchLopEntries();
  };

  // BOI verifies reversal request and forwards to Admin
  const verifyReversal = async (id: string, action: 'verify' | 'reject', rejectionReason?: string) => {
    if (!user?.id) throw new Error('Not authenticated');

    const entry = lopEntries.find(l => l.id === id);

    const updateData: any = {
      reversal_boi_reviewed_at: new Date().toISOString(),
      reversal_boi_reviewed_by: user.id,
    };

    if (action === 'verify') {
      updateData.reversal_status = 'REV_PENDING_ADMIN';
    } else {
      updateData.reversal_status = 'REV_REJECTED';
    }

    const { error } = await (supabase
      .from('lop_entries') as any)
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    // Send notification to employee
    if (entry) {
      await (supabase.from('notifications') as any).insert({
        user_id: entry.employee_id,
        title: action === 'verify' ? 'Reversal Forwarded to Admin' : 'Reversal Request Rejected',
        message: action === 'verify'
          ? `Your LOP reversal request for ${entry.lop_date} has been verified and forwarded to Admin.`
          : `Your LOP reversal request for ${entry.lop_date} has been rejected. Reason: ${rejectionReason || 'Not specified'}`,
        type: action === 'verify' ? 'lop_reversal_progress' : 'lop_reversal_rejected',
        role: 'employee',
      });
    }

    fetchLopEntries();
  };

  useEffect(() => {
    fetchLopEntries();

    const channel = supabase
      .channel('boi-lop')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lop_entries' }, (payload) => {
        console.log('[BOI] LOP entry realtime update:', payload.eventType);
        fetchLopEntries();
      })
      .subscribe((status) => {
        console.log('[BOI] LOP channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLopEntries]);

  return { lopEntries, isLoading, refetch: fetchLopEntries, createLOP, verifyLOP, verifyReversal };
}

export function useBOIPayments() {
  const [payments, setPayments] = useState<BOIPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      // BOI sees payments that are pending BOI audit (status = 'pending' means newly submitted)
      const { data, error } = await supabase
        .from('payment_requests')
        .select(`*, requester:profiles!payment_requests_requester_id_fkey(name, department)`)
        .eq('status', 'pending') // BOI audits fresh submissions before forwarding to Admin
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching BOI payments:', error);
        throw error;
      }
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const approvePayment = async (paymentId: string) => {
    if (!user?.id) throw new Error('Not authenticated');

    const { error } = await (supabase
      .from('payment_requests') as any)
      .update({
        status: 'pending_admin',
        boi_approved_at: new Date().toISOString(),
        boi_approved_by: user.id
      } as any)
      .eq('id', paymentId);

    if (error) throw error;
    fetchPayments();
  };

  const rejectPayment = async (paymentId: string, reason: string) => {
    if (!user?.id) throw new Error('Not authenticated');

    const { error } = await (supabase
      .from('payment_requests') as any)
      .update({
        status: 'rejected',
        boi_rejection_reason: reason
      } as any)
      .eq('id', paymentId);

    if (error) throw error;
    fetchPayments();
  };

  useEffect(() => {
    fetchPayments();

    const channel = supabase
      .channel('boi-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, (payload) => {
        console.log('[BOI] Payment realtime update:', payload.eventType);
        fetchPayments();
      })
      .subscribe((status) => {
        console.log('[BOI] Payments channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPayments]);

  return { payments, isLoading, refetch: fetchPayments, approvePayment, rejectPayment };
}

// BOI Work Orders Hook
export interface BOIWorkOrder {
  id: string;
  wo_number: number;
  requester_id: string;
  project_id: string;
  work_description: string;
  detailed_scope: string;
  estimated_amount: number;
  advance_amount: number;
  payment_stage: string;
  wo_document_url: string;
  status: string;
  created_at: string;
  requester?: { name: string; department: string };
  project?: { project_id: string; project_name: string };
}

export function useBOIWorkOrders() {
  const [workOrders, setWorkOrders] = useState<BOIWorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const fetchWorkOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      // BOI sees work orders that are pending (newly submitted)
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          requester:profiles!work_orders_requester_id_fkey(name, department),
          project:projects!work_orders_project_id_fkey(project_id, project_name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error) {
      console.error('Error fetching BOI work orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const approveWorkOrder = async (orderId: string) => {
    if (!user?.id) throw new Error('Not authenticated');

    const { error } = await (supabase
      .from('work_orders') as any)
      .update({
        status: 'pending_admin',
        boi_verified_at: new Date().toISOString(),
        boi_verified_by: user.id
      } as any)
      .eq('id', orderId);

    if (error) throw error;
    fetchWorkOrders();
  };

  const rejectWorkOrder = async (orderId: string, reason: string) => {
    if (!user?.id) throw new Error('Not authenticated');

    const { error } = await (supabase
      .from('work_orders') as any)
      .update({
        status: 'rejected',
        boi_rejection_reason: reason
      } as any)
      .eq('id', orderId);

    if (error) throw error;
    fetchWorkOrders();
  };

  useEffect(() => {
    fetchWorkOrders();

    const channel = supabase
      .channel('boi-work-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, () => {
        fetchWorkOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchWorkOrders]);

  return { workOrders, isLoading, refetch: fetchWorkOrders, approveWorkOrder, rejectWorkOrder };
}

// BOI Purchase Orders Hook
export interface BOIPurchaseOrder {
  id: string;
  po_number: number;
  requester_id: string;
  project_id: string;
  vendor_name: string;
  vendor_bank_details: string;
  vendor_upi: string | null;
  item_description: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  cost_comparison_url: string;
  po_document_url: string;
  status: string;
  created_at: string;
  requester?: { name: string; department: string };
  project?: { project_id: string; project_name: string };
}

export function useBOIPurchaseOrders() {
  const [purchaseOrders, setPurchaseOrders] = useState<BOIPurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const fetchPurchaseOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      // BOI sees purchase orders that are pending (newly submitted)
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          requester:profiles!purchase_orders_requester_id_fkey(name, department),
          project:projects!purchase_orders_project_id_fkey(project_id, project_name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchaseOrders((data || []) as any);
    } catch (error) {
      console.error('Error fetching BOI purchase orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const approvePurchaseOrder = async (orderId: string) => {
    if (!user?.id) throw new Error('Not authenticated');

    const { error } = await (supabase
      .from('purchase_orders') as any)
      .update({
        status: 'pending_admin',
        boi_verified_at: new Date().toISOString(),
        boi_verified_by: user.id
      } as any)
      .eq('id', orderId);

    if (error) throw error;
    fetchPurchaseOrders();
  };

  const rejectPurchaseOrder = async (orderId: string, reason: string) => {
    if (!user?.id) throw new Error('Not authenticated');

    const { error } = await (supabase
      .from('purchase_orders') as any)
      .update({
        status: 'rejected',
        boi_rejection_reason: reason
      } as any)
      .eq('id', orderId);

    if (error) throw error;
    fetchPurchaseOrders();
  };

  useEffect(() => {
    fetchPurchaseOrders();

    const channel = supabase
      .channel('boi-purchase-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => {
        fetchPurchaseOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPurchaseOrders]);

  return { purchaseOrders, isLoading, refetch: fetchPurchaseOrders, approvePurchaseOrder, rejectPurchaseOrder };
}

export function useBOIEmployees() {
  const [employees, setEmployees] = useState<{ id: string; name: string; department: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, department')
        .eq('is_active', true)
        .order('name');

      if (!error) setEmployees(data || []);
      setIsLoading(false);
    };

    fetchEmployees();
  }, []);

  return { employees, isLoading };
}
