import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInCalendarDays } from 'date-fns';
import { toast } from 'sonner';
import { Plus, RefreshCw, Loader2, Truck, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Vehicle {
  id: string; vehicle_number: string; vehicle_type: string | null; vehicle_make: string | null; vehicle_model: string | null;
  ownership_type: string; is_active: boolean; hub_id: string | null; assigned_driver_id: string | null;
  insurance_expiry: string | null; puc_expiry: string | null; permit_expiry: string | null; fitness_expiry: string | null;
  last_service_date: string | null; next_service_due: string | null; odometer_km: number | null; notes: string | null;
}
interface Driver { id: string; driver_name: string }
interface Hub { id: string; name: string }

const emptyForm = {
  vehicle_number: '', vehicle_type: 'truck', vehicle_make: '', vehicle_model: '', ownership_type: 'owned',
  hub_id: '', assigned_driver_id: '', insurance_expiry: '', puc_expiry: '', permit_expiry: '', fitness_expiry: '',
  last_service_date: '', next_service_due: '', odometer_km: '', notes: '',
};

const EXPIRY_FIELDS: { key: keyof Vehicle; label: string }[] = [
  { key: 'insurance_expiry', label: 'Insurance' },
  { key: 'puc_expiry', label: 'PUC' },
  { key: 'permit_expiry', label: 'Permit' },
  { key: 'fitness_expiry', label: 'Fitness' },
];

function ExpiryBadge({ date, label }: { date: string | null; label: string }) {
  if (!date) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">{label}: —</span>;
  const days = differenceInCalendarDays(new Date(date), new Date());
  const color = days < 0 ? 'bg-red-100 text-red-700' : days <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${color}`}>{label}: {format(new Date(date), 'd MMM yy')}</span>;
}

export default function VehicleManagementPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const { data: vehicles = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['transport-vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('transport_vehicles').select('*').order('vehicle_number');
      if (error) throw error;
      return (data || []) as Vehicle[];
    },
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['transport-drivers-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('transport_drivers').select('id, driver_name').eq('is_active', true).order('driver_name');
      if (error) throw error;
      return (data || []) as Driver[];
    },
    enabled: showForm,
  });

  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-active'],
    queryFn: async () => {
      const { data } = await supabase.from('hubs').select('id, name').eq('is_active', true);
      return (data || []) as Hub[];
    },
  });

  const driverName = (id: string | null) => drivers.find((d) => d.id === id)?.driver_name
    ?? (id ? '—' : 'Unassigned');
  const hubName = (id: string | null) => hubs.find((h) => h.id === id)?.name ?? '—';

  const filtered = vehicles.filter((v) =>
    !search || v.vehicle_number.toLowerCase().includes(search.toLowerCase()) || (v.vehicle_make || '').toLowerCase().includes(search.toLowerCase())
  );

  const alerts = useMemo(() => {
    let expired = 0, expiringSoon = 0;
    for (const v of vehicles) {
      for (const f of EXPIRY_FIELDS) {
        const d = v[f.key] as string | null;
        if (!d) continue;
        const days = differenceInCalendarDays(new Date(d), new Date());
        if (days < 0) expired++;
        else if (days <= 30) expiringSoon++;
      }
    }
    return { expired, expiringSoon };
  }, [vehicles]);

  const handleCreate = async () => {
    if (!form.vehicle_number) { toast.error('Vehicle number is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('transport_vehicles').insert({
        vehicle_number: form.vehicle_number.toUpperCase(),
        vehicle_type: form.vehicle_type || null,
        vehicle_make: form.vehicle_make || null,
        vehicle_model: form.vehicle_model || null,
        ownership_type: form.ownership_type,
        hub_id: form.hub_id || null,
        assigned_driver_id: form.assigned_driver_id || null,
        insurance_expiry: form.insurance_expiry || null,
        puc_expiry: form.puc_expiry || null,
        permit_expiry: form.permit_expiry || null,
        fitness_expiry: form.fitness_expiry || null,
        last_service_date: form.last_service_date || null,
        next_service_due: form.next_service_due || null,
        odometer_km: form.odometer_km ? parseFloat(form.odometer_km) : null,
        notes: form.notes || null,
        is_active: true,
        created_by: user?.id,
      } as any);
      if (error) throw error;
      toast.success('Vehicle added');
      setShowForm(false);
      setForm(emptyForm);
      refetch();
    } catch (e: any) { toast.error(e.message || 'Failed to add vehicle — check the number is unique'); }
    finally { setSaving(false); }
  };

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('transport_vehicles').update({ is_active: !is_active } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12 pt-2 px-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Vehicle Management</h1>
          <p className="text-[13px] text-slate-500">Fleet register — ownership, hub, driver, and compliance document expiry</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />Refresh</Button>
          <Button size="sm" onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4 mr-2" />New Vehicle</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Total Vehicles</p><p className="text-xl font-bold text-slate-800">{vehicles.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Owned</p><p className="text-xl font-bold text-slate-800">{vehicles.filter(v => v.ownership_type === 'owned').length}</p></CardContent></Card>
        <Card className={alerts.expiringSoon > 0 ? 'border-amber-300' : ''}><CardContent className="p-4"><p className="text-xs text-slate-500 flex items-center gap-1"><ShieldCheck className="h-3 w-3" />Expiring ≤30 days</p><p className="text-xl font-bold text-amber-600">{alerts.expiringSoon}</p></CardContent></Card>
        <Card className={alerts.expired > 0 ? 'border-red-300' : ''}><CardContent className="p-4"><p className="text-xs text-slate-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Expired Documents</p><p className="text-xl font-bold text-red-600">{alerts.expired}</p></CardContent></Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New Vehicle</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="text-xs text-slate-500 mb-1 block">Vehicle Number *</label><Input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="TN01AB1234" /></div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Type</label>
                <select value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))} className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm">
                  <option value="truck">Truck</option><option value="tempo">Tempo</option><option value="van">Van</option><option value="bike">Bike</option><option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Ownership</label>
                <select value={form.ownership_type} onChange={e => setForm(f => ({ ...f, ownership_type: e.target.value }))} className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm">
                  <option value="owned">Owned</option><option value="hired">Hired</option>
                </select>
              </div>
              <div><label className="text-xs text-slate-500 mb-1 block">Make</label><Input value={form.vehicle_make} onChange={e => setForm(f => ({ ...f, vehicle_make: e.target.value }))} placeholder="Tata" /></div>
              <div><label className="text-xs text-slate-500 mb-1 block">Model</label><Input value={form.vehicle_model} onChange={e => setForm(f => ({ ...f, vehicle_model: e.target.value }))} placeholder="Ace" /></div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Hub</label>
                <select value={form.hub_id} onChange={e => setForm(f => ({ ...f, hub_id: e.target.value }))} className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm">
                  <option value="">Not hub-specific</option>
                  {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Assigned Driver</label>
                <select value={form.assigned_driver_id} onChange={e => setForm(f => ({ ...f, assigned_driver_id: e.target.value }))} className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm">
                  <option value="">Unassigned</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.driver_name}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500 mb-1 block">Odometer (km)</label><Input type="number" value={form.odometer_km} onChange={e => setForm(f => ({ ...f, odometer_km: e.target.value }))} /></div>
              <div><label className="text-xs text-slate-500 mb-1 block">Insurance Expiry</label><Input type="date" value={form.insurance_expiry} onChange={e => setForm(f => ({ ...f, insurance_expiry: e.target.value }))} /></div>
              <div><label className="text-xs text-slate-500 mb-1 block">PUC Expiry</label><Input type="date" value={form.puc_expiry} onChange={e => setForm(f => ({ ...f, puc_expiry: e.target.value }))} /></div>
              <div><label className="text-xs text-slate-500 mb-1 block">Permit Expiry</label><Input type="date" value={form.permit_expiry} onChange={e => setForm(f => ({ ...f, permit_expiry: e.target.value }))} /></div>
              <div><label className="text-xs text-slate-500 mb-1 block">Fitness Expiry</label><Input type="date" value={form.fitness_expiry} onChange={e => setForm(f => ({ ...f, fitness_expiry: e.target.value }))} /></div>
              <div><label className="text-xs text-slate-500 mb-1 block">Last Service</label><Input type="date" value={form.last_service_date} onChange={e => setForm(f => ({ ...f, last_service_date: e.target.value }))} /></div>
              <div><label className="text-xs text-slate-500 mb-1 block">Next Service Due</label><Input type="date" value={form.next_service_due} onChange={e => setForm(f => ({ ...f, next_service_due: e.target.value }))} /></div>
              <div className="md:col-span-3"><label className="text-xs text-slate-500 mb-1 block">Notes</label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : 'Add Vehicle'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vehicle number or make…" className="max-w-xs" />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400"><Truck className="h-8 w-8 mx-auto mb-2 opacity-40" /> No vehicles registered yet</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map((v) => (
                <div key={v.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap hover:bg-slate-50">
                  <div className="min-w-[160px]">
                    <p className="font-mono font-semibold text-slate-800">{v.vehicle_number}</p>
                    <p className="text-xs text-slate-400">{v.vehicle_make} {v.vehicle_model} · {v.vehicle_type} · <span className="capitalize">{v.ownership_type}</span></p>
                  </div>
                  <div className="text-xs text-slate-500">
                    <p>{hubName(v.hub_id)}</p>
                    <p>{driverName(v.assigned_driver_id)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {EXPIRY_FIELDS.map(f => <ExpiryBadge key={f.key} date={v[f.key] as string | null} label={f.label} />)}
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => toggleActive.mutate({ id: v.id, is_active: v.is_active })}>
                    {v.is_active ? 'Deactivate' : 'Reactivate'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
