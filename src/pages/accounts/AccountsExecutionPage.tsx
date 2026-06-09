import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Banknote, Check, Download, Clock, Layers, FileSpreadsheet,
  Upload, AlertTriangle, Wallet, Receipt, Calendar as CalendarIcon,
  CheckCircle2, XCircle, FileCheck, Trash2, Eye, Send, Image, Loader2, X, Info, FileText,
  CreditCard, Building2, ArrowRight, ChevronDown, ChevronUp, RefreshCcw, History as HistoryIcon, User,
  Edit2, Plus, Search, Landmark, Save, ClipboardCheck, Users
} from 'lucide-react';
import { PaymentVerificationCard } from '@/components/accounts/PaymentVerificationCard';
import { AuditHistoryWidget } from '@/components/payment/AuditHistoryWidget';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label'; // Added Label import
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { useBatchOperations } from '@/hooks/useBatchOperations';
import { useRealtimePayments } from '@/hooks/useRealtimePayments';
import { usePayees, type Payee } from '@/hooks/usePayees';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay } from 'date-fns';
import { isPaymentValid } from '@/utils/paymentValidation';
import type { MatchResult } from '@/lib/kotakBankExport';
import { usePettyCash } from '@/hooks/usePettyCash';
import { usePettyCashReports } from '@/hooks/usePettyCashReports';
import { BatchToDirectConversionDialog } from '@/components/payments/BatchToDirectConversionDialog';
import { BatchToPettyCashConversionDialog } from '@/components/payments/BatchToPettyCashConversionDialog';
import { PaymentExportDialog } from '@/components/payments/PaymentExportDialog';
import { PaymentProofUpload } from '@/components/payments/PaymentProofUpload';
import { RentalPaymentsSubTab } from '@/components/rentals/RentalPaymentsSubTab';
import { ReconciliationTab } from '@/components/accounts/ReconciliationTab';
import { useQuery } from '@tanstack/react-query';

const loadKotakBankExport = () => import('@/lib/kotakBankExport');
const loadExpenseSheetExport = () => import('@/lib/expenseSheetExport');
const loadExportUtils = () => import('@/lib/exportUtils');

