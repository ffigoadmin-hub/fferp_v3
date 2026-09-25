import { useState, useMemo } from 'react';
import { Plus, Search, DollarSign, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  verified:  { label: 'Verified',  color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  bounced:   { label: 'Bounced',   color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};
interface CustomerOption { id: string; name: string; hub_id: string | null }

const emptyForm = { customer_id: '', customer_name: '', hub_id: '', invoice_reference: '', amount: '', payment_mode: 'bank_transfer', utr_number: '', received_date: new Date().toISOString().split('T')[0] };

export default function PaymentsReceivedPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [customerQuery, setCustomerQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: payments = [], isLoading, refetch } = useQuery({
    queryKey: ['payments-received'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('payments_received').select('*').order('received_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-for-payment-received'],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('id, name, hub_id').order('name');
      if (error) throw error;
      return (data || []) as CustomerOption[];
    },
    enabled: showForm,
  });

  const customerMatches = useMemo(() => {
    if (!customerQuery || form.customer_id) return [];
    const q = customerQuery.toLowerCase();
    return customers.filter(c => c.name?.toLowerCase().includes(q)).slice(0, 8);
  }, [customers, customerQuery, form.customer_id]);

  const filtered = payments.filter((p: any) => {
    const matchSearch = !search || p.customer_name?.toLowerCase().includes(search.toLowerCase()) || p.utr_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalAmount = filtered.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  const handleCreate = async () => {
    if (!form.customer_id || !form.amount) { toast.error('Select a customer and enter an amount'); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('payments_received').insert({
        customer_id: form.customer_id,
        customer_name: form.customer_name,
        hub_id: form.hub_id || null,
        invoice_reference: form.invoice_reference || null,
        amount: parseFloat(form.amount),
        payment_mode: form.payment_mode,
        utr_number: form.utr_number || null,
        received_date: form.received_date,
        status: 'pending',
        recorded_by: user?.id,
      });
      if (error) throw error;
      toast.success('Payment recorded — verify it once it clears the bank statement');
      setShowForm(false);
      setForm(emptyForm);
      setCustomerQuery('');
      refetch();
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const setStatus = async (id: string, status: 'verified' | 'bounced') => {
    const { error } = await (supabase as any).from('payments_received').update({ status }).eq('id', id);
    if (error) toast.error('Update failed');
    else { toast.success(status === 'verified' ? 'Marked verified — posted to the books' : 'Marked bounced'); refetch(); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payments Received</h1>
          <p className="text-sm text-zinc-400 mt-1">Record and verify customer payments — verified receipts post to the books automatically</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-zinc-700 text-zinc-300"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          <Button size="sm" onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />Record Payment</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['all','pending','verified','bounced'].map(s => {
          const items = s === 'all' ? payments : payments.filter((p: any) => p.status === s);
          const amt = items.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
          return (
            <Card key={s} className={`bg-zinc-900 border-zinc-700 cursor-pointer ${statusFilter === s ? 'ring-1 ring-blue-500' : ''}`} onClick={() => setStatusFilter(s)}>
              <CardContent className="p-4">
                <p className="text-xs text-zinc-400 capitalize">{s === 'all' ? 'Total' : s}</p>
                <p className="text-xl font-bold text-white mt-1">{items.length}</p>
                <p className="text-xs text-zinc-500">₹{amt.toLocaleString()}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showForm && (
        <Card className="bg-zinc-900 border-zinc-700">
          <CardHeader><CardTitle className="text-white text-base">Record Payment Received</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="text-xs text-zinc-400 mb-1 block">Customer *</label>
                <Input
                  value={form.customer_id ? form.customer_name : customerQuery}
                  onChange={e => { setCustomerQuery(e.target.value); setForm(f => ({ ...f, customer_id: '', customer_name: '', hub_id: '' })); }}
                  placeholder="Search customer by name..."
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
                {customerMatches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {customerMatches.map(c => (
                      <button key={c.id} type="button"
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-zinc-700"
                        onClick={() => { setForm(f => ({ ...f, customer_id: c.id, customer_name: c.name, hub_id: c.hub_id || '' })); setCustomerQuery(''); }}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Invoice Reference</label><Input value={form.invoice_reference} onChange={e=>setForm(f=>({...f,invoice_reference:e.target.value}))} placeholder="INV-XXXX" className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Amount (₹) *</label><Input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Payment Mode</label>
                <select value={form.payment_mode} onChange={e=>setForm(f=>({...f,payment_mode:e.target.value}))} className="w-full h-9 rounded-md border border-zinc-700 bg-zinc-800 text-white px-3 text-sm">
                  {['bank_transfer','upi','cheque','cash','neft','rtgs'].map(m=><option key={m} value={m}>{m.replace('_',' ').toUpperCase()}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-zinc-400 mb-1 block">UTR / Reference No.</label><Input value={form.utr_number} onChange={e=>setForm(f=>({...f,utr_number:e.target.value}))} placeholder="UTR number" className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Received Date</label><Input type="date" value={form.received_date} onChange={e=>setForm(f=>({...f,received_date:e.target.value}))} className="bg-zinc-800 border-zinc-700 text-white"/></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={()=>setShowForm(false)} className="border-zinc-700 text-zinc-300">Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving?'Saving...':'Record'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"/>
        <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search payments..." className="pl-9 bg-zinc-900 border-zinc-700 text-white"/>
      </div>

      <Card className="bg-zinc-900 border-zinc-700">
        <CardContent className="p-0">
          {isLoading ? <div className="flex items-center justify-center h-32 text-zinc-500">Loading...</div>
          : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-zinc-500">
              <DollarSign className="w-8 h-8 mb-2 opacity-40"/><p className="text-sm">No payments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-zinc-800">
                  {['Customer','Invoice Ref','Amount','Mode','UTR / Ref','Status','Date','Actions'].map(h=>(
                    <th key={h} className="text-left text-xs text-zinc-500 font-medium px-4 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((p: any) => {
                    const s = STATUS_CONFIG[p.status]||STATUS_CONFIG.pending;
                    return (
                      <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-4 py-3 text-white">{p.customer_name}</td>
                        <td className="px-4 py-3 text-zinc-400">{p.invoice_reference||'—'}</td>
                        <td className="px-4 py-3 text-emerald-400 font-medium">₹{Number(p.amount).toLocaleString()}</td>
                        <td className="px-4 py-3 text-zinc-400 uppercase text-xs">{p.payment_mode}</td>
                        <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{p.utr_number||'—'}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full border ${s.color}`}>{s.label}</span></td>
                        <td className="px-4 py-3 text-zinc-400">{p.received_date||p.created_at?.split('T')[0]}</td>
                        <td className="px-4 py-3">
                          {p.status === 'pending' && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="text-xs text-emerald-400 hover:text-emerald-300 h-7 px-2" onClick={()=>setStatus(p.id,'verified')}>Verify</Button>
                              <Button variant="ghost" size="sm" className="text-xs text-red-400 hover:text-red-300 h-7 px-2" onClick={()=>setStatus(p.id,'bounced')}>Bounced</Button>
                            </div>
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
      {filtered.length > 0 && <div className="text-sm text-zinc-400 text-right">Total: <span className="text-white font-semibold">₹{totalAmount.toLocaleString()}</span></div>}
    </div>
  );
}
