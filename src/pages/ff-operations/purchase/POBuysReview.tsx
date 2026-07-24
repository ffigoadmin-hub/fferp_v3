// @ts-nocheck
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  ShoppingBag, Building2, Calendar, ChevronDown, ChevronUp,
  Image as ImageIcon, Scale, Receipt, RefreshCw, X,
} from 'lucide-react';

function fmt(n: number) {
  return (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function displayName(profile: any) {
  return profile?.name || profile?.full_name || 'Unknown';
}

// ── Lightbox for full-size photo viewing ──────────────────────────────────────
function PhotoLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white bg-white/10 rounded-full p-2 hover:bg-white/20"
      >
        <X className="w-5 h-5" />
      </button>
      <img src={url} className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

function PhotoThumb({ label, icon: Icon, url, onOpen }: { label: string; icon: any; url?: string; onOpen: (u: string) => void }) {
  if (!url) {
    return (
      <div className="flex flex-col items-center gap-1 text-gray-300">
        <div className="w-16 h-16 rounded-lg border border-dashed border-gray-200 flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-[10px] text-gray-400">{label}</span>
      </div>
    );
  }
  return (
    <button onClick={() => onOpen(url)} className="flex flex-col items-center gap-1">
      <img src={url} className="w-16 h-16 rounded-lg object-cover border border-gray-200 hover:opacity-80 transition" />
      <span className="text-[10px] text-gray-500">{label}</span>
    </button>
  );
}

// ── Entry card ─────────────────────────────────────────────────────────────────
function BuyEntryCard({ entry, onOpenPhoto }: { entry: any; onOpenPhoto: (u: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const items = entry.items ?? [];
  const photoSet = entry._photos ?? {};

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full p-4 flex items-start justify-between gap-3 text-left hover:bg-gray-50/60 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg shrink-0 bg-blue-50">
            <ShoppingBag className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{entry.vendor?.name || 'Unknown Vendor'}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              PO {entry.purchase_order?.po_number || '—'} · {entry.purchase_order?.hub_name || '—'} · {displayName(entry.purchased_by_profile)}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {entry.created_at ? format(new Date(entry.created_at), 'dd MMM yyyy, h:mm a') : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex gap-1.5">
            <PhotoThumb label="Item" icon={ImageIcon} url={photoSet.item_photo_url} onOpen={onOpenPhoto} />
            <PhotoThumb label="Scale" icon={Scale} url={photoSet.scale_photo_url} onOpen={onOpenPhoto} />
            <PhotoThumb label="Proof" icon={Receipt} url={photoSet.payment_proof_url} onOpen={onOpenPhoto} />
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-800">₹{fmt(entry.total_amount)}</p>
            <p className="text-[11px] text-gray-400">{items.length} item{items.length !== 1 ? 's' : ''}</p>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 text-left">
                <th className="pb-1.5 font-medium">Product</th>
                <th className="pb-1.5 font-medium text-right">Qty</th>
                <th className="pb-1.5 font-medium text-right">Rate</th>
                <th className="pb-1.5 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any) => (
                <tr key={it.id} className="border-t border-gray-50">
                  <td className="py-1.5 text-gray-700">{it.product_name}</td>
                  <td className="py-1.5 text-right text-gray-600">{fmt(it.quantity)} {it.unit}</td>
                  <td className="py-1.5 text-right text-gray-600">₹{fmt(it.unit_price)}</td>
                  <td className="py-1.5 text-right font-semibold text-gray-700">₹{fmt(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entry.notes && (
            <p className="text-xs text-gray-500 mt-3">
              <span className="font-medium text-gray-600">Notes:</span> {entry.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function POBuysReview() {
  const [hubFilter, setHubFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: hubs = [] } = useQuery({
    queryKey: ['po-buys-hubs'],
    queryFn: async () => {
      const { data } = await supabase.from('hubs').select('id, name').order('name');
      return data ?? [];
    },
  });

  const { data: entries = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['po-buys-entries', fromDate, toDate],
    queryFn: async () => {
      let q = supabase
        .from('purchase_entries')
        .select(`
          id, po_id, vendor_id, purchased_by, total_amount, receipt_url, notes, created_at,
          vendor:vendors!purchase_entries_vendor_id_fkey(name, phone),
          purchase_order:purchase_orders!purchase_entries_po_id_fkey(po_number, hub_id, hub_name),
          purchased_by_profile:profiles!purchase_entries_purchased_by_fkey(name, full_name),
          items:purchase_entry_items!purchase_entry_items_entry_id_fkey(id, product_name, quantity, unit, unit_price, total)
        `)
        .order('created_at', { ascending: false });

      if (fromDate) q = q.gte('created_at', fromDate);
      if (toDate)   q = q.lte('created_at', toDate + 'T23:59:59');

      const { data, error } = await q;
      if (error) throw error;

      const entryIds = (data ?? []).map((e: any) => e.id);
      if (entryIds.length === 0) return data ?? [];

      const { data: payments } = await supabase
        .from('ff_vendor_payments')
        .select('purchase_entry_id, items')
        .in('purchase_entry_id', entryIds);

      const photoMap: Record<string, any> = {};
      for (const p of (payments ?? [])) {
        photoMap[p.purchase_entry_id] = (p.items ?? [])[0] ?? {};
      }

      return (data ?? []).map((e: any) => ({ ...e, _photos: photoMap[e.id] }));
    },
  });

  const filteredEntries = useMemo(() => {
    if (!hubFilter) return entries;
    return entries.filter((e: any) => e.purchase_order?.hub_id === hubFilter);
  }, [entries, hubFilter]);

  const totalAmount = filteredEntries.reduce((s: number, e: any) => s + Number(e.total_amount ?? 0), 0);

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">PO Buys</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Review what Purchase Executives bought — vendor, quantity, and photo proof
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Building2 className="w-3.5 h-3.5" /> Hub
        </div>
        <select
          value={hubFilter}
          onChange={(e) => setHubFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All Hubs</option>
          {hubs.map((h: any) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-2">
          <Calendar className="w-3.5 h-3.5" /> From
        </div>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <span className="text-xs text-gray-400">to</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />

        <div className="ml-auto text-xs text-gray-500">
          {filteredEntries.length} entr{filteredEntries.length !== 1 ? 'ies' : 'y'} · <span className="font-semibold text-gray-700">₹{fmt(totalAmount)}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading purchases...
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
          <ShoppingBag className="w-10 h-10 mb-2 text-gray-300" />
          <p className="font-medium text-sm">No purchase records found</p>
          <p className="text-xs mt-1">Buys recorded via "Buy (Go Purchase)" will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry: any) => (
            <BuyEntryCard key={entry.id} entry={entry} onOpenPhoto={setLightboxUrl} />
          ))}
        </div>
      )}

      {lightboxUrl && <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  );
}
