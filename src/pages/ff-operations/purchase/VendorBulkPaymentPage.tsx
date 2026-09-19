// @ts-nocheck
// ─────────────────────────────────────────────────────────────
//  Vendor Bulk Payment — combine several days' worth of POs for
//  the same vendor (one hub, one date range) into ONE
//  ff_vendor_payments row, instead of raising one payment per PO
//  per day. Raised bulk payments flow through the exact same
//  Manager → L1 → Admin → CEO → Accounts chain as any other
//  payment (see FFPaymentApprovals.tsx) — this page only changes
//  how a payment gets raised, never how it gets approved or paid.
//
//  Scope (confirmed with the user): only POs with NO payment
//  raised yet are eligible — a PO already covered by an
//  individual or an earlier bulk payment never appears here
//  again. Grouped by vendor AND hub together (not vendor alone),
//  since a payment can only carry one hub_id — if "All Hubs" is
//  selected and the same vendor supplies two hubs, that becomes
//  two separate groups/payments, one per hub.
// ─────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { ArrowLeft, Layers, CheckCircle2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllPOs, type StoredPO } from '@/lib/purchaseStore';
import { fetchStoredVendors, vendorDisplayName } from '@/lib/vendorStore';
import { matchVendor, normName } from '@/lib/poImportParsers';

function fmt(n: number) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

interface VendorGroup {
  key: string;
  vendorName: string;
  hubId: string | null;
  hubName: string;
  vendor: any | null;
  pos: StoredPO[];
  total: number;
  dateRange: string;
  alsoKnownAs: string[];
}

// A normalized bank-account identity for a vendor, or null if it has no
// real bank details on file (or the value looks like placeholder junk,
// e.g. "0"/"NA" — guarded by requiring at least 6 digits).
function bankKey(vendor: any): string | null {
  const acct = (vendor?.bank_account || '').replace(/\s+/g, '').toUpperCase();
  const ifsc = (vendor?.bank_ifsc || '').replace(/\s+/g, '').toUpperCase();
  if (acct.replace(/\D/g, '').length < 6) return null;
  return `${acct}::${ifsc}`;
}

// A shared bank account is only trusted as "this is really one vendor" up
// to a small number of distinct vendor rows. Confirmed live via
// CHECK_VENDOR_BANK_ACCOUNT_DUPES.sql: genuine same-vendor spelling/typo
// clusters (Kabur Fruits / Kabur Furits / Kabur Salman Fruits; Vijayakanth
// Traders; Sekar / Shekar; Baskar / Bhaskar; KRP Traders duplicate; K.V.
// Palani / KVP) all top out at 2-4 rows. Two accounts used as a shared
// "local cash market" placeholder for vendors with no real bank transfer
// jumped to 18 and 52 completely unrelated names on the exact same
// account+IFSC — those must never auto-merge.
const MAX_TRUSTED_BANK_KEY_VENDORS = 4;

