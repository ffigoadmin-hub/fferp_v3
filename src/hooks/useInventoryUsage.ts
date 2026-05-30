import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface UsageLog {
  id: string;
  inventory_id: string;
  project_id: string;
  log_date: string;
  quantity_used: number;
  purpose: string | null;
  logged_by: string;
  logged_by_name: string | null;
  created_at: string;
  // Joined fields
  inventory?: { material_name: string; unit: string };
}

export function useInventoryUsage(projectId?: string, inventoryId?: string) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchLogs = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      let query = supabase
        .from('inventory_usage_logs')
        .select(`
          *,
          inventory:project_inventory(material_name, unit)
        `)
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      if (inventoryId) {
        query = query.eq('inventory_id', inventoryId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data as UsageLog[] || []);
    } catch (error: any) {
      console.error('Error fetching usage logs:', error);
      if (!isMissingTable(error)) toast.error('Failed to load usage logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel('usage-logs-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_usage_logs' },
        () => fetchLogs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, projectId, inventoryId]);

  const logUsage = async (data: {
    inventory_id: string;
    project_id: string;
    quantity_used: number;
    purpose?: string;
    log_date?: string;
  }) => {
    if (!user) return;
    setIsSaving(true);

    try {
      // First, check available balance
      const { data: inventory, error: invError } = await supabase
        .from('project_inventory')
        .select('quantity_received, quantity_used, material_name')
        .eq('id', data.inventory_id)
        .single();

      if (invError) throw invError;

      const currentBalance = inventory.quantity_received - inventory.quantity_used;
      if (data.quantity_used > currentBalance) {
        toast.error(`Insufficient balance. Available: ${currentBalance}`);
        return false;
      }

      // Insert usage log
      const { error: logError } = await supabase
        .from('inventory_usage_logs')
        .insert({
          ...data,
          log_date: data.log_date || new Date().toISOString().split('T')[0],
          logged_by: user.id,
          logged_by_name: user.name,
        });

      if (logError) throw logError;

      // Update inventory quantity_used
      const { error: updateError } = await supabase
        .from('project_inventory')
        .update({
          quantity_used: inventory.quantity_used + data.quantity_used,
        })
        .eq('id', data.inventory_id);

      if (updateError) throw updateError;

      toast.success(`Usage logged: ${data.quantity_used} units of ${inventory.material_name}`);
      await fetchLogs();
      return true;
    } catch (error: any) {
      console.error('Error logging usage:', error);
      toast.error('Failed to log usage');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const getTodayUsage = (inventoryId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return logs
      .filter(l => l.inventory_id === inventoryId && l.log_date === today)
      .reduce((sum, l) => sum + l.quantity_used, 0);
  };

  return {
    logs,
    isLoading,
    isSaving,
    logUsage,
    getTodayUsage,
    refetch: fetchLogs,
  };
}
