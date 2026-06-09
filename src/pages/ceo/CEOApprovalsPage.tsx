import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Crown, IndianRupee, Check, Pause, FileText, ExternalLink, CheckSquare, Square, ShoppingCart, Eye, AlertTriangle, History as HistoryIcon, Search, X, Hammer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePaymentRequests, PaymentRequestData } from '@/hooks/usePaymentRequests';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { useLOPEntries } from '@/hooks/useLOPEntries';
import { useRealtimePayments } from '@/hooks/useRealtimePayments';
import { usePaymentTags } from '@/hooks/usePaymentTags';
import { PaymentDetailsModal } from '@/components/PaymentDetailsModal';
import { DocumentPreviewModal } from '@/components/DocumentPreviewModal';
import { LOPVerificationWidget } from '@/components/LOPVerificationWidget';
import { WorkRequestApprovalWidget } from '@/components/WorkRequestApprovalWidget';
import { WorkOrderMonitoringWidget } from '@/components/WorkOrderMonitoringWidget';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';

import { PaymentTagBadges } from '@/components/payment/PaymentTagBadges';
import { SplitPaymentBatchView } from '@/components/payments/SplitPaymentBatchView';
import { AuditHistoryWidget } from '@/components/payment/AuditHistoryWidget';
import { PaymentReminderButton } from '@/components/payment/PaymentReminderButton';

const urgencyConfig: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  emergency: { bg: 'bg-status-missed/20', border: 'border-status-missed', text: 'text-status-missed', icon: '🔴' },
  important: { bg: 'bg-status-late/20', border: 'border-status-late', text: 'text-status-late', icon: '🟡' },
  normal: { bg: 'bg-status-live/20', border: 'border-status-live', text: 'text-status-live', icon: '🟢' },
};

