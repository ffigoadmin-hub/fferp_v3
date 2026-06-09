import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Repeat, Search, Plus, Calendar, Settings, Play, Pause, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logEvent } from '@/lib/audit';

export default function SubscriptionManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['b2b-subscriptions', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('b2b_subscriptions')
        .select(`
          *,
          customer:customers(shop_name, phone, area),
          hub:hubs(name),
          items:b2b_subscription_items(product:products(name), quantity_kg, unit_price)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data } = await query;
      return data ?? [];
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string, newStatus: string }) => {
      const { error } = await supabase
        .from('b2b_subscriptions')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;
      return { id, newStatus };
    },
    onSuccess: (data) => {
      toast.success(`Subscription marked as ${data.newStatus}`);
      logEvent({
        entity_type: 'sales_order',
        entity_id: data.id,
        action: 'status_changed',
        description: `B2B Subscription status changed to ${data.newStatus}`,
        payload: { status: data.newStatus }
      });
      qc.invalidateQueries({ queryKey: ['b2b-subscriptions'] });
    },
    onError: () => toast.error('Failed to update subscription'),
  });

  const filteredSubs = (subscriptions as any[]).filter(s =>
    search === '' ||
    s.customer?.shop_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.customer?.area?.toLowerCase().includes(search.toLowerCase())
  );

  const processOrdersNow = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-daily-subscriptions', {
        body: { manual_trigger: true, date: format(new Date(), 'yyyy-MM-dd') }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Automation triggered: Orders generated for today.');
      logEvent({
        entity_type: 'sales_order',
        entity_id: 'system',
        action: 'created',
        description: 'Manually triggered daily subscription order generation',
      });
      qc.invalidateQueries({ queryKey: ['b2b-subscriptions'] });
    },
    onError: () => {
      toast.info('Automation function not found. Please follow the manual setup guide for Edge Functions.');
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">B2B Subscriptions</h1>
          <p className="text-sm text-gray-500">Manage recurring orders for high-volume customers</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => processOrdersNow.mutate()}
            disabled={processOrdersNow.isPending}
            className="flex items-center gap-2 rounded-xl border border-green-600 px-4 py-2 text-sm font-semibold text-green-600 hover:bg-green-50 transition-colors"
          >
            {processOrdersNow.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Generate Orders for Today
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors">
            <Plus className="h-4 w-4" /> New Subscription
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="bg-green-50 p-2.5 rounded-lg">
            <Repeat className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{(subscriptions as any[]).filter(s => s.status === 'active').length}</p>
            <p className="text-xs text-gray-500">Active Subscriptions</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="bg-amber-50 p-2.5 rounded-lg">
            <Pause className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{(subscriptions as any[]).filter(s => s.status === 'paused').length}</p>
            <p className="text-xs text-gray-500">Paused</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="bg-blue-50 p-2.5 rounded-lg">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">Auto</p>
            <p className="text-xs text-gray-500">Daily Generation (2 AM)</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by customer or area..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-green-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading subscriptions...</div>
        ) : filteredSubs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Repeat className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            No subscriptions found.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredSubs.map(sub => (
              <div key={sub.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{sub.customer?.shop_name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{sub.customer?.area} · {sub.hub?.name?.toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      sub.status === 'active' ? 'bg-green-100 text-green-700' :
                      sub.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {sub.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 mb-4">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Repeat className="h-3.5 w-3.5" /> Frequency: <span className="font-medium capitalize">{sub.frequency}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Calendar className="h-3.5 w-3.5" /> Next Order: <span className="font-medium">{format(new Date(sub.next_order_date || new Date()), 'dd MMM yyyy')}</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-700 mb-2 border-b border-gray-200 pb-1">Subscribed Items</p>
                  <div className="space-y-1">
                    {sub.items?.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-600">{item.product?.name}</span>
                        <span className="font-medium">{item.quantity_kg} kg <span className="text-xs text-gray-400 font-normal">@ ₹{item.unit_price}/kg</span></span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex gap-2 justify-end">
                  {sub.status !== 'active' && (
                    <button onClick={() => toggleStatus.mutate({ id: sub.id, newStatus: 'active' })}
                      className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100">
                      <Play className="h-3 w-3" /> Resume
                    </button>
                  )}
                  {sub.status === 'active' && (
                    <button onClick={() => toggleStatus.mutate({ id: sub.id, newStatus: 'paused' })}
                      className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100">
                      <Pause className="h-3 w-3" /> Pause
                    </button>
                  )}
                  <button className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100">
                    <Settings className="h-3 w-3" /> Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
