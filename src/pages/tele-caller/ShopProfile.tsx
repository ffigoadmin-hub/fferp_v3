import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import {
  Phone, MapPin, CreditCard, ShoppingBag, Clock, Plus,
  ChevronRight, Bell
} from 'lucide-react';

export default function ShopProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showFollowupForm, setShowFollowupForm] = useState(false);
  const [followupDate, setFollowupDate] = useState('');
  const [followupNote, setFollowupNote] = useState('');

  const { data: customer } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['customer-orders', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_orders')
        .select('id, order_number, order_date, status, net_amount, payment_mode')
        .eq('customer_id', id!)
        .order('order_date', { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: callLogs = [] } = useQuery({
    queryKey: ['customer-calls', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('call_logs')
        .select('*')
        .eq('customer_id', id!)
        .order('called_at', { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: followups = [] } = useQuery({
    queryKey: ['customer-followups', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('followup_reminders')
        .select('*')
        .eq('customer_id', id!)
        .eq('is_done', false)
        .order('follow_up_date');
      return data ?? [];
    },
    enabled: !!id,
  });

  const logCall = useMutation({
    mutationFn: async (outcome: string) => {
      const { error } = await supabase.from('call_logs').insert({
        customer_id: id!,
        called_by: user!.id,
        outcome,
        called_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Call logged!');
      qc.invalidateQueries({ queryKey: ['customer-calls'] });
    },
  });

  const addFollowup = useMutation({
    mutationFn: async () => {
      if (!followupDate) throw new Error('Select follow-up date');
      const { error } = await supabase.from('followup_reminders').insert({
        customer_id: id!,
        assigned_to: user!.id,
        follow_up_date: followupDate,
        notes: followupNote.trim() || null,
        is_done: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Follow-up reminder set!');
      setShowFollowupForm(false);
      setFollowupDate('');
      setFollowupNote('');
      qc.invalidateQueries({ queryKey: ['customer-followups'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!customer) return <div className="p-8 text-center text-sm text-gray-400">Loading...</div>;

  const totalPurchases = (orders as any[]).reduce((s: number, o: any) => s + (Number(o.net_amount) || 0), 0);

  const STATUS_COLOR: Record<string, string> = {
    confirmed: 'text-blue-700 bg-blue-50',
    delivered: 'text-green-700 bg-green-50',
    cancelled: 'text-red-600 bg-red-50',
    draft: 'text-gray-600 bg-gray-100',
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-8">
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold">{(customer as any).shop_name}</h1>
            <p className="text-sm text-green-100">{(customer as any).owner_name}</p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
            (customer as any).customer_type === 'premium' ? 'bg-yellow-400 text-yellow-900' : 'bg-white/20 text-white'
          }`}>
            {(customer as any).customer_type ?? 'regular'}
          </span>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-green-300" />
            <a href={`tel:${(customer as any).phone}`} className="text-green-100 hover:text-white">{(customer as any).phone}</a>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-300" />
            <span className="text-green-100">{(customer as any).area}{(customer as any).address ? `, ${(customer as any).address}` : ''}</span>
          </div>
          {(customer as any).outstanding_balance > 0 && (
            <div className="flex items-center gap-2 mt-2 bg-red-500/20 rounded-lg px-3 py-1.5">
              <CreditCard className="h-4 w-4 text-red-200" />
              <span className="text-red-100 font-semibold">Outstanding: ₹{Number((customer as any).outstanding_balance).toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4 text-center">
          <div className="bg-white/10 rounded-xl p-2">
            <p className="text-lg font-bold">{orders.length}</p>
            <p className="text-xs text-green-200">Orders</p>
          </div>
          <div className="bg-white/10 rounded-xl p-2">
            <p className="text-lg font-bold">₹{(totalPurchases / 1000).toFixed(0)}k</p>
            <p className="text-xs text-green-200">Purchases</p>
          </div>
          <div className="bg-white/10 rounded-xl p-2">
            <p className="text-lg font-bold">₹{(Number((customer as any).credit_limit ?? 0) / 1000).toFixed(0)}k</p>
            <p className="text-xs text-green-200">Credit Limit</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <a href={`tel:${(customer as any).phone}`}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 bg-white py-3 hover:bg-gray-50">
          <Phone className="h-5 w-5 text-blue-600" />
          <span className="text-xs font-medium text-gray-700">Call</span>
        </a>
        <Link to={`/tele-caller/take-order/${id}`}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 bg-white py-3 hover:bg-gray-50">
          <ShoppingBag className="h-5 w-5 text-green-600" />
          <span className="text-xs font-medium text-gray-700">Take Order</span>
        </Link>
        <button onClick={() => setShowFollowupForm(v => !v)}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 bg-white py-3 hover:bg-gray-50">
          <Bell className="h-5 w-5 text-amber-600" />
          <span className="text-xs font-medium text-gray-700">Follow-up</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="font-semibold text-gray-800">Log Call Outcome</h3>
        <div className="flex flex-wrap gap-2">
          {['Interested - will order', 'Not interested today', 'No answer', 'Will call back', 'Placed order', 'Payment received'].map(outcome => (
            <button key={outcome}
              onClick={() => logCall.mutate(outcome)}
              disabled={logCall.isPending}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:border-green-400 hover:text-green-700 disabled:opacity-50 transition-colors">
              {outcome}
            </button>
          ))}
        </div>
      </div>

      {showFollowupForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-amber-800">Set Follow-up Reminder</h3>
          <input type="date" value={followupDate} onChange={e => setFollowupDate(e.target.value)}
            min={format(new Date(), 'yyyy-MM-dd')}
            className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <textarea value={followupNote} onChange={e => setFollowupNote(e.target.value)} rows={2}
            className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            placeholder="What to discuss..." />
          <div className="flex gap-2">
            <button onClick={() => setShowFollowupForm(false)}
              className="flex-1 rounded-lg border border-amber-300 py-2 text-sm font-medium text-amber-700">Cancel</button>
            <button onClick={() => addFollowup.mutate()} disabled={addFollowup.isPending}
              className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
              {addFollowup.isPending ? 'Setting...' : 'Set Reminder'}
            </button>
          </div>
        </div>
      )}

      {(followups as any[]).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <h3 className="font-semibold text-gray-800">Pending Follow-ups ({(followups as any[]).length})</h3>
          {(followups as any[]).map((f: any) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-amber-800">{format(parseISO(f.follow_up_date), 'd MMM yyyy')}</p>
                {f.notes && <p className="text-xs text-amber-600">{f.notes}</p>}
              </div>
              <Bell className="h-4 w-4 text-amber-500" />
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Order History</h3>
        </div>
        {orders.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">No orders yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(orders as any[]).map((o: any) => (
              <Link key={o.id} to={`/sales/orders/${o.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-800">{o.order_number}</p>
                  <p className="text-xs text-gray-500">{format(parseISO(o.order_date), 'd MMM yyyy')}</p>
                </div>
                <div className="text-right flex items-center gap-2">
                  <div>
                    <p className="text-sm font-bold text-gray-800">₹{Number(o.net_amount).toLocaleString('en-IN')}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLOR[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {o.status}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {(callLogs as any[]).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <h3 className="font-semibold text-gray-800">Call History</h3>
          {(callLogs as any[]).map((log: any) => (
            <div key={log.id} className="flex items-start gap-3 text-sm">
              <Phone className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-gray-700">{log.outcome}</p>
                <p className="text-xs text-gray-400">{format(parseISO(log.called_at), 'd MMM · hh:mm a')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
