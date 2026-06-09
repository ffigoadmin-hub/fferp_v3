// useFFPaymentCount — returns pending FF payment counts keyed by approval stage
// Used by Sidebar to show notification badges on payment approval nav items.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Maps role → the status value they're responsible for
const ROLE_STATUS_MAP: Record<string, string> = {
  ff_operations_manager: 'pending_ff_ops',
  gm:         'pending_gm',
  l1_manager: 'pending_l1',
  auditor:    'pending_auditor',
  ceo:        'pending_ceo',
  accounts:   'approved',     // accounts sees approved (ready for payment)
};

// Badge key (used in NavItem.badgeKey) → the status to count
const BADGE_KEY_STATUS: Record<string, string> = {
  ff_ops:  'pending_ff_ops',
  gm:      'pending_gm',
  l1:      'pending_l1',
  auditor: 'pending_auditor',
  ceo:     'pending_ceo',
  accounts:'approved',
};

export interface FFPaymentCounts {
  // Total pending for this role's queue across vendor + transport
  [badgeKey: string]: number;
}

export function useFFPaymentCount(): FFPaymentCounts {
  const { user } = useAuth();
  const role = user?.role || '';

  // Determine which status to count for this user
  const targetStatus = ROLE_STATUS_MAP[role];

  const { data = {} } = useQuery<FFPaymentCounts>({
    queryKey: ['ff-payment-count', role, targetStatus],
    queryFn: async () => {
      if (!targetStatus) return {};

      const [vendorRes, transportRes] = await Promise.all([
        (supabase as any)
          .from('ff_vendor_payments')
          .select('id', { count: 'exact', head: true })
          .eq('payment_status', targetStatus),
        (supabase as any)
          .from('ff_transport_payments')
          .select('id', { count: 'exact', head: true })
          .eq('payment_status', targetStatus),
      ]);

      const total = (vendorRes.count || 0) + (transportRes.count || 0);

      // Find the badge key for this role
      const badgeKey = Object.entries(BADGE_KEY_STATUS).find(
        ([, status]) => status === targetStatus
      )?.[0];

      if (!badgeKey || total === 0) return {};
      return { [badgeKey]: total };
    },
    enabled: !!targetStatus,
    staleTime: 30_000,        // refresh every 30 s
    refetchInterval: 60_000,  // poll every 60 s
  });

  return data;
}
