import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, Download, Search, RefreshCw, TrendingUp, IndianRupee, CheckCircle2, ShoppingBag } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  draft:      'bg-slate-100 text-slate-600',
  confirmed:  'bg-blue-100 text-blue-700',
  dispatched: 'bg-purple-100 text-purple-700',
  delivered:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-600',
  partial:    'bg-orange-100 text-orange-700',
};

const PAYMENT_COLORS: Record<string, string> = {
  cod:    'bg-amber-100 text-amber-700',
  credit: 'bg-blue-100 text-blue-700',
  upi:    'bg-purple-100 text-purple-700',
  cash:   'bg-green-100 text-green-700',
};

// Collection is only tracked for orders that get paid after delivery --
// mirrors CollectionEntryPage.tsx's own `.in('payment_mode', [...])` filter.
const COLLECTIBLE_PAYMENT_MODES = ['cod', 'credit', 'partial'];

const COLLECTION_STATUS_COLORS: Record<string, string> = {
  not_collected: 'bg-slate-100 text-slate-500',
  pending:       'bg-amber-100 text-amber-700',
  verified:      'bg-green-100 text-green-700',
};

export default function DailySalesReportPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [downloading, setDownloading] = useState(false);

  const { data: orders = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sales-report', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          id, order_number, status, net_amount, payment_mode, order_date, created_at,
          customer:customers(shop_name, area, phone),
          hub:hubs(name)
        `)
        .eq('order_date', date)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const orderIds = useMemo(() => orders.map((o: any) => o.id), [orders]);

  // Collection status per order -- cash_collections.order_id is a real FK, so
  // this is an exact per-row match (not the fuzzy text match credit notes need
  // below). A collection can land days after the order itself, so this is
  // fetched by order id, not by collection_date.
  const { data: collections = [] } = useQuery({
    queryKey: ['sales-report-collections', orderIds],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_collections')
        .select('order_id, collected_amount, status, verified_at')
        .in('order_id', orderIds);
      if (error) throw error;
      return data ?? [];
    },
  });
  const collectionByOrder = useMemo(() => {
    const map = new Map<string, any>();
    (collections as any[]).forEach(c => map.set(c.order_id, c));
    return map;
  }, [collections]);

  // Credit notes have no order_id column -- only a free-text invoice_reference
  // -- so there's no reliable per-order match. Shown as its own "issued this
  // day" list instead of forcing a fuzzy join onto the orders table.
  const { data: creditNotes = [] } = useQuery({
    queryKey: ['sales-report-credit-notes', date],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('credit_notes')
        .select('id, credit_note_number, customer_name, invoice_reference, amount, status, issued_date')
        .eq('issued_date', date)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const getCollection = (order: any): { label: string; key: string; amount: number | null } => {
    if (!COLLECTIBLE_PAYMENT_MODES.includes(order.payment_mode)) return { label: '—', key: 'na', amount: null };
    const c = collectionByOrder.get(order.id);
    if (!c) return { label: 'Not Collected', key: 'not_collected', amount: null };
    if (c.verified_at) return { label: 'Verified', key: 'verified', amount: Number(c.collected_amount) };
    return { label: `Pending (${(c.status || 'collected')})`, key: 'pending', amount: Number(c.collected_amount) };
  };

  const creditNoteSummary = useMemo(() => ({
    count: (creditNotes as any[]).length,
    total: (creditNotes as any[]).reduce((s, c) => s + Number(c.amount || 0), 0),
  }), [creditNotes]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o: any) => {
      const matchSearch = !q ||
        (o.order_number || '').toLowerCase().includes(q) ||
        (o.customer?.shop_name || '').toLowerCase().includes(q) ||
        (o.customer?.area || '').toLowerCase().includes(q) ||
        (o.hub?.name || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || o.status === statusFilter;
      const matchPayment = paymentFilter === 'all' || o.payment_mode === paymentFilter;
      return matchSearch && matchStatus && matchPayment;
    });
  }, [orders, search, statusFilter, paymentFilter]);

  const collectionSummary = useMemo(() => {
    const collectible = filtered.filter((o: any) => COLLECTIBLE_PAYMENT_MODES.includes(o.payment_mode));
    let verifiedAmt = 0, pendingAmt = 0, notCollected = 0;
    collectible.forEach((o: any) => {
      const c = getCollection(o);
      if (c.key === 'verified') verifiedAmt += c.amount || 0;
      else if (c.key === 'pending') pendingAmt += c.amount || 0;
      else notCollected++;
    });
    return { collectibleCount: collectible.length, verifiedAmt, pendingAmt, notCollected };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, collectionByOrder]);

  const summary = useMemo(() => {
    const active = filtered.filter((o: any) => o.status !== 'cancelled');
    return {
      total:    filtered.length,
      revenue:  active.reduce((s: number, o: any) => s + (Number(o.net_amount) || 0), 0),
      delivered: filtered.filter((o: any) => o.status === 'delivered').length,
      cod:      filtered.filter((o: any) => o.payment_mode === 'cod').length,
    };
  }, [filtered]);

  const downloadXLSX = async () => {
    if (!filtered.length) { toast.error('No data to download'); return; }
    setDownloading(true);
    try {
      const rows = filtered.map((o: any) => {
        const c = getCollection(o);
        return {
          'Order #':      o.order_number,
          'Customer':     o.customer?.shop_name || '—',
          'Area':         o.customer?.area || '—',
          'Phone':        o.customer?.phone || '—',
          'Hub':          o.hub?.name || '—',
          'Amount (₹)':  o.net_amount,
          'Payment':      (o.payment_mode || '—').toUpperCase(),
          'Collection':   c.key === 'na' ? '—' : c.label,
          'Collected (₹)': c.amount ?? '—',
          'Status':       o.status,
          'Date':         o.order_date,
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [12, 20, 14, 14, 12, 12, 10, 16, 14, 12, 12].map(w => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sales');

      if ((creditNotes as any[]).length > 0) {
        const cnRows = (creditNotes as any[]).map(c => ({
          'Credit Note #':    c.credit_note_number,
          'Customer':         c.customer_name,
          'Invoice Ref':      c.invoice_reference || '—',
          'Amount (₹)':      c.amount,
          'Status':           c.status,
          'Issued Date':      c.issued_date,
        }));
        const cnWs = XLSX.utils.json_to_sheet(cnRows);
        cnWs['!cols'] = [16, 20, 16, 12, 10, 12].map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, cnWs, 'Credit Notes');
      }

      XLSX.writeFile(wb, `FF_Daily_Sales_${date}.xlsx`);
      toast.success('Sales report downloaded!');
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
            <h1 className="text-xl font-black text-gray-900">Daily Sales Report</h1>
            <p className="text-xs text-gray-400 mt-0.5">All orders · revenue by channel · hub-wise breakdown</p>
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
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50" />
          </div>
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search order #, customer, area, hub..."
              className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50">
            <option value="all">All Status</option>
            {['draft','confirmed','dispatched','delivered','cancelled','partial'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
            ))}
          </select>
          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50">
            <option value="all">All Payment</option>
            {['cod','credit','upi','cash'].map(p => (
              <option key={p} value={p}>{p.toUpperCase()}</option>
            ))}
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
          { label: 'Total Orders', value: summary.total,                           icon: ShoppingBag,  color: 'bg-blue-50 text-blue-600' },
          { label: 'Revenue',      value: `₹${summary.revenue.toLocaleString()}`, icon: IndianRupee,  color: 'bg-green-50 text-green-600' },
          { label: 'Delivered',    value: summary.delivered,                       icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'COD Orders',   value: summary.cod,                             icon: TrendingUp,   color: 'bg-amber-50 text-amber-600' },
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

      {/* Collection & Credit Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-3">Collection Status — COD / Credit Orders</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-lg font-black text-green-700">₹{collectionSummary.verifiedAmt.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400 font-semibold uppercase">Verified</p>
            </div>
            <div>
              <p className="text-lg font-black text-amber-600">₹{collectionSummary.pendingAmt.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400 font-semibold uppercase">Pending</p>
            </div>
            <div>
              <p className="text-lg font-black text-slate-500">{collectionSummary.notCollected}</p>
              <p className="text-[10px] text-gray-400 font-semibold uppercase">Not Collected</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-3">Credit Notes Issued This Day</p>
          {creditNoteSummary.count === 0 ? (
            <p className="text-sm text-gray-400 py-2">None issued on this date</p>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-black text-gray-900">{creditNoteSummary.count}</p>
                <p className="text-[10px] text-gray-400 font-semibold uppercase">Note{creditNoteSummary.count === 1 ? '' : 's'}</p>
              </div>
              <p className="text-lg font-black text-red-600">-₹{creditNoteSummary.total.toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>

      {/* Credit notes detail */}
      {creditNoteSummary.count > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-black text-gray-900">Credit Notes — {format(new Date(date + 'T00:00:00'), 'dd MMMM yyyy')}</p>
          </div>
          <div className="divide-y divide-gray-50">
            {(creditNotes as any[]).map(c => (
              <div key={c.id} className="px-5 py-2.5 flex items-center justify-between text-sm">
                <div>
                  <span className="font-mono text-xs text-blue-600">{c.credit_note_number}</span>
                  <span className="text-gray-800 font-semibold ml-2">{c.customer_name}</span>
                  {c.invoice_reference && <span className="text-gray-400 text-xs ml-2">({c.invoice_reference})</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    c.status === 'applied' ? 'bg-emerald-100 text-emerald-700' : c.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'
                  }`}>{c.status}</span>
                  <span className="font-black text-red-600">-₹{Number(c.amount).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-black text-gray-900">Orders — {format(new Date(date + 'T00:00:00'), 'dd MMMM yyyy')}</p>
          <p className="text-xs text-gray-400">{filtered.length} records</p>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin text-green-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <ShoppingBag className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-semibold">No orders found</p>
            <p className="text-xs mt-1">Try a different date or clear filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Order #','Customer','Area','Phone','Hub','Amount (₹)','Payment','Collection','Status'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-[11px] font-black uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((o: any) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-gray-900 text-xs">{o.order_number}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{o.customer?.shop_name || '—'}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{o.customer?.area || '—'}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{o.customer?.phone || '—'}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{o.hub?.name || '—'}</td>
                    <td className="py-3 px-4 font-black text-gray-900">₹{Number(o.net_amount).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${PAYMENT_COLORS[o.payment_mode] || 'bg-gray-100 text-gray-500'}`}>
                        {o.payment_mode || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {(() => {
                        const c = getCollection(o);
                        return c.key === 'na' ? (
                          <span className="text-gray-300 text-xs">—</span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${COLLECTION_STATUS_COLORS[c.key] || 'bg-gray-100 text-gray-500'}`}>
                            {c.label}{c.amount != null ? ` · ₹${c.amount.toLocaleString()}` : ''}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-500'}`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
