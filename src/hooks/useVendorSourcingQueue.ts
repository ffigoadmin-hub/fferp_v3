import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface SourcingQueueItem {
  id: string;
  source_type: 'work_order' | 'work_request';
  request_id: string; // The original ID from WO or WorkRequest
  status: string;
  queue_status: 'pending' | 'in_progress' | 'completed';
  assigned_to: string | null;
  assigned_at: string | null;
  vendor_quotes: any[] | null;
  sourcing_notes: string | null;
  created_at: string;
  updated_at: string;
  
  // Normalized display fields
  display_details: {
    number?: string | number;
    description: string;
    budget: number;
    project_name: string;
    requester_name: string;
    phase_name?: string;
  };
}

export function useVendorSourcingQueue() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<SourcingQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch from vendor_sourcing_queue (linked to work_orders)
      const { data: queueData, error: queueError } = await supabase
        .from('vendor_sourcing_queue')
        .select(`
          *,
          work_order:work_orders(
            wo_number,
            work_description,
            approved_budget,
            status,
            project:projects(project_name),
            requester:profiles!work_orders_requester_id_fkey(name),
            phase:project_phases(phase_name)
          )
        `)
        .order('created_at', { ascending: false });

      if (queueError) throw queueError;

      // 2. Fetch from vendor_work_requests (CEO approved + Aligned ones for history)
      const { data: requestData, error: requestError } = await supabase
        .from('vendor_work_requests')
        .select(`
          *,
          project:projects(project_name),
          requester:profiles!vendor_work_requests_requested_by_fkey(name),
          assignee:profiles!vendor_work_requests_assigned_to_sourcing_fkey(name),
          phase:project_phases(phase_name)
        `)
        .in('status', ['pending', 'vendor_aligned'])
        .eq('approval_status', 'approved_for_sourcing');

      if (requestError) throw requestError;

      // 3. Normalize and combine
      const normalizedQueue: SourcingQueueItem[] = (queueData || []).map(item => ({
        ...item,
        status: item.work_order.status,
        queue_status: item.queue_status as 'pending' | 'in_progress' | 'completed',
        vendor_quotes: (item.vendor_quotes || []) as any[],
        source_type: 'work_order',
        request_id: item.work_order_id,
        display_details: {
          number: item.work_order.wo_number,
          description: item.work_order.work_description,
          budget: item.work_order.approved_budget,
          project_name: item.work_order.project.project_name,
          requester_name: item.work_order.requester.name,
          phase_name: item.work_order.phase?.phase_name
        }
      }));

      const normalizedRequests: SourcingQueueItem[] = (requestData || []).map(item => ({
        id: item.id, // Use request ID as queue ID for tracking
        source_type: 'work_request',
        request_id: item.id,
        status: item.status,
        queue_status: item.status === 'vendor_aligned' ? 'completed' : 'pending',
        assigned_to: item.assigned_to_sourcing,
        assigned_at: null,
        vendor_quotes: null,
        sourcing_notes: item.work_description,
        created_at: item.created_at,
        updated_at: item.updated_at,
        display_details: {
          number: 'REQ-' + item.id.slice(0, 4),
          description: item.work_description,
          budget: item.estimated_budget || 0,
          project_name: item.project.project_name,
          requester_name: item.requester.name,
          phase_name: item.phase?.phase_name
        }
      }));

      setQueue([...normalizedQueue, ...normalizedRequests].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (error) {
      console.error('Error fetching sourcing queue:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const updateQuotes = async (id: string, quotes: any[], notes?: string) => {
    try {
      const { error } = await supabase
        .from('vendor_sourcing_queue')
        .update({
          vendor_quotes: quotes,
          sourcing_notes: notes,
          queue_status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Vendor quotes updated');
      fetchQueue();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update quotes');
    }
  };

  const assignToMe = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('vendor_sourcing_queue')
        .update({
          assigned_to: user.id,
          assigned_at: new Date().toISOString(),
          queue_status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Task assigned to you');
      fetchQueue();
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign task');
    }
  };

  const completeSourcing = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('vendor_sourcing_queue')
        .update({
          queue_status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Sourcing marked as complete');
      fetchQueue();
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete sourcing');
    }
  };

  return {
    queue,
    isLoading,
    updateQuotes,
    assignToMe,
    completeSourcing,
    refetch: fetchQueue
  };
}
