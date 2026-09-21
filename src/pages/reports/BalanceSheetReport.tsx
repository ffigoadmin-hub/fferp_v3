// ─────────────────────────────────────────────────────────────
//  Balance Sheet — Assets / Liabilities / Net Position, as of today.
//  Only shows what's honestly computable from this schema; every
//  line without a real data source renders "Not Available" instead
//  of a fabricated number (same rule as Cash-on-Hand on
//  FFOperationsHomePage.tsx and the CEO Control Top-15 KPIs).
// ─────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Download, Wallet, Banknote } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface LineItem {
  label: string;
  value: number | null;
  sub: string;
}

function fmt(n: number) {
  return `₹${(n / 100000).toFixed(2)}L`;
}

function LineRow({ item }: { item: LineItem }) {
  return (
    <div className="grid grid-cols-2 gap-3 px-5 py-3 items-center hover:bg-gray-50">
      <div>
        <p className={`text-sm font-medium ${item.value === null ? 'text-gray-400' : 'text-gray-800'}`}>{item.label}</p>
        <p className="text-xs text-gray-400">{item.sub}</p>
      </div>
      <div className="text-right">
        {item.value === null ? (
          <span className="text-sm font-semibold text-gray-300">Not Available</span>
        ) : (
          <span className="text-sm font-semibold text-gray-900">
            ₹{item.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        )}
      </div>
    </div>
  );
}

export default function BalanceSheetReport() {
  const today = format(new Date(), 'yyyy-MM-dd');

  // Inventory Value — same estimated-value pattern InventoryDashboard.tsx
  // already uses (quantity * Grade A wholesale price), not a new formula.
  const { data: inventoryRows, isLoading: invLoading } = useQuery({
    queryKey: ['bs-inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('quantity, product:products(grade_a_price)');
      if (error) throw error;
      return data ?? [];
    },
  });
  const inventoryValue = (inventoryRows ?? []).reduce(
    (s, i: any) => s + Number(i.quantity || 0) * Number(i.product?.grade_a_price ?? 0), 0
  );

  // Accounts Receivable — live-computed from unpaid credit sales_orders,
  // same query CollectionManagement.tsx uses. NOT customers.outstanding_balance
  // — that column has no confirmed write path anywhere in this app, so it
  // may be stale; this is the one genuinely live number.
  const { data: receivableOrders, isLoading: recvLoading } = useQuery({
    queryKey: ['bs-receivables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('net_amount, total_amount')
        .eq('payment_mode', 'credit')
        .neq('payment_status', 'paid')
        .neq('status', 'cancelled');
      if (error) throw error;
      return data ?? [];
    },
  });
  const accountsReceivable = (receivableOrders ?? []).reduce(
    (s, o: any) => s + Number(o.net_amount || o.total_amount || 0), 0
  );

  // Accounts Payable (Vendor) — net_amount is a real generated column
  // (gross_amount - deduction_amount). Excludes BOTH 'paid' and 'rejected'
  // — FFOperationsHomePage.tsx's similar figure only excludes 'rejected',
  // which silently double-counts already-paid rows; not repeating that here.
  const { data: vendorPayables, isLoading: vpLoading } = useQuery({
    queryKey: ['bs-vendor-payables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ff_vendor_payments')
        .select('net_amount, payment_status')
        .not('payment_status', 'in', '(paid,rejected)');
      if (error) throw error;
      return data ?? [];
    },
  });
  const vendorPayableTotal = (vendorPayables ?? []).reduce((s, p: any) => s + Number(p.net_amount || 0), 0);

  // Accounts Payable (Transport) — no generated total column exists on this
  // table; sum the three real amount fields, same as FFOperationsHomePage.tsx.
  const { data: transportPayables, isLoading: tpLoading } = useQuery({
    queryKey: ['bs-transport-payables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ff_transport_payments')
        .select('base_amount, toll_charges, other_charges, payment_status')
        .not('payment_status', 'in', '(paid,rejected)');
      if (error) throw error;
      return data ?? [];
    },
  });
  const transportPayableTotal = (transportPayables ?? []).reduce(
    (s, p: any) => s + Number(p.base_amount || 0) + Number(p.toll_charges || 0) + Number(p.other_charges || 0), 0
  );

  const isLoading = invLoading || recvLoading || vpLoading || tpLoading;

  const assets: LineItem[] = [
    { label: 'Inventory Value', value: inventoryValue, sub: 'Estimated — Grade A wholesale pricing, all hubs' },
    { label: 'Accounts Receivable', value: accountsReceivable, sub: 'Unpaid credit sales orders' },
    { label: 'Cash on Hand', value: null, sub: 'No bank/cash ledger source configured' },
    { label: 'Fixed Assets', value: null, sub: 'No vehicle/equipment asset register exists' },
  ];
  const liabilities: LineItem[] = [
    { label: 'Accounts Payable — Vendor', value: vendorPayableTotal, sub: 'Vendor payments not yet paid' },
    { label: 'Accounts Payable — Transport', value: transportPayableTotal, sub: 'Transport payments not yet paid' },
    { label: 'Loans', value: null, sub: 'No loan/borrowing record exists' },
  ];

  const totalAssets = assets.reduce((s, a) => s + (a.value ?? 0), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + (l.value ?? 0), 0);
  const netPosition = totalAssets - totalLiabilities;
  const hasUnavailable = [...assets, ...liabilities].some(x => x.value === null);

  const exportExcel = () => {
    const rows = [
      ...assets.map(a => ({ Section: 'Assets', Line: a.label, 'Amount (₹)': a.value ?? 'Not Available' })),
      ...liabilities.map(l => ({ Section: 'Liabilities', Line: l.label, 'Amount (₹)': l.value ?? 'Not Available' })),
      { Section: '', Line: 'Total Assets', 'Amount (₹)': totalAssets.toFixed(0) },
      { Section: '', Line: 'Total Liabilities', 'Amount (₹)': totalLiabilities.toFixed(0) },
      { Section: '', Line: 'Net Position', 'Amount (₹)': netPosition.toFixed(0) },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet');
    XLSX.writeFile(wb, `FF_Balance_Sheet_${today}.xlsx`);
    toast.success('Exported!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Balance Sheet</h1>
          <p className="text-sm text-gray-500">As of {format(new Date(), 'd MMMM yyyy')}</p>
        </div>
        <button onClick={exportExcel}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Total Assets</p>
          <p className="text-xl font-bold text-gray-900">{isLoading ? '…' : fmt(totalAssets)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Total Liabilities</p>
          <p className="text-xl font-bold text-red-700">{isLoading ? '…' : fmt(totalLiabilities)}</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${netPosition >= 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className="text-xs text-gray-500 mb-1">Net Position</p>
          <p className={`text-xl font-bold ${netPosition >= 0 ? 'text-green-700' : 'text-amber-700'}`}>
            {isLoading ? '…' : fmt(netPosition)}
          </p>
        </div>
      </div>
      {hasUnavailable && (
        <p className="text-xs text-gray-400">
          Net Position is Assets minus Liabilities from the lines below — it's a derived figure, not a tracked
          equity/retained-earnings ledger (this app doesn't have one). Lines marked "Not Available" have no
          real data source yet and are excluded from the totals above, not counted as zero.
        </p>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Assets</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {assets.map(a => <LineRow key={a.label} item={a} />)}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <Banknote className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Liabilities</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {liabilities.map(l => <LineRow key={l.label} item={l} />)}
        </div>
      </div>
    </div>
  );
}
