// @ts-nocheck
// ─────────────────────────────────────────────────────────────
//  Accounts Batch History — read-only record of every FF vendor
//  payment batch that has actually been processed (paid out),
//  filterable by hub and PO date so a specific day/hub's payout
//  can be looked up after the fact.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { History, Banknote } from 'lucide-react';

function fmt(n: number) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function BatchHistoryPage() {
  const [hubFilter, setHubFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-list'],
    queryFn: async () => {
      const { data } = await supabase.from('hubs').select('id, name').order('name');
      return data ?? [];
    },
  });

  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ['ff-payment-batches-processed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ff_payment_batches')
        .select('*')
        .eq('status', 'processed')
        .order('processed_at', { ascending: false });
      if (error) { console.error('[BatchHistory] batches:', error.message); return []; }
      return data ?? [];
    },
  });

  const { data: paidPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['ff-paid-payments-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ff_vendor_payments')
        .select('id, batch_id, hub_id, gross_amount, net_amount, utr_number, paid_at, vendors(name), hubs(name), purchase_orders(po_number, eod_date)')
        .eq('payment_status', 'paid')
        .not('batch_id', 'is', null)
        .order('paid_at', { ascending: false });
      if (error) { console.error('[BatchHistory] payments:', error.message); return []; }
      return data ?? [];
    },
  });

  const isLoading = batchesLoading || paymentsLoading;
  const filtersActive = hubFilter !== 'all' || !!dateFrom || !!dateTo;

  const matchesFilter = (p: any) => {
    if (hubFilter !== 'all' && p.hub_id !== hubFilter) return false;
    const eod = p.purchase_orders?.eod_date;
    if (dateFrom && (!eod || eod < dateFrom)) return false;
    if (dateTo && (!eod || eod > dateTo)) return false;
    return true;
  };

  const rows = batches
    .map((b: any) => {
      const payments = paidPayments.filter((p: any) => p.batch_id === b.id && matchesFilter(p));
      return { batch: b, payments };
    })
    .filter(r => r.payments.length > 0);

  const grandTotal = rows.reduce((s, r) => s + r.payments.reduce((s2: number, p: any) => s2 + Number(p.net_amount ?? p.gross_amount ?? 0), 0), 0);
  const grandCount = rows.reduce((s, r) => s + r.payments.length, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12 pt-2">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><History className="w-5 h-5 text-blue-600" /> Batch History</h1>
        <p className="text-xs text-gray-500 mt-0.5">Every FF vendor payment batch that has been paid out</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Hub</label>
          <select value={hubFilter} onChange={e => setHubFilter(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Hubs</option>
            {hubs.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">PO Date From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">PO Date To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {filtersActive && (
          <button onClick={() => { setHubFilter('all'); setDateFrom(''); setDateTo(''); }}
            className="text-xs font-semibold text-blue-600 hover:underline pb-2.5">
            Clear filters
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-semibold text-gray-700 w-fit">
        <Banknote className="w-4 h-4 text-gray-400" /> {grandCount} payments · {fmt(grandTotal)}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-100">
          {filtersActive ? 'No processed payments match this hub/date filter.' : 'No processed batches yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ batch, payments }) => {
            const total = payments.reduce((s: number, p: any) => s + Number(p.net_amount ?? p.gross_amount ?? 0), 0);
            return (
              <div key={batch.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                  <div>
                    <p className="font-mono font-bold text-gray-800">{batch.batch_ref}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Processed {batch.processed_at ? format(new Date(batch.processed_at), 'dd MMM yyyy, h:mm a') : '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{fmt(total)}</p>
                    <p className="text-[11px] text-gray-400">{payments.length} payment{payments.length !== 1 ? 's' : ''}{filtersActive && payments.length !== batch.payment_count ? ` of ${batch.payment_count}` : ''}</p>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400"><th className="text-left font-medium py-1.5 px-4">Vendor</th><th className="text-left font-medium py-1.5">Hub</th><th className="text-left font-medium py-1.5">PO</th><th className="text-right font-medium py-1.5">Amount</th><th className="text-left font-medium py-1.5 px-4">UTR</th></tr>
                  </thead>
                  <tbody>
                    {payments.map((p: any) => (
                      <tr key={p.id} className="border-t border-gray-50">
                        <td className="py-1.5 px-4">{p.vendors?.name || '—'}</td>
                        <td className="py-1.5">{p.hubs?.name || '—'}</td>
                        <td className="py-1.5">{p.purchase_orders?.po_number || '—'} {p.purchase_orders?.eod_date && `(${format(new Date(p.purchase_orders.eod_date), 'dd MMM')})`}</td>
                        <td className="py-1.5 text-right font-semibold">{fmt(p.net_amount ?? p.gross_amount)}</td>
                        <td className="py-1.5 px-4 font-mono">{p.utr_number || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
