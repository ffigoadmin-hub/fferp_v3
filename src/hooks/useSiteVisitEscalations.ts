import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SiteVisitEscalation, SiteVisitEscalationStatus, CreateSiteVisitEscalationInput, SiteVisitEscalationLayer } from '@/types/site-visit-escalations';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useSiteVisitEscalations() {
    const { user } = useAuth();
    const [escalations, setEscalations] = useState<SiteVisitEscalation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            fetchEscalations();
        }
    }, [user]);

    const fetchEscalations = async () => {
        try {
            setLoading(true);

            // Base query with joins - now using unified client_escalations table
            let query = (supabase as any)
                .from('client_escalations')
                .select(`
          *,
          raised_by:raised_by_rsh_id(name, email, role),
          site_visit_target:site_visit_target_id(name, email),
          assigned_layer_1:assigned_layer_1_id(name, email),
          assigned_layer_2:assigned_layer_2_id(name, email),
          assigned_layer_3:assigned_layer_3_id(name, email),
          assigned_by_boi:assigned_by_boi_id(name, email),
          resolved_by_user:resolved_by(name, email)
        `)
                .eq('escalation_type', 'site_visit') // Only fetch site visit escalations
                .order('created_at', { ascending: false });

            const { data, error } = await query;

            if (error) throw error;
            setEscalations(data as unknown as SiteVisitEscalation[]);
        } catch (err: any) {
            console.error('Error fetching site visit escalations:', err);
            setError(err.message);
            if (!isMissingTable(error)) toast.error('Failed to load escalations');
        } finally {
            setLoading(false);
        }
    };

    const createEscalation = async (input: CreateSiteVisitEscalationInput) => {
        try {
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await (supabase as any)
                .from('client_escalations')
                .insert({
                    created_by: user.id,
                    department: 'agri',
                    escalation_type: 'site_visit',
                    client_name: 'Site Visit Issue', // Required field - placeholder for site visit type
                    site_visit_target_id: input.site_visit_target_id,
                    issue_description: input.issue_description,
                    issue_title: `Site Visit Escalation`,
                    issue_proof_url: input.issue_proof_url,
                    status: 'open',
                    current_layer: 'layer_1'
                })
                .select()
                .single();

            if (error) throw error;

            // Fetch the complete row with joins to ensure UI doesn't break
            const { data: completeData, error: fetchError } = await (supabase as any)
                .from('client_escalations')
                .select(`
                  *,
                  raised_by:raised_by_rsh_id(name, email, role),
                  site_visit_target:site_visit_target_id(name, email),
                  assigned_layer_1:assigned_layer_1_id(name, email),
                  assigned_layer_2:assigned_layer_2_id(name, email),
                  assigned_layer_3:assigned_layer_3_id(name, email),
                  assigned_by_boi:assigned_by_boi_id(name, email),
                  resolved_by_user:resolved_by(name, email)
                `)
                .eq('id', data.id)
                .single();

            if (fetchError) throw fetchError;

            setEscalations(prev => [completeData as unknown as SiteVisitEscalation, ...prev]);
            toast.success('Escalation raised successfully');
            return completeData;
        } catch (err: any) {
            console.error('Error creating escalation:', err);
            toast.error('Failed to raise escalation: ' + err.message);
            throw err;
        }
    };

    const updateLayerAssignment = async (
        id: string,
        assignments: {
            assigned_layer_1_id?: string;
            assigned_layer_2_id?: string;
            assigned_layer_3_id?: string;
        }
    ) => {
        try {
            const { error } = await (supabase as any)
                .from('client_escalations')
                .update({
                    ...assignments,
                    assigned_by_boi_id: user?.id,
                    assigned_at: new Date().toISOString(),
                    status: 'in_progress' // Auto-move to in_progress on assignment if pending
                })
                .eq('id', id);

            if (error) throw error;

            await fetchEscalations(); // Refresh to get joined data
            toast.success('Assignments updated');
        } catch (err: any) {
            console.error('Error updating assignments:', err);
            toast.error('Failed to update assignments');
        }
    };

    const resolveEscalation = async (id: string, resolution_text: string, resolution_proof_url: string) => {
        try {
            const updates: any = {
                resolution_text,
                resolution_proof_url,
                resolved_by: user?.id,
                resolved_at: new Date().toISOString(),
                status: 'resolved'
            };

            const { error } = await (supabase as any)
                .from('client_escalations')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            setEscalations(prev => prev.map(e => e.id === id ? { ...e, ...updates, status: 'resolved' } : e));
            toast.success('Escalation resolved');
        } catch (err: any) {
            console.error('Error resolving escalation:', err);
            toast.error('Failed to resolve escalation');
        }
    };

    const escalateToNextLayer = async (id: string, nextLayer: SiteVisitEscalationLayer) => {
        try {
            const { error } = await (supabase as any)
                .from('client_escalations')
                .update({
                    current_layer: nextLayer,
                    status: 'escalated'
                })
                .eq('id', id);

            if (error) throw error;

            updateLocalStatus(id, { current_layer: nextLayer, status: 'escalated' });
            toast.success(`Escalated to ${nextLayer.replace('_', ' ')}`);
        } catch (err: any) {
            console.error('Error escalating:', err);
            toast.error('Failed to escalate');
        }
    };

    const closeEscalation = async (id: string) => {
        try {
            const { error } = await (supabase as any)
                .from('client_escalations')
                .update({
                    status: 'closed',
                    closed_by_admin_id: user?.id,
                    closure_verified_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;

            updateLocalStatus(id, { status: 'closed' });
            toast.success('Escalation closed');
        } catch (err: any) {
            console.error('Error closing escalation:', err);
            toast.error('Failed to close escalation');
        }
    };

    const updateLocalStatus = (id: string, updates: Partial<SiteVisitEscalation>) => {
        setEscalations(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    };

    return {
        escalations,
        loading,
        error,
        fetchEscalations,
        createEscalation,
        updateLayerAssignment,
        resolveEscalation,
        escalateToNextLayer,
        closeEscalation
    };
}
