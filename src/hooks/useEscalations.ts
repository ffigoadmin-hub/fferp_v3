import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Escalation,
  EscalationTimelineEntry,
  CreateEscalationInput,
  ResolveEscalationInput,
  isValidGoogleDriveLink,
} from '@/types/escalations';

export function useEscalations() {
  const { user } = useAuth();
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchEscalations = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('escalations')
        .select(`
          *,
          project:projects(project_name, project_id),
          smo:profiles!escalations_smo_id_fkey(name, email),
          gm:profiles!escalations_gm_id_fkey(name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEscalations((data as unknown as Escalation[]) || []);
    } catch (error) {
      console.error('Error fetching escalations:', error);
      const _isMissing = (error as any)?.code === 'PGRST205' || (error as any)?.message?.includes('schema cache'); if (!_isMissing) if (!isMissingTable(error)) toast.error('Failed to fetch escalations');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEscalations();

    // Real-time subscription
    const channel = supabase
      .channel('escalations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'escalations',
        },
        () => {
          fetchEscalations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEscalations]);

  const createEscalation = async (input: CreateEscalationInput) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('escalations')
        .insert({
          customer_id: input.customer_id,
          customer_name: input.customer_name,
          customer_phone: input.customer_phone,
          project_id: input.project_id,
          complaint_text: input.complaint_text,
          complaint_source: input.complaint_source || 'whatsapp',
          site_evidence_url: input.site_evidence_url,
          vertical: input.vertical,
          smo_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Escalation logged successfully');
      await fetchEscalations();
      return { success: true, data };
    } catch (error: any) {
      console.error('Error creating escalation:', error);
      toast.error(error.message || 'Failed to create escalation');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const markAsViewed = async (escalationId: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('escalations')
        .update({
          gm_id: user.id,
          gm_viewed_at: new Date().toISOString(),
          status: 'gm_viewing',
        })
        .eq('id', escalationId)
        .eq('status', 'pending');

      if (error) throw error;

      await fetchEscalations();
      return { success: true };
    } catch (error: any) {
      console.error('Error marking as viewed:', error);
      return { success: false, error };
    }
  };

  const resolveEscalation = async (escalationId: string, input: ResolveEscalationInput) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    // Validate Google Drive link
    if (!isValidGoogleDriveLink(input.resolution_evidence_url)) {
      toast.error('Resolution evidence must be a Google Drive link');
      return { success: false, error: 'Invalid evidence URL' };
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('escalations')
        .update({
          gm_id: user.id,
          gm_resolved_at: new Date().toISOString(),
          resolution_text: input.resolution_text,
          resolution_evidence_url: input.resolution_evidence_url,
          status: 'resolved',
        })
        .eq('id', escalationId);

      if (error) throw error;

      toast.success('Escalation resolved successfully');
      await fetchEscalations();
      return { success: true };
    } catch (error: any) {
      console.error('Error resolving escalation:', error);
      toast.error(error.message || 'Failed to resolve escalation');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  // Get pending escalations for GM
  const pendingEscalations = escalations.filter(
    (e) => e.status === 'pending' || e.status === 'gm_viewing'
  );

  // Get breached escalations
  const breachedEscalations = escalations.filter((e) => e.sla_breached);

  return {
    escalations,
    pendingEscalations,
    breachedEscalations,
    isLoading,
    isSaving,
    createEscalation,
    markAsViewed,
    resolveEscalation,
    refetch: fetchEscalations,
  };
}

export function useEscalationTimeline(escalationId: string | null) {
  const [timeline, setTimeline] = useState<EscalationTimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!escalationId) return;

    const fetchTimeline = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('escalation_timeline')
          .select('*')
          .eq('escalation_id', escalationId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setTimeline(data || []);
      } catch (error) {
        console.error('Error fetching timeline:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimeline();

    // Real-time subscription
    const channel = supabase
      .channel(`timeline-${escalationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'escalation_timeline',
          filter: `escalation_id=eq.${escalationId}`,
        },
        () => {
          fetchTimeline();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [escalationId]);

  return { timeline, isLoading };
}
