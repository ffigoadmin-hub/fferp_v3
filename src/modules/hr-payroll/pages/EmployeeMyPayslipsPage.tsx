// @ts-nocheck
import { useState, useEffect } from 'react';
import igoLogo from '@/assets/igo-logo.png';
import { Button } from '@/components/ui/button';
import {
  FileText, Download, ArrowLeft, TrendingUp, TrendingDown,
  Wallet, BarChart3, User, Building, Briefcase, Clock,
  CheckCircle, ChevronRight, Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PayslipData {
  id: string;
  month: number;
  year: number;
  employee_name: string;
  employee_id: string;
  department: string;
  designation?: string;
  basic_salary: number;
  increment: number;
  incentive: number;
  lop_days: number;
  lop_amount: number;
  tds: number;
  days_in_month: number;
  selected_days: number;
  net_pay: number;
  paid_at?: string;
  status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const COMPANY = {
  name:       'IGO Precision Farming',
  fullName:   'IGO Precision Farming Pvt. Ltd.',
  address:    'No 17, Kovalan Street, 2nd Main Road, Uthandi Kanathur, Chennai 600119',
  helpline:   '044-00000000',
  email:      'hr@igogroup.in',
  disclaimer: 'Keep your salary confidential.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}
function fmtFull(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 2,
  }).format(n);
}
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}
function getInitials(name?: string) {
  if (!name) return 'U';
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

// ─── Number to Words (Indian system) ─────────────────────────────────────────
function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n < 20)      return ones[n];
    if (n < 100)     return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000)    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000)  return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }

  const intPart  = Math.floor(num);
  const decPart  = Math.round((num - intPart) * 100);
  let result     = convert(intPart);
  if (decPart > 0) result += ' and ' + convert(decPart) + ' Paise';
  return result;
}

// ─── Salary calculation helpers ───────────────────────────────────────────────
function buildEarnings(p: PayslipData) {
  const paidDays    = Math.max(p.selected_days - p.lop_days, 0);
  const factor      = p.days_in_month > 0 ? paidDays / p.days_in_month : 1;

  const basicSalary = p.basic_salary;                     // monthly basic
  const hra         = Math.round(basicSalary * 0.40);     // 40% HRA
  const suppAllw    = p.increment;                         // supplementary / increment
  const bonus       = 0;
  const oti         = p.incentive;                         // one-time incentive

  return [
    { label: 'Basic',                   salary: basicSalary, actual: Math.round(basicSalary * factor) },
    { label: 'HRA',                     salary: hra,          actual: Math.round(hra * factor) },
    { label: 'Supplementary Allowance', salary: suppAllw,     actual: Math.round(suppAllw * factor) },
    { label: 'Bonus',                   salary: bonus,         actual: Math.round(bonus * factor) },
    { label: 'One Time Incentive',      salary: oti,           actual: oti },  // OTI not prorated
  ];
}
function buildDeductions(p: PayslipData) {
  // Split tds into PF + ESI + PT (rough standard split)
  const pf  = Math.round(p.basic_salary * 0.12);          // 12% PF
  const esi  = p.basic_salary <= 21000 ? Math.round(p.basic_salary * 0.0075) : 0; // 0.75% ESI if eligible
  const pt   = 200;                                         // ₹200 professional tax
  const lop  = Math.round(p.lop_amount);

  return [
    { label: 'Employee PF',      amount: pf },
    { label: 'Employee ESI',     amount: esi },
    { label: 'Professional Tax', amount: pt },
    ...(lop > 0 ? [{ label: `LOP (${p.lop_days} days)`, amount: lop }] : []),
  ];
}

