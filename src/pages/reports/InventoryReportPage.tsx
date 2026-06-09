import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, Download, Search, RefreshCw, Package, AlertTriangle, CheckCircle2, Layers } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export default function InventoryReportPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [hubFilter, setHubFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all'); // all | low | ok
  const [downloading, setDownloading] = useState(false);

  const { data: inventory = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['inventory-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('current_stock, min_stock_level, product:products(name, unit), hub:hubs(name)')
        .order('current_stock');
      if (error) throw error;
      return (data ?? []).map((i: any) => ({
        ...i,
        isLow: i.current_stock < (i.min_stock_level ?? 50),
      }));
    },
  });

  const hubs = useMemo(() => {
    const names = [...new Set(inventory.map((i: any) => i.hub?.name).filter(Boolean))];
    return names.sort() as string[];
  }, [inventory]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return inventory.filter((i: any) => {
      const matchSearch = !q || (i.product?.name || '').toLowerCase().includes(q) || (i.hub?.name || '').toLowerCase().includes(q);
      const matchHub = hubFilter === 'all' || i.hub?.name === hubFilter;
      const matchStock = stockFilter === 'all' || (stockFilter === 'low' ? i.isLow : !i.isLow);
      return matchSearch && matchHub && matchStock;
    });
  }, [inventory, search, hubFilter, stockFilter]);

  const summary = useMemo(() => ({
    total:    filtered.length,
    lowStock: filtered.filter((i: any) => i.isLow).length,
    okStock:  filtered.filter((i: any) => !i.isLow).length,
    totalQty: filtered.reduce((s: number, i: any) => s + (Number(i.current_stock) || 0), 0),
  }), [filtered]);

  const downloadXLSX = async () => {
    if (!filtered.length) { toast.error('No data to download'); return; }
    setDownloading(true);
    try {
      const rows = filtered.map((i: any) => ({
        'Product':       i.product?.name || '—',
        'Hub':           i.hub?.name || '—',
        'Unit':          i.product?.unit || 'kg',
        'Current Stock': i.current_stock,
        'Min Level':     i.min_stock_level ?? 50,
        'Status':        i.isLow ? 'Low Stock' : 'OK',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [20, 16, 8, 14, 10, 10].map(w => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
      XLSX.writeFile(wb, `FF_Inventory_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success('Inventory report downloaded!');
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
            <h1 className="text-xl font-black text-gray-900">Inventory Report</h1>
            <p className="text-xs text-gray-400 mt-0.5">Current stock levels · low stock alerts · movement</p>
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
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search product or hub..."
              className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
          </div>
          <select value={hubFilter} onChange={e => setHubFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
            <option value="all">All Hubs</option>
            {hubs.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <select value={stockFilter} onChange={e => setStockFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
            <option value="all">All Stock</option>
            <option value="low">Low Stock Only</option>
            <option value="ok">OK Stock Only</option>
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
          { label: 'Total Products', value: summary.total,                    icon: Layers,       color: 'bg-blue-50 text-blue-600' },
          { label: 'Total Qty (kg)', value: summary.totalQty.toLocaleString(),icon: Package,      color: 'bg-green-50 text-green-600' },
          { label: 'Low Stock',      value: summary.lowStock,                  icon: AlertTriangle,color: 'bg-red-50 text-red-600' },
          { label: 'OK Stock',       value: summary.okStock,                   icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
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
          <p className="text-sm font-black text-gray-900">Stock Levels — Live</p>
          <p className="text-xs text-gray-400">{filtered.length} products</p>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Package className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-semibold">No inventory found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Product','Hub','Unit','Current Stock','Min Level','Status'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-[11px] font-black uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((i: any, idx: number) => (
                  <tr key={idx} className={`hover:bg-gray-50 transition-colors ${i.isLow ? 'bg-red-50/30' : ''}`}>
                    <td className="py-3 px-4 font-semibold text-gray-900">{i.product?.name || '—'}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{i.hub?.name || '—'}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{i.product?.unit || 'kg'}</td>
                    <td className="py-3 px-4 font-black text-gray-900">{i.current_stock}</td>
                    <td className="py-3 px-4 text-gray-500">{i.min_stock_level ?? 50}</td>
                    <td className="py-3 px-4">
                      {i.isLow ? (
                        <span className="flex items-center gap-1 text-red-600 text-xs font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-green-600 text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> OK
                        </span>
                      )}
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
