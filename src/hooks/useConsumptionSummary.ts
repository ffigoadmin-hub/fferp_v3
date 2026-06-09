import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ConsumptionSummaryItem {
  project_id: string;
  inventory_id: string;
  material_name: string;
  unit: string;
  quantity_received: number;
  quantity_used: number;
  balance: number;
  unit_price: number | null;
  stock_value: number;
  today_usage: number;
  weekly_usage: number;
  days_remaining_estimate: number | null;
  audit_status: string;
  created_at: string;
  project_name: string;
}

export interface StockAlert {
  inventory_id: string;
  project_id: string;
  project_name: string;
  material_name: string;
  unit: string;
  balance: number;
  stock_percent: number;
  alert_type: 'out_of_stock' | 'critical' | 'low' | 'normal';
}

export function useConsumptionSummary(projectId?: string) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<ConsumptionSummaryItem[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSummary = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Fetch consumption summary from view - use type assertion for view
      let query = supabase
        .from('inventory_consumption_summary' as any)
        .select('*')
        .order('material_name');

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data: summaryData, error: summaryError } = await query;

      if (summaryError) {
        console.error('Error fetching consumption summary:', summaryError);
      } else {
        setSummary((summaryData as unknown as ConsumptionSummaryItem[]) || []);
      }

      // Fetch stock alerts - use type assertion for RPC function
      const { data: alertsData, error: alertsError } = await supabase
        .rpc('check_inventory_stock_alerts' as any, { p_project_id: projectId || null });

      if (alertsError) {
        console.error('Error fetching stock alerts:', alertsError);
      } else {
        setAlerts(alertsData as StockAlert[] || []);
      }
    } catch (error: any) {
      console.error('Error in consumption summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();

    // Subscribe to inventory changes
    const channel = supabase
      .channel('consumption-summary-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_inventory' },
        () => fetchSummary()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_usage_logs' },
        () => fetchSummary()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, projectId]);

  // Calculate totals
  const totalStockValue = summary.reduce((sum, item) => sum + (item.stock_value || 0), 0);
  const totalTodayUsage = summary.reduce((sum, item) => sum + (item.today_usage || 0), 0);
  const totalWeeklyUsage = summary.reduce((sum, item) => sum + (item.weekly_usage || 0), 0);
  const criticalAlerts = alerts.filter(a => a.alert_type === 'critical' || a.alert_type === 'out_of_stock');
  const lowStockAlerts = alerts.filter(a => a.alert_type === 'low');

  return {
    summary,
    alerts,
    isLoading,
    totalStockValue,
    totalTodayUsage,
    totalWeeklyUsage,
    criticalAlerts,
    lowStockAlerts,
    refetch: fetchSummary,
  };
}
