import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectExecutionSummary {
  project_id: string;
  project_name: string;
  client_name: string;
  lifecycle_stage: string;
  current_phase_id: string | null;
  material_status: string;
  work_order_status: string;
  overall_completion_percentage: number;
  total_boq_items: number;
  pending_boq_items: number;
  ordered_boq_items: number;
  delivered_boq_items: number;
  total_pos: number;
  pending_pos: number;
  approved_pos: number;
  total_wos: number;
  pending_wos: number;
  approved_wos: number;
  total_paid: number;
  pending_payments: number;
  total_phases: number;
  completed_phases: number;
  // New fields for material/work requests
  total_material_requests: number;
  total_work_requests: number;
}

export interface ProjectExecutionDetails {
  project: any;
  boqItems: any[];
  purchaseOrders: any[];
  workOrders: any[];
  payments: any[];
  phases: any[];
  timeline: any[];
  procurementTimeline: any[];
}

export function useProjectExecution(projectId?: string) {
  const [summary, setSummary] = useState<ProjectExecutionSummary | null>(null);
  const [details, setDetails] = useState<ProjectExecutionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const currentProjectIdRef = useRef<string | undefined>(undefined);

  const fetchSummary = useCallback(async () => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    console.log('[useProjectExecution] Fetching data for project:', projectId);
    setIsLoading(true);

    try {
      // Fetch project with all related data
      const [
        projectResult,
        boqResult,
        poResult,
        woResult,
        paymentResult,
        phasesResult,
        timelineResult,
        materialRequestsResult,
        workRequestsResult,
        procurementTimelineResult
      ] = await Promise.all([
        supabase
          .from('projects')
          .select(`
            *,
            vertical:project_verticals(id, name, icon, color, category),
            manager:profiles!projects_assigned_manager_id_fkey(id, name, email),
            engineer:profiles!projects_assigned_engineer_id_fkey(id, name, email)
          `)
          .eq('id', projectId)
          .single(),
        supabase
          .from('project_boq')
          .select('*')
          .eq('project_id', projectId)
          .order('line_number'),
        supabase
          .from('purchase_orders')
          .select('*, requester:profiles!purchase_orders_requester_id_fkey(name)')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('work_orders')
          .select('*, requester:profiles!work_orders_requester_id_fkey(name)')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('payment_requests')
          .select('*, requester:profiles!payment_requests_requester_id_fkey(name)')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('project_phases')
          .select('*')
          .eq('project_id', projectId)
          .order('phase_order'),
        supabase
          .from('project_timeline')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('material_requests')
          .select('id, boq_items')
          .eq('project_id', projectId),
        supabase
          .from('vendor_work_requests')
          .select('id')
          .eq('project_id', projectId),
        supabase
          .from('procurement_timeline')
          .select('*, material_request:material_requests(project:projects(project_name))')
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      const boqItems = boqResult.data || [];
      const pos = poResult.data || [];
      const wos = woResult.data || [];
      const payments = paymentResult.data || [];
      const phases = phasesResult.data || [];
      const materialRequests = materialRequestsResult.data || [];
      const workRequests = workRequestsResult.data || [];

      // Calculate summary
      const summaryData: ProjectExecutionSummary = {
        project_id: projectId,
        project_name: projectResult.data?.project_name || '',
        client_name: projectResult.data?.client_name || '',
        lifecycle_stage: projectResult.data?.lifecycle_stage || 'new_deal',
        current_phase_id: projectResult.data?.current_phase_id || null,
        material_status: projectResult.data?.material_status || 'pending',
        work_order_status: projectResult.data?.work_order_status || 'pending',
        overall_completion_percentage: projectResult.data?.overall_completion_percentage || 0,
        total_boq_items: boqItems.length,
        pending_boq_items: boqItems.filter((i: any) => i.status === 'pending').length,
        ordered_boq_items: boqItems.filter((i: any) => ['ordered', 'sourced'].includes(i.status)).length,
        delivered_boq_items: boqItems.filter((i: any) => i.status === 'delivered').length,
        total_pos: pos.length,
        pending_pos: pos.filter((p: any) => p.status === 'pending').length,
        approved_pos: pos.filter((p: any) => p.status === 'ceo_approved').length,
        total_wos: wos.length,
        pending_wos: wos.filter((w: any) => w.status === 'pending').length,
        approved_wos: wos.filter((w: any) => w.status === 'ceo_approved').length,
        total_paid: payments.filter((p: any) => p.status === 'paid').reduce((sum: number, p: any) => sum + Number(p.amount), 0),
        pending_payments: payments.filter((p: any) => ['pending', 'admin_approved', 'ceo_approved'].includes(p.status)).reduce((sum: number, p: any) => sum + Number(p.amount), 0),
        total_phases: phases.length,
        completed_phases: phases.filter((p: any) => p.status === 'completed').length,
        total_material_requests: materialRequests.filter((r: any) => r.boq_items && r.boq_items.length > 0).length,
        total_work_requests: workRequests.length
      };

      setSummary(summaryData);

      // Filter procurement timeline by project
      const projectProcurementTimeline = (procurementTimelineResult.data || []).filter(
        (pt: any) => pt.material_request?.project?.project_name === projectResult.data?.project_name
      );

      setDetails({
        project: projectResult.data,
        boqItems,
        purchaseOrders: pos,
        workOrders: wos,
        payments,
        phases,
        timeline: timelineResult.data || [],
        procurementTimeline: projectProcurementTimeline
      });
      console.log('[useProjectExecution] Data loaded - POs:', pos.length, 'WOs:', wos.length, 'MatReqs:', materialRequests.length, 'WorkReqs:', workRequests.length);
    } catch (error) {
      console.error('Error fetching execution data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Fetch on mount and when projectId changes
  useEffect(() => {
    if (projectId && projectId !== currentProjectIdRef.current) {
      currentProjectIdRef.current = projectId;
      fetchSummary();
    } else if (!projectId) {
      setSummary(null);
      setDetails(null);
      setIsLoading(false);
    }
  }, [projectId, fetchSummary]);

  // Set up real-time subscriptions for all related data
  useEffect(() => {
    if (!projectId) return;

    console.log('[useProjectExecution] Setting up real-time subscriptions for:', projectId);

    const handleUpdate = (table: string) => (payload: any) => {
      console.log(`[useProjectExecution] ${table} updated:`, payload.eventType);
      fetchSummary();
    };

    const channels = [
      supabase.channel(`exec-boq-${projectId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'project_boq', filter: `project_id=eq.${projectId}` }, handleUpdate('project_boq'))
        .subscribe((status) => console.log('[useProjectExecution] BOQ subscription:', status)),
      supabase.channel(`exec-po-${projectId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders', filter: `project_id=eq.${projectId}` }, handleUpdate('purchase_orders'))
        .subscribe((status) => console.log('[useProjectExecution] PO subscription:', status)),
      supabase.channel(`exec-wo-${projectId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders', filter: `project_id=eq.${projectId}` }, handleUpdate('work_orders'))
        .subscribe((status) => console.log('[useProjectExecution] WO subscription:', status)),
      supabase.channel(`exec-payments-${projectId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests', filter: `project_id=eq.${projectId}` }, handleUpdate('payment_requests'))
        .subscribe((status) => console.log('[useProjectExecution] Payments subscription:', status)),
      supabase.channel(`exec-phases-${projectId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'project_phases', filter: `project_id=eq.${projectId}` }, handleUpdate('project_phases'))
        .subscribe(),
      supabase.channel(`exec-material-${projectId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'material_requests', filter: `project_id=eq.${projectId}` }, handleUpdate('material_requests'))
        .subscribe((status) => console.log('[useProjectExecution] Material requests subscription:', status)),
      supabase.channel(`exec-vendor-work-${projectId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_work_requests', filter: `project_id=eq.${projectId}` }, handleUpdate('vendor_work_requests'))
        .subscribe((status) => console.log('[useProjectExecution] Work requests subscription:', status)),
      supabase.channel(`exec-project-${projectId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, handleUpdate('projects'))
        .subscribe(),
    ];

    return () => {
      console.log('[useProjectExecution] Cleaning up subscriptions for:', projectId);
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [projectId, fetchSummary]);

  return {
    summary,
    details,
    isLoading,
    refetch: fetchSummary
  };
}

export function useAllProjectsExecution() {
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);

  // Use proper useRef for debounce timer
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProjects = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setIsLoading(true);
      } else {
        setIsRefetching(true);
      }

      // Fetch all data in parallel with optimized single queries
      const [projectsRes, boqData, poData, woData, paymentData, variationsData] = await Promise.all([
        supabase
          .from('projects')
          .select(`
            *,
            vertical:project_verticals(id, name, code, icon, color, category),
            manager:profiles!projects_assigned_manager_id_fkey(name),
            engineer:profiles!projects_assigned_engineer_id_fkey(name)
          `)
          .order('created_at', { ascending: false }),
        // Get all BOQ items
        supabase.from('project_boq').select('project_id'),
        // Get all Purchase Orders
        supabase.from('purchase_orders').select('project_id'),
        // Get all Work Orders
        supabase.from('work_orders').select('project_id'),
        // Get all Payments
        supabase.from('payment_requests').select('project_id, amount, status'),
        // Get all Variations (additions/deductions)
        supabase.from('project_variations' as any).select('project_id, type, amount, status')
      ]);

      if (projectsRes.error) throw projectsRes.error;

      // Create lookup maps for counts (more efficient than N+1 queries)
      const boqCountMap = new Map<string, number>();
      (boqData.data || []).forEach(item => {
        boqCountMap.set(item.project_id, (boqCountMap.get(item.project_id) || 0) + 1);
      });

      const poCountMap = new Map<string, number>();
      (poData.data || []).forEach(item => {
        poCountMap.set(item.project_id, (poCountMap.get(item.project_id) || 0) + 1);
      });

      const woCountMap = new Map<string, number>();
      (woData.data || []).forEach(item => {
        woCountMap.set(item.project_id, (woCountMap.get(item.project_id) || 0) + 1);
      });

      const paymentStatsMap = new Map<string, { paid: number; pending: number }>();
      (paymentData.data || []).forEach(item => {
        const existing = paymentStatsMap.get(item.project_id) || { paid: 0, pending: 0 };
        const amount = Number(item.amount) || 0;
        if (item.status === 'paid') {
          existing.paid += amount;
        } else if (['pending', 'admin_approved', 'ceo_approved'].includes(item.status)) {
          existing.pending += amount;
        }
        paymentStatsMap.set(item.project_id, existing);
      });

      // Variations lookup: additions and deductions (only approved ones)
      const variationsMap = new Map<string, { additions: number; deductions: number }>();
      ((variationsData.data as any[]) || []).forEach((item: any) => {
        const existing = variationsMap.get(item.project_id) || { additions: 0, deductions: 0 };
        const amount = Number(item.amount) || 0;
        if (item.status === 'approved') {
          if (item.type === 'addition') {
            existing.additions += amount;
          } else if (item.type === 'deduction') {
            existing.deductions += amount;
          }
        }
        variationsMap.set(item.project_id, existing);
      });

      // Merge with projects
      const projectsWithCounts = (projectsRes.data || []).map(project => {
        const baseValue = Number(project.total_project_value) || Number(project.approved_budget) || 0;
        const additions = variationsMap.get(project.id)?.additions || 0;
        const deductions = variationsMap.get(project.id)?.deductions || 0;
        const netValue = baseValue + additions - deductions;
        return {
          ...project,
          boq_count: boqCountMap.get(project.id) || 0,
          po_count: poCountMap.get(project.id) || 0,
          wo_count: woCountMap.get(project.id) || 0,
          total_paid: paymentStatsMap.get(project.id)?.paid || 0,
          pending_payments: paymentStatsMap.get(project.id)?.pending || 0,
          total_additions: additions,
          total_deductions: deductions,
          net_contract_value: netValue
        };
      });

      setProjects(projectsWithCounts);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects(true);

    // Debounced refetch function for real-time updates
    const handleRealtimeUpdate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        console.log('[Sourcing Dashboard] Real-time update triggered');
        fetchProjects(false);
      }, 300);
    };

    // Set up real-time subscriptions for ALL related tables
    const projectsChannel = supabase
      .channel('sourcing-projects-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
        console.log('[Realtime] Projects changed:', payload.eventType);
        handleRealtimeUpdate();
      })
      .subscribe();

    const boqChannel = supabase
      .channel('sourcing-boq-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_boq' }, (payload) => {
        console.log('[Realtime] BOQ changed:', payload.eventType);
        handleRealtimeUpdate();
      })
      .subscribe();

    const poChannel = supabase
      .channel('sourcing-po-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, (payload) => {
        console.log('[Realtime] PO changed:', payload.eventType);
        handleRealtimeUpdate();
      })
      .subscribe();

    const woChannel = supabase
      .channel('sourcing-wo-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, (payload) => {
        console.log('[Realtime] WO changed:', payload.eventType);
        handleRealtimeUpdate();
      })
      .subscribe();

    const paymentsChannel = supabase
      .channel('sourcing-payments-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, (payload) => {
        console.log('[Realtime] Payments changed:', payload.eventType);
        handleRealtimeUpdate();
      })
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(projectsChannel);
      supabase.removeChannel(boqChannel);
      supabase.removeChannel(poChannel);
      supabase.removeChannel(woChannel);
      supabase.removeChannel(paymentsChannel);
    };
  }, [fetchProjects]);

  return { projects, isLoading, isRefetching, refetch: () => fetchProjects(false) };
}
