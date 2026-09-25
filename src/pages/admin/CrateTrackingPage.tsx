import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Plus, RefreshCw, Loader2, Package, AlertTriangle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CrateType { id: string; name: string }
interface Hub { id: string; name: string }
interface Movement {
  id: string; crate_type_id: string; movement_type: string; quantity: number; hub_id: string | null;
  other_hub_id: string | null; party_type: string | null; party_name: string | null; reference_no: string | null;
  notes: string | null; created_at: string;
}
interface Balance { hub_id: string; crate_type_id: string; on_hand: number }
interface Outstanding { party_type: string; party_id: string; party_name: string; crate_type_id: string; outstanding: number; last_movement: string }
interface PartyOption { id: string; name: string }

const MOVEMENT_LABELS: Record<string, string> = {
  received_new: 'Received (New)', issued_to_customer: 'Issued to Customer', issued_to_vendor: 'Issued to Vendor',
  returned_from_customer: 'Returned by Customer', returned_from_vendor: 'Returned by Vendor',
  transfer: 'Hub Transfer', damaged: 'Damaged', lost: 'Lost', adjustment: 'Manual Adjustment',
};
const NEEDS_PARTY = ['issued_to_customer', 'issued_to_vendor', 'returned_from_customer', 'returned_from_vendor'];
const NEEDS_OTHER_HUB = ['transfer'];

const emptyForm = { crate_type_id: '', movement_type: 'received_new', quantity: '', hub_id: '', other_hub_id: '', party_id: '', party_name: '', reference_no: '', notes: '' };

