import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface InventoryItem {
  id: string;
  project_id: string;
  phase_id: string | null;
  material_request_id: string | null;
  material_name: string;
  specification: string | null;
  unit: string;
  quantity_received: number;
  quantity_used: number;
  unit_price: number | null;
  audit_status: 'pending' | 'verified' | 'discrepancy';
  audited_by: string | null;
  audited_at: string | null;
  audit_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: { project_name: string; project_id: string };
  phase?: { phase_name: string };
}

export function useProjectInventory(projectId?: string) {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchItems = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      let query = supabase
        .from('project_inventory')
        .select(`
          *,
          project:projects(project_name, project_id),
          phase:project_phases(phase_name)
        `)
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setItems(data as InventoryItem[] || []);
    } catch (error: any) {
      console.error('Error fetching inventory:', error);
      if (!isMissingTable(error)) toast.error('Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();

    const channel = supabase
      .channel('inventory-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_inventory' },
        () => fetchItems()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, projectId]);

  const addInventoryItem = async (data: {
    project_id: string;
    phase_id?: string;
    material_request_id?: string;
    material_name: string;
    specification?: string;
    unit: string;
    quantity_received: number;
    unit_price?: number;
  }) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('project_inventory')
        .insert({
          ...data,
          audit_status: 'pending',
        });

      if (error) throw error;
      toast.success('Item added to inventory');
      await fetchItems();
    } catch (error: any) {
      console.error('Error adding inventory item:', error);
      toast.error('Failed to add inventory item');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const updateInventoryItem = async (id: string, updates: Partial<InventoryItem>) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('project_inventory')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      toast.success('Inventory updated');
      await fetchItems();
    } catch (error: any) {
      console.error('Error updating inventory:', error);
      toast.error('Failed to update inventory');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const verifyDelivery = async (id: string, notes?: string) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('project_inventory')
        .update({
          audit_status: 'verified',
          audited_by: user.id,
          audited_at: new Date().toISOString(),
          audit_notes: notes,
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Delivery verified and added to inventory');
      await fetchItems();
    } catch (error: any) {
      console.error('Error verifying delivery:', error);
      toast.error('Failed to verify delivery');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const flagDiscrepancy = async (id: string, notes: string) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('project_inventory')
        .update({
          audit_status: 'discrepancy',
          audited_by: user.id,
          audited_at: new Date().toISOString(),
          audit_notes: notes,
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Discrepancy flagged');
      await fetchItems();
    } catch (error: any) {
      console.error('Error flagging discrepancy:', error);
      toast.error('Failed to flag discrepancy');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const getBalance = (item: InventoryItem) => {
    return item.quantity_received - item.quantity_used;
  };

  return {
    items,
    isLoading,
    isSaving,
    addInventoryItem,
    updateInventoryItem,
    verifyDelivery,
    flagDiscrepancy,
    getBalance,
    refetch: fetchItems,
  };
}
