import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Plus, RefreshCw, Loader2, ClipboardCheck, CheckCircle2, AlertTriangle, XCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Cycle { id: string; name: string; due_date: string | null; status: 'open' | 'closed'; started_at: string; closed_at: string | null }
interface Item {
  id: string; cycle_id: string; asset_id: string; expected_hub_id: string | null; expected_assigned_to: string | null;
  status: 'pending' | 'verified' | 'missing' | 'damaged'; found_hub_id: string | null; notes: string | null; verified_at: string | null;
}
interface Asset { id: string; asset_name: string }
interface Hub { id: string; name: string }
interface Staff { id: string; name: string }

const APPROVER_ROLES = ['admin', 'ceo', 'gm', 'ff_operations_manager'];

export default function AssetVerificationPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [cycleName, setCycleName] = useState(`Verification — ${format(new Date(), 'MMMM yyyy')}`);
  const [dueDate, setDueDate] = useState('');
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  const isApprover = APPROVER_ROLES.includes((user?.role || '').toLowerCase());

  const { data: cycles = [], refetch: refetchCycles, isFetching } = useQuery({
    queryKey: ['asset-verification-cycles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('asset_verification_cycles').select('*').order('started_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Cycle[];
    },
  });

  const currentCycle = cycles.find(c => c.id === activeCycleId) ?? cycles.find(c => c.status === 'open') ?? cycles[0] ?? null;
  const cycleId = activeCycleId ?? currentCycle?.id ?? null;

  const { data: items = [], refetch: refetchItems, isLoading } = useQuery({
    queryKey: ['asset-verification-items', cycleId],
    enabled: !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase.from('asset_verification_items').select('*').eq('cycle_id', cycleId as string);
      if (error) throw error;
      return (data || []) as Item[];
    },
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['fixed-assets-lite'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fixed_assets').select('id, asset_name');
      if (error) throw error;
      return (data || []) as Asset[];
    },
  });
  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-active'],
    queryFn: async () => { const { data } = await supabase.from('hubs').select('id, name').eq('is_active', true); return (data || []) as Hub[]; },
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['staff-for-asset-assignment'],
    queryFn: async () => { const { data } = await supabase.from('profiles').select('id, name').not('name', 'is', null); return (data || []) as Staff[]; },
  });

  const assetName = (id: string) => assets.find(a => a.id === id)?.asset_name ?? '—';
  const hubName = (id: string | null) => (id ? hubs.find(h => h.id === id)?.name ?? '—' : '—');
  const staffName = (id: string | null) => (id ? staff.find(s => s.id === id)?.name ?? '—' : 'Unassigned');

  const progress = useMemo(() => {
    const total = items.length;
    const done = items.filter(i => i.status !== 'pending').length;
    const missing = items.filter(i => i.status === 'missing').length;
    const damaged = items.filter(i => i.status === 'damaged').length;
    return { total, done, missing, damaged, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [items]);

  const startCycle = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('asset_verification_start_cycle', { p_name: cycleName, p_due_date: dueDate || null } as any);
      if (error) throw error;
      return data as string;
    },
    onSuccess: (newId) => {
      toast.success('Verification cycle started — assets snapshotted');
      setShowNewCycle(false);
      setActiveCycleId(newId);
      refetchCycles();
    },
    onError: (e: any) => toast.error(e.message || 'Failed to start cycle'),
  });

  const closeCycle = useMutation({
    mutationFn: async () => {
      if (!cycleId) return;
      const { data, error } = await supabase.rpc('asset_verification_close_cycle', { p_cycle_id: cycleId } as any);
      if (error) throw error;
      return data as any;
    },
    onSuccess: (result) => {
      toast.success(result?.closed_with_pending > 0 ? `Cycle closed — ${result.closed_with_pending} asset(s) still unverified` : 'Cycle closed — everything verified');
      refetchCycles();
    },
    onError: (e: any) => toast.error(e.message || 'Failed to close cycle'),
  });

  const markItem = useMutation({
    mutationFn: async ({ id, status, foundHubId }: { id: string; status: Item['status']; foundHubId?: string }) => {
      const { error } = await supabase.from('asset_verification_items').update({
        status, notes: itemNotes[id] || null, found_hub_id: foundHubId ?? null,
        verified_by: user?.id, verified_at: new Date().toISOString(),
      } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => refetchItems(),
    onError: (e: any) => toast.error(e.message || 'Failed to update'),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12 pt-2 px-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Physical Verification</h1>
          <p className="text-[13px] text-slate-500">Spot-check that assets on the register still exist where it says they do</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetchCycles(); refetchItems(); }}><RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />Refresh</Button>
          {isApprover && <Button size="sm" onClick={() => setShowNewCycle(true)} className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4 mr-2" />New Cycle</Button>}
        </div>
      </div>

      {showNewCycle && (
        <Card>
          <CardHeader><CardTitle className="text-base">Start Verification Cycle</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-xs text-slate-500 mb-1 block">Cycle Name *</label><Input value={cycleName} onChange={e => setCycleName(e.target.value)} /></div>
              <div><label className="text-xs text-slate-500 mb-1 block">Due Date</label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
            </div>
            <p className="text-xs text-slate-400">This snapshots every active asset's current hub/custody as the "expected" location for this round.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowNewCycle(false)}>Cancel</Button>
              <Button size="sm" onClick={() => startCycle.mutate()} disabled={startCycle.isPending || !cycleName} className="bg-blue-600 hover:bg-blue-700">{startCycle.isPending ? 'Starting…' : 'Start Cycle'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {cycles.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {cycles.map(c => (
            <button key={c.id} onClick={() => setActiveCycleId(c.id)}
              className={`text-xs px-3 py-1.5 rounded-full border ${cycleId === c.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {c.name} {c.status === 'closed' && <Lock className="inline h-3 w-3 ml-1" />}
            </button>
          ))}
        </div>
      )}

      {!cycleId ? (
        <Card><CardContent className="p-10 text-center text-sm text-slate-400"><ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-40" /> No verification cycles yet{isApprover ? ' — start one above' : ''}</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Total Assets</p><p className="text-xl font-bold text-slate-800">{progress.total}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Verified</p><p className="text-xl font-bold text-emerald-600">{progress.done - progress.missing - progress.damaged}</p></CardContent></Card>
            <Card className={progress.missing > 0 ? 'border-red-300' : ''}><CardContent className="p-4"><p className="text-xs text-slate-500">Missing</p><p className="text-xl font-bold text-red-600">{progress.missing}</p></CardContent></Card>
            <Card className={progress.damaged > 0 ? 'border-amber-300' : ''}><CardContent className="p-4"><p className="text-xs text-slate-500">Damaged</p><p className="text-xl font-bold text-amber-600">{progress.damaged}</p></CardContent></Card>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress.pct}%` }} />
          </div>

          {currentCycle?.status === 'open' && isApprover && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => closeCycle.mutate()} disabled={closeCycle.isPending}>
                {closeCycle.isPending ? 'Closing…' : 'Close This Cycle'}
              </Button>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-10 text-center text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading…</div>
              ) : items.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-400">No assets were active when this cycle started</div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {items.map(item => (
                    <div key={item.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{assetName(item.asset_id)}</p>
                        <p className="text-xs text-slate-500">Expected: {hubName(item.expected_hub_id)} · {staffName(item.expected_assigned_to)}</p>
                        {item.notes && <p className="text-xs text-slate-400">"{item.notes}"</p>}
                      </div>
                      {currentCycle?.status === 'closed' || item.status !== 'pending' ? (
                        <span className={`text-xs px-2.5 py-1 rounded-full border capitalize flex items-center gap-1 ${
                          item.status === 'verified' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                          item.status === 'missing' ? 'bg-red-50 text-red-600 border-red-200' :
                          item.status === 'damaged' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                          'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {item.status === 'verified' && <CheckCircle2 className="h-3 w-3" />}
                          {item.status === 'missing' && <XCircle className="h-3 w-3" />}
                          {item.status === 'damaged' && <AlertTriangle className="h-3 w-3" />}
                          {item.status}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Input placeholder="Note (optional)" className="h-7 text-xs w-32"
                            value={itemNotes[item.id] || ''} onChange={e => setItemNotes(n => ({ ...n, [item.id]: e.target.value }))} />
                          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => markItem.mutate({ id: item.id, status: 'verified' })}>Verified</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600" onClick={() => markItem.mutate({ id: item.id, status: 'damaged' })}>Damaged</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => markItem.mutate({ id: item.id, status: 'missing' })}>Missing</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
