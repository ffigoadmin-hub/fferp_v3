import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import {
  AlertTriangle, Package, Phone, MessageCircle,
  ChevronDown, ChevronUp, Loader2, RefreshCw,
  CheckCircle2, FileText, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const STATUS_COLOR: Record<string, string> = {
  pending_return: 'bg-red-100 text-red-700',
  returned:       'bg-amber-100 text-amber-700',
  credit_issued:  'bg-green-100 text-green-700',
};
const STATUS_LABEL: Record<string, string> = {
  pending_return: 'Pending Return',
  returned:       'Returned',
  credit_issued:  'Credit Issued',
};

// Modal: Create Deduction Memo
function DeductionModal({
  rejection,
  onClose,
  onCreated,
}: {
  rejection: any;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [amount, setAmount]     = useState<number>(rejection.credit_note_amount ?? 0);
  const [type, setType]         = useState('quality');
  const [description, setDesc]  = useState('');
  const [saving, setSaving]     = useState(false);

  const handleCreate = async () => {
    if (!amount || amount <= 0) { toast.error('Enter a valid deduction amount'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('deduction_memos').insert({
        qc_inspection_id: rejection.qc_inspection_id ?? null,
        vendor_id:        rejection.vendor_id ?? null,
        po_id:            rejection.po_id ?? null,
        deduction_type:   type,
        deduction_kg:     rejection.rejected_kg ?? 0,
        deduction_amount: amount,
        description:      description || `${STATUS_LABEL['pending_return']}: ${rejection.rejected_kg} kg at ₹${amount}`,
        status:           'pending',
        created_by:       user!.id,
      });
      if (error) throw error;
      toast.success('Deduction memo created');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-slate-800 text-lg mb-4">Create Deduction Memo</h3>

        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Rejection</p>
            <p className="font-semibold text-slate-800">{rejection.product_name ?? rejection.product_id}</p>
            <p className="text-xs text-slate-500">{rejection.vendor_name ?? rejection.vendor_id} · {rejection.rejected_kg} kg</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deduction Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="quality">Quality Deduction</option>
              <option value="shortage">Shortage</option>
              <option value="damage">Physical Damage</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deduction Amount (₹) *</label>
            <input
              type="number" min="0" step="0.01"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Reason for deduction…"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Creating…</> : 'Create Memo'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-slate-600 rounded-xl py-2.5 font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QCRejections() {
  const { user } = useAuth();
  const hubId = (user as any)?.hub_id ?? null;
  const queryClient = useQueryClient();
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [deductionModal, setDeductionModal] = useState<any>(null);

  const { data: rejections = [], isLoading, refetch } = useQuery({
    queryKey: ['qc-rejections-real', filterStatus, hubId],
    queryFn: async () => {
      let q = supabase
        .from('qc_rejections')
        .select(`
          id, rejected_kg, rejection_reason, return_status, created_at,
          qc_inspection_id, vendor_id, product_id,
          product:products(name),
          vendor:vendors(name, phone),
          qc:qc_inspections(grn_number, po_item_id)
        `)
        .order('created_at', { ascending: false });
      if (filterStatus !== 'all') q = q.eq('return_status', filterStatus);
      const { data } = await q;
      return (data ?? []).map((r: any) => ({
        ...r,
        product_name: r.product?.name,
        vendor_name:  r.vendor?.name,
        vendor_phone: r.vendor?.phone,
        status: r.return_status ?? 'pending_return',
        quantity_kg: r.rejected_kg,
        credit_note_amount: null,
      }));
    },
  });

  const processReturn = useMutation({
    mutationFn: async (rejectionId: string) => {
      const { error } = await supabase
        .from('qc_rejections')
        .update({ return_status: 'returned' })
        .eq('id', rejectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Return processed');
      queryClient.invalidateQueries({ queryKey: ['qc-rejections-real'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="max-w-3xl mx-auto pb-12 pt-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800">QC Rejections</h1>
          <p className="text-[13px] text-slate-500">Grade D items & vendor return tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/warehouse/deductions" className="btn-zoho-secondary text-xs flex items-center gap-1">
            <FileText className="h-4 w-4" /> Deduction Memos
          </Link>
          <button onClick={() => refetch()} className="btn-zoho-secondary px-3">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending Return', value: (rejections as any[]).filter(r => r.status === 'pending_return').length, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Returned',       value: (rejections as any[]).filter(r => r.status === 'returned').length,       color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Credit Issued',  value: (rejections as any[]).filter(r => r.status === 'credit_issued').length,  color: 'text-green-600', bg: 'bg-green-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'pending_return', 'returned', 'credit_issued'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterStatus === s ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (rejections as any[]).length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-xl border">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No rejections found</p>
            <p className="text-sm">All QC batches passed</p>
          </div>
        ) : (
          (rejections as any[]).map((r: any) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                className="w-full px-4 py-3 flex items-center justify-between text-left"
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-50 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{r.product_name ?? '—'}</span>
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Grade D</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.vendor_name} · {r.quantity_kg} kg · {format(new Date(r.created_at), 'dd MMM, hh:mm a')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                  {expanded === r.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
              </button>

              {expanded === r.id && (
                <div className="px-4 pb-4 border-t bg-gray-50 space-y-3 pt-3">
                  <div>
                    <p className="text-xs text-gray-500">Rejection Reason</p>
                    <p className="text-sm font-medium text-gray-800">{r.rejection_reason}</p>
                  </div>
                  {r.qc?.grn_number && (
                    <div>
                      <p className="text-xs text-gray-500">GRN</p>
                      <p className="text-sm font-medium text-gray-800">{r.qc.grn_number}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1 flex-wrap">
                    {/* Create Deduction Memo */}
                    <button
                      onClick={() => setDeductionModal(r)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Deduction Memo
                    </button>

                    {r.status === 'pending_return' && (
                      <button
                        onClick={() => processReturn.mutate(r.id)}
                        disabled={processReturn.isPending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
                      >
                        <Package className="h-3.5 w-3.5" /> Process Return
                      </button>
                    )}

                    {r.vendor_phone && (
                      <a
                        href={`tel:${r.vendor_phone}`}
                        className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-slate-600 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" /> Call Vendor
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Deduction Modal */}
      {deductionModal && (
        <DeductionModal
          rejection={deductionModal}
          onClose={() => setDeductionModal(null)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['deduction-memos'] })}
        />
      )}
    </div>
  );
}
