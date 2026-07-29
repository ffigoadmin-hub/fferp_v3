// @ts-nocheck
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { History, Package, RefreshCw, CheckCircle2, Clock } from 'lucide-react';

// Same Chennai-group scoping as POAssignment.tsx — keep both in sync.
const PALLIKARANAI_HUB_ID = '5438290c-ce06-4f4c-b8dc-046bf6b19d18';
const VANAGARAM_HUB_ID = '8c4f50e8-d2b3-474b-9bfc-fdb9654d9ad4';
const CHENNAI_GROUP_HUB_IDS = [PALLIKARANAI_HUB_ID, VANAGARAM_HUB_ID];
const ANTO_EMAIL = 'anto@ffactory.com';

function fmt(n: number) {
  return (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function POAssignmentHistory() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const isAnto = (user?.email ?? '').toLowerCase() === ANTO_EMAIL;
  const isChennaiGroupManager = isAnto || CHENNAI_GROUP_HUB_IDS.includes(user?.hub_id ?? '');
  const poHubIds = isChennaiGroupManager ? CHENNAI_GROUP_HUB_IDS : (user?.hub_id ? [user.hub_id] : []);

  const { data: pos = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['po-assignment-history', poHubIds.join(','), selectedDate],
    queryFn: async () => {
      if (!poHubIds.length) return [];
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id, po_number, hub_id, hub_name, eod_date, total_estimated, items_count, status,
          assigned_executive_id,
          assigned_executive:profiles!assigned_executive_id(name, email),
          items:purchase_order_items(id, product_name, item_name, required_qty, unit, estimated_price)
        `)
        .in('hub_id', poHubIds)
        .eq('eod_date', selectedDate)
        .neq('status', 'cancelled')
        .order('hub_name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!poHubIds.length,
  });

  const assignedCount = pos.filter((po: any) => po.assigned_executive_id).length;
  const unassignedCount = pos.length - assignedCount;

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-12 pt-2">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" /> PO History
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {isAnto || isChennaiGroupManager
              ? 'All purchase orders for Pallikaranai & Vanagaram on this date, assigned or not'
              : 'All purchase orders for your hub on this date, assigned or not'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {!isLoading && pos.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-gray-800">{pos.length}</p>
            <p className="text-[11px] text-gray-500">Total POs</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-green-600">{assignedCount}</p>
            <p className="text-[11px] text-gray-500">Assigned</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-amber-600">{unassignedCount}</p>
            <p className="text-[11px] text-gray-500">Still pending</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading history...
        </div>
      ) : pos.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
          <History className="w-10 h-10 mb-2 text-gray-300" />
          <p className="font-medium text-sm">No purchase orders for {format(new Date(selectedDate), 'dd MMM yyyy')}</p>
          <p className="text-xs mt-1">Try a different date.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pos.map((po: any) => (
            <div key={po.id} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-lg shrink-0 bg-amber-50">
                    <Package className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{po.po_number || `PO-${po.id.slice(0, 8)}`}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{po.hub_name || '—'} · {po.items_count ?? po.items?.length ?? 0} item{(po.items_count ?? po.items?.length ?? 0) !== 1 ? 's' : ''}</p>
                    {po.items?.length > 0 && (
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-md">
                        {po.items.map((i: any) => `${i.product_name || i.item_name} (${fmt(i.required_qty)}${i.unit || 'kg'})`).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <p className="text-sm font-bold text-gray-800">₹{fmt(po.total_estimated)}</p>
                  {po.assigned_executive_id ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      {po.assigned_executive?.name || po.assigned_executive?.email || 'Assigned'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                      <Clock className="w-3 h-3" /> Pending assignment
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
