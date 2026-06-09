import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Download, FileText, RefreshCw, TrendingUp, Package, Truck, Users, ShoppingBag, IndianRupee, CheckCircle2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

const REPORT_TYPES = [
  { id: 'sales', label: 'Daily Sales Report', icon: TrendingUp, color: 'bg-green-50 text-green-700', description: 'All orders, revenue by channel, hub-wise breakdown' },
  { id: 'inventory', label: 'Inventory Report', icon: Package, color: 'bg-blue-50 text-blue-700', description: 'Current stock levels, low stock alerts, movement' },
  { id: 'delivery', label: 'Delivery Report', icon: Truck, color: 'bg-purple-50 text-purple-700', description: 'Trip-wise delivery status, cash collected, returns' },
  { id: 'attendance', label: 'Attendance Report', icon: Users, color: 'bg-amber-50 text-amber-700', description: 'Daily login times, hourly reports submitted, EOD rate' },
  { id: 'purchase', label: 'Purchase Report', icon: FileText, color: 'bg-red-50 text-red-700', description: 'PO-wise purchases, vendor-wise, QC grade breakdown' },
  { id: 'collection', label: 'Cash Collection Report', icon: TrendingUp, color: 'bg-indigo-50 text-indigo-700', description: 'COD collected by driver, outstanding dues, UPI receipts' },
];

// Reports that have a dedicated detail page
const DETAIL_ROUTES: Record<string, string> = {
  sales:      '/reports/sales',
  inventory:  '/reports/inventory',
  delivery:   '/reports/delivery',
  attendance: '/reports/attendance',
  purchase:   '/reports/purchase',
  collection: '/reports/collection',
};

