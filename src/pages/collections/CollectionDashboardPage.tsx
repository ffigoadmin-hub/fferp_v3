// @ts-nocheck
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import {
  Search, Download, RefreshCw, IndianRupee,
  AlertCircle, CheckCircle2, Wallet, Users, Building2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Roles that see ALL collections; others see only their hub/today
const FULL_ACCESS = ['admin', 'ceo', 'gm', 'ff_operations_manager', 'accounts', 'l1_manager', 'auditor'];

export default function CollectionDashboardPage() {
  const { user } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const isManager = FULL_ACCESS.includes(role);

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [downloading, setDownloading] = useState(false);

  const { data: collections = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['collections-dashboard', date, role, user?.id],
    queryFn: async () => {
      let q = supabase
        .from('cash_collections')
        .select(`
          *,
          collector:profiles!cash_collections_collected_by_fkey(name, role),
          hub:hubs(name)
        `)
        .eq('collection_date', date)
        .order('created_at', { ascending: false });

      // Sales team: only see collections for their hub (if hub_id set on profile)
      if (!isManager && user?.hub_id) {
        q = q.eq('hub_id', user.hub_id);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((c: any) => {
        const orderAmt  = Number(c.order_amount || 0);
        const collected = Number(c.collected_amount || 0);
        return {
          ...c,
          orderAmt,
          collected,
          diff:          orderAmt - collected,   // calculated in app (no DB generated column)
          hubName:       c.hub?.name || '—',
          collectorName: c.collector?.name || '—',
        };
      });
    },
    enabled: !!user?.id,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return collections.filter((c: any) => {
      const matchSearch = !q ||
        (c.shop_name || '').toLowerCase().includes(q) ||
        (c.area || '').toLowerCase().includes(q) ||
        (c.order_number || '').toLowerCase().includes(q) ||
        (c.collector?.name || '').toLowerCase().includes(q);
      const matchMode   = modeFilter   === 'all' || c.payment_mode === modeFilter;
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchSearch && matchMode && matchStatus;
    });
  }, [collections, search, modeFilter, statusFilter]);

  const summary = useMemo(() => ({
    total:     filtered.length,
    billed:    filtered.reduce((s, c) => s + c.orderAmt, 0),
    collected: filtered.reduce((s, c) => s + c.collected, 0),
    shortfall: filtered.filter(c => c.diff > 0).length,
    byExec:    isManager
      ? [...new Set(filtered.map(c => c.collectorName))].map(name => ({
          name,
          count:     filtered.filter(c => c.collectorName === name).length,
          collected: filtered.filter(c => c.collectorName === name).reduce((s, c) => s + c.collected, 0),
        }))
      : [],
  }), [filtered, isManager]);

  const downloadXLSX = async () => {
    if (!filtered.length) { toast.error('No data'); return; }
    setDownloading(true);
    try {
      const rows = filtered.map(c => ({
        'Date':               c.collection_date,
        'Shop Name':          c.shop_name || '—',
        'Area':               c.area || '—',
        'Phone':              c.phone || '—',
        'Order #':            c.order_number || '—',
        'Order Amount (₹)':  c.orderAmt,
        'Collected (₹)':     c.collected,
        'Difference (₹)':    c.diff,
        'Mode':               c.payment_mode,
        'UPI Ref':            c.upi_reference || '—',
        'Cheque #':           c.cheque_number || '—',
        'Status':             c.status,
        'Collected By':       c.collectorName,
        'Hub':                c.hubName,
        'Notes':              c.notes || '—',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Collections');
      XLSX.writeFile(wb, `FF_Collections_${date}.xlsx`);
      toast.success('Downloaded!');
    } catch (e: any) { toast.error(e.message); }
    finally { setDownloading(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900">Collection Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isManager ? 'All hubs · All executives' : 'Your hub collections'}
          </p>
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
          <div className="flex-1 min-w-[180px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search shop, area, order #..."
              className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" />
          </div>
          <select value={modeFilter} onChange={e => setModeFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none bg-gray-50">
            <option value="all">All Modes</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
            <option value="neft">NEFT</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none bg-gray-50">
            <option value="all">All Status</option>
            <option value="collected">Collected</option>
            <option value="shortfall">Shortfall</option>
            <option value="excess">Excess</option>
            <option value="verified">Verified</option>
          </select>
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Entries',    value: summary.total,                              icon: Wallet,       color: 'bg-indigo-50 text-indigo-600' },
          { label: 'Billed (₹)',       value: `₹${summary.billed.toLocaleString('en-IN')}`,    icon: IndianRupee,  color: 'bg-blue-50 text-blue-600' },
          { label: 'Collected (₹)',    value: `₹${summary.collected.toLocaleString('en-IN')}`,  icon: CheckCircle2, color: 'bg-green-50 text-green-600' },
          { label: 'Shortfalls',       value: summary.shortfall,                          icon: AlertCircle,  color: 'bg-red-50 text-red-600' },
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

      {/* Executive breakdown (manager view only) */}
      {isManager && summary.byExec.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-500" /> By Collection Executive
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {summary.byExec.map(exec => (
              <div key={exec.name} className="bg-purple-50 rounded-xl p-3">
                <p className="text-sm font-bold text-purple-900 truncate">{exec.name}</p>
                <p className="text-lg font-black text-purple-700">₹{exec.collected.toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-purple-500">{exec.count} entries</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collections Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-black text-gray-900">
            Collections — {format(new Date(date + 'T00:00:00'), 'dd MMMM yyyy')}
          </p>
          <p className="text-xs text-gray-400">{filtered.length} records</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Wallet className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-semibold">No collections found for this date</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Shop', 'Area', 'Order #', 'Billed', 'Collected', 'Diff', 'Mode', 'Status', ...(isManager ? ['Executive', 'Hub'] : [])].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-[11px] font-black uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c: any) => (
                  <tr key={c.id} className={cn('hover:bg-gray-50 transition-colors', c.diff > 0 && 'bg-red-50/20')}>
                    <td className="py-3 px-4 font-semibold text-gray-900 text-xs">{c.shop_name || '—'}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{c.area || '—'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-600">{c.order_number || '—'}</td>
                    <td className="py-3 px-4 font-bold text-gray-900 text-xs">₹{c.orderAmt.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 font-bold text-green-700 text-xs">₹{c.collected.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 font-bold text-xs">
                      <span className={c.diff > 0 ? 'text-red-600' : c.diff < 0 ? 'text-blue-600' : 'text-gray-400'}>
                        {c.diff !== 0 && (c.diff > 0 ? '-' : '+')}₹{Math.abs(c.diff).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 uppercase">{c.payment_mode}</span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {c.status === 'collected' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Collected</span>
                      ) : c.status === 'shortfall' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">Shortfall</span>
                      ) : c.status === 'verified' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">Verified</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{c.status}</span>
                      )}
                    </td>
                    {isManager && (
                      <>
                        <td className="py-3 px-4 text-xs text-gray-600 font-medium">{c.collectorName}</td>
                        <td className="py-3 px-4 text-xs text-gray-500">{c.hubName}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={3} className="py-3 px-4 font-black text-gray-700 text-sm">Total</td>
                  <td className="py-3 px-4 font-black text-gray-900 text-xs">₹{summary.billed.toLocaleString('en-IN')}</td>
                  <td className="py-3 px-4 font-black text-green-700 text-xs">₹{summary.collected.toLocaleString('en-IN')}</td>
                  <td className="py-3 px-4 font-black text-xs">
                    <span className={(summary.billed - summary.collected) > 0 ? 'text-red-600' : 'text-gray-400'}>
                      ₹{Math.abs(summary.billed - summary.collected).toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td colSpan={isManager ? 4 : 2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
