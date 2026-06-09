import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { useState } from 'react';
import { differenceInDays, parseISO } from 'date-fns';

/**
 * PaymentDueAlerts — shows a dismissible banner when payments are:
 *  1. Stuck in pending_admin for 3+ days
 *  2. Stuck in pending_director for 3+ days
 *  3. Approved but not yet processed for 3+ days
 *
 * Mount this inside FreshPurchaseDashboard or the main AppLayout header.
 */
export function PaymentDueAlerts() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const role = user?.role ?? '';
  const isApprover = ['admin', 'director', 'Director', 'ceo', 'gm', 'purchase_head', 'ff_operations_manager'].includes(role);
  const isFinance  = ['accounts', 'admin', 'director', 'Director', 'ceo'].includes(role);

  const { data: overduePayments = [] } = useQuery({
    queryKey: ['overdue-payment-alerts'],
    enabled: isApprover || isFinance,
    refetchInterval: 5 * 60 * 1000, // every 5 min
    queryFn: async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data } = await supabase
        .from('vendor_payments')
        .select('id, status, created_at, vendor:vendors(name)')
        .in('status', ['pending_admin', 'pending_director', 'approved'])
        .lt('created_at', threeDaysAgo.toISOString())
        .order('created_at', { ascending: true })
        .limit(20);

      return data ?? [];
    },
  });

  if (dismissed || (overduePayments as any[]).length === 0) return null;

  const pendingAdmin    = (overduePayments as any[]).filter(p => p.status === 'pending_admin');
  const pendingDirector = (overduePayments as any[]).filter(p => p.status === 'pending_director');
  const needsProcessing = (overduePayments as any[]).filter(p => p.status === 'approved');

  const oldest = (overduePayments as any[]).reduce((oldest: any, p: any) => {
    if (!oldest) return p;
    return parseISO(p.created_at) < parseISO(oldest.created_at) ? p : oldest;
  }, null);

  const oldestDays = oldest ? differenceInDays(new Date(), parseISO(oldest.created_at)) : 0;

  return (
    <div className="mx-auto max-w-6xl mb-4">
      <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-start gap-3">
        <div className="p-1.5 bg-amber-100 rounded-lg flex-shrink-0 mt-0.5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">
            {(overduePayments as any[]).length} payment{(overduePayments as any[]).length !== 1 ? 's' : ''} overdue 3+ days
          </p>
          <div className="flex flex-wrap gap-3 mt-1">
            {pendingAdmin.length > 0 && (
              <span className="text-xs text-amber-700">
                <strong>{pendingAdmin.length}</strong> awaiting admin approval
              </span>
            )}
            {pendingDirector.length > 0 && (
              <span className="text-xs text-amber-700">
                <strong>{pendingDirector.length}</strong> awaiting director approval
              </span>
            )}
            {needsProcessing.length > 0 && (
              <span className="text-xs text-amber-700">
                <strong>{needsProcessing.length}</strong> approved but not processed
              </span>
            )}
            {oldestDays > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <Clock className="h-3 w-3" /> Oldest: {oldestDays} days ago
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            to="/purchase/payment-approvals"
            className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Review Now →
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg hover:bg-amber-100 text-amber-500 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