// Sorted earliest→latest span the group's POs cover (never trust
// insertion order) — a single date when every PO happens to share one day.
function computeDateRange(pos: StoredPO[]): string {
  const dates = pos.map(po => po.date).filter(Boolean).sort();
  if (!dates.length) return '—';
  return dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} → ${dates[dates.length - 1]}`;
}

export default function VendorBulkPaymentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [hubFilter, setHubFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 6), 'yyyy-MM-dd'));
  const [dateTo, setDateTo]     = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [raisingKey, setRaisingKey] = useState<string | null>(null);

  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-active-bulk-payment'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hubs').select('id, name').eq('is_active', true).order('name');
      if (error) { console.error('[VendorBulkPayment] hubs:', error.message); return []; }
      return data ?? [];
    },
  });

  const { data: allPOs = [], isLoading: posLoading } = useQuery<StoredPO[]>({
    queryKey: ['purchase-report-pos'],
    queryFn: fetchAllPOs,
  });

  const { data: vendorList = [] } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: fetchStoredVendors,
  });

  // Every PO id already covered by ANY payment — a single-PO payment
  // (purchase_order_id) or an earlier bulk payment (purchase_order_ids) —
  // so it never gets offered here twice. Read-only; this page never
  // touches an existing payment, only ever inserts a new one.
  const { data: coveredPOIds = new Set<string>(), isLoading: coveredLoading } = useQuery({
    queryKey: ['ff-vendor-payments-covered-po-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ff_vendor_payments')
        .select('purchase_order_id, purchase_order_ids');
      if (error) { console.error('[VendorBulkPayment] covered POs:', error.message); return new Set<string>(); }
      const set = new Set<string>();
      (data ?? []).forEach((row: any) => {
        if (row.purchase_order_id) set.add(row.purchase_order_id);
        (row.purchase_order_ids ?? []).forEach((id: string) => set.add(id));
      });
      return set;
    },
  });

  // Same fuzzy vendor lookup PurchaseReportPage.tsx uses for its Bank/IFSC
  // column — PO vendor names are free text and rarely match a vendor
  // record's stored name exactly.
  const findVendor = useMemo(() => {
    const cache = new Map<string, any>();
    return (rawName: string) => {
      if (!rawName) return null;
      if (cache.has(rawName)) return cache.get(rawName);
      const norm = normName(rawName);
      const exactMatches = vendorList.filter((v: any) => normName(vendorDisplayName(v)) === norm);
      let result: any = null;
      if (exactMatches.length) {
        result = exactMatches.find((v: any) => v.banks?.[0]?.accountNumber) ?? exactMatches[0];
      } else {
        const candidates = vendorList.map((v: any) => ({ id: v.id, name: vendorDisplayName(v) }));
        const m = matchVendor(rawName, candidates);
        result = m ? vendorList.find((v: any) => v.id === m.id) ?? null : null;
      }
      cache.set(rawName, result);
      return result;
    };
  }, [vendorList]);

  // How many distinct vendor rows share each bank key, computed over the
  // whole vendor list (not just matched ones) — this must be known before
  // grouping POs, so a shared-placeholder account can be rejected outright
  // rather than merging the first few POs before the count grows too large.
  const bankKeyVendorCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of vendorList as any[]) {
      const k = bankKey(v);
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    }
    return counts;
  }, [vendorList]);

  const eligiblePOs = useMemo(() => {
    return allPOs.filter(po => {
      if (coveredPOIds.has(po.id)) return false;
      if (po.status === 'cancelled') return false;
      if (!po.items || po.items.length === 0) return false;
      if (hubFilter !== 'all' && po.hub_id !== hubFilter) return false;
      if (dateFrom && po.date < dateFrom) return false;
      if (dateTo && po.date > dateTo) return false;
      return true;
    });
  }, [allPOs, coveredPOIds, hubFilter, dateFrom, dateTo]);

  // Group by vendor + hub together — never merge two hubs' POs into one
  // payment, since ff_vendor_payments.hub_id is a single scalar column.
  // Preferred key is the vendor's bank account when it's shared by only a
  // handful of vendor rows (real same-vendor spelling variance); vendors
  // with no bank details, or whose account is one of the shared "local
  // cash market" placeholders, fall back to today's name-based key.
  const vendorGroups = useMemo<VendorGroup[]>(() => {
    const map = new Map<string, VendorGroup>();
    for (const po of eligiblePOs) {
      const vendor = findVendor(po.vendorName);
      const bkey = bankKey(vendor);
      const trustedBankKey = bkey && (bankKeyVendorCounts.get(bkey) ?? 0) <= MAX_TRUSTED_BANK_KEY_VENDORS;
      const hubKey = po.hub_id || 'nohub';
      const key = `${trustedBankKey ? `bank::${bkey}` : `name::${normName(po.vendorName) || po.vendorName}`}::${hubKey}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          vendorName: po.vendorName,
          hubId: po.hub_id || null,
          hubName: po.hub_name || 'Unassigned',
          vendor,
          pos: [],
          total: 0,
          dateRange: '',
          alsoKnownAs: [],
        });
      }
      const g = map.get(key)!;
      g.pos.push(po);
      g.total += po.total || po.subTotal || 0;
      if (!g.alsoKnownAs.includes(po.vendorName)) g.alsoKnownAs.push(po.vendorName);
    }
    // dateRange depends on every PO in the group, so compute it after the
    // loop above has finished assembling each group's full pos[] array.
    for (const g of map.values()) g.dateRange = computeDateRange(g.pos);
    // Multi-PO groups first — that's what this page is for; single-PO
    // groups are still shown (nothing hidden) but sort last since that
    // case is already served by Purchase Report's per-PO Raise & Approve.
    return Array.from(map.values()).sort((a, b) => b.pos.length - a.pos.length || b.total - a.total);
  }, [eligiblePOs, findVendor, bankKeyVendorCounts]);

  const raiseBulk = async (group: VendorGroup) => {
    if (!group.vendor?.id) {
      toast.error("Add this vendor's bank details first (Purchase Report → Bank/IFSC column)");
      return;
    }
    setRaisingKey(group.key);
    try {
      const items = group.pos.flatMap(po =>
        po.items.map(i => ({
          product_name: i.itemName, qty: i.quantity, unit: 'kg',
          rate: i.rate, amount: i.quantity * i.rate,
          qc_grade: 'A', deduction_reason: '',
          po_number: po.poNumber, po_date: po.date,
        }))
      );
      const po_breakdown = group.pos.map(po => ({
        po_id: po.id, po_number: po.poNumber, po_date: po.date,
        item_count: po.items.length, subtotal: po.total || po.subTotal || 0,
      }));
      const { error } = await supabase.from('ff_vendor_payments').insert({
        vendor_id: group.vendor.id,
        hub_id: group.hubId,
        is_bulk: true,
        // A single-PO "bulk" group still populates the legacy singular
        // column too, so any reader not yet updated to check
        // purchase_order_ids still finds it.
        purchase_order_id: group.pos.length === 1 ? group.pos[0].id : null,
        purchase_order_ids: group.pos.map(po => po.id),
        po_breakdown,
        items,
        gross_amount: group.total,
        deduction_amount: 0,
        payment_status: 'pending_l1',
        ff_ops_approved_by: user?.id,
        ff_ops_approved_at: new Date().toISOString(),
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success(`Bulk payment raised for ${vendorDisplayName(group.vendor)} — ${group.pos.length} PO(s), ${fmt(group.total)} — moved to L1`);
      qc.invalidateQueries({ queryKey: ['ff-vendor-payments-covered-po-ids'] });
      qc.invalidateQueries({ queryKey: ['ff-vendor-payments-by-po'] });
      qc.invalidateQueries({ queryKey: ['purchase-report-pos'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to raise bulk payment');
    } finally {
      setRaisingKey(null);
    }
  };

  const isLoading = posLoading || coveredLoading;

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12 pt-2 px-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-green-600" /> Vendor Bulk Payment
          </h1>
          <p className="text-xs text-gray-400">Combine several days of the same vendor's purchase orders into one payment</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-100 rounded-xl p-4">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Hub</label>
          <select value={hubFilter} onChange={e => setHubFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            <option value="all">All Hubs</option>
            {hubs.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div className="text-xs text-gray-400 ml-auto">
          {eligiblePOs.length} PO(s) not yet raised · {vendorGroups.length} vendor group(s)
        </div>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-sm text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading…</div>
      ) : vendorGroups.length === 0 ? (
        <div className="p-10 text-center text-sm text-gray-400">No un-raised purchase orders in this hub/date range.</div>
      ) : (
        <div className="space-y-3">
          {vendorGroups.map(group => {
            const isExpanded = expanded === group.key;
            const canRaise = !!group.vendor?.id;
            return (
              <div key={group.key} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : group.key)}>
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    <div>
                      <div className="font-semibold text-sm text-slate-800">
                        {canRaise ? vendorDisplayName(group.vendor) : group.vendorName}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {group.pos.length} PO{group.pos.length > 1 ? 's' : ''} · {group.dateRange} · {group.hubName}
                        {!canRaise && <span className="text-amber-500 ml-2">No vendor bank details on file</span>}
                      </div>
                      {group.alsoKnownAs.length > 1 && (
                        <div className="text-[10px] text-blue-500 mt-0.5">
                          Matched from: {group.alsoKnownAs.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-bold text-slate-800">{fmt(group.total)}</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); raiseBulk(group); }}
                      disabled={!canRaise || raisingKey === group.key}
                      title={!canRaise ? "Add this vendor's bank details first" : `Raise one payment covering all ${group.pos.length} PO(s), already approved as Manager`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {raisingKey === group.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Raise & Approve Bulk
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
                    {/* Shown before raising so the Ops Manager can verify the
                        vendor's bank details are correct, exactly as they'll
                        appear on every approval stage afterward. */}
                    {canRaise && (
                      <div className="p-3 rounded-lg border border-blue-100 bg-blue-50/60">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500 mb-1.5 flex items-center gap-1">
                          🏦 Bank Transfer Details
                        </p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-gray-400 text-[10px]">Bank</p>
                            <p className="font-semibold text-gray-800">{group.vendor?.bank_name || '—'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-[10px]">Account No.</p>
                            <p className="font-semibold text-gray-800 font-mono">{group.vendor?.bank_account || '—'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-[10px]">IFSC</p>
                            <p className="font-semibold text-gray-800 font-mono">{group.vendor?.bank_ifsc || '—'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 text-left">
                          <th className="pb-1 font-medium">PO Number</th>
                          <th className="pb-1 font-medium">Date</th>
                          <th className="pb-1 font-medium">Items</th>
                          <th className="pb-1 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.pos.map(po => (
                          <tr key={po.id} className="border-t border-gray-100">
                            <td className="py-1.5 font-medium text-slate-700">{po.poNumber}</td>
                            <td className="py-1.5 text-gray-500">{po.date}</td>
                            <td className="py-1.5 text-gray-500">{po.items.length}</td>
                            <td className="py-1.5 text-right text-slate-700">{fmt(po.total || po.subTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3} className="pt-2 text-right font-semibold text-gray-500">Total</td>
                          <td className="pt-2 text-right font-bold text-slate-800">{fmt(group.total)}</td>
                        </tr>
                      </tfoot>
                    </table>

                    {/* Full product breakdown across every PO in the group —
                        the same products this Buy actually purchased,
                        tagged with which PO/day each line came from. */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Products</p>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-white">
                            <th className="text-left px-2 py-1.5 font-medium text-gray-500 border-b">Product</th>
                            <th className="text-left px-2 py-1.5 font-medium text-gray-500 border-b">PO</th>
                            <th className="text-right px-2 py-1.5 font-medium text-gray-500 border-b">Qty</th>
                            <th className="text-right px-2 py-1.5 font-medium text-gray-500 border-b">Rate</th>
                            <th className="text-right px-2 py-1.5 font-medium text-gray-500 border-b">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.pos.flatMap(po => po.items.map((item, i) => (
                            <tr key={`${po.id}-${i}`} className="border-b border-gray-100">
                              <td className="px-2 py-1.5 font-medium text-gray-800">{item.itemName}</td>
                              <td className="px-2 py-1.5 text-gray-500">{po.poNumber}</td>
                              <td className="px-2 py-1.5 text-right text-gray-600">{item.quantity}</td>
                              <td className="px-2 py-1.5 text-right text-gray-600">₹{item.rate}</td>
                              <td className="px-2 py-1.5 text-right font-semibold text-gray-800">₹{(item.quantity * item.rate).toLocaleString('en-IN')}</td>
                            </tr>
                          )))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
