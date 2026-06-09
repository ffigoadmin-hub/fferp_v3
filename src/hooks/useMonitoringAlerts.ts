import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export interface MonitoringAlerts {
  pendingMaterials: number;
  pendingDeliveries: number;
  lowStockItems: number;
  newSiteUpdates: number;
  projectAlerts: number;
  vendorWorkPending: number;
}

export function useMonitoringAlerts(role: string) {
  const queryClient = useQueryClient();
  // Alerts state for tracking counts - will be updated via real-time events
  const [alerts, setAlerts] = useState<MonitoringAlerts>({
    pendingMaterials: 0,
    pendingDeliveries: 0,
    lowStockItems: 0,
    newSiteUpdates: 0,
    projectAlerts: 0,
    vendorWorkPending: 0,
  });

  // Update alerts based on events
  const incrementAlert = (key: keyof MonitoringAlerts) => {
    setAlerts(prev => ({ ...prev, [key]: prev[key] + 1 }));
  };

  useEffect(() => {
    // Determine which tables to monitor based on role
    const shouldMonitorMaterials = ['admin', 'ceo', 'gm', 'gmo', 'smo', 'purchase_head', 'boi'].includes(role);
    const shouldMonitorProjects = ['admin', 'ceo', 'gm', 'gmo', 'smo', 'engineer'].includes(role);
    const shouldMonitorSiteUpdates = ['admin', 'ceo', 'gm', 'gmo', 'farm_manager'].includes(role);
    const shouldMonitorInventory = ['admin', 'ceo', 'gm', 'purchase_head', 'farm_manager'].includes(role);
    const shouldMonitorVendors = ['admin', 'ceo', 'gm', 'purchase_head', 'boi'].includes(role);

    const channel = supabase.channel(`monitoring-alerts-${role}`);

    if (shouldMonitorMaterials) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'material_requests' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newReq = payload.new as any;
            toast.info(`📦 New material request: ${newReq.material_name || 'Materials'}`, {
              duration: 4000,
            });
            incrementAlert('pendingMaterials');
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            const oldData = payload.old as any;
            if (oldData?.status !== updated?.status && updated?.status === 'shipped') {
              toast.info(`🚚 Material shipment in transit!`, { duration: 4000 });
              incrementAlert('pendingDeliveries');
            }
          }
          queryClient.invalidateQueries({ queryKey: ['material-requests'] });
          queryClient.invalidateQueries({ queryKey: ['material-deliveries'] });
        }
      );
    }

    if (shouldMonitorProjects) {
      channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'projects' },
        (payload) => {
          const updated = payload.new as any;
          const oldData = payload.old as any;
          if (oldData?.lifecycle_stage !== updated?.lifecycle_stage) {
            toast.info(`📊 Project "${updated.project_name}" moved to ${updated.lifecycle_stage}`, {
              duration: 4000,
            });
          }
          queryClient.invalidateQueries({ queryKey: ['project-health'] });
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        }
      );
    }

    if (shouldMonitorSiteUpdates) {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'daily_site_updates' },
        () => {
          toast.info(`📝 New site update submitted`, { duration: 4000 });
          incrementAlert('newSiteUpdates');
          queryClient.invalidateQueries({ queryKey: ['site-updates'] });
          queryClient.invalidateQueries({ queryKey: ['daily-site-updates'] });
        }
      );
    }

    if (shouldMonitorInventory) {
      channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'project_inventory' },
        (payload) => {
          const updated = payload.new as any;
          if (updated?.current_quantity <= (updated?.minimum_stock || 10)) {
            toast.warning(`⚠️ Low stock alert: ${updated.material_name}`, { duration: 5000 });
            incrementAlert('lowStockItems');
          }
          queryClient.invalidateQueries({ queryKey: ['project-inventory'] });
          queryClient.invalidateQueries({ queryKey: ['consumption-summary'] });
        }
      );
    }

    if (shouldMonitorVendors) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendor_work_requests' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            incrementAlert('vendorWorkPending');
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            if (updated?.status === 'completed') {
              toast.success(`✅ Vendor work completed!`, { duration: 4000 });
            }
          }
          queryClient.invalidateQueries({ queryKey: ['vendor-work-requests'] });
        }
      );

      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vendor_ratings' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['vendor-performance'] });
          queryClient.invalidateQueries({ queryKey: ['vendor-ratings'] });
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, queryClient]);

  return { alerts };
}