// ─── Payslip Print HTML Generator ────────────────────────────────────────────
function generatePayslipHTML(p: PayslipData, logoUrl?: string): string {
  const earnings   = buildEarnings(p);
  const deductions = buildDeductions(p);
  const paidDays   = Math.max(p.selected_days - p.lop_days, 0);

  const totalEarningActual = earnings.reduce((s, e) => s + e.actual, 0);
  const totalEarningSalary = earnings.reduce((s, e) => s + e.salary, 0);
  const totalDeduction     = deductions.reduce((s, d) => s + d.amount, 0);
  const netPay             = p.net_pay; // use DB computed net pay

  const monthYear = `${MONTHS[p.month - 1]} ${p.year}`;
  const netInWords = numberToWords(netPay);

  const infoRows: [string, string, string, string][] = [
    ['Employee Code',      p.employee_id || '—',    'Employee Name',       p.employee_name || '—'],
    ['Zone',               '—',                      'Grade',               '—'],
    ['Branch',             p.department || '—',      'Location',            'Chennai'],
    ['Date of Joining',    '—',                      'Department',          p.department || '—'],
    ['Designation',        p.designation || '—',     'Total Days In Month', String(p.days_in_month)],
    ['Days Paid',          String(paidDays),          'Bank Name',           '—'],
    ['LOP Reversal',       String(p.lop_days),        'Bank Account No.',    '—'],
    ['PF Account No.',     '—',                      'IFSC Code',           '—'],
    ['UAN No.',            '—',                      'PAN No.',             '—'],
    ['ESIC No.',           '—',                      '',                    ''],
  ];

  const maxRows = Math.max(earnings.length, deductions.length) + 1; // +1 for header
  let tableRows = '';
  for (let i = 0; i < earnings.length || i < deductions.length; i++) {
    const e = earnings[i];
    const d = deductions[i];
    tableRows += `<tr>
      <td class="tl">${e ? e.label : ''}</td>
      <td class="tr">${e ? '₹' + e.actual.toLocaleString('en-IN') : ''}</td>
      <td class="tr">${e ? '₹' + e.salary.toLocaleString('en-IN') : ''}</td>
      <td class="sep"></td>
      <td class="tl">${d ? d.label : ''}</td>
      <td class="tr">${d ? '₹' + d.amount.toLocaleString('en-IN') : ''}</td>
    </tr>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title> </title>
<style>
  @page { margin: 0; size: A4 portrait; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; padding: 10mm; }

  .wrapper   { max-width: 800px; margin: 0 auto; border: 2px solid #000; }

  /* ── Company Header ── */
  .header    { display: flex; align-items: center; padding: 10px 14px; border-bottom: 2px solid #000; }
  .logo-box  { width: 72px; height: 72px; border: 1px solid #ccc; border-radius: 6px;
               display: flex; align-items: center; justify-content: center; margin-right: 14px;
               background: #fff; flex-shrink:0; overflow: hidden; }
  .logo-img  { width: 68px; height: 68px; object-fit: contain; }
  .co-name   { font-size: 15px; font-weight: 700; color: #1a6b3c; margin-bottom: 3px; }
  .co-addr   { font-size: 9.5px; color: #444; line-height: 1.5; }
  .disclaimer{ background: #fff8e1; border-bottom: 1px solid #f0c040; padding: 5px 14px;
               font-size: 9.5px; font-weight: 700; color: #7a5c00; letter-spacing:.03em; }
  .slip-title{ background: #1a6b3c; color: #fff; text-align: center; padding: 6px;
               font-size: 12px; font-weight: 700; letter-spacing:.05em; }

  /* ── Info grid ── */
  .info-table { width: 100%; border-collapse: collapse; }
  .info-table td { padding: 4px 8px; border: 1px solid #ccc; font-size: 10px; }
  .info-label   { font-weight: 700; background: #f5f5f5; width: 18%; white-space: nowrap; }
  .info-value   { width: 32%; }

  /* ── Earnings / Deductions ── */
  .sal-table { width: 100%; border-collapse: collapse; margin-top: 0; }
  .sal-table th, .sal-table td { border: 1px solid #ccc; padding: 4px 7px; font-size: 10px; }
  .sal-table th { background: #d4edda; font-weight: 700; text-align: center; font-size: 10.5px; }
  .tl { text-align: left; }
  .tr { text-align: right; }
  .sep { width: 4px; background: #333; padding: 0; border-color: #333; }
  .total-row td { font-weight: 700; background: #e8f5e9; }
  .net-row td   { font-weight: 700; background: #1a6b3c; color: #fff; font-size: 11.5px; }

  /* ── Net Pay summary ── */
  .net-summary { padding: 8px 14px; border-top: 2px solid #000; }
  .net-line     { font-size: 11px; margin-bottom: 4px; }
  .net-line strong { color: #1a6b3c; }
  .footer-note  { padding: 6px 14px; background: #f5f5f5; border-top: 1px solid #ccc;
                  font-size: 9px; color: #555; }
  .quote        { padding: 6px 14px; font-style: italic; font-size: 9px; color: #666;
                  text-align: center; border-top: 1px dashed #ccc; }
  @media print { button { display: none !important; } }
</style>
</head>
<body>
<div class="wrapper">

  <!-- Company Header -->
  <div class="header">
    <div class="logo-box">${logoUrl ? `<img class="logo-img" src="${logoUrl}" alt="IGO Logo" />` : `<span style="font-size:22px">🌾</span>`}</div>
    <div>
      <div class="co-name">${COMPANY.fullName}</div>
      <div class="co-addr">
        ${COMPANY.address}<br>
        Helpline: ${COMPANY.helpline} &nbsp;|&nbsp; Email: ${COMPANY.email}
      </div>
    </div>
  </div>

  <div class="disclaimer">⚠ ${COMPANY.disclaimer}</div>
  <div class="slip-title">PAY SLIP FOR THE MONTH OF ${monthYear.toUpperCase()}</div>

  <!-- Employee Info -->
  <table class="info-table">
    ${infoRows.map(([l1, v1, l2, v2]) => `
      <tr>
        <td class="info-label">${l1}</td>
        <td class="info-value">${v1}</td>
        <td class="info-label">${l2}</td>
        <td class="info-value">${v2}</td>
      </tr>`).join('')}
  </table>

  <!-- Earnings & Deductions -->
  <table class="sal-table">
    <thead>
      <tr>
        <th colspan="3" style="border-right:2px solid #333">EARNINGS</th>
        <th class="sep"></th>
        <th colspan="2">DEDUCTIONS</th>
      </tr>
      <tr>
        <th class="tl" style="width:28%">Description</th>
        <th class="tr" style="width:11%">Actual</th>
        <th class="tr" style="width:11%;border-right:2px solid #333">Salary</th>
        <th class="sep"></th>
        <th class="tl" style="width:30%">Description</th>
        <th class="tr" style="width:15%">Deducted</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <!-- Totals row -->
      <tr class="total-row">
        <td class="tl"><strong>Total Earning</strong></td>
        <td class="tr">₹${totalEarningActual.toLocaleString('en-IN')}</td>
        <td class="tr" style="border-right:2px solid #333">₹${totalEarningSalary.toLocaleString('en-IN')}</td>
        <td class="sep"></td>
        <td class="tl"><strong>Total Deduction</strong></td>
        <td class="tr">₹${totalDeduction.toLocaleString('en-IN')}</td>
      </tr>
      <!-- Net Pay spanning row -->
      <tr class="net-row">
        <td colspan="2"><strong>NET PAY</strong></td>
        <td class="tr" style="border-right:2px solid #333"><strong>₹${netPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
        <td class="sep"></td>
        <td colspan="2" class="tr"><strong>₹${netPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
      </tr>
    </tbody>
  </table>

  <!-- Net Pay Summary -->
  <div class="net-summary">
    <div class="net-line"><strong>Net Pay :</strong> <strong>₹${netPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> Only</div>
    <div class="net-line"><strong>In words :</strong> <em>${netInWords} Rupees Only</em></div>
  </div>

  <div class="footer-note">
    This is a system generated report and does not require signature or stamp.
  </div>
  <div class="quote">
    <em>"Work hard in silence, let your success be your noise."</em>
  </div>

</div>
</body>
</html>`;
}

// ─── Print / Download ─────────────────────────────────────────────────────────
async function printPayslip(p: PayslipData) {
  // Convert logo to data URL so it embeds correctly in the popup window
  let logoDataUrl: string | undefined;
  try {
    const resp = await fetch(igoLogo);
    const blob = await resp.blob();
    logoDataUrl = await new Promise<string>((res) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { /* use fallback emoji if logo fetch fails */ }

  const html = generatePayslipHTML(p, logoDataUrl);
  const win  = window.open('', '_blank', 'width=900,height=720,scrollbars=yes');
  if (!win) { toast.error('Allow pop-ups to download payslip'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

// ─── Monthly Card ─────────────────────────────────────────────────────────────
function PayslipCard({ p, onClick }: { p: PayslipData; onClick: () => void }) {
  const deductions = p.lop_amount + p.tds;
  const gross      = p.basic_salary + p.incentive + p.increment;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl p-4 cursor-pointer border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 hover:scale-[1.01]"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      {/* Month header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-base font-black text-gray-900">
            {MONTHS[p.month - 1]} {p.year}
          </p>
          <p className="text-[10px] mt-0.5 text-gray-400">
            {p.days_in_month} days · {Math.max(p.selected_days - p.lop_days, 0)} paid
            {p.lop_days > 0 && ` · ${p.lop_days} LOP`}
          </p>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">
          ✓ Paid
        </span>
      </div>

      {/* Mini bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden mb-3 gap-0.5">
        {[
          { v: p.basic_salary, c: '#2563EB' },
          { v: p.incentive,    c: '#16A34A' },
          { v: p.increment,    c: '#D97706' },
          { v: deductions,     c: '#DC2626' },
        ].map((seg, i) => seg.v > 0 && (
          <div key={i} style={{ flex: seg.v, background: seg.c }} />
        ))}
      </div>

      {/* Key numbers */}
      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Basic Salary</span>
          <span className="font-semibold text-gray-900">{fmt(p.basic_salary)}</span>
        </div>
        {p.incentive > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Incentive</span>
            <span className="font-semibold text-green-600">+{fmt(p.incentive)}</span>
          </div>
        )}
        {p.increment > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Supplement</span>
            <span className="font-semibold text-amber-600">+{fmt(p.increment)}</span>
          </div>
        )}
        {deductions > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Deductions</span>
            <span className="font-semibold text-red-500">-{fmt(deductions)}</span>
          </div>
        )}
        <div className="flex justify-between pt-1.5 border-t border-gray-100">
          <span className="text-xs font-bold text-gray-700">Net Pay</span>
          <span className="text-sm font-black text-blue-600">{fmt(p.net_pay)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <button
          onClick={e => { e.stopPropagation(); printPayslip(p); toast.success('Opening payslip…'); }}
          className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-blue-600 transition-colors"
        >
          <Download className="w-3 h-3" /> Download
        </button>
        <span className="flex items-center gap-0.5 text-[10px] font-bold text-blue-600">
          View Payslip <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}

// ─── Payslip Detail View (Calibehr format in ERP) ─────────────────────────────
function PayslipDetailView({ p, onBack }: { p: PayslipData; onBack: () => void }) {
  const earnings      = buildEarnings(p);
  const deductions    = buildDeductions(p);
  const paidDays      = Math.max(p.selected_days - p.lop_days, 0);
  const totalEarning  = earnings.reduce((s, e) => s + e.actual, 0);
  const totalDeduct   = deductions.reduce((s, d) => s + d.amount, 0);
  const netPay        = p.net_pay;
  const netInWords    = numberToWords(netPay);
  const monthYear     = `${MONTHS[p.month - 1]} ${p.year}`;

  const infoLeft: [string, string][] = [
    ['Employee Code',   p.employee_id || '—'],
    ['Zone',            '—'],
    ['Branch',          p.department || '—'],
    ['Date of Joining', '—'],
    ['Designation',     p.designation || '—'],
    ['Days Paid',       String(paidDays)],
    ['LOP Reversal',    String(p.lop_days)],
    ['PF Account No.',  '—'],
    ['UAN No.',         '—'],
    ['ESIC No.',        '—'],
  ];
  const infoRight: [string, string][] = [
    ['Employee Name',       p.employee_name || '—'],
    ['Grade',               '—'],
    ['Location',            'Chennai'],
    ['Department',          p.department || '—'],
    ['Total Days In Month', String(p.days_in_month)],
    ['Bank Name',           '—'],
    ['Bank Account No.',    '—'],
    ['IFSC Code',           '—'],
    ['PAN No.',             '—'],
    ['',                    ''],
  ];

  const maxRows = Math.max(earnings.length, deductions.length);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">

      {/* Actions bar */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Payslips
        </button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => { printPayslip(p); toast.success('Opening print preview…'); }}
            className="gap-2 h-9 text-sm border-gray-300"
          >
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button
            onClick={() => { printPayslip(p); toast.success('Opening download…'); }}
            className="gap-2 h-9 text-sm bg-green-700 hover:bg-green-800 text-white"
          >
            <Download className="w-4 h-4" /> Download PDF
          </Button>
        </div>
      </div>

      {/* ── Payslip Card (matches print layout) ── */}
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm">

        {/* Company Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b-2 border-gray-800">
          <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center shrink-0 border border-gray-200 overflow-hidden p-1">
            <img src={igoLogo} alt="IGO Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1">
            <p className="text-base font-black text-green-800">{COMPANY.fullName}</p>
            <p className="text-xs text-gray-500 mt-0.5">{COMPANY.address}</p>
            <p className="text-xs text-gray-500">
              Helpline: {COMPANY.helpline} &nbsp;|&nbsp; Email: {COMPANY.email}
            </p>
          </div>
          {p.paid_at && (
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">
                ✓ Paid {format(new Date(p.paid_at), 'dd MMM yyyy')}
              </span>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="px-6 py-2 bg-yellow-50 border-b border-yellow-200">
          <p className="text-[10px] font-bold text-yellow-800">⚠ {COMPANY.disclaimer}</p>
        </div>

        {/* Pay Slip Title */}
        <div className="bg-green-800 text-white text-center py-2.5">
          <p className="text-xs font-black tracking-widest uppercase">
            Pay Slip for the Month of {monthYear}
          </p>
        </div>

        {/* Employee Info Grid */}
        <div className="border-b border-gray-300">
          <table className="w-full border-collapse text-xs">
            <tbody>
              {infoLeft.map(([label, value], i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-3 py-1.5 font-bold text-gray-700 border border-gray-200 w-[22%] whitespace-nowrap">{infoLeft[i][0]}</td>
                  <td className="px-3 py-1.5 text-gray-800 border border-gray-200 w-[28%]">{infoLeft[i][1]}</td>
                  <td className="px-3 py-1.5 font-bold text-gray-700 border border-gray-200 w-[22%] whitespace-nowrap">{infoRight[i][0]}</td>
                  <td className="px-3 py-1.5 text-gray-800 border border-gray-200 w-[28%]">{infoRight[i][1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Earnings & Deductions Table */}
        <div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th colSpan={3} className="px-3 py-2 bg-green-100 text-green-900 font-black text-center border border-gray-300 border-r-2 border-r-gray-600">
                  EARNINGS
                </th>
                <th colSpan={2} className="px-3 py-2 bg-red-50 text-red-900 font-black text-center border border-gray-300">
                  DEDUCTIONS
                </th>
              </tr>
              <tr className="bg-gray-100">
                <th className="px-3 py-2 text-left font-bold text-gray-700 border border-gray-300 w-[30%]">Description</th>
                <th className="px-3 py-2 text-right font-bold text-gray-700 border border-gray-300 w-[12%]">Actual</th>
                <th className="px-3 py-2 text-right font-bold text-gray-700 border border-gray-300 border-r-2 border-r-gray-600 w-[12%]">Salary</th>
                <th className="px-3 py-2 text-left font-bold text-gray-700 border border-gray-300 w-[30%]">Description</th>
                <th className="px-3 py-2 text-right font-bold text-gray-700 border border-gray-300 w-[16%]">Deducted</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRows }).map((_, i) => {
                const e = earnings[i];
                const d = deductions[i];
                return (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-3 py-2 text-gray-800 border border-gray-200">{e ? e.label : ''}</td>
                    <td className="px-3 py-2 text-right text-gray-800 border border-gray-200 font-mono">
                      {e ? `₹${e.actual.toLocaleString('en-IN')}` : ''}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 border border-gray-200 border-r-2 border-r-gray-600 font-mono">
                      {e ? `₹${e.salary.toLocaleString('en-IN')}` : ''}
                    </td>
                    <td className="px-3 py-2 text-gray-800 border border-gray-200">{d ? d.label : ''}</td>
                    <td className="px-3 py-2 text-right text-red-600 border border-gray-200 font-mono font-semibold">
                      {d ? `₹${d.amount.toLocaleString('en-IN')}` : ''}
                    </td>
                  </tr>
                );
              })}

              {/* Total row */}
              <tr className="bg-green-50 font-bold">
                <td className="px-3 py-2 text-green-900 border border-gray-300 font-black">Total Earning</td>
                <td className="px-3 py-2 text-right text-green-800 border border-gray-300 font-mono font-black">
                  ₹{totalEarning.toLocaleString('en-IN')}
                </td>
                <td className="px-3 py-2 text-right text-green-700 border border-gray-300 border-r-2 border-r-gray-600 font-mono font-black">
                  ₹{earnings.reduce((s, e) => s + e.salary, 0).toLocaleString('en-IN')}
                </td>
                <td className="px-3 py-2 text-red-900 border border-gray-300 font-black">Total Deduction</td>
                <td className="px-3 py-2 text-right text-red-700 border border-gray-300 font-mono font-black">
                  ₹{totalDeduct.toLocaleString('en-IN')}
                </td>
              </tr>

              {/* Net Pay row */}
              <tr className="bg-green-800 text-white font-black">
                <td className="px-3 py-3 border border-green-700 text-base">NET PAY</td>
                <td colSpan={2} className="px-3 py-3 text-right border border-green-700 border-r-2 border-r-green-600 text-base font-mono">
                  ₹{netPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-3 border border-green-700" />
                <td className="px-3 py-3 text-right border border-green-700 text-base font-mono">
                  ₹{netPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Net Pay Summary */}
        <div className="px-6 py-4 border-t-2 border-gray-800 space-y-1.5">
          <p className="text-sm">
            <span className="font-black text-gray-800">Net Pay : </span>
            <span className="font-bold text-green-800">
              ₹{netPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-gray-600"> Only</span>
          </p>
          <p className="text-sm">
            <span className="font-black text-gray-800">In words : </span>
            <span className="italic text-gray-700">{netInWords} Rupees Only</span>
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 bg-gray-50 border-t border-gray-200">
          <p className="text-[10px] text-gray-500">
            This is a system generated report and does not require signature or stamp.
          </p>
        </div>
        <div className="px-6 py-2 text-center border-t border-dashed border-gray-300 bg-white">
          <p className="text-[10px] text-gray-400 italic">
            "Work hard in silence, let your success be your noise."
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Employee Profile Header ──────────────────────────────────────────────────
function EmployeeProfileHeader({ user }: { user: any }) {
  const name     = user?.name || 'Employee';
  const initials = getInitials(name);

  return (
    <div className="rounded-2xl p-5 flex items-center gap-5 mb-6 bg-white border border-gray-200"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black shrink-0"
        style={{ background: 'linear-gradient(135deg,#EFF6FF,#BFDBFE)', color: '#2563EB', border: '2px solid #BFDBFE' }}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-black text-gray-900">{name}</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">● Active</span>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          {user?.employeeId && <span className="flex items-center gap-1"><User className="w-3 h-3" /> #{user.employeeId}</span>}
          {user?.department  && <span className="flex items-center gap-1"><Building className="w-3 h-3" /> {user.department}</span>}
          {user?.role        && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {user.role}</span>}
        </div>
      </div>
      <div className="text-right shrink-0 hidden md:block">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Employee ID</p>
        <p className="text-sm font-black text-gray-900">#{user?.employeeId || '—'}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EmployeeMyPayslipsPage() {
  const { user }                                    = useAuth();
  const [payslips, setPayslips]                     = useState<PayslipData[]>([]);
  const [loading, setLoading]                       = useState(true);
  const [selectedPayslip, setSelectedPayslip]       = useState<PayslipData | null>(null);

  useEffect(() => { fetchMyPayslips(); }, [user]);

  async function fetchMyPayslips() {
    if (!user) return;
    try {
      setLoading(true);

      const { data: batchEmployees, error } = await supabase
        .from('salary_batch_employees')
        .select(`
          id, batch_id, employee_name, department,
          basic_salary, increment, incentive,
          lop_days, lop_amount, tds,
          days_in_month, selected_days, net_pay, status,
          salary_batches!inner(month, year, from_day, to_day, status, paid_at)
        `)
        .or(`profile_id.eq.${user.id},employee_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) { toast.error('Failed to load payslips'); return; }

      const formatted: PayslipData[] = (batchEmployees || []).map((be: any) => {
        const batch = be.salary_batches;
        return {
          id:           be.id,
          month:        batch.month,
          year:         batch.year,
          employee_name: be.employee_name || user.name || '',
          employee_id:  user.employeeId || '',
          department:   be.department || user.department || '',
          designation:  user.role || '',
          basic_salary: be.basic_salary || 0,
          increment:    be.increment    || 0,
          incentive:    be.incentive    || 0,
          lop_days:     be.lop_days     || 0,
          lop_amount:   be.lop_amount   || 0,
          tds:          be.tds          || 0,
          days_in_month: getDaysInMonth(batch.year, batch.month),
          selected_days: be.selected_days || getDaysInMonth(batch.year, batch.month),
          net_pay:      be.net_pay      || 0,
          paid_at:      batch.paid_at,
          status:       be.status || batch.status || 'Draft',
        };
      }).filter((p: PayslipData) => ['Paid', 'PAID', 'Paid Already'].includes(p.status));

      setPayslips(formatted);
    } catch { toast.error('Failed to load payslips'); }
    finally   { setLoading(false); }
  }

  // ── Payslip detail view ──
  if (selectedPayslip) {
    return <PayslipDetailView p={selectedPayslip} onBack={() => setSelectedPayslip(null)} />;
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <EmployeeProfileHeader user={user} />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500">Loading payslips…</span>
        </div>
      </div>
    );
  }

  // ── Chart data ──
  const chartData = [...payslips].reverse().slice(-6).map(p => ({
    name:      `${MONTHS[p.month - 1].slice(0, 3)} ${p.year}`,
    'Net Pay': p.net_pay,
    'Basic':   p.basic_salary,
  }));

  // ── List view ──
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <EmployeeProfileHeader user={user} />

      {/* Page title */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-gray-900">My Payslips</h1>
          <p className="text-xs mt-0.5 text-gray-500">
            {payslips.length} payslip{payslips.length !== 1 ? 's' : ''} available · Click any month to view &amp; download
          </p>
        </div>
      </div>

      {payslips.length === 0 ? (
        <div className="flex flex-col items-center py-20 rounded-2xl bg-gray-50 border border-dashed border-gray-300">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-blue-50">
            <FileText className="w-8 h-8 text-blue-300" />
          </div>
          <p className="text-base font-bold text-gray-700 mb-1">No payslips yet</p>
          <p className="text-sm text-center max-w-xs text-gray-400">
            Your payslips will appear here once your salary has been processed and marked as paid.
          </p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* Salary trend chart */}
          {chartData.length > 1 && (
            <div className="rounded-2xl p-5 bg-white border border-gray-200"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
                Monthly Salary Trend (last {chartData.length} months)
              </p>
              <div style={{ height: 130 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#D1D5DB' }} axisLine={false} tickLine={false}
                      tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => [fmtFull(v)]}
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E5E7EB' }} />
                    <Bar dataKey="Net Pay" fill="#16A34A" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Basic"   fill="#BFDBFE" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <div className="w-2.5 h-2.5 rounded-sm bg-green-600" /> Net Pay
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <div className="w-2.5 h-2.5 rounded-sm bg-blue-200" /> Basic Salary
                </span>
              </div>
            </div>
          )}

          {/* Payslip cards grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {payslips.map(p => (
              <PayslipCard key={p.id} p={p} onClick={() => setSelectedPayslip(p)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
