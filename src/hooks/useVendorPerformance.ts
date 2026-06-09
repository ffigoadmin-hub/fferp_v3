import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface VendorPerformanceStats {
  totalVendors: number;
  activeVendors: number;
  averageRating: number;
  totalSpend: number;
  pendingPayments: number;
  onTimeDeliveryRate: number;
  topVendors: Array<{
    id: string;
    company_name: string;
    rating: number;
    total_orders: number;
    total_spend: number;
    work_types: string[];
  }>;
  vendorsByWorkType: Array<{
    work_type: string;
    count: number;
  }>;
  recentActivity: Array<{
    id: string;
    vendor_name: string;
    activity_type: string;
    amount?: number;
    date: string;
    project_name?: string;
  }>;
}

export function useVendorPerformance() {
  const [stats, setStats] = useState<VendorPerformanceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPerformanceStats = async () => {
    try {
      setIsLoading(true);

      // Fetch all vendors
      const { data: vendors, error: vendorsError } = await supabase
        .from('vendor_master')
        .select('*')
        .order('rating', { ascending: false });

      if (vendorsError) throw vendorsError;

      // Fetch vendor quotes with selected status
      const { data: quotes, error: quotesError } = await supabase
        .from('vendor_quotes')
        .select(`
          *,
          material_request:material_requests(
            project:projects(project_name)
          )
        `)
        .eq('is_selected', true);

      if (quotesError) throw quotesError;

      // Fetch work orders
      const { data: workOrders, error: woError } = await supabase
        .from('work_orders')
        .select(`
          *,
          project:projects(project_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (woError) throw woError;

      // Fetch payment requests for vendors
      const { data: payments, error: paymentsError } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('payment_type', 'vendor')
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Calculate stats
      const totalVendors = vendors?.length || 0;
      const activeVendors = vendors?.filter(v => v.status === 'active').length || 0;
      const vendorsWithRating = vendors?.filter(v => v.rating && v.rating > 0) || [];
      const averageRating = vendorsWithRating.length > 0
        ? vendorsWithRating.reduce((sum, v) => sum + (v.rating || 0), 0) / vendorsWithRating.length
        : 0;

      // Calculate spend from selected quotes
      const totalSpend = quotes?.reduce((sum, q) => sum + (q.quoted_total || 0), 0) || 0;
      
      // Calculate pending payments
      const pendingPayments = payments
        ?.filter(p => ['pending', 'admin_approved', 'ceo_approved'].includes(p.status))
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Calculate on-time delivery rate (simplified - based on quotes that have delivery info)
      const quotesWithDelivery = quotes?.filter(q => q.delivery_days) || [];
      const onTimeDeliveryRate = quotesWithDelivery.length > 0 ? 85 : 0; // Placeholder - would need actual delivery tracking

      // Top vendors by rating
      const topVendors = (vendors || [])
        .filter(v => v.rating && v.rating > 0)
        .slice(0, 5)
        .map(v => ({
          id: v.id,
          company_name: v.company_name,
          rating: v.rating || 0,
          total_orders: quotes?.filter(q => q.vendor_name === v.company_name).length || 0,
          total_spend: quotes?.filter(q => q.vendor_name === v.company_name).reduce((sum, q) => sum + (q.quoted_total || 0), 0) || 0,
          work_types: v.work_types || []
        }));

      // Vendors by work type
      const workTypeMap = new Map<string, number>();
      vendors?.forEach(v => {
        (v.work_types || []).forEach((wt: string) => {
          workTypeMap.set(wt, (workTypeMap.get(wt) || 0) + 1);
        });
      });
      const vendorsByWorkType = Array.from(workTypeMap.entries())
        .map(([work_type, count]) => ({ work_type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Recent activity
      const recentActivity: VendorPerformanceStats['recentActivity'] = [];
      
      // Add recent work orders
      workOrders?.slice(0, 5).forEach(wo => {
        const woAny = wo as any;
        recentActivity.push({
          id: wo.id,
          vendor_name: woAny.aligned_vendor_name || woAny.vendor_name || 'Unknown',
          activity_type: 'work_order',
          amount: woAny.estimated_budget || woAny.estimated_cost,
          date: wo.created_at,
          project_name: (wo.project as any)?.project_name
        });
      });

      // Add recent payments
      payments?.slice(0, 5).forEach(p => {
        recentActivity.push({
          id: p.id,
          vendor_name: p.vendor_name || 'Vendor',
          activity_type: p.status === 'paid' ? 'payment_completed' : 'payment_pending',
          amount: Number(p.amount),
          date: p.created_at,
          project_name: undefined
        });
      });

      // Sort by date
      recentActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setStats({
        totalVendors,
        activeVendors,
        averageRating: Math.round(averageRating * 10) / 10,
        totalSpend,
        pendingPayments,
        onTimeDeliveryRate,
        topVendors,
        vendorsByWorkType,
        recentActivity: recentActivity.slice(0, 10)
      });
    } catch (error) {
      console.error('Error fetching vendor performance stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceStats();
  }, []);

  return {
    stats,
    isLoading,
    refetch: fetchPerformanceStats
  };
}
