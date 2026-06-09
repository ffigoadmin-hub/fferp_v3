/** @deprecated Use useEscalationEngine instead */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  ClientEscalation,
  CreateClientEscalationInput,
  WorkflowTimelineEntry,
} from '@/types/workflows';

export function useClientEscalations() {
  const { user } = useAuth();
  const [escalations, setEscalations] = useState<ClientEscalation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchEscalations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('client_escalations')
        .select(`
          *,
          creator:profiles!client_escalations_created_by_fkey(name, email),
          acknowledger:profiles!client_escalations_acknowledged_by_fkey(name, email),
          resolver:profiles!client_escalations_resolved_by_fkey(name, email),
          gm:profiles!client_escalations_gm_id_fkey(name, email),
          ceo:profiles!client_escalations_ceo_id_fkey(name, email),
          project:projects(*),
          site_visit_target:profiles!client_escalations_site_visit_target_id_fkey(name, email),
          assigned_layer_1:profiles!client_escalations_assigned_layer_1_id_fkey(name, email),
          assigned_layer_2:profiles!client_escalations_assigned_layer_2_id_fkey(name, email),
          assigned_layer_3:profiles!client_escalations_assigned_layer_3_id_fkey(name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEscalations((data as unknown as ClientEscalation[]) || []);
    } catch (error) {
      console.error('Error fetching client escalations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEscalations();

    const channel = supabase
      .channel('client-escalations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'client_escalations' },
        () => fetchEscalations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEscalations]);

  const createEscalation = async (input: CreateClientEscalationInput) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    // MANDATORY: Evidence is required when raising escalation
    if (!input.evidence_url && !input.escalation_proof_url) {
      toast.error('Evidence/Proof is required to raise an escalation');
      return { success: false, error: 'Evidence required' };
    }

    setIsSaving(true);
    try {
      // REPEAT TICKET DETECTION: Check for existing resolved escalations with same client_phone + department
      let parentEscalationId: string | null = null;
      let isRepeat = false;
      let repeatCount = 0;

      if (input.client_phone && (input.escalation_type as string) !== 'site_visit') {
        const { data: existingResolved } = await supabase
          .from('client_escalations')
          .select('id, issue_title, resolved_at, repeat_count')
          .eq('client_phone', input.client_phone)
          .eq('department', input.department)
          .eq('status', 'resolved')
          .order('resolved_at', { ascending: false })
          .limit(1);

        if (existingResolved && existingResolved.length > 0) {
          parentEscalationId = existingResolved[0].id;
          isRepeat = true;
          repeatCount = (existingResolved[0].repeat_count || 0) + 1;
          console.log(`🔄 Repeat ticket detected! Parent: ${parentEscalationId}, Count: ${repeatCount}`);
        }
      }

      const insertData: any = {
        created_by: user.id,
        department: input.department,
        client_name: input.client_name || 'N/A', // Ensure not null
        client_phone: input.client_phone,
        issue_title: input.issue_title,
        issue_description: input.issue_description,
        resolution_evidence_url: input.evidence_url,
        escalation_proof_url: input.escalation_proof_url || input.evidence_url, // Consistency
        issue_proof_url: input.escalation_proof_url || input.evidence_url, // For site visit consistency
        call_record_url: input.call_record_url, // NEW: Mandatory call record
        priority: input.priority || 'high',
        urgency: (input as any).urgency || 'medium',
        project_id: input.project_id || null, // Ensure valid UUID or null
        bucket: input.bucket,
        escalation_type: input.escalation_type || 'client',
        raised_by_rsh_id: (input.escalation_type as string) === 'site_visit' ? user.id : null,
        site_visit_target_id: (input as any).site_visit_target_id || null,
      };

      // Add repeat ticket fields if applicable
      if (isRepeat && parentEscalationId) {
        insertData.parent_escalation_id = parentEscalationId;
        insertData.is_repeat = true;
        insertData.repeat_count = repeatCount;
      }

      const { data, error } = await supabase
        .from('client_escalations')
        .insert(insertData)
        .select(`
          *,
          creator:profiles!client_escalations_created_by_fkey(name, email),
          acknowledger:profiles!client_escalations_acknowledged_by_fkey(name, email),
          resolver:profiles!client_escalations_resolved_by_fkey(name, email),
          gm:profiles!client_escalations_gm_id_fkey(name, email),
          ceo:profiles!client_escalations_ceo_id_fkey(name, email)
        `)
        .single();

      if (error) throw error;

      const message = isRepeat
        ? `⚠️ Repeat escalation created (${repeatCount}${repeatCount === 1 ? 'st' : repeatCount === 2 ? 'nd' : 'rd'} occurrence) - SLA timer started`
        : 'Escalation created successfully - SLA timer started';
      toast.success(message);
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

  // BOI can assign escalation to GMO/SMO after acknowledging
  const assignToResolver = async (id: string, assignedRole: 'gmo' | 'smo', resolverId?: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      const updateData: any = {
        assigned_role: assignedRole.toUpperCase(),
        current_owner: assignedRole,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('client_escalations')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Add timeline entry
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', user.id)
        .single();

      await supabase.from('client_escalation_timeline').insert({
        escalation_id: id,
        action: `assigned_to_${assignedRole}`,
        performed_by: user.id,
        performed_by_name: profile?.name || user.name,
        performed_by_role: profile?.role || user.role,
        details: { assigned_role: assignedRole.toUpperCase(), message: `Assigned to ${assignedRole.toUpperCase()} for resolution` },
      });

      toast.success(`Assigned to ${assignedRole.toUpperCase()} for resolution`);
      await fetchEscalations();
      return { success: true };
    } catch (error: any) {
      console.error('Error assigning escalation:', error);
      toast.error(error.message || 'Failed to assign');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const acknowledgeEscalation = async (id: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    const escalation = escalations.find(e => e.id === id);
    if (!escalation) return { success: false, error: 'Escalation not found' };

    const isLate = new Date() > new Date(escalation.ack_deadline);

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('client_escalations')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user.id,
          ack_late: isLate,
          status: 'acknowledged',
        })
        .eq('id', id);

      if (error) throw error;

      toast.success(isLate ? 'Acknowledged (LATE)' : 'Acknowledged successfully');
      await fetchEscalations();
      return { success: true };
    } catch (error: any) {
      console.error('Error acknowledging:', error);
      toast.error(error.message || 'Failed to acknowledge');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const resolveEscalation = async (
    id: string,
    resolutionText: string,
    evidenceUrl?: string,
    screenshotUrls?: string[],
    audioUrl?: string
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    // Optimistic UI update - remove from active views immediately
    setEscalations(prev => prev.map(e =>
      e.id === id ? { ...e, status: 'pending_closure_approval', resolved_at: new Date().toISOString(), resolved_by: user.id } : e
    ));

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('client_escalations')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          resolution_text: resolutionText,
          resolution_evidence_url: evidenceUrl,
          // MODULE 1: Save new resolution proof columns
          resolution_image_url: screenshotUrls && screenshotUrls.length > 0 ? screenshotUrls.join(',') : null,
          resolution_proof_screenshot_urls: screenshotUrls && screenshotUrls.length > 0 ? screenshotUrls : null,
          resolution_audio_url: audioUrl || null,
          resolution_proof_audio_url: audioUrl || null,
          call_record_url: audioUrl || null,
          status: 'pending_closure_approval',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Escalation resolved');
      return { success: true };
    } catch (error: any) {
      console.error('Error resolving:', error);
      toast.error(error.message || 'Failed to resolve');
      // Revert optimistic update on error
      await fetchEscalations();
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const forwardToGM = async (id: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('client_escalations')
        .update({
          forwarded_to_gm_at: new Date().toISOString(),
          status: 'escalated_gm',
          current_owner: 'gm',
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Forwarded to GM');
      await fetchEscalations();
      return { success: true };
    } catch (error: any) {
      console.error('Error forwarding to GM:', error);
      toast.error(error.message || 'Failed to forward');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const gmAcknowledge = async (id: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    const escalation = escalations.find(e => e.id === id);
    if (!escalation) return { success: false, error: 'Escalation not found' };

    // GM has 10 min from forwarding to acknowledge
    const gmAckDeadline = new Date(new Date(escalation.forwarded_to_gm_at!).getTime() + 10 * 60 * 1000);
    const isLate = new Date() > gmAckDeadline;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('client_escalations')
        .update({
          gm_id: user.id,
          gm_ack_at: new Date().toISOString(),
          gm_ack_late: isLate,
        })
        .eq('id', id);

      if (error) throw error;

      toast.success(isLate ? 'GM Acknowledged (LATE)' : 'GM Acknowledged');
      await fetchEscalations();
      return { success: true };
    } catch (error: any) {
      console.error('Error GM acknowledging:', error);
      toast.error(error.message || 'Failed to acknowledge');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const gmResolve = async (id: string, resolutionText: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    // Optimistic UI update
    setEscalations(prev => prev.map(e =>
      e.id === id ? { ...e, status: 'resolved', gm_resolved_at: new Date().toISOString(), gm_id: user.id } : e
    ));

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('client_escalations')
        .update({
          gm_id: user.id,
          gm_resolved_at: new Date().toISOString(),
          gm_resolution_text: resolutionText,
          status: 'resolved',
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('GM resolved escalation');
      return { success: true };
    } catch (error: any) {
      console.error('Error GM resolving:', error);
      toast.error(error.message || 'Failed to resolve');
      await fetchEscalations();
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const pushToCEO = async (id: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('client_escalations')
        .update({
          pushed_to_ceo_at: new Date().toISOString(),
          status: 'escalated_ceo',
          current_owner: 'ceo',
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Pushed to CEO');
      await fetchEscalations();
      return { success: true };
    } catch (error: any) {
      console.error('Error pushing to CEO:', error);
      toast.error(error.message || 'Failed to push to CEO');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const addFollowup = async (id: string, note: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      // Add timeline entry for followup
      const { error } = await supabase
        .from('client_escalation_timeline')
        .insert({
          escalation_id: id,
          action: 'followup_added',
          performed_by: user.id,
          performed_by_name: user.name,
          performed_by_role: user.role,
          details: { note },
        });

      if (error) throw error;

      toast.success('Followup note added');
      return { success: true };
    } catch (error: any) {
      console.error('Error adding followup:', error);
      toast.error(error.message || 'Failed to add followup');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const addComment = async (id: string, comment: string, audioUrl?: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      const details: any = { comment };
      if (audioUrl) {
        details.audioUrl = audioUrl;
      }

      const { error } = await supabase
        .from('client_escalation_timeline')
        .insert({
          escalation_id: id,
          action: audioUrl ? 'voice_comment' : 'comment_added',
          performed_by: user.id,
          performed_by_name: user.name,
          performed_by_role: user.role,
          details,
        });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast.error(error.message || 'Failed to add comment');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const verifyAndCloseEscalation = async (id: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    if (user.role.toLowerCase() !== 'admin') {
      toast.error('Verification required by Admin Audit');
      return { success: false, error: 'Unauthorized' };
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('client_escalations')
        .update({
          status: 'closed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Add timeline entry
      await supabase.from('client_escalation_timeline').insert({
        escalation_id: id,
        action: 'admin_verified_and_closed',
        performed_by: user.id,
        performed_by_name: user.name,
        performed_by_role: user.role,
        details: { message: 'Admin verified the proof and closed the ticket.' },
      });

      toast.success('Ticket closed successfully after Admin verification');
      await fetchEscalations();
      return { success: true };
    } catch (error: any) {
      console.error('Error closing escalation:', error);
      toast.error(error.message || 'Failed to close ticket');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const rejectResolutionProof = async (id: string, reason: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    if (user.role.toLowerCase() !== 'admin') {
      toast.error('Only Admin can reject proofs');
      return { success: false, error: 'Unauthorized' };
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('client_escalations')
        .update({
          status: 'acknowledged', // Revert to Follow-up/Updates
          rejection_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Add timeline entry
      await supabase.from('client_escalation_timeline').insert({
        escalation_id: id,
        action: 'admin_rejected_proof',
        performed_by: user.id,
        performed_by_name: user.name,
        performed_by_role: user.role,
        details: { rejection_reason: reason, message: `Proof rejected by Admin: ${reason}` },
      });

      toast.warning('Proof rejected. Ticket reverted to Follow-up/Updates.');
      await fetchEscalations();
      return { success: true };
    } catch (error: any) {
      console.error('Error rejecting proof:', error);
      toast.error(error.message || 'Failed to reject proof');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered views - strictly exclude resolved/closed from active views
  const activeEscalations = escalations.filter(e => !['resolved', 'closed'].includes(e.status));
  const openEscalations = activeEscalations.filter(e => e.status === 'open');
  const acknowledgedEscalations = activeEscalations.filter(e => e.status === 'acknowledged' || e.status === 'in_progress');
  const gmEscalations = activeEscalations.filter(e => e.status === 'escalated_gm');
  const ceoEscalations = activeEscalations.filter(e => e.status === 'escalated_ceo');
  const resolvedEscalations = escalations.filter(e => e.status === 'resolved' || e.status === 'closed');

  return {
    escalations,
    activeEscalations,
    openEscalations,
    acknowledgedEscalations,
    gmEscalations,
    ceoEscalations,
    resolvedEscalations,
    isLoading,
    isSaving,
    createEscalation,
    acknowledgeEscalation,
    resolveEscalation,
    forwardToGM,
    gmAcknowledge,
    gmResolve,
    pushToCEO,
    addFollowup,
    addComment,
    verifyAndCloseEscalation,
    rejectResolutionProof,
    assignToResolver, // NEW: BOI can assign to GMO/SMO
    refetch: fetchEscalations,
  };
}

export function useClientEscalationTimeline(escalationId: string | null) {
  const [timeline, setTimeline] = useState<WorkflowTimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!escalationId) return;

    const fetchTimeline = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('client_escalation_timeline')
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

    const channel = supabase
      .channel(`client-esc-timeline-${escalationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'client_escalation_timeline',
          filter: `escalation_id=eq.${escalationId}`,
        },
        () => fetchTimeline()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [escalationId]);

  return { timeline, isLoading };
}