export function CEOApprovalsPage() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'payments';
  const defaultSubTab = searchParams.get('subtab') || 'history-payments';

  const { requests, isLoading: paymentLoading, refresh: refetch } = useRealtimePayments(['admin_approved', 'ceo_audit', 'ceo_hold']);
  const { updateStatus, isSaving } = usePaymentRequests({ skipFetch: true }); // For actions only
  const { purchaseOrders, isLoading: poLoading, approvePurchaseOrder, holdPurchaseOrder } = usePurchaseOrders();
  const { entries: lopEntries, isLoading: lopLoading } = useLOPEntries('pending_ceo');
  usePaymentTags(); // Warm the module-level cache for instant tag rendering inside cards

  const [expandedSplits, setExpandedSplits] = useState<Set<string>>(new Set());
  const [holdReason, setHoldReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showHoldInput, setShowHoldInput] = useState<string | null>(null);
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [hiddenPaymentIds, setHiddenPaymentIds] = useState<Set<string>>(new Set());
  const [selectedPayment, setSelectedPayment] = useState<PaymentRequestData | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [paymentCategory, setPaymentCategory] = useState<'all' | 'engineering' | 'agri' | 'transport' | 'others'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const pendingPOs = purchaseOrders.filter(po => po.status === 'admin_approved');

  // Filter out already processed payments, sort by cutoff time (most urgent first)
  const sortedPayments = [...requests]
    .filter(r => !hiddenPaymentIds.has(r.id))
    .filter(r => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase().trim();
      const cleanQ = q.startsWith('#') ? q.substring(1) : q;

      const matchesId = (r.payment_number?.toString() || '').includes(cleanQ);
      const matchesVendor = (r.vendor_name || '').toLowerCase().includes(q);
      const matchesPurpose = (r.purpose || '').toLowerCase().includes(q);
      const matchesDesc = (r.detailed_description || '').toLowerCase().includes(q);

      return matchesId || matchesVendor || matchesPurpose || matchesDesc;
    })
    .sort((a, b) => {
      const cutoffA = new Date(`${a.cutoff_date}T${a.cutoff_time}`).getTime();
      const cutoffB = new Date(`${b.cutoff_date}T${b.cutoff_time}`).getTime();
      return cutoffA - cutoffB;
    });

  const now = new Date();

  // Department classification — Agri = only 'Agri Operations', not 'Farmers Factory' or 'Nursery'
  // Transport payments are identified by is_transport_payment flag or 'transport' tag
  const isTransport = (p: PaymentRequestData) => !!(p as any).is_transport_payment;
  const transportPayments = sortedPayments.filter(p => isTransport(p));
  const engineeringPayments = sortedPayments.filter(p => !isTransport(p) && (p.department || '').toLowerCase().includes('eng'));
  const agriPayments = sortedPayments.filter(p => {
    if (isTransport(p)) return false;
    const d = (p.department || '').toLowerCase();
    return d.includes('agri') && !d.includes('eng');
  });
  const otherPayments = sortedPayments.filter(p => {
    if (isTransport(p)) return false;
    const d = (p.department || '').toLowerCase();
    return !d.includes('eng') && !d.includes('agri');
  });
  const visiblePayments = paymentCategory === 'all'
    ? sortedPayments
    : paymentCategory === 'engineering'
      ? engineeringPayments
      : paymentCategory === 'agri'
        ? agriPayments
        : paymentCategory === 'transport'
          ? transportPayments
          : otherPayments;

  // Group batch payments into a single virtual split payment
  const displayPayments = useMemo(() => {
    const batches: Record<string, PaymentRequestData[]> = {};
    const singles: PaymentRequestData[] = [];

    visiblePayments.forEach(p => {
      let batchId = p.split_batch_id;
      if (!batchId) {
        const match = p.purpose.match(/\(Split BATCH-([^\)]+)\)/);
        if (match) batchId = match[1];
      }
      if (batchId) {
        if (!batches[batchId]) batches[batchId] = [];
        batches[batchId].push(p);
      } else {
        singles.push(p);
      }
    });

    const result: PaymentRequestData[] = [...singles];

    Object.entries(batches).forEach(([batchId, batchPayments]) => {
      if (batchPayments.length > 1) {
        const first = batchPayments[0];
        const totalAmount = batchPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const cleanPurpose = first.purpose.replace(/\s*\(Split BATCH-.*\)/, '');

        // Convert batch payments into SplitPaymentData format
        const syntheticSplits = batchPayments.map((p, idx) => ({
          id: p.id,
          parent_payment_id: first.id,
          batch_id: batchId,
          split_number: idx + 1,
          split_title: p.vendor_name || p.detailed_description || p.purpose.replace(/\s*\(Split BATCH-.*\)/, ''),
          payee_name: p.vendor_name || 'Unknown',
          beneficiary_name: p.beneficiary_name || p.vendor_name,
          amount: Number(p.amount),
          payment_method: p.vendor_account_number ? 'bank_transfer' : (p.vendor_upi ? 'upi' : 'bank_transfer'),
          account_number: p.vendor_account_number || null,
          ifsc_code: p.vendor_ifsc_code || null,
          upi_id: p.vendor_upi || null,
          utr_number: null,
          payment_proof_url: null,
          paid_at: null,
          status: p.status,
          created_at: p.created_at || new Date().toISOString(),
        }));

        // Create a virtual parent payment that looks like a split payment
        const virtualPayment: PaymentRequestData = {
          ...first,
          id: `batch-${batchId}`,
          purpose: cleanPurpose,
          detailed_description: first.detailed_description,
          amount: totalAmount,
          vendor_name: 'SPLIT PAYMENT BATCH',
          is_split_payment: true,
          total_splits: batchPayments.length,
          splits: syntheticSplits as any,
          // Store original IDs for approval
          _batchPaymentIds: batchPayments.map(p => p.id),
        } as any;

        result.push(virtualPayment);
      } else {
        result.push(batchPayments[0]);
      }
    });

    return result.sort((a, b) => {
      const getCutoff = (p: PaymentRequestData) => new Date(`${p.cutoff_date}T${p.cutoff_time}`).getTime();
      return getCutoff(a) - getCutoff(b);
    });
  }, [visiblePayments]);

  const selectedAmount = visiblePayments
    .filter(p => selectedIds.has(p.id))
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (visiblePayments.length === 0) return;
    const allVisibleSelected = visiblePayments.every(p => selectedIds.has(p.id));
    if (allVisibleSelected) {
      const newSet = new Set(selectedIds);
      visiblePayments.forEach(p => newSet.delete(p.id));
      setSelectedIds(newSet);
    } else {
      setSelectedIds(new Set([...selectedIds, ...visiblePayments.map(p => p.id)]));
    }
  };

  const handleApprove = async (id: string) => {
    // Optimistically hide from UI
    setHiddenPaymentIds(prev => new Set([...prev, id]));
    const result = await updateStatus(id, 'ceo_approved', undefined, { skipRefetch: true });
    if (result.success) {
      toast.success('Approved → Sent to Accounts');
    } else {
      // Revert on failure
      setHiddenPaymentIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleBatchApprove = async (ids: string[], batchName: string) => {
    setIsBulkProcessing(true);
    setHiddenPaymentIds(prev => new Set([...prev, ...ids]));

    let successes = 0;
    for (const id of ids) {
      const res = await updateStatus(id, 'ceo_approved', undefined, { skipRefetch: true });
      if (res.success) successes++;
    }

    toast.success(`Approved ${successes} payments in ${batchName}`);
    setIsBulkProcessing(false);
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one payment');
      return;
    }

    setIsBulkProcessing(true);
    // Optimistically hide all selected
    setHiddenPaymentIds(prev => new Set([...prev, ...selectedIds]));

    let successCount = 0;
    let failCount = 0;
    const failedIds: string[] = [];

    for (const id of selectedIds) {
      const result = await updateStatus(id, 'ceo_approved', undefined, { skipRefetch: true });
      if (result.success) {
        successCount++;
      } else {
        failCount++;
        failedIds.push(id);
      }
    }

    // Revert failed ones
    if (failedIds.length > 0) {
      setHiddenPaymentIds(prev => {
        const newSet = new Set(prev);
        failedIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }

    setIsBulkProcessing(false);
    setSelectedIds(new Set());

    if (successCount > 0) {
      toast.success(`${successCount} payment(s) approved successfully`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} payment(s) failed to approve`);
    }
  };

  const handleHold = async (id: string) => {
    if (!holdReason.trim()) { toast.error('Hold reason is mandatory'); return; }
    const result = await updateStatus(id, 'ceo_hold', { holdReason }, { skipRefetch: true });
    if (result.success) { toast.success('Payment put on hold'); setShowHoldInput(null); setHoldReason(''); }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) { toast.error('Rejection reason is mandatory'); return; }
    // Optimistically hide from UI
    setHiddenPaymentIds(prev => new Set([...prev, id]));
    const result = await updateStatus(id, 'rejected', { rejectionReason: rejectReason }, { skipRefetch: true });
    if (result.success) {
      toast.success('Payment rejected');
      setShowRejectInput(null);
      setRejectReason('');
    } else {
      // Revert on failure
      setHiddenPaymentIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handlePOApprove = async (id: string) => {
    await approvePurchaseOrder(id, 'ceo');
    toast.success('Purchase Order approved');
  };

  const totalAmount = sortedPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-authority-ceo/20 flex items-center justify-center">
            <Crown className="w-7 h-7 text-authority-ceo" />
          </div>
          <div><h1 className="text-2xl font-bold mb-1">Command Center</h1><p className="text-muted-foreground">Final approval authority</p></div>
        </div>
        <div className="grid grid-cols-4 gap-6">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Payments</p>
            <p className="text-2xl font-bold">{paymentLoading ? '…' : sortedPayments.length}</p>
          </div>


          <div className="text-right">
            <p className="text-xs text-muted-foreground">LOP Approvals</p>
            <p className="text-2xl font-bold text-status-late">{lopLoading ? '…' : lopEntries.length}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList>
          <TabsTrigger value="payments" className="gap-2">
            <IndianRupee className="w-4 h-4" />
            Payments
            {sortedPayments.length > 0 && <Badge variant="destructive">{sortedPayments.length}</Badge>}
          </TabsTrigger>


          <TabsTrigger value="lop" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            LOP Approvals
            {lopEntries.length > 0 && <Badge variant="destructive">{lopEntries.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <HistoryIcon className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>


        {/* Payments Tab */}
        <TabsContent value="payments" className="mt-4">
          {paymentLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={selectAll} className="h-8 gap-1.5 text-xs">
                    {visiblePayments.length > 0 && visiblePayments.every(p => selectedIds.has(p.id)) ? (
                      <><CheckSquare className="w-3.5 h-3.5" /> Deselect</>
                    ) : (
                      <><Square className="w-3.5 h-3.5" /> Select All</>
                    )}
                  </Button>
                  <div className="relative group w-full md:w-64 order-first md:order-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      placeholder="Search #ID, payee, purpose..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-9 pr-8 text-xs bg-muted/30 border-white/5 focus-visible:ring-primary/30 focus-visible:bg-muted/50 rounded-lg transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-full transition-colors"
                        aria-label="Clear search"
                      >
                        <X className="w-3 h-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  <span className="text-border hidden md:inline">|</span>
                  <PaymentReminderButton variant="outline" size="sm" className="h-8 text-xs" />
                  <span className="text-border hidden md:inline">|</span>
                  {[
                    { key: 'all' as const, label: 'All', count: sortedPayments.length },
                    { key: 'engineering' as const, label: 'Eng', count: engineeringPayments.length },
                    { key: 'agri' as const, label: 'Agri', count: agriPayments.length },
                    { key: 'transport' as const, label: 'Transport', count: transportPayments.length },
                    { key: 'others' as const, label: 'Others', count: otherPayments.length },
                  ].map(({ key, label, count }) => (
                    <span
                      key={key}
                      onClick={() => setPaymentCategory(key)}
                      className={cn(
                        'cursor-pointer px-2.5 py-1 rounded-md text-xs font-medium transition-all hover:scale-105 active:scale-95',
                        paymentCategory === key
                          ? 'bg-primary/20 text-primary shadow-[0_0_10px_rgba(var(--primary),0.1)]'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      {label} ({count})
                    </span>
                  ))}
                </div>

                {selectedIds.size > 0 && (
                  <Button
                    size="sm"
                    className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 animate-in fade-in slide-in-from-right-2"
                    disabled={isBulkProcessing}
                    onClick={handleBulkApprove}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approve {selectedIds.size} Items (₹{(selectedAmount / 100000).toFixed(2)}L)
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                {displayPayments.map((payment) => {
                  const isBatchPayment = (payment as any)._batchPaymentIds?.length > 0;
                  const batchPaymentIds: string[] = (payment as any)._batchPaymentIds || [];
                  const urgencyStyle = urgencyConfig[payment.urgency] || urgencyConfig.normal;
                  const isSelected = selectedIds.has(payment.id);
                  const deptLower = payment.department?.toLowerCase() || '';
                  const deptCategory = deptLower.includes('eng') ? 'engineering' :
                    deptLower.includes('agri') ? 'agri' : 'others';
                  const deptLabel = payment.department || 'Others';
                  const cutoffTime = new Date(`${payment.cutoff_date}T${payment.cutoff_time}`);
                  const hoursUntil = differenceInHours(cutoffTime, now);
                  const minutesUntil = differenceInMinutes(cutoffTime, now) % 60;
                  const isExpired = cutoffTime < now;

                  return (
                    <div
                      key={payment.id}
                      className={cn(
                        'rounded-xl border bg-card/50',
                        isSelected && 'ring-2 ring-primary',
                        payment.status === 'ceo_hold' && 'border-amber-500/40',
                        (payment.gm_approved_by || payment.director_approved_by) && 'border-l-4 border-l-emerald-500'
                      )}
                    >
                      {showHoldInput === payment.id ? (
                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <span>{urgencyStyle.icon}</span>
                            <span className="font-semibold text-sm flex-1 truncate">{payment.purpose}</span>
                            <span className="font-bold">₹{Number(payment.amount).toLocaleString('en-IN')}</span>
                          </div>
                          <Textarea value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="Reason for hold..." className="min-h-[60px] text-sm" autoFocus />
                          <div className="flex gap-2">
                            <Button onClick={() => handleHold(payment.id)} disabled={isSaving || !holdReason.trim()} size="sm" className="flex-1 bg-amber-600 hover:bg-amber-500 text-white">Confirm Hold</Button>
                            <Button size="sm" variant="outline" onClick={() => { setShowHoldInput(null); setHoldReason(''); }}>Cancel</Button>
                          </div>
                        </div>
                      ) : showRejectInput === payment.id ? (
                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <span>❌</span>
                            <span className="font-semibold text-sm flex-1 truncate">{payment.purpose}</span>
                            <span className="font-bold">₹{Number(payment.amount).toLocaleString('en-IN')}</span>
                          </div>
                          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." className="min-h-[60px] text-sm" autoFocus />
                          <div className="flex gap-2">
                            <Button onClick={() => handleReject(payment.id)} disabled={isSaving || !rejectReason.trim()} size="sm" className="flex-1 bg-destructive hover:bg-destructive/90 text-white">Confirm Reject</Button>
                            <Button size="sm" variant="outline" onClick={() => { setShowRejectInput(null); setRejectReason(''); }}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 px-4 py-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelection(payment.id)}
                            className="w-5 h-5 shrink-0"
                          />

                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => { setSelectedPayment(payment); setShowDetailsModal(true); }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[10px] text-muted-foreground font-mono">#{payment.payment_number || 'NEW'}</span>
                                  <span className="text-[10px]">{urgencyStyle.icon}</span>
                                  <span className={cn(
                                    'text-[10px] font-medium px-1.5 py-0.5 rounded',
                                    isTransport(payment) ? 'bg-cyan-500/10 text-cyan-400' :
                                    deptCategory === 'engineering' ? 'bg-blue-500/10 text-blue-400' :
                                      deptCategory === 'agri' ? 'bg-emerald-500/10 text-emerald-400' :
                                        'bg-violet-500/10 text-violet-400'
                                  )}>
                                    {isTransport(payment) ? '🚛 Transport' : deptLabel}
                                  </span>
                                  {payment.status === 'ceo_hold' && (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">ON HOLD</span>
                                  )}
                                </div>
                                <h3 className="font-semibold text-sm leading-tight truncate">{payment.detailed_description || payment.purpose}</h3>
                                {payment.detailed_description && (
                                  <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5 italic">Ref: {payment.purpose}</p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-base font-bold flex items-center gap-0.5">
                                  <IndianRupee className="w-3.5 h-3.5" />
                                  {Number(payment.amount).toLocaleString('en-IN')}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                              <span className="truncate">Payee: <span className="text-foreground font-medium">{payment.vendor_name}</span></span>
                              <span className="truncate">By: <span className="text-foreground font-medium">{payment.requester?.name || 'N/A'}</span></span>
                              {deptCategory === 'engineering' && payment.gm_approved_by && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">✓ GM Approved</span>
                              )}
                              {deptLower.includes('r&d') && payment.gm_approved_by && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">✓ GM Approved</span>
                              )}
                              {deptLower.includes('purchase') && payment.gm_approved_by && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">✓ GM Approved</span>
                              )}
                              {deptCategory === 'agri' && payment.director_approved_by && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">✓ Director Approved</span>
                              )}
                              {payment.is_split_payment && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newSet = new Set(expandedSplits);
                                    if (newSet.has(payment.id)) newSet.delete(payment.id);
                                    else newSet.add(payment.id);
                                    setExpandedSplits(newSet);
                                  }}
                                  className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1.5 shadow-sm active:scale-95",
                                    expandedSplits.has(payment.id)
                                      ? "bg-purple-600 text-white border-purple-500 shadow-purple-500/20"
                                      : "bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20"
                                  )}
                                >
                                  <ShoppingCart className="w-3 h-3" />
                                  <span>{payment.total_splits || payment.splits?.length || 0} Splits</span>
                                  <div className={cn(
                                    "transition-transform duration-300",
                                    expandedSplits.has(payment.id) ? "rotate-180" : ""
                                  )}>
                                    ▾
                                  </div>
                                </button>
                              )}
                              <PaymentTagBadges tags={payment.tags || []} size="sm" maxDisplay={1} />
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px]">
                              <span className={cn(
                                'font-mono font-medium',
                                isExpired ? 'text-red-400' : hoursUntil <= 2 ? 'text-red-400' : hoursUntil <= 12 ? 'text-amber-400' : 'text-muted-foreground'
                              )}>
                                {isExpired ? `⏰ Expired ${Math.abs(hoursUntil)}h ago` : `⏱ ${hoursUntil}h ${minutesUntil}m left`}
                              </span>
                              <span className="text-muted-foreground">· Cutoff: {format(cutoffTime, 'dd MMM, hh:mm a')}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button variant="outline" size="sm" className="h-8 border-amber-500/20 text-amber-500 hover:bg-amber-500/10 px-2" onClick={() => setShowHoldInput(payment.id)}>
                              <Pause className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 border-red-500/20 text-red-500 hover:bg-red-500/10 px-2" onClick={() => setShowRejectInput(payment.id)}>
                              ✕
                            </Button>
                            <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3" disabled={isSaving} onClick={() => {
                              if (isBatchPayment) {
                                handleBatchApprove(batchPaymentIds, 'Batch');
                              } else {
                                handleApprove(payment.id);
                              }
                            }}>
                              <Check className="w-3.5 h-3.5 mr-1" /> Approve
                            </Button>
                          </div>
                        </div>
                      )}

                      {payment.is_split_payment && expandedSplits.has(payment.id) && (
                        <div className="border-t border-white/5 bg-slate-950/20 p-1">
                          <SplitPaymentBatchView
                            paymentId={payment.id}
                            totalAmount={payment.amount}
                            splits={payment.splits || []}
                            className="mt-0 border-none shadow-none bg-transparent"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                {displayPayments.length === 0 && (
                  <div className="col-span-full authority-card text-center py-16">
                    <Crown className="w-16 h-16 text-authority-ceo/30 mx-auto mb-4" />
                    <p className="text-xl font-semibold">
                      {paymentCategory === 'all'
                        ? 'No Pending Payments'
                        : paymentCategory === 'engineering'
                          ? 'No Engineering Payments'
                          : paymentCategory === 'agri'
                            ? 'No Agri Payments'
                            : paymentCategory === 'transport'
                              ? 'No Transport Payments'
                              : 'No Other Payments'}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>







        <TabsContent value="lop" className="mt-4">
          {lopLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <LOPVerificationWidget role="ceo" />
          )}
        </TabsContent>


        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <Tabs defaultValue={defaultSubTab}>
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
              <TabsTrigger value="history-payments" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-2 gap-2">
                <IndianRupee className="w-4 h-4" /> Payments History
              </TabsTrigger>


              <TabsTrigger value="history-lop" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-2 gap-2">
                <AlertTriangle className="w-4 h-4" /> LOP History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="history-payments" className="mt-4 space-y-4">
              <PaymentHistoryList />
            </TabsContent>





            <TabsContent value="history-lop" className="mt-4">
              <LOPHistoryList />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Payment Details Modal */}
      <PaymentDetailsModal
        payment={selectedPayment as any}
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
      />

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        url={previewUrl}
        title={previewTitle}
        open={showPreviewModal}
        onOpenChange={setShowPreviewModal}
      />
    </div >
  );
}

// History Components

function PaymentHistoryList() {
  const { resubmitPaymentRequest } = usePaymentRequests({ skipFetch: true });
  const [isResubmitting, setIsResubmitting] = useState(false);

  const handleResubmit = async (id: string) => {
    if (!resubmitPaymentRequest) return;
    if (confirm('Are you sure you want to quick-resubmit this request? It will re-enter the workflow without altering payment details.')) {
      setIsResubmitting(true);
      try {
        const res = await resubmitPaymentRequest(id, {});
        if (res.success) {
          toast.success('Successfully resubmitted payment');
        }
      } finally {
        setIsResubmitting(false);
      }
    }
  };

  if (isResubmitting) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Processing Resubmission...</div>;
  }

  return <AuditHistoryWidget role="ceo" title="My Approval History" onResubmit={handleResubmit} />;
}



function PurchaseOrderHistoryList({ purchaseOrders }: { purchaseOrders: any[] }) {
  const historyPOs = purchaseOrders.filter(po => po.status === 'ceo_approved' || po.status === 'issued' || po.status === 'completed');

  if (historyPOs.length === 0) {
    return (
      <div className="authority-card text-center py-16">
        <ShoppingCart className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
        <p className="text-xl font-semibold text-muted-foreground">No Approved Purchase Orders</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {historyPOs.map(po => (
        <WOPOCard
          key={po.id}
          type="po"
          id={po.id}
          number={po.po_number}
          title={po.item_description}
          amount={po.total_amount}
          requester={po.requester?.name || ''}
          project={`${po.project?.project_id} - ${po.project?.project_name}`}
          documentUrl={po.po_document_url}
          onApprove={() => { }}
          onHold={() => { }}
          extra={`Vendor: ${po.vendor_name} • Approved: ${po.ceo_approved_at ? format(new Date(po.ceo_approved_at), 'PPP') : 'N/A'}`}
          readOnly
        />
      ))}
    </div>
  );
}

function LOPHistoryList() {
  const { entries: historyLOPs, isLoading } = useLOPEntries(['approved']);

  if (isLoading) return <div>Loading...</div>;

  if (historyLOPs.length === 0) {
    return (
      <div className="authority-card text-center py-16">
        <AlertTriangle className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
        <p className="text-xl font-semibold text-muted-foreground">No LOP History</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {historyLOPs.map(entry => (
        <div key={entry.id} className="rounded-xl border bg-muted/20 p-6 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-status-live/10 text-status-live border-status-live/20">Approved</Badge>
              <h4 className="font-bold">{entry.employee_name}</h4>
            </div>
            <p className="text-sm text-muted-foreground">Date: {format(new Date(entry.lop_date), 'PPP')}</p>
            <p className="text-xs text-muted-foreground mt-1">Reason: {entry.reason}</p>
          </div>
          {entry.evidence_url === 'SYSTEM_AUTO' ? (
            <Badge variant="outline" className="text-xs bg-muted">
              Auto-Generated
            </Badge>
          ) : (
            <a href={entry.evidence_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> Proof
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// Reusable card for WO/PO
function WOPOCard({ type, id, number, title, amount, requester, project, documentUrl, onApprove, onHold, extra, readOnly }: {
  type: 'wo' | 'po';
  id: string;
  number: number;
  title: string;
  amount: number;
  requester: string;
  project: string;
  documentUrl: string;
  onApprove: (id: string) => void;
  onHold: (id: string, reason: string) => void;
  extra?: string;
  readOnly?: boolean;
}) {
  const [showHold, setShowHold] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleApprove = async () => {
    if (readOnly) return;
    setProcessing(true);
    await onApprove(id);
    setProcessing(false);
  };

  const handleHold = async () => {
    if (!holdReason.trim()) {
      toast.error('Hold reason is required');
      return;
    }
    setProcessing(true);
    await onHold(id, holdReason);
    setProcessing(false);
    setShowHold(false);
  };

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <Badge variant="outline" className="mb-2">
            {type.toUpperCase()}-{String(number).padStart(3, '0')}
          </Badge>
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-sm text-muted-foreground">{requester} • {project}</p>
          {extra && <p className="text-sm text-muted-foreground mt-1">{extra}</p>}
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold flex items-center">
            <IndianRupee className="w-6 h-6" />
            {Number(amount).toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border hover:border-primary text-sm">
          <FileText className="w-4 h-4 text-primary" />
          <span>View Document</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {showHold ? (
        <div className="space-y-3">
          <Textarea value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="Enter hold reason..." />
          <div className="flex gap-2">
            <Button onClick={handleHold} disabled={processing} variant="outline">Confirm Hold</Button>
            <Button variant="ghost" onClick={() => { setShowHold(false); setHoldReason(''); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        !readOnly && (
          <div className="flex items-center gap-4">
            <Button onClick={handleApprove} disabled={processing} size="lg" className="flex-1 h-12 bg-status-live hover:bg-status-live/80">
              <Check className="w-5 h-5 mr-2" />Approve
            </Button>
            <Button onClick={() => setShowHold(true)} size="lg" variant="outline" className="flex-1 h-12 border-status-late text-status-late">
              <Pause className="w-5 h-5 mr-2" />Hold
            </Button>
          </div>
        )
      )}
    </div>
  );
}
