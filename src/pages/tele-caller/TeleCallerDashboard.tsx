import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, Search, Plus, Clock, ShoppingBag, AlertCircle, ChevronRight } from 'lucide-react';
import { format, isToday } from 'date-fns';

function StatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: number;
  icon: React.ComponentType<{ className?: string }>; color: string;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="px-6 pt-5 pb-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <div className={`p-2 ${bg} rounded-lg`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
        <p className="text-[13px] text-slate-500 font-medium mb-1">{label}</p>
        <p className="text-[24px] font-bold text-slate-800 tracking-tight">{value}</p>
      </div>
    </div>
  );
}

export default function TeleCallerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: todayCalls = [] } = useQuery({
    queryKey: ['call-logs', user?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('call_logs')
        .select('*, customer:customers(shop_name,phone,outstanding_balance)')
        .eq('tele_caller_id', user!.id)
        .gte('created_at', today)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: followups = [] } = useQuery({
    queryKey: ['followup-reminders', user?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('followup_reminders')
        .select('*, customer:customers(id,shop_name,phone,outstanding_balance,city)')
        .eq('tele_caller_id', user!.id)
        .eq('is_completed', false)
        .lte('reminder_date', today)
        .order('reminder_date', { ascending: true });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: customers = [], isFetching: searching } = useQuery({
    queryKey: ['customers-search', search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const { data } = await supabase
        .from('customers')
        .select('id,shop_name,owner_name,phone,city,outstanding_balance,credit_days')
        .or(`shop_name.ilike.%${search}%,phone.ilike.%${search}%,owner_name.ilike.%${search}%`)
        .eq('is_active', true)
        .limit(10);
      return data ?? [];
    },
    enabled: search.length >= 2,
  });

  const ordersToday = (todayCalls as any[]).filter((c: any) => c.outcome === 'order_placed').length;
  const callsToday = todayCalls.length;
  const overdueFollowups = (followups as any[]).filter((f: any) => f.reminder_date < today).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 pt-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Tele-Caller CRM</h1>
          <p className="text-[13px] text-slate-500">
            {format(new Date(), 'EEEE, d MMMM')} — {callsToday} calls today
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sales/customers')}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            <Plus className="h-4 w-4" /> Add Shop
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Calls Today" value={callsToday} icon={Phone} color="text-blue-600" bg="bg-blue-50" />
        <StatCard label="Orders Placed" value={ordersToday} icon={ShoppingBag} color="text-green-600" bg="bg-green-50" />
        <StatCard label="Follow-ups Due" value={(followups as any[]).length} icon={Clock} color="text-yellow-600" bg="bg-yellow-50" />
        <StatCard label="Overdue" value={overdueFollowups} icon={AlertCircle} color="text-red-600" bg="bg-red-50" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Quick Shop Search</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Search shop name, phone, or owner..."
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Searching...</span>
          )}
        </div>

        {(customers as any[]).length > 0 && (
          <div className="mt-3 divide-y divide-gray-100">
            {(customers as any[]).map((c: any) => (
              <button
                key={c.id}
                onClick={() => navigate(`/tele-caller/shop/${c.id}`)}
                className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 px-2 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-800 text-sm">{c.shop_name}</p>
                  <p className="text-xs text-gray-500">{c.owner_name} · {c.phone} · {c.city}</p>
                </div>
                <div className="flex items-center gap-3">
                  {c.outstanding_balance > 0 && (
                    <span className="text-xs font-semibold text-red-600">
                      ₹{c.outstanding_balance.toLocaleString('en-IN')} due
                    </span>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/tele-caller/take-order/${c.id}`); }}
                      className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                    >
                      Take Order
                    </button>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {search.length >= 2 && (customers as any[]).length === 0 && !searching && (
          <div className="mt-4 text-center text-sm text-gray-500">
            No shops found.{' '}
            <button onClick={() => navigate('/sales/customers')} className="text-green-600 hover:underline">Add new shop →</button>
          </div>
        )}
      </div>

      {(followups as any[]).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Follow-up Reminders</h3>
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">
              {(followups as any[]).length} pending
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {(followups as any[]).map((f: any) => {
              const isOver = f.reminder_date < today;
              const isTod = isToday(new Date(f.reminder_date));
              return (
                <div key={f.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${isOver ? 'bg-red-500' : 'bg-yellow-400'}`} />
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{f.customer?.shop_name}</p>
                      <p className="text-xs text-gray-500">{f.reason}</p>
                      <p className={`text-xs font-medium mt-0.5 ${isOver ? 'text-red-600' : 'text-yellow-600'}`}>
                        {isOver ? '⚠️ Overdue — ' : isTod ? '📅 Today — ' : ''}
                        {format(new Date(f.reminder_date), 'dd MMM')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`tel:${f.customer?.phone}`}
                      className="flex items-center gap-1 rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                    >
                      <Phone className="h-3 w-3" /> Call
                    </a>
                    <button
                      onClick={() => navigate(`/tele-caller/shop/${f.customer?.id}`)}
                      className="rounded-md bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Today's Call Log</h3>
        </div>
        {todayCalls.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            No calls logged today. Start by searching a shop above.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {(todayCalls as any[]).slice(0, 8).map((call: any) => (
              <div key={call.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{call.customer?.shop_name}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {call.call_purpose?.replace('_', ' ')} · {call.duration_sec}s
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    call.outcome === 'order_placed' ? 'bg-green-100 text-green-700' :
                    call.outcome === 'not_answered' ? 'bg-gray-100 text-gray-600' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {call.outcome?.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-400">
                    {format(new Date(call.created_at), 'HH:mm')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
