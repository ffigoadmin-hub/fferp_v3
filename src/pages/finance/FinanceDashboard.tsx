import { Link } from 'react-router-dom';
import { Plus, ChevronDown, ArrowUpRight, ArrowDownRight, Wallet, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts';

const emptyChartData = [
  { name: 'Apr\n2026', value: 0 },
  { name: 'May\n2026', value: 0 },
  { name: 'Jun\n2026', value: 0 },
  { name: 'Jul\n2026', value: 0 },
  { name: 'Aug\n2026', value: 0 },
  { name: 'Sep\n2026', value: 0 },
  { name: 'Oct\n2026', value: 0 },
  { name: 'Nov\n2026', value: 0 },
  { name: 'Dec\n2026', value: 0 },
  { name: 'Jan\n2027', value: 0 },
  { name: 'Feb\n2027', value: 0 },
  { name: 'Mar\n2027', value: 0 },
];

export default function FinanceDashboard() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 pt-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Finance Dashboard</h1>
          <p className="text-[13px] text-slate-500">Fiscal Year 2026-27</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            View Vouchers
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
            <Plus className="h-4 w-4" /> New Transaction
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Receivables", value: "₹0.00", icon: ArrowUpRight, color: 'text-green-600', bg: 'bg-green-50' },
          { label: "Total Payables", value: "₹0.00", icon: ArrowDownRight, color: 'text-red-600', bg: 'bg-red-50' },
          { label: "Cash on Hand", value: "₹0.00", icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: "Net Profit", value: "₹0.00", icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 pt-5 pb-4 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div className={`p-2 ${card.bg} rounded-lg`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
              <p className="text-[13px] text-slate-500 font-medium mb-1">{card.label}</p>
              <p className="text-[24px] font-bold text-slate-800 tracking-tight">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50">
          <h3 className="font-medium text-slate-800 text-[15px]">Cash Flow</h3>
          <button className="flex items-center text-slate-500 text-[13px] hover:text-slate-800">
            This Fiscal Year <ChevronDown className="h-3.5 w-3.5 ml-1" />
          </button>
        </div>
        <div className="p-6 flex flex-col md:flex-row gap-8">
          <div className="flex-1 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={emptyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#888' }} dy={15} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }}
                  ticks={[0, 1000, 2000, 3000, 4000, 5000]}
                  tickFormatter={(val) => val === 0 ? '0' : `${val / 1000} K`} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="w-full md:w-56 flex flex-col justify-center space-y-7 pt-4 md:pt-0 pr-2">
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <div className="w-2.5 h-2.5 bg-[#b3bcc5] rounded-sm"></div>
                <span className="text-[13px] text-slate-500">Cash as on 01/04/2026</span>
              </div>
              <p className="text-[15px] font-medium text-slate-800">₹0.00</p>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <div className="w-2.5 h-2.5 bg-[#2dd482] rounded-sm"></div>
                <span className="text-[13px] text-slate-500">Incoming</span>
              </div>
              <p className="text-[15px] font-medium text-slate-800">₹0.00 <span className="text-slate-400 font-normal ml-1">( + )</span></p>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <div className="w-2.5 h-2.5 bg-[#f46a6a] rounded-sm"></div>
                <span className="text-[13px] text-slate-500">Outgoing</span>
              </div>
              <p className="text-[15px] font-medium text-slate-800">₹0.00 <span className="text-slate-400 font-normal ml-1">( - )</span></p>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <div className="w-2.5 h-2.5 bg-[#3b82f6] rounded-sm"></div>
                <span className="text-[13px] text-slate-500">Cash as on 31/03/2027</span>
              </div>
              <p className="text-[15px] font-medium text-slate-800">₹0.00 <span className="text-slate-400 font-normal ml-1">( = )</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50">
            <h3 className="font-medium text-slate-800 text-[15px] border-b border-dashed border-slate-400 pb-0.5 inline-block">Income and Expense</h3>
            <button className="flex items-center text-slate-500 text-[13px] hover:text-slate-800">
              This Fiscal Year <ChevronDown className="h-3.5 w-3.5 ml-1" />
            </button>
          </div>
          <div className="p-6 flex-1 flex flex-col">
            <div className="flex items-start justify-between mb-8">
              <div className="flex gap-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-[#2dd482] rounded-sm"></div>
                    <span className="text-[13px] text-slate-500">Total Income</span>
                  </div>
                  <p className="text-[17px] font-medium text-slate-800">₹0.00</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-[#f46a6a] rounded-sm"></div>
                    <span className="text-[13px] text-slate-500">Total Expenses</span>
                  </div>
                  <p className="text-[17px] font-medium text-slate-800">₹0.00</p>
                </div>
              </div>

              <div className="flex bg-slate-100 p-0.5 rounded-md">
                <button className="px-3 py-1.5 text-[12px] font-medium bg-white shadow-sm rounded-[4px] text-slate-800">Accrual</button>
                <button className="px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-800 rounded-[4px]">Cash</button>
              </div>
            </div>

            <div className="h-[220px] w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={emptyChartData} margin={{ top: 10, right: 0, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#888' }} dy={15} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }}
                    ticks={[0, 1000, 2000, 3000, 4000, 5000]}
                    tickFormatter={(val) => val === 0 ? '0' : `${val / 1000} K`} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="text-[11px] text-slate-500 font-medium mt-auto">* Income and expense values displayed are exclusive of taxes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
