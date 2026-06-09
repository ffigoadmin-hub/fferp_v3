import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface UnifiedTicket {
  id: string;
  ticket_number: number;
  source: 'NSM' | 'DATA' | 'SITE'; // NSM = client_escalations (client), DATA = hourly_criticals, SITE = client_escalations (site_visit)
  type: 'escalation' | 'critical' | 'site_visit';
  issue_title: string;
  issue_description: string;
  client_name?: string;
  department: string;
  status: string;
  priority?: string;
  priority_level?: 'P0' | 'P1' | 'P2' | 'P3';
  urgency?: string;
  created_by: string;
  current_level: 'L1_OPS' | 'L2_GM' | 'L3_CEO';
  current_owner: string;
  assigned_role?: string;
  project_id?: string;
  project?: { project_name: string; client_name: string; onboarded_date?: string; location_city?: string; location_state?: string };
  is_war_room?: boolean;
  war_room_url?: string;
  reminder_count?: number;
  tags?: string[];
  is_overdue?: boolean;

  // Timing
  created_at: string;
  ack_deadline: string;
  resolve_deadline: string;
  acknowledged_at?: string;
  resolved_at?: string;
  ack_late?: boolean;

  // Level transitions
  forwarded_to_gm_at?: string;
  pushed_to_ceo_at?: string;
  blast_triggered_at?: string;

  // Relations
  creator?: { name: string; email: string; department?: string; role: string };
  acknowledger?: { name: string; email: string };
  resolver?: { name: string; email: string };
  gm?: { name: string; email: string };
  assigned_user?: { name: string; email: string; department?: string };
  site_visit_target?: { name: string; email: string };

  // Evidence
  proof_url?: string;
  evidence_url?: string;
  site_evidence_url?: string;
  escalation_proof_url?: string;
  call_record_url?: string;
  proof_screenshot_urls?: string[];
  resolution_evidence_url?: string;
  resolution_image_url?: string;
  resolution_audio_url?: string;
  resolution_proof_screenshot_urls?: string[];
  issue_proof_url?: string;

  // Raw data for actions
  raw: any;
}

export interface EscalationCounts {
  active: number;
  l1_ops: number;
  l2_gm: number;
  l3_ceo: number;
  breached: number;
  pending_audit: number;
  closed: number;
  // Granular Metrics
  escalationActive: number;
  escalationAudit: number;
  escalationClosed: number;
  criticalActive: number;
  criticalAudit: number;
  criticalClosed: number;
  siteVisitActive: number;
  siteVisitAudit: number;
  siteVisitClosed: number;
}

export interface UseRealtimeEscalationsOptions {
  startDate?: string;
  endDate?: string;
  userId?: string;
  role?: string;
  limit?: number;
  bypassFiltering?: boolean;
}

