// @ts-nocheck
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { toast } from 'sonner';
import {
  FileText, Download, Printer, RefreshCw, Filter,
  Banknote, Truck, CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import * as XLSX from 'xlsx';

const STATUS_LABELS: Record<string, string> = {
  pending_ff_ops:  'Pending FF Ops',
  pending_gm:      'Pending GM',
  pending_l1:      'Pending L1',
  pending_auditor: 'Pending Auditor',
  pending_ceo:     'Pending CEO',
  approved:        'Approved',
  paid:            'Paid',
  rejected:        'Rejected',
};

const STATUS_PRINT: Record<string, string> = {
  paid:     'color:#16A34A;font-weight:600',
  approved: 'color:#2563EB;font-weight:600',
  rejected: 'color:#DC2626;font-weight:600',
};

type DateRange = 'this_month' | 'last_month' | 'custom';

export default function FFPaymentsReport() {
  const printRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'vendor' | 'transport'>('vendor');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange>('this_month');
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customTo,   setCustomTo]   = useState(format(new Date(), 'yyyy-MM-dd'));

  const getRange = () => {
    if (dateRange === 'this_month')  return [format(startOfMonth(new Date()), 'yyyy-MM-dd'), format(endOfMonth(new Date()), 'yyyy-MM-dd')];
    if (dateRange === 'last_month')  return [format(startOfMonth(subMonths(new Date(),1)), 'yyyy-MM-dd'), format(endOfMonth(subMonths(new Date(),1)), 'yyyy-MM-dd')];
    return [customFrom, customTo];
  };

  const [from, to] = getRange();

  // Vendor payments
  const { data: vendorPayments = [], isLoading: vLoad, refetch: vRefetch } = useQuery({
    queryKey: ['report-vendor-payments', from, to, statusFilter],
    queryFn: async () => {
      let q = (supabase as any)
        .from('ff_vendor_payments')
        .select(`id, created_at, payment_status, gross_amount, deduction_amount, net_amount, utr_number, paid_at,
          vendors(name, bank_name, bank_account, bank_ifsc),
          hubs(name)`)
        .gte('created_at', from + 'T00:00:00')
        .lte('created_at', to   + 'T23:59:59')
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('payment_status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Transport payments
  const { data: transportPayments = [], isLoading: tLoad, refetch: tRefetch } = useQuery({
    queryKey: ['report-transport-payments', from, to, statusFilter],
    queryFn: async () => {
      let q = (supabase as any)
        .from('ff_transport_payments')
        .select(`id, created_at, trip_date, vehicle_number, origin, destination, payment_status,
          base_amount, toll_charges, other_charges, total_amount, utr_number, paid_at,
          hubs(name)`)
        .gte('created_at', from + 'T00:00:00')
        .lte('created_at', to   + 'T23:59:59')
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('payment_status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const payments = tab === 'vendor' ? vendorPayments : transportPayments;
  const isLoading = tab === 'vendor' ? vLoad : tLoad;

  // Summary KPIs
  const totalPaid   = payments.filter(p => p.payment_status === 'paid').reduce((s, p) => s + Number(tab === 'vendor' ? p.net_amount : p.total_amount || 0), 0);
  const totalApproved = payments.filter(p => p.payment_status === 'approved').reduce((s, p) => s + Number(tab === 'vendor' ? p.net_amount : p.total_amount || 0), 0);
  const totalPending  = payments.filter(p => p.payment_status?.startsWith('pending')).length;
  const totalRejected = payments.filter(p => p.payment_status === 'rejected').length;

  // ── Excel export ──────────────────────────────────────────────
  const exportExcel = () => {
    const rows = tab === 'vendor'
      ? vendorPayments.map(p => ({
          'Date':           format(new Date(p.created_at), 'dd MMM yyyy'),
          'Vendor':         p.vendors?.name || '—',
          'Hub':            p.hubs?.name    || '—',
          'Gross (₹)':      Number(p.gross_amount      || 0),
          'Deduction (₹)':  Number(p.deduction_amount  || 0),
          'Net (₹)':        Number(p.net_amount        || 0),
          'Status':         STATUS_LABELS[p.payment_status] || p.payment_status,
          'UTR':            p.utr_number || '—',
          'Paid On':        p.paid_at ? format(new Date(p.paid_at), 'dd MMM yyyy') : '—',
          'Bank':           p.vendors?.bank_name    || '—',
          'Account':        p.vendors?.bank_account || '—',
          'IFSC':           p.vendors?.bank_ifsc    || '—',
        }))
      : transportPayments.map(p => ({
          'Created':        format(new Date(p.created_at), 'dd MMM yyyy'),
          'Trip Date':      p.trip_date ? format(new Date(p.trip_date), 'dd MMM yyyy') : '—',
          'Vehicle':        p.vehicle_number || '—',
          'Hub':            p.hubs?.name     || '—',
          'Route':          `${p.origin || '—'} → ${p.destination || '—'}`,
          'Base (₹)':       Number(p.base_amount   || 0),
          'Toll (₹)':       Number(p.toll_charges  || 0),
          'Other (₹)':      Number(p.other_charges || 0),
          'Total (₹)':      Number(p.total_amount  || 0),
          'Status':         STATUS_LABELS[p.payment_status] || p.payment_status,
          'UTR':            p.utr_number || '—',
          'Paid On':        p.paid_at ? format(new Date(p.paid_at), 'dd MMM yyyy') : '—',
        }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab === 'vendor' ? 'Vendor Payments' : 'Transport Payments');

    // Add summary sheet
    const summary = [
      { Metric: 'Report Period', Value: `${from} to ${to}` },
      { Metric: 'Total Records', Value: payments.length },
      { Metric: 'Total Paid (₹)', Value: totalPaid },
      { Metric: 'Awaiting Payment (₹)', Value: totalApproved },
      { Metric: 'Pending Approvals', Value: totalPending },
      { Metric: 'Rejected', Value: totalRejected },
    ];
    const ws2 = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

    XLSX.writeFile(wb, `FF_${tab}_payments_${from}_${to}.xlsx`);
    toast.success('Excel exported ✓');
  };

  // ── Print PDF ─────────────────────────────────────────────────
  const printReport = () => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;

    const rows = tab === 'vendor'
      ? vendorPayments.map(p => `
          <tr>
            <td>${format(new Date(p.created_at), 'dd MMM yyyy')}</td>
            <td>${p.vendors?.name || '—'}</td>
            <td>${p.hubs?.name || '—'}</td>
            <td style="text-align:right">₹${Number(p.gross_amount||0).toLocaleString('en-IN')}</td>
            <td style="text-align:right;color:#DC2626">₹${Number(p.deduction_amount||0).toLocaleString('en-IN')}</td>
            <td style="text-align:right;font-weight:600">₹${Number(p.net_amount||0).toLocaleString('en-IN')}</td>
            <td style="${STATUS_PRINT[p.payment_status]||''}">${STATUS_LABELS[p.payment_status]||p.payment_status}</td>
            <td>${p.utr_number || '—'}</td>
          </tr>`).join('')
      : transportPayments.map(p => `
          <tr>
            <td>${p.trip_date ? format(new Date(p.trip_date), 'dd MMM yyyy') : '—'}</td>
            <td>${p.vehicle_number || '—'}</td>
            <td>${p.hubs?.name || '—'}</td>
            <td>${p.origin||'—'} → ${p.destination||'—'}</td>
            <td style="text-align:right;font-weight:600">₹${Number(p.total_amount||0).toLocaleString('en-IN')}</td>
            <td style="${STATUS_PRINT[p.payment_status]||''}">${STATUS_LABELS[p.payment_status]||p.payment_status}</td>
            <td>${p.utr_number || '—'}</td>
          </tr>`).join('');

    const headers = tab === 'vendor'
      ? '<th>Date</th><th>Vendor</th><th>Hub</th><th>Gross</th><th>Deduction</th><th>Net</th><th>Status</th><th>UTR</th>'
      : '<th>Trip Date</th><th>Vehicle</th><th>Hub</th><th>Route</th><th>Total</th><th>Status</th><th>UTR</th>';

    win.document.write(`<!DOCTYPE html><html><head>
      <title>FF ${tab === 'vendor' ? 'Vendor' : 'Transport'} Payments Report</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #111; }
        h2 { font-size: 16px; margin-bottom: 4px; }
        .meta { color: #6b7280; font-size: 10px; margin-bottom: 16px; }
        .kpis { display: flex; gap: 24px; margin-bottom: 16px; }
        .kpi { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 16px; }
        .kpi-val { font-size: 18px; font-weight: 700; }
        .kpi-lbl { font-size: 10px; color: #6b7280; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
        td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
        tr:hover td { background: #f9fafb; }
        .footer { margin-top: 24px; color: #9ca3af; font-size: 9px; border-top: 1px solid #e5e7eb; padding-top: 8px; }
        @media print { @page { size: A4 landscape; margin: 15mm; } }
      </style>
    </head><body>
      <h2>Farmers Factory — ${tab === 'vendor' ? 'Vendor' : 'Transport'} Payments Report</h2>
      <div class="meta">Period: ${from} to ${to} &nbsp;|&nbsp; Generated: ${format(new Date(), 'dd MMM yyyy, h:mm a')} &nbsp;|&nbsp; Records: ${payments.length}</div>
      <div class="kpis">
        <div class="kpi"><div class="kpi-val" style="color:#16A34A">₹${totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div><div class="kpi-lbl">Total Paid</div></div>
        <div class="kpi"><div class="kpi-val" style="color:#2563EB">₹${totalApproved.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div><div class="kpi-lbl">Awaiting Payment</div></div>
        <div class="kpi"><div class="kpi-val" style="color:#D97706">${totalPending}</div><div class="kpi-lbl">Pending Approval</div></div>
        <div class="kpi"><div class="kpi-val" style="color:#DC2626">${totalRejected}</div><div class="kpi-lbl">Rejected</div></div>
      </div>
      <table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">FFERPv2 · Farmers Factory &nbsp;|&nbsp; Confidential — Internal Use Only</div>
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">FF Payments Report</h1>
          <p className="text-xs text-gray-500 mt-0.5">Vendor & Transport payment history with export</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-green-200 bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition"
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
          <button
            onClick={printReport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition"
          >
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </button>
          <button
            onClick={() => { vRefetch(); tRefetch(); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Paid',         value: `₹${totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,     color: 'text-green-600',  bg: 'bg-green-50',  icon: CheckCircle2 },
          { label: 'Awaiting Payment',   value: `₹${totalApproved.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'text-blue-600',   bg: 'bg-blue-50',   icon: Banknote },
          { label: 'Pending Approvals',  value: totalPending,                                                                color: 'text-amber-600',  bg: 'bg-amber-50',  icon: Clock },
          { label: 'Rejected',           value: totalRejected,                                                              color: 'text-red-600',    bg: 'bg-red-50',    icon: XCircle },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
            <div className={`p-2 rounded-lg ${k.bg}`}>
              <k.icon className={`w-5 h-5 ${k.color}`} />
            </div>
            <div>
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-gray-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Type tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          {[
            { key: 'vendor',    label: 'Vendor Payments',    icon: Banknote },
            { key: 'transport', label: 'Transport Payments', icon: Truck },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>

        {/* Date range + status filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value as DateRange)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
          >
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="custom">Custom Range</option>
          </select>
          {dateRange === 'custom' && (
            <>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={customTo}   onChange={e => setCustomTo(e.target.value)}   className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
            </>
          )}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
          >
            <option value="all">All Status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            {tab === 'vendor' ? 'Vendor' : 'Transport'} Payments
            <span className="ml-2 text-gray-400 font-normal">({payments.length} records)</span>
          </h2>
        </div>

        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading...
          </div>
        ) : payments.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-gray-400">
            <FileText className="w-8 h-8 mb-2 text-gray-300" />
            <p className="text-sm">No records for selected period</p>
          </div>
        ) : tab === 'vendor' ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                {['Date','Vendor','Hub','Gross','Deduction','Net','Status','UTR','Paid On'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-500 uppercase tracking-wide text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendorPayments.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                  <td className="px-4 py-2.5 text-gray-600">{format(new Date(p.created_at), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{p.vendors?.name || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500">{p.hubs?.name || '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">₹{Number(p.gross_amount||0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5 text-right text-red-500">₹{Number(p.deduction_amount||0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-800">₹{Number(p.net_amount||0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      p.payment_status === 'paid'     ? 'bg-green-100 text-green-700' :
                      p.payment_status === 'approved' ? 'bg-blue-100 text-blue-700'  :
                      p.payment_status === 'rejected' ? 'bg-red-100 text-red-600'    :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {STATUS_LABELS[p.payment_status] || p.payment_status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 font-mono">{p.utr_number || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500">{p.paid_at ? format(new Date(p.paid_at), 'dd MMM yyyy') : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold text-gray-700">
                <td colSpan={3} className="px-4 py-2.5 text-xs uppercase">Total ({vendorPayments.length})</td>
                <td className="px-4 py-2.5 text-right text-xs">₹{vendorPayments.reduce((s,p) => s+Number(p.gross_amount||0),0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2.5 text-right text-xs text-red-500">₹{vendorPayments.reduce((s,p) => s+Number(p.deduction_amount||0),0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2.5 text-right text-sm text-green-700">₹{vendorPayments.reduce((s,p) => s+Number(p.net_amount||0),0).toLocaleString('en-IN')}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                {['Trip Date','Vehicle','Hub','Route','Base','Toll','Other','Total','Status','UTR'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-500 uppercase tracking-wide text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transportPayments.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                  <td className="px-4 py-2.5 text-gray-600">{p.trip_date ? format(new Date(p.trip_date), 'dd MMM yyyy') : '—'}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{p.vehicle_number || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500">{p.hubs?.name || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500">{p.origin||'—'} → {p.destination||'—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">₹{Number(p.base_amount||0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">₹{Number(p.toll_charges||0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">₹{Number(p.other_charges||0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-800">₹{Number(p.total_amount||0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      p.payment_status === 'paid'     ? 'bg-green-100 text-green-700' :
                      p.payment_status === 'approved' ? 'bg-blue-100 text-blue-700'  :
                      p.payment_status === 'rejected' ? 'bg-red-100 text-red-600'    :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {STATUS_LABELS[p.payment_status] || p.payment_status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 font-mono">{p.utr_number || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold text-gray-700">
                <td colSpan={7} className="px-4 py-2.5 text-xs uppercase">Total ({transportPayments.length})</td>
                <td className="px-4 py-2.5 text-right text-sm text-green-700">₹{transportPayments.reduce((s,p) => s+Number(p.total_amount||0),0).toLocaleString('en-IN')}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
