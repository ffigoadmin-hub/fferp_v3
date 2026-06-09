import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface BOQItem {
  id: string;
  project_id: string;
  phase_id: string | null;
  line_number: number;
  material_name: string;
  specification: string | null;
  quantity: number;
  unit: string;
  estimated_unit_cost: number | null;
  actual_unit_cost: number | null;
  actual_total: number | null;
  category: 'material' | 'labour' | 'equipment';
  sourced_via: 'po' | 'wo' | null;
  linked_po_id: string | null;
  linked_wo_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export function useBOQ(projectId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<BOQItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('project_boq')
        .select('*')
        .eq('project_id', projectId)
        .order('line_number', { ascending: true });

      if (error) throw error;
      setItems((data || []) as BOQItem[]);
    } catch (error) {
      console.error('Error fetching BOQ items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchItems();

    // Set up real-time subscription for BOQ items
    if (!projectId) return;

    const channel = supabase
      .channel(`boq-realtime-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_boq', filter: `project_id=eq.${projectId}` }, () => {
        fetchItems();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const addItem = async (item: Omit<BOQItem, 'id' | 'created_at' | 'created_by' | 'line_number'>) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      // Fetch current max line number from DB to avoid race conditions
      const { data: existingItems } = await supabase
        .from('project_boq')
        .select('line_number')
        .eq('project_id', projectId)
        .order('line_number', { ascending: false })
        .limit(1);

      const lineNumber = existingItems && existingItems.length > 0 ? existingItems[0].line_number + 1 : 1;

      const { data, error } = await supabase
        .from('project_boq')
        .insert({
          ...item,
          line_number: lineNumber,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      setItems(prev => [...prev, data as BOQItem]);
      toast.success('BOQ item added');
      return { success: true, data };
    } catch (error: any) {
      toast.error(error.message || 'Failed to add item');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const addItemsBulk = async (newItems: Omit<BOQItem, 'id' | 'created_at' | 'created_by' | 'line_number'>[]) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    if (newItems.length === 0) return { success: true, data: [] };

    setIsSaving(true);
    try {
      // Fetch current max line number from DB
      const { data: existingItems } = await supabase
        .from('project_boq')
        .select('line_number')
        .eq('project_id', projectId)
        .order('line_number', { ascending: false })
        .limit(1);

      const startLineNumber = existingItems && existingItems.length > 0 ? existingItems[0].line_number + 1 : 1;

      // Prepare all items with sequential line numbers
      const itemsToInsert = newItems.map((item, index) => ({
        ...item,
        line_number: startLineNumber + index,
        created_by: user.id,
      }));

      const { data, error } = await supabase
        .from('project_boq')
        .insert(itemsToInsert)
        .select();

      if (error) throw error;
      setItems(prev => [...prev, ...(data as BOQItem[])]);
      toast.success(`Added ${data.length} BOQ items`);
      return { success: true, data };
    } catch (error: any) {
      toast.error(error.message || 'Failed to add items');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const updateItem = async (id: string, updates: Partial<BOQItem>) => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('project_boq')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setItems(prev => prev.map(i => i.id === id ? data as BOQItem : i));
      toast.success('BOQ item updated');
      return { success: true, data };
    } catch (error: any) {
      toast.error(error.message || 'Failed to update item');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('project_boq')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('BOQ item deleted');
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete item');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  /* 
   * SUBMIT BOQ (Engineer -> SMO)
   * Transitions project to 'boq_submitted_smo'
   */
  const submitBOQ = async () => {
    if (!user) return { success: false, error: 'Not authenticated' };

    if (items.length === 0) {
      toast.error('Add at least one BOQ item before submitting');
      return { success: false, error: 'No items' };
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          lifecycle_stage: 'boq_submitted_smo',
          boq_submitted_at: new Date().toISOString(),
          boq_submitted_by: user.id,
          stage_boq_submitted_at: new Date().toISOString(),
          boq_rejection_reason: null, // Clear any previous rejection reasons
        })
        .eq('id', projectId);

      if (error) throw error;

      await supabase.from('project_timeline').insert({
        project_id: projectId,
        action: 'boq_submitted',
        performed_by: user.id,
        performed_by_name: user.name,
        performed_by_role: user.role,
        details: { item_count: items.length, total_estimated: totalEstimated, stage: 'L1 Approval (SMO)' },
      });

      invalidateQueries();
      toast.success('BOQ submitted for SMO approval');
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit BOQ');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  /* 
   * APPROVE BOQ (SMO -> GMO)
   * Transitions project to 'boq_submitted_gmo'
   */
  const approveBOQSmo = async () => {
    if (!user) return { success: false, error: 'Not authenticated' };
    
    if (items.length === 0) {
      toast.error('Cannot approve an empty BOQ. Please ensure materials are listed.');
      return { success: false, error: 'No items' };
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          lifecycle_stage: 'boq_submitted_gmo',
          // We can add a specific timestamp for SMO approval if schema supports it, otherwise use timeline
        })
        .eq('id', projectId);

      if (error) throw error;

      await supabase.from('project_timeline').insert({
        project_id: projectId,
        action: 'boq_approved_smo',
        performed_by: user.id,
        performed_by_name: user.name,
        performed_by_role: user.role,
        details: { stage: 'L2 Approval (GMO)' },
      });

      invalidateQueries();
      toast.success('BOQ approved and sent to GMO');
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve BOQ');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  /* 
   * APPROVE BOQ (GMO -> Approved)
   * Transitions project to 'boq_approved'
   */
  const approveBOQGmo = async () => {
    if (!user) return { success: false, error: 'Not authenticated' };

    if (items.length === 0) {
      toast.error('Cannot approve an empty BOQ. Please ensure materials are listed.');
      return { success: false, error: 'No items' };
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          lifecycle_stage: 'boq_approved',
          boq_approved_at: new Date().toISOString(),
          boq_approved_by: user.id,
          stage_boq_approved_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (error) throw error;

      await supabase.from('project_timeline').insert({
        project_id: projectId,
        action: 'boq_approved_gmo',
        performed_by: user.id,
        performed_by_name: user.name,
        performed_by_role: user.role,
        details: { stage: 'Approved' },
      });

      invalidateQueries();
      toast.success('BOQ finally approved');
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve BOQ');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  /* 
   * REJECT BOQ
   * Transitions project back to 'boq_draft' (or 'engineering_assigned')
   */
  const rejectBOQ = async (reason: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          lifecycle_stage: 'engineering_assigned', // Send back to drafting
          boq_rejection_reason: reason,
        })
        .eq('id', projectId);

      if (error) throw error;

      await supabase.from('project_timeline').insert({
        project_id: projectId,
        action: 'boq_rejected',
        performed_by: user.id,
        performed_by_name: user.name,
        performed_by_role: user.role,
        details: { reason },
      });

      invalidateQueries();
      toast.success('BOQ rejected and returned to engineer');
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject BOQ');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['boq-pending-approval'] });
    queryClient.invalidateQueries({ queryKey: ['engineering-projects-boq'] });
    queryClient.invalidateQueries({ queryKey: ['project-lifecycle', projectId] });
    queryClient.invalidateQueries({ queryKey: ['execution-summary', projectId] });
  };

  const totalEstimated = items.reduce((sum, i) => sum + (i.quantity * (i.estimated_unit_cost || 0)), 0);

  return {
    items,
    isLoading,
    isSaving,
    addItem,
    addItemsBulk,
    updateItem,
    deleteItem,
    submitBOQ,
    totalEstimated,
    refetch: fetchItems,
    approveBOQSmo,
    approveBOQGmo,
    rejectBOQ,
  };
}
