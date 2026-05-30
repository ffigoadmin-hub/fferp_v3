import { useState } from 'react';
import { Plus, Search, Truck, CheckCircle2, Clock, Package, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
  dispatched:{ label: 'Dispatched',color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  delivered: { label: 'Delivered', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

export default function DeliveryChallansPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customer_name: '', order_reference: '', delivery_address: '', items: '', dispatch_date: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);

  const { data: challans = [], isLoading, refetch } = useQuery({
    queryKey: ['delivery-challans'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('delivery_challans').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = challans.filter((c: any) => {
    const matchSearch = !search || c.customer_name?.toLowerCase().includes(search.toLowerCase()) || c.challan_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = async () => {
    if (!form.customer_name || !form.delivery_address) { toast.error('Customer and delivery address required'); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('delivery_challans').insert({
        challan_number: `DC-${Date.now()}`,
        customer_name: form.customer_name,
        order_reference: form.order_reference || null,
        delivery_address: form.delivery_address,
        items_description: form.items || null,
        status: 'dispatched',
        dispatch_date: form.dispatch_date,
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success('Delivery challan created');
      setShowForm(false);
      setForm({ customer_name: '', order_reference: '', delivery_address: '', items: '', dispatch_date: new Date().toISOString().split('T')[0] });
      refetch();
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Delivery Challans</h1>
          <p className="text-sm text-zinc-400 mt-1">Track goods dispatched to customers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-zinc-700 text-zinc-300"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          <Button size="sm" onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />New Challan</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['all','dispatched','delivered','cancelled'].map(s => {
          const items = s === 'all' ? challans : challans.filter((c: any) => c.status === s);
          return (
            <Card key={s} className={`bg-zinc-900 border-zinc-700 cursor-pointer ${statusFilter === s ? 'ring-1 ring-blue-500' : ''}`} onClick={() => setStatusFilter(s)}>
              <CardContent className="p-4">
                <p className="text-xs text-zinc-400 capitalize">{s === 'all' ? 'Total' : s}</p>
                <p className="text-xl font-bold text-white mt-1">{items.length}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showForm && (
        <Card className="bg-zinc-900 border-zinc-700">
          <CardHeader><CardTitle className="text-white text-base">New Delivery Challan</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-xs text-zinc-400 mb-1 block">Customer Name *</label><Input value={form.customer_name} onChange={e=>setForm(f=>({...f,customer_name:e.target.value}))} placeholder="Customer name" className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Order Reference</label><Input value={form.order_reference} onChange={e=>setForm(f=>({...f,order_reference:e.target.value}))} placeholder="SO-XXXX" className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Dispatch Date</label><Input type="date" value={form.dispatch_date} onChange={e=>setForm(f=>({...f,dispatch_date:e.target.value}))} className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Items Description</label><Input value={form.items} onChange={e=>setForm(f=>({...f,items:e.target.value}))} placeholder="Brief item description" className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div className="md:col-span-2"><label className="text-xs text-zinc-400 mb-1 block">Delivery Address *</label><Input value={form.delivery_address} onChange={e=>setForm(f=>({...f,delivery_address:e.target.value}))} placeholder="Full delivery address" className="bg-zinc-800 border-zinc-700 text-white"/></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={()=>setShowForm(false)} className="border-zinc-700 text-zinc-300">Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving?'Creating...':'Create'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"/>
        <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search challans..." className="pl-9 bg-zinc-900 border-zinc-700 text-white"/>
      </div>

      <Card className="bg-zinc-900 border-zinc-700">
        <CardContent className="p-0">
          {isLoading ? <div className="flex items-center justify-center h-32 text-zinc-500">Loading...</div>
          : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-zinc-500">
              <Truck className="w-8 h-8 mb-2 opacity-40"/><p className="text-sm">No delivery challans found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-zinc-800">
                  {['Challan #','Customer','Order Ref','Address','Status','Date'].map(h=>(
                    <th key={h} className="text-left text-xs text-zinc-500 font-medium px-4 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((c: any) => {
                    const s = STATUS_CONFIG[c.status]||STATUS_CONFIG.draft;
                    return (
                      <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-4 py-3 font-mono text-blue-400 text-xs">{c.challan_number}</td>
                        <td className="px-4 py-3 text-white">{c.customer_name}</td>
                        <td className="px-4 py-3 text-zinc-400">{c.order_reference||'—'}</td>
                        <td className="px-4 py-3 text-zinc-400 max-w-[200px] truncate">{c.delivery_address}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full border ${s.color}`}>{s.label}</span></td>
                        <td className="px-4 py-3 text-zinc-400">{c.dispatch_date||c.created_at?.split('T')[0]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
