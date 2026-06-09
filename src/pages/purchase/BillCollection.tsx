import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { FileText, CheckCircle2, Clock, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function BillCollection() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ['bills-collection', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('purchase_orders')
        .select(`
          id, po_number, order_date, total_amount, status, payment_status,
          vendor:vendors(id, name, phone, payment_terms),
          items:purchase_order_items(received_qty, unit_price, product:products(name))
        `)
        .order('order_date', { ascending: false });

      if (statusFilter === 'pending') {
        query = query.neq('payment_status', 'paid');
      } else if (statusFilter === 'paid') {
        query = query.eq('payment_status', 'paid');
      }

      const { data } = await query;
      return data ?? [];
    },
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ payment_status: 'paid' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Bill marked as paid');
      qc.invalidateQueries({ queryKey: ['bills-collection'] });
    },
    onError: () => toast.error('Failed to update'),
  });

  const allPos = pos as any[];
  const filtered = allPos.filter(p =>
    !search ||
    (p.po_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.vendor?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const totalUnpaid = allPos
    .filter(p => p.payment_status !== 'paid')
    .reduce((s, p) => s + Number(p.total_amount || 0), 0);

  const getTotal = (po: any) =>
    Number(po.total_amount) ||
    (po.items ?? []).reduce((s: number, i: any) =>
      s + (Number(i.received_qty || 0) * Number(i.unit_price || 0)), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Bill Collection</h1>
        <p className="text-sm text-gray-500">Vendor invoices & payment reconciliation</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <FileText className="h-5 w-5 text-amber-600 mb-1" />
          <p className="text-xl font-bold text-amber-800">₹{(totalUnpaid / 1000).toFixed(1)}k</p>
          <p className="text-xs text-amber-700">Bills Unpaid</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <Clock className="h-5 w-5 text-blue-500 mb-1" />
          <p className="text-xl font-bold text-gray-900">
            {allPos.filter(p => p.payment_status !== 'paid').length}
          </p>
          <p className="text-xs text-gray-500">POs Awaiting Payment</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-500 mb-1" />
          <p className="text-xl font-bold text-gray-900">
            {allPos.filter(p => p.payment_status === 'paid').length}
          </p>
          <p className="text-xs text-gray-500">Bills Cleared</p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-48">
          <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by PO# or vendor..."
            className="text-sm outline-none flex-1 bg-transparent" />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['all', 'pending', 'paid'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-all ${
                statusFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">No bills found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y">
            {filtered.map((po: any) => {
              const isPaid = po.payment_status === 'paid';
              const total = getTotal(po);
              const items = (po.items ?? []) as any[];
              const productNames = items
                .slice(0, 3)
                .map((i: any) => i.product?.name)
                .filter(Boolean)
                .join(', ');

              return (
                <div key={po.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-800">{po.po_number}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {isPaid ? 'Paid' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {po.vendor?.name}
                        {po.order_date && ` · ${format(new Date(po.order_date), 'dd MMM yyyy')}`}
                        {po.vendor?.payment_terms && ` · ${po.vendor.payment_terms.replace('_', ' ')}`}
                      </p>
                      {productNames && (
                        <p className="text-xs text-gray-400 mt-1 truncate">
                          {productNames}{items.length > 3 ? ` +${items.length - 3} more` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <p className="text-base font-bold text-gray-900">₹{total.toLocaleString()}</p>
                      {!isPaid && (
                        <button onClick={() => markPaid.mutate(po.id)} disabled={markPaid.isPending}
                          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Mark Paid
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
