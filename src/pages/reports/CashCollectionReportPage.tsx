import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, Download, Search, RefreshCw, IndianRupee, AlertCircle, CheckCircle2, Wallet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export default function CashCollectionReportPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState('all'); // all | balanced | shortage
  const [downloading, setDownloading] = useState(false);

  const { data: collections = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['cash-collection-report', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_orders')
        .select(`
          id, cash_collected, delivery_status, delivered_at,
          order:sales_orders(order_number, net_amount, payment_mode, customer:customers(shop_name, area, phone))
        `)
        .eq('delivery_status', 'delivered')
        .gte('delivered_at', `${date}T00:00:00`)
        .lte('delivered_at', `${date}T23:59:59`);
      if (error) throw error;
      return (data ?? [])
        .filter((c: any) => c.order?.payment_mode === 'cod')
        .map((c: any) => ({
          ...c,
          billAmount: Number(c.order?.net_amount || 0),
          cashCollected: Number(c.cash_collected || 0),
          difference: Number(c.order?.net_amount || 0) - Number(c.cash_collected || 0),
        }));
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return collections.filter((c: any) => {
      const matchSearch = !q ||
        (c.order?.customer?.shop_name || '').toLowerCase().includes(q) ||
        (c.order?.customer?.area || '').toLowerCase().includes(q) ||
        (c.order?.order_number || '').toLowerCase().includes(q);
      const matchDiff = diffFilter === 'all' ||
        (diffFilter === 'balanced' ? c.difference === 0 : c.difference !== 0);
      return matchSearch && matchDiff;
    });
  }, [collections, search, diffFilter]);

  const summary = useMemo(() => ({
    total:     filtered.length,
    billed:    filtered.reduce((s: number, c: any) => s + c.billAmount, 0),
    collected: filtered.reduce((s: number, c: any) => s + c.cashCollected, 0),
    shortage:  filtered.filter((c: any) => c.difference > 0).length,
  }), [filtered]);

  const downloadXLSX = async () => {
    if (!filtered.length) { toast.error('No data to download'); return; }
    setDownloading(true);
    try {
      const rows = filtered.map((c: any) => ({
        'Customer':           c.order?.customer?.shop_name || '—',
        'Area':               c.order?.customer?.area || '—',
        'Phone':              c.order?.customer?.phone || '—',
        'Order #':            c.order?.order_number || '—',
        'Bill Amount (₹)':   c.billAmount,
        'Cash Collected (₹)':c.cashCollected,
        'Difference (₹)':    c.difference,
        'Status':             c.difference === 0 ? 'Balanced' : c.difference > 0 ? 'Shortage' : 'Excess',
        'Delivered At':       c.delivered_at ? format(new Date(c.delivered_at), 'hh:mm a') : '—',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [20,14,14,12,14,16,14,10,12].map(w => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cash Collections');
      XLSX.writeFile(wb, `FF_Cash_Collection_${date}.xlsx`);
      toast.success('Cash collection report downloaded!');
    } catch (e: any) { toast.error(e.message); }
    finally { setDownloading(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 font-medium">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div>
            <h1 className="text-xl font-black text-gray-900">Cash Collection Report</h1>
            <p className="text-xs text-gray-400 mt-0.5">COD collected by driver · outstanding dues · UPI receipts</p>
          </div>
        </div>
        <button onClick={downloadXLSX} disabled={downloading || !filtered.length}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold shadow-sm disabled:opacity-50">
          {downloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" />
          </div>
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search customer, area, order #..."
              className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" />
          </div>
          <select value={diffFilter} onChange={e => setDiffFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50">
            <option value="all">All Records</option>
            <option value="balanced">Balanced Only</option>
            <option value="shortage">Shortage / Excess</option>
          </select>
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'COD Orders',    value: summary.total,                              icon: Wallet,       color: 'bg-indigo-50 text-indigo-600' },
          { label: 'Billed (₹)',    value: `₹${summary.billed.toLocaleString()}`,     icon: IndianRupee,  color: 'bg-blue-50 text-blue-600' },
          { label: 'Collected (₹)', value: `₹${summary.collected.toLocaleString()}`,  icon: CheckCircle2, color: 'bg-green-50 text-green-600' },
          { label: 'Shortages',     value: summary.shortage,                           icon: AlertCircle,  color: 'bg-red-50 text-red-600' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.color}`}>
              <c.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-black text-gray-900">{c.value}</p>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-black text-gray-900">Collections — {format(new Date(date + 'T00:00:00'), 'dd MMMM yyyy')}</p>
          <p className="text-xs text-gray-400">{filtered.length} records</p>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin text-indigo-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Wallet className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-semibold">No cash collection records found</p>
            <p className="text-xs mt-1">Try a different date</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Customer','Area','Phone','Order #','Bill (₹)','Collected (₹)','Difference (₹)','Status'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-[11px] font-black uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c: any) => (
                  <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${c.difference > 0 ? 'bg-red-50/20' : ''}`}>
                    <td className="py-3 px-4 font-semibold text-gray-900">{c.order?.customer?.shop_name || '—'}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{c.order?.customer?.area || '—'}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{c.order?.customer?.phone || '—'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-700">{c.order?.order_number || '—'}</td>
                    <td className="py-3 px-4 font-bold text-gray-900">₹{c.billAmount.toLocaleString()}</td>
                    <td className="py-3 px-4 font-bold text-green-700">₹{c.cashCollected.toLocaleString()}</td>
                    <td className="py-3 px-4 font-bold">
                      <span className={c.difference > 0 ? 'text-red-600' : c.difference < 0 ? 'text-blue-600' : 'text-gray-400'}>
                        {c.difference > 0 ? '-' : c.difference < 0 ? '+' : ''}₹{Math.abs(c.difference).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {c.difference === 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Balanced</span>
                      ) : c.difference > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">Shortage</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">Excess</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Footer totals */}
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={4} className="py-3 px-4 font-black text-gray-700 text-sm">Total</td>
                  <td className="py-3 px-4 font-black text-gray-900">₹{summary.billed.toLocaleString()}</td>
                  <td className="py-3 px-4 font-black text-green-700">₹{summary.collected.toLocaleString()}</td>
                  <td className="py-3 px-4 font-black">
                    <span className={(summary.billed - summary.collected) > 0 ? 'text-red-600' : 'text-gray-400'}>
                      ₹{Math.abs(summary.billed - summary.collected).toLocaleString()}
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
