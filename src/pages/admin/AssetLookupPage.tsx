import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Loader2, Building2, ArrowLeft, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Asset {
  id: string; asset_name: string; asset_code: string | null; asset_tag_code: string | null; account_id: string;
  purchase_date: string; purchase_cost: number; salvage_value: number; useful_life_years: number;
  accumulated_depreciation: number; status: 'active' | 'disposed'; hub_id: string | null; assigned_to: string | null;
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function AssetLookupPage() {
  const { id } = useParams<{ id: string }>();

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset-lookup', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('fixed_assets').select('*').eq('id', id as string).maybeSingle();
      if (error) throw error;
      return data as Asset | null;
    },
  });

  const { data: account } = useQuery({
    queryKey: ['asset-lookup-account', asset?.account_id],
    enabled: !!asset?.account_id,
    queryFn: async () => {
      const { data } = await supabase.from('acct_accounts').select('name').eq('id', asset!.account_id).maybeSingle();
      return data;
    },
  });
  const { data: hub } = useQuery({
    queryKey: ['asset-lookup-hub', asset?.hub_id],
    enabled: !!asset?.hub_id,
    queryFn: async () => { const { data } = await supabase.from('hubs').select('name').eq('id', asset!.hub_id as string).maybeSingle(); return data; },
  });
  const { data: staff } = useQuery({
    queryKey: ['asset-lookup-staff', asset?.assigned_to],
    enabled: !!asset?.assigned_to,
    queryFn: async () => { const { data } = await supabase.from('profiles').select('name').eq('id', asset!.assigned_to as string).maybeSingle(); return data; },
  });

  if (isLoading) return <div className="p-10 text-center text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading…</div>;
  if (!asset) return <div className="p-10 text-center text-sm text-slate-400">Asset not found</div>;

  const nbv = Number(asset.purchase_cost) - Number(asset.accumulated_depreciation);

  return (
    <div className="max-w-md mx-auto space-y-4 pb-12 pt-4 px-4">
      <Link to="/accounts/fixed-assets" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600"><ArrowLeft className="h-3.5 w-3.5" /> Back to register</Link>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Building2 className="h-5 w-5 text-blue-600" /> {asset.asset_name}</CardTitle>
          {asset.asset_tag_code && <p className="text-xs font-mono text-slate-400 flex items-center gap-1"><Tag className="h-3 w-3" /> {asset.asset_tag_code}</p>}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Status">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${asset.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{asset.status}</span>
          </Row>
          <Row label="Category">{account?.name ?? '—'}</Row>
          <Row label="Current Hub">{hub?.name ?? '—'}</Row>
          <Row label="Assigned To">{staff?.name ?? 'Unassigned'}</Row>
          <Row label="Purchase Date">{format(new Date(asset.purchase_date), 'd MMM yyyy')}</Row>
          <Row label="Purchase Cost">{inr(asset.purchase_cost)}</Row>
          <Row label="Net Book Value">{inr(nbv)}</Row>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{children}</span>
    </div>
  );
}
