import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  FileText, CheckCircle2, XCircle, RefreshCw,
  AlertTriangle, ChevronRight, Plus,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending',  color: 'bg-amber-100 text-amber-700' },
  applied: { label: 'Applied',  color: 'bg-green-100 text-green-700' },
  voided:  { label: 'Voided',   color: 'bg-gray-100 text-gray-500' },
};

const TYPE_LABEL: Record<string, string> = {
  quality:  'Quality Deduction',
  shortage: 'Shortage',
  damage:   'Physical Damage',
  other:    'Other',
};

export default function DeductionMemos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hubId = (user as any)?.hub_id ?? null;
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: memos = [], isLoading, refetch } = useQuery({
    queryKey: ['deduction-memos', filterStatus],
    queryFn: async () => {
      let q = supabase
        .from('deduction_memos')
        .select(`
          id, deduction_type, deduction_kg, deduction_amount,
          description, status, created_at,
          vendor:vendors(name),
          po:purchase_orders(po_number),
          qc:qc_inspections(grn_number, overall_grade)
        `)
        .order('created_at', { ascending: false });
      if (filterStatus !== 'all') q = q.eq('status', filterStatus);
      const { data } = await q;
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('deduction_memos')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Deduction memo updated');
      queryClient.invalidateQueries({ queryKey: ['deduction-memos'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const totalPending = (memos as any[]).filter(m => m.status === 'pending')
    .reduce((s, m) => s + Number(m.deduction_amount || 0), 0);
  const totalApplied = (memos as any[]).filter(m => m.status === 'applied')
    .reduce((s, m) => s + Number(m.deduction_amount || 0), 0);

  const fmt = (n: number) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 pt-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Deduction Memos</h1>
          <p className="text-[13px] text-slate-500">Quality & shortage deductions against vendor payments</p>
        </div>
        <button onClick={() => refetch()} className="btn-zoho-secondary px-3">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
        {[
          { label: 'Pending Deductions', value: fmt(totalPending), icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Applied to Payments', value: fmt(totalApplied), icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Memos', value: (memos as any[]).length, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 pt-5 pb-4">
            <div className={`p-2 ${card.bg} rounded-lg w-fit mb-2`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <p className="text-[13px] text-slate-500 font-medium mb-1">{card.label}</p>
            <p className="text-[20px] font-bold text-slate-800">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'pending', 'applied', 'voided'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
              filterStatus === s
                ? 'bg-slate-800 text-white'
                : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Memos List */}
      <div className="zoho-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : (memos as any[]).length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No deduction memos found</p>
            <Link to="/warehouse/qc-rejections" className="mt-2 inline-block text-xs text-blue-600 hover:underline">
              Create from QC Rejections →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {(memos as any[]).map((memo: any) => (
              <div key={memo.id}>
                {/* Row */}
                <div
                  className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === memo.id ? null : memo.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-slate-800 text-sm">
                        {memo.vendor?.name ?? '—'}
                      </span>
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        {TYPE_LABEL[memo.deduction_type] ?? memo.deduction_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      {memo.qc?.grn_number && <span>GRN: {memo.qc.grn_number}</span>}
                      {memo.po?.po_number && <span>PO: {memo.po.po_number}</span>}
                      <span>{format(new Date(memo.created_at), 'd MMM yyyy')}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800">{fmt(memo.deduction_amount)}</p>
                    {memo.deduction_kg > 0 && (
                      <p className="text-xs text-slate-400">{Number(memo.deduction_kg).toFixed(1)} kg</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[memo.status]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_CONFIG[memo.status]?.label ?? memo.status}
                  </span>
                  <ChevronRight className={`h-4 w-4 text-gray-300 transition-transform ${expandedId === memo.id ? 'rotate-90' : ''}`} />
                </div>

                {/* Expanded Detail */}
                {expandedId === memo.id && (
                  <div className="px-5 pb-4 bg-slate-50 border-t border-slate-100">
                    {memo.description && (
                      <p className="text-sm text-slate-600 mt-3 mb-3">{memo.description}</p>
                    )}
                    {memo.status === 'pending' && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateStatus.mutate({ id: memo.id, status: 'applied' })}
                          disabled={updateStatus.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Mark Applied
                        </button>
                        <button
                          onClick={() => updateStatus.mutate({ id: memo.id, status: 'voided' })}
                          disabled={updateStatus.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-slate-600 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Void
                        </button>
                      </div>
                    )}
                    {memo.status === 'applied' && (
                      <p className="text-xs text-green-600 mt-2 font-medium">✓ Applied to payment</p>
                    )}
                    {memo.status === 'voided' && (
                      <p className="text-xs text-gray-400 mt-2">This deduction was voided and will not be applied.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
