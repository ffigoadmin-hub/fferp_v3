import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface GMOProject {
  id: string;
  project_id: string;
  project_name: string;
  client_name: string;
  client_contact: string;
  vertical: string;
  status: string;
  current_spend: number;
  target_start_date: string;
  target_completion_date: string;
  location_city: string;
  location_state: string;
  assigned_engineer_id?: string;
  assigned_manager_id?: string;
}

export interface GMOEscalation {
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
  assigned_role?: string;
  created_at: string;
  ack_deadline: string;
  resolve_deadline: string;
  acknowledged_at?: string;
  resolved_at?: string;
  resolution_text?: string;
  resolution_evidence_url?: string;
  resolution_image_url?: string;
  resolution_audio_url?: string;
  creator?: {
    name: string;
    email: string;
    department: string;
  };
}

export interface GMOCritical {
  id: string;
  ticket_number: number;
  issue_title: string;
  issue_description: string;
  issue_type: string;
  department: string;
  status: string;
  proof_url: string;
  assigned_role?: string;
  created_at: string;
  ack_deadline: string;
  resolve_deadline: string;
  acknowledged_at?: string;
  resolved_at?: string;
  resolution_text?: string;
  resolution_image_url?: string;
  resolution_audio_url?: string;
  creator?: {
    name: string;
    email: string;
  };
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
}

export function useGMOProjects() {
  const [projects, setProjects] = useState<GMOProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProjects(data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();

    const channel = supabase
      .channel('gmo-projects-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
        console.log('[GMO] Project realtime update:', payload.eventType);
        fetchProjects();
      })
      .subscribe();

    // Listen to changes in metrics-influencing tables for real-time dashboard data
    const metricsChannel = supabase
      .channel('gmo-metrics-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, () => fetchProjects())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, () => fetchProjects())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_boq' }, () => fetchProjects())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(metricsChannel);
    };
  }, [fetchProjects]);

  return { projects, isLoading, refetch: fetchProjects };
}

/** @deprecated Use useEscalationEngine instead */
export function useGMOEscalations() {
  const [escalations, setEscalations] = useState<GMOEscalation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEscalations = useCallback(async () => {
    const { data, error } = await supabase
      .from('client_escalations')
      .select(`*, 
        creator:profiles!client_escalations_created_by_fkey(name, email, department),
        acknowledger:profiles!client_escalations_acknowledged_by_fkey(name, email)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setEscalations(data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchEscalations();

    const channel = supabase
      .channel('gmo-escalations-hook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_escalations' }, (payload) => {
        console.log('[GMO] Escalation realtime update:', payload.eventType);
        fetchEscalations();
      })
      .subscribe((status) => {
        console.log('[GMO] Escalations channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEscalations]);

  return { escalations, isLoading, refetch: fetchEscalations };
}

/** @deprecated Use useEscalationEngine instead */
export function useGMOCriticals() {
  const [criticals, setCriticals] = useState<GMOCritical[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCriticals = useCallback(async () => {
    const { data, error } = await supabase
      .from('hourly_criticals')
      .select(`*, 
        creator:profiles!hourly_criticals_created_by_fkey(name, email),
        acknowledger:profiles!hourly_criticals_acknowledged_by_fkey(name, email)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCriticals(data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCriticals();

    const channel = supabase
      .channel('gmo-criticals-hook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hourly_criticals' }, (payload) => {
        console.log('[GMO] Critical realtime update:', payload.eventType);
        fetchCriticals();
      })
      .subscribe((status) => {
        console.log('[GMO] Criticals channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCriticals]);

  return { criticals, isLoading, refetch: fetchCriticals };
}

export function useFieldStaffEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEmployees = useCallback(async () => {
    // GMO can only assign to Agri & Engineering staff
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, department, role')
      .eq('is_active', true)
      .or('department.ilike.%Agri%,department.ilike.%Engineering%,department.ilike.%Civil%,role.ilike.%SMO%')
      .order('name');

    if (!error && data) {
      setEmployees(data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  return { employees, isLoading, refetch: fetchEmployees };
}

/** @deprecated Use useEscalationEngine instead */
export function useGMOTicketActions() {
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
