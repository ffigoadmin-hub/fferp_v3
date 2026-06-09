import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Milestone {
  id: string;
  project_id: string;
  phase_id: string | null;
  milestone_name: string;
  description: string | null;
  planned_date: string;
  actual_date: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  completion_percentage: number;
  created_at: string;
  created_by: string | null;
}

export interface DeviationRequest {
  id: string;
  milestone_id: string;
  project_id: string;
  requested_by: string;
  original_date: string;
  new_proposed_date: string;
  reason: string;
  proof_url: string | null;
  status: 'pending_smo' | 'pending_gmo' | 'pending_ceo' | 'approved' | 'rejected';
  smo_reviewed_at: string | null;
  smo_reviewed_by: string | null;
  smo_remarks: string | null;
  gmo_reviewed_at: string | null;
  gmo_reviewed_by: string | null;
  gmo_remarks: string | null;
  ceo_reviewed_at: string | null;
  ceo_reviewed_by: string | null;
  ceo_remarks: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export function useMilestones(projectId: string) {
  const { user } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const instanceId = useRef(Math.random().toString(36).slice(2, 8));

  const fetchMilestones = async () => {
    if (!projectId) return;
    try {
      const { data, error } = await supabase
        .from('project_milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('planned_date', { ascending: true });

      if (error) throw error;
      setMilestones((data || []) as Milestone[]);
    } catch (error) {
      console.error('Error fetching milestones:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMilestones();

    // Set up real-time subscription for milestones (unique channel per hook instance)
    if (!projectId) return;

    const channel = supabase
      .channel(`milestones-rt-${projectId}-${instanceId.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_milestones', filter: `project_id=eq.${projectId}` }, () => {
        fetchMilestones();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const addMilestone = async (milestone: Omit<Milestone, 'id' | 'created_at' | 'created_by'>) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('project_milestones')
        .insert({
          ...milestone,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      setMilestones(prev => [...prev, data as Milestone].sort((a, b) =>
        new Date(a.planned_date).getTime() - new Date(b.planned_date).getTime()
      ));
      toast.success('Milestone added');
      return { success: true, data };
    } catch (error: any) {
      toast.error(error.message || 'Failed to add milestone');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const updateMilestone = async (id: string, updates: Partial<Milestone>) => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('project_milestones')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setMilestones(prev => prev.map(m => m.id === id ? data as Milestone : m));
      toast.success('Milestone updated');
      return { success: true, data };
    } catch (error: any) {
      toast.error(error.message || 'Failed to update milestone');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const deleteMilestone = async (id: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('project_milestones')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMilestones(prev => prev.filter(m => m.id !== id));
      toast.success('Milestone deleted');
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete milestone');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  return {
    milestones,
    isLoading,
    isSaving,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    refetch: fetchMilestones,
  };
}

export function useDeviationRequests(projectId?: string, milestoneId?: string) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<DeviationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const instanceId = useRef(Math.random().toString(36).slice(2, 8));

  const fetchRequests = async () => {
    try {
      let query = supabase
        .from('milestone_deviation_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectId) query = query.eq('project_id', projectId);
      if (milestoneId) query = query.eq('milestone_id', milestoneId);

      const { data, error } = await query;
      if (error) throw error;
      setRequests((data || []) as DeviationRequest[]);
    } catch (error) {
      console.error('Error fetching deviation requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    // Set up real-time subscription (unique channel per hook instance)
    const channel = supabase
      .channel(`deviations-rt-${projectId || 'all'}-${instanceId.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestone_deviation_requests' }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, milestoneId]);

  const createRequest = async (data: {
    milestone_id: string;
    project_id: string;
    original_date: string;
    new_proposed_date: string;
    reason: string;
    proof_url?: string;
  }) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      const { data: result, error } = await supabase
        .from('milestone_deviation_requests')
        .insert({
          ...data,
          requested_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      setRequests(prev => [result as DeviationRequest, ...prev]);
      toast.success('Deviation request submitted for approval');
      return { success: true, data: result };
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit request');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const approveRequest = async (id: string, role: 'smo' | 'gmo' | 'ceo', remarks?: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      const request = requests.find(r => r.id === id);
      if (!request) throw new Error('Request not found');

      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (role === 'smo') {
        updates.smo_reviewed_at = new Date().toISOString();
        updates.smo_reviewed_by = user.id;
        updates.smo_remarks = remarks;
        updates.status = 'pending_gmo';
      } else if (role === 'gmo') {
        updates.gmo_reviewed_at = new Date().toISOString();
        updates.gmo_reviewed_by = user.id;
        updates.gmo_remarks = remarks;
        updates.status = 'pending_ceo';
      } else if (role === 'ceo') {
        updates.ceo_reviewed_at = new Date().toISOString();
        updates.ceo_reviewed_by = user.id;
        updates.ceo_remarks = remarks;
        updates.status = 'approved';

        // Update the milestone with new date
        await supabase
          .from('project_milestones')
          .update({
            planned_date: request.new_proposed_date,
            updated_at: new Date().toISOString(),
          })
          .eq('id', request.milestone_id);
      }

      const { data, error } = await supabase
        .from('milestone_deviation_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setRequests(prev => prev.map(r => r.id === id ? data as DeviationRequest : r));
      toast.success(`Deviation ${role === 'ceo' ? 'approved' : 'forwarded'} successfully`);
      return { success: true, data };
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const rejectRequest = async (id: string, reason: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('milestone_deviation_requests')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setRequests(prev => prev.map(r => r.id === id ? data as DeviationRequest : r));
      toast.success('Deviation request rejected');
      return { success: true, data };
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject');
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
    approveRequest,
    rejectRequest,
    refetch: fetchRequests,
  };
}
