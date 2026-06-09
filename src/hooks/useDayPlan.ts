import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

export interface DayPlanData {
  id: string;
  date: string;
  tasks: string[];
  expected_output: string;
  is_project_work: boolean;
  dependency: string | null;
  submitted_at: string;
}

export function useDayPlan(date: Date) {
  const { user } = useAuth();
  const [dayPlan, setDayPlan] = useState<DayPlanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const dateStr = format(date, 'yyyy-MM-dd');

  const fetchDayPlan = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('day_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .maybeSingle();

      if (error) throw error;
      setDayPlan(data);
    } catch (error) {
      console.error('Error fetching day plan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDayPlan();
  }, [user, dateStr]);

  const submitDayPlan = async (
    tasks: string[],
    expectedOutput: string,
    isProjectWork: boolean,
    dependency?: string
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    
    if (dayPlan) {
      return { success: false, error: 'Day plan already submitted' };
    }
    
    setIsSaving(true);
    
    try {
      const { data, error } = await supabase
        .from('day_plans')
        .insert({
          user_id: user.id,
          date: dateStr,
          tasks: tasks,
          expected_output: expectedOutput,
          is_project_work: isProjectWork,
          dependency: dependency || null,
        })
        .select()
        .single();

      if (error) throw error;

      setDayPlan(data);
      toast.success('Day plan locked successfully');
      
      return { success: true, data };
    } catch (error) {
      console.error('Error submitting day plan:', error);
      toast.error('Failed to submit day plan');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  return {
    dayPlan,
    isLoading,
    isSaving,
    hasPlan: !!dayPlan,
    submitDayPlan,
    refetch: fetchDayPlan,
  };
}
