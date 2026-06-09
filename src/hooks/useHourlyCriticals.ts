/** @deprecated Use useEscalationEngine instead */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  HourlyCritical,
  CreateHourlyCriticalInput,
  WorkflowTimelineEntry,
  isValidProofUrl,
} from '@/types/workflows';

export function useHourlyCriticals() {
  const { user } = useAuth();
  const [criticals, setCriticals] = useState<HourlyCritical[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchCriticals = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('hourly_criticals')
        .select(`
          *,
          creator:profiles!hourly_criticals_created_by_fkey(name, email),
          acknowledger:profiles!hourly_criticals_acknowledged_by_fkey(name, email),
          resolver:profiles!hourly_criticals_resolved_by_fkey(name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCriticals((data as unknown as HourlyCritical[]) || []);
    } catch (error) {
      console.error('Error fetching hourly criticals:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCriticals();

    const channel = supabase
      .channel('hourly-criticals-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hourly_criticals' },
        () => fetchCriticals()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCriticals]);

  const createCritical = async (input: CreateHourlyCriticalInput) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    if (!isValidProofUrl(input.proof_url)) {
      toast.error('Proof URL must be a valid Google Drive/Docs/Sheets link');
      return { success: false, error: 'Invalid proof URL' };
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('hourly_criticals')
        .insert({
          created_by: user.id,
          department: input.department,
          issue_type: input.issue_type || 'general', // Free text now
          issue_title: input.issue_title,
          issue_description: input.issue_description,
          proof_url: input.proof_url,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Hourly critical created - 45min SLA timer started');
      await fetchCriticals();
      return { success: true, data };
    } catch (error: any) {
      console.error('Error creating hourly critical:', error);
      toast.error(error.message || 'Failed to create critical');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const acknowledgeCritical = async (id: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    const critical = criticals.find(c => c.id === id);
    if (!critical) return { success: false, error: 'Critical not found' };

    const isLate = new Date() > new Date(critical.ack_deadline);

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('hourly_criticals')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user.id,
          ack_late: isLate,
          status: 'acknowledged',
        })
        .eq('id', id);

      if (error) throw error;

      toast.success(isLate ? 'Acknowledged (LATE)' : 'Acknowledged successfully');
      await fetchCriticals();
      return { success: true };
    } catch (error: any) {
      console.error('Error acknowledging:', error);
      toast.error(error.message || 'Failed to acknowledge');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const resolveCritical = async (
    id: string,
    resolutionText: string,
    evidenceUrl?: string,
    screenshotUrls?: string[],
    audioUrl?: string
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    // Validate evidence URL is a Google Drive link if provided
    if (evidenceUrl && !isValidProofUrl(evidenceUrl)) {
      toast.error('Evidence URL must be a valid Google Drive/Docs/Sheets link');
      return { success: false, error: 'Invalid evidence URL' };
    }

    // Optimistic UI update - remove from active views immediately
    setCriticals(prev => prev.map(c =>
      c.id === id ? { ...c, status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: user.id } : c
    ));

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('hourly_criticals')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          resolution_text: resolutionText,
          proof_url: evidenceUrl || undefined,
          // MODULE 1: Save new resolution proof columns
          resolution_image_url: screenshotUrls && screenshotUrls.length > 0 ? screenshotUrls.join(',') : null,
          resolution_audio_url: audioUrl || null,
          status: 'resolved',
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Critical resolved');
      return { success: true };
    } catch (error: any) {
      console.error('Error resolving:', error);
      toast.error(error.message || 'Failed to resolve');
      // Revert optimistic update on error
      await fetchCriticals();
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const triggerBlast = async (id: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('hourly_criticals')
        .update({
          blast_triggered_at: new Date().toISOString(),
          blast_notified_gm: true,
          blast_notified_admin: true,
          blast_notified_ceo: true,
          status: 'breached',
        })
        .eq('id', id);

      if (error) throw error;

      toast.error('BLAST PROTOCOL TRIGGERED - GM, Admin, CEO notified');
      await fetchCriticals();
      return { success: true };
    } catch (error: any) {
      console.error('Error triggering blast:', error);
      toast.error(error.message || 'Failed to trigger blast');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered views - strictly exclude resolved/closed from active views
  const activeCriticals = criticals.filter(c => !['resolved', 'closed'].includes(c.status));
  const openCriticals = activeCriticals.filter(c => c.status === 'open');
  const acknowledgedCriticals = activeCriticals.filter(c => c.status === 'acknowledged' || c.status === 'in_progress');
  const breachedCriticals = activeCriticals.filter(c => c.status === 'breached' || c.blast_triggered_at);
  const resolvedCriticals = criticals.filter(c => c.status === 'resolved' || c.status === 'closed');

  return {
    criticals,
    activeCriticals,
    openCriticals,
    acknowledgedCriticals,
    breachedCriticals,
    resolvedCriticals,
    isLoading,
    isSaving,
    createCritical,
    acknowledgeCritical,
    resolveCritical,
    triggerBlast,
    refetch: fetchCriticals,
  };
}

export function useHourlyCriticalTimeline(criticalId: string | null) {
  const [timeline, setTimeline] = useState<WorkflowTimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!criticalId) return;

    const fetchTimeline = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('hourly_critical_timeline')
          .select('*')
          .eq('critical_id', criticalId)
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

    const channel = supabase
      .channel(`hourly-crit-timeline-${criticalId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hourly_critical_timeline',
          filter: `critical_id=eq.${criticalId}`,
        },
        () => fetchTimeline()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [criticalId]);

  return { timeline, isLoading };
}
