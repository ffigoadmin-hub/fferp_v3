import { useState } from 'react';
import { Plus, Search, RefreshCw, RepeatIcon, Calendar, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

const FREQ_LABELS: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:   { label: 'Active',   color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  paused:   { label: 'Paused',   color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  cancelled:{ label: 'Cancelled',color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

export default function RecurringInvoicesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customer_name: '', amount: '', frequency: 'monthly', start_date: new Date().toISOString().split('T')[0], description: '' });
  const [saving, setSaving] = useState(false);

  const { data: recurring = [], isLoading, refetch } = useQuery({
    queryKey: ['recurring-invoices'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('recurring_invoices').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = recurring.filter((r: any) => {
    const matchSearch = !search || r.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = async () => {
    if (!form.customer_name || !form.amount) { toast.error('Customer and amount required'); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('recurring_invoices').insert({
        customer_name: form.customer_name,
        amount: parseFloat(form.amount),
        frequency: form.frequency,
        start_date: form.start_date,
        description: form.description || null,
        status: 'active',
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success('Recurring invoice created');
      setShowForm(false);
      setForm({ customer_name: '', amount: '', frequency: 'monthly', start_date: new Date().toISOString().split('T')[0], description: '' });
      refetch();
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (id: string, current: string) => {
    const next = current === 'active' ? 'paused' : 'active';
    const { error } = await (supabase as any).from('recurring_invoices').update({ status: next }).eq('id', id);
    if (error) { toast.error('Update failed'); } else { toast.success(`Invoice ${next}`); refetch(); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Recurring Invoices</h1>
          <p className="text-sm text-zinc-400 mt-1">Automate repeating billing cycles</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-zinc-700 text-zinc-300"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          <Button size="sm" onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />New Recurring</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {['all','active','paused'].map(s => {
          const items = s === 'all' ? recurring : recurring.filter((r: any) => r.status === s);
          const amt = items.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
          return (
            <Card key={s} className={`bg-zinc-900 border-zinc-700 cursor-pointer ${statusFilter === s ? 'ring-1 ring-blue-500' : ''}`} onClick={() => setStatusFilter(s)}>
              <CardContent className="p-4">
                <p className="text-xs text-zinc-400 capitalize">{s === 'all' ? 'Total' : s}</p>
                <p className="text-xl font-bold text-white mt-1">{items.length}</p>
                <p className="text-xs text-zinc-500">₹{amt.toLocaleString()} / cycle</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showForm && (
        <Card className="bg-zinc-900 border-zinc-700">
          <CardHeader><CardTitle className="text-white text-base">New Recurring Invoice</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-xs text-zinc-400 mb-1 block">Customer Name *</label><Input value={form.customer_name} onChange={e=>setForm(f=>({...f,customer_name:e.target.value}))} placeholder="Customer name" className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Amount (₹) *</label><Input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Frequency</label>
                <select value={form.frequency} onChange={e=>setForm(f=>({...f,frequency:e.target.value}))} className="w-full h-9 rounded-md border border-zinc-700 bg-zinc-800 text-white px-3 text-sm">
                  {Object.entries(FREQ_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Start Date</label><Input type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div className="md:col-span-2"><label className="text-xs text-zinc-400 mb-1 block">Description</label><Input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Invoice description" className="bg-zinc-800 border-zinc-700 text-white"/></div>
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
        <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search recurring invoices..." className="pl-9 bg-zinc-900 border-zinc-700 text-white"/>
      </div>

      <Card className="bg-zinc-900 border-zinc-700">
        <CardContent className="p-0">
          {isLoading ? <div className="flex items-center justify-center h-32 text-zinc-500">Loading...</div>
          : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-zinc-500">
              <RepeatIcon className="w-8 h-8 mb-2 opacity-40"/><p className="text-sm">No recurring invoices found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-zinc-800">
                  {['Customer','Amount','Frequency','Start Date','Description','Status','Actions'].map(h=>(
                    <th key={h} className="text-left text-xs text-zinc-500 font-medium px-4 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((r: any) => {
                    const s = STATUS_CONFIG[r.status]||STATUS_CONFIG.active;
                    return (
                      <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-4 py-3 text-white">{r.customer_name}</td>
                        <td className="px-4 py-3 text-emerald-400 font-medium">₹{Number(r.amount).toLocaleString()}</td>
                        <td className="px-4 py-3 text-zinc-300 capitalize">{FREQ_LABELS[r.frequency]||r.frequency}</td>
                        <td className="px-4 py-3 text-zinc-400">{r.start_date}</td>
                        <td className="px-4 py-3 text-zinc-400 max-w-[180px] truncate">{r.description||'—'}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full border ${s.color}`}>{s.label}</span></td>
                        <td className="px-4 py-3">
                          {r.status !== 'cancelled' && (
                            <Button variant="ghost" size="sm" className="text-xs text-zinc-400 hover:text-white h-7 px-2" onClick={()=>toggleStatus(r.id,r.status)}>
                              {r.status === 'active' ? 'Pause' : 'Resume'}
                            </Button>
                          )}
                        </td>
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
