import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

export interface HourlyPlanData {
  id: string;
  time_slot: string;
  plan_text: string;
  status: string;
  submitted_at: string;
}

export function useHourlyPlans(date: Date) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<HourlyPlanData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const dateStr = format(date, 'yyyy-MM-dd');

  const fetchPlans = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('hourly_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .order('time_slot', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching hourly plans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [user, dateStr]);

  const submitPlan = async (
    timeSlot: string,
    planText: string,
    selectedTaskIndices: number[]
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    
    setIsSaving(true);
    
    try {
      // Check if plan already exists
      const existingPlan = plans.find(p => p.time_slot === timeSlot);
      
      if (existingPlan) {
        return { success: false, error: 'Plan already submitted for this slot' };
      }

      // Store task indices in plan_text as JSON for linking
      const planData = {
        tasks: selectedTaskIndices,
        notes: planText
      };

      const { data, error } = await supabase
        .from('hourly_plans')
        .insert({
          user_id: user.id,
          date: dateStr,
          time_slot: timeSlot,
          plan_text: JSON.stringify(planData),
          status: 'locked',
        })
        .select()
        .single();

      if (error) {
        console.error('Error submitting hourly plan:', error);
        throw error;
      }

      setPlans(prev => [...prev, data]);
      toast.success('Hourly plan locked successfully');
      
      return { success: true, data };
    } catch (error) {
      console.error('Error submitting plan:', error);
      toast.error('Failed to submit plan');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const getPlanForSlot = (timeSlot: string) => {
    return plans.find(p => p.time_slot === timeSlot);
  };

  const getParsedPlan = (timeSlot: string): { tasks: number[]; notes: string } | null => {
    const plan = getPlanForSlot(timeSlot);
    if (!plan) return null;
    
    try {
      return JSON.parse(plan.plan_text);
    } catch {
      return { tasks: [], notes: plan.plan_text };
    }
  };

  return {
    plans,
    isLoading,
    isSaving,
    submitPlan,
    getPlanForSlot,
    getParsedPlan,
    refetch: fetchPlans,
  };
}
