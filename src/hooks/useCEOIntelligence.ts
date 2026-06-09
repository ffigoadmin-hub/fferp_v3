import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, subDays, format } from 'date-fns';

export interface PaymentTrend {
  date: string;
  amount: number;
  count: number;
}

export interface DepartmentScore {
  department: string;
  avgScore: number;
  employeeCount: number;
}

export interface VendorConcentration {
  name: string;
  value: number;
  color: string;
}

export interface UrgencyStats {
  name: string;
  emergency: number;
  normal: number;
  important: number;
}

const COLORS = [
  'hsl(199, 89%, 48%)',
  'hsl(142, 76%, 45%)',
  'hsl(45, 93%, 47%)',
  'hsl(280, 70%, 50%)',
  'hsl(340, 75%, 55%)',
  'hsl(222, 30%, 30%)',
];

export function useCEOIntelligence() {
  // Payment trends for the current month
  const { data: paymentTrends, isLoading: isLoadingTrends } = useQuery({
    queryKey: ['ceo-payment-trends'],
    queryFn: async () => {
      const today = new Date();
      const startDate = startOfMonth(today);
      const endDate = endOfMonth(today);
      
      const { data, error } = await supabase
        .from('payment_requests')
        .select('created_at, amount, status')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('status', 'paid');
      
      if (error) throw error;
      
      // Group by date
      const grouped = (data || []).reduce((acc, req) => {
        const date = format(new Date(req.created_at), 'MMM dd');
        if (!acc[date]) {
          acc[date] = { date, amount: 0, count: 0 };
        }
        acc[date].amount += Number(req.amount);
        acc[date].count += 1;
        return acc;
      }, {} as Record<string, PaymentTrend>);
      
      return Object.values(grouped).slice(-7);
    },
  });

  // Vendor concentration
  const { data: vendorConcentration, isLoading: isLoadingVendors } = useQuery({
    queryKey: ['ceo-vendor-concentration'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('vendor_name, amount')
        .in('status', ['paid', 'ceo_approved', 'admin_approved']);
      
      if (error) throw error;
      
      // Group by vendor
      const vendorTotals = (data || []).reduce((acc, req) => {
        const vendor = req.vendor_name;
        acc[vendor] = (acc[vendor] || 0) + Number(req.amount);
        return acc;
      }, {} as Record<string, number>);
      
      const totalAmount = Object.values(vendorTotals).reduce((a, b) => a + b, 0);
      
      // Get top 5 vendors
      const sorted = Object.entries(vendorTotals)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);
      
      const topVendorsTotal = sorted.reduce((acc, [, amount]) => acc + amount, 0);
      const othersTotal = totalAmount - topVendorsTotal;
      
      const result: VendorConcentration[] = sorted.map(([name, amount], index) => ({
        name,
        value: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
        color: COLORS[index % COLORS.length],
      }));
      
      if (othersTotal > 0) {
        result.push({
          name: 'Others',
          value: Math.round((othersTotal / totalAmount) * 100),
          color: COLORS[5],
        });
      }
      
      return result;
    },
  });

  // Urgency abuse stats
  const { data: urgencyStats, isLoading: isLoadingUrgency } = useQuery({
    queryKey: ['ceo-urgency-stats'],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      
      const { data, error } = await supabase
        .from('payment_requests')
        .select(`
          requester_id,
          urgency,
          profiles!payment_requests_requester_id_fkey(name)
        `)
        .gte('created_at', thirtyDaysAgo);
      
      if (error) throw error;
      
      // Group by requester
      const userStats = (data || []).reduce((acc, req) => {
        const userId = req.requester_id;
        const name = (req.profiles as any)?.name || 'Unknown';
        
        if (!acc[userId]) {
          acc[userId] = { name, emergency: 0, normal: 0, important: 0 };
        }
        
        if (req.urgency === 'emergency') acc[userId].emergency += 1;
        else if (req.urgency === 'important') acc[userId].important += 1;
        else acc[userId].normal += 1;
        
        return acc;
      }, {} as Record<string, UrgencyStats>);
      
      // Sort by emergency ratio
      return Object.values(userStats)
        .map(u => ({
          ...u,
          ratio: (u.emergency / (u.emergency + u.important + u.normal)) * 100,
        }))
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 5);
    },
  });

  // Overall stats
  const { data: overallStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['ceo-overall-stats'],
    queryFn: async () => {
      const today = new Date();
      const startOfToday = format(today, 'yyyy-MM-dd');
      const startOfMonthDate = startOfMonth(today);
      
      // Today's approved amount
      const { data: todayData } = await supabase
        .from('payment_requests')
        .select('amount')
        .eq('status', 'paid')
        .gte('paid_at', startOfToday);
      
      const todayTotal = (todayData || []).reduce((acc, r) => acc + Number(r.amount), 0);
      
      // Monthly burn
      const { data: monthData } = await supabase
        .from('payment_requests')
        .select('amount')
        .in('status', ['paid', 'ceo_approved', 'admin_approved'])
        .gte('created_at', startOfMonthDate.toISOString());
      
      const monthTotal = (monthData || []).reduce((acc, r) => acc + Number(r.amount), 0);
      
      // Pending approvals
      const { count: pendingCount } = await supabase
        .from('payment_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'admin_approved');
      
      // Admin rejections this month
      const { count: rejectionCount } = await supabase
        .from('payment_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'admin_rejected')
        .gte('created_at', startOfMonthDate.toISOString());
      
      return {
        todayApproved: todayTotal,
        monthlyBurn: monthTotal,
        pendingApprovals: pendingCount || 0,
        adminRejections: rejectionCount || 0,
      };
    },
  });

  return {
    paymentTrends: paymentTrends || [],
    departmentScores: [],
    vendorConcentration: vendorConcentration || [],
    urgencyStats: urgencyStats || [],
    overallStats: overallStats || {
      todayApproved: 0,
      monthlyBurn: 0,
      pendingApprovals: 0,
      adminRejections: 0,
    },
    isLoading: isLoadingTrends || isLoadingVendors || isLoadingUrgency || isLoadingStats,
  };
}
