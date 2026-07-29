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
  // Split per role AND per payment type — e.g. `l1_vendor`, `l1_transport`,
  // so the Vendor Payments and Transport Payments nav items each show their
  // own real count instead of the same combined total on both.
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

      const vendorCount    = vendorRes.count || 0;
      const transportCount = transportRes.count || 0;

      // Find the base badge key for this role
      const baseKey = Object.entries(BADGE_KEY_STATUS).find(
        ([, status]) => status === targetStatus
      )?.[0];

      if (!baseKey) return {};
      const result: FFPaymentCounts = {};
      if (vendorCount > 0)    result[`${baseKey}_vendor`]    = vendorCount;
      if (transportCount > 0) result[`${baseKey}_transport`] = transportCount;
      // Combined total kept too, for any nav item that still wants "both".
      if (vendorCount + transportCount > 0) result[baseKey] = vendorCount + transportCount;
      return result;
    },
    enabled: !!targetStatus,
    staleTime: 30_000,        // refresh every 30 s
    refetchInterval: 60_000,  // poll every 60 s
  });

  return data;
}
