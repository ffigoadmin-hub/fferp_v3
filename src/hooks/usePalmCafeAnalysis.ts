import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export function usePalmCafeAnalysis(startDate?: Date, endDate?: Date) {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['ceo-palm-cafe-stats', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      const start = startDate ? startOfDay(startDate).toISOString() : subDays(startOfDay(new Date()), 7).toISOString();
      const end = endDate ? endOfDay(endDate).toISOString() : endOfDay(new Date()).toISOString();

      // 1. Total Menu Count
      const { count: menuCount } = await supabase
        .from('cafe_menu_items')
        .select('*', { count: 'exact', head: true });

      // 2. Orders in Range
      const { data: rangeOrders } = await supabase
        .from('cafe_orders')
        .select('total_amount, order_status, created_at')
        .gte('created_at', start)
        .lte('created_at', end);

      // 3. Today's Stats (always today)
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();
      const { data: todayOrders } = await supabase
        .from('cafe_orders')
        .select('total_amount, order_status')
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd);

      // 4. Historical Sales (Generated based on range or last 7 days)
      const diffDays = Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)));
      const historyLabels = Array.from({ length: diffDays + 1 }, (_, i) => {
        const d = subDays(new Date(end), i);
        return {
          date: format(d, 'yyyy-MM-dd'),
          label: format(d, 'MMM dd'),
          amount: 0,
          orders: 0
        };
      }).reverse();

      rangeOrders?.forEach(order => {
        const orderDate = format(new Date(order.created_at), 'yyyy-MM-dd');
        const day = historyLabels.find(d => d.date === orderDate);
        if (day && order.order_status === 'collected') {
          day.amount += Number(order.total_amount);
          day.orders += 1;
        }
      });

      // 5. Top Dishes by Rating
      const { data: topDishes } = await supabase
        .from('cafe_menu_items')
        .select('*')
        .order('average_rating', { ascending: false })
        .limit(5);

      return {
        totalMenuCount: menuCount || 0,
        todayOrderCount: todayOrders?.length || 0,
        todaySales: todayOrders
          ?.filter(o => o.order_status === 'collected')
          .reduce((sum, o) => sum + Number(o.total_amount), 0) || 0,
        totalSales: rangeOrders
          ?.filter(o => o.order_status === 'collected')
          .reduce((sum, o) => sum + Number(o.total_amount), 0) || 0,
        salesHistory: historyLabels,
        topDishes: topDishes || []
      };
    }
  });

  return {
    stats,
    isLoading: statsLoading
  };
}
