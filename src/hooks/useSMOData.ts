import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SMOEscalation {
  id: string;
  ticket_number: number;
  client_name: string;
  client_phone?: string;
  issue_title: string;
  issue_description: string;
  department: string;
  priority: string;
  status: string;
  current_owner: string;
  current_level?: string;
  assigned_role?: string;
  created_at: string;
  ack_deadline: string;
  resolve_deadline: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  ack_late?: boolean;
  resolved_at?: string;
  resolution_text?: string;
  resolution_evidence_url?: string;
  forwarded_to_gm_at?: string;
  pushed_to_ceo_at?: string;
  gm_ack_at?: string;
  creator?: {
    name: string;
    email: string;
    department: string;
  };
}

export interface SMOCritical {
  id: string;
  ticket_number: number;
  issue_title: string;
  issue_description: string;
  issue_type: string;
  department: string;
  status: string;
  proof_url: string;
  assigned_role?: string;
  current_owner?: string;
  created_at: string;
  ack_deadline: string;
  resolve_deadline: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  ack_late?: boolean;
  resolved_at?: string;
  resolution_text?: string;
  blast_triggered_at?: string;
  blast_notified_gm?: boolean;
  blast_notified_admin?: boolean;
  blast_notified_ceo?: boolean;
  creator?: {
    name: string;
    email: string;
  };
}

export interface SMOProject {
  id: string;
  project_id: string;
  project_name: string;
  client_name: string;
  vertical: string;
  status: string;
  current_spend: number;
  total_project_value: number; // Added to fix type error
  target_start_date: string;
  target_completion_date: string;
}

export interface SMOTask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  progress_percentage: number;
  due_date: string;
  assigned_to: string;
  assigned_by: string;
  assignee?: {
    name: string;
    department: string;
  };
}

/** @deprecated Use useEscalationEngine instead */
export function useSMOEscalations() {
  const [escalations, setEscalations] = useState<SMOEscalation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEscalations = useCallback(async () => {
    const { data, error } = await supabase
      .from('client_escalations')
      .select(`*, creator:profiles!client_escalations_created_by_fkey(name, email, department)`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setEscalations(data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchEscalations();

    const channel = supabase
      .channel('smo-escalations-hook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_escalations' }, (payload) => {
        console.log('[SMO] Escalation realtime update:', payload.eventType);
        fetchEscalations();
      })
      .subscribe((status) => {
        console.log('[SMO] Escalations channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEscalations]);

  return { escalations, isLoading, refetch: fetchEscalations };
}

/** @deprecated Use useEscalationEngine instead */
export function useSMOCriticals() {
  const [criticals, setCriticals] = useState<SMOCritical[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCriticals = useCallback(async () => {
    const { data, error } = await supabase
      .from('hourly_criticals')
      .select(`*, creator:profiles!hourly_criticals_created_by_fkey(name, email)`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCriticals(data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCriticals();

    const channel = supabase
      .channel('smo-criticals-hook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hourly_criticals' }, (payload) => {
        console.log('[SMO] Critical realtime update:', payload.eventType);
        fetchCriticals();
      })
      .subscribe((status) => {
        console.log('[SMO] Criticals channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCriticals]);

  return { criticals, isLoading, refetch: fetchCriticals };
}

export function useSMOProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<SMOProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!user?.id) return;

    // Fetch projects where the user is assigned in any capacity
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .or(`assigned_manager_id.eq.${user.id},assigned_engineer_id.eq.${user.id},assigned_site_manager_id.eq.${user.id},assigned_project_engineer_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProjects(data);
    }
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchProjects();

    // Set up real-time subscriptions for projects and related tables
    const projectChannel = supabase
      .channel('smo-projects-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
        console.log('[SMO] Project realtime update:', payload.eventType);
        fetchProjects();
      })
      .subscribe();

    // Listen to changes in metrics-influencing tables
    const metricsChannel = supabase
      .channel('smo-metrics-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, () => fetchProjects())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, () => fetchProjects())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_boq' }, () => fetchProjects())
      .subscribe();

    return () => {
      supabase.removeChannel(projectChannel);
      supabase.removeChannel(metricsChannel);
    };
  }, [fetchProjects]);

  return { projects, isLoading, refetch: fetchProjects };
}

export function useSMOTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<SMOTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('task_assignments')
      .select('*, assignee:profiles!task_assignments_assigned_to_fkey(name, department)')
      .or(`assigned_to.eq.${user.id},assigned_by.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTasks(data);
    }
    setIsLoading(false);
  }, [user?.id]);

  const updateTaskStatus = async (taskId: string, status: string, progress: number) => {
    const { error } = await supabase
      .from('task_assignments')
      .update({ status, progress_percentage: progress, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (!error) {
      fetchTasks();
    }
    return { error };
  };

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel('smo-tasks-hook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignments' }, (payload) => {
        console.log('[SMO] Task realtime update:', payload.eventType);
        fetchTasks();
      })
      .subscribe((status) => {
        console.log('[SMO] Tasks channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  return { tasks, isLoading, refetch: fetchTasks, updateTaskStatus };
}

/** @deprecated Use useEscalationEngine instead */
export function useTicketActions() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const acknowledgeTicket = async (ticketId: string, ticketType: 'escalation' | 'critical') => {
    setIsSaving(true);
    const tableName = ticketType === 'escalation' ? 'client_escalations' : 'hourly_criticals';

    const { error } = await supabase
      .from(tableName)
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user?.id,
        status: 'acknowledged',
      })
      .eq('id', ticketId);

    setIsSaving(false);
    return { error };
  };

  const resolveTicket = async (
    ticketId: string,
    ticketType: 'escalation' | 'critical',
    resolutionText: string,
    proofUrl: string
  ) => {
    setIsSaving(true);
    const tableName = ticketType === 'escalation' ? 'client_escalations' : 'hourly_criticals';

    const { error } = await supabase
      .from(tableName)
      .update({
        status: 'resolved',
        resolution_text: resolutionText,
        resolution_evidence_url: proofUrl,
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id,
      })
      .eq('id', ticketId);

    setIsSaving(false);
    return { error };
  };

  return { acknowledgeTicket, resolveTicket, isSaving };
}
