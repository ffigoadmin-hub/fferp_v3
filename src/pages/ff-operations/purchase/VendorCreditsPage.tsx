import { useState } from 'react';
import { Plus, Search, RefreshCw, Gift, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:    { label: 'Open',    color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  applied: { label: 'Applied', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  expired: { label: 'Expired', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
};

export default function VendorCreditsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vendor_name: '', bill_reference: '', credit_amount: '', reason: '', expiry_date: '' });
  const [saving, setSaving] = useState(false);

  const { data: credits = [], isLoading, refetch } = useQuery({
    queryKey: ['vendor-credits'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('vendor_credits').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = credits.filter((c: any) => {
    const matchSearch = !search || c.vendor_name?.toLowerCase().includes(search.toLowerCase()) || c.credit_note_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalOpen = credits.filter((c: any) => c.status === 'open').reduce((s: number, c: any) => s + Number(c.credit_amount || 0), 0);

  const handleCreate = async () => {
    if (!form.vendor_name || !form.credit_amount || !form.reason) { toast.error('Vendor, amount and reason required'); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('vendor_credits').insert({
        credit_note_number: `VC-${Date.now()}`,
        vendor_name: form.vendor_name,
        bill_reference: form.bill_reference || null,
        credit_amount: parseFloat(form.credit_amount),
        reason: form.reason,
        expiry_date: form.expiry_date || null,
        status: 'open',
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success('Vendor credit created');
      setShowForm(false);
      setForm({ vendor_name: '', bill_reference: '', credit_amount: '', reason: '', expiry_date: '' });
      refetch();
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Vendor Credits</h1>
          <p className="text-sm text-zinc-400 mt-1">Manage credit notes received from vendors</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-zinc-700 text-zinc-300"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          <Button size="sm" onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />New Vendor Credit</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['all','open','applied','expired'].map(s => {
          const items = s === 'all' ? credits : credits.filter((c: any) => c.status === s);
          const amt = items.reduce((sum: number, c: any) => sum + Number(c.credit_amount || 0), 0);
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

      {totalOpen > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
          <p className="text-emerald-400 text-sm font-medium">Available Credit Balance: <span className="text-lg font-bold">₹{totalOpen.toLocaleString()}</span></p>
        </div>
      )}

      {showForm && (
        <Card className="bg-zinc-900 border-zinc-700">
          <CardHeader><CardTitle className="text-white text-base">New Vendor Credit</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-xs text-zinc-400 mb-1 block">Vendor Name *</label><Input value={form.vendor_name} onChange={e=>setForm(f=>({...f,vendor_name:e.target.value}))} placeholder="Vendor name" className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Bill Reference</label><Input value={form.bill_reference} onChange={e=>setForm(f=>({...f,bill_reference:e.target.value}))} placeholder="BILL-XXXX" className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Credit Amount (₹) *</label><Input type="number" value={form.credit_amount} onChange={e=>setForm(f=>({...f,credit_amount:e.target.value}))} placeholder="0.00" className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Expiry Date</label><Input type="date" value={form.expiry_date} onChange={e=>setForm(f=>({...f,expiry_date:e.target.value}))} className="bg-zinc-800 border-zinc-700 text-white"/></div>
              <div className="md:col-span-2"><label className="text-xs text-zinc-400 mb-1 block">Reason *</label><Input value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} placeholder="Reason for credit" className="bg-zinc-800 border-zinc-700 text-white"/></div>
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
        <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vendor credits..." className="pl-9 bg-zinc-900 border-zinc-700 text-white"/>
      </div>

      <Card className="bg-zinc-900 border-zinc-700">
        <CardContent className="p-0">
          {isLoading ? <div className="flex items-center justify-center h-32 text-zinc-500">Loading...</div>
          : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-zinc-500">
              <Gift className="w-8 h-8 mb-2 opacity-40"/><p className="text-sm">No vendor credits found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-zinc-800">
                  {['Credit Note #','Vendor','Bill Ref','Credit Amount','Reason','Expiry','Status'].map(h=>(
                    <th key={h} className="text-left text-xs text-zinc-500 font-medium px-4 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((c: any) => {
                    const s = STATUS_CONFIG[c.status]||STATUS_CONFIG.open;
                    return (
                      <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-4 py-3 font-mono text-blue-400 text-xs">{c.credit_note_number}</td>
                        <td className="px-4 py-3 text-white">{c.vendor_name}</td>
                        <td className="px-4 py-3 text-zinc-400">{c.bill_reference||'—'}</td>
                        <td className="px-4 py-3 text-emerald-400 font-medium">₹{Number(c.credit_amount).toLocaleString()}</td>
                        <td className="px-4 py-3 text-zinc-400 max-w-[180px] truncate">{c.reason}</td>
                        <td className="px-4 py-3 text-zinc-400">{c.expiry_date||'—'}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full border ${s.color}`}>{s.label}</span></td>
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
