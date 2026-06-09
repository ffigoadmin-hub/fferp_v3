import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isPast, isToday, addDays } from 'date-fns';
import type { Json } from '@/integrations/supabase/types';

export interface MaterialDelivery {
  id: string;
  boq_items: Json;
  urgency: string;
  status: string;
  order_status: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  delivery_photo_urls: string[] | null;
  delivery_received_by: string | null;
  delivery_vehicle_number: string | null;
  delivery_challan_number: string | null;
  notes: string | null;
  project: {
    project_name: string;
    project_id: string;
  } | null;
  phase: {
    phase_name: string;
  } | null;
  requester: {
    name: string;
    email: string;
  } | null;
}

export function useMaterialDeliveries(projectId?: string) {
  const { data: deliveries = [], isLoading, refetch } = useQuery({
    queryKey: ['material-deliveries', projectId],
    queryFn: async () => {
      let query = supabase
        .from('material_requests')
        .select(`
          id,
          boq_items,
          urgency,
          status,
          order_status,
          notes,
          expected_delivery_date,
          actual_delivery_date,
          delivery_photo_urls,
          delivery_received_by,
          delivery_vehicle_number,
          delivery_challan_number,
          project:projects(project_name, project_id),
          phase:project_phases(phase_name),
          requester:profiles!material_requests_requested_by_fkey(name, email)
        `)
        .in('order_status', ['ordered', 'shipped', 'loading'])
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MaterialDelivery[];
    },
  });

  // Helper to get first material name from boq_items
  const getMaterialName = (boqItems: Json): string => {
    if (Array.isArray(boqItems) && boqItems.length > 0) {
      const first = boqItems[0] as Record<string, unknown>;
      return (first?.material_name as string) || 'Materials';
    }
    return 'Materials';
  };

  // Categorize deliveries
  const pendingDeliveries = deliveries.filter(
    (d) => ['ordered', 'shipped', 'loading'].includes(d.order_status || '')
  );

  const todaysDeliveries = deliveries.filter(
    (d) => d.expected_delivery_date && isToday(new Date(d.expected_delivery_date))
  );

  const overdueDeliveries = deliveries.filter(
    (d) =>
      d.expected_delivery_date &&
      isPast(new Date(d.expected_delivery_date)) &&
      !isToday(new Date(d.expected_delivery_date)) &&
      d.order_status !== 'delivered'
  );

  const deliveredAwaitingAudit = deliveries.filter(
    (d) => d.order_status === 'delivered' && !d.actual_delivery_date
  );

  const upcomingDeliveries = deliveries.filter(
    (d) =>
      d.expected_delivery_date &&
      !isPast(new Date(d.expected_delivery_date)) &&
      !isToday(new Date(d.expected_delivery_date)) &&
      new Date(d.expected_delivery_date) <= addDays(new Date(), 7) &&
      d.order_status !== 'delivered'
  );

  const inTransit = deliveries.filter((d) => d.order_status === 'shipped');

  return {
    deliveries,
    pendingDeliveries,
    todaysDeliveries,
    overdueDeliveries,
    deliveredAwaitingAudit,
    upcomingDeliveries,
    inTransit,
    isLoading,
    refetch,
    getMaterialName,
  };
}
