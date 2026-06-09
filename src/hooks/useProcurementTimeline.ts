import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface TimelineEntry {
  id: string;
  material_request_id: string | null;
  vendor_work_request_id: string | null;
  action: string;
  performed_by: string | null;
  performed_by_name: string | null;
  details: any;
  created_at: string;
}

export function useProcurementTimeline(materialRequestId?: string, vendorWorkRequestId?: string) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTimeline = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      let query = supabase
        .from('procurement_timeline')
        .select('*')
        .order('created_at', { ascending: false });

      if (materialRequestId) {
        query = query.eq('material_request_id', materialRequestId);
      }

      if (vendorWorkRequestId) {
        query = query.eq('vendor_work_request_id', vendorWorkRequestId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEntries(data || []);
    } catch (error: any) {
      console.error('Error fetching procurement timeline:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (materialRequestId || vendorWorkRequestId) {
      fetchTimeline();
    }
  }, [user, materialRequestId, vendorWorkRequestId]);

  const addEntry = async (data: {
    material_request_id?: string;
    vendor_work_request_id?: string;
    action: string;
    details?: any;
  }) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('procurement_timeline')
        .insert({
          ...data,
          performed_by: user.id,
          performed_by_name: user.name,
        });

      if (error) throw error;
      await fetchTimeline();
    } catch (error: any) {
      console.error('Error adding timeline entry:', error);
    }
  };

  return {
    entries,
    isLoading,
    addEntry,
    refetch: fetchTimeline,
  };
}
