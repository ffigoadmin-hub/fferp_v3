import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

export interface ExtraWorkEntry {
  id: string;
  user_id: string;
  date: string;
  time_slot: string;
  work_type: 'assigned' | 'done';
  description: string;
  proof_url: string | null;
  created_at: string;
}

export function useExtraWorkEntries(date: Date) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ExtraWorkEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const dateStr = format(date, 'yyyy-MM-dd');

  const fetchEntries = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('extra_work_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setEntries((data as ExtraWorkEntry[]) || []);
    } catch (error) {
      console.error('Error fetching extra work entries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [user, dateStr]);

  const addEntry = async (
    timeSlot: string,
    workType: 'assigned' | 'done',
    description: string,
    proofUrl?: string
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    
    setIsSaving(true);
    
    try {
      const { data, error } = await supabase
        .from('extra_work_entries')
        .insert({
          user_id: user.id,
          date: dateStr,
          time_slot: timeSlot,
          work_type: workType,
          description,
          proof_url: proofUrl || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding extra work entry:', error);
        throw error;
      }

      setEntries(prev => [...prev, data as ExtraWorkEntry]);
      toast.success('Extra work entry added');
      
      return { success: true, data };
    } catch (error) {
      console.error('Error adding entry:', error);
      toast.error('Failed to add extra work entry');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('extra_work_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Entry deleted');
      return { success: true };
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to delete entry');
      return { success: false, error };
    }
  };

  const getEntriesForSlot = (timeSlot: string) => {
    return entries.filter(e => e.time_slot === timeSlot);
  };

  return {
    entries,
    isLoading,
    isSaving,
    addEntry,
    deleteEntry,
    getEntriesForSlot,
    refetch: fetchEntries,
  };
}