export function AccountsExecutionPage() {
  const [activeTab, setActiveTab] = useState('batch-creation');
  const requiresPaidStatus = activeTab === 'direct-payments'
    || activeTab === 'petty-cash'
    || activeTab === 'reconciliation'
    || activeTab === 'history';
  const fetchStatuses = useMemo(() => {
    const baseStatuses = ['ceo_approved', 'admin_approved', 'bulk_prepared', 'gm_hold'];
    return requiresPaidStatus ? [...baseStatuses, 'paid'] : baseStatuses;
  }, [requiresPaidStatus]);
  const { requests, isLoading, refresh: refetch } = useRealtimePayments(fetchStatuses);
  const { updateStatus, reverseToAdmin, rejectPayment } = usePaymentRequests({ skipFetch: true }); // For actions
  const { createBatch, useBatches, updateBatchStatus, deleteBatch, sendBatchToAdmin, updateBatchPayments } = useBatchOperations();
  const { payees, addPayee, updatePayee, deletePayee, isLoading: payeesLoading } = usePayees();

  // Payee Master State
  const [payeeSearch, setPayeeSearch] = useState('');
  const [isPayeeDialogOpen, setIsPayeeDialogOpen] = useState(false);
  const [editingPayee, setEditingPayee] = useState<Payee | null>(null);
  const [newPayee, setNewPayee] = useState({ name: '', bank_name: '', account_number: '', ifsc_code: '' });
  const { data: batches, refetch: refetchBatches } = useBatches();
  const navigate = useNavigate();
  const { addEntry: addPettyCashEntry, addLedgerEntry, getCurrentBalance, getCumulativeSpend } = usePettyCash();
  const { reports: auditReports, refillRequests } = usePettyCashReports();
  const { user } = useAuth();

  // Rental pending count for tab badge
  const { data: rentalPendingCount } = useQuery({
    queryKey: ['accounts-rental-records', 'pending-count'],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from('rental_monthly_records')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'APPROVED_BY_CEO');
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Real-time sync for accounts dashboard
  // Refetch batches when payments change
  useEffect(() => {
    refetchBatches();
  }, [requests]);


  // State
  const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set());
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());

  // Confirmation dialogs
  const [confirmProcessedBatch, setConfirmProcessedBatch] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(1);
  const [confirmDeleteBatch, setConfirmDeleteBatch] = useState<string | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(1);

  // Petty cash metrics
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [cumulativeSpend, setCumulativeSpend] = useState<number>(0);

  const refreshPettyCashMetrics = async () => {
    const [balance, spend] = await Promise.all([
      getCurrentBalance(),
      getCumulativeSpend()
    ]);
    setCurrentBalance(balance);
    setCumulativeSpend(spend);
  };

  useEffect(() => {
    refreshPettyCashMetrics();
  }, []);

  // Petty cash two-step confirmation
  const [confirmPettyCashExec, setConfirmPettyCashExec] = useState<string | null>(null);
  const [pettyCashConfirmStep, setPettyCashConfirmStep] = useState(1);

  // Draft batch editing
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);

  // Batch to Direct Conversion
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [conversionDialog, setConversionDialog] = useState<{
    open: boolean;
    payment: any;
    batchId: string;
    batchReference: string;
  } | null>(null);

  const [pettyCashConversionDialog, setPettyCashConversionDialog] = useState<{
    open: boolean;
    payment: any;
    batchId: string;
    batchReference: string;
  } | null>(null);

  // Export Dialog
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Expense sheet date range
  const [expenseStartDate, setExpenseStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expenseEndDate, setExpenseEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Petty cash execution
  const [pettyCashProofFiles, setPettyCashProofFiles] = useState<Record<string, File | null>>({});
  const [pettyCashProofUrls, setPettyCashProofUrls] = useState<Record<string, string>>({});
  const [uploadingProof, setUploadingProof] = useState<string | null>(null);
  const proofInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Direct Payment Execution
  const [directPaymentUTRs, setDirectPaymentUTRs] = useState<Record<string, string>>({});
  const [directPaymentProofOpen, setDirectPaymentProofOpen] = useState<string | null>(null);
  const [directPaymentProofUrls, setDirectPaymentProofUrls] = useState<Record<string, string>>({});

  // NEW: Split UTR Tracking
  const [splitUTRs, setSplitUTRs] = useState<Record<string, Record<string, string>>>({});
  const [expandedSplitPayments, setExpandedSplitPayments] = useState<Set<string>>(new Set());

  // GM Actions State
  const [activeGMAction, setActiveGMAction] = useState<{ id: string, type: 'hold' | 'reverse' } | null>(null);
  const [gmActionReason, setGMActionReason] = useState('');

  // Filtered payments
  const processedPayments = requests.filter(p => 
    p.status === 'ceo_approved' || 
    p.status === 'gm_hold' ||
    (p.status === 'admin_approved' && (p.is_transport_payment || p.tags?.includes('transport')))
  );
  const paidPayments = requests.filter(p => p.status === 'paid');

  // Regular payments for batching (CEO approved or GM hold, NOT petty cash, NOT already batched, NOT tagged as direct)
  const unbatchedPayments = processedPayments.filter(p =>
    !p.bulk_batch_id &&
    p.is_petty_cash !== true &&
    !p.tags?.includes('direct_payment')
  );

  // Direct payments (CEO approved or GM hold, NOT petty cash, NOT in batch, TAGGED as direct)
  const directPayments = processedPayments.filter(p =>
    !p.bulk_batch_id &&
    p.is_petty_cash !== true &&
    p.tags?.includes('direct_payment')
  );

  // Petty cash payments (CEO approved or GM hold with petty cash flag, NOT batched)
  // Filtering for "Today onwards" to respect the clean start request
  const pettyCashPayments = processedPayments.filter(p =>
    p.is_petty_cash === true &&
    !p.bulk_batch_id
  );


  // Completed direct payments (Paid status, tagged as direct, not petty cash)
  const completedDirectPayments = paidPayments.filter(p =>
    p.is_petty_cash !== true &&
    p.tags?.includes('direct_payment')
  );

  // Regular paid payments for UTR matching (NOT petty cash - those are UPI/GPay)
  const regularPaidPayments = paidPayments.filter(p => p.is_petty_cash !== true);
  // Completed petty cash payments (Filter for today onwards)
  const completedPettyCash = paidPayments.filter(p =>
    p.is_petty_cash === true
  );

  // Batch filtering
  const filteredPayees = payees.filter(p =>
    p.name.toLowerCase().includes(payeeSearch.toLowerCase()) ||
    p.account_number?.toLowerCase().includes(payeeSearch.toLowerCase()) ||
    p.bank_name?.toLowerCase().includes(payeeSearch.toLowerCase())
  );

  const handleSavePayee = async () => {
    if (!newPayee.name || !newPayee.account_number || !newPayee.ifsc_code) {
      toast.error('Please fill required fields');
      return;
    }

    if (editingPayee) {
      await updatePayee(editingPayee.id, newPayee);
      toast.success('Payee updated successfully');
    } else {
      await addPayee(newPayee);
      toast.success('Payee added to master');
    }

    setIsPayeeDialogOpen(false);
    setNewPayee({ name: '', bank_name: '', account_number: '', ifsc_code: '' });
    setEditingPayee(null);
  };

  const openEditPayee = (payee: Payee) => {
    setEditingPayee(payee);
    setNewPayee({
      name: payee.name,
      bank_name: payee.bank_name || '',
      account_number: payee.account_number || '',
      ifsc_code: payee.ifsc_code || ''
    });
    setIsPayeeDialogOpen(true);
  };

  // Handle inline bank details edit from PaymentVerificationCard
  const handleEditBankDetails = async (paymentId: string, data: {
    vendorAccountNumber: string;
    vendorIfscCode: string;
    vendorUpi: string;
    beneficiaryName: string;
    paymentType: string;
  }) => {
    try {
      const payment = requests.find(r => r.id === paymentId);
      const currentTimeline = (payment?.audit_timeline || []) as any[];
      const updateData: any = {
        vendor_account_number: data.vendorAccountNumber || null,
        vendor_ifsc_code: data.vendorIfscCode || null,
        vendor_upi: data.vendorUpi || null,
        beneficiary_name: data.beneficiaryName || null,
        payment_type: data.paymentType || 'bank_transfer',
        audit_timeline: [...currentTimeline, {
          action: 'bank_details_edited',
          by: user?.name || 'Accounts',
          role: 'accounts',
          timestamp: new Date().toISOString(),
          details: `Bank details updated by ${user?.name || 'Accounts'}`
        }]
      };

      const { error } = await (supabase
        .from('payment_requests') as any)
        .update(updateData)
        .eq('id', paymentId);

      if (error) throw error;
      toast.success('Bank details updated successfully');
      refetch();
    } catch (error) {
      console.error('Error updating bank details:', error);
      toast.error('Failed to update bank details');
    }
  };
  const draftBatches = batches?.filter((b: any) => b.status === 'draft') || [];
  const pendingBatches = batches?.filter((b: any) => b.status === 'pending_verification') || [];
  // Include 'converted' status here to recover batches that were hidden by the bug
  const verifiedBatches = batches?.filter((b: any) => b.status === 'verified' || b.status === 'converted') || [];

  const toggleBatchSelection = (id: string) => {
    setSelectedForBatch(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const startBatchCreation = async () => {
    if (selectedForBatch.size === 0) return;
    try {
      await createBatch.mutateAsync({ paymentIds: Array.from(selectedForBatch) });
      setSelectedForBatch(new Set());
      refetch();
      refetchBatches();
    } catch (err) {
      console.error(err);
    }
  };

  // Download Bank File
  const handleDownloadBankFile = async (batchId: string, batchReference: string) => {
    try {
      // Fetch payments for this batch
      const { data: paymentsData, error } = await (supabase as any)
        .from('payment_requests')
        .select('id, amount, beneficiary_name, vendor_name, vendor_account_number, vendor_ifsc_code, vendor_upi, purpose, payment_number, is_split_payment, is_transport_payment, transport_trips, payment_type')
        .eq('bulk_batch_id', batchId);

      if (error) throw error;
      if (!paymentsData || (paymentsData as any[]).length === 0) {
        toast.error('No payments found for this batch');
        return;
      }

      const payments = [...(paymentsData as any[])];

      // Fetch associated splits for split payments in this batch
      // Fetch associated splits for split payments or multi-vendor transport payments in this batch
      const splitPaymentIds = payments.filter(p => 
        p.is_split_payment || 
        (p.is_transport_payment && (p.vendor_name === 'Multiple Vendors' || p.vendor_name === 'Split Payment Batch'))
      ).map(p => p.id);
      if (splitPaymentIds.length > 0) {
        const { data: splitsData, error: splitsError } = await (supabase as any)
          .from('split_payments')
          .select('*')
          .in('parent_payment_id', splitPaymentIds)
          .order('split_number', { ascending: true });

        if (!splitsError && splitsData) {
          payments.forEach(p => {
            if (p.is_split_payment || (p.is_transport_payment && (p.vendor_name === 'Multiple Vendors' || p.vendor_name === 'Split Payment Batch'))) {
              (p as any).splits = splitsData.filter((s: any) => s.parent_payment_id === p.id);
            }
          });
        }
      }

      const evaluatedPayments = payments.map((p: any) => ({
        payment: p,
        validation: isPaymentValid(p, payees || []),
      }));

      const invalidPayments = evaluatedPayments.filter(item => !item.validation.isValid);
      const validPayments = evaluatedPayments.filter(item => item.validation.isValid).map(item => item.payment);

      if (validPayments.length === 0) {
        const invalidPreview = invalidPayments
          .slice(0, 2)
          .map(item => `${item.payment.payment_number || item.payment.id?.slice(0, 8) || 'UNKNOWN'} (${item.validation.error || 'Missing bank details'})`)
          .join(', ');
        toast.error(`Cannot generate bank file. No valid payments in batch. ${invalidPreview ? `Fix: ${invalidPreview}` : ''}`);
        return;
      }

      if (invalidPayments.length > 0) {
        const invalidPreview = invalidPayments
          .slice(0, 3)
          .map(item => item.payment.payment_number || item.payment.id?.slice(0, 8) || 'UNKNOWN')
          .join(', ');
        toast.warning(`Generated file for ${validPayments.length} valid payment(s). Skipped ${invalidPayments.length} invalid payment(s): ${invalidPreview}`);
      }

      const { generateKotakBulkFile } = await loadKotakBankExport();
      generateKotakBulkFile(validPayments as any, batchReference);
      toast.success('Kotak bank file downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate bank file');
    }
  };

  const handleUpdateBatchStatus = async (batchId: string, status: 'verified' | 'rejected') => {
    try {
      await updateBatchStatus.mutateAsync({ batchId, status });
      toast.success(`Batch ${status === 'verified' ? 'verified' : 'rejected'} successfully`);
      refetchBatches();
    } catch (error) {
      toast.error(`Failed to ${status} batch`);
    }
  };

  // Double confirmation for Mark Processed
  const handleMarkProcessed = (batchId: string) => {
    setConfirmProcessedBatch(batchId);
    setConfirmStep(1);
  };

  const confirmMarkProcessed = async () => {
    if (confirmStep === 1) {
      setConfirmStep(2);
      return;
    }

    if (confirmProcessedBatch) {
      await updateBatchStatus.mutateAsync({ batchId: confirmProcessedBatch, status: 'processed' });
      setConfirmProcessedBatch(null);
      setConfirmStep(1);
      refetchBatches();
      refetch(); // Explicitly refetch payments to update UTR matching list
    }
  };

  // Delete batch handler
  const handleDeleteBatch = async () => {
    if (deleteConfirmStep === 1) {
      setDeleteConfirmStep(2);
      return;
    }
    if (confirmDeleteBatch) {
      await deleteBatch.mutateAsync({ batchId: confirmDeleteBatch });
      setConfirmDeleteBatch(null);
      setDeleteConfirmStep(1);
      refetchBatches();
      refetch();
    }
  };

  // Petty Cash Execution with two-step confirmation
  const handlePettyCashExecute = (paymentId: string) => {
    const proofUrl = pettyCashProofUrls[paymentId];
    if (!proofUrl) {
      toast.error('Please upload payment screenshot');
      return;
    }
    setConfirmPettyCashExec(paymentId);
    setPettyCashConfirmStep(1);
  };

  const confirmPettyCashExecute = async () => {
    if (pettyCashConfirmStep === 1) {
      setPettyCashConfirmStep(2);
      return;
    }
    if (confirmPettyCashExec) {
      await executePettyCash(confirmPettyCashExec);
      setConfirmPettyCashExec(null);
      setPettyCashConfirmStep(1);
    }
  };

  // Send draft batch to Admin
  const handleSendToAdmin = async (batchId: string) => {
    await sendBatchToAdmin.mutateAsync({ batchId });
    refetchBatches();
  };

  const handleBulkMoveToDirect = async () => {
    if (selectedForBatch.size === 0) return;

    let successCount = 0;
    for (const id of Array.from(selectedForBatch)) {
      const payment = requests.find(p => p.id === id);
      if (payment) {
        const currentTags = payment.tags || [];
        const result = await updateStatus(payment.id, payment.status, {
          tags: [...currentTags.filter(t => t !== 'direct_payment'), 'direct_payment'],
          isPettyCash: false
        });
        if (result.success) successCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Moved ${successCount} payments to Direct Execution`);
      setSelectedForBatch(new Set());
      refetch();
    }
  };

  // Triage Handlers
  const handleMoveToDirect = async (payment: any) => {
    const currentTags = payment.tags || [];
    if (!currentTags.includes('direct_payment')) {
      await updateStatus(payment.id, payment.status, {
        tags: [...currentTags, 'direct_payment'],
        isPettyCash: false
      });
      toast.success('Moved to Direct Payments');
    }
  };

  const handleMoveToBatch = async (payment: any) => {
    const currentTags = payment.tags || [];
    const newTags = currentTags.filter((t: string) => t !== 'direct_payment');
    await updateStatus(payment.id, payment.status, {
      tags: newTags,
      isPettyCash: false
    });
    toast.success('Moved to Batch Creation');
  };

  const handleMoveToPettyCash = async (payment: any) => {
    const currentTags = payment.tags || [];
    const newTags = currentTags.filter((t: string) => t !== 'direct_payment');
    await updateStatus(payment.id, payment.status, {
      tags: newTags,
      isPettyCash: true
    });
    toast.success('Moved to Petty Cash');
  };



  // Petty Cash Execution
  const executePettyCash = async (paymentId: string) => {
    const proofUrl = pettyCashProofUrls[paymentId];
    if (!proofUrl) {
      toast.error('Please upload payment screenshot');
      return;
    }

    // Find the payment to get details for the expense sheet
    const payment = pettyCashPayments.find(p => p.id === paymentId);

    const result = await updateStatus(paymentId, 'paid', { paymentProofUrl: proofUrl });
    if (result.success) {
      // Add entry to daily expense sheet for petty cash tracking
      if (payment) {
        // 1. Add to daily expense sheet for simple reporting
        await addPettyCashEntry({
          paymentRequestId: payment.id,
          vendorName: payment.vendor_name,
          amount: Number(payment.amount),
          department: payment.department || 'Others',
          category: payment.is_petty_cash ? 'Petty Cash' : 'General'
        });

        // 2. Add to transactional ledger for balance tracking and refill triggers
        await addLedgerEntry({
          paymentRequestId: payment.id,
          vendorName: payment.vendor_name,
          amount: Number(payment.amount),
          department: payment.department || 'Others',
          purpose: payment.purpose
        });
      }

      toast.success('Petty cash payment executed');
      setPettyCashProofUrls(prev => {
        const newState = { ...prev };
        delete newState[paymentId];
        return newState;
      });
      setPettyCashProofFiles(prev => {
        const newState = { ...prev };
        delete newState[paymentId];
        return newState;
      });
      refreshPettyCashMetrics();
      refetch();
    }
  };

  // Export Daily Expense Sheet
  const handleExportExpenseSheet = async () => {
    const startDate = startOfDay(new Date(expenseStartDate));
    const endDate = endOfDay(new Date(expenseEndDate));

    // Fetch all paid payments in date range (EXCLUDING petty cash)
    const { data: payments, error } = await supabase
      .from('payment_requests')
      .select('*, requester:profiles!payment_requests_requester_id_fkey(name, department)')
      .eq('status', 'paid')
      .eq('is_petty_cash', false)
      .gte('paid_at', startDate.toISOString())
      .lte('paid_at', endDate.toISOString());

    if (error) {
      if (!isMissingTable(error)) toast.error('Failed to fetch payments');
      return;
    }

    // Fetch associated splits for these payments
    const paymentIds = payments.map(p => p.id);
    const { data: splits } = await supabase
      .from('split_payments')
      .select('*')
      .in('parent_payment_id', paymentIds);

    // Map splits to payments
    if (splits) {
      payments.forEach((p: any) => {
        p.splits = splits.filter(s => s.parent_payment_id === p.id);
      });
    }

    // Fetch approver names
    const approverIds = new Set<string>();
    payments?.forEach((p: any) => {
      ['smo_approved_by', 'gm_approved_by', 'director_approved_by', 'admin_approved_by', 'ceo_approved_by', 'accounts_executed_by'].forEach(field => {
        if (p[field]) approverIds.add(p[field]);
      });
    });

    const { data: approvers } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', Array.from(approverIds));

    const approverNames: Record<string, string> = {};
    approvers?.forEach((a: any) => {
      approverNames[a.id] = a.name;
    });

    const { exportDailyExpenseSheet } = await loadExpenseSheetExport();
    exportDailyExpenseSheet(payments as any, { start: startDate, end: endDate }, approverNames);
    toast.success('Daily expense sheet exported');
  };

  // Export Petty Cash Sheet
  const handleExportPettyCash = async () => {
    const startDate = startOfDay(new Date(expenseStartDate));
    const endDate = endOfDay(new Date(expenseEndDate));

    const { data: payments, error } = await supabase
      .from('payment_requests')
      .select('*, requester:profiles!payment_requests_requester_id_fkey(name, department)')
      .eq('is_petty_cash', true)
      .eq('status', 'paid')
      .gte('paid_at', startDate.toISOString())
      .lte('paid_at', endDate.toISOString());

    if (error) {
      if (!isMissingTable(error)) toast.error('Failed to fetch petty cash');
      return;
    }

    // Fetch associated splits for these payments
    const paymentIds = payments.map(p => p.id);
    const { data: splits } = await supabase
      .from('split_payments')
      .select('*')
      .in('parent_payment_id', paymentIds);

    // Map splits to payments
    if (splits) {
      payments.forEach((p: any) => {
        p.splits = splits.filter(s => s.parent_payment_id === p.id);
      });
    }

    const approverIds = new Set<string>();
    payments?.forEach((p: any) => {
      if (p.admin_approved_by) approverIds.add(p.admin_approved_by);
      if (p.accounts_executed_by) approverIds.add(p.accounts_executed_by);
    });

    const { data: approvers } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', Array.from(approverIds));

    const approverNames: Record<string, string> = {};
    approvers?.forEach((a: any) => {
      approverNames[a.id] = a.name;
    });

    const { exportPettyCashSheet } = await loadExpenseSheetExport();
    exportPettyCashSheet(payments as any, { start: startDate, end: endDate }, approverNames);
    toast.success('Petty cash report exported');
  };

  const handleGenerateVoucher = async (payment: any) => {
    try {
      const { generateVoucher } = await loadExportUtils();
      generateVoucher(payment);
    } catch (error) {
      console.error('Voucher generation failed:', error);
      toast.error('Failed to generate voucher');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="dashboard-header flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-authority-accounts/30 to-authority-accounts/10 flex items-center justify-center shadow-lg">
            <Banknote className="w-8 h-8 text-authority-accounts" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Execution Desk</h1>
            <p className="text-muted-foreground mt-1">Batching, Execution & Reconciliation</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExportDialogOpen(true)}
          className="gap-2 shrink-0"
        >
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="relative w-full">
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
          <TabsList className="flex w-full justify-start overflow-x-auto flex-nowrap h-auto gap-1 p-1.5 rounded-xl border border-border/50 bg-muted/40 backdrop-blur-sm" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <style>{`.flex.overflow-x-auto::-webkit-scrollbar { display: none; }`}</style>
            <TabsTrigger value="batch-creation" className="gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Layers className="w-3.5 h-3.5" /> Batch Creation <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-bold">{unbatchedPayments.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="batch-processing" className="gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Batch Processing
            </TabsTrigger>
            <TabsTrigger value="direct-payments" className="gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <ArrowRight className="w-3.5 h-3.5" /> Direct Payments <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-bold">{directPayments.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="petty-cash" className="gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Landmark className="w-3.5 h-3.5" /> Petty Cash <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-bold">{pettyCashPayments.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="rental-payments" className="gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <CreditCard className="w-3.5 h-3.5" /> Rental Payments <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-bold">{rentalPendingCount ?? 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="payee-master" className="gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Building2 className="w-3.5 h-3.5" /> Payee Master
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <FileCheck className="w-3.5 h-3.5" /> UTR Matching
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Receipt className="w-3.5 h-3.5" /> Reports
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <HistoryIcon className="w-3.5 h-3.5" /> History
            </TabsTrigger>
          </TabsList>
        </div>

        {/* --- BATCH CREATION TAB --- */}
        <TabsContent value="batch-creation" className="mt-6 space-y-4">
          <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border border-border">
            <div>
              <h3 className="font-bold text-lg">Unbatched Payments</h3>
              <p className="text-sm text-muted-foreground">Select payments to group into a single bank batch.</p>
            </div>
            <div className="flex items-center gap-4">
              {selectedForBatch.size > 0 && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground font-semibold uppercase">Selected Total</p>
                  <p className="font-bold text-xl text-primary">
                    ₹{unbatchedPayments.filter(p => selectedForBatch.has(p.id)).reduce((sum, p) => sum + Number(p.amount), 0).toLocaleString()}
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleBulkMoveToDirect}
                  disabled={createBatch.isPending || selectedForBatch.size === 0}
                  className="border-primary/30 text-primary hover:bg-primary/5"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Move to Direct ({selectedForBatch.size})
                </Button>
                <Button
                  onClick={startBatchCreation}
                  disabled={createBatch.isPending || selectedForBatch.size === 0}
                  className="bg-primary hover:bg-primary/90"
                >
                  {createBatch.isPending ? 'Creating...' : `Create Batch(${selectedForBatch.size})`}
                </Button>
              </div>
            </div>
          </div>

          {/* Validation Summary */}
          {unbatchedPayments.length > 0 && (
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <Card className="bg-green-500/10 border-green-500/30">
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold text-green-500">
                      {unbatchedPayments.filter(p => isPaymentValid(p, payees).isValid).length}
                    </p>
                    <p className="text-xs text-muted-foreground">Ready for Batch</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-destructive/10 border-destructive/30">
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                  <div>
                    <p className="text-2xl font-bold text-destructive">
                      {unbatchedPayments.filter(p => !isPaymentValid(p, payees).isValid).length}
                    </p>
                    <p className="text-xs text-muted-foreground">Missing Bank/UPI Details</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-primary/10 border-primary/30">
                <CardContent className="p-4 flex items-center gap-3">
                  <CreditCard className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold text-primary">
                      ₹{unbatchedPayments.reduce((sum, p) => sum + Number(p.amount), 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Pending</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="space-y-3">
            {unbatchedPayments.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">No unbatched payments available.</p>
              </div>
            ) : (
              unbatchedPayments.map(payment => (
                <div key={payment.id} className="group relative">
                  <div className="absolute right-4 top-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMoveToDirect(payment)}
                      className="h-8 bg-background shadow-sm"
                    >
                      <ArrowRight className="w-3 h-3 mr-1" /> Move to Direct
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMoveToPettyCash(payment)}
                      className="h-8 bg-background shadow-sm"
                    >
                      <Wallet className="w-3 h-3 mr-1" /> Move to Petty Cash
                    </Button>
                  </div>
                   <PaymentVerificationCard
                    payment={payment}
                    payees={payees}
                    isSelected={selectedForBatch.has(payment.id)}
                    onToggleSelect={() => toggleBatchSelection(payment.id)}
                    onViewDocument={(url) => window.open(url, '_blank')}
                    onReverseToAdmin={async (paymentId, reason) => {
                      const result = await reverseToAdmin(paymentId, reason);
                      if (result.success) {
                        refetch();
                      }
                    }}
                    onReject={async (paymentId, reason) => {
                      const result = await rejectPayment(paymentId, reason);
                      if (result.success) {
                        refetch();
                      }
                    }}
                    onHold={async (paymentId, reason) => {
                      const result = await updateStatus(paymentId, 'ceo_hold', { holdReason: reason });
                      if (result.success) {
                        refetch();
                      }
                    }}
                    showReverseOption={true}
                    showRejectOption={user?.role === 'accounts'}
                    onEditBankDetails={handleEditBankDetails}
                    disabled={(() => {
                      const result = isPaymentValid(payment);
                      const isTransport = !!(payment.is_transport_payment || 
                                           payment.purpose?.toLowerCase().includes('transport') || 
                                           payment.vendor_name?.toLowerCase().includes('multiple vendors'));
                      
                      // Allow selecting transport payments even if invalid splits, 
                      // so accounts team can at least group them or process them as direct payments later
                      if (isTransport) return false;
                      
                      return !result.isValid;
                    })()}
                    disabledReason={(() => {
                      const result = isPaymentValid(payment);
                      return result.error || 'Missing payment details';
                    })()}
                  />
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* --- BATCH PROCESSING TAB --- */}
        <TabsContent value="batch-processing" className="mt-6 space-y-4">
          {/* Draft Batches Section */}
          {draftBatches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                <FileSpreadsheet className="w-4 h-4" />
                Draft Batches (Editable)
              </div>
              {draftBatches.map((batch: any) => (
                (() => {
                  const batchPayments = requests.filter(p => p.bulk_batch_id === batch.id);
                  const displayedCount = batchPayments.length > 0 ? batchPayments.length : Number(batch.payment_count || 0);
                  const displayedTotal = batchPayments.length > 0
                    ? batchPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
                    : Number(batch.total_amount || 0);

                  return (
                <Card key={batch.id} className="authority-card border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold font-mono">{batch.batch_reference}</h3>
                          <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30" variant="outline">
                            DRAFT
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Created by {batch.creator?.name || 'Accounts'} • {format(new Date(batch.created_at), 'dd MMM HH:mm')}
                        </p>
                        <div className="mt-4 flex gap-6">
                          <div>
                            <p className="text-xs uppercase text-muted-foreground font-semibold">Total Amount</p>
                            <p className="text-xl font-bold text-primary">₹{displayedTotal.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase text-muted-foreground font-semibold">Count</p>
                            <p className="text-xl font-bold">{displayedCount}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <Button
                          className="bg-primary hover:bg-primary/90"
                          onClick={() => handleSendToAdmin(batch.id)}
                          disabled={sendBatchToAdmin.isPending}
                        >
                          <Send className="w-4 h-4 mr-2" /> Send to Admin
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setConfirmDeleteBatch(batch.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                  );
                })()
              ))}
            </div>
          )}

          {/* Pending & Verified Batches */}
          {(pendingBatches.length === 0 && verifiedBatches.length === 0 && draftBatches.length === 0) ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground">No active batches found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(pendingBatches.length > 0 || verifiedBatches.length > 0) && (
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  <Clock className="w-4 h-4" />
                  Pending & Verified Batches
                </div>
              )}
              {[...pendingBatches, ...verifiedBatches].map((batch: any) => {
                const isExpanded = expandedBatchId === batch.id;
                const batchPayments = requests.filter(p => p.bulk_batch_id === batch.id);
                const displayedCount = batchPayments.length > 0 ? batchPayments.length : Number(batch.payment_count || 0);
                const displayedTotal = batchPayments.length > 0
                  ? batchPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
                  : Number(batch.total_amount || 0);

                return (
                  <Card key={batch.id} className="authority-card">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold font-mono">{batch.batch_reference}</h3>
                            <Badge className={cn(
                              batch.status === 'verified' ? "bg-status-live/20 text-status-live border-status-live/30" :
                                "bg-status-pending/20 text-status-pending border-status-pending/30"
                            )} variant="outline">
                              {batch.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Created by {batch.creator?.name || 'Accounts'} • {format(new Date(batch.created_at), 'dd MMM HH:mm')}
                          </p>
                          <div className="mt-4 flex gap-6">
                            <div>
                              <p className="text-xs uppercase text-muted-foreground font-semibold">Total Amount</p>
                              <p className="text-xl font-bold text-primary">₹{displayedTotal.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-muted-foreground font-semibold">Count</p>
                              <p className="text-xl font-bold">{displayedCount}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 text-right">
                          {batch.status === 'pending_verification' && (
                            <div className="flex flex-col gap-2 items-end">
                              {user?.role === 'admin' ? (
                                <div className="flex gap-2 mb-2">
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleUpdateBatchStatus(batch.id, 'rejected')}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    <XCircle className="w-4 h-4 mr-2" /> Reject
                                  </Button>
                                  <Button
                                    onClick={() => handleUpdateBatchStatus(batch.id, 'verified')}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    size="sm"
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-2" /> Verify
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-sm text-status-pending flex items-center gap-2">
                                  <Clock className="w-4 h-4" /> Awaiting Admin Verification
                                </span>
                              )}

                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setConfirmDeleteBatch(batch.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete Batch
                              </Button>
                            </div>
                          )}

                          {(batch.status === 'verified' || batch.status === 'converted') && (
                            <div className="flex flex-col gap-2 items-end">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadBankFile(batch.id, batch.batch_reference)}
                                >
                                  <Download className="w-4 h-4 mr-2" /> Bank File
                                </Button>
                                <Button
                                  className="bg-status-live hover:bg-status-live/90"
                                  size="sm"
                                  onClick={() => handleMarkProcessed(batch.id)}
                                >
                                  <Check className="w-4 h-4 mr-2" /> Mark Processed
                                </Button>
                              </div>
                            </div>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                            className="mt-2"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                            {isExpanded ? 'Hide Details' : 'View Details'}
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t mt-4 pt-4 bg-muted/10 -mx-6 -mb-6 px-6 pb-6 rounded-b-lg">
                          <h4 className="text-sm font-semibold mb-3 flex items-center justify-between">
                            <span>Payments in Batch ({batchPayments.length})</span>
                          </h4>
                          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {batchPayments.map(p => {
                              const isSplitExpanded = expandedSplitPayments.has(p.id);
                              return (
                                <div key={p.id} className="flex flex-col gap-2">
                                  <div className="group flex items-center gap-4 p-4 bg-card hover:bg-muted/30 border rounded-lg transition-all duration-200 shadow-sm hover:shadow-md">
                                    {/* Vendor Info */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">#{p.payment_number}</span>
                                        <h4 className="font-semibold text-base truncate" title={p.vendor_name}>{p.vendor_name}</h4>
                                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-medium tracking-wide">
                                          {(p.payment_type || 'bank').toUpperCase().replace('_', ' ')}
                                        </Badge>
                                        {p.is_split_payment && (
                                          <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20 text-[9px] font-bold">
                                            SPLIT
                                          </Badge>
                                        )}
                                        {p.is_transport_payment && (
                                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[9px] font-bold">
                                            🚛 TRANSPORT
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-muted-foreground text-sm truncate max-w-[400px]" title={p.purpose}>{p.purpose}</p>
                                    </div>

                                    {p.vendor_account_number ? (
                                      <div className="hidden md:flex flex-col items-end text-xs text-muted-foreground font-mono bg-muted/20 px-3 py-1.5 rounded border border-border/40">
                                        <div className="flex items-center gap-2">
                                          <span className="opacity-70">A/C:</span>
                                          <span className="font-medium text-foreground">{p.vendor_account_number}</span>
                                        </div>
                                        {p.vendor_ifsc_code && (
                                          <div className="flex items-center gap-2">
                                            <span className="opacity-70">IFSC:</span>
                                            <span className="font-medium text-foreground">{p.vendor_ifsc_code}</span>
                                          </div>
                                        )}
                                      </div>
                                    ) : p.vendor_upi ? (
                                      <div className="hidden md:flex flex-col items-end text-xs text-muted-foreground font-mono bg-muted/20 px-3 py-1.5 rounded border border-border/40">
                                        <div className="flex items-center gap-2 text-primary">
                                          <span className="opacity-70">UPI:</span>
                                          <span className="font-medium">{p.vendor_upi}</span>
                                        </div>
                                      </div>
                                    ) : p.is_split_payment ? (
                                      <div className="hidden md:flex items-center gap-2 bg-purple-500/10 text-purple-600 px-3 py-1.5 rounded border border-purple-500/20">
                                        <Users className="w-3 h-3" />
                                        <span className="text-[10px] font-bold uppercase">Multiple Payees</span>
                                      </div>
                                    ) : (
                                      <div className="hidden md:flex items-center gap-2 bg-destructive/10 text-destructive px-3 py-1.5 rounded border border-destructive/20 animate-pulse">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span className="text-[10px] font-bold uppercase">Missing Bank Details</span>
                                      </div>
                                    )}

                                    {/* Amount */}
                                    <div className="text-right min-w-[100px]">
                                      <p className="font-bold text-lg tabular-nums tracking-tight">₹{Number(p.amount).toLocaleString()}</p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1">
                                      {p.is_split_payment && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          aria-label={isSplitExpanded ? "Collapse split payment details" : "Expand split payment details"}
                                          className={cn(
                                            "h-9 w-9 rounded-full transition-colors",
                                            isSplitExpanded ? "bg-purple-500/20 text-purple-600" : "text-muted-foreground hover:text-purple-600 hover:bg-purple-500/10"
                                          )}
                                          onClick={() => {
                                            setExpandedSplitPayments(prev => {
                                              const next = new Set(prev);
                                              if (next.has(p.id)) next.delete(p.id);
                                              else next.add(p.id);
                                              return next;
                                            });
                                          }}
                                          title="View Split Details"
                                        >
                                          {isSplitExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Remove payment from batch"
                                        className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                                        onClick={async () => {
                                          // Remove from batch
                                          await updateBatchPayments.mutateAsync({
                                            batchId: batch.id,
                                            removePaymentIds: [p.id]
                                          });
                                          // Mark as direct
                                          await updateStatus(p.id, p.status, {
                                            tags: [...(p.tags || []).filter((t: string) => t !== 'direct_payment'), 'direct_payment']
                                          });
                                          toast.success('Detached and moved to Direct Payments');
                                        }}
                                        title="Detach and pay individually"
                                      >
                                        <ArrowRight className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Delete payment from batch"
                                        className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                                        onClick={() => updateBatchPayments.mutate({
                                          batchId: batch.id,
                                          removePaymentIds: [p.id]
                                        })}
                                        title="Remove from batch (Back to pool)"
                                      >
                                        <XCircle className="w-5 h-5" />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Split Details Dropdown */}
                                  {p.is_split_payment && isSplitExpanded && p.splits && (
                                    <motion.div
                                      initial={{ opacity: 0, y: -10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="ml-8 mr-2 p-4 bg-purple-500/5 rounded-xl border border-purple-500/20 space-y-3"
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <h5 className="text-xs font-black uppercase tracking-widest text-purple-600 opacity-80">
                                          Breakdown for {p.payment_number}
                                        </h5>
                                        <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[9px]">
                                          {p.splits.length} SPLITS
                                        </Badge>
                                      </div>
                                      <div className="grid grid-cols-1 gap-2">
                                        {p.splits.map((split: any) => (
                                          <div key={split.id} className="flex items-center justify-between p-3 bg-card border rounded-lg shadow-sm">
                                            <div className="flex items-center gap-3">
                                              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                                {split.split_number}
                                              </div>
                                              <div>
                                                <p className="font-bold text-sm">{split.payee_name}</p>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                                                  {split.payment_method === 'bank_transfer' ? (
                                                    <>
                                                      <span>A/C: {split.account_number}</span>
                                                      <span className="opacity-40">|</span>
                                                      <span>IFSC: {split.ifsc_code}</span>
                                                    </>
                                                  ) : (
                                                    <span>UPI: {split.upi_id}</span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <p className="font-black text-primary">₹{split.amount.toLocaleString()}</p>
                                              <p className="text-[9px] text-muted-foreground truncate max-w-[150px]">{split.split_title}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* --- DIRECT PAYMENTS TAB --- */}
        < TabsContent value="direct-payments" className="mt-6 space-y-4" >
          <div className="flex justify-between items-center bg-primary/5 p-4 rounded-lg border border-primary/20">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-primary" /> Direct Payments
              </h3>
              <p className="text-sm text-muted-foreground">
                CEO-approved payments ready for individual processing (not in batches)
              </p>
            </div>
            <Badge className="bg-primary/20 text-primary border-primary/30" variant="outline">
              {directPayments.length} Pending
            </Badge>
          </div>

          {
            directPayments.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <ArrowRight className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No direct payments pending.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {directPayments.map(payment => {
                  const isExpanded = expandedPayments.has(payment.id);
                  return (
                    <Card key={payment.id} className="authority-card border-primary/20">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Main Row */}
                          <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className="bg-primary/20 text-primary border-primary/30" variant="outline">
                                  DIRECT PAYMENT
                                </Badge>
                                {payment.status === 'gm_hold' && (
                                  <Badge className="bg-amber-500 text-white border-amber-600 animate-pulse" variant="outline">
                                    <Clock className="w-3 h-3 mr-1" /> GM HOLD
                                  </Badge>
                                )}
                                {payment.converted_from_batch && (
                                  <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30" variant="outline">
                                    Converted from Batch
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground font-mono">
                                  PAY-{String(payment.payment_number || 0).padStart(6, '0')}
                                </span>
                              </div>

                              {/* Prominent Payee Name */}
                              <div className="mb-3">
                                <p className="font-bold text-xl mb-1 text-primary">{payment.vendor_name}</p>
                                <p className="text-sm text-muted-foreground">{payment.purpose}</p>
                              </div>

                              {/* Bank Details Summary */}
                              {payment.vendor_account_number && (
                                <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border mb-2">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm font-mono font-medium">
                                      {payment.vendor_ifsc_code || 'No IFSC'}
                                    </span>
                                  </div>
                                  <div className="h-4 w-px bg-border" />
                                  <div className="flex items-center gap-2">
                                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm font-mono font-medium">
                                      {payment.vendor_account_number}
                                    </span>
                                  </div>
                                  <div className="h-4 w-px bg-border" />
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm truncate max-w-[200px]">
                                      {payment.beneficiary_name || payment.vendor_name}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Quick Info */}
                              <div className="flex flex-wrap items-center gap-3 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-muted-foreground">Requested by:</span>
                                  <span className="font-medium">{payment.requester?.name || 'N/A'}</span>
                                </div>
                                <div className="h-3 w-px bg-border" />
                                <div className="flex items-center gap-1.5">
                                  <span className="text-muted-foreground">Type:</span>
                                  <span className="font-medium">{payment.payment_type?.toUpperCase() || 'BANK'}</span>
                                </div>
                              </div>

                              {/* Expand/Collapse Button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setExpandedPayments(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(payment.id)) newSet.delete(payment.id);
                                  else newSet.add(payment.id);
                                  return newSet;
                                })}
                              >
                                {isExpanded ? (
                                  <><ChevronUp className="w-4 h-4 mr-1" /> Hide Full Details</>
                                ) : (
                                  <><ChevronDown className="w-4 h-4 mr-1" /> View Full Payment Details</>
                                )}
                              </Button>

                              {/* Expandable Details */}
                              {isExpanded && (
                                <div className="pt-3 border-t space-y-3 mt-2">
                                  <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <CreditCard className="w-4 h-4" /> Complete Bank Details
                                  </h4>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-lg bg-muted/30 border">
                                      <p className="text-xs text-muted-foreground mb-1">Beneficiary Name</p>
                                      <p className="font-medium text-sm">{payment.beneficiary_name || payment.vendor_name}</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-muted/30 border">
                                      <p className="text-xs text-muted-foreground mb-1">Payment Type</p>
                                      <Badge variant="outline" className="text-xs">
                                        {Number(payment.amount) >= 200000 ? 'RTGS' : 'NEFT'}
                                      </Badge>
                                    </div>
                                    {payment.vendor_account_number && (
                                      <div className="p-3 rounded-lg bg-muted/30 border">
                                        <p className="text-xs text-muted-foreground mb-1">Account Number</p>
                                        <p className="font-mono text-sm">{payment.vendor_account_number}</p>
                                      </div>
                                    )}
                                    {payment.vendor_ifsc_code && (
                                      <div className="p-3 rounded-lg bg-muted/30 border">
                                        <p className="text-xs text-muted-foreground mb-1">IFSC Code</p>
                                        <p className="font-mono text-sm">{payment.vendor_ifsc_code}</p>
                                      </div>
                                    )}
                                    {payment.vendor_upi && (
                                      <div className="p-3 rounded-lg bg-muted/30 border col-span-2">
                                        <p className="text-xs text-muted-foreground mb-1">UPI ID</p>
                                        <p className="font-medium text-sm">{payment.vendor_upi}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Action Buttons */}
                              <div className="flex gap-2 mt-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleMoveToBatch(payment)}
                                  className="h-7 text-xs"
                                >
                                  <Layers className="w-3 h-3 mr-1" /> Move to Batch
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleMoveToPettyCash(payment)}
                                  className="h-7 text-xs"
                                >
                                  <Wallet className="w-3 h-3 mr-1" /> Move to Petty Cash
                                </Button>
                              </div>
                            </div>

                            {/* Right Side: Amount & Actions */}
                            <div className="flex flex-col gap-3 min-w-[300px]">
                              <div className="text-right">
                                <p className="text-3xl font-bold text-primary">
                                  ₹{Number(payment.amount).toLocaleString()}
                                </p>
                              </div>

                              <div className="space-y-3">
                                {payment.is_split_payment ? (
                                  /* SPLIT PAYMENT UTR ENTRY */
                                  <div className="space-y-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-1">Enter Batch UTRs</p>
                                    {(payment.splits || []).map((split: any) => (
                                      <div key={split.id} className="space-y-1">
                                        <div className="flex justify-between items-center px-1">
                                          <span className="text-[9px] font-bold text-muted-foreground uppercase">{split.split_title}</span>
                                          <span className="text-[9px] font-mono text-primary">₹{split.amount.toLocaleString()}</span>
                                        </div>
                                        <Input
                                          placeholder={`UTR for ${split.payee_name}`}
                                          value={splitUTRs[payment.id]?.[split.id] || ''}
                                          onChange={(e) => setSplitUTRs(prev => ({
                                            ...prev,
                                            [payment.id]: {
                                              ...(prev[payment.id] || {}),
                                              [split.id]: e.target.value
                                            }
                                          }))}
                                          className="h-8 text-xs font-mono bg-background/50 border-purple-500/20 focus-visible:ring-purple-500/30"
                                        />
                                      </div>
                                    ))}

                                    <div className="pt-2 flex gap-2">
                                      <Button
                                        size="icon"
                                        variant="outline"
                                        aria-label="Upload payment proof"
                                        className={cn(
                                          "h-9 w-9 shrink-0",
                                          (directPaymentProofUrls[payment.id] || payment.payment_proof_screenshot) && "border-status-live text-status-live bg-status-live/10"
                                        )}
                                        onClick={() => setDirectPaymentProofOpen(payment.id)}
                                        title="Upload Payment Proof"
                                      >
                                        {(directPaymentProofUrls[payment.id] || payment.payment_proof_screenshot) ? (
                                          <CheckCircle2 className="w-4 h-4" />
                                        ) : (
                                          <Upload className="w-4 h-4" />
                                        )}
                                      </Button>

                                      <Button
                                        size="sm"
                                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                                        onClick={async () => {
                                          const utrs = splitUTRs[payment.id] || {};
                                          const allEntered = (payment.splits || []).every((s: any) => utrs[s.id]?.trim());

                                          if (!allEntered) {
                                            toast.error('Please enter UTR for ALL splits in this batch');
                                            return;
                                          }

                                          // 1. Update each split record
                                          for (const split of (payment.splits || [])) {
                                            await (supabase as any)
                                              .from('split_payments')
                                              .update({
                                                utr_number: utrs[split.id],
                                                status: 'paid',
                                                paid_at: new Date().toISOString(),
                                                paid_by: user?.id,
                                                payment_proof_url: directPaymentProofUrls[payment.id] || payment.payment_proof_screenshot || undefined
                                              })
                                              .eq('id', split.id);
                                          }

                                          // 2. Update parent status
                                          const result = await updateStatus(payment.id, 'paid', {
                                            utrNumber: 'BATCH-SPLIT',
                                            paymentProofUrl: directPaymentProofUrls[payment.id] || payment.payment_proof_screenshot || undefined
                                          });

                                          if (result.success) {
                                            toast.success('Split payment batch marked as paid');
                                            setSplitUTRs(prev => { const n = { ...prev }; delete n[payment.id]; return n; });
                                            setDirectPaymentProofUrls(prev => { const n = { ...prev }; delete n[payment.id]; return n; });
                                            refetch();
                                          }
                                        }}
                                      >
                                        <Check className="w-4 h-4 mr-1" /> Mark Batch Paid
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  /* REGULAR PAYMENT UTR ENTRY */
                                  <div className="space-y-2">
                                    <div className="flex gap-2">
                                      <Input
                                        placeholder="Enter UTR Number"
                                        value={directPaymentUTRs[payment.id] || ''}
                                        onChange={(e) => setDirectPaymentUTRs(prev => ({ ...prev, [payment.id]: e.target.value }))}
                                        className="h-9 font-mono text-sm"
                                      />
                                      <Button
                                        size="icon"
                                        variant="outline"
                                        aria-label="Upload payment proof"
                                        className={cn(
                                          "h-9 w-9 shrink-0",
                                          (directPaymentProofUrls[payment.id] || payment.payment_proof_screenshot) && "border-status-live text-status-live bg-status-live/10"
                                        )}
                                        onClick={() => setDirectPaymentProofOpen(payment.id)}
                                        title="Upload Payment Proof"
                                      >
                                        {(directPaymentProofUrls[payment.id] || payment.payment_proof_screenshot) ? (
                                          <CheckCircle2 className="w-4 h-4" />
                                        ) : (
                                          <Upload className="w-4 h-4" />
                                        )}
                                      </Button>
                                    </div>

                                    <Button
                                      size="sm"
                                      onClick={async () => {
                                        const utr = directPaymentUTRs[payment.id];
                                        if (!utr) {
                                          toast.error('Please enter UTR number');
                                          return;
                                        }

                                        const result = await updateStatus(payment.id, 'paid', {
                                          utrNumber: utr,
                                          paymentProofUrl: directPaymentProofUrls[payment.id] || payment.payment_proof_screenshot || undefined
                                        });

                                        if (result.success) {
                                          toast.success('Payment marked as paid');
                                          // Cleanup state
                                          setDirectPaymentUTRs(prev => { const n = { ...prev }; delete n[payment.id]; return n; });
                                          setDirectPaymentProofUrls(prev => { const n = { ...prev }; delete n[payment.id]; return n; });
                                          refetch();
                                        }
                                      }}
                                      className="w-full bg-status-live hover:bg-status-live/90"
                                      disabled={!directPaymentUTRs[payment.id]}
                                    >
                                      <Check className="w-4 h-4 mr-1" /> Mark as Paid
                                    </Button>
                                  </div>
                                )}

                                {user?.role === 'gm' && (
                                  <div className="pt-2 border-t border-border mt-2 space-y-2">
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 h-7 text-[10px] text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                                        onClick={() => setActiveGMAction({ id: payment.id, type: 'reverse' })}
                                      >
                                        <RefreshCcw className="w-3 h-3 mr-1" /> Reverse
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 h-7 text-[10px] text-red-600 border-red-500/30 hover:bg-red-500/10"
                                        onClick={() => setActiveGMAction({ id: payment.id, type: 'hold' })}
                                      >
                                        <AlertTriangle className="w-3 h-3 mr-1" /> Hold
                                      </Button>
                                    </div>

                                    {activeGMAction?.id === payment.id && (
                                      <div className="space-y-2 p-2 rounded bg-muted/50 border border-muted-foreground/20 animate-in fade-in slide-in-from-top-1">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                          Reason for {activeGMAction.type}:
                                        </p>
                                        <Textarea
                                          placeholder={`Enter ${activeGMAction.type} reason...`}
                                          value={gmActionReason}
                                          onChange={e => setGMActionReason(e.target.value)}
                                          className="text-xs min-h-[60px] bg-background"
                                        />
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="flex-1 h-7 text-[10px]"
                                            onClick={() => { setActiveGMAction(null); setGMActionReason(''); }}
                                          >
                                            Cancel
                                          </Button>
                                          <Button
                                            size="sm"
                                            className={cn(
                                              "flex-1 h-7 text-[10px]",
                                              activeGMAction.type === 'reverse' ? "bg-amber-500 hover:bg-amber-600" : "bg-red-500 hover:bg-red-600"
                                            )}
                                            disabled={!gmActionReason.trim()}
                                            onClick={async () => {
                                              const result = activeGMAction.type === 'reverse'
                                                ? await reverseToAdmin(payment.id, gmActionReason.trim())
                                                : await updateStatus(payment.id, 'gm_hold', { holdReason: gmActionReason.trim() });

                                              if (result.success) {
                                                toast.success(`Payment ${activeGMAction.type === 'reverse' ? 'reversed' : 'put on hold'}`);
                                                setActiveGMAction(null);
                                                setGMActionReason('');
                                                refetch();
                                              }
                                            }}
                                          >
                                            Confirm
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <PaymentProofUpload
                          open={directPaymentProofOpen === payment.id}
                          onOpenChange={(open) => !open && setDirectPaymentProofOpen(null)}
                          paymentId={payment.id}
                          paymentNumber={String(payment.payment_number || 0).padStart(6, '0')}
                          onUploadComplete={(url) => {
                            setDirectPaymentProofUrls(prev => ({ ...prev, [payment.id]: url }));
                          }}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )
          }

          {/* Completed Direct Payments Section */}
          <div className="mt-8">
            <div className="flex justify-between items-center bg-status-live/5 p-4 rounded-lg border border-status-live/20 mb-4">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-status-live" /> Completed Direct Payments
                </h3>
                <p className="text-sm text-muted-foreground">
                  Individual payments processed directly without batching
                </p>
              </div>
              <Badge className="bg-status-live/20 text-status-live border-status-live/30" variant="outline">
                {completedDirectPayments.length} Completed
              </Badge>
            </div>

            {completedDirectPayments.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed rounded-lg border-status-live/20">
                <Banknote className="w-10 h-10 text-status-live/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No completed direct payments yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {completedDirectPayments.map(payment => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-status-live/5 border-status-live/20"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-status-live text-white border-status-live" variant="outline">
                          ✓ COMPLETED
                        </Badge>
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                          DIRECT PAY
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          PAY-{String(payment.payment_number || 0).padStart(6, '0')}
                        </span>
                      </div>
                      <p className="font-medium">{payment.vendor_name}</p>
                      <p className="text-xs text-muted-foreground">{payment.purpose}</p>
                      <div className="flex items-center gap-4 mt-2">
                        {payment.paid_at && (
                          <p className="text-xs text-status-live">
                            Paid on {format(new Date(payment.paid_at), 'dd MMM yyyy')}
                          </p>
                        )}
                        {payment.utr_number && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="font-bold">UTR:</span>
                            <span className="font-mono text-status-live">{payment.utr_number}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-status-live">₹{Number(payment.amount).toLocaleString()}</p>
                      <div className="flex items-center justify-end gap-2 mt-2">
                        {payment.payment_proof_screenshot && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-[10px] text-muted-foreground font-bold hover:text-primary"
                            onClick={() => window.open(payment.payment_proof_screenshot, '_blank')}
                          >
                            <Download className="w-3 h-3 mr-1" /> BANK PROOF
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-[10px] font-bold border-primary/30 text-primary hover:bg-primary/5"
                          onClick={() => handleGenerateVoucher(payment)}
                        >
                          <FileText className="w-3 h-3 mr-1" /> VOUCHER
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent >

        {/* --- PETTY CASH TAB --- */}
        < TabsContent value="petty-cash" className="mt-6 space-y-4" >
          {/* Low balance warning (< ₹1,100) */}
          {currentBalance < 1100 && currentBalance >= 0 && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/30 animate-pulse">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>⚠️ Petty Cash Low — Balance Below ₹1,100</AlertTitle>
              <AlertDescription>
                <span>Current balance of ₹{currentBalance.toLocaleString()} is critically low. A refill request has been auto-generated.</span>
              </AlertDescription>
            </Alert>
          )}
          {/* Cumulative spend limit alert (₹15,000) */}
          {cumulativeSpend >= 15000 && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/30 animate-pulse">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Petty Cash Limit Reached (₹15,000)</AlertTitle>
              <AlertDescription>
                <span>Utilization threshold reached. Audit report and Refill request have been auto-generated.</span>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase">Current Balance</p>
                  <p className={cn(
                    "text-2xl font-bold font-mono",
                    currentBalance < 1100 ? "text-destructive animate-pulse" : currentBalance < 3000 ? "text-amber-600" : "text-primary"
                  )}>
                    ₹{currentBalance.toLocaleString()}
                  </p>
                  {currentBalance < 1100 && <p className="text-[10px] text-destructive font-bold mt-1">CRITICALLY LOW</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 rounded-xl">
                  <HistoryIcon className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase">Cumulative Spend</p>
                  <p className="text-2xl font-bold font-mono text-amber-600">
                    ₹{cumulativeSpend.toLocaleString()} / ₹15,000
                  </p>
                </div>
              </CardContent>
            </Card>


          </div>

          {
            pettyCashPayments.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <Wallet className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No petty cash payments pending.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pettyCashPayments.map(payment => {
                  const isExpanded = expandedPayments.has(payment.id);
                  return (
                    <Card key={payment.id} className="authority-card">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Main Row */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30" variant="outline">
                                  PETTY CASH
                                </Badge>
                                {payment.status === 'gm_hold' && (
                                  <Badge className="bg-amber-500 text-white border-amber-600 animate-pulse" variant="outline">
                                    <Clock className="w-3 h-3 mr-1" /> GM HOLD
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground font-mono">
                                  PAY-{String(payment.payment_number || 0).padStart(6, '0')}
                                </span>
                              </div>
                              <p className="font-bold text-lg mb-1">{payment.vendor_name}</p>
                              <p className="text-sm text-muted-foreground mb-2">{payment.purpose}</p>

                              {/* Quick Payee Info */}
                              <div className="flex flex-wrap items-center gap-3 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-muted-foreground">Requested by:</span>
                                  <span className="font-medium">{payment.requester?.name || 'N/A'}</span>
                                </div>
                                <div className="h-3 w-px bg-border" />
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="font-medium">{payment.department || payment.requester?.department || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-primary">₹{Number(payment.amount).toLocaleString()}</p>
                            </div>
                          </div>

                          {/* Expandable Payee Details */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setExpandedPayments(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(payment.id)) newSet.delete(payment.id);
                              else newSet.add(payment.id);
                              return newSet;
                            })}
                          >
                            {isExpanded ? (
                              <><ChevronUp className="w-4 h-4 mr-1" /> Hide Payee Details</>
                            ) : (
                              <><ChevronDown className="w-4 h-4 mr-1" /> View Payee Details</>
                            )}
                          </Button>

                          {isExpanded && (
                            <div className="pt-3 border-t space-y-3">
                              <h4 className="text-sm font-semibold flex items-center gap-2">
                                <CreditCard className="w-4 h-4" /> Payment Details
                              </h4>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-lg bg-muted/30 border">
                                  <p className="text-xs text-muted-foreground mb-1">Beneficiary Name</p>
                                  <p className="font-medium text-sm">{payment.beneficiary_name || payment.vendor_name}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/30 border">
                                  <p className="text-xs text-muted-foreground mb-1">Payment Method</p>
                                  <Badge variant="outline" className="text-xs">
                                    {payment.vendor_upi ? 'UPI/GPay' : payment.vendor_account_number ? 'Bank Transfer' : 'Cash'}
                                  </Badge>
                                </div>
                                {payment.vendor_account_number && (
                                  <div className="p-3 rounded-lg bg-muted/30 border">
                                    <p className="text-xs text-muted-foreground mb-1">Account Number</p>
                                    <p className="font-mono text-sm">{payment.vendor_account_number}</p>
                                  </div>
                                )}
                                {payment.vendor_ifsc_code && (
                                  <div className="p-3 rounded-lg bg-muted/30 border">
                                    <p className="text-xs text-muted-foreground mb-1">IFSC Code</p>
                                    <p className="font-mono text-sm">{payment.vendor_ifsc_code}</p>
                                  </div>
                                )}
                                {payment.vendor_upi && (
                                  <div className="p-3 rounded-lg bg-muted/30 border col-span-2">
                                    <p className="text-xs text-muted-foreground mb-1">UPI ID</p>
                                    <p className="font-medium text-sm">{payment.vendor_upi}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 pt-2">
                            <input
                              ref={(el) => { proofInputRefs.current[payment.id] = el; }}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              aria-label="Upload payment proof"
                              title="Upload payment proof"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                setUploadingProof(payment.id);
                                setPettyCashProofFiles(prev => ({ ...prev, [payment.id]: file }));

                                try {
                                  const fileExt = file.name.split('.').pop();
                                  const fileName = `${payment.id} -${Date.now()}.${fileExt} `;
                                  const filePath = `petty - cash / ${fileName} `;

                                  const { data, error } = await supabase.storage
                                    .from('payment-proofs')
                                    .upload(filePath, file);

                                  if (error) throw error;

                                  const { data: urlData } = supabase.storage
                                    .from('payment-proofs')
                                    .getPublicUrl(filePath);

                                  setPettyCashProofUrls(prev => ({ ...prev, [payment.id]: urlData.publicUrl }));
                                  toast.success('Screenshot uploaded');
                                } catch (err) {
                                  console.error(err);
                                  toast.error('Failed to upload screenshot');
                                  setPettyCashProofFiles(prev => {
                                    const newState = { ...prev };
                                    delete newState[payment.id];
                                    return newState;
                                  });
                                } finally {
                                  setUploadingProof(null);
                                }
                              }}
                            />
                            {pettyCashProofUrls[payment.id] ? (
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-status-live/10 border border-status-live/30 flex-1">
                                <Image className="w-4 h-4 text-status-live" />
                                <span className="text-xs font-medium text-status-live">Screenshot Ready</span>
                                <button
                                  onClick={() => {
                                    setPettyCashProofUrls(prev => {
                                      const newState = { ...prev };
                                      delete newState[payment.id];
                                      return newState;
                                    });
                                    setPettyCashProofFiles(prev => {
                                      const newState = { ...prev };
                                      delete newState[payment.id];
                                      return newState;
                                    });
                                  }}
                                  className="ml-auto p-0.5 rounded hover:bg-destructive/20"
                                  aria-label="Remove payment proof"
                                  title="Remove payment proof"
                                >
                                  <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                                </button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => proofInputRefs.current[payment.id]?.click()}
                                disabled={uploadingProof === payment.id}
                                className="flex-1"
                              >
                                {uploadingProof === payment.id ? (
                                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Uploading...</>
                                ) : (
                                  <><Upload className="w-4 h-4 mr-1" /> Upload Proof</>
                                )}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="bg-status-live hover:bg-status-live/90"
                              onClick={() => handlePettyCashExecute(payment.id)}
                              disabled={!pettyCashProofUrls[payment.id]}
                            >
                              <Check className="w-4 h-4 mr-1" /> Execute
                            </Button>
                          </div>

                          {user?.role === 'gm' && (
                            <div className="pt-2 border-t border-border mt-2 space-y-2">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 h-7 text-[10px] text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                                  onClick={() => setActiveGMAction({ id: payment.id, type: 'reverse' })}
                                >
                                  <RefreshCcw className="w-3 h-3 mr-1" /> Reverse
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 h-7 text-[10px] text-red-600 border-red-500/30 hover:bg-red-500/10"
                                  onClick={() => setActiveGMAction({ id: payment.id, type: 'hold' })}
                                >
                                  <AlertTriangle className="w-3 h-3 mr-1" /> Hold
                                </Button>
                              </div>

                              {activeGMAction?.id === payment.id && (
                                <div className="space-y-2 p-2 rounded bg-muted/50 border border-muted-foreground/20 animate-in fade-in slide-in-from-top-1">
                                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                    Reason for {activeGMAction.type}:
                                  </p>
                                  <Textarea
                                    placeholder={`Enter ${activeGMAction.type} reason...`}
                                    value={gmActionReason}
                                    onChange={e => setGMActionReason(e.target.value)}
                                    className="text-xs min-h-[60px] bg-background"
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="flex-1 h-7 text-[10px]"
                                      onClick={() => { setActiveGMAction(null); setGMActionReason(''); }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      className={cn(
                                        "flex-1 h-7 text-[10px]",
                                        activeGMAction.type === 'reverse' ? "bg-amber-500 hover:bg-amber-600" : "bg-red-500 hover:bg-red-600"
                                      )}
                                      disabled={!gmActionReason.trim()}
                                      onClick={async () => {
                                        const result = activeGMAction.type === 'reverse'
                                          ? await reverseToAdmin(payment.id, gmActionReason.trim())
                                          : await updateStatus(payment.id, 'ceo_hold', { holdReason: gmActionReason.trim() });

                                        if (result.success) {
                                          toast.success(`Payment ${activeGMAction.type === 'reverse' ? 'reversed' : 'put on hold'}`);
                                          setActiveGMAction(null);
                                          setGMActionReason('');
                                          refetch();
                                        }
                                      }}
                                    >
                                      Confirm
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )
          }

          {/* Completed Petty Cash Section */}
          <div className="mt-8">
            <div className="flex justify-between items-center bg-status-live/5 p-4 rounded-lg border border-status-live/20 mb-4">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-status-live" /> Completed Petty Cash
                </h3>
                <p className="text-sm text-muted-foreground">
                  Executed UPI/GPay payments - no UTR matching required
                </p>
              </div>
              <Badge className="bg-status-live/20 text-status-live border-status-live/30" variant="outline">
                {completedPettyCash.length} Completed
              </Badge>
            </div>

            {completedPettyCash.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed rounded-lg border-status-live/20">
                <Wallet className="w-10 h-10 text-status-live/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No completed petty cash payments today.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {completedPettyCash.map(payment => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-status-live/5 border-status-live/20"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-status-live text-white border-status-live" variant="outline">
                          ✓ COMPLETED
                        </Badge>
                        <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30" variant="outline">
                          UPI/GPay
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          PAY-{String(payment.payment_number || 0).padStart(6, '0')}
                        </span>
                      </div>
                      <p className="font-medium">{payment.vendor_name}</p>
                      <p className="text-xs text-muted-foreground">{payment.purpose}</p>
                      {payment.paid_at && (
                        <p className="text-xs text-status-live mt-1">
                          Paid on {format(new Date(payment.paid_at), 'dd MMM yyyy, hh:mm a')}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-status-live">₹{Number(payment.amount).toLocaleString()}</p>
                    </div>
                    <div className="ml-4 flex flex-col gap-2">
                      {payment.work_proof_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(payment.work_proof_url, '_blank')}
                          className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 px-2"
                        >
                          <HistoryIcon className="w-3.5 h-3.5 mr-1" /> Bank Proof
                        </Button>
                      )}
                      {(payment.payment_proof_url || payment.payment_proof_screenshot) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(payment.payment_proof_url || payment.payment_proof_screenshot || '', '_blank')}
                          className="text-status-live border-status-live/30 hover:bg-status-live/10 px-2"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" /> View Txn Proof
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 px-2"
                        onClick={() => handleGenerateVoucher(payment)}
                      >
                        <FileText className="w-3.5 h-3.5 mr-1" /> Voucher
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent >

        {/* --- PAYEE MASTER TAB --- */}
        <TabsContent value="payee-master">
          <Card className="border-primary/10">
            <CardHeader className="flex flex-row items-center justify-between border-b border-primary/5 bg-primary/5">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-primary" /> Payee Master (Bank Credentials)
                </CardTitle>
                <CardDescription>Manage reusable bank details for general payments</CardDescription>
              </div>
              <Dialog open={isPayeeDialogOpen} onOpenChange={(open) => {
                setIsPayeeDialogOpen(open);
                if (!open) { setEditingPayee(null); setNewPayee({ name: '', bank_name: '', account_number: '', ifsc_code: '' }); }
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-primary hover:bg-primary/90 font-bold">
                    <Plus className="w-4 h-4" /> Add New Payee
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingPayee ? 'Edit Payee' : 'Add New Payee'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Payee Name / Beneficiary *</Label>
                      <Input value={newPayee.name} onChange={e => setNewPayee({ ...newPayee, name: e.target.value })} placeholder="e.g., John Doe or Vendor Ltd" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Bank Name</Label>
                        <Input value={newPayee.bank_name} onChange={e => setNewPayee({ ...newPayee, bank_name: e.target.value })} placeholder="e.g., HDFC Bank" />
                      </div>
                      <div className="space-y-2">
                        <Label>IFSC Code *</Label>
                        <Input value={newPayee.ifsc_code} onChange={e => setNewPayee({ ...newPayee, ifsc_code: e.target.value.toUpperCase() })} placeholder="HDFC0001234" maxLength={11} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Account Number *</Label>
                      <Input value={newPayee.account_number} onChange={e => setNewPayee({ ...newPayee, account_number: e.target.value })} placeholder="000123456789" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPayeeDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSavePayee} className="gap-2">
                      <Save className="w-4 h-4" /> {editingPayee ? 'Update Payee' : 'Save Payee'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, account, or bank..."
                  className="pl-10 h-11"
                  value={payeeSearch}
                  onChange={e => setPayeeSearch(e.target.value)}
                />
              </div>

              {payeesLoading ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                  <p>Loading your payee master list...</p>
                </div>
              ) : filteredPayees.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                  <User className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
                  <p className="text-muted-foreground">No payees found matching your search</p>
                  <Button variant="link" onClick={() => setNewPayee({ name: '', bank_name: '', account_number: '', ifsc_code: '' })}>
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPayees.map((payee) => (
                    <motion.div
                      key={payee.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="group relative p-4 rounded-xl border border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all bg-muted/20"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Landmark className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" aria-label="Edit payee" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEditPayee(payee)}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Delete payee" className="h-8 w-8 text-muted-foreground hover:text-status-missed" onClick={() => deletePayee(payee.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <h3 className="font-bold text-lg truncate mb-1">{payee.name}</h3>
                      <p className="text-sm text-muted-foreground font-medium mb-4">{payee.bank_name || 'No Bank Name'}</p>

                      <div className="space-y-2 pt-3 border-t border-border">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Account:</span>
                          <span className="font-mono font-bold">{payee.account_number}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">IFSC:</span>
                          <span className="font-mono font-bold text-primary">{payee.ifsc_code}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- UTR MATCHING / RECONCILIATION TAB --- */}
        <TabsContent value="reconciliation" className="mt-6">
          <ReconciliationTab 
            regularPaidPayments={regularPaidPayments} 
            user={user} 
            refetch={refetch} 
            handleGenerateVoucher={handleGenerateVoucher} 
          />
        </TabsContent>

        {/* --- HISTORY TAB --- */}
        <TabsContent value="history" className="mt-6 space-y-4">
          <AuditHistoryWidget role="accounts" title="Payment Execution History" />
        </TabsContent>

        {/* --- REPORTS TAB --- */}
        <TabsContent value="reports" className="mt-6 space-y-4">
          <Card className="authority-card">
            <CardContent className="p-6">
              <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
                <Receipt className="w-5 h-5 text-primary" /> Daily Expense Sheet
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Export comprehensive expense sheet with full audit trail, all approvers, timestamps, and proof URLs.
              </p>

              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                  <Input
                    type="date"
                    value={expenseStartDate}
                    onChange={(e) => setExpenseStartDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">End Date</label>
                  <Input
                    type="date"
                    value={expenseEndDate}
                    onChange={(e) => setExpenseEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <Button onClick={handleExportExpenseSheet}>
                  <Download className="w-4 h-4 mr-2" /> Export Expense Sheet
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="authority-card">
            <CardContent className="p-6">
              <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
                <Wallet className="w-5 h-5 text-primary" /> Petty Cash Report
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Export petty cash transactions with approver details within the selected period.
              </p>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                  <Input
                    type="date"
                    value={expenseStartDate}
                    onChange={(e) => setExpenseStartDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">End Date</label>
                  <Input
                    type="date"
                    value={expenseEndDate}
                    onChange={(e) => setExpenseEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <Button variant="outline" onClick={handleExportPettyCash}>
                  <Download className="w-4 h-4 mr-2" /> Export Petty Cash
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent >

        {/* --- RENTAL PAYMENTS TAB --- */}
        <TabsContent value="rental-payments" className="mt-6">
          <RentalPaymentsSubTab />
        </TabsContent>
      </Tabs >

      {/* Double Confirmation Dialog */}
      < Dialog open={!!confirmProcessedBatch} onOpenChange={() => { setConfirmProcessedBatch(null); setConfirmStep(1); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmStep === 1 ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-status-pending" />
                  Confirm Batch Processed
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 text-status-live" />
                  Final Confirmation
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {confirmStep === 1
                ? "Are you sure the bank has processed this batch? This action cannot be undone."
                : "This is the final confirmation. Click 'Confirm' to mark this batch as processed."
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmProcessedBatch(null); setConfirmStep(1); }}>
              Cancel
            </Button>
            <Button
              className={confirmStep === 2 ? "bg-status-live hover:bg-status-live/90" : ""}
              onClick={confirmMarkProcessed}
            >
              {confirmStep === 1 ? 'Continue' : 'Confirm Processed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Delete Batch Confirmation Dialog */}
      < Dialog open={!!confirmDeleteBatch} onOpenChange={() => { setConfirmDeleteBatch(null); setDeleteConfirmStep(1); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              {deleteConfirmStep === 1 ? (
                <>
                  <AlertTriangle className="w-5 h-5" />
                  Delete Batch - Step 1
                </>
              ) : (
                <>
                  <Trash2 className="w-5 h-5" />
                  Final Confirmation
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {deleteConfirmStep === 1
                ? "Are you sure you want to delete this batch? All linked payments will be unlinked."
                : "FINAL: All payments will return to the CEO-approved queue for rebatching. This cannot be undone."
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDeleteBatch(null); setDeleteConfirmStep(1); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteBatch}
              disabled={deleteBatch.isPending}
            >
              {deleteBatch.isPending ? 'Deleting...' : deleteConfirmStep === 1 ? 'Continue' : 'Confirm Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Petty Cash Execution Two-Step Confirmation */}
      < Dialog open={!!confirmPettyCashExec} onOpenChange={() => { setConfirmPettyCashExec(null); setPettyCashConfirmStep(1); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pettyCashConfirmStep === 1 ? (
                <>
                  <Wallet className="w-5 h-5 text-amber-600" />
                  Execute Petty Cash - Step 1
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-status-live" />
                  Final Confirmation
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {pettyCashConfirmStep === 1
                ? "Are you sure? This will mark the payment as PAID."
                : "FINAL: Payment will be marked as completed and funds are considered disbursed."
              }
            </DialogDescription>
          </DialogHeader>
          {confirmPettyCashExec && (
            <div className="p-4 bg-muted/30 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Payment Proof Screenshot</p>
              {pettyCashProofUrls[confirmPettyCashExec] && (
                <img
                  src={pettyCashProofUrls[confirmPettyCashExec]}
                  alt="Payment proof"
                  className="max-h-48 rounded-lg border shadow-sm"
                />
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmPettyCashExec(null); setPettyCashConfirmStep(1); }}>
              Cancel
            </Button>
            <Button
              className={pettyCashConfirmStep === 2 ? "bg-status-live hover:bg-status-live/90" : "bg-amber-600 hover:bg-amber-700"}
              onClick={confirmPettyCashExecute}
            >
              {pettyCashConfirmStep === 1 ? 'Continue' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch to Direct Conversion Dialog */}
      {
        conversionDialog && (
          <BatchToDirectConversionDialog
            open={conversionDialog.open}
            onOpenChange={(open) => {
              if (!open) setConversionDialog(null);
            }}
            payment={conversionDialog.payment}
            batchId={conversionDialog.batchId}
            batchReference={conversionDialog.batchReference}
            onSuccess={() => {
              refetch();
              refetchBatches();
            }}
          />
        )
      }

      <PaymentExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />
    </motion.div >
  );
}