export default function ReportsDashboard() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [generating, setGenerating] = useState<string | null>(null);

  const { data: salesSummary } = useQuery({
    queryKey: ['reports-sales', selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_orders')
        .select('net_amount, status, payment_mode, hub_id')
        .eq('order_date', selectedDate);
      const orders = (data ?? []).filter(o => o.status !== 'cancelled');
      return {
        total: orders.length,
        revenue: orders.reduce((s, o) => s + (Number(o.net_amount) || 0), 0),
        cod: orders.filter(o => o.payment_mode === 'cod').length,
        credit: orders.filter(o => o.payment_mode === 'credit').length,
        delivered: orders.filter(o => o.status === 'delivered').length,
      };
    },
  });

  const generateReport = async (reportId: string) => {
    setGenerating(reportId);
    try {
      let data: any[] = [];
      const filename = `FF_${reportId}_${selectedDate}.xlsx`;
      let sheetName = reportId;

      if (reportId === 'sales') {
        const { data: orders } = await supabase
          .from('sales_orders')
          .select(`order_number, status, net_amount, payment_mode, order_date, customer:customers(shop_name, area, phone), hub:hubs(name)`)
          .eq('order_date', selectedDate)
          .order('created_at');

        data = (orders ?? []).map(o => ({
          'Order #': o.order_number,
          'Customer': (o as any).customer?.shop_name,
          'Area': (o as any).customer?.area,
          'Phone': (o as any).customer?.phone,
          'Hub': (o as any).hub?.name,
          'Amount (₹)': o.net_amount,
          'Payment': o.payment_mode?.toUpperCase(),
          'Status': o.status,
        }));
        sheetName = 'Sales';
      } else if (reportId === 'inventory') {
        const { data: inv } = await supabase
          .from('inventory')
          .select('current_stock, min_stock_level, product:products(name, unit), hub:hubs(name)')
          .order('current_stock');

        data = (inv ?? []).map((i: any) => ({
          'Product': i.product?.name,
          'Hub': i.hub?.name,
          'Stock (kg)': i.current_stock,
          'Min Level': i.min_stock_level ?? 50,
          'Status': i.current_stock < (i.min_stock_level ?? 50) ? '⚠️ Low Stock' : '✓ OK',
        }));
        sheetName = 'Inventory';
      } else if (reportId === 'delivery') {
        const { data: trips } = await supabase
          .from('logistics_trips')
          .select(`trip_number, status, vehicle_number, orders:trip_orders(delivery_status, cash_collected, driver_notes, order:sales_orders(order_number, net_amount, customer:customers(shop_name, area)))`)
          .eq('trip_date', selectedDate);

        data = [];
        (trips ?? []).forEach((trip: any) => {
          (trip.orders ?? []).forEach((stop: any) => {
            data.push({
              'Trip #': trip.trip_number,
              'Vehicle': trip.vehicle_number,
              'Customer': stop.order?.customer?.shop_name,
              'Area': stop.order?.customer?.area,
              'Order #': stop.order?.order_number,
              'Amount (₹)': stop.order?.net_amount,
              'Status': stop.delivery_status,
              'Cash Collected (₹)': stop.cash_collected ?? 0,
              'Notes': stop.driver_notes,
            });
          });
        });
        sheetName = 'Deliveries';
      } else if (reportId === 'attendance') {
        const { data: starts } = await supabase
          .from('day_starts')
          .select('login_time, user:profiles(role)')
          .eq('date', selectedDate);

        data = (starts ?? []).map((s: any) => ({
          'Role': s.user?.role?.replace('_', ' '),
          'Login Time': format(new Date(s.login_time), 'hh:mm a'),
        }));
        sheetName = 'Attendance';
      } else if (reportId === 'purchase') {
        const { data: pos } = await supabase
          .from('purchase_orders')
          .select(`po_number, order_date, status, total_amount, items:purchase_order_items(received_qty, unit_price, qc_grade, product:products(name))`)
          .eq('order_date', selectedDate);

        (pos ?? []).forEach((po: any) => {
          (po.items ?? []).forEach((item: any) => {
            data.push({
              'PO #': po.po_number,
              'Product': item.product?.name,
              'Received (kg)': item.received_qty,
              'Rate (₹/kg)': item.unit_price,
              'QC Grade': item.qc_grade ?? 'Pending',
              'Value (₹)': (Number(item.received_qty) * Number(item.unit_price)).toFixed(0),
              'PO Status': po.status,
            });
          });
        });
        sheetName = 'Purchases';
      } else if (reportId === 'collection') {
        const { data: collections } = await supabase
          .from('trip_orders')
          .select('cash_collected, delivery_status, order:sales_orders(order_number, net_amount, payment_mode, customer:customers(shop_name, area))')
          .eq('delivery_status', 'delivered')
          .gte('delivered_at', `${selectedDate}T00:00:00`)
          .lte('delivered_at', `${selectedDate}T23:59:59`);

        data = (collections ?? [])
          .filter((c: any) => c.order?.payment_mode === 'cod')
          .map((c: any) => ({
            'Customer': c.order?.customer?.shop_name,
            'Area': c.order?.customer?.area,
            'Order #': c.order?.order_number,
            'Bill Amount (₹)': c.order?.net_amount,
            'Cash Collected (₹)': c.cash_collected ?? 0,
            'Difference (₹)': ((c.order?.net_amount ?? 0) - (c.cash_collected ?? 0)).toFixed(0),
          }));
        sheetName = 'Cash Collections';
      }

      if (data.length === 0) {
        toast.error('No data found for this date');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, filename);
      toast.success(`${sheetName} report downloaded!`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">Generate and download ERP reports</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {salesSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Orders', value: salesSummary.total, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Revenue', value: `₹${(salesSummary.revenue / 1000).toFixed(1)}k`, icon: IndianRupee, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Delivered', value: salesSummary.delivered, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'COD Orders', value: salesSummary.cod, icon: ShoppingBag, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 pt-5 pb-4 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <div className={cn('p-2 rounded-lg', card.bg)}>
                    <card.icon className={cn('h-5 w-5', card.color)} />
                  </div>
                </div>
                <p className="text-[13px] text-slate-500 font-medium mb-1">{card.label}</p>
                <p className="text-[24px] font-bold text-slate-800 tracking-tight">{card.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {REPORT_TYPES.map(report => (
          <div key={report.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${report.color}`}>
                <report.icon className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-2">
                {DETAIL_ROUTES[report.id] && (
                  <button
                    onClick={() => navigate(DETAIL_ROUTES[report.id])}
                    className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View
                  </button>
                )}
                <button
                  onClick={() => generateReport(report.id)}
                  disabled={generating === report.id}
                  className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {generating === report.id ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {generating === report.id ? 'Generating...' : 'Download'}
                </button>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{report.label}</h3>
              <p className="text-xs text-gray-500 mt-1">{report.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800 font-medium">📧 Auto-Email Reports</p>
        <p className="text-xs text-blue-600 mt-1">
          Daily reports can be automatically emailed to management at 9 PM via Supabase Edge Functions.
          Configure in Admin → Settings → Email Reports.
        </p>
      </div>
    </div>
  );
}
