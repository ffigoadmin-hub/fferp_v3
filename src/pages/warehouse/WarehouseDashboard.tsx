import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import {
  Package, ClipboardCheck, AlertTriangle,
  CheckCircle2, ChevronRight, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WarehouseDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: pendingQC = [] } = useQuery({
    queryKey: ['pending-qc', today],
    queryFn: async () => {
      const { data } = await supabase
        .from('purchase_order_items')
        .select(`
          id, product_id, received_qty, received_at,
          product:products(name, unit),
          po:purchase_orders(po_number, order_date, vendor:vendors(name))
        `)
        .eq('purchase_orders.order_date', today)
        .is('qc_grade', null)
        .not('received_qty', 'is', null)
        .limit(20);
      return data ?? [];
    },
  });

  const { data: qcToday = [] } = useQuery({
    queryKey: ['qc-today', today],
    queryFn: async () => {
      const { data } = await supabase
        .from('qc_inspections')
        .select('*, product:products(name)')
        .eq('inspection_date', today)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory-snapshot', (user as any)?.hub_id],
    queryFn: async () => {
      const query = supabase
        .from('inventory')
        .select('*, product:products(name, unit, sku_code)')
        .order('current_stock', { ascending: false })
        .limit(20);

      if ((user as any)?.hub_id) {
        query.eq('hub_id', (user as any).hub_id);
      }

      const { data } = await query;
      return data ?? [];
    },
  });

  const gradeA = (qcToday as any[]).filter(q => q.grade === 'A').length;
  const gradeB = (qcToday as any[]).filter(q => q.grade === 'B').length;
  const gradeC = (qcToday as any[]).filter(q => q.grade === 'C').length;
  const gradeD = (qcToday as any[]).filter(q => q.grade === 'D').length;
  const lowStock = (inventory as any[]).filter(i => i.current_stock < (i.min_stock_level ?? 50));

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 pt-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Warehouse Dashboard</h1>
          <p className="text-[13px] text-slate-500">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-zoho-secondary" onClick={() => navigate('/warehouse/inventory')}>
            Stock Report
          </button>
          <Link to="/warehouse/qc" className="btn-zoho-primary">
            <ClipboardCheck className="h-4 w-4 mr-2 inline" /> New QC
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Pending QC', value: pendingQC.length, icon: ClipboardCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'QC Done Today', value: qcToday.length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Stock Products', value: inventory.length, icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          {
            label: 'Stock Alerts', value: lowStock.length, icon: AlertTriangle,
            color: lowStock.length > 0 ? 'text-red-600' : 'text-slate-500',
            bg: lowStock.length > 0 ? 'bg-red-50' : 'bg-slate-50',
          },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 pt-5 pb-4 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div className={`p-2 ${card.bg} rounded-lg`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
              <p className="text-[13px] text-slate-500 font-medium mb-1">{card.label}</p>
              <p className="text-[24px] font-bold text-slate-800 tracking-tight">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {qcToday.length > 0 && (
            <div className="zoho-card p-6 border-slate-200/60 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Activity className="h-24 w-24" />
              </div>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 tracking-tight">Quality Distribution</h3>
                  <p className="text-xs text-slate-400">Yield analysis for today's intake</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#2C64E3] animate-pulse" />
                  <span className="text-[10px] font-bold text-[#2C64E3] uppercase tracking-wider">Live Metrics</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { grade: 'A', count: gradeA, label: 'Premium', color: 'text-green-600' },
                  { grade: 'B', count: gradeB, label: 'Standard', color: 'text-blue-600' },
                  { grade: 'C', count: gradeC, label: 'Fair', color: 'text-amber-500' },
                  { grade: 'D', count: gradeD, label: 'Rejected', color: 'text-red-500' },
                ].map(item => (
                  <div key={item.grade} className="space-y-3 p-1">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">Grade {item.grade}</p>
                        <p className="text-xs font-bold text-slate-600">{item.label}</p>
                      </div>
                      <p className={cn('text-2xl font-black leading-none', item.color)}>{item.count}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="zoho-card">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Awaiting QC</h2>
              <Link to="/warehouse/qc" className="text-xs font-bold text-[#2C64E3] hover:underline">Start Inspection</Link>
            </div>
            <div className="overflow-x-auto">
              {pendingQC.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="h-14 w-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                  </div>
                  <p className="text-slate-500 font-bold">All caught up!</p>
                  <p className="text-xs text-slate-400">No items currently awaiting QC.</p>
                </div>
              ) : (
                <table className="zoho-table w-full">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Reference</th>
                      <th className="text-right">Received Qty</th>
                      <th>Status</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {(pendingQC as any[]).map((item: any) => (
                      <tr key={item.id} className="group cursor-pointer hover:bg-slate-50/50" onClick={() => navigate('/warehouse/qc')}>
                        <td>
                          <div className="font-bold text-slate-800">{item.product?.name}</div>
                          {item.received_at && (
                            <div className="text-[11px] text-slate-400">Received at {format(new Date(item.received_at), 'h:mm a')}</div>
                          )}
                        </td>
                        <td>
                          <div className="font-medium text-slate-600">{item.po?.po_number}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-tighter">{item.po?.vendor?.name}</div>
                        </td>
                        <td className="text-right font-bold text-slate-800">
                          {item.received_qty} <span className="text-[10px] text-slate-400 font-normal ml-0.5">{item.product?.unit}</span>
                        </td>
                        <td>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
                            Pending QC
                          </span>
                        </td>
                        <td>
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#2C64E3] transition-colors" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="zoho-card">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Stock Levels</h2>
              <Link to="/warehouse/inventory" className="text-[10px] font-bold text-[#2C64E3] hover:underline">VIEW ALL</Link>
            </div>
            <div className="p-5 space-y-5">
              {(inventory as any[]).slice(0, 6).map((item: any) => {
                const isLow = item.current_stock < (item.min_stock_level ?? 50);
                return (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{item.product?.name}</p>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">{item.product?.sku_code}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-xs font-black', isLow ? 'text-red-600' : 'text-slate-800')}>
                          {item.current_stock} <span className="text-[9px] font-normal text-slate-400">{item.product?.unit}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {lowStock.length > 0 && (
            <div className="zoho-card border-l-4 border-l-red-500 bg-red-50/20 shadow-red-900/5">
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-red-100 rounded-md">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                  <h3 className="font-bold text-red-900 text-sm">Action Required</h3>
                </div>
                <p className="text-xs text-red-700/80 mb-4">
                  {lowStock.length} items are currently below their safety stock levels and require immediate replenishment.
                </p>
                <div className="space-y-2">
                  {lowStock.slice(0, 3).map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between text-[11px] font-bold text-red-800">
                      <span>{item.product?.name}</span>
                      <span>{item.current_stock} kg</span>
                    </div>
                  ))}
                  {lowStock.length > 3 && (
                    <p className="text-[10px] text-red-400 text-center pt-2">+{lowStock.length - 3} more alerts</p>
                  )}
                </div>
                <button
                  onClick={() => navigate('/purchase/demand')}
                  className="mt-5 w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-[11px] font-bold transition-colors shadow-sm shadow-red-200"
                >
                  Create Purchase Requisition
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
