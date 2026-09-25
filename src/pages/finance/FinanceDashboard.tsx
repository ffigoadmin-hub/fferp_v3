import { Plus, ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface FinanceSummary {
  total_receivables: number; total_payables: number; cash_on_hand: number; net_profit: number;
  total_income: number; total_expense: number; fiscal_year_start: string; fiscal_year_end: string;
}
interface MonthlyTrend {
  month_start: string; income: number; expense: number; cash_in: number; cash_out: number;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const monthLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).replace(' ', '\n');

export default function FinanceDashboard() {
  const navigate = useNavigate();

  const { data: summary, isLoading: loadingSummary, error: summaryError } = useQuery({
    queryKey: ['acct-finance-summary'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('acct_finance_summary');
      if (error) throw error;
      return data as unknown as FinanceSummary;
    },
  });

  const { data: trend = [] } = useQuery({
    queryKey: ['acct-finance-monthly-trend'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('acct_finance_monthly_trend');
      if (error) throw error;
      return (data || []) as MonthlyTrend[];
    },
  });

  const cashOpening = summary ? summary.cash_on_hand - trend.reduce((s, m) => s + Number(m.cash_in) - Number(m.cash_out), 0) : 0;
  let running = cashOpening;
  const cashChartData = trend.map(m => {
    running += Number(m.cash_in) - Number(m.cash_out);
    return { name: monthLabel(m.month_start), value: Math.round(running) };
  });
  const incomeExpenseData = trend.map(m => ({ name: monthLabel(m.month_start), income: Math.round(Number(m.income)), expense: Math.round(Number(m.expense)) }));
  const totalIncoming = trend.reduce((s, m) => s + Number(m.cash_in), 0);
  const totalOutgoing = trend.reduce((s, m) => s + Number(m.cash_out), 0);

  const cards = summary ? [
    { label: 'Total Receivables', value: inr(summary.total_receivables), icon: ArrowUpRight, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Payables',    value: inr(summary.total_payables),    icon: ArrowDownRight, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Cash on Hand',      value: inr(summary.cash_on_hand),      icon: Wallet, color: summary.cash_on_hand >= 0 ? 'text-blue-600' : 'text-red-600', bg: summary.cash_on_hand >= 0 ? 'bg-blue-50' : 'bg-red-50' },
    { label: 'Net Profit',        value: inr(summary.net_profit),        icon: summary.net_profit >= 0 ? TrendingUp : TrendingDown, color: summary.net_profit >= 0 ? 'text-indigo-600' : 'text-red-600', bg: summary.net_profit >= 0 ? 'bg-indigo-50' : 'bg-red-50' },
  ] : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 pt-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Finance Dashboard</h1>
          <p className="text-[13px] text-slate-500">
            {summary ? `FY ${new Date(summary.fiscal_year_start).getFullYear()}-${String(new Date(summary.fiscal_year_end).getFullYear()).slice(-2)}` : 'Loading fiscal year...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/accounts/books/ledger')} className="flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            View Vouchers
          </button>
          <button onClick={() => navigate('/accounts/books/journal/new')} className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
            <Plus className="h-4 w-4" /> New Transaction
          </button>
        </div>
      </div>

      {summaryError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          Couldn't load finance data — you may not have permission to view this (Accounts/Admin/CEO/Director/Auditor only).
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(loadingSummary ? Array.from({ length: 4 }) : cards).map((card: any, i) => (
            <div key={card?.label ?? i} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 pt-5 pb-4 flex-1 flex flex-col">
                {card ? (
                  <>
                    <div className="flex justify-between items-start mb-2">
                      <div className={`p-2 ${card.bg} rounded-lg`}>
                        <card.icon className={`h-5 w-5 ${card.color}`} />
                      </div>
                    </div>
                    <p className="text-[13px] text-slate-500 font-medium mb-1">{card.label}</p>
                    <p className="text-[24px] font-bold text-slate-800 tracking-tight">{card.value}</p>
                  </>
                ) : <div className="h-16 animate-pulse bg-slate-100 rounded" />}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50">
          <h3 className="font-medium text-slate-800 text-[15px]">Cash Flow</h3>
          <span className="text-slate-400 text-[13px]">This Fiscal Year</span>
        </div>
        <div className="p-6 flex flex-col md:flex-row gap-8">
          <div className="flex-1 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#888' }} dy={15} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }}
                  tickFormatter={(val) => val === 0 ? '0' : `${(val / 1000).toFixed(0)}K`} />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="w-full md:w-56 flex flex-col justify-center space-y-7 pt-4 md:pt-0 pr-2">
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <div className="w-2.5 h-2.5 bg-[#b3bcc5] rounded-sm"></div>
                <span className="text-[13px] text-slate-500">Cash as on {summary ? new Date(summary.fiscal_year_start).toLocaleDateString('en-IN') : '—'}</span>
              </div>
              <p className="text-[15px] font-medium text-slate-800">{inr(cashOpening)}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <div className="w-2.5 h-2.5 bg-[#2dd482] rounded-sm"></div>
                <span className="text-[13px] text-slate-500">Incoming</span>
              </div>
              <p className="text-[15px] font-medium text-slate-800">{inr(totalIncoming)} <span className="text-slate-400 font-normal ml-1">( + )</span></p>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <div className="w-2.5 h-2.5 bg-[#f46a6a] rounded-sm"></div>
                <span className="text-[13px] text-slate-500">Outgoing</span>
              </div>
              <p className="text-[15px] font-medium text-slate-800">{inr(totalOutgoing)} <span className="text-slate-400 font-normal ml-1">( - )</span></p>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <div className="w-2.5 h-2.5 bg-[#3b82f6] rounded-sm"></div>
                <span className="text-[13px] text-slate-500">Cash as on {summary ? new Date(summary.fiscal_year_end).toLocaleDateString('en-IN') : '—'}</span>
              </div>
              <p className="text-[15px] font-medium text-slate-800">{summary ? inr(summary.cash_on_hand) : '—'} <span className="text-slate-400 font-normal ml-1">( = )</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50">
            <h3 className="font-medium text-slate-800 text-[15px] border-b border-dashed border-slate-400 pb-0.5 inline-block">Income and Expense</h3>
            <span className="text-slate-400 text-[13px]">This Fiscal Year</span>
          </div>
          <div className="p-6 flex-1 flex flex-col">
            <div className="flex items-start justify-between mb-8">
              <div className="flex gap-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-[#2dd482] rounded-sm"></div>
                    <span className="text-[13px] text-slate-500">Total Income</span>
                  </div>
                  <p className="text-[17px] font-medium text-slate-800">{summary ? inr(summary.total_income) : '—'}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-[#f46a6a] rounded-sm"></div>
                    <span className="text-[13px] text-slate-500">Total Expenses</span>
                  </div>
                  <p className="text-[17px] font-medium text-slate-800">{summary ? inr(summary.total_expense) : '—'}</p>
                </div>
              </div>
            </div>

            <div className="h-[220px] w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeExpenseData} margin={{ top: 10, right: 0, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#888' }} dy={15} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }}
                    tickFormatter={(val) => val === 0 ? '0' : `${(val / 1000).toFixed(0)}K`} />
                  <Bar dataKey="income" fill="#2dd482" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expense" fill="#f46a6a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="text-[11px] text-slate-500 font-medium mt-auto">* Income and expense are accrual-basis (posting date), inclusive of GST ledger entries where recorded.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