export function useRealtimeEscalations(options?: UseRealtimeEscalationsOptions) {
  const { startDate, endDate, userId, role, limit = 1000, bypassFiltering = false } = options || {};
  const [unifiedTickets, setUnifiedTickets] = useState<UnifiedTicket[]>([]);
  const [counts, setCounts] = useState<EscalationCounts>({
    active: 0,
    l1_ops: 0,
    l2_gm: 0,
    l3_ceo: 0,
    breached: 0,
    pending_audit: 0,
    closed: 0,
    escalationActive: 0,
    escalationAudit: 0,
    escalationClosed: 0,
    criticalActive: 0,
    criticalAudit: 0,
    criticalClosed: 0,
    siteVisitActive: 0,
    siteVisitAudit: 0,
    siteVisitClosed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Track previous IDs for new ticket detection
  const previousIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  const { user } = useAuth();
  const effectiveUserId = userId || user?.id;
  const effectiveRole = role || user?.role;

  // Determine current level based on ticket state (L1, L2, L3)
  const determineLevel = (ticket: any): 'L1_OPS' | 'L2_GM' | 'L3_CEO' | null => {
    if (ticket.status === 'closed') return null;
    if (ticket.pushed_to_ceo_at || ticket.current_layer === 3) return 'L3_CEO';
    if (ticket.forwarded_to_gm_at || ticket.current_layer === 2) return 'L2_GM';
    return 'L1_OPS';
  };

  // Transform escalation to unified format
  const transformEscalation = (esc: any): UnifiedTicket => {
    const isSiteVisit = esc.escalation_type === 'site_visit';
    // Determine assigned user from various possible fields
    const assignedUser = esc.assigned_to_profile ||
      esc.assigned_user_profile ||
      esc.assigned_layer_1 ||
      esc.assigned_layer_2 ||
      esc.assigned_layer_3 ||
      (esc.assigned_user_id ? { name: esc.assigned_user_names?.[0] || 'Unknown', email: '' } : undefined);

    return {
      id: esc.id,
      ticket_number: esc.ticket_number,
      created_by: esc.created_by,
      source: isSiteVisit ? 'SITE' : 'NSM',
      type: isSiteVisit ? 'site_visit' : 'escalation',
      issue_title: esc.issue_title,
      issue_description: esc.issue_description,
      client_name: esc.client_name,
      department: esc.department || 'unknown',
      status: esc.status,
      priority: esc.priority,
      urgency: esc.urgency,
      current_level: determineLevel(esc),
      current_owner: esc.current_owner || 'solver',
      assigned_role: esc.assigned_role,
      project_id: esc.project_id,
      project: esc.project,
      created_at: esc.created_at,
      ack_deadline: esc.ack_deadline || new Date(new Date(esc.created_at).getTime() + 2 * 60 * 60 * 1000).toISOString(), // Fallback
      resolve_deadline: esc.resolve_deadline || new Date(new Date(esc.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
      acknowledged_at: esc.acknowledged_at,
      resolved_at: esc.resolved_at,
      ack_late: esc.ack_late,
      forwarded_to_gm_at: esc.forwarded_to_gm_at,
      pushed_to_ceo_at: esc.pushed_to_ceo_at,
      blast_triggered_at: undefined, // Only for criticals
      creator: esc.creator,
      acknowledger: esc.acknowledger,
      resolver: esc.resolver,
      gm: esc.gm,
      assigned_user: assignedUser,
      site_visit_target: esc.site_visit_target,

      // Evidence Mapping
      proof_url: esc.proof_url,
      evidence_url: esc.evidence_url,
      site_evidence_url: esc.site_evidence_url,
      escalation_proof_url: esc.escalation_proof_url,
      call_record_url: esc.call_record_url,
      proof_screenshot_urls: esc.proof_screenshot_urls,
      resolution_evidence_url: esc.resolution_evidence_url,
      resolution_image_url: esc.resolution_image_url,
      resolution_audio_url: esc.resolution_audio_url,
      resolution_proof_screenshot_urls: esc.resolution_proof_screenshot_urls,
      issue_proof_url: esc.issue_proof_url,
      priority_level: esc.priority_level,
      is_war_room: esc.is_war_room,
      reminder_count: esc.reminder_count,
      tags: esc.tags,
      is_overdue: esc.is_overdue,
      raw: {
        ...esc,
        assigned_user: assignedUser
      },
    };
  };

  // Transform critical to unified format
  const transformCritical = (crit: any): UnifiedTicket => ({
    id: crit.id,
    ticket_number: crit.ticket_number,
    created_by: crit.created_by,
    source: 'DATA',
    type: 'critical',
    issue_title: crit.issue_title,
    issue_description: crit.issue_description,
    department: crit.department || 'unknown',
    status: crit.status,
    current_level: determineLevel(crit),
    current_owner: crit.current_owner || 'solver',
    assigned_role: crit.assigned_role,
    project_id: crit.project_id,
    project: crit.project,
    created_at: crit.created_at,
    ack_deadline: crit.ack_deadline,
    resolve_deadline: crit.resolve_deadline,
    acknowledged_at: crit.acknowledged_at,
    resolved_at: crit.resolved_at,
    ack_late: crit.ack_late,
    blast_triggered_at: crit.blast_triggered_at,
    creator: crit.creator,
    acknowledger: crit.acknowledger,
    resolver: crit.resolver,
    assigned_user: (crit as any).assigned_user_profile,

    // Evidence Mapping
    proof_url: crit.proof_url || crit.evidence_url,
    resolution_evidence_url: crit.resolution_evidence_url || crit.resolution_image_url,
    resolution_audio_url: crit.resolution_audio_url,
    resolution_proof_screenshot_urls: crit.resolution_proof_screenshot_urls,
    priority_level: 'P0', // Criticals are always P0
    raw: {
      ...crit,
      assigned_user: (crit as any).assigned_user_profile
    },
  });

  const fetchData = useCallback(async () => {
    try {
      // Build query for NSM Escalations & Site Visits (All in client_escalations)
      let escQuery = (supabase as any)
        .from('client_escalations')
        .select(`
          *,
          creator:profiles!client_escalations_created_by_fkey(name, email, department, role),
          acknowledger:profiles!client_escalations_acknowledged_by_fkey(name, email),
          resolver:profiles!client_escalations_resolved_by_fkey(name, email),
          gm:profiles!client_escalations_gm_id_fkey(name, email),
          assigned_to_profile:profiles!client_escalations_assigned_to_fkey(name, email, department),
          assigned_user_profile:profiles!client_escalations_assigned_user_id_fkey(name, email, department),
          project:projects(project_name, client_name, onboarded_date, location_city, location_state),
          site_visit_target:profiles!client_escalations_site_visit_target_id_fkey(name, email),
          assigned_layer_1:profiles!client_escalations_assigned_layer_1_id_fkey(name, email),
          assigned_layer_2:profiles!client_escalations_assigned_layer_2_id_fkey(name, email),
          assigned_layer_3:profiles!client_escalations_assigned_layer_3_id_fkey(name, email)
        `);

      // Build query for Data Criticals
      let critQuery = (supabase as any)
        .from('hourly_criticals')
        .select(`
          *,
          creator:profiles!hourly_criticals_created_by_fkey(name, email, role),
          acknowledger:profiles!hourly_criticals_acknowledged_by_fkey(name, email),
          resolver:profiles!hourly_criticals_resolved_by_fkey(name, email),
          assigned_user_profile:profiles!hourly_criticals_assigned_user_id_fkey(name, email, department),
          project:projects(project_name, client_name, onboarded_date, location_city, location_state)
        `);

      // Apply date filters if provided
      if (startDate) {
        escQuery = escQuery.gte('created_at', startDate);
        critQuery = critQuery.gte('created_at', startDate);
      }
      if (endDate) {
        const endDay = endDate + 'T23:59:59.999Z';
        escQuery = escQuery.lte('created_at', endDay);
        critQuery = critQuery.lte('created_at', endDay);
      }

      // Apply role/user filters for performance
      const bypassFilterRoles = ['admin', 'ceo', 'gm', 'boi', 'auditor', 'bd_data', 'datateam', 'data_team', 'data', 'gmo', 'director'];
      const currentRole = effectiveRole?.toLowerCase() || '';
      const currentDept = user?.department?.toLowerCase() || '';
      
      const isAuditorOrSpecialRole = bypassFilterRoles.includes(currentRole) || (currentRole === 'employee' && currentDept === 'engineering');
      const shouldFilter = !bypassFiltering && effectiveUserId && !isAuditorOrSpecialRole;

      if (shouldFilter) {
        escQuery = escQuery.eq('created_by', effectiveUserId);
        critQuery = critQuery.eq('created_by', effectiveUserId);
      }

      const [escRes, critRes] = await Promise.all([
        escQuery.order('created_at', { ascending: false }).limit(limit),
        critQuery.order('created_at', { ascending: false }).limit(limit),
      ]);

      // Gracefully handle missing IGO-Chain tables (PGRST205 = table not in schema cache)
      // In FFERPv2 these tables don't exist — return empty data instead of crashing.
      const escTableMissing = escRes.error?.code === 'PGRST205' || escRes.error?.message?.includes('schema cache');
      const critTableMissing = critRes.error?.code === 'PGRST205' || critRes.error?.message?.includes('schema cache');
      if (escTableMissing || critTableMissing) {
        setUnifiedTickets([]);
        setIsLoading(false);
        return;
      }
      if (escRes.error) throw escRes.error;
      if (critRes.error) throw critRes.error;

      // Transform all to unified format
      const transformedEsc = (escRes.data || []).map(transformEscalation);
      const transformedCrit = (critRes.data || []).map(transformCritical);

      // Merge and sort by created_at (newest first)
      const combined = [...transformedEsc, ...transformedCrit].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Check for new tickets (not on first load)
      if (!isFirstLoadRef.current) {
        const currentIds = new Set(combined.map(t => t.id));
        const newTickets = combined.filter(t => !previousIdsRef.current.has(t.id));

        if (newTickets.length > 0) {
          const newest = newTickets[0];
          let typeLabel = 'Escalation';
          if (newest.type === 'critical') typeLabel = 'Critical';
          if (newest.type === 'site_visit') typeLabel = 'Site Visit Escalation';

          toast.info(
            `New ${typeLabel}: ${newest.issue_title}`,
            { duration: 5000 }
          );
        }

        previousIdsRef.current = currentIds;
      } else {
        previousIdsRef.current = new Set(combined.map(t => t.id));
        isFirstLoadRef.current = false;
      }

      setUnifiedTickets(combined);

      // Calculate counts
      const escList = (escRes.data || []) as any[];
      const crtList = (critRes.data || []) as any[];

      // Separate client vs site visit for stats
      const clientEscs = escList.filter(e => e.escalation_type !== 'site_visit');
      const siteVisits = escList.filter(e => e.escalation_type === 'site_visit');

      const escActive = clientEscs.filter(t => t.status !== 'closed' && t.status !== 'resolved' && t.status !== 'pending_closure_approval').length;
      const escAudit = clientEscs.filter(t => t.status === 'resolved' || t.status === 'pending_closure_approval').length;
      const escClosed = clientEscs.filter(t => t.status === 'closed').length;

      const crtActive = crtList.filter(t => t.status !== 'closed' && t.status !== 'resolved' && t.status !== 'pending_closure_approval').length;
      const crtAudit = crtList.filter(t => t.status === 'resolved' || t.status === 'pending_closure_approval').length;
      const crtClosed = crtList.filter(t => t.status === 'closed').length;

      const svActive = siteVisits.filter(t => t.status !== 'closed' && t.status !== 'resolved' && t.status !== 'pending_closure_approval').length;
      const svAudit = siteVisits.filter(t => t.status === 'resolved' || t.status === 'pending_closure_approval').length;
      const svClosed = siteVisits.filter(t => t.status === 'closed').length;

      const active = combined.filter(t => t.status !== 'closed' && t.status !== 'resolved' && t.status !== 'pending_closure_approval').length;
      const l1 = combined.filter(t => t.current_level === 'L1_OPS').length;
      const l2 = combined.filter(t => t.current_level === 'L2_GM').length;
      const l3 = combined.filter(t => t.current_level === 'L3_CEO').length;
      const pending_audit = combined.filter(t => t.status === 'pending_closure_approval' || t.status === 'resolved').length;
      const closed = combined.filter(t => t.status === 'closed').length;
      const breached = combined.filter(t =>
        t.ack_late ||
        t.status === 'breached' ||
        (t as any).blast_triggered_at
      ).length;

      setCounts({
        active,
        l1_ops: l1,
        l2_gm: l2,
        l3_ceo: l3,
        breached,
        pending_audit,
        closed,
        escalationActive: escActive,
        escalationAudit: escAudit,
        escalationClosed: escClosed,
        criticalActive: crtActive,
        criticalAudit: crtAudit,
        criticalClosed: crtClosed,
        siteVisitActive: svActive,
        siteVisitAudit: svAudit,
        siteVisitClosed: svClosed,
      });

      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Error fetching escalations:', error);
      // Don't show toast for missing tables (FFERPv2 doesn't have IGO-Chain tables)
      const isMissingTable = error?.code === 'PGRST205' || error?.message?.includes('schema cache');
      const isNetworkError = error.message?.includes('fetch') || error.message?.includes('NetworkError');
      if (!isMissingTable && !isNetworkError) {
        const msg = error.message || 'Check console for sync details';
        toast.error('Sync Error: ' + msg);
      } else if (isNetworkError) {
        console.warn('[Sync] Background fetch failed (Network)');
      }
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, effectiveUserId, effectiveRole, user?.department, limit]);

  useEffect(() => {
    let isSubscribed = true;
    fetchData(); // Initial load

    // Listen for changes
    const channel = supabase
      .channel('global-escalation-tracker')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'client_escalations' },
        (payload) => {
          if (!isSubscribed) return;
          console.log('Realtime update received (client_escalations):', payload);
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hourly_criticals' },
        (payload) => {
          if (!isSubscribed) return;
          console.log('Realtime update received (hourly_criticals):', payload);
          fetchData();
        }
      )
      .subscribe((status) => {
        if (!isSubscribed) return;
        console.log('Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to escalation changes');
        }
      });

    // MODULE 5: Re-enable polling as fallback
    const interval = setInterval(() => {
      if (isSubscribed) fetchData();
    }, 15000); // Poll every 15s

    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchData]);

  // Filter helpers
  const l1Tickets = unifiedTickets.filter(t => t.current_level === 'L1_OPS');
  const l2Tickets = unifiedTickets.filter(t => t.current_level === 'L2_GM');
  const l3Tickets = unifiedTickets.filter(t => t.current_level === 'L3_CEO');
  const breachedTickets = unifiedTickets.filter(t =>
    t.ack_late ||
    t.status === 'breached' ||
    t.blast_triggered_at ||
    new Date() > new Date(t.resolve_deadline)
  );

  return {
    unifiedTickets,
    counts,
    isLoading,
    lastUpdated,
    l1Tickets,
    l2Tickets,
    l3Tickets,
    breachedTickets,
    refetch: fetchData,
  };
}
