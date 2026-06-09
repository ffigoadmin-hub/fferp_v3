import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { PaymentRequestData } from './usePaymentRequests';

export function useRealtimePayments(filterStatus?: string[], excludeStatus?: string[]) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PaymentRequestData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMounted = useRef(true);

  // Stabilize status dependencies
  const filterStr = useMemo(() => JSON.stringify(filterStatus), [filterStatus]);
  const excludeStr = useMemo(() => JSON.stringify(excludeStatus), [excludeStatus]);

  // Initial Fetch & Refresh
  const fetchRequests = async (silent = false) => {
    if (!user) return;

    // Skip fetching if filterStatus is an empty array (used for optimization)
    if (filterStatus !== undefined && filterStatus.length === 0) {
      if (isMounted.current) {
        setRequests([]);
        setIsLoading(false);
      }
      return;
    }

    if (!silent) setIsLoading(true);

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

        if (filterStatus && filterStatus.length > 0) {
          query = query.in('status', filterStatus);
        }

        if (excludeStatus && excludeStatus.length > 0) {
          query = query.not('status', 'in', `(${excludeStatus.join(',')})`);
        }

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

      // Enrich with Profiles, Projects/Phases/Work Orders, and Splits
      const requesterIds = [...new Set(payments.map((p: any) => p.requester_id).filter(Boolean))];
      const splitPaymentIds = payments.filter(p => 
        p.is_split_payment || 
        (p.is_transport_payment && (p.vendor_name === 'Multiple Vendors' || p.vendor_name === 'Split Payment Batch'))
      ).map(p => p.id);
      const projectIds = [...new Set(payments.map((p: any) => p.project_id).filter(Boolean))];
      const phaseIds = [...new Set(payments.map((p: any) => p.phase_id).filter(Boolean))];
      const workOrderIds = [...new Set(payments.map((p: any) => p.work_order_id).filter(Boolean))];

      const [profilesRes, splitsRes, projectsRes, phasesRes, workOrdersRes, projectPhasesRes] = await Promise.all([
        requesterIds.length > 0
          ? (supabase.from('profiles') as any).select('id, name, department').in('id', requesterIds)
          : Promise.resolve({ data: [], error: null }),
        splitPaymentIds.length > 0
          ? (supabase as any).from('split_payments').select('*').in('parent_payment_id', splitPaymentIds).order('split_number', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
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

      if (profilesRes.error) console.error('Error fetching profiles:', profilesRes.error);
      if (splitsRes.error) console.error('Error fetching splits:', splitsRes.error);
      if (projectsRes.error) console.error('Error fetching projects:', projectsRes.error);
      if (phasesRes.error) console.error('Error fetching phases:', phasesRes.error);
      if (workOrdersRes.error) console.error('Error fetching work orders:', workOrdersRes.error);
      if (projectPhasesRes.error) console.error('Error fetching project phases:', projectPhasesRes.error);

      let profileMap: Record<string, { name: string; department: string }> = {};
      if (profilesRes.data) {
        profileMap = Object.fromEntries(
          profilesRes.data.map((p: any) => [p.id, { name: p.name, department: p.department }])
        );
      }

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

      // Pre-group splits by parent_payment_id for O(1) lookup
      const splitsByParent: Record<string, any[]> = {};
      if (splitsRes.data) {
        splitsRes.data.forEach((s: any) => {
          if (!splitsByParent[s.parent_payment_id]) {
            splitsByParent[s.parent_payment_id] = [];
          }
          splitsByParent[s.parent_payment_id].push(s);
        });
      }

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
        splits: (p.is_split_payment || (p.is_transport_payment && (p.vendor_name === 'Multiple Vendors' || p.vendor_name === 'Split Payment Batch'))) 
          ? (splitsByParent[p.id] || []) 
          : undefined,
      }));

      if (isMounted.current) {
        setRequests(enriched as PaymentRequestData[]);
      }
    } catch (error) {
      console.error('Detailed error in useRealtimePayments:', error);
      if (isMounted.current) {
        toast.error('Connection error. Please refresh.');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    isMounted.current = true;
    if (!user) return;

    fetchRequests();

    // Set up Real-time Subscription
    const channel = supabase
      .channel('payment_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_requests'
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRecord = payload.new as any;
            const matchesInclude = !filterStatus || filterStatus.includes(newRecord.status);
            const matchesExclude = !excludeStatus || !excludeStatus.includes(newRecord.status);

            if (matchesInclude && matchesExclude) {
              fetchRequests(true); // Silent refresh to get full metadata
            }
          }
          else if (payload.eventType === 'UPDATE') {
            const updatedRecord = payload.new as any;
            const matchesInclude = !filterStatus || filterStatus.includes(updatedRecord.status);
            const matchesExclude = !excludeStatus || !excludeStatus.includes(updatedRecord.status);
            const shouldBeInList = matchesInclude && matchesExclude;

            if (shouldBeInList) {
              fetchRequests(true); // Silent refresh
            } else {
              setRequests(prev => prev.filter(r => r.id !== updatedRecord.id));
            }
          }
          else if (payload.eventType === 'DELETE') {
            setRequests(prev => prev.filter(r => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [user, filterStr, excludeStr]);

  return { requests, isLoading, refresh: () => fetchRequests(false) };
}
