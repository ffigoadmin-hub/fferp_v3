import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Banknote, Search, Filter, Trash2, Eye, CheckCircle, XCircle, Loader2, ShieldCheck, ListFilter, RotateCcw, AlertTriangle, Edit, Send, History as HistoryIcon, Building2, Layers, Clock, Zap, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimePayments } from '@/hooks/useRealtimePayments';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { EnhancedPaymentAuditWidget } from '@/components/payment/EnhancedPaymentAuditWidget';
import { PaymentDetailsModal } from '@/components/PaymentDetailsModal';
import { AuditHistoryWidget } from '@/components/payment/AuditHistoryWidget';
import { PaymentReminderButton } from '@/components/payment/PaymentReminderButton';
import { useBatchOperations } from '@/hooks/useBatchOperations';
import { BatchDetailCard } from '@/components/BatchDetailCard';
import { PaymentRegistryCard } from '@/components/payment/PaymentRegistryCard';

interface PaymentRequest {
  id: string;
  requester_id: string;
  purpose: string;
  vendor_name: string;
  amount: number;
  status: string;
  urgency: string;
  created_at: string;
  cutoff_date: string;
  cutoff_time: string;
  is_project_work: boolean;
  wo_number: string | null;
  profiles?: { name: string; department: string };
  payment_proof_url?: string | null;
  payment_proof_screenshot?: string | null;
  work_proof_url?: string | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-600 border-yellow-500',
  smo_audit: 'bg-blue-500/20 text-blue-600 border-blue-500',
  gmo_audit: 'bg-indigo-500/20 text-indigo-600 border-indigo-500',
  director_audit: 'bg-purple-500/20 text-purple-600 border-purple-500',
  boi_audit: 'bg-green-500/20 text-green-600 border-green-500',
  gm_audit: 'bg-teal-500/20 text-teal-600 border-teal-500',
  admin_audit: 'bg-status-late/20 text-status-late border-status-late',
  admin_approved: 'bg-primary/20 text-primary border-primary',
  ceo_audit: 'bg-status-live/20 text-status-live border-status-live',
  ceo_approved: 'bg-status-live/20 text-status-live border-status-live',
  ceo_hold: 'bg-authority-ceo/20 text-authority-ceo border-authority-ceo',
  rejected: 'bg-status-missed/20 text-status-missed border-status-missed',
  paid: 'bg-status-live/20 text-status-live border-status-live',
};

