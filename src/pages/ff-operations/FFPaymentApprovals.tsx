// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
  Banknote, Truck, Eye, RefreshCw, Package, AlertCircle,
  Building2, Filter,
} from 'lucide-react';

// ── Status helpers ────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending_ff_ops:   'bg-amber-100 text-amber-700 border-amber-200',
  pending_gm:       'bg-blue-100 text-blue-700 border-blue-200',
  pending_l1:       'bg-purple-100 text-purple-700 border-purple-200',
  pending_auditor:  'bg-cyan-100 text-cyan-700 border-cyan-200',
  pending_ceo:      'bg-orange-100 text-orange-700 border-orange-200',
  approved:         'bg-teal-100 text-teal-700 border-teal-200',
  paid:             'bg-green-100 text-green-700 border-green-200',
  rejected:         'bg-red-100 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending_ff_ops:  'Pending FF Ops',
  pending_gm:      'Pending GM',
  pending_l1:      'Pending L1',
  pending_auditor: 'Pending Auditor',
  pending_ceo:     'Pending CEO',
  approved:        'Approved',
  paid:            'Paid',
  rejected:        'Rejected',
};

const APPROVAL_CHAIN = [
  'pending_ff_ops', 'pending_l1', 'pending_gm', 'pending_auditor', 'pending_ceo', 'approved',
];

