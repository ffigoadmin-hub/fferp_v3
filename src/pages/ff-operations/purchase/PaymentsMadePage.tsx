import { useState } from 'react';
import { Plus, Search, RefreshCw, CreditCard, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Pending',  color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  paid:     { label: 'Paid',     color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  failed:   { label: 'Failed',   color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

export default function PaymentsMadePage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vendor_name: '', bill_reference: '', amount: '', payment_mode: 'bank_transfer', utr_number: '', payment_date: new Date().toISOString().split('T')[0], notes: '' });
  const [saving, setSaving] = useState(false);

  const { data: payments = [], isLoading, refetch } = useQuery({
    queryKey: ['payments-made'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('payments_made').select('*').order('payment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = payments.filter((p: any) => {
    const matchSearch = !search || p.vendor_name?.toLowerCase().includes(search.toLowerCase()) || p.utr_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalAmount = filtered.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  const handleCreate = async () => {
    if (!form.vendor_name || !form.amount) { toast.error('Vendor and amount required'); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('payments_made').insert({
        vendor_name: form.vendor_name,
        bill_reference: form.bill_reference || null,
        amount: parseFloat(form.amount),
        payment_mode: form.payment_mode,
        utr_number: form.utr_number || null,
        payment_date: form.payment_date,
        notes: form.notes || null,
        status: 'paid',
        recorded_by: user?.id,
      });
      if (error) throw error;
      toast.success('Payment recorded');
      setShowForm(false);
      setForm({ vendor_name: '', bill_reference: '', amount: '', payment_mode: 'bank_transfer', utr_number: '', payment_date: new Date().toISOString().split('T')[0], notes: '' });
      refetch();
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payments Made</h1>
          <p className="text-sm text-zinc-400 mt-1">Track all outgoing payments to vendors</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-zinc-700 text-zinc-300"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          <Button size="sm" onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />Record Payment</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {['all','paid','pending'].map(s => {
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
          <CardHeader><CardTitle className="text-white text-base">Record Payment Made</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-xs text-zinc-400 mb-1 block">Vendor Name *</label><Input value={form.vendor_name} onChange={e=>setForm(f=>({...f,vendor_name:e.target.value}))} placeholder="Vendor name" className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Bill Reference</label><Input value={form.bill_reference} onChange={e=>setForm(f=>({...f,bill_reference:e.target.value}))} placeholder="BILL-XXXX" className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Amount (₹) *</label><Input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Payment Mode</label>
                <select value={form.payment_mode} onChange={e=>setForm(f=>({...f,payment_mode:e.target.value}))} className="w-full h-9 rounded-md border border-zinc-700 bg-zinc-800 text-white px-3 text-sm">
                  {['bank_transfer','upi','cheque','cash','neft','rtgs'].map(m=><option key={m} value={m}>{m.replace(/_/g,' ').toUpperCase()}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-zinc-400 mb-1 block">UTR / Ref No.</label><Input value={form.utr_number} onChange={e=>setForm(f=>({...f,utr_number:e.target.value}))} placeholder="UTR number" className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Payment Date</label><Input type="date" value={form.payment_date} onChange={e=>setForm(f=>({...f,payment_date:e.target.value}))} className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div className="md:col-span-2"><label className="text-xs text-zinc-400 mb-1 block">Notes</label><Input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Optional notes" className="bg-zinc-800 border-zinc-700 text-white"/></div>
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
              <CreditCard className="w-8 h-8 mb-2 opacity-40"/><p className="text-sm">No payments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-zinc-800">
                  {['Vendor','Bill Ref','Amount','Mode','UTR / Ref','Status','Date'].map(h=>(
                    <th key={h} className="text-left text-xs text-zinc-500 font-medium px-4 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((p: any) => {
                    const s = STATUS_CONFIG[p.status]||STATUS_CONFIG.pending;
                    return (
                      <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-4 py-3 text-white">{p.vendor_name}</td>
                        <td className="px-4 py-3 text-zinc-400">{p.bill_reference||'—'}</td>
                        <td className="px-4 py-3 text-red-400 font-medium">₹{Number(p.amount).toLocaleString()}</td>
                        <td className="px-4 py-3 text-zinc-400 uppercase text-xs">{p.payment_mode}</td>
                        <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{p.utr_number||'—'}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full border ${s.color}`}>{s.label}</span></td>
                        <td className="px-4 py-3 text-zinc-400">{p.payment_date||p.created_at?.split('T')[0]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {filtered.length > 0 && <div className="text-sm text-zinc-400 text-right">Total Paid: <span className="text-red-400 font-semibold">₹{totalAmount.toLocaleString()}</span></div>}
    </div>
  );
}