export function AdminPaymentsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('audit');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [deletingPayment, setDeletingPayment] = useState<PaymentRequest | null>(null);
  const [viewingPayment, setViewingPayment] = useState<any>(null);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);

  // Reversed payments edit state
  const [editingReversedPayment, setEditingReversedPayment] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    vendor_account_number: '',
    vendor_ifsc_code: '',
    beneficiary_name: '',
    admin_notes: ''
  });
  const [editSplits, setEditSplits] = useState<any[]>([]);

  const { useBatches, updateBatchStatus } = useBatchOperations();
  const { data: pendingBatches, refetch: refetchBatches } = useBatches('pending_verification');

  // Fetch full payment details including bank info, project, and audit timeline
  const handleViewPayment = async (paymentId: string) => {
    setIsLoadingPayment(true);
    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select(`
          *,
          requester:profiles!payment_requests_requester_id_fkey(id, name, department),
          project:projects!payment_requests_project_id_fkey(
            project_id,
            project_name,
            vertical,
            client_name,
            location_city,
            location_state,
            current_phase_id,
            status,
            lifecycle_stage,
            current_phase:project_phases!projects_current_phase_id_fkey(id, phase_name, phase_order, status)
          ),
          phase:project_phases!payment_requests_phase_id_fkey(id, phase_name, phase_order, status),
          work_order:work_orders!payment_requests_work_order_id_fkey(
            id,
            wo_number,
            work_description,
            estimated_amount,
            signed_document_url,
            boq_item:project_boq!work_orders_boq_item_id_fkey(
              id,
              phase_id,
              phase:project_phases!project_boq_phase_id_fkey(id, phase_name, phase_order)
            )
          )
        `)
        .eq('id', paymentId)
        .single();

      if (error) throw error;
      setViewingPayment(data);
    } catch (err) {
      console.error('Failed to fetch payment details:', err);
      if (!isMissingTable(error)) toast.error('Failed to load payment details');
    } finally {
      setIsLoadingPayment(false);
    }
  };

  // Load heavy global registry data only for registry-focused tabs.
  // For 'all' and 'reversed' tabs, fetch all payments. For other tabs, skip fetching to improve performance.
  const registryStatuses = useMemo<string[] | undefined>(() => {
    // Only fetch data for tabs that need it
    if (activeTab === 'all' || activeTab === 'reversed') {
      return undefined; // Fetch all statuses
    }
    // For other tabs (audit, batches, history), return empty array to fetch no data
    return [];
  }, [activeTab]);
  const { requests: payments, isLoading, refresh: refetch } = useRealtimePayments(registryStatuses, ['draft']);

  const { updateStatus, resubmitPaymentRequest } = usePaymentRequests({ skipFetch: true });

  // Derived reversed payments from the main realtime list
  // avoiding separate query for better sync
  const reversedPayments = payments.filter(p =>
    p.status === 'admin_audit' &&
    p.accounts_reversal_reason
  ).sort((a, b) => new Date(b.accounts_reversed_at || b.created_at).getTime() - new Date(a.accounts_reversed_at || a.created_at).getTime());

  const isLoadingReversed = isLoading;
  const refetchReversed = refetch;

  const handleDelete = async () => {
    if (!deletingPayment) return;
    setIsLoadingPayment(true);
    try {
      const { error } = await supabase
        .from('payment_requests')
        .delete()
        .eq('id', deletingPayment.id);

      if (error) throw error;
      toast.success('Payment request deleted');
      setDeletingPayment(null);
      queryClient.invalidateQueries({ queryKey: ['payment-requests'] });
    } catch (err) {
      console.error('Failed to delete payment:', err);
      toast.error('Failed to delete payment');
    } finally {
      setIsLoadingPayment(false);
    }
  };

  const handleResubmit = async (id: string) => {
    if (!resubmitPaymentRequest) return;
    if (confirm('Are you sure you want to quick-resubmit this request? It will re-enter the workflow without altering payment details.')) {
      setIsLoadingPayment(true);
      try {
        const res = await resubmitPaymentRequest(id, {});
        if (res.success) {
          toast.success('Successfully resubmitted payment');
        }
      } finally {
        setIsLoadingPayment(false);
      }
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from('payment_requests')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Payment request deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-all-payments'] });
      setDeletingPayment(null);
    },
    onError: () => {
      toast.error('Failed to delete payment request');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ paymentId, action, reason }: { paymentId: string; action: 'approve' | 'reject'; reason?: string }) => {
      const nextStatus = action === 'approve' ? 'ceo_audit' : 'rejected';

      const res = await updateStatus(paymentId, nextStatus as any, {
        rejectionReason: action === 'reject' ? (reason || 'Rejected by Admin') : undefined
      });

      if (!res.success) throw new Error('Failed to update status');
    },
    onSuccess: (_, variables) => {
      toast.success(`Payment ${variables.action === 'approve' ? 'approved and forwarded to CEO' : 'rejected'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-all-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-reversed-payments'] });
    },
    onError: () => {
      toast.error('Failed to update payment status');
    },
  });

  // Mutation to update reversed payment and resubmit to CEO
  const resubmitMutation = useMutation({
    mutationFn: async ({ paymentId, bankDetails, splits, notes, isTransport, transportTrips }: {
      paymentId: string;
      bankDetails: { vendor_account_number: string; vendor_ifsc_code: string; beneficiary_name: string };
      splits: any[];
      notes: string;
      isTransport?: boolean;
      transportTrips?: any[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get current request for timeline
      const { data: request } = await supabase
        .from('payment_requests')
        .select('audit_timeline, is_split_payment')
        .eq('id', paymentId)
        .single();

      const now = new Date().toISOString();
      const currentTimeline = (request?.audit_timeline || []) as any[];

      const timelineEntry = {
        status: 'ceo_audit',
        user_id: user.id,
        user_name: 'Admin',
        role: 'admin',
        timestamp: now,
        notes: `Bank details corrected and resubmitted: ${notes}`
      };

      const { error } = await (supabase
        .from('payment_requests') as any)
        .update({
          vendor_account_number: bankDetails.vendor_account_number,
          vendor_ifsc_code: bankDetails.vendor_ifsc_code,
          beneficiary_name: bankDetails.beneficiary_name,
          status: 'ceo_audit',
          admin_approved_by: user.id,
          admin_approved_at: now,
          accounts_reversal_reason: null,
          accounts_reversed_by: null,
          accounts_reversed_at: null,
          is_split_payment: (isTransport && splits.length > 1) || request?.is_split_payment || false,
          audit_timeline: [...currentTimeline, timelineEntry],
          // Also update transport_trips if it's a transport payment to keep bank info synced
          ...(isTransport && transportTrips ? {
            transport_trips: transportTrips.map((trip, idx) => {
              const matchedSplit = splits.find(s => s.split_number === (idx + 1));
              if (matchedSplit) {
                return {
                  ...trip,
                  account_number: matchedSplit.account_number,
                  ifsc_code: matchedSplit.ifsc_code,
                  beneficiary_name: matchedSplit.beneficiary_name
                };
              }
              return trip;
            })
          } : {})
        })
        .eq('id', paymentId);

      if (error) throw error;

      // Update associated splits in split_payments table
      if (splits.length > 0) {
        for (const split of splits) {
          const { error: splitError } = await (supabase
            .from('split_payments') as any)
            .update({
              account_number: split.account_number,
              ifsc_code: split.ifsc_code,
              beneficiary_name: split.beneficiary_name
            })
            .eq('id', split.id);
          
          if (splitError) throw splitError;
        }
      }
    },
    onSuccess: () => {
      toast.success('Payment corrected and resubmitted to CEO');
      queryClient.invalidateQueries({ queryKey: ['admin-all-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-reversed-payments'] });
      setEditingReversedPayment(null);
      setEditFormData({ vendor_account_number: '', vendor_ifsc_code: '', beneficiary_name: '', admin_notes: '' });
      setEditSplits([]);
    },
    onError: () => {
      toast.error('Failed to resubmit payment');
    },
  });

  const handleBatchVerify = async (batchId: string) => {
    try {
      await updateBatchStatus.mutateAsync({ batchId, status: 'verified' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditReversedPayment = (payment: any) => {
    setEditingReversedPayment(payment);
    setEditFormData({
      vendor_account_number: payment.vendor_account_number || '',
      vendor_ifsc_code: payment.vendor_ifsc_code || '',
      beneficiary_name: payment.beneficiary_name || payment.vendor_name || '',
      admin_notes: ''
    });
    setEditSplits(payment.splits || []);
  };

  const handleUpdateSplit = (id: string, field: string, value: string) => {
    setEditSplits(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const filteredPayments = payments?.filter(payment => {
    const matchesSearch = searchQuery === '' ||
      payment.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.requester?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    const matchesUrgency = urgencyFilter === 'all' || payment.urgency === urgencyFilter;
    const paymentDept = (payment.requester?.department || 'others').toLowerCase();
    const matchesDepartment = departmentFilter === 'all' || paymentDept === departmentFilter;

    return matchesSearch && matchesStatus && matchesUrgency && matchesDepartment;
  }) || [];

  const totalAmount = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-authority-admin/20 flex items-center justify-center">
              <Banknote className="w-4 h-4 text-authority-admin" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">Payment Administration</h1>
              <p className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-tighter">Manage approvals and view all requests</p>
            </div>
            <PaymentReminderButton variant="outline" size="sm" className="h-8 ml-2" />
          </div>
          <TabsList className="bg-black/40 border border-white/5 p-1 rounded-xl h-auto flex-wrap">
            <TabsTrigger value="audit" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_15px_rgba(var(--primary),0.2)]">
              <CheckCircle className="w-4 h-4" />
              Audit Queue
            </TabsTrigger>
            <TabsTrigger value="batches" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-authority-admin/20 data-[state=active]:text-authority-admin">
              <Layers className="w-4 h-4" />
              Batches
              {pendingBatches && pendingBatches.length > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px] animate-pulse">
                  {pendingBatches.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-slate-800/50">
              <HistoryIcon className="w-4 h-4" />
              My History
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
              <Search className="w-4 h-4" />
              Registry
            </TabsTrigger>
            <TabsTrigger value="reversed" className="flex items-center gap-2 relative rounded-lg data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
              <RotateCcw className="w-4 h-4" />
              Reversed
              {reversedPayments && reversedPayments.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                  {reversedPayments.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="audit" className="space-y-6">
          <EnhancedPaymentAuditWidget
            roles={['admin']}
            targetStatuses={['admin_audit']}
            title="Admin Compliance Audit"
            subtitle="Verify legitimacy and compliance before forwarding to CEO"
            roleLabel="Admin"
          />
        </TabsContent>

        <TabsContent value="batches" className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Layers className="w-5 h-5 text-authority-admin" />
                Batch Verification Queue
              </h2>
              <p className="text-sm text-muted-foreground">Review and verify payment batches created by Accounts</p>
            </div>
            {pendingBatches && pendingBatches.length > 0 && (
              <Badge className="bg-authority-admin/20 text-authority-admin border-authority-admin/30" variant="outline">
                {pendingBatches.length} Pending Verification
              </Badge>
            )}
          </div>

          {(!pendingBatches || pendingBatches.length === 0) ? (
            <div className="authority-card text-center py-16">
              <Layers className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-xl font-semibold">No Batches Pending Verification</p>
              <p className="text-muted-foreground">All batches have been reviewed</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingBatches.map((batch: any) => (
                <BatchDetailCard
                  key={batch.id}
                  batchId={batch.id}
                  batchReference={batch.batch_reference}
                  totalAmount={Number(batch.total_amount)}
                  paymentCount={batch.payment_count}
                  createdAt={batch.created_at}
                  creatorName={batch.creator?.name}
                  onVerify={() => handleBatchVerify(batch.id)}
                  isVerifying={updateBatchStatus.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>



        <TabsContent value="history" className="space-y-3">
          <AuditHistoryWidget role="admin" />
        </TabsContent>

        <TabsContent value="all" className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold font-sans">Global Payment Registry</h2>
              <p className="text-xs text-slate-500">Search and manage all payment requests in the system</p>
            </div>

            <div className="flex gap-2">
              <div className="text-right px-3 border-r border-slate-800">
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Total Volume</p>
                <p className="text-xl font-black font-mono">₹{totalAmount.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Registry Count</p>
                <p className="text-xl font-black font-mono text-primary">{filteredPayments.length}</p>
              </div>
            </div>
          </div>

          {/* Pro Max KPI Grid - Neon Glass Style - Conservative Columns for sidebar compatibility */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
            {[
              { label: 'Pending Requests', count: payments?.filter(p => p.status === 'pending' || (p.status.includes('audit') && p.status !== 'admin_audit')).length || 0, color: 'from-blue-500/20 to-cyan-500/20', textColor: 'text-cyan-400', icon: Clock, glow: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]' },
              { label: 'Compliance Audit', count: payments?.filter(p => p.status === 'admin_audit').length || 0, color: 'from-amber-500/20 to-orange-500/20', textColor: 'text-amber-400', icon: ShieldCheck, glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]' },
              { label: 'CEO Review', count: payments?.filter(p => p.status === 'ceo_audit').length || 0, color: 'from-purple-500/20 to-pink-500/20', textColor: 'text-purple-400', icon: Zap, glow: 'shadow-[0_0_20px_rgba(168,85,247,0.15)]' },
              { label: 'Total Approved', count: payments?.filter(p => p.status === 'ceo_approved').length || 0, color: 'from-emerald-500/20 to-teal-500/20', textColor: 'text-emerald-400', icon: CheckCircle, glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]' },
              { label: 'Paid Success', count: payments?.filter(p => p.status === 'paid').length || 0, color: 'from-primary/20 to-blue-600/20', textColor: 'text-primary', icon: Banknote, glow: 'shadow-[0_0_20px_rgba(var(--primary),0.15)]' },
              { label: 'Rejected', count: payments?.filter(p => p.status === 'rejected').length || 0, color: 'from-red-500/20 to-rose-600/20', textColor: 'text-rose-400', icon: XCircle, glow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]' },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    "relative overflow-hidden group p-2 sm:p-2.5 rounded-lg border border-white/5 backdrop-blur-xl bg-gradient-to-br transition-all duration-300 hover:scale-[1.02] hover:border-white/10",
                    stat.color,
                    stat.glow
                  )}
                >
                  <div className="absolute top-0 right-0 p-2 opacity-15 group-hover:opacity-30 transition-opacity">
                    <Icon className={cn("w-7 h-7 grayscale", stat.textColor)} />
                  </div>
                  <div className="relative z-10 flex flex-col gap-0.5">
                    <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-[0.2em] text-white/40 leading-tight">{stat.label}</span>
                    <span className={cn("text-lg sm:text-xl font-black font-mono tracking-tighter", stat.textColor)}>
                      {stat.count}
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5 group-hover:bg-white/10 transition-colors" />
                </motion.div>
              );
            })}
          </div>

          {/* Glassmorphism Filter Bar */}
          <div className="relative p-1 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-3xl shadow-2xl">
            <div className="flex flex-wrap items-center gap-4 p-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-white/40">
                <ListFilter className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Discovery</span>
              </div>

              <div className="relative flex-1 min-w-[300px] group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Universal search by purpose, vendor, profile or PAY-ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 bg-black/40 border-white/10 text-sm focus-visible:ring-primary/20 hover:border-white/20 transition-all rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] h-12 bg-black/40 border-white/10 text-xs font-bold rounded-xl hover:border-white/20">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <SelectValue placeholder="All Status" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900/95 backdrop-blur-xl border-white/10">
                    <SelectItem value="all">Global Workspace</SelectItem>
                    <SelectItem value="pending">Initial Requests</SelectItem>
                    <SelectItem value="smo_audit">Operations Audit</SelectItem>
                    <SelectItem value="gmo_audit">Management Audit</SelectItem>
                    <SelectItem value="admin_audit">Compliance Gate</SelectItem>
                    <SelectItem value="ceo_audit">CEO Final Audit</SelectItem>
                    <SelectItem value="ceo_hold">Financial Hold</SelectItem>
                    <SelectItem value="rejected">Rejected Vault</SelectItem>
                    <SelectItem value="paid">Executed Payments</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                  <SelectTrigger className="w-[140px] h-12 bg-black/40 border-white/10 text-xs font-bold rounded-xl hover:border-white/20">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900/95 backdrop-blur-xl border-white/10">
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="normal">Standard</SelectItem>
                    <SelectItem value="important">High Priority</SelectItem>
                    <SelectItem value="emergency">Emergency / SOS</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-[160px] h-12 bg-black/40 border-white/10 text-xs font-bold rounded-xl hover:border-white/20">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900/95 backdrop-blur-xl border-white/10">
                    <SelectItem value="all">Global Depts</SelectItem>
                    <SelectItem value="engineering">Engineering</SelectItem>
                    <SelectItem value="agri">Agriculture</SelectItem>
                    <SelectItem value="agri_mart">Agri Mart</SelectItem>
                    <SelectItem value="others">Cross-Functional</SelectItem>
                  </SelectContent>
                </Select>

                {(statusFilter !== 'all' || urgencyFilter !== 'all' || departmentFilter !== 'all' || searchQuery !== '') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-all rounded-xl"
                    onClick={() => {
                      setStatusFilter('all');
                      setUrgencyFilter('all');
                      setDepartmentFilter('all');
                      setSearchQuery('');
                    }}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Payments List */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 font-sans">
                {filteredPayments.map((payment, index) => (
                  <motion.div
                    key={payment.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <PaymentRegistryCard
                      payment={payment as any}
                      onViewDetails={() => handleViewPayment(payment.id)}
                      onDelete={() => setDeletingPayment(payment as any)}
                      onResubmit={handleResubmit}
                      role="admin"
                    />
                  </motion.div>
                ))}
              </div>

              {filteredPayments.length === 0 && (
                <div className="authority-card text-center py-12">
                  <Banknote className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-semibold">No Payments Found</p>
                  <p className="text-muted-foreground">No payment requests match your filters</p>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Reversed Payments Tab */}
        <TabsContent value="reversed" className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-500" />
                Reversed Payments
              </h2>
              <p className="text-sm text-muted-foreground">
                Payments returned by Accounts for bank details correction
              </p>
            </div>
            {reversedPayments && reversedPayments.length > 0 && (
              <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30" variant="outline">
                {reversedPayments.length} Pending Correction
              </Badge>
            )}
          </div>

          {isLoadingReversed ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : reversedPayments && reversedPayments.length > 0 ? (
            <div className="space-y-4">
              {reversedPayments.map((payment: any) => (
                <Card key={payment.id} className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-lg">{payment.vendor_name}</h3>
                          <Badge variant="outline" className="text-xs">
                            #{payment.payment_number}
                          </Badge>
                          <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30" variant="outline">
                            Needs Correction
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{payment.purpose}</p>

                        {/* Reversal Reason */}
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 mb-4">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-destructive">Reversal Reason from Accounts:</p>
                              <p className="text-sm text-muted-foreground mt-1">{payment.accounts_reversal_reason}</p>
                            </div>
                          </div>
                        </div>

                        {/* Current Bank Details */}
                        <div className="grid md:grid-cols-3 gap-4 p-3 rounded-lg bg-muted/30 border">
                          <div>
                            <p className="text-xs text-muted-foreground">Beneficiary Name</p>
                            <p className="font-medium text-sm">{payment.beneficiary_name || payment.vendor_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Account Number</p>
                            <p className="font-mono text-sm">{payment.vendor_account_number || 'Not Provided'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">IFSC Code</p>
                            <p className="font-mono text-sm">{payment.vendor_ifsc_code || 'Not Provided'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-2xl font-bold text-primary">₹{Number(payment.amount).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {payment.profiles?.name} • {payment.profiles?.department}
                        </p>
                        <Button
                          className="mt-4 gap-2"
                          onClick={() => handleEditReversedPayment(payment)}
                        >
                          <Edit className="w-4 h-4" /> Edit & Resubmit
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="authority-card text-center py-12">
              <CheckCircle className="w-12 h-12 text-status-live mx-auto mb-4" />
              <p className="text-lg font-semibold">No Reversed Payments</p>
              <p className="text-muted-foreground">All payments have correct bank details</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingPayment} onOpenChange={(open) => !open && setDeletingPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete Payment Request
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this payment request? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingPayment && (
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="font-medium">{deletingPayment.purpose}</p>
              <p className="text-sm text-muted-foreground">
                ₹{Number(deletingPayment.amount).toLocaleString()} • {deletingPayment.vendor_name}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingPayment(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingPayment && deleteMutation.mutate(deletingPayment.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Payment Details Modal */}
      <PaymentDetailsModal
        payment={viewingPayment}
        open={!!viewingPayment}
        onOpenChange={(open) => !open && setViewingPayment(null)}
      />

      {/* Edit Reversed Payment Dialog */}
      <Dialog open={!!editingReversedPayment} onOpenChange={(open) => !open && setEditingReversedPayment(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-amber-500" />
              Correct Bank Details & Resubmit
            </DialogTitle>
            <DialogDescription>
              Update the bank details and resubmit for CEO approval.
            </DialogDescription>
          </DialogHeader>

          {editingReversedPayment && (
            <div className="space-y-4">
              {/* Reversal Reason */}
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <p className="text-xs font-medium text-destructive mb-1">Accounts Feedback:</p>
                <p className="text-sm">{editingReversedPayment.accounts_reversal_reason}</p>
              </div>

              {/* Payment Info */}
              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="font-medium">{editingReversedPayment.vendor_name}</p>
                <p className="text-sm text-muted-foreground">{editingReversedPayment.purpose}</p>
                <p className="text-lg font-bold text-primary mt-2">₹{Number(editingReversedPayment.amount).toLocaleString()}</p>
              </div>

              {/* Editable Bank Fields */}
              {!editingReversedPayment.is_split_payment && !editingReversedPayment.is_transport_payment ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="beneficiary_name">Beneficiary Name</Label>
                    <Input
                      id="beneficiary_name"
                      value={editFormData.beneficiary_name}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, beneficiary_name: e.target.value }))}
                      placeholder="Account holder name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vendor_account_number">Account Number</Label>
                    <Input
                      id="vendor_account_number"
                      value={editFormData.vendor_account_number}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, vendor_account_number: e.target.value }))}
                      placeholder="Bank account number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vendor_ifsc_code">IFSC Code</Label>
                    <Input
                      id="vendor_ifsc_code"
                      value={editFormData.vendor_ifsc_code}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, vendor_ifsc_code: e.target.value.toUpperCase() }))}
                      placeholder="e.g., SBIN0001234"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 pb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <ListFilter className="w-3 h-3" /> Multi-Payee Bank Details Correction
                  </p>
                  {editSplits.map((split, index) => (
                    <div key={split.id} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                          Payee {index + 1}: {split.payee_name || split.beneficiary_name}
                        </Badge>
                        <span className="text-sm font-bold text-primary">₹{Number(split.amount).toLocaleString()}</span>
                      </div>
                      
                      <div className="grid gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Beneficiary Name</Label>
                          <Input
                            value={split.beneficiary_name || ''}
                            onChange={(e) => handleUpdateSplit(split.id, 'beneficiary_name', e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Account Number</Label>
                            <Input
                              value={split.account_number || ''}
                              onChange={(e) => handleUpdateSplit(split.id, 'account_number', e.target.value)}
                              className="h-9 text-sm font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">IFSC Code</Label>
                            <Input
                              value={split.ifsc_code || ''}
                              onChange={(e) => handleUpdateSplit(split.id, 'ifsc_code', e.target.value.toUpperCase())}
                              className="h-9 text-sm font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <Label htmlFor="admin_notes">Correction Notes</Label>
                <Textarea
                  id="admin_notes"
                  value={editFormData.admin_notes}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, admin_notes: e.target.value }))}
                  placeholder="Describe what was corrected..."
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingReversedPayment(null)}>
              Cancel
            </Button>
            <Button
              className="gap-2"
              onClick={() => editingReversedPayment && resubmitMutation.mutate({
                paymentId: editingReversedPayment.id,
                bankDetails: {
                  vendor_account_number: editFormData.vendor_account_number,
                  vendor_ifsc_code: editFormData.vendor_ifsc_code,
                  beneficiary_name: editFormData.beneficiary_name
                },
                splits: editSplits,
                notes: editFormData.admin_notes,
                isTransport: editingReversedPayment?.is_transport_payment,
                transportTrips: editingReversedPayment?.transport_trips
              })}
              disabled={
                resubmitMutation.isPending || 
                (!editingReversedPayment?.is_split_payment && !editingReversedPayment?.is_transport_payment && (!editFormData.vendor_account_number || !editFormData.vendor_ifsc_code)) ||
                ((editingReversedPayment?.is_split_payment || editingReversedPayment?.is_transport_payment) && editSplits.some(s => !s.account_number || !s.ifsc_code))
              }
            >
              {resubmitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Resubmit to CEO
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div >
  );
}

