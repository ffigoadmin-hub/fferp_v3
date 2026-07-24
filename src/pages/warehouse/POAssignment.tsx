// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ClipboardCheck, Package, RefreshCw, UserCheck } from 'lucide-react';

// Pallikaranai + Vanagaram hub UUIDs, confirmed live in this session.
// Anto (Chennai's shared hub manager) covers both hubs even though his own
// profile only has one primary hub_id — this is the "small code-level group
// mapping" agreed on instead of a schema change. If Anto's real login email
// differs from anto@ffactory.com, update ANTO_EMAIL below to match.
const PALLIKARANAI_HUB_ID = '5438290c-ce06-4f4c-b8dc-046bf6b19d18';
const VANAGARAM_HUB_ID = '8c4f50e8-d2b3-474b-9bfc-fdb9654d9ad4';
const CHENNAI_GROUP_HUB_IDS = [PALLIKARANAI_HUB_ID, VANAGARAM_HUB_ID];
const ANTO_EMAIL = 'anto@ffactory.com';

function fmt(n: number) {
  return (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function AssignRow({ po, executives, onAssign, isAssigning }: any) {
  const [selectedExec, setSelectedExec] = useState('');

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg shrink-0 bg-amber-50">
          <Package className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">{po.po_number || `PO-${po.id.slice(0, 8)}`}</p>
          <p className="text-xs text-gray-500 mt-0.5">{po.hub_name || '—'} · {po.items_count ?? 0} item{(po.items_count ?? 0) !== 1 ? 's' : ''}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {po.eod_date ? format(new Date(po.eod_date), 'dd MMM yyyy') : '—'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <p className="text-sm font-bold text-gray-800 mr-2">₹{fmt(po.total_estimated)}</p>
        <select
          value={selectedExec}
          onChange={(e) => setSelectedExec(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">Assign to...</option>
          {executives.map((ex: any) => (
            <option key={ex.id} value={ex.id}>{ex.name || ex.email}</option>
          ))}
        </select>
        <button
          disabled={!selectedExec || isAssigning}
          onClick={() => onAssign(po, selectedExec)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <UserCheck className="w-3.5 h-3.5" /> Assign
        </button>
      </div>
    </div>
  );
}

export default function POAssignment() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const isAnto = (user?.email ?? '').toLowerCase() === ANTO_EMAIL;
  // Any hub_manager whose own hub is Pallikaranai or Vanagaram shares the same
  // pool of 4 Chennai-group purchase executives (they all sit under one
  // primary hub_id, per the "small code-level group mapping" decision) —
  // Anto additionally sees POs from both hubs; Arun Karthick/Manoj/Dhanush
  // still only see their own hub's POs, but can assign from the full group.
  const isChennaiGroupManager = isAnto || CHENNAI_GROUP_HUB_IDS.includes(user?.hub_id ?? '');
  const poHubIds = isAnto ? CHENNAI_GROUP_HUB_IDS : (user?.hub_id ? [user.hub_id] : []);
  const execHubIds = isChennaiGroupManager ? CHENNAI_GROUP_HUB_IDS : (user?.hub_id ? [user.hub_id] : []);

  const { data: pos = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['po-assignment-unassigned', poHubIds.join(',')],
    queryFn: async () => {
      if (!poHubIds.length) return [];
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('id, po_number, hub_id, hub_name, eod_date, total_estimated, items_count, status')
        .in('hub_id', poHubIds)
        .is('assigned_executive_id', null)
        .neq('status', 'cancelled')
        .order('eod_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!poHubIds.length,
  });

  const { data: executives = [] } = useQuery({
    queryKey: ['po-assignment-execs', execHubIds.join(',')],
    queryFn: async () => {
      if (!execHubIds.length) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, hub_id')
        .eq('role', 'shift_employee')
        .in('hub_id', execHubIds)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!execHubIds.length,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ po, execId }: { po: any; execId: string }) => {
      const { error: poErr } = await supabase
        .from('purchase_orders')
        .update({ assigned_executive_id: execId })
        .eq('id', po.id);
      if (poErr) throw poErr;

      const { error: assignErr } = await supabase
        .from('po_assignments')
        .insert({ po_id: po.id, hub_id: po.hub_id, purchase_executive_id: execId, status: 'assigned' });
      if (assignErr) throw assignErr;
    },
    onSuccess: () => {
      toast.success('PO assigned');
      qc.invalidateQueries({ queryKey: ['po-assignment-unassigned'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to assign'),
  });

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-12 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-600" /> PO Assignment
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {isAnto
              ? 'Review purchase orders for Pallikaranai & Vanagaram and assign each to a purchase executive'
              : 'Review purchase orders for your hub and assign each to a purchase executive'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading purchase orders...
        </div>
      ) : pos.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
          <ClipboardCheck className="w-10 h-10 mb-2 text-gray-300" />
          <p className="font-medium text-sm">No purchase orders waiting for assignment</p>
          <p className="text-xs mt-1">New POs from the EOD PO Engine will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pos.map((po: any) => (
            <AssignRow
              key={po.id}
              po={po}
              executives={executives}
              isAssigning={assignMutation.isPending}
              onAssign={(po: any, execId: string) => assignMutation.mutate({ po, execId })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
