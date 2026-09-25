import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Plus, RefreshCw, Loader2, ArrowRightLeft, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Asset { id: string; asset_name: string; hub_id: string | null; assigned_to: string | null }
interface Hub { id: string; name: string }
interface Staff { id: string; name: string }
interface TransferRequest {
  id: string; asset_id: string; requested_by: string | null; requested_at: string;
  from_hub_id: string | null; to_hub_id: string | null; from_assigned_to: string | null; to_assigned_to: string | null;
  reason: string | null; status: 'pending' | 'approved' | 'rejected';
  decided_by: string | null; decided_at: string | null; decision_notes: string | null;
}

const APPROVER_ROLES = ['admin', 'ceo', 'gm', 'ff_operations_manager'];
const emptyForm = { asset_id: '', to_hub_id: '', to_assigned_to: '', reason: '' };

export default function AssetTransfersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});

  const isApprover = APPROVER_ROLES.includes((user?.role || '').toLowerCase());

  const { data: assets = [] } = useQuery({
    queryKey: ['fixed-assets-active-lite'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fixed_assets').select('id, asset_name, hub_id, assigned_to').eq('status', 'active').order('asset_name');
      if (error) throw error;
      return (data || []) as Asset[];
    },
  });

  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-active'],
    queryFn: async () => {
      const { data } = await supabase.from('hubs').select('id, name').eq('is_active', true);
      return (data || []) as Hub[];
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-for-asset-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, name').not('name', 'is', null).order('name');
      if (error) throw error;
      return (data || []) as Staff[];
    },
  });

  const { data: requests = [], refetch, isLoading, isFetching } = useQuery({
    queryKey: ['asset-transfer-requests'],
    queryFn: async () => {
      const { data, error } = await supabase.from('asset_transfer_requests').select('*').order('requested_at', { ascending: false }).limit(100);
      if (error) throw error;
      return (data || []) as TransferRequest[];
    },
  });

  const assetName = (id: string) => assets.find(a => a.id === id)?.asset_name ?? '—';
  const hubName = (id: string | null) => (id ? hubs.find(h => h.id === id)?.name ?? '—' : '—');
  const staffName = (id: string | null) => (id ? staff.find(s => s.id === id)?.name ?? '—' : 'Unassigned');

  const pendingCount = useMemo(() => requests.filter(r => r.status === 'pending').length, [requests]);

  const handleCreate = async () => {
    const asset = assets.find(a => a.id === form.asset_id);
    if (!asset) { toast.error('Select an asset'); return; }
    if (!form.to_hub_id && !form.to_assigned_to) { toast.error('Choose a destination hub or staff member'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('asset_transfer_requests').insert({
        asset_id: asset.id,
        requested_by: user?.id,
        from_hub_id: asset.hub_id,
        to_hub_id: form.to_hub_id || null,
        from_assigned_to: asset.assigned_to,
        to_assigned_to: form.to_assigned_to || null,
        reason: form.reason || null,
      } as any);
      if (error) throw error;
      toast.success('Transfer request submitted');
      setShowForm(false);
      setForm(emptyForm);
      refetch();
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const decide = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc('asset_transfer_decide', { p_request_id: id, p_approve: approve, p_notes: decisionNotes[id] || null } as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.approve ? 'Transfer approved and applied' : 'Transfer rejected');
      qc.invalidateQueries({ queryKey: ['asset-transfer-requests'] });
      qc.invalidateQueries({ queryKey: ['fixed-assets'] });
      qc.invalidateQueries({ queryKey: ['fixed-assets-active-lite'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to record decision'),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12 pt-2 px-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Asset Transfers</h1>
          <p className="text-[13px] text-slate-500">Request and approve moving an asset between hubs or staff, with a record of who signed off</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />Refresh</Button>
          <Button size="sm" onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4 mr-2" />New Request</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Total Requests</p><p className="text-xl font-bold text-slate-800">{requests.length}</p></CardContent></Card>
        <Card className={pendingCount > 0 ? 'border-amber-300' : ''}><CardContent className="p-4"><p className="text-xs text-slate-500">Pending Approval</p><p className="text-xl font-bold text-amber-600">{pendingCount}</p></CardContent></Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New Transfer Request</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs text-slate-500 mb-1 block">Asset *</label>
                <select value={form.asset_id} onChange={e => setForm(f => ({ ...f, asset_id: e.target.value }))} className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm">
                  <option value="">Select an asset…</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.asset_name} (currently: {hubName(a.hub_id)} · {staffName(a.assigned_to)})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Move to Hub</label>
                <select value={form.to_hub_id} onChange={e => setForm(f => ({ ...f, to_hub_id: e.target.value }))} className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm">
                  <option value="">No change</option>
                  {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Assign to Staff</label>
                <select value={form.to_assigned_to} onChange={e => setForm(f => ({ ...f, to_assigned_to: e.target.value }))} className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm">
                  <option value="">Unassigned</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-2"><label className="text-xs text-slate-500 mb-1 block">Reason</label><Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Why is this transfer needed?" /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Submitting…' : 'Submit Request'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading…</div>
          ) : requests.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400"><ArrowRightLeft className="h-8 w-8 mx-auto mb-2 opacity-40" /> No transfer requests yet</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {requests.map(r => (
                <div key={r.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-medium text-slate-800">{assetName(r.asset_id)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {hubName(r.from_hub_id)} / {staffName(r.from_assigned_to)} <ArrowRightLeft className="inline h-3 w-3 mx-1 text-slate-400" /> {hubName(r.to_hub_id)} / {staffName(r.to_assigned_to)}
                      </p>
                      {r.reason && <p className="text-xs text-slate-400 mt-0.5">"{r.reason}"</p>}
                      <p className="text-[11px] text-slate-400 mt-1">Requested {format(new Date(r.requested_at), 'd MMM yyyy, h:mm a')}</p>
                      {r.decided_at && <p className="text-[11px] text-slate-400">{r.status === 'approved' ? 'Approved' : 'Rejected'} {format(new Date(r.decided_at), 'd MMM yyyy, h:mm a')}{r.decision_notes ? ` — "${r.decision_notes}"` : ''}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full border capitalize ${
                        r.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                        r.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                        'bg-red-50 text-red-600 border-red-200'
                      }`}>{r.status}</span>
                    </div>
                  </div>
                  {r.status === 'pending' && isApprover && (
                    <div className="flex items-center gap-2 mt-2.5">
                      <Input placeholder="Decision note (optional)" className="h-8 text-xs max-w-xs"
                        value={decisionNotes[r.id] || ''} onChange={e => setDecisionNotes(d => ({ ...d, [r.id]: e.target.value }))} />
                      <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: true })}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 hover:bg-red-50" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: false })}>
                        <X className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
