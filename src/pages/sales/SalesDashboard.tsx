import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  ShoppingBag, TrendingUp, Clock, CheckCircle2,
  Plus, IndianRupee, Users, ChevronRight,
  Download, Package, Zap, Eye, ArrowRight,
  RefreshCw, ShoppingCart, Building2, Sun, Moon,
  AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:      { label: 'Draft',      className: 'bg-slate-100 text-slate-600' },
  pending:    { label: 'Pending',    className: 'bg-amber-100 text-amber-700' },
  confirmed:  { label: 'Confirmed',  className: 'bg-blue-100 text-[#2C64E3]' },
  dispatched: { label: 'Dispatched', className: 'bg-purple-100 text-purple-700' },
  delivered:  { label: 'Delivered',  className: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Cancelled',  className: 'bg-red-100 text-red-600' },
  partial:    { label: 'Partial',    className: 'bg-orange-100 text-orange-700' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', cfg.className)}>
      {cfg.label}
    </span>
  );
}

/* ── Shift Panel Component ───────────────────────────────────────────── */
function ShiftPanel({
  shift,
  orders,
  hubs,
  onGeneratePO,
  generatingPO,
}: {
  shift: 1 | 2;
  orders: any[];
  hubs: any[];
  onGeneratePO: (shiftNum: number) => void;
  generatingPO: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const totalValue = orders.reduce((s, o) => s + (Number(o.net_amount) || 0), 0);

  const hubBreakdown = hubs.map(hub => {
    const hubOrders = orders.filter(o => o.hub_id === hub.id);
    const hubValue  = hubOrders.reduce((s, o) => s + (Number(o.net_amount) || 0), 0);
    return { ...hub, orders: hubOrders, value: hubValue };
  });

  const isShift1 = shift === 1;

  return (
    <div className={`rounded-2xl border-2 overflow-hidden ${isShift1 ? 'border-blue-200' : 'border-orange-200'}`}>
      {/* Header */}
      <div className={`px-5 py-4 ${isShift1 ? 'bg-blue-50' : 'bg-orange-50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isShift1
              ? <Sun className="h-5 w-5 text-blue-600" />
              : <Moon className="h-5 w-5 text-orange-600" />}
            <div>
              <p className={`font-bold text-sm ${isShift1 ? 'text-blue-800' : 'text-orange-800'}`}>
                Shift {shift} — {isShift1 ? '10:00 AM to 7:30 PM' : '7:30 PM to 11:00 PM'}
              </p>
              <p className={`text-[11px] ${isShift1 ? 'text-blue-600' : 'text-orange-600'}`}>
                {isShift1
                  ? '📋 PO → Operations Manager (approval required)'
                  : '⚡ PO → Purchase Executive (direct, no approval)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className={`text-xl font-black ${isShift1 ? 'text-blue-700' : 'text-orange-700'}`}>{orders.length}</p>
              <p className="text-[10px] text-slate-500">orders</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${isShift1 ? 'text-blue-700' : 'text-orange-700'}`}>
                ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] text-slate-500">value</p>
            </div>
          </div>
        </div>

        {/* Hub breakdown pills */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {hubBreakdown.map(hub => (
            <div key={hub.id}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
                hub.orders.length > 0
                  ? isShift1 ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                  : 'bg-gray-100 text-gray-400'
              }`}>
              <Building2 className="h-3 w-3" />
              {hub.name.replace(' Hub', '')}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                hub.orders.length > 0
                  ? isShift1 ? 'bg-blue-200 text-blue-900' : 'bg-orange-200 text-orange-900'
                  : 'bg-gray-200 text-gray-500'
              }`}>{hub.orders.length}</span>
            </div>
          ))}
          {orders.filter(o => !o.hub_id).length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-red-100 text-red-700">
              <AlertCircle className="h-3 w-3" />
              No Hub: {orders.filter(o => !o.hub_id).length}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="bg-white">
        {/* Generate PO button */}
        {orders.length > 0 && (
          <div className="px-5 py-3 border-b border-gray-100">
            <button
              onClick={() => onGeneratePO(shift)}
              disabled={generatingPO}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 ${
                isShift1
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-200'
                  : 'bg-orange-500 hover:bg-orange-600 shadow-sm shadow-orange-200'
              }`}
            >
              {generatingPO
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating POs…</>
                : <><Zap className="h-4 w-4" />
                    Generate {hubBreakdown.filter(h => h.orders.length > 0).length} Hub POs for Shift {shift}
                    <ArrowRight className="h-4 w-4" />
                  </>}
            </button>
            <p className="text-[10px] text-center text-slate-400 mt-1.5">
              {isShift1
                ? 'POs will be sent to Operations Manager for approval'
                : 'POs will go directly to Purchase Executive — no approval needed'}
            </p>
          </div>
        )}

        {/* Hub detail cards */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {hubBreakdown.map(hub => (
            <div key={hub.id} className={`rounded-xl border p-3 ${hub.orders.length > 0 ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Building2 className={`h-3.5 w-3.5 ${hub.orders.length > 0 ? 'text-purple-500' : 'text-gray-300'}`} />
                <p className={`text-xs font-bold ${hub.orders.length > 0 ? 'text-slate-800' : 'text-gray-400'}`}>{hub.name}</p>
              </div>
              {hub.orders.length === 0 ? (
                <p className="text-[10px] text-gray-400">No orders this shift</p>
              ) : (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Orders</span>
                    <span className="font-bold text-slate-800">{hub.orders.length}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Value</span>
                    <span className="font-bold text-green-700">₹{hub.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">PO #</span>
                    <span className="font-mono font-bold text-purple-600 text-[10px]">
                      PO-{isShift1 ? 'DAY' : 'NGT'}-{hub.address?.substring(0, 2).toUpperCase() ?? 'XX'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Expandable order list */}
        {orders.length > 0 && (
          <>
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-slate-500 hover:text-slate-700 border-t border-gray-100 hover:bg-gray-50 transition-colors"
            >
              {expanded ? <><ChevronUp className="h-3.5 w-3.5" /> Hide orders</> : <><ChevronDown className="h-3.5 w-3.5" /> Show {orders.length} orders</>}
            </button>
            {expanded && (
              <div className="overflow-x-auto border-t border-gray-100">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Order #</th>
                      <th className="px-3 py-2 text-left font-semibold">Customer</th>
                      <th className="px-3 py-2 text-left font-semibold">Hub</th>
                      <th className="px-3 py-2 text-right font-semibold">Value</th>
                      <th className="px-3 py-2 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {orders.map((order: any) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono font-bold text-blue-600">{order.order_number ?? order.id?.slice(0, 8)}</td>
                        <td className="px-3 py-2 font-semibold text-gray-800">{order.customer_name}</td>
                        <td className="px-3 py-2 text-gray-500">{order.hub_name ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-900">₹{Number(order.net_amount || 0).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-center"><StatusBadge status={order.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {orders.length === 0 && (
          <div className="px-5 py-6 text-center">
            <p className="text-sm text-slate-400">No orders in Shift {shift} yet today</p>
            <p className="text-[11px] text-slate-300 mt-1">
              {isShift1 ? 'Orders placed 10 AM – 7:30 PM appear here' : 'Orders placed 7:30 PM – 11 PM appear here'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Dashboard ──────────────────────────────────────────────────── */
export default function SalesDashboard() {
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [generatingPO, setGeneratingPO] = useState(false);

  /* Today's orders from Supabase */
  const { data: todayOrders = [], refetch: refetchOrders } = useQuery({
    queryKey: ['sales-orders-today', today],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_orders')
        .select('id, order_number, customer_name, hub_id, hub_name, shift, status, net_amount, total_amount, order_date, created_at')
        .gte('order_date', today)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  /* Hubs */
  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-active'],
    queryFn: async () => {
      const { data } = await supabase.from('hubs').select('id, name, address, city').eq('is_active', true).order('name');
      return data ?? [];
    },
  });

  /* Stats */
  const totalValue   = (todayOrders as any[]).reduce((s, o) => s + (Number(o.net_amount) || 0), 0);
  const deliveredCnt = (todayOrders as any[]).filter(o => o.status === 'delivered').length;
  const pendingCnt   = (todayOrders as any[]).filter(o => ['confirmed','pending'].includes(o.status)).length;

  /* Generate PO for a specific hub (all of today's orders for that hub) */
  const handleGenerateHubPO = async (hubId: string) => {
    setGeneratingPO(true);
    try {
      const hub = (hubs as any[]).find(h => h.id === hubId);
      if (!hub) { toast.error('Hub not found'); return; }

      const hubOrders = (todayOrders as any[]).filter(o => o.hub_id === hubId);
      if (hubOrders.length === 0) { toast.error('No orders for this hub today'); setGeneratingPO(false); return; }

      const hubCode  = (hub.name ?? hub.city ?? 'HUB').substring(0, 3).toUpperCase();
      const poNumber = `PO-${hubCode}-${format(new Date(), 'ddMMyy-HHmm')}`;
      const totalAmt = hubOrders.reduce((s: number, o: any) => s + (Number(o.net_amount) || 0), 0);

      const { data: newPO, error } = await supabase
        .from('purchase_orders')
        .insert({
          po_number:    poNumber,
          status:       'pending_approval',
          hub_id:       hubId,
          hub_name:     hub.name,
          total_amount: totalAmt,
          notes:        `Auto-generated — ${hub.name} — ${hubOrders.length} orders — ${today}`,
        })
        .select().single();

      if (error) throw error;

      // Link sales orders to PO
      if (newPO) {
        await supabase.from('po_sales_order_links').insert(
          hubOrders.map((o: any) => ({ po_id: newPO.id, sales_order_id: o.id }))
        );
      }

      toast.success(`✅ PO ${poNumber} created for ${hub.name} — ${hubOrders.length} orders`);
      setTimeout(() => navigate('/purchase/auto-po'), 1500);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to generate PO');
    } finally {
      setGeneratingPO(false);
    }
  };

  /* Export CSV */
  const handleExportCSV = () => {
    if (!(todayOrders as any[]).length) { toast.error('No orders to export'); return; }
    const headers = ['Order #', 'Customer', 'Hub', 'Shift', 'Status', 'Value (₹)', 'Date'];
    const rows = (todayOrders as any[]).map(o => [
      o.order_number ?? o.id?.slice(0, 8),
      o.customer_name,
      o.hub_name ?? '—',
      o.shift ? `Shift ${o.shift}` : '—',
      o.status,
      Number(o.net_amount || 0),
      o.order_date,
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `Sales_${today}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${(todayOrders as any[]).length} orders`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 pt-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Sales Dashboard</h1>
          <p className="text-[13px] text-slate-500">{format(new Date(), 'EEEE, d MMMM yyyy · h:mm a')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetchOrders()} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
          <button onClick={handleExportCSV} className="btn-zoho-secondary">
            <Download className="h-4 w-4 mr-2 inline" /> Export
          </button>
          <Link to="/sales/new-order" className="btn-zoho-primary">
            <Plus className="h-4 w-4 mr-1 inline" /> New Order
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Orders", value: (todayOrders as any[]).length, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Value',    value: `₹${totalValue >= 1000 ? (totalValue / 1000).toFixed(1) + 'k' : totalValue}`, icon: IndianRupee, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Delivered',      value: deliveredCnt, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Pending',        value: pendingCnt,   icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className={`p-3 ${card.bg} rounded-xl`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-[13px] text-slate-500 font-medium">{card.label}</p>
              <p className="text-[22px] font-bold text-slate-800">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* PO Quick Actions */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-50 rounded-2xl border border-slate-100 px-5 py-3">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Purchase Orders</span>
        <button
          onClick={() => navigate('/purchase/auto-po')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors shadow-sm"
        >
          <Package className="h-3.5 w-3.5" /> Auto PO
        </button>
        <button
          onClick={() => navigate('/ff-operations/eod-po-engine')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-colors shadow-sm"
        >
          <Zap className="h-3.5 w-3.5 text-amber-500" /> EOD PO Engine
        </button>
        <button
          onClick={() => navigate('/purchase/orders')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-colors shadow-sm"
        >
          <Eye className="h-3.5 w-3.5" /> View All POs
        </button>
      </div>

      {/* Overall Orders by Hub */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-500" /> Today's Orders by Hub
          </h2>
          <span className="text-[11px] text-slate-400">{(todayOrders as any[]).length} total orders · ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(hubs as any[]).map(hub => {
            const hubOrders = (todayOrders as any[]).filter(o => o.hub_id === hub.id);
            const hubValue  = hubOrders.reduce((s: number, o: any) => s + (Number(o.net_amount) || 0), 0);
            const delivered = hubOrders.filter((o: any) => o.status === 'delivered').length;
            const pending   = hubOrders.filter((o: any) => ['confirmed','pending'].includes(o.status)).length;
            return (
              <div key={hub.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    <span className="font-bold text-slate-800 text-sm">{hub.name ?? hub.city}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">{hubOrders.length} orders</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[18px] font-bold text-slate-800">{hubOrders.length}</p>
                    <p className="text-[10px] text-slate-400">Total</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-[18px] font-bold text-green-700">{delivered}</p>
                    <p className="text-[10px] text-green-500">Delivered</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2">
                    <p className="text-[18px] font-bold text-amber-700">{pending}</p>
                    <p className="text-[10px] text-amber-500">Pending</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                  <span className="text-[11px] text-slate-400">Total Value</span>
                  <span className="text-sm font-bold text-slate-800">₹{hubValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                {/* Generate PO button for this hub */}
                <button
                  disabled={generatingPO || hubOrders.length === 0}
                  onClick={() => handleGenerateHubPO(hub.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl border border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {generatingPO ? <><RefreshCw className="h-3 w-3 animate-spin" /> Generating...</> : <><ShoppingCart className="h-3 w-3" /> Generate PO</>}
                </button>
              </div>
            );
          })}
          {(hubs as any[]).length === 0 && (
            <div className="md:col-span-3 py-8 text-center text-slate-400 text-sm">No hubs configured yet</div>
          )}
        </div>
      </div>

      {/* Bottom grid: Recent orders + Quick links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-blue-500" />
                <h2 className="font-bold text-slate-800 text-sm">All Today's Orders</h2>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">{(todayOrders as any[]).length}</span>
              </div>
              <Link to="/sales/orders" className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {(todayOrders as any[]).length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingBag className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No orders today yet</p>
                <Link to="/sales/new-order" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline">
                  <Plus className="h-3.5 w-3.5" /> Create first order
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold">Order #</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Customer</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Hub</th>
                      <th className="px-4 py-2.5 text-center font-semibold">Shift</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Value (₹)</th>
                      <th className="px-4 py-2.5 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(todayOrders as any[]).slice(0, 15).map((order: any) => (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/sales/orders/${order.id}`)}>
                        <td className="px-4 py-3">
                          <span className="font-bold text-blue-600 text-xs font-mono">{order.order_number ?? order.id?.slice(0, 8)}</span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800 text-xs">{order.customer_name}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{order.hub_name ?? <span className="text-amber-500 font-semibold">No hub</span>}</td>
                        <td className="px-4 py-3 text-center">
                          {order.shift
                            ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${order.shift === 1 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                {order.shift === 1 ? '🌅 S1' : '🌙 S2'}
                              </span>
                            : <span className="text-gray-300 text-[10px]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 text-xs">
                          ₹{Number(order.net_amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-center"><StatusBadge status={order.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Sales Insight */}
          <div className="zoho-card p-6 bg-slate-900 text-white border-none shadow-blue-900/10 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sales Insight</span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {(todayOrders as any[]).length > 0
                ? <>Average order value is{' '}
                    <span className="text-white font-bold">
                      ₹{Math.round(totalValue / (todayOrders as any[]).length).toLocaleString('en-IN')}
                    </span>
                    {' '}today. {(todayOrders as any[]).length > 5 ? 'High volume.' : 'Steady pace.'}</>
                : 'No orders yet today. Create the first order to get started.'}
            </p>
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Total orders</span>
                <span className="text-blue-300 font-bold">{(todayOrders as any[]).length}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Delivered</span>
                <span className="text-green-300 font-bold">{deliveredCnt}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Pending</span>
                <span className="text-amber-300 font-bold">{pendingCnt}</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/purchase/auto-po')}
              className="mt-4 w-full py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <ShoppingCart className="h-3.5 w-3.5" /> Go to Purchase Orders
            </button>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h2 className="font-bold text-slate-800 px-1">Quick Links</h2>
            {[
              { label: 'Customer Management', desc: 'Manage shop profiles',      to: '/sales/customers',  icon: Users,       color: 'text-[#2C64E3]', bg: 'bg-blue-50' },
              { label: 'Sales Targets',        desc: 'Track team performance',   to: '/sales/targets',    icon: TrendingUp,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Collection Entry',     desc: 'Log payment collections',  to: '/sales/collection', icon: IndianRupee, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Purchase Orders',      desc: 'View & manage POs',        to: '/purchase/auto-po', icon: Package,     color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map(item => (
              <Link key={item.to} to={item.to}
                className="zoho-card p-4 hover:border-blue-300 transition-all group flex items-center gap-4">
                <div className={cn('p-2.5 rounded-lg group-hover:scale-110 transition-transform', item.bg)}>
                  <item.icon className={cn('h-5 w-5', item.color)} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{item.label}</p>
                  <p className="text-[11px] text-slate-500">{item.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 ml-auto group-hover:translate-x-1 transition-transform" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
