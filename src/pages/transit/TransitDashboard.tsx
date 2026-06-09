import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import {
  Truck, Clock, CheckCircle2, ClipboardCheck, Plus,
  RefreshCw, ChevronRight, AlertTriangle, Package,
} from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  arrived:   'bg-amber-100 text-amber-700',
  in_qc:     'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
};

const VEHICLE_LABEL: Record<string, string> = {
  own:    'Own Vehicle',
  hired:  'Hired Vehicle',
};

export default function TransitDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hubId = (user as any)?.hub_id ?? null;
  const isManagement = ['ceo', 'gm', 'admin', 'director', 'nsm'].includes(user?.role ?? '');
  const today = format(new Date(), 'yyyy-MM-dd');

  // Today's transit records
  const { data: todayTransits = [], isLoading, refetch } = useQuery({
    queryKey: ['transit-today', today, hubId],
    queryFn: async () => {
      let q = supabase
        .from('transit_records')
        .select(`
          id, vehicle_type, driver_name, vehicle_number,
          transit_cost, status, arrived_at, notes,
          po:purchase_orders(po_number, total_amount, vendor:vendors(name))
        `)
        .gte('arrived_at', `${today}T00:00:00`)
        .lte('arrived_at', `${today}T23:59:59`)
        .order('arrived_at', { ascending: false });
      if (!isManagement && hubId) q = q.eq('hub_id', hubId);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Expected arrivals — POs with status 'ordered' not yet in transit today
  const { data: expectedPOs = [] } = useQuery({
    queryKey: ['expected-arrivals', today, hubId],
    queryFn: async () => {
      let q = supabase
        .from('purchase_orders')
        .select('id, po_number, total_amount, vendor:vendors(name)')
        .eq('status', 'ordered')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!isManagement && hubId) q = q.eq('hub_id', hubId);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Stats
  const arrived   = (todayTransits as any[]).filter(t => t.status === 'arrived').length;
  const inQC      = (todayTransits as any[]).filter(t => t.status === 'in_qc').length;
  const completed = (todayTransits as any[]).filter(t => t.status === 'completed').length;
  const totalCost = (todayTransits as any[]).reduce((s, t) => s + (Number(t.transit_cost) || 0), 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 pt-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Transit Dashboard</h1>
          <p className="text-[13px] text-slate-500">Gate Entry & Arrival Tracking · {format(new Date(), 'd MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetch()} className="btn-zoho-secondary px-3">
            <RefreshCw className="h-4 w-4" />
          </button>
          <Link to="/transit/gate-entry" className="btn-zoho-primary">
            <Plus className="h-4 w-4" /> Gate Entry
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: 'Arrived Today',    value: arrived,   icon: Truck,         color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'In QC',            value: inQC,      icon: ClipboardCheck, color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Completed',        value: completed, icon: CheckCircle2,  color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Transit Cost',     value: `₹${(totalCost / 1000).toFixed(1)}k`, icon: Package, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 pt-5 pb-4">
            <div className={`p-2 ${card.bg} rounded-lg w-fit mb-2`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <p className="text-[13px] text-slate-500 font-medium mb-1">{card.label}</p>
            <p className="text-[24px] font-bold text-slate-800">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Today's Transit Records */}
        <div className="lg:col-span-2 zoho-card">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Today's Arrivals</h2>
            <Link to="/transit/gate-entry" className="text-xs text-blue-600 hover:underline">+ Log Arrival</Link>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
          ) : (todayTransits as any[]).length === 0 ? (
            <div className="p-8 text-center">
              <Truck className="h-10 w-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No arrivals logged today</p>
              <Link to="/transit/gate-entry" className="mt-3 inline-block text-xs text-blue-600 hover:underline">
                Log first arrival →
              </Link>
            </div>
          ) : (
            <div className="zoho-table-container rounded-none border-0">
              <table className="zoho-table">
                <thead>
                  <tr>
                    <th>PO / Vendor</th>
                    <th>Vehicle</th>
                    <th>Arrived</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(todayTransits as any[]).map((t: any) => (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/60 cursor-pointer"
                      onClick={() => navigate(`/transit/${t.id}`)}
                    >
                      <td>
                        <div className="font-medium text-blue-700 text-sm">{t.po?.po_number ?? '—'}</div>
                        <div className="text-xs text-slate-500">{t.po?.vendor?.name ?? '—'}</div>
                      </td>
                      <td>
                        <div className="text-sm text-slate-700">{t.vehicle_number || '—'}</div>
                        <div className="text-xs text-slate-400">{VEHICLE_LABEL[t.vehicle_type] ?? t.vehicle_type}</div>
                      </td>
                      <td className="text-sm text-slate-600">
                        {t.arrived_at ? format(new Date(t.arrived_at), 'hh:mm a') : '—'}
                      </td>
                      <td>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLOR[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {t.status === 'in_qc' ? 'In QC' : t.status}
                        </span>
                      </td>
                      <td>
                        <ChevronRight className="h-4 w-4 text-gray-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Expected Arrivals Panel */}
        <div className="zoho-card">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Expected Arrivals</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {expectedPOs.length} POs
            </span>
          </div>
          {(expectedPOs as any[]).length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-gray-200" />
              All POs received
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {(expectedPOs as any[]).map((po: any) => (
                <div
                  key={po.id}
                  className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/transit/gate-entry?po_id=${po.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700">{po.po_number}</p>
                    <p className="text-xs text-slate-400">{po.vendor?.name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-amber-600 font-semibold">Log →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="px-5 py-3 border-t border-[#E2E8F0]">
            <Link to="/transit/gate-entry" className="text-xs text-blue-600 hover:underline">
              Log new arrival →
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Gate Entry',      path: '/transit/gate-entry', icon: Plus },
          { label: 'QC Inspection',   path: '/warehouse/qc',       icon: ClipboardCheck },
          { label: 'Warehouse',       path: '/warehouse',          icon: Package },
        ].map(item => (
          <Link key={item.path} to={item.path}
            className="zoho-card px-4 py-4 flex flex-col items-center gap-2 text-center hover:border-blue-300 transition-colors">
            <item.icon className="h-6 w-6 text-[#2C64E3]" />
            <p className="text-xs font-semibold text-slate-600">{item.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
