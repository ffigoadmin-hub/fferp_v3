import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowLeft, Download, FileText, Search, RefreshCw,
  ChevronDown, ChevronUp, ChevronsUpDown, Package,
  TrendingUp, ShoppingBag, CheckCircle2, Pencil, Building2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPOs, type StoredPO } from '@/lib/purchaseStore';
import { fetchStoredVendors, vendorDisplayName } from '@/lib/vendorStore';
import { matchVendor } from '@/lib/poImportParsers';

// ─── Editable Bank / IFSC cell ──────────────────────────────────────────────
// `vendor` is the fuzzy-matched vendor record, if one was found. Even when
// there's no match at all (a PO whose vendor name never became a vendor
// record), the cell still lets someone type bank details in — saving then
// creates the vendor record on the spot instead of requiring one to exist.
function BankDetailsCell({ vendor, vendorName, onSaved }: { vendor: any; vendorName: string; onSaved: () => void }) {
  const bank = vendor?.banks?.[0];
  const [editing, setEditing] = useState(false);
  const [bankName, setBankName] = useState(bank?.bankName || '');
  const [acct, setAcct]         = useState(bank?.accountNumber || '');
  const [ifsc, setIfsc]         = useState(bank?.ifscCode || '');
  const [saving, setSaving]     = useState(false);

  if (!editing) {
    return (
      <div className="group flex items-start gap-1.5">
        <div>
          <p className="text-gray-700">{bank?.bankName || <span className="text-gray-300">—</span>}</p>
          {bank?.accountNumber && <p className="font-mono text-gray-400">A/C {bank.accountNumber}</p>}
          {bank?.ifscCode && <p className="font-mono text-gray-400">{bank.ifscCode}</p>}
          {!vendor && <p className="text-amber-500 text-[10px]">No vendor record — click + to add</p>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setBankName(bank?.bankName || ''); setAcct(bank?.accountNumber || ''); setIfsc(bank?.ifscCode || ''); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-500 transition-opacity shrink-0"
          title={vendor ? 'Edit bank details' : 'Add bank details'}
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const save = async () => {
    if (!bankName.trim() && !acct.trim() && !ifsc.trim()) { setEditing(false); return; }
    setSaving(true);
    // Written to both column pairs the app uses for a vendor's bank details
    // (bank_account/bank_ifsc — read by vendorStore.ts / this page / the PO
    // list — and account_number/ifsc_code — read by BuyPage.tsx) so this one
    // save shows up everywhere for this vendor, not just on these two pages.
    const acctVal = acct.trim() || null;
    const ifscVal = ifsc.trim().toUpperCase() || null;
    const payload = {
      bank_name:      bankName.trim() || null,
      bank_account:   acctVal,
      bank_ifsc:      ifscVal,
      account_number: acctVal,
      ifsc_code:      ifscVal,
    };
    const { error } = vendor
      ? await supabase.from('vendors').update(payload).eq('id', vendor.id)
      : await supabase.from('vendors').insert({ name: vendorName, type: 'dynamic', is_active: true, ...payload });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(vendor ? 'Bank details updated' : `Vendor "${vendorName}" created with bank details`);
    setEditing(false);
    onSaved();
  };

  return (
    <div className="space-y-1 w-32">
      <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Bank name"
        className="w-full rounded border border-gray-200 px-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400" />
      <input value={acct} onChange={e => setAcct(e.target.value)} placeholder="Account no."
        className="w-full rounded border border-gray-200 px-1.5 py-0.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400" />
      <input value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())} placeholder="IFSC"
        className="w-full rounded border border-gray-200 px-1.5 py-0.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400" />
      <div className="flex gap-1">
        <button onClick={save} disabled={saving}
          className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600 text-white font-semibold disabled:opacity-50">
          {saving ? '…' : 'Save'}
        </button>
        <button onClick={() => setEditing(false)} disabled={saving}
          className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-500">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Status config ────────────────────────────────────────────────────────────
// Covers both the legacy labels this page used and the literal values the DB
// actually stores today ('pending', 'approved', 'ordered', 'received' — see
// purchaseStore.ts's poToPayload) so a plain "pending" status gets a proper
// styled badge instead of falling back to raw gray text.
const STATUS_CFG: Record<string, { cls: string; label: string }> = {
  draft:            { cls: 'bg-gray-100 text-gray-600',    label: 'Draft' },
  pending:          { cls: 'bg-amber-100 text-amber-700',  label: 'Pending' },
  pending_approval: { cls: 'bg-amber-100 text-amber-700',  label: 'Pending Approval' },
  approved:         { cls: 'bg-blue-100 text-blue-700',    label: 'Approved' },
  open:             { cls: 'bg-blue-100 text-blue-700',    label: 'Approved' },
  ordered:          { cls: 'bg-indigo-100 text-indigo-700',label: 'Ordered' },
  received:         { cls: 'bg-green-100 text-green-700',  label: 'Received' },
  rejected:         { cls: 'bg-red-100 text-red-600',      label: 'Rejected' },
  billed:           { cls: 'bg-purple-100 text-purple-700',label: 'Billed' },
  cancelled:        { cls: 'bg-red-100 text-red-600',      label: 'Cancelled' },
};

// Manual status-update options shown in the editable dropdown — the
// business-flow set (Pending → Approved → Ordered → Received) plus the two
// terminal/out-of-flow states someone might need to set by hand.
const STATUS_OPTIONS = [
  { value: 'pending',   label: 'Pending' },
  { value: 'approved',  label: 'Approved' },
  { value: 'ordered',   label: 'Ordered' },
  { value: 'received',  label: 'Received' },
  { value: 'billed',    label: 'Billed' },
  { value: 'rejected',  label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

// ─── Editable Status cell ───────────────────────────────────────────────────
function StatusCell({ po, onSaved }: { po: StoredPO; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const cfg = STATUS_CFG[po.status] ?? { cls: 'bg-gray-100 text-gray-600', label: po.status };

  const updateStatus = async (value: string) => {
    if (value === po.status) { setEditing(false); return; }
    setSaving(true);
    const { error } = await supabase.from('purchase_orders').update({ status: value }).eq('id', po.id);
    setSaving(false);
    setEditing(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status updated to ${STATUS_CFG[value]?.label ?? value}`);
    onSaved();
  };

  if (editing) {
    return (
      <select
        autoFocus defaultValue={po.status} disabled={saving}
        onChange={e => updateStatus(e.target.value)}
        onBlur={() => setEditing(false)}
        onClick={e => e.stopPropagation()}
        className="text-[11px] rounded-full border border-gray-200 px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      disabled={saving}
      title="Click to update status"
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold hover:opacity-75 transition-opacity disabled:opacity-50 ${cfg.cls}`}
    >
      {saving ? '…' : cfg.label}
    </button>
  );
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PurchaseReportPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hubFilter, setHubFilter]       = useState('all');
  const [expandedPO, setExpandedPO]     = useState<string | null>(null);
  const [downloading, setDownloading]   = useState(false);

  const { data: allPOs = [] } = useQuery<StoredPO[]>({
    queryKey: ['purchase-report-pos'],
    queryFn: fetchAllPOs,
  });

  const { data: vendorList = [] } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: fetchStoredVendors,
  });

  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-active-purchase-report'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hubs').select('id, name').eq('is_active', true).order('name');
      if (error) { console.error('[PurchaseReportPage] hubs:', error.message); return []; }
      return data ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['purchase-report-pos'] });
    qc.invalidateQueries({ queryKey: ['vendors-list'] });
    toast.success('Refreshed');
  };

  // Fuzzy vendor lookup for bank details — PO vendor names come from free-text
  // entry / PDF import ("MS. KRP TRADERS") and rarely match a vendor record's
  // stored name exactly, so this reuses the same tolerant matching the PO
  // import review screen uses instead of an exact-string key lookup.
  const findVendor = useMemo(() => {
    const candidates = vendorList.map((v: any) => ({ id: v.id, name: vendorDisplayName(v) }));
    const cache = new Map<string, any>();
    return (rawName: string) => {
      if (cache.has(rawName)) return cache.get(rawName);
      const m = matchVendor(rawName, candidates);
      const full = m ? vendorList.find((v: any) => v.id === m.id) ?? null : null;
      cache.set(rawName, full);
      return full;
    };
  }, [vendorList]);

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allPOs.filter(po => {
      const matchDate =
        (!dateFrom || po.date >= dateFrom) &&
        (!dateTo   || po.date <= dateTo);
      const matchStatus = statusFilter === 'all' || po.status === statusFilter;
      const matchHubFilter = hubFilter === 'all' || po.hub_id === hubFilter;
      const matchSearch =
        !q ||
        po.poNumber.toLowerCase().includes(q) ||
        po.vendorName.toLowerCase().includes(q) ||
        po.items.some(i => i.itemName.toLowerCase().includes(q));
      return matchDate && matchStatus && matchHubFilter && matchSearch;
    });
  }, [allPOs, dateFrom, dateTo, search, statusFilter, hubFilter]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    totalPOs:   filtered.length,
    totalValue: filtered.reduce((s, p) => s + p.total, 0),
    totalItems: filtered.reduce((s, p) => s + p.items.length, 0),
    approved:   filtered.filter(p => p.status === 'open').length,
    pending:    filtered.filter(p => p.status === 'pending_approval').length,
  }), [filtered]);

  // ── Excel Download ──────────────────────────────────────────────────────────
  const downloadXLSX = () => {
    if (filtered.length === 0) { toast.error('No data to export'); return; }
    setDownloading(true);
    try {
      const rows: any[] = [];
      filtered.forEach(po => {
        const vendor = findVendor(po.vendorName);
        const statusLabel = STATUS_CFG[po.status]?.label ?? po.status;

        if (po.items.length === 0) {
          rows.push({
            'PO Number':        po.poNumber,
            'PO Date':          po.date,
            'Delivery Date':    po.deliveryDate || '—',
            'Status':           statusLabel,
            'Vendor Name':      po.vendorName,
            'Hub':              po.hub_name || '—',
            'GSTIN':            vendor?.gstin || '—',
            'PAN':              vendor?.pan   || '—',
            'Bank Name':        vendor?.banks?.[0]?.bankName   || '—',
            'Account Number':   vendor?.banks?.[0]?.accountNumber || '—',
            'IFSC Code':        vendor?.banks?.[0]?.ifscCode   || '—',
            'Payment Terms':    po.paymentTerms,
            'Item Name':        '—',
            'Quantity':         '—',
            'Unit':             '—',
            'Rate (₹)':        '—',
            'Amount (₹)':      '—',
            'Sub Total (₹)':   po.subTotal,
            'GST (5%)':         Math.round(po.subTotal * 0.05),
            'Total (₹)':       po.total,
            'Notes':            po.notes || '',
            'Approved By':      po.approvedBy || '—',
          });
        } else {
          po.items.forEach((item, idx) => {
            rows.push({
              'PO Number':        idx === 0 ? po.poNumber : '',
              'PO Date':          idx === 0 ? po.date : '',
              'Delivery Date':    idx === 0 ? (po.deliveryDate || '—') : '',
              'Status':           idx === 0 ? statusLabel : '',
              'Vendor Name':      idx === 0 ? po.vendorName : '',
              'Hub':              idx === 0 ? (po.hub_name || '—') : '',
              'GSTIN':            idx === 0 ? (vendor?.gstin || '—') : '',
              'PAN':              idx === 0 ? (vendor?.pan   || '—') : '',
              'Bank Name':        idx === 0 ? (vendor?.banks?.[0]?.bankName   || '—') : '',
              'Account Number':   idx === 0 ? (vendor?.banks?.[0]?.accountNumber || '—') : '',
              'IFSC Code':        idx === 0 ? (vendor?.banks?.[0]?.ifscCode   || '—') : '',
              'Payment Terms':    idx === 0 ? po.paymentTerms : '',
              'Item Name':        item.itemName,
              'Quantity':         item.quantity,
              'Unit':             'kg',
              'Rate (₹)':        item.rate,
              'Amount (₹)':      item.quantity * item.rate,
              'Sub Total (₹)':   idx === 0 ? po.subTotal : '',
              'GST (5%)':         idx === 0 ? Math.round(po.subTotal * 0.05) : '',
              'Total (₹)':       idx === 0 ? po.total : '',
              'Notes':            idx === 0 ? (po.notes || '') : '',
              'Approved By':      idx === 0 ? (po.approvedBy || '—') : '',
            });
          });
        }
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        14, 12, 14, 16, 22, 16, 16, 12, 18, 18, 14,
        14, 20, 10, 8, 12, 12, 14, 10, 12, 24, 18,
      ].map(w => ({ wch: w }));

      // Bold header row
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[addr]) ws[addr].s = { font: { bold: true } };
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Purchase Report');
      const filename = `FF_Purchase_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`Downloaded: ${filename}`);
    } catch (e: any) {
      toast.error(e.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/reports')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div>
            <h1 className="text-xl font-black text-gray-900">Purchase Report</h1>
            <p className="text-xs text-gray-400 mt-0.5">PO-wise purchases · vendor account details · order breakdown</p>
          </div>
        </div>
        <button
          onClick={downloadXLSX}
          disabled={downloading || filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
        >
          {downloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">

          {/* Date range */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-blue-600 hover:underline font-medium">Clear dates</button>
          )}

          {/* Hub filter — right next to the date range, so reports can be pulled hub-wise */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hub</label>
            <select value={hubFilter} onChange={e => setHubFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
              <option value="all">All Hubs</option>
              {hubs.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search PO number, vendor, product…"
              className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
          </div>

          {/* Status filter */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
            <option value="all">All Status</option>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <button onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total POs',        value: stats.totalPOs,                         icon: FileText,     color: 'bg-blue-50 text-blue-600' },
          { label: 'Total Value',       value: `₹${fmt(stats.totalValue)}`,            icon: TrendingUp,   color: 'bg-green-50 text-green-600' },
          { label: 'Line Items',        value: stats.totalItems,                       icon: Package,      color: 'bg-purple-50 text-purple-600' },
          { label: 'Approved POs',      value: stats.approved,                         icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Pending Approval',  value: stats.pending,                          icon: ShoppingBag,  color: 'bg-amber-50 text-amber-600' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.color}`}>
              <c.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-black text-gray-900">{c.value}</p>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-black text-gray-900">
            All Purchase Orders
            {(dateFrom || dateTo) && (
              <span className="text-gray-400 font-normal ml-2 text-xs">
                {dateFrom && `from ${dateFrom}`} {dateTo && `to ${dateTo}`}
              </span>
            )}
          </p>
          <p className="text-xs text-gray-400">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</p>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-semibold">No purchase orders found</p>
            <p className="text-xs mt-1">Try clearing the date filter or search</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="py-3 px-3 w-8"></th>
                  <th className="text-left py-3 px-3 text-[11px] font-black uppercase tracking-wider text-gray-400">PO Number</th>
                  <th className="text-left py-3 px-3 text-[11px] font-black uppercase tracking-wider text-gray-400">Vendor</th>
                  <th className="text-left py-3 px-3 text-[11px] font-black uppercase tracking-wider text-gray-400">Hub</th>
                  <th className="text-left py-3 px-3 text-[11px] font-black uppercase tracking-wider text-gray-400">GSTIN</th>
                  <th className="text-left py-3 px-3 text-[11px] font-black uppercase tracking-wider text-gray-400">Bank / IFSC</th>
                  <th className="text-left py-3 px-3 text-[11px] font-black uppercase tracking-wider text-gray-400">Products</th>
                  <th className="text-right py-3 px-3 text-[11px] font-black uppercase tracking-wider text-gray-400">Total Qty</th>
                  <th className="text-right py-3 px-3 text-[11px] font-black uppercase tracking-wider text-gray-400">Amount (₹)</th>
                  <th className="text-left py-3 px-3 text-[11px] font-black uppercase tracking-wider text-gray-400">Date</th>
                  <th className="text-center py-3 px-3 text-[11px] font-black uppercase tracking-wider text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(po => {
                  const vendor = findVendor(po.vendorName);
                  const totalQty = po.items.reduce((s, i) => s + i.quantity, 0);
                  const isExpanded = expandedPO === po.id;

                  return (
                    <>
                      <tr
                        key={po.id}
                        onClick={() => setExpandedPO(isExpanded ? null : po.id)}
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/30' : ''}`}
                      >
                        {/* Expand toggle */}
                        <td className="py-3 px-3 text-gray-400">
                          {po.items.length > 0
                            ? isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                            : <ChevronsUpDown className="w-4 h-4 opacity-30" />}
                        </td>

                        {/* PO Number */}
                        <td className="py-3 px-3">
                          <p className="font-black text-blue-600 font-mono text-sm">{po.poNumber}</p>
                          <p className="text-[10px] text-gray-400">{po.items.length} item{po.items.length !== 1 ? 's' : ''}</p>
                        </td>

                        {/* Vendor */}
                        <td className="py-3 px-3">
                          <p className="font-semibold text-gray-900 text-sm">{po.vendorName}</p>
                          {vendor?.mobile && <p className="text-[10px] text-gray-400">{vendor.mobile}</p>}
                        </td>

                        {/* Hub */}
                        <td className="py-3 px-3 text-xs text-gray-600">
                          {po.hub_name
                            ? <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3 text-gray-300" />{po.hub_name}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>

                        {/* GSTIN */}
                        <td className="py-3 px-3 font-mono text-gray-600 text-xs">
                          {vendor?.gstin || <span className="text-gray-300">—</span>}
                        </td>

                        {/* Bank / IFSC — editable */}
                        <td className="py-3 px-3 text-xs" onClick={e => e.stopPropagation()}>
                          <BankDetailsCell vendor={vendor} vendorName={po.vendorName} onSaved={() => qc.invalidateQueries({ queryKey: ['vendors-list'] })} />
                        </td>

                        {/* Products */}
                        <td className="py-3 px-3 text-xs text-gray-600 max-w-[160px]">
                          <p className="truncate">{po.items.map(i => i.itemName).join(', ') || '—'}</p>
                        </td>

                        {/* Total Qty */}
                        <td className="py-3 px-3 text-right font-semibold text-gray-800 text-sm">
                          {totalQty > 0 ? `${totalQty} kg` : '—'}
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-3 text-right font-black text-gray-900">
                          ₹{fmt(po.total)}
                        </td>

                        {/* Date */}
                        <td className="py-3 px-3 text-xs text-gray-500">
                          <p>{po.date}</p>
                          {po.deliveryDate && <p className="text-gray-400">Del: {po.deliveryDate}</p>}
                        </td>

                        {/* Status — click to update manually */}
                        <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                          <StatusCell po={po} onSaved={() => qc.invalidateQueries({ queryKey: ['purchase-report-pos'] })} />
                          {po.approvedBy && (
                            <p className="text-[9px] text-gray-400 mt-0.5">{po.approvedBy}</p>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Line Items */}
                      {isExpanded && po.items.length > 0 && (
                        <tr key={`${po.id}-exp`}>
                          <td colSpan={11} className="px-4 pb-4 pt-0 bg-blue-50/20">
                            <div className="ml-8 mt-2 rounded-xl border border-blue-100 overflow-hidden">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-blue-50 border-b border-blue-100">
                                    <th className="text-left py-2 px-3 font-black uppercase text-blue-700">#</th>
                                    <th className="text-left py-2 px-3 font-black uppercase text-blue-700">Product</th>
                                    <th className="text-right py-2 px-3 font-black uppercase text-blue-700">Qty (kg)</th>
                                    <th className="text-right py-2 px-3 font-black uppercase text-blue-700">Rate (₹)</th>
                                    <th className="text-right py-2 px-3 font-black uppercase text-blue-700">Amount (₹)</th>
                                    <th className="text-center py-2 px-3 font-black uppercase text-blue-700">Tax</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-blue-50">
                                  {po.items.map((item, idx) => (
                                    <tr key={idx} className="bg-white">
                                      <td className="py-2 px-3 text-gray-400">{idx + 1}</td>
                                      <td className="py-2 px-3 font-semibold text-gray-800">{item.itemName}</td>
                                      <td className="py-2 px-3 text-right text-gray-700">{item.quantity}</td>
                                      <td className="py-2 px-3 text-right text-gray-700">₹{item.rate}</td>
                                      <td className="py-2 px-3 text-right font-bold text-gray-900">₹{fmt(item.quantity * item.rate)}</td>
                                      <td className="py-2 px-3 text-center text-gray-500">{item.tax || 'GST 5%'}</td>
                                    </tr>
                                  ))}
                                  {/* Totals row */}
                                  <tr className="bg-blue-50">
                                    <td colSpan={3} className="py-2 px-3 font-black text-right text-blue-800">Sub Total</td>
                                    <td></td>
                                    <td className="py-2 px-3 text-right font-black text-blue-800">₹{fmt(po.subTotal)}</td>
                                    <td></td>
                                  </tr>
                                  <tr className="bg-blue-50">
                                    <td colSpan={3} className="py-2 px-3 font-black text-right text-blue-800">GST (5%)</td>
                                    <td></td>
                                    <td className="py-2 px-3 text-right font-black text-blue-800">₹{fmt(Math.round(po.subTotal * 0.05))}</td>
                                    <td></td>
                                  </tr>
                                  <tr className="bg-blue-100">
                                    <td colSpan={3} className="py-2 px-3 font-black text-right text-blue-900">Total</td>
                                    <td></td>
                                    <td className="py-2 px-3 text-right font-black text-blue-900">₹{fmt(po.total)}</td>
                                    <td></td>
                                  </tr>
                                </tbody>
                              </table>
                              {po.notes && (
                                <div className="px-3 py-2 bg-gray-50 border-t border-blue-100 text-xs text-gray-500">
                                  📝 {po.notes}
                                </div>
                              )}
                              {po.rejectionReason && (
                                <div className="px-3 py-2 bg-red-50 border-t border-red-100 text-xs text-red-600">
                                  ❌ Rejected: {po.rejectionReason}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