function ApprovalProgress({ status }: { status: string }) {
  const steps = ['FF Ops', 'L1', 'GM', 'Auditor', 'CEO', 'Done'];
  const idx = APPROVAL_CHAIN.indexOf(status);
  if (status === 'paid') return <span className="text-xs text-green-600 font-semibold">✓ Paid</span>;
  if (status === 'rejected') return <span className="text-xs text-red-500 font-semibold">✗ Rejected</span>;
  return (
    <div className="flex items-center gap-0.5">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-0.5">
          <div className={`h-2 w-2 rounded-full transition-colors ${
            i < idx ? 'bg-green-500' :
            i === idx ? 'bg-blue-500 ring-2 ring-blue-200' :
            'bg-gray-200'
          }`} title={s} />
          {i < steps.length - 1 && (
            <div className={`h-0.5 w-3 ${i < idx ? 'bg-green-400' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Mark as Paid modal ───────────────────────────────────────
function MarkPaidModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (utr: string, proofUrl: string) => void }) {
  const [utr, setUtr] = useState('');
  const [proof, setProof] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" /> Confirm Payment
        </h3>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">UTR / Reference Number <span className="text-red-500">*</span></label>
          <input
            value={utr}
            onChange={e => setUtr(e.target.value)}
            placeholder="e.g. SBIN0000123456789"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Payment Proof URL (optional)</label>
          <input
            value={proof}
            onChange={e => setProof(e.target.value)}
            placeholder="https://..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => { if (utr.trim()) onConfirm(utr.trim(), proof.trim()); }}
            disabled={!utr.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            ✓ Mark as Paid
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reject modal ──────────────────────────────────────────────
function RejectModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: string, level: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-base font-semibold text-gray-800">Reject Payment</h3>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason for rejection (required)..."
          rows={4}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => { if (reason.trim()) onConfirm(reason, ''); }}
            disabled={!reason.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            Confirm Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Items detail expand ───────────────────────────────────────
function ItemsTable({ items }: { items: any[] }) {
  if (!items?.length) return <p className="text-xs text-gray-400 italic">No items</p>;
  return (
    <table className="w-full text-xs border-collapse mt-2">
      <thead>
        <tr className="bg-gray-50">
          <th className="text-left px-2 py-1.5 font-medium text-gray-500 border-b">Product</th>
          <th className="text-right px-2 py-1.5 font-medium text-gray-500 border-b">Qty</th>
          <th className="text-right px-2 py-1.5 font-medium text-gray-500 border-b">Rate</th>
          <th className="text-right px-2 py-1.5 font-medium text-gray-500 border-b">Amount</th>
          <th className="text-center px-2 py-1.5 font-medium text-gray-500 border-b">Grade</th>
          <th className="text-left px-2 py-1.5 font-medium text-gray-500 border-b">Deduction</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-2 py-1.5 font-medium text-gray-800">{item.product_name}</td>
            <td className="px-2 py-1.5 text-right text-gray-600">{item.qty} {item.unit}</td>
            <td className="px-2 py-1.5 text-right text-gray-600">₹{item.rate}</td>
            <td className="px-2 py-1.5 text-right font-semibold text-gray-800">₹{Number(item.amount).toLocaleString('en-IN')}</td>
            <td className="px-2 py-1.5 text-center">
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                item.qc_grade === 'A' ? 'bg-green-100 text-green-700' :
                item.qc_grade === 'B' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-600'
              }`}>{item.qc_grade || '—'}</span>
            </td>
            <td className="px-2 py-1.5 text-gray-500 text-xs">{item.deduction_reason || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Payment card ──────────────────────────────────────────────
function PaymentCard({
  payment,
  type,
  userRole,
  onApprove,
  onReject,
  onMarkPaid,
  isApproving,
}: any) {
  const [expanded, setExpanded] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showPaid, setShowPaid] = useState(false);

  const canAct = (
    (userRole === 'ff_operations_manager' && payment.payment_status === 'pending_ff_ops') ||
    (userRole === 'gm'                    && payment.payment_status === 'pending_gm') ||
    (userRole === 'l1_manager'            && payment.payment_status === 'pending_l1') ||
    (userRole === 'auditor'               && payment.payment_status === 'pending_auditor') ||
    (userRole === 'ceo'                   && payment.payment_status === 'pending_ceo') ||
    (userRole === 'admin')
  );
  const canMarkPaid = payment.payment_status === 'approved' &&
    (userRole === 'admin' || userRole === 'accounts' || userRole === 'ceo');

  const amount = type === 'vendor'
    ? payment.net_amount ?? payment.gross_amount
    : payment.total_amount;

  const title = type === 'vendor'
    ? (payment.vendors?.name || 'Vendor Payment')
    : (payment.vehicle_number ? `Vehicle: ${payment.vehicle_number}` : 'Transport Payment');

  const subtitle = type === 'vendor'
    ? `PO · ${payment.hubs?.name || '—'}`
    : `${payment.origin || '—'} → ${payment.destination || '—'} · ${payment.hubs?.name || '—'}`;

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Icon + Info */}
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${type === 'vendor' ? 'bg-blue-50' : 'bg-orange-50'}`}>
              {type === 'vendor'
                ? <Banknote className="w-4 h-4 text-blue-600" />
                : <Truck className="w-4 h-4 text-orange-600" />
              }
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-800">{title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
              <div className="mt-1.5">
                <ApprovalProgress status={payment.payment_status} />
              </div>
            </div>
          </div>

          {/* Amount + Status */}
          <div className="text-right shrink-0">
            <p className="text-base font-bold text-gray-900">
              ₹{Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[payment.payment_status] || 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[payment.payment_status] || payment.payment_status}
            </span>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400">
            {format(new Date(payment.created_at), 'dd MMM yyyy, h:mm a')}
          </span>
          <div className="flex items-center gap-2">
            {canMarkPaid && (
              <button
                onClick={() => setShowPaid(true)}
                disabled={isApproving}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid
              </button>
            )}
            {canAct && (
              <>
                <button
                  onClick={() => setShowReject(true)}
                  disabled={isApproving}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
                <button
                  onClick={() => onApprove(payment.id)}
                  disabled={isApproving}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </button>
              </>
            )}
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 bg-gray-50/50">
          {type === 'vendor' && (
            <>
              <div className="flex gap-4 text-xs text-gray-600 py-3">
                <span><b>Gross:</b> ₹{Number(payment.gross_amount || 0).toLocaleString('en-IN')}</span>
                <span><b>Deduction:</b> ₹{Number(payment.deduction_amount || 0).toLocaleString('en-IN')}</span>
                <span className="font-semibold text-gray-800"><b>Net:</b> ₹{Number(payment.net_amount || 0).toLocaleString('en-IN')}</span>
              </div>
              {/* Bank Details — shown to approvers so they know where money goes */}
              {payment.vendors && (payment.vendors.account_number || payment.vendors.ifsc_code) && (
                <div className="mb-3 p-3 rounded-lg border border-blue-100 bg-blue-50/60">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500 mb-1.5 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Bank Transfer Details
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-gray-400 text-[10px]">Bank</p>
                      <p className="font-semibold text-gray-800">{payment.vendors.bank_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-[10px]">Account No.</p>
                      <p className="font-semibold text-gray-800 font-mono">{payment.vendors.account_number || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-[10px]">IFSC</p>
                      <p className="font-semibold text-gray-800 font-mono">{payment.vendors.ifsc_code || '—'}</p>
                    </div>
                  </div>
                  {payment.vendors.phone && (
                    <p className="text-[10px] text-gray-500 mt-1.5">📞 {payment.vendors.phone}</p>
                  )}
                </div>
              )}
              <ItemsTable items={payment.items || []} />
            </>
          )}
          {type === 'transport' && (
            <div className="grid grid-cols-2 gap-3 py-3 text-xs text-gray-600">
              <div><b>Trip Date:</b> {payment.trip_date ? format(new Date(payment.trip_date), 'dd MMM yyyy') : '—'}</div>
              <div><b>KM Covered:</b> {payment.km_covered ?? '—'} km</div>
              <div><b>Base Amount:</b> ₹{Number(payment.base_amount || 0).toLocaleString('en-IN')}</div>
              <div><b>Toll Charges:</b> ₹{Number(payment.toll_charges || 0).toLocaleString('en-IN')}</div>
              <div><b>Other Charges:</b> ₹{Number(payment.other_charges || 0).toLocaleString('en-IN')}</div>
              <div className="font-semibold text-gray-800"><b>Total:</b> ₹{Number(payment.total_amount || 0).toLocaleString('en-IN')}</div>
            </div>
          )}
          {/* Approval history */}
          {(payment.ff_ops_approved_at || payment.gm_approved_at || payment.l1_approved_at || payment.auditor_approved_at || payment.ceo_approved_at) && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-gray-500 mb-1">Approval History</p>
              {payment.ff_ops_approved_at && <div className="text-xs text-gray-500">✓ FF Ops: {format(new Date(payment.ff_ops_approved_at), 'dd MMM, h:mm a')} {payment.ff_ops_remarks && `· "${payment.ff_ops_remarks}"`}</div>}
              {payment.gm_approved_at && <div className="text-xs text-gray-500">✓ GM: {format(new Date(payment.gm_approved_at), 'dd MMM, h:mm a')} {payment.gm_remarks && `· "${payment.gm_remarks}"`}</div>}
              {payment.l1_approved_at && <div className="text-xs text-gray-500">✓ L1: {format(new Date(payment.l1_approved_at), 'dd MMM, h:mm a')} {payment.l1_remarks && `· "${payment.l1_remarks}"`}</div>}
              {payment.auditor_approved_at && <div className="text-xs text-gray-500">✓ Auditor: {format(new Date(payment.auditor_approved_at), 'dd MMM, h:mm a')} {payment.auditor_remarks && `· "${payment.auditor_remarks}"`}</div>}
              {payment.ceo_approved_at && <div className="text-xs text-gray-500">✓ CEO: {format(new Date(payment.ceo_approved_at), 'dd MMM, h:mm a')} {payment.ceo_remarks && `· "${payment.ceo_remarks}"`}</div>}
            </div>
          )}
          {payment.rejection_reason && (
            <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600">
              <b>Rejected:</b> {payment.rejection_reason}
            </div>
          )}
        </div>
      )}

      {showReject && (
        <RejectModal
          onClose={() => setShowReject(false)}
          onConfirm={(reason) => { onReject(payment.id, reason); setShowReject(false); }}
        />
      )}
      {showPaid && (
        <MarkPaidModal
          onClose={() => setShowPaid(false)}
          onConfirm={(utr, proofUrl) => { onMarkPaid(payment.id, utr, proofUrl); setShowPaid(false); }}
        />
      )}
    </div>
  );
}

// ── Next status map ───────────────────────────────────────────
const NEXT_STATUS: Record<string, string> = {
  ff_operations_manager: 'pending_l1',
  l1_manager: 'pending_gm',
  gm:         'pending_auditor',
  auditor: 'pending_ceo',
  ceo:     'approved',
  admin:   'approved',
};

const APPROVED_BY_COL: Record<string, string> = {
  ff_operations_manager: 'ff_ops',
  gm:         'gm',
  l1_manager: 'l1',
  auditor:    'auditor',
  ceo:        'ceo',
  admin:      'ceo',
};

// ── Main page ─────────────────────────────────────────────────
export default function FFPaymentApprovals() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'vendor' | 'transport'>('vendor');
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  const role = user?.role || '';
  const col = APPROVED_BY_COL[role];

  // Determine which status to filter for "my queue"
  const myPendingStatus: Record<string, string> = {
    ff_operations_manager: 'pending_ff_ops',
    gm:         'pending_gm',
    l1_manager: 'pending_l1',
    auditor:    'pending_auditor',
    ceo:        'pending_ceo',
  };

  // Fetch vendor payments
  const { data: vendorPayments = [], isLoading: vLoading, refetch: vRefetch } = useQuery({
    queryKey: ['ff-vendor-payments', statusFilter, role],
    queryFn: async () => {
      let q = (supabase as any)
        .from('ff_vendor_payments')
        .select(`*, vendors(name, bank_name, account_number, ifsc_code, phone), hubs(name)`)
        .order('created_at', { ascending: false });

      if (statusFilter === 'pending') {
        q = q.in('payment_status', ['pending_ff_ops','pending_gm','pending_l1','pending_auditor','pending_ceo']);
      } else if (statusFilter === 'my_queue') {
        const s = myPendingStatus[role];
        if (s) q = q.eq('payment_status', s);
      } else if (statusFilter !== 'all') {
        q = q.eq('payment_status', statusFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Fetch transport payments
  const { data: transportPayments = [], isLoading: tLoading, refetch: tRefetch } = useQuery({
    queryKey: ['ff-transport-payments', statusFilter, role],
    queryFn: async () => {
      let q = (supabase as any)
        .from('ff_transport_payments')
        .select(`*, hubs(name)`)
        .order('created_at', { ascending: false });

      if (statusFilter === 'pending') {
        q = q.in('payment_status', ['pending_ff_ops','pending_gm','pending_l1','pending_auditor','pending_ceo']);
      } else if (statusFilter === 'my_queue') {
        const s = myPendingStatus[role];
        if (s) q = q.eq('payment_status', s);
      } else if (statusFilter !== 'all') {
        q = q.eq('payment_status', statusFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: 'vendor' | 'transport' }) => {
      const nextStatus = NEXT_STATUS[role];
      if (!nextStatus || !col) throw new Error('Role cannot approve');
      const table = type === 'vendor' ? 'ff_vendor_payments' : 'ff_transport_payments';
      const update: any = {
        payment_status: nextStatus,
        [`${col}_approved_by`]: user?.id,
        [`${col}_approved_at`]: new Date().toISOString(),
      };
      const { error } = await (supabase as any).from(table).update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success('Payment approved ✓');
      qc.invalidateQueries({ queryKey: ['ff-vendor-payments'] });
      qc.invalidateQueries({ queryKey: ['ff-transport-payments'] });
    },
    onError: (e: any) => toast.error(e.message || 'Approval failed'),
  });

  // Mark as Paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async ({ id, utr, proofUrl, type }: { id: string; utr: string; proofUrl: string; type: 'vendor' | 'transport' }) => {
      const table = type === 'vendor' ? 'ff_vendor_payments' : 'ff_transport_payments';
      const { error } = await (supabase as any).from(table).update({
        payment_status:   'paid',
        utr_number:       utr,
        payment_proof_url: proofUrl || null,
        paid_by:          user?.id,
        paid_at:          new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Payment marked as paid ✓');
      qc.invalidateQueries({ queryKey: ['ff-vendor-payments'] });
      qc.invalidateQueries({ queryKey: ['ff-transport-payments'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason, type }: { id: string; reason: string; type: 'vendor' | 'transport' }) => {
      const table = type === 'vendor' ? 'ff_vendor_payments' : 'ff_transport_payments';
      const { error } = await (supabase as any).from(table).update({
        payment_status: 'rejected',
        rejection_reason: reason,
        rejection_level: role,
        rejected_by: user?.id,
        rejected_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Payment rejected');
      qc.invalidateQueries({ queryKey: ['ff-vendor-payments'] });
      qc.invalidateQueries({ queryKey: ['ff-transport-payments'] });
    },
    onError: (e: any) => toast.error(e.message || 'Reject failed'),
  });

  const payments = tab === 'vendor' ? vendorPayments : transportPayments;
  const isLoading = tab === 'vendor' ? vLoading : tLoading;
  const refetch = tab === 'vendor' ? vRefetch : tRefetch;

  const myQueueCount = tab === 'vendor'
    ? vendorPayments.filter(p => p.payment_status === myPendingStatus[role]).length
    : transportPayments.filter(p => p.payment_status === myPendingStatus[role]).length;

  // Role-aware title
  const roleTitles: Record<string, string> = {
    ff_operations_manager: 'FF Operations — Payment Approvals',
    gm:         'GM — FF Payment Approvals',
    l1_manager: 'L1 Manager — Payment Approvals',
    auditor:    'Auditor — Payment Review',
    ceo:        'CEO — Final Payment Approvals',
    admin:      'Admin — All FF Payments',
  };
  const title = roleTitles[role] || 'FF Payment Approvals';

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Review and action vendor & transport payment requests
          </p>
        </div>
        <button
          onClick={() => { vRefetch(); tRefetch(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'vendor', label: 'Vendor Payments', icon: Banknote, count: vendorPayments.length },
          { key: 'transport', label: 'Transport Payments', icon: Truck, count: transportPayments.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        {[
          { key: 'my_queue', label: `My Queue${myQueueCount > 0 ? ` (${myQueueCount})` : ''}` },
          { key: 'pending', label: 'All Pending' },
          { key: 'approved', label: 'Approved' },
          { key: 'rejected', label: 'Rejected' },
          { key: 'paid', label: 'Paid' },
          { key: 'all', label: 'All' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
              statusFilter === f.key
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading payments...
        </div>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
          <CheckCircle2 className="w-10 h-10 mb-2 text-gray-300" />
          <p className="font-medium text-sm">No payments found</p>
          <p className="text-xs mt-1">
            {statusFilter === 'my_queue' ? 'Your queue is clear — nothing to action.' : 'No records match this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map(p => (
            <PaymentCard
              key={p.id}
              payment={p}
              type={tab}
              userRole={role}
              isApproving={approveMutation.isPending || markPaidMutation.isPending}
              onApprove={(id: string) => approveMutation.mutate({ id, type: tab })}
              onReject={(id: string, reason: string) => rejectMutation.mutate({ id, reason, type: tab })}
              onMarkPaid={(id: string, utr: string, proofUrl: string) => markPaidMutation.mutate({ id, utr, proofUrl, type: tab })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
