import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface VendorSourcingLog {
  id: string;
  user_id: string;
  date: string;
  vendors_added: number;
  states_covered: string[];
  cities_covered: string[];
  work_types_covered: string[];
  summary_notes: string | null;
  submitted_at: string;
}

export interface TodaySourcingStats {
  vendorsAdded: number;
  statesCovered: string[];
  citiesCovered: string[];
  workTypesCovered: string[];
  hasSubmittedEOD: boolean;
}

export function useVendorSourcingLog() {
  const [todayStats, setTodayStats] = useState<TodaySourcingStats>({
    vendorsAdded: 0,
    statesCovered: [],
    citiesCovered: [],
    workTypesCovered: [],
    hasSubmittedEOD: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchTodayStats = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];

      // Check if EOD is already submitted
      const { data: eodLog } = await supabase
        .from('vendor_sourcing_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      // Get today's vendors added by this user
      const { data: todayVendors } = await supabase
        .from('vendor_master')
        .select('state, city, work_types')
        .eq('sourced_by', user.id)
        .eq('sourced_on', today);

      const states = new Set<string>();
      const cities = new Set<string>();
      const workTypes = new Set<string>();

      todayVendors?.forEach((v: any) => {
        if (v.state) states.add(v.state);
        if (v.city) cities.add(v.city);
        v.work_types?.forEach((wt: string) => workTypes.add(wt));
      });

      setTodayStats({
        vendorsAdded: todayVendors?.length || 0,
        statesCovered: Array.from(states),
        citiesCovered: Array.from(cities),
        workTypesCovered: Array.from(workTypes),
        hasSubmittedEOD: !!eodLog,
      });
    } catch (error: any) {
      console.error('Error fetching today stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const submitEOD = async (summaryNotes: string) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from('vendor_sourcing_logs')
        .upsert({
          user_id: user.id,
          date: today,
          vendors_added: todayStats.vendorsAdded,
          states_covered: todayStats.statesCovered,
          cities_covered: todayStats.citiesCovered,
          work_types_covered: todayStats.workTypesCovered,
          summary_notes: summaryNotes,
          submitted_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,date'
        });

      if (error) throw error;

      toast({
        title: 'EOD Submitted',
        description: 'Your daily sourcing summary has been recorded.',
      });

      await fetchTodayStats();
    } catch (error: any) {
      toast({
        title: 'Error submitting EOD',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getMyLogs = async (days: number = 7): Promise<VendorSourcingLog[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('vendor_sourcing_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;
      return data as VendorSourcingLog[];
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      return [];
    }
  };

  useEffect(() => {
    fetchTodayStats();
  }, []);

  return {
    todayStats,
    isLoading,
    isSaving,
    fetchTodayStats,
    submitEOD,
    getMyLogs,
    refetch: fetchTodayStats,
  };
}