export default function CrateTrackingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [partyQuery, setPartyQuery] = useState('');

  const { data: crateTypes = [] } = useQuery({
    queryKey: ['crate-types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('crate_types').select('id, name').eq('is_active', true).order('name');
      if (error) throw error;
      return (data || []) as CrateType[];
    },
  });

  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-active'],
    queryFn: async () => {
      const { data } = await supabase.from('hubs').select('id, name').eq('is_active', true);
      return (data || []) as Hub[];
    },
  });

  const { data: balances = [], refetch: refetchBalances, isFetching: fetchingBalances } = useQuery({
    queryKey: ['crate-hub-balance'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('crate_hub_balance');
      if (error) throw error;
      return (data || []) as Balance[];
    },
  });

  const { data: outstanding = [], refetch: refetchOutstanding } = useQuery({
    queryKey: ['crate-party-outstanding'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('crate_party_outstanding');
      if (error) throw error;
      return (data || []) as Outstanding[];
    },
  });

  const { data: movements = [], refetch: refetchMovements, isLoading: loadingMovements } = useQuery({
    queryKey: ['crate-movements'],
    queryFn: async () => {
      const { data, error } = await supabase.from('crate_movements').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return (data || []) as Movement[];
    },
  });

  const partyOptions = useMemo(() => {
    const map = new Map<string, PartyOption>();
    outstanding.forEach((o) => map.set(o.party_id, { id: o.party_id, name: o.party_name }));
    return Array.from(map.values());
  }, [outstanding]);
  const partyMatches = useMemo(() => {
    if (!partyQuery || form.party_id) return [];
    const q = partyQuery.toLowerCase();
    return partyOptions.filter((p) => p.name?.toLowerCase().includes(q)).slice(0, 8);
  }, [partyOptions, partyQuery, form.party_id]);

  const crateTypeName = (id: string) => crateTypes.find((c) => c.id === id)?.name ?? '—';
  const hubName = (id: string | null) => (id ? hubs.find((h) => h.id === id)?.name ?? '—' : '—');

  const totalOnHand = balances.reduce((s, b) => s + Number(b.on_hand), 0);
  const totalOutstanding = outstanding.reduce((s, o) => s + Number(o.outstanding), 0);
  const totalLostDamaged = movements.filter((m) => m.movement_type === 'damaged' || m.movement_type === 'lost').reduce((s, m) => s + m.quantity, 0);

  const refetchAll = () => { refetchBalances(); refetchOutstanding(); refetchMovements(); };

  const handleCreate = async () => {
    if (!form.crate_type_id || !form.quantity || !form.hub_id) { toast.error('Select crate type, hub, and quantity'); return; }
    if (NEEDS_PARTY.includes(form.movement_type) && !form.party_name) { toast.error('Select or enter a party for this movement'); return; }
    if (NEEDS_OTHER_HUB.includes(form.movement_type) && !form.other_hub_id) { toast.error('Select the destination hub'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('crate_movements').insert({
        crate_type_id: form.crate_type_id,
        movement_type: form.movement_type,
        quantity: parseInt(form.quantity, 10),
        hub_id: form.hub_id,
        other_hub_id: NEEDS_OTHER_HUB.includes(form.movement_type) ? form.other_hub_id : null,
        party_type: NEEDS_PARTY.includes(form.movement_type) ? (form.movement_type.includes('customer') ? 'customer' : 'vendor') : null,
        party_id: NEEDS_PARTY.includes(form.movement_type) ? (form.party_id || null) : null,
        party_name: NEEDS_PARTY.includes(form.movement_type) ? form.party_name : null,
        reference_no: form.reference_no || null,
        notes: form.notes || null,
        created_by: user?.id,
      } as any);
      if (error) throw error;
      toast.success('Movement recorded');
      setShowForm(false);
      setForm(emptyForm);
      setPartyQuery('');
      refetchAll();
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12 pt-2 px-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Crate Tracking</h1>
          <p className="text-[13px] text-slate-500">Who has your crates right now — by hub and by customer/vendor</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refetchAll}><RefreshCw className={`h-4 w-4 mr-2 ${fetchingBalances ? 'animate-spin' : ''}`} />Refresh</Button>
          <Button size="sm" onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4 mr-2" />Record Movement</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500 flex items-center gap-1"><Package className="h-3 w-3" />Total On-Hand</p><p className="text-xl font-bold text-slate-800">{totalOnHand}</p></CardContent></Card>
        <Card className={totalOutstanding > 0 ? 'border-amber-300' : ''}><CardContent className="p-4"><p className="text-xs text-slate-500 flex items-center gap-1"><Users className="h-3 w-3" />Outstanding with Parties</p><p className="text-xl font-bold text-amber-600">{totalOutstanding}</p></CardContent></Card>
        <Card className={totalLostDamaged > 0 ? 'border-red-300' : ''}><CardContent className="p-4"><p className="text-xs text-slate-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Damaged / Lost (recent)</p><p className="text-xl font-bold text-red-600">{totalLostDamaged}</p></CardContent></Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Record Crate Movement</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Crate Type *</label>
                <select value={form.crate_type_id} onChange={e => setForm(f => ({ ...f, crate_type_id: e.target.value }))} className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm">
                  <option value="">Select…</option>
                  {crateTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Movement Type *</label>
                <select value={form.movement_type} onChange={e => setForm(f => ({ ...f, movement_type: e.target.value, party_id: '', party_name: '' }))} className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm">
                  {Object.entries(MOVEMENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500 mb-1 block">Quantity *</label><Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">{NEEDS_OTHER_HUB.includes(form.movement_type) ? 'From Hub *' : 'Hub *'}</label>
                <select value={form.hub_id} onChange={e => setForm(f => ({ ...f, hub_id: e.target.value }))} className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm">
                  <option value="">Select…</option>
                  {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              {NEEDS_OTHER_HUB.includes(form.movement_type) && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">To Hub *</label>
                  <select value={form.other_hub_id} onChange={e => setForm(f => ({ ...f, other_hub_id: e.target.value }))} className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm">
                    <option value="">Select…</option>
                    {hubs.filter(h => h.id !== form.hub_id).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
              )}
              {NEEDS_PARTY.includes(form.movement_type) && (
                <div className="relative">
                  <label className="text-xs text-slate-500 mb-1 block">{form.movement_type.includes('customer') ? 'Customer' : 'Vendor'} *</label>
                  <Input
                    value={form.party_id ? form.party_name : partyQuery}
                    onChange={e => { setPartyQuery(e.target.value); setForm(f => ({ ...f, party_id: '', party_name: e.target.value })); }}
                    placeholder="Type name…"
                  />
                  {partyMatches.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {partyMatches.map(p => (
                        <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                          onClick={() => { setForm(f => ({ ...f, party_id: p.id, party_name: p.name })); setPartyQuery(''); }}>
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div><label className="text-xs text-slate-500 mb-1 block">Reference</label><Input value={form.reference_no} onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))} placeholder="Order/PO #, optional" /></div>
              <div className="md:col-span-2"><label className="text-xs text-slate-500 mb-1 block">Notes</label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : 'Record'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">On-Hand by Hub</CardTitle></CardHeader>
          <CardContent className="p-0">
            {balances.length === 0 ? <p className="p-5 text-sm text-slate-400">No crates recorded yet</p> : (
              <div className="divide-y divide-slate-50">
                {balances.map((b, i) => (
                  <div key={i} className="px-5 py-2.5 flex items-center justify-between text-sm">
                    <span className="text-slate-600">{hubName(b.hub_id)} <span className="text-xs text-slate-400">· {crateTypeName(b.crate_type_id)}</span></span>
                    <span className="font-semibold text-slate-800">{b.on_hand}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Outstanding by Party</CardTitle></CardHeader>
          <CardContent className="p-0">
            {outstanding.length === 0 ? <p className="p-5 text-sm text-slate-400">Nothing outstanding</p> : (
              <div className="divide-y divide-slate-50">
                {outstanding.sort((a, b) => b.outstanding - a.outstanding).map((o, i) => (
                  <div key={i} className="px-5 py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <p className="text-slate-700">{o.party_name}</p>
                      <p className="text-[11px] text-slate-400 capitalize">{o.party_type} · last movement {format(new Date(o.last_movement), 'd MMM yy')}</p>
                    </div>
                    <span className="font-semibold text-amber-600">{o.outstanding}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Recent Movements</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loadingMovements ? (
            <div className="p-8 text-center text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading…</div>
          ) : movements.length === 0 ? (
            <p className="p-5 text-sm text-slate-400">No movements recorded yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50">
                  {['Date', 'Type', 'Qty', 'Hub', 'Party', 'Reference'].map(h => <th key={h} className="text-left text-xs text-slate-500 font-medium px-4 py-2.5">{h}</th>)}
                </tr></thead>
                <tbody>
                  {movements.map(m => (
                    <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-500">{format(new Date(m.created_at), 'd MMM yy')}</td>
                      <td className="px-4 py-2 text-slate-700">{MOVEMENT_LABELS[m.movement_type] || m.movement_type}</td>
                      <td className="px-4 py-2 font-medium text-slate-800">{m.quantity}</td>
                      <td className="px-4 py-2 text-slate-500">{hubName(m.hub_id)}{m.other_hub_id ? ` → ${hubName(m.other_hub_id)}` : ''}</td>
                      <td className="px-4 py-2 text-slate-500">{m.party_name || '—'}</td>
                      <td className="px-4 py-2 text-slate-400 text-xs">{m.reference_no || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
