import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CreditCard, Lock, CheckCircle2, AlertCircle, FolderKanban, Banknote, ChevronRight, ShieldCheck, Crown, IndianRupee, User, ClipboardList, Tags, Users, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format, addHours } from 'date-fns';
import { usePaymentRequests, PaymentUrgency } from '@/hooks/usePaymentRequests';
import { GoogleDriveLinkInput } from '@/components/GoogleDriveLinkInput';
import { useProjects } from '@/hooks/useProjects';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useProjectPhases } from '@/hooks/useProjectPhases';
import { useLocation } from 'react-router-dom';
import { PaymentTagSelector } from '@/components/payment/PaymentTagSelector';
import { validateIFSC, validateAccountNumber } from '@/utils/paymentValidation';
import { usePaymentValidation } from '@/hooks/usePaymentValidation';
import { DuplicateWarningBanner } from '@/components/payments/DuplicateWarningBanner';
import { PaymentGuardianIndicator } from '@/components/payments/PaymentGuardianIndicator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { usePayees, Payee } from '@/hooks/usePayees';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Truck, Search, History, UserPlus, ArrowLeft, MoreVertical, Star, Info, Save as SaveIcon, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const urgencyOptions: { value: PaymentUrgency; label: string; color: string }[] = [
  { value: 'normal', label: 'Normal', color: 'text-status-live' },
  { value: 'important', label: 'Important', color: 'text-status-late' },
  { value: 'emergency', label: 'Emergency', color: 'text-status-missed' },
];

interface SplitBeneficiary {
  id: string;
  split_title: string;
  name: string;
  amount: number;
  paymentMethod: 'gpay' | 'phonepe' | 'paytm' | 'bank_transfer';
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;
  beneficiaryName?: string;
  billFiles?: File[];
  workProofFiles?: File[];
}

export function PaymentRequestPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { createRequest, isSaving, saveDraft, deleteDraft, requests: allRequests } = usePaymentRequests({ skipFetch: true });
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<Date | null>(null);
  const [myDrafts, setMyDrafts] = useState<any[]>([]);
  const { payees, addPayee } = usePayees();
  const { projects, isLoading: projectsLoading } = useProjects();
  const paymentGuardian = usePaymentValidation();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [requestId, setRequestId] = useState('');

  // Check for prefilled data from PO conversion
  const prefilledData = location.state as {
    fromPO?: boolean;
    poId?: string;
    poNumber?: number;
    vendorName?: string;
    vendorBankDetails?: string;
    vendorAccountNumber?: string;
    vendorIfscCode?: string;
    vendorBankName?: string;
    signedDocumentUrl?: string;
    amount?: number;
    purpose?: string;
    projectId?: string;
    project_id?: string;
    workOrderId?: string;
    fromWO?: boolean;
    paymentType?: 'advance' | 'final';
  } | null;

  // Form state
  const [isProjectWork, setIsProjectWork] = useState<boolean>(prefilledData?.fromPO || prefilledData?.fromWO || true);
  const [selectedProjectId, setSelectedProjectId] = useState(prefilledData?.projectId || '');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState(prefilledData?.workOrderId || '');
  const [selectedPhaseId, setSelectedPhaseId] = useState('');
  const [purpose, setPurpose] = useState(prefilledData?.purpose || '');
  const [woNumber, setWoNumber] = useState(prefilledData?.poNumber ? `PO-${String(prefilledData.poNumber).padStart(3, '0')}` : '');
  const [vendorName, setVendorName] = useState(prefilledData?.vendorName || '');

  // Payment Type state - simplified with common payment apps
  const [paymentMethod, setPaymentMethod] = useState<'gpay' | 'phonepe' | 'paytm' | 'bank_transfer'>('bank_transfer');
  const [vendorUpi, setVendorUpi] = useState('');
  const [vendorAccountNumber, setVendorAccountNumber] = useState('');
  const [vendorAccountConfirm, setVendorAccountConfirm] = useState('');
  const [vendorIfscCode, setVendorIfscCode] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [openProjectCombobox, setOpenProjectCombobox] = useState(false);

  // Legacy field for backward compatibility
  const [vendorBank, setVendorBank] = useState(prefilledData?.vendorBankDetails || '');
  const [vendorBankConfirm, setVendorBankConfirm] = useState(prefilledData?.vendorBankDetails || '');

  const [amount, setAmount] = useState(prefilledData?.amount?.toString() || '');
  const [billUrl, setBillUrl] = useState('');
  const [workProofUrl, setWorkProofUrl] = useState('');
  const [billFiles, setBillFiles] = useState<File[]>([]);
  const [workProofFiles, setWorkProofFiles] = useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [cutoffDate, setCutoffDate] = useState('');
  const [cutoffTime, setCutoffTime] = useState('');
  const [urgency, setUrgency] = useState<PaymentUrgency>('normal');
  const [detailedDescription, setDetailedDescription] = useState('');
  const [declaration, setDeclaration] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [savePayee, setSavePayee] = useState(false);

  // Split Payment State
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState<SplitBeneficiary[]>([]);
  const [currentBenTitle, setCurrentBenTitle] = useState('');
  const [currentBenName, setCurrentBenName] = useState('');
  const [currentBenAmount, setCurrentBenAmount] = useState('');
  const [currentBenMethod, setCurrentBenMethod] = useState<'gpay' | 'phonepe' | 'paytm' | 'bank_transfer'>('bank_transfer');
  const [currentBenAccount, setCurrentBenAccount] = useState('');
  const [currentBenIfsc, setCurrentBenIfsc] = useState('');
  const [currentBenUpi, setCurrentBenUpi] = useState('');
  const [currentBenOfficialName, setCurrentBenOfficialName] = useState(''); // For bank match
  const [saveSplitPayee, setSaveSplitPayee] = useState(false);
  const [payeeSearchQuery, setPayeeSearchQuery] = useState('');
  const [activePayeeTab, setActivePayeeTab] = useState<'manual' | 'saved'>('manual');
  const [selectedPayeeId, setSelectedPayeeId] = useState<string | null>(null);
  const [currentBenBillFiles, setCurrentBenBillFiles] = useState<File[]>([]);
  const [currentBenWorkProofFiles, setCurrentBenWorkProofFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);


  // Fetch work orders for selected project
  const { workOrders, isLoading: workOrdersLoading } = useWorkOrders(selectedProjectId || undefined);
  const { phases, isLoading: phasesLoading } = useProjectPhases(selectedProjectId || undefined);

  // Filter to only show approved work orders (can link payments to)
  const approvedWorkOrders = workOrders.filter(wo =>
    wo.status === 'ceo_approved' || wo.status === 'admin_approved' || wo.status === 'pending_admin' || wo.status === 'approved' || wo.status === 'ordered'
  );

  const fetchDrafts = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('requester_id', user.id)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setMyDrafts(data);
    }
  }, [user]);

  // Fetch drafts for current user
  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts, allRequests]);

  // Auto-set project work for non-billable departments
  useEffect(() => {
    const BILLABLE_DEPARTMENTS = ['Engineering', 'Agri Operations'];
    const isAgriMart = user?.department?.toLowerCase() === 'agrimart';
    const isBillableDept = BILLABLE_DEPARTMENTS.some(d =>
      user?.department?.toLowerCase().includes(d.toLowerCase())
    ) || user?.department?.toLowerCase().includes('jv') || user?.role?.toLowerCase() === 'smo';

    if (!isBillableDept && isProjectWork && user?.role?.toLowerCase() !== 'smo') {
      setIsProjectWork(false);
    }
  }, [user?.department, user?.role, isProjectWork]);

  // Auto-fill details and handle cut-off logic
  useEffect(() => {
    // Set default cut-off (Today + 2 hours)
    const now = new Date();
    setCutoffDate(format(now, 'yyyy-MM-dd'));
    setCutoffTime(format(addHours(now, 2), 'HH:mm'));

    if (prefilledData?.fromWO && selectedWorkOrderId && workOrders.length > 0) {
      const wo = workOrders.find(w => w.id === selectedWorkOrderId);
      if (wo) {
        // Use pre-filled purpose if provided, else construct one
        if (prefilledData.purpose) {
          setPurpose(prefilledData.purpose);
        } else {
          setPurpose(`Payment for WO #${wo.wo_number}: ${wo.work_description || 'Project Work'}`);
        }

        // Auto-fill tags based on payment type
        const isFinalPayment = prefilledData.paymentType === 'final';
        const isAdvancePayment = prefilledData.paymentType === 'advance';

        if (isFinalPayment) {
          setSelectedTags(['Engineering Project', 'Final Payment']);
        } else if (isAdvancePayment) {
          setSelectedTags(['Engineering Project', 'Advance Payment']);
        } else {
          setSelectedTags(['Engineering Project']);
        }

        // Auto-fill professional description
        setDetailedDescription(
          `${isFinalPayment ? 'FINAL PAYMENT (Post-Audit)' : isAdvancePayment ? 'ADVANCE PAYMENT' : 'Payment'} requested for Work Order #${wo.wo_number}.\n` +
          `Project: ${wo.project?.project_name || 'N/A'}\n` +
          `Scope: ${wo.work_description || 'N/A'}\n` +
          `Valuation: ₹${wo.estimated_amount?.toLocaleString() || '0'}` +
          (isFinalPayment ? '\n\n✅ This payment has been audited by the Data Team.' : '')
        );

        // Pre-fill amount only for Advance Payment, others might prefer manual entry or prefilled total
        if (isAdvancePayment) {
          setAmount(wo.advance_amount?.toString() || '');
        } else {
          setAmount('');
        }

        // Auto-fill BOTH proof fields with signed work order document
        const proofLink = prefilledData.signedDocumentUrl || wo.signed_document_url || '';
        if (proofLink) {
          setBillUrl(proofLink); // Proof Folder
          setWorkProofUrl(proofLink); // Bank Proof
        }

        // Payee details: prefer navigation state (direct), fallback to joined vendor_request
        const navVendorName = prefilledData.vendorName;
        const navAccount = prefilledData.vendorAccountNumber;
        const navIfsc = prefilledData.vendorIfscCode;
        const vendorReq = wo.vendor_request;

        let finalVendorName = navVendorName || vendorReq?.aligned_vendor_name || '';
        let finalAccount = navAccount || vendorReq?.vendor_account_number || '';
        let finalIfsc = navIfsc || vendorReq?.vendor_ifsc || '';

        // Direct DB fallback: if vendor join is empty, fetch from vendor_work_requests by project_id
        if (!finalAccount && wo.project_id) {
          (supabase as any)
            .from('vendor_work_requests')
            .select('aligned_vendor_name, vendor_account_number, vendor_ifsc, vendor_bank_name')
            .eq('project_id', wo.project_id)
            .not('vendor_account_number', 'is', null)
            .limit(1)
            .single()
            .then(({ data: vrData }: { data: any }) => {
              if (vrData) {
                if (!finalVendorName && vrData.aligned_vendor_name) {
                  setVendorName(vrData.aligned_vendor_name);
                  setBeneficiaryName(vrData.aligned_vendor_name);
                }
                if (vrData.vendor_account_number) {
                  setVendorAccountNumber(vrData.vendor_account_number);
                  setVendorAccountConfirm(vrData.vendor_account_number);
                  setPaymentMethod('bank_transfer');
                }
                if (vrData.vendor_ifsc) {
                  setVendorIfscCode(vrData.vendor_ifsc);
                }
              }
            })
            .catch(() => { /* no vendor data found */ });
        }

        if (finalVendorName) {
          setVendorName(finalVendorName);
          setBeneficiaryName(finalVendorName);
        }
        if (finalAccount) {
          setVendorAccountNumber(finalAccount);
          setVendorAccountConfirm(finalAccount);
          setPaymentMethod('bank_transfer');
        }
        if (finalIfsc) {
          setVendorIfscCode(finalIfsc);
        }
      }
    }
  }, [prefilledData?.fromWO, selectedWorkOrderId, workOrders, prefilledData?.purpose, prefilledData?.signedDocumentUrl, prefilledData?.vendorName, prefilledData?.vendorAccountNumber, prefilledData?.vendorIfscCode, prefilledData?.paymentType]);

  // Auto-set phase from linked work order (if available)
  useEffect(() => {
    if (!selectedWorkOrderId || selectedWorkOrderId === 'none') return;
    const wo = workOrders.find(w => w.id === selectedWorkOrderId);
    const woPhaseId = wo?.boq_item?.phase?.id || wo?.boq_item?.phase_id || '';
    if (woPhaseId) {
      setSelectedPhaseId(woPhaseId);
    }
  }, [selectedWorkOrderId, workOrders]);

  // Auto-save logic
  useEffect(() => {
    if (!user || isSubmitted || isSaving) return;

    // Don't auto-save if form is essentially empty
    if (!purpose.trim() && !vendorName.trim() && (!amount || parseFloat(amount) <= 0)) return;

    const timer = setTimeout(async () => {
      setIsAutoSaving(true);
      const result = await saveDraft({
        id: currentDraftId || undefined,
        isProjectWork,
        purpose: purpose || 'Untitled Draft',
        vendorName: vendorName || 'New Payee',
        vendorBankDetails: paymentMethod === 'bank_transfer' ? `A/C: ${vendorAccountNumber}, IFSC: ${vendorIfscCode}` : `UPI: ${vendorUpi}`,
        amount: parseFloat(amount) || 0,
        projectId: selectedProjectId || undefined,
        phaseId: selectedPhaseId && selectedPhaseId !== 'none' ? selectedPhaseId : undefined,
        workOrderId: selectedWorkOrderId && selectedWorkOrderId !== 'none' ? selectedWorkOrderId : undefined,
        paymentType: paymentMethod,
        vendorUpi,
        vendorAccountNumber,
        vendorIfscCode,
        beneficiaryName,
        detailedDescription,
        tags: selectedTags,
        urgency,
        billUrl,
        workProofUrl,
        cutoffDate,
        cutoffTime,
        woNumber: isProjectWork ? woNumber : undefined,
        isSplitPayment,
        splits: beneficiaries.map(b => ({
          split_title: b.split_title,
          payee_name: b.name,
          beneficiary_name: b.beneficiaryName || b.name,
          amount: b.amount,
          payment_method: b.paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'upi',
          account_number: b.accountNumber,
          ifsc_code: b.ifsc,
          upi_id: b.upiId,
        })),
      } as any);

      if (result.success && result.data) {
        if (!currentDraftId) {
          setCurrentDraftId(result.data.id);
        }
        setLastAutoSavedAt(new Date());
      }
      setIsAutoSaving(false);
    }, 2500); // 2.5 second debounce

    return () => clearTimeout(timer);
  }, [
    purpose, vendorName, amount, selectedProjectId, vendorAccountNumber,
    vendorIfscCode, vendorUpi, detailedDescription, selectedTags, urgency,
    billUrl, workProofUrl, cutoffDate, cutoffTime, isProjectWork, woNumber,
    isSplitPayment, beneficiaries, paymentMethod, beneficiaryName,
    selectedPhaseId, selectedWorkOrderId, currentDraftId, saveDraft, isSaving
  ]);

  const handleLoadDraft = (draft: any) => {
    setCurrentDraftId(draft.id);
    setIsProjectWork(draft.is_project_work);
    setSelectedProjectId(draft.project_id || '');
    setSelectedPhaseId(draft.phase_id || '');
    setSelectedWorkOrderId(draft.work_order_id || '');
    setPurpose(draft.purpose || '');
    setWoNumber(draft.wo_number || '');
    setVendorName(draft.vendor_name || '');
    setAmount(draft.amount?.toString() || '');
    setDetailedDescription(draft.detailed_description || '');
    setUrgency(draft.urgency || 'normal');
    setSelectedTags(draft.tags || []);

    // Determine payment method from data
    if (draft.payment_type) {
      setPaymentMethod(draft.payment_type);
    } else if (draft.vendor_upi) {
      setPaymentMethod('gpay'); // Default to gpay if UPI exists
    } else {
      setPaymentMethod('bank_transfer');
    }

    setVendorUpi(draft.vendor_upi || '');
    setVendorAccountNumber(draft.vendor_account_number || '');
    setVendorAccountConfirm(draft.vendor_account_number || '');
    setVendorIfscCode(draft.vendor_ifsc_code || '');
    setBeneficiaryName(draft.beneficiary_name || '');

    setBillUrl(draft.bill_url || '');
    setWorkProofUrl(draft.work_proof_url || '');
    setCutoffDate(draft.cutoff_date || '');
    setCutoffTime(draft.cutoff_time || '');

    // Load splits if they exist
    setIsSplitPayment(draft.is_split_payment || false);
    if (draft.is_split_payment && draft.splits) {
      setBeneficiaries(draft.splits.map((s: any) => ({
        id: s.id,
        split_title: s.split_title,
        name: s.payee_name,
        amount: Number(s.amount),
        paymentMethod: s.payment_method === 'upi' ? 'gpay' : s.payment_method, // Default back to gpay if upi
        accountNumber: s.account_number,
        ifsc: s.ifsc_code,
        upiId: s.upi_id,
        beneficiaryName: s.beneficiary_name
      })));
    } else {
      setBeneficiaries([]);
    }

    toast.success('Draft loaded successfully');
  };

  const handleManualSaveDraft = async () => {
    setIsAutoSaving(true);
    const result = await saveDraft({
      id: currentDraftId || undefined,
      isProjectWork,
      purpose: purpose || 'Untitled Draft',
      vendorName: vendorName || 'New Payee',
      vendorBankDetails: paymentMethod === 'bank_transfer' ? `A/C: ${vendorAccountNumber}, IFSC: ${vendorIfscCode}` : `UPI: ${vendorUpi}`,
      amount: parseFloat(amount) || 0,
      projectId: selectedProjectId || undefined,
      phaseId: selectedPhaseId && selectedPhaseId !== 'none' ? selectedPhaseId : undefined,
      workOrderId: selectedWorkOrderId && selectedWorkOrderId !== 'none' ? selectedWorkOrderId : undefined,
      paymentType: paymentMethod,
      vendorUpi,
      vendorAccountNumber,
      vendorIfscCode,
      beneficiaryName,
      detailedDescription,
      tags: selectedTags,
      urgency,
      billUrl,
      workProofUrl,
      cutoffDate,
      cutoffTime,
      woNumber: isProjectWork ? woNumber : undefined,
      isSplitPayment,
      splits: beneficiaries.map(b => ({
        split_title: b.split_title,
        payee_name: b.name,
        beneficiary_name: b.beneficiaryName || b.name,
        amount: b.amount,
        payment_method: b.paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'upi',
        account_number: b.accountNumber,
        ifsc_code: b.ifsc,
        upi_id: b.upiId,
      })),
    } as any);

    if (result.success && result.data) {
      if (!currentDraftId) setCurrentDraftId(result.data.id);
      setLastAutoSavedAt(new Date());
      toast.success('Draft saved manually');
      fetchDrafts();
    } else {
      toast.error('Failed to save draft');
    }
    setIsAutoSaving(false);
  };

  const handleDeleteDraft = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent loading the draft when clicking delete
    if (confirm('Are you sure you want to delete this draft?')) {
      const result = await deleteDraft(id);
      if (result.success) {
        fetchDrafts();
        if (currentDraftId === id) {
          setCurrentDraftId(null);
          resetForm();
        }
      }
    }
  };

  const handleSubmit = async () => {
    // Validations
    if (!purpose.trim()) {
      toast.error('Please provide a purpose');
      return;
    }
    if (isProjectWork && !selectedProjectId) {
      toast.error('Please select a project');
      return;
    }
    const isEngineering = (user?.department || '').toLowerCase().includes('engineering') || (user?.department || '').toLowerCase().includes('jv') || user?.role?.toLowerCase() === 'smo';
    if (isProjectWork && isEngineering) {
      if (!selectedPhaseId) {
        toast.error('Please select a project phase');
        return;
      }
      if (!phasesLoading && phases.length === 0) {
        toast.error('No project phases configured. Please contact Admin.');
        return;
      }
    }


    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please provide a valid total amount');
      return;
    }

    if (!isSplitPayment && !billUrl.trim() && billFiles.length === 0) {
      toast.error('Please provide bill/invoice proof file or link');
      return;
    }
    if (!isSplitPayment && !workProofUrl.trim() && workProofFiles.length === 0) {
      toast.error('Please provide bank proof document');
      return;
    }
    if (!cutoffDate || !cutoffTime) {
      toast.error('Please provide cut-off date and time');
      return;
    }
    if (!declaration) {
      toast.error('You must accept the declaration');
      return;
    }

    // --- FILE UPLOAD LOGIC ---
    setIsUploadingFiles(true);
    let finalBillUrl = billUrl;
    let finalWorkProofUrl = workProofUrl;

    try {
      const addedBillUrls: string[] = [];
      const addedWorkProofUrls: string[] = [];

      for (const file of billFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `${user?.id}/payment-proofs/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('payment-proofs').getPublicUrl(filePath);
        addedBillUrls.push(data.publicUrl);
      }

      for (const file of workProofFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `${user?.id}/bank-proofs/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('payment-proofs').getPublicUrl(filePath);
        addedWorkProofUrls.push(data.publicUrl);
      }

      const allBillUrls = [billUrl, ...addedBillUrls].filter(Boolean);
      const allWorkProofUrls = [workProofUrl, ...addedWorkProofUrls].filter(Boolean);

      finalBillUrl = allBillUrls.join(',');
      finalWorkProofUrl = allWorkProofUrls.join(',');

    } catch (error: any) {
      toast.error(error.message || 'Failed to upload files. Please try again.');
      setIsUploadingFiles(false);
      return;
    }
    setIsUploadingFiles(false);

    // --- SPLIT PAYMENT LOGIC ---
    if (isSplitPayment) {
      if (beneficiaries.length < 2) {
        toast.error('Please add at least two beneficiaries for split payment');
        return;
      }

      const totalSplit = beneficiaries.reduce((sum, b) => sum + b.amount, 0);
      const mainAmount = parseFloat(amount);

      if (Math.abs(totalSplit - mainAmount) > 1) { // 1 rupee tolerance
        toast.error(`Split total (₹${totalSplit.toLocaleString()}) does not match Total Amount (₹${mainAmount.toLocaleString()})`);
        return;
      }

      try {
        const result = await createRequest({
          isProjectWork,
          purpose,
          woNumber: isProjectWork ? woNumber : undefined,
          vendorName: 'SPLIT PAYMENT BATCH',
          vendorBankDetails: 'See Split Details',
          amount: mainAmount,
          billUrl: finalBillUrl,
          workProofUrl: finalWorkProofUrl,
          cutoffDate,
          cutoffTime,
          urgency,
          projectId: isProjectWork ? selectedProjectId : undefined,
          phaseId: isProjectWork && selectedPhaseId && selectedPhaseId !== 'none' ? selectedPhaseId : undefined,
          isSplitPayment: true,
          splits: await Promise.all(beneficiaries.map(async b => {
            const addedSplitBillUrls: string[] = [];
            const addedSplitWorkProofUrls: string[] = [];

            if (b.billFiles) {
              for (const file of b.billFiles) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
                const filePath = `${user?.id}/payment-proofs/${fileName}`;
                const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(filePath, file);
                if (uploadError) throw uploadError;
                const { data } = supabase.storage.from('payment-proofs').getPublicUrl(filePath);
                addedSplitBillUrls.push(data.publicUrl);
              }
            }

            if (b.workProofFiles) {
              for (const file of b.workProofFiles) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
                const filePath = `${user?.id}/bank-proofs/${fileName}`;
                const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(filePath, file);
                if (uploadError) throw uploadError;
                const { data } = supabase.storage.from('payment-proofs').getPublicUrl(filePath);
                addedSplitWorkProofUrls.push(data.publicUrl);
              }
            }

            return {
              split_title: b.split_title,
              payee_name: b.name,
              beneficiary_name: b.beneficiaryName || b.name,
              amount: b.amount,
              payment_method: b.paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'upi',
              account_number: b.accountNumber,
              ifsc_code: b.ifsc,
              upi_id: b.upiId,
              bill_url: addedSplitBillUrls.length > 0 ? addedSplitBillUrls.join(',') : undefined,
              work_proof_url: addedSplitWorkProofUrls.length > 0 ? addedSplitWorkProofUrls.join(',') : undefined,
            };
          })),
          workOrderId: isProjectWork && selectedWorkOrderId && selectedWorkOrderId !== 'none' ? selectedWorkOrderId : undefined,
          tags: selectedTags,
          detailedDescription: detailedDescription.trim(),
          id: currentDraftId || undefined,
          overrideReason: paymentGuardian.overrideReason,
          isOverridden: paymentGuardian.overrideApplied,
          originalDuplicateScore: paymentGuardian.confidence || 0,
        } as any);

        if (result.success && result.data) {
          setCurrentDraftId(null);
          setIsSubmitted(true);
          if (result.data.id) setRequestId(result.data.id.substring(0, 8));
          toast.success(`Successfully created split payment batch!`);
        } else {
          console.error(`Split Payment Submission Failure:`, result.error);
          toast.error('Failed to create split payment batch');
        }
      } catch (err) {
        console.error('Unexpected Split Submission Error:', err);
        toast.error('An unexpected error occurred');
      }
      return;
    }

    // --- SINGLE PAYMENT LOGIC (Existing) ---
    // Project validation (no budget check)
    if (!vendorName.trim()) {
      toast.error('Please provide payee name');
      return;
    }

    // Payment method validations
    const isUpiPayment = ['gpay', 'phonepe', 'paytm'].includes(paymentMethod);
    if (isUpiPayment) {
      if (!vendorUpi.trim()) {
        toast.error('Please provide UPI ID / Phone Number');
        return;
      }
    } else if (paymentMethod === 'bank_transfer') {
      if (!vendorAccountNumber.trim()) {
        toast.error('Please provide account number');
        return;
      }
      // Validate account number format (9-18 digits)
      if (!validateAccountNumber(vendorAccountNumber)) {
        toast.error('Invalid account number format - must be 9-18 digits');
        return;
      }
      if (vendorAccountNumber !== vendorAccountConfirm) {
        toast.error('Account numbers do not match');
        return;
      }
      if (!vendorIfscCode.trim()) {
        toast.error('Please provide IFSC code');
        return;
      }
      // Validate IFSC format (XXXX0XXXXXX)
      if (!validateIFSC(vendorIfscCode)) {
        toast.error('Invalid IFSC code format - must be like ABCD0123456');
        return;
      }
    }

    // Build vendor bank details string for legacy field
    let vendorBankDetails = '';
    if (isUpiPayment) {
      vendorBankDetails = `${paymentMethod.toUpperCase()}: ${vendorUpi}`;
    } else if (paymentMethod === 'bank_transfer') {
      vendorBankDetails = `A/C: ${vendorAccountNumber}, IFSC: ${vendorIfscCode}`;
    } else {
      vendorBankDetails = 'Cash Payment';
    }

    try {
      const result = await createRequest({
        isProjectWork,
        purpose,
        woNumber: isProjectWork ? woNumber : undefined,
        vendorName,
        vendorBankDetails,
        amount: parseFloat(amount),
        billUrl: finalBillUrl,
        workProofUrl: finalWorkProofUrl,
        cutoffDate,
        cutoffTime,
        urgency,
        projectId: isProjectWork ? selectedProjectId : undefined,
        phaseId: isProjectWork && selectedPhaseId && selectedPhaseId !== 'none' ? selectedPhaseId : undefined,
        // Extended fields
        paymentType: isUpiPayment ? 'upi' : paymentMethod,
        vendorUpi: isUpiPayment ? vendorUpi : undefined,
        vendorAccountNumber: paymentMethod === 'bank_transfer' ? vendorAccountNumber : undefined,
        vendorIfscCode: paymentMethod === 'bank_transfer' ? vendorIfscCode.toUpperCase().trim() : undefined,
        tags: selectedTags,
        detailedDescription: detailedDescription.trim(),
        id: currentDraftId || undefined,
        workOrderId: isProjectWork && selectedWorkOrderId && selectedWorkOrderId !== 'none' ? selectedWorkOrderId : undefined,
        // Payment Guardian Overrides
        overrideReason: paymentGuardian.overrideReason,
        isOverridden: paymentGuardian.overrideApplied,
        originalDuplicateScore: paymentGuardian.confidence || 0,
      } as any);

      if (result.success && result.data) {
        setCurrentDraftId(null);
        setIsSubmitted(true);
        if (result.data.id) setRequestId(result.data.id.substring(0, 8)); // Short ID
        toast.success('Payment request submitted successfully!');

        // Save payee if requested
        if (savePayee && paymentMethod === 'bank_transfer' && vendorAccountNumber) {
          const existing = payees.find(p => p.account_number === vendorAccountNumber);
          if (!existing) {
            await addPayee({
              name: vendorName,
              account_number: vendorAccountNumber,
              ifsc_code: vendorIfscCode.toUpperCase(),
              bank_name: '' // Could be derived or added later
            });
          }
        }
      } else {
        console.error('Payment Submission Failure:', result.error);
        toast.error('Failed to submit payment request');
      }
    } catch (err) {
      console.error('Unexpected Submission Error:', err);
      toast.error('An unexpected error occurred during submission.');
    }
  };

  const handleAddBeneficiary = async () => {
    if (!currentBenTitle.trim() || currentBenTitle.trim().length < 5) {
      toast.error('Split Title/Purpose must be at least 5 characters');
      return;
    }
    if (!currentBenName) {
      toast.error('Payee Name is required');
      return;
    }
    if (!currentBenAmount || parseFloat(currentBenAmount) <= 0) {
      toast.error('Valid amount is required');
      return;
    }

    const isUpi = ['gpay', 'phonepe', 'paytm'].includes(currentBenMethod);
    if (isUpi && !currentBenUpi) {
      toast.error('UPI ID is required');
      return;
    }
    if (!isUpi && (!currentBenAccount || !currentBenIfsc)) {
      toast.error('Account Number and IFSC are required');
      return;
    }

    if (currentBenBillFiles.length === 0) {
      toast.error('Please upload at least one Proof Folder / Bill file for this beneficiary');
      return;
    }

    if (currentBenWorkProofFiles.length === 0) {
      toast.error('Please upload at least one Bank Proof file for this beneficiary');
      return;
    }

    const newBen: SplitBeneficiary = {
      id: Date.now().toString(),
      split_title: currentBenTitle.trim(),
      name: currentBenName,
      amount: parseFloat(currentBenAmount),
      paymentMethod: currentBenMethod,
      accountNumber: !isUpi ? currentBenAccount : undefined,
      ifsc: !isUpi ? currentBenIfsc : undefined,
      beneficiaryName: !isUpi ? currentBenOfficialName : undefined,
      upiId: isUpi ? currentBenUpi : undefined,
      billFiles: currentBenBillFiles,
      workProofFiles: currentBenWorkProofFiles,
    };

    // Save payee if requested
    if (saveSplitPayee && !isUpi && currentBenAccount && currentBenIfsc) {
      const existing = payees.find(p => p.account_number === currentBenAccount);
      if (!existing) {
        // We don't await here to keep UI responsive, or we can toast
        addPayee({
          name: currentBenName,
          account_number: currentBenAccount,
          ifsc_code: currentBenIfsc,
          bank_name: ''
        });
        toast.success('Payee saved to master list');
      }
    }

    setBeneficiaries([...beneficiaries, newBen]);

    // Reset current ben fields
    setCurrentBenTitle('');
    setCurrentBenName('');
    setCurrentBenAmount('');
    setCurrentBenAccount('');
    setCurrentBenIfsc('');
    setCurrentBenUpi('');
    setCurrentBenOfficialName('');
    setCurrentBenBillFiles([]);
    setCurrentBenWorkProofFiles([]);
    setSaveSplitPayee(false);
    setFileInputKey(prev => prev + 1);
    toast.success('Beneficiary added to list');
  };

  const removeBeneficiary = (id: string) => {
    setBeneficiaries(beneficiaries.filter(b => b.id !== id));
  };

  const handleSelectPayee = (payee: Payee) => {
    setVendorName(payee.name);
    setPaymentMethod('bank_transfer'); // Load saved usually implies bank for now
    setVendorAccountNumber(payee.account_number || '');
    setVendorAccountConfirm(payee.account_number || '');
    setVendorIfscCode(payee.ifsc_code || '');
    setBeneficiaryName(payee.name);
    setSelectedPayeeId(payee.id);
    setActivePayeeTab('manual');
    toast.success(`Loaded details for ${payee.name}`);
  };

  const handleClearSelectedPayee = () => {
    setSelectedPayeeId(null);
    setVendorName('');
    setVendorAccountNumber('');
    setVendorAccountConfirm('');
    setVendorIfscCode('');
    setBeneficiaryName('');
  };

  const resetForm = () => {
    setIsSubmitted(false);
    setIsProjectWork(true);
    setSelectedProjectId('');
    setSelectedWorkOrderId('');
    setPurpose('');
    setWoNumber('');
    setVendorName('');
    setPaymentMethod('bank_transfer');
    setVendorUpi('');
    setVendorAccountNumber('');
    setBeneficiaryName('');
    setVendorAccountConfirm('');
    setVendorIfscCode('');
    setVendorBank('');
    setVendorBankConfirm('');
    setAmount('');
    setBillUrl('');
    setWorkProofUrl('');
    setBillFiles([]);
    setWorkProofFiles([]);
    setCutoffDate('');
    setCutoffTime('');
    setUrgency('normal');
    setDeclaration(false);
    setFileInputKey(prev => prev + 1);
    paymentGuardian.resetValidation();
  };

  // Trigger Payment Guardian check when key fields change (debounced in hook)
  const triggerGuardianCheck = useCallback(() => {
    if (!user || isSplitPayment) return;
    if (vendorName.trim().length >= 3 && parseFloat(amount) > 0) {
      paymentGuardian.validatePayment({
        vendor_name: vendorName,
        amount: parseFloat(amount),
        vendor_account_number: vendorAccountNumber || undefined,
        vendor_ifsc_code: vendorIfscCode || undefined,
        vendor_upi: vendorUpi || undefined,
        bill_url: billUrl || undefined,
      });
    }
  }, [vendorName, amount, vendorAccountNumber, vendorIfscCode, vendorUpi, billUrl, isSplitPayment, user]);

  useEffect(() => {
    triggerGuardianCheck();
  }, [triggerGuardianCheck]);

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl mx-auto"
      >
        <div className="authority-card overflow-hidden !p-0">
          {/* Top Banner with Gradient */}
          <div className="h-32 bg-gradient-to-br from-status-live/20 via-status-live/5 to-transparent flex items-center justify-center border-b border-status-live/10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
              className="w-20 h-20 rounded-full bg-status-live/30 flex items-center justify-center backdrop-blur-sm border-2 border-status-live/50"
            >
              <CheckCircle2 className="w-10 h-10 text-status-live" />
            </motion.div>
          </div>

          <div className="p-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-3xl font-bold mb-3 tracking-tight">Request Submitted</h2>
              <p className="text-muted-foreground mb-8 text-lg">
                Your payment request has been logged successfully and is currently
                <span className="text-primary font-semibold"> awaiting Admin compliance check.</span>
              </p>
            </motion.div>

            {/* Unified Confirmation Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="relative p-6 bg-muted/20 rounded-2xl border border-primary/10 mb-8 overflow-hidden group"
            >
              {/* Subtle Background Pattern */}
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <ShieldCheck className="w-20 h-20" />
              </div>

              <div className="flex flex-col items-center gap-1 mb-4">
                <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Transaction Reference</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-mono font-black text-primary">PAY-{requestId}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 h-hover:bg-primary/20"
                    onClick={() => {
                      navigator.clipboard.writeText(`PAY-${requestId}`);
                      toast.success('Reference ID copied');
                    }}
                  >
                    <ClipboardList className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/5">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full border-2 border-card bg-muted/80 flex items-center justify-center">
                    <Lock className="w-3 h-3 text-muted-foreground" />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  This transaction is now <span className="text-foreground uppercase italic px-1">Immutable</span>
                </span>
                <span className="text-muted-foreground">|</span>
                <span className="text-[10px] text-muted-foreground italic">No further edits permitted</span>
              </div>
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button
                variant="outline"
                onClick={resetForm}
                className="h-14 px-8 text-base border-2 hover:bg-muted/50 rounded-xl transition-all"
              >
                Submit Another Request
              </Button>
              <Button
                onClick={() => window.location.href = '/my-requests'}
                className="h-14 px-8 text-base bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-primary/20 transition-all font-bold"
              >
                View Request History
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">Payment Request</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            Submit a new payment for approval chain
            {isAutoSaving ? (
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse font-bold">
                <SaveIcon className="w-3 h-3" /> Auto-saving...
              </span>
            ) : lastAutoSavedAt && (
              <span className="text-[10px] text-muted-foreground">
                (Last saved at {format(lastAutoSavedAt, 'HH:mm:ss')})
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-12 gap-2 border-primary/20 hover:bg-primary/5 hover:border-primary/50 text-primary font-bold"
            onClick={() => navigate('/porter-payment')}
          >
            <Truck className="w-5 h-5" />
            Porter Payment
          </Button>
          <Button
            variant="outline"
            className="h-12 gap-2 border-emerald-500/20 hover:bg-emerald-500/5 hover:border-emerald-500/50 text-emerald-500 font-bold"
            onClick={() => navigate('/transport-payment')}
          >
            <Truck className="w-5 h-5" />
            Transport Payment
          </Button>
        </div>
      </div>

      {myDrafts.length > 0 && (
        <div className="mb-8 overflow-hidden rounded-2xl border-2 border-primary/10 bg-background/50 backdrop-blur-sm shadow-xl shadow-primary/5">
          <div className="p-4 bg-muted/20 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ClipboardList className="w-5 h-5 text-primary" />
              </div>
              <div>
                <Label className="text-base font-bold text-primary">Unfinished Drafts</Label>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Resume Work</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold">
              {myDrafts.length}
            </Badge>
          </div>

          <div className="p-2 max-h-[200px] overflow-y-auto">
            <div className="grid grid-cols-1 gap-1">
              {myDrafts.map((draft) => (
                <button
                  key={draft.id}
                  onClick={() => handleLoadDraft(draft)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border border-transparent hover:border-primary/40 hover:bg-primary/5 transition-all group flex items-center justify-between",
                    currentDraftId === draft.id && "bg-primary/10 border-primary/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary text-xs font-bold">
                      {draft.purpose?.charAt(0) || 'D'}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">{draft.purpose || 'Untitled Draft'}</h4>
                      <p className="text-[10px] text-muted-foreground">
                        Last edited: {format(new Date(draft.updated_at), 'MMM d, HH:mm')} • ₹{draft.amount || 0}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      onClick={(e) => handleDeleteDraft(e, draft.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}


      <div className="authority-card">
        {/* Auto Info Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6 p-3 md:p-4 rounded-lg bg-muted/30 border border-border">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Requester</p>
            <p className="font-medium text-sm md:text-base truncate">{user?.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Department</p>
            <p className="font-medium text-sm md:text-base">{user?.department}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Employee ID</p>
            <p className="font-medium text-sm md:text-base">{user?.employeeId}</p>
          </div>
        </div>

        {/* Work Type Toggle - MODULE 4: Only show for Engineering/Agri departments */}
        {(() => {
          const BILLABLE_DEPARTMENTS = ['Engineering', 'Agri Operations'];
          const isAgriMart = user?.department?.toLowerCase() === 'agrimart';
          const isBillableDept = (BILLABLE_DEPARTMENTS.some(d =>
            user?.department?.toLowerCase().includes(d.toLowerCase())
          ) || user?.role?.toLowerCase() === 'smo') && !isAgriMart;

          if (!isBillableDept) {
            // Auto-set logic moved to useEffect
            return (
              <div className="mb-6 p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <Label className="text-sm font-medium">Operational Expense</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {user?.department} department - expenses are non-project based
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="mb-6 p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Work Type</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isProjectWork ? 'Billable project work (WO required)' : 'Internal / non-project expense'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${!isProjectWork ? 'text-foreground' : 'text-muted-foreground'}`}>
                    Non-Project
                  </span>
                  <Switch checked={isProjectWork} onCheckedChange={setIsProjectWork} />
                  <span className={`text-sm ${isProjectWork ? 'text-foreground' : 'text-muted-foreground'}`}>
                    Project
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Purpose */}
        <div className="mb-6">
          <Label className="text-sm font-medium mb-2 block">Purpose (One-line) *</Label>
          <Input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="E.g., Material purchase for Site A foundation work"
          />
        </div>

        {/* Detailed Description */}
        {/* Payment Category Tags - Enhanced UI */}
        <div className="mb-6 p-4 rounded-xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Tags className="w-4 h-4 text-primary" />
            </div>
            <div>
              <Label className="text-sm font-semibold">Payment Category</Label>
              <p className="text-xs text-muted-foreground">
                Categorize this payment for better tracking & reporting
              </p>
            </div>
          </div>
          <PaymentTagSelector
            value={selectedTags}
            onChange={setSelectedTags}
            department={user?.department}
          />
        </div>

        {/* Detailed Description */}
        <div className="mb-6">
          <Label className="text-sm font-medium mb-2 block">Detailed Description</Label>
          <Textarea
            value={detailedDescription}
            onChange={(e) => setDetailedDescription(e.target.value)}
            placeholder="Provide more details about the payment request, work done, materials purchased, etc."
            rows={4}
          />
        </div>

        {/* Project Selection (if project work) */}
        {isProjectWork && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6"
          >
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-4">
                <FolderKanban className="w-5 h-5 text-primary" />
                <Label className="text-base font-medium">Project Selection *</Label>
              </div>
              <Popover open={openProjectCombobox} onOpenChange={setOpenProjectCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openProjectCombobox}
                    className="w-full justify-between h-auto min-h-[50px] py-3 text-left font-normal"
                  >
                    {selectedProjectId
                      ? projects.find((project) => project.id === selectedProjectId)?.project_name || "Select project..."
                      : "Select project..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search projects..." />
                    <CommandList>
                      <CommandEmpty>No project found.</CommandEmpty>
                      <CommandGroup>
                        {projectsLoading ? (
                          <CommandItem disabled>Loading projects...</CommandItem>
                        ) : projects.length === 0 ? (
                          <CommandItem disabled>No active projects found</CommandItem>
                        ) : (
                          projects.map((project) => (
                            <CommandItem
                              key={project.id}
                              value={project.project_name} // Search by name
                              onSelect={() => {
                                setSelectedProjectId(project.id);
                                setSelectedPhaseId('');
                                setSelectedWorkOrderId('');
                                setOpenProjectCombobox(false);
                              }}
                              className="flex flex-col items-start py-3 gap-1"
                            >
                              <div className="flex items-center w-full">
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0",
                                    selectedProjectId === project.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="font-medium">{project.project_id} - {project.project_name}</span>
                              </div>
                              <div className="flex items-center gap-2 pl-6 mt-1">
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-[10px] uppercase font-bold tracking-wider rounded-sm",
                                    // Civil = Blue/Indigo theme
                                    project.vertical?.toLowerCase().includes('civil') && "bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200",
                                    // Agri = Emerald/Green theme
                                    project.vertical?.toLowerCase().includes('agri') && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
                                    // Default/Others
                                    !project.vertical?.toLowerCase().includes('civil') && !project.vertical?.toLowerCase().includes('agri') && "bg-slate-100 text-slate-600"
                                  )}
                                >
                                  {project.vertical || 'General'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  • {project.location_city}
                                </span>
                              </div>
                            </CommandItem>
                          ))
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedProjectId && (
                <div className="mt-3 p-2 rounded bg-muted/50 text-sm">
                  <span className="text-muted-foreground">Project: </span>
                  <span className="font-bold text-primary">
                    {projects.find(p => p.id === selectedProjectId)?.project_name || 'N/A'}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Phase Selection (if project selected) */}
        {isProjectWork && selectedProjectId && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6"
          >
            <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="w-5 h-5 text-emerald-500" />
                <Label className="text-base font-medium">Project Phase {phases.length > 0 ? '*' : '(Optional)'}</Label>
              </div>
              <Select
                value={selectedPhaseId || (phases.length === 0 ? 'none' : '')}
                onValueChange={(value) => setSelectedPhaseId(value === 'none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={phasesLoading ? 'Loading phases...' : 'Select a phase...'} />
                </SelectTrigger>
                <SelectContent>
                  {phasesLoading ? (
                    <SelectItem value="loading" disabled>Loading phases...</SelectItem>
                  ) : phases.length === 0 ? (
                    <SelectItem value="none">General / Not specified</SelectItem>
                  ) : (
                    phases.map(phase => (
                      <SelectItem key={phase.id} value={phase.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{phase.phase_name}</span>
                          <span className="text-xs text-muted-foreground">
                            Phase {phase.phase_order} â€¢ {phase.status}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedPhaseId && selectedPhaseId !== 'none' && (
                <div className="mt-3 p-2 rounded bg-emerald-500/10 text-sm">
                  <span className="text-muted-foreground">Selected Phase: </span>
                  <span className="font-bold text-emerald-500">
                    {phases.find(p => p.id === selectedPhaseId)?.phase_name || 'N/A'}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Link to Work Order (if project selected) */}
        {isProjectWork && selectedProjectId && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6"
          >
            <div className="p-4 rounded-lg bg-violet-500/5 border border-violet-500/20">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="w-5 h-5 text-violet-500" />
                <Label className="text-base font-medium">Link to Work Order (Optional)</Label>
              </div>
              <Select value={selectedWorkOrderId} onValueChange={setSelectedWorkOrderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a work order to link..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No work order linked</SelectItem>
                  {workOrdersLoading ? (
                    <SelectItem value="loading" disabled>Loading work orders...</SelectItem>
                  ) : approvedWorkOrders.length === 0 ? (
                    <SelectItem value="no-wo" disabled>No approved work orders for this project</SelectItem>
                  ) : (
                    approvedWorkOrders.map(wo => (
                      <SelectItem key={wo.id} value={wo.id}>
                        <div className="flex flex-col">
                          <span className="font-mono">WO-{String(wo.wo_number).padStart(4, '0')}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                            {wo.work_description} • ₹{wo.estimated_amount.toLocaleString()}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedWorkOrderId && (
                <div className="mt-3 p-2 rounded bg-violet-500/10 text-sm">
                  <span className="text-muted-foreground">Linked WO: </span>
                  <span className="font-bold text-violet-400">
                    WO-{String(approvedWorkOrders.find(wo => wo.id === selectedWorkOrderId)?.wo_number || 0).padStart(4, '0')}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* WO Number (if project) */}
        {isProjectWork && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6"
          >
            <Label className="text-sm font-medium mb-2 block">Work Order Reference Number (Optional)</Label>
            <Input
              value={woNumber}
              onChange={(e) => setWoNumber(e.target.value)}
              placeholder="E.g., WO-2024-001 (optional if linked above)"
            />
          </motion.div>
        )}

        {/* Payee Section - Conditional */}
        {/* Toggle Split Payment - Themed */}
        <div className="mb-6 flex items-center justify-between p-4 rounded-lg bg-primary/10 border border-primary/30">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <Label className="text-base font-semibold text-primary">Split Payment / Multi-Beneficiary</Label>
              <p className="text-xs text-primary/80">Break down the total amount into multiple payments</p>
            </div>
          </div>
          <Switch checked={isSplitPayment} onCheckedChange={setIsSplitPayment} />
        </div>

        {isSplitPayment ? (
          <div className="mb-6 space-y-4">
            {/* Beneficiary List Builder */}
            <div className="p-4 rounded-lg bg-muted/40 border-2 dashed border-muted">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-primary">
                <Plus className="w-4 h-4" /> Add Split Beneficiary
              </h3>

              {/* NEW: Split Title/Purpose */}
              <div className="mb-4">
                <Label className="text-sm mb-1">Split Title / Purpose *</Label>
                <Input
                  value={currentBenTitle}
                  onChange={(e) => setCurrentBenTitle(e.target.value)}
                  placeholder="e.g., Material Purchase - Cement Bags"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Brief description of what this specific split is for</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="text-sm mb-1">Payee Name</Label>
                  <div className="flex gap-2">
                    <Input
                      value={currentBenName}
                      onChange={(e) => setCurrentBenName(e.target.value)}
                      placeholder="Name"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" title="Load Saved" className="border-primary/20 text-primary hover:bg-primary/10 transition-colors">
                          <Search className="w-4 h-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="end">
                        <Command>
                          <CommandInput placeholder="Search payees..." />
                          <CommandList>
                            <CommandGroup>
                              {payees.map((payee) => (
                                <CommandItem
                                  key={payee.id}
                                  onSelect={() => {
                                    setCurrentBenName(payee.name);
                                    setCurrentBenMethod('bank_transfer');
                                    setCurrentBenAccount(payee.account_number || '');
                                    setCurrentBenIfsc(payee.ifsc_code || '');
                                  }}
                                >
                                  <div className="font-bold">{payee.name}</div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div>
                  <Label className="text-sm mb-1">Split Amount</Label>
                  <Input
                    type="number"
                    value={currentBenAmount}
                    onChange={(e) => setCurrentBenAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="mb-4">
                <Label className="text-sm mb-1">Method</Label>
                <Select value={currentBenMethod} onValueChange={(v: any) => setCurrentBenMethod(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpay">GPay</SelectItem>
                    <SelectItem value="phonepe">PhonePe</SelectItem>
                    <SelectItem value="paytm">Paytm</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {currentBenMethod === 'bank_transfer' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label className="text-sm mb-1">Account Number *</Label>
                      <Input
                        value={currentBenAccount}
                        onChange={(e) => setCurrentBenAccount(e.target.value)}
                        placeholder="Enter bank account number"
                      />
                    </div>
                    <div>
                      <Label className="text-sm mb-1">IFSC Code *</Label>
                      <Input
                        value={currentBenIfsc}
                        onChange={(e) => setCurrentBenIfsc(e.target.value.toUpperCase())}
                        placeholder="e.g., SBIN0001234"
                        maxLength={11}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Format: XXXX0XXXXXX (4 letters + 0 + 6 characters)
                      </p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <Label className="text-sm mb-1">Beneficiary Name (as per bank records)</Label>
                    <Input
                      value={currentBenOfficialName}
                      onChange={(e) => setCurrentBenOfficialName(e.target.value)}
                      placeholder={currentBenName || "Name registered with bank"}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Leave blank if same as Payee Name above
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 mb-4 pt-2 border-t border-border">
                    <Checkbox
                      id="saveSplitPayee"
                      checked={saveSplitPayee}
                      onCheckedChange={(c) => setSaveSplitPayee(c as boolean)}
                    />
                    <label htmlFor="saveSplitPayee" className="text-xs font-medium cursor-pointer flex items-center gap-1">
                      <SaveIcon className="w-3 h-3 text-primary" /> Save details to Payee Master for future use
                    </label>
                  </div>
                </>
              ) : (
                <div className="mb-4">
                  <Input
                    value={currentBenUpi}
                    onChange={(e) => setCurrentBenUpi(e.target.value)}
                    placeholder="UPI ID / Phone"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pt-4 border-t border-border">
                <div>
                  <Label className="text-sm mb-1">Proof Folder / Bill (Multiple) *</Label>
                  <Input
                    key={`bill-${fileInputKey}`}
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setCurrentBenBillFiles(Array.from(e.target.files));
                      }
                    }}
                    className="text-xs file:bg-primary/10 file:text-primary file:border-0 file:rounded-md file:px-2 file:py-1 cursor-pointer"
                  />
                  {currentBenBillFiles.length > 0 && (
                    <p className="text-[10px] text-primary mt-1">{currentBenBillFiles.length} file(s) selected</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm mb-1">Bank Proof (Multiple) *</Label>
                  <Input
                    key={`proof-${fileInputKey}`}
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setCurrentBenWorkProofFiles(Array.from(e.target.files));
                      }
                    }}
                    className="text-xs file:bg-primary/10 file:text-primary file:border-0 file:rounded-md file:px-2 file:py-1 cursor-pointer"
                  />
                  {currentBenWorkProofFiles.length > 0 && (
                    <p className="text-[10px] text-primary mt-1">{currentBenWorkProofFiles.length} file(s) selected</p>
                  )}
                </div>
              </div>

              <Button onClick={handleAddBeneficiary} className="w-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 shadow-none transition-colors">
                <Plus className="w-4 h-4 mr-2" /> Add to Split List
              </Button>
            </div>

            {/* List of Added Beneficiaries */}
            <div className="space-y-3">
              {beneficiaries.map((ben, idx) => (
                <motion.div
                  key={ben.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-4 bg-background/60 backdrop-blur-sm rounded-2xl border-2 border-primary/10 hover:border-primary/30 transition-all shadow-sm group"
                >
                  <div className="flex gap-4 items-center">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-bold text-sm tracking-tight text-foreground">{ben.split_title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] font-bold bg-primary/5 border-primary/10">
                          {ben.name}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">•</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {ben.paymentMethod === 'bank_transfer'
                            ? `A/C: ${ben.accountNumber?.slice(-4)}`
                            : ben.upiId}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Amount</p>
                      <p className="font-black text-primary">₹{ben.amount.toLocaleString()}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeBeneficiary(ben.id)}
                      className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl opacity-20 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </motion.div>
              ))}

              {beneficiaries.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-between items-center p-5 bg-primary/10 rounded-2xl border-2 border-primary/20 mt-4 shadow-inner"
                >
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-5 h-5 text-primary" />
                    <span className="font-bold text-primary text-sm uppercase tracking-wide">Total Split Amount</span>
                  </div>
                  <span className={cn(
                    "font-black text-2xl tracking-tighter",
                    Math.abs(beneficiaries.reduce((s, b) => s + b.amount, 0) - (parseFloat(amount) || 0)) > 1
                      ? "text-red-500 animate-pulse"
                      : "text-primary"
                  )}>
                    ₹{beneficiaries.reduce((s, b) => s + b.amount, 0).toLocaleString()}
                  </span>
                </motion.div>
              )}
            </div>

          </div>
        ) : (
          /* PRO MAX PAYEE SELECTION (Option C) */
          <div className="mb-8 p-0 rounded-2xl border-2 border-primary/10 overflow-hidden shadow-xl shadow-primary/5 bg-background/50 backdrop-blur-sm">
            <Tabs value={activePayeeTab} onValueChange={(v) => setActivePayeeTab(v as any)} className="w-full">
              <div className="p-4 bg-muted/20 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <Label className="text-base font-bold text-primary">Payee Details</Label>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Recording Unit</p>
                  </div>
                </div>

                <TabsList className="bg-background/80 border border-primary/10 p-1 rounded-xl h-11 self-start sm:self-center">
                  <TabsTrigger value="manual" className="rounded-lg px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all flex gap-2">
                    <UserPlus className="w-4 h-4" /> Manual
                  </TabsTrigger>
                  <TabsTrigger value="saved" className="rounded-lg px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all flex gap-2">
                    <History className="w-4 h-4" /> Saved
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="manual" className="p-4 md:p-6 mt-0 space-y-5 focus-visible:ring-0">
                {selectedPayeeId && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-1 px-2 rounded-full bg-primary/10 text-[10px] font-bold text-primary flex items-center gap-1">
                        <Star className="w-3 h-3 fill-primary" /> SAVED PAYEE
                      </div>
                      <span className="font-bold text-sm">{vendorName}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleClearSelectedPayee} className="h-7 text-xs text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3 h-3 mr-1" /> Use Different
                    </Button>
                  </motion.div>
                )}

                <div className="space-y-4">
                  <div className="relative">
                    <Label className="text-sm font-semibold mb-2 flex items-center gap-2">
                      Payee Name <span className="text-red-500">*</span>
                      <PaymentGuardianIndicator
                        isChecking={paymentGuardian.isChecking}
                        isDuplicate={paymentGuardian.isDuplicate}
                        confidence={paymentGuardian.confidence}
                        recommendation={paymentGuardian.recommendation}
                        overrideApplied={paymentGuardian.overrideApplied}
                      />
                    </Label>
                    <Input
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      placeholder="Company, individual, or contractor name"
                      className="h-12 bg-background/50 border-primary/10 focus:border-primary/40 rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        Payment Method <span className="text-red-500">*</span>
                      </Label>
                      <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                        <SelectTrigger className="h-12 bg-background/50 border-primary/10 rounded-xl">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="bank_transfer">🏦 Bank Transfer</SelectItem>
                          <SelectItem value="gpay">📱 GPay (UPI)</SelectItem>
                          <SelectItem value="phonepe">📱 PhonePe (UPI)</SelectItem>
                          <SelectItem value="paytm">📱 Paytm (UPI)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {paymentMethod !== 'bank_transfer' && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          UPI ID / Phone <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          value={vendorUpi}
                          onChange={(e) => setVendorUpi(e.target.value)}
                          placeholder="9876543210 or name@upi"
                          className="h-12 bg-background/50 border-primary/10 rounded-xl"
                        />
                      </div>
                    )}
                  </div>

                  {paymentMethod === 'bank_transfer' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Account Number *</Label>
                          <Input
                            value={vendorAccountNumber}
                            onChange={(e) => setVendorAccountNumber(e.target.value)}
                            placeholder="Enter account number"
                            className="h-12 bg-background/50 border-primary/10 rounded-xl font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Confirm Number *</Label>
                          <div className="relative">
                            <Input
                              value={vendorAccountConfirm}
                              onChange={(e) => setVendorAccountConfirm(e.target.value)}
                              placeholder="Re-enter to confirm"
                              className={cn(
                                "h-12 bg-background/50 border-primary/10 rounded-xl font-mono",
                                vendorAccountConfirm && vendorAccountNumber !== vendorAccountConfirm && "border-red-400 focus-visible:ring-red-400"
                              )}
                            />
                            {vendorAccountConfirm && vendorAccountNumber === vendorAccountConfirm && (
                              <CheckCircle2 className="w-4 h-4 text-green-500 absolute right-3 top-4" />
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">IFSC Code *</Label>
                          <Input
                            value={vendorIfscCode}
                            onChange={(e) => setVendorIfscCode(e.target.value.toUpperCase())}
                            placeholder="e.g., SBIN0001234"
                            maxLength={11}
                            className="h-12 bg-background/50 border-primary/10 rounded-xl font-mono uppercase"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Beneficiary Name</Label>
                          <Input
                            value={beneficiaryName}
                            onChange={(e) => setBeneficiaryName(e.target.value)}
                            placeholder={vendorName || "Bank record name"}
                            className="h-12 bg-background/50 border-primary/10 rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-primary/5 rounded-xl flex items-center justify-between border border-primary/10">
                        <div className="flex items-center gap-2">
                          <Info className="w-4 h-4 text-primary/70" />
                          <span className="text-xs text-muted-foreground font-medium">Save this for future use?</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox id="savePayeePro" checked={savePayee} onCheckedChange={(c) => setSavePayee(c as boolean)} />
                          <Label htmlFor="savePayeePro" className="text-xs cursor-pointer font-bold">Yes, Save to Master</Label>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="saved" className="p-0 mt-0 focus-visible:ring-0">
                <div className="p-4 border-b border-border bg-muted/5 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search name, account, or IFSC..."
                      className="pl-10 h-11 bg-background border-primary/10 rounded-xl focus:ring-primary/20"
                      value={payeeSearchQuery}
                      onChange={(e) => setPayeeSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="icon" onClick={() => setPayeeSearchQuery('')} className="h-11 w-11 rounded-xl shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="max-h-[350px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-primary/10">
                  {payees
                    .filter(p =>
                      p.name.toLowerCase().includes(payeeSearchQuery.toLowerCase()) ||
                      p.account_number?.includes(payeeSearchQuery) ||
                      p.ifsc_code?.toLowerCase().includes(payeeSearchQuery.toLowerCase())
                    )
                    .length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="inline-flex p-4 rounded-full bg-muted mb-4">
                        <Search className="w-8 h-8 text-muted-foreground opacity-20" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">No matches found for "{payeeSearchQuery}"</p>
                      <Button
                        variant="link"
                        onClick={() => setActivePayeeTab('manual')}
                        className="mt-2 text-primary font-bold"
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add as new payee instead
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 p-2">
                      {payees
                        .filter(p =>
                          p.name.toLowerCase().includes(payeeSearchQuery.toLowerCase()) ||
                          p.account_number?.includes(payeeSearchQuery) ||
                          p.ifsc_code?.toLowerCase().includes(payeeSearchQuery.toLowerCase())
                        )
                        .map((payee) => (
                          <button
                            key={payee.id}
                            onClick={() => handleSelectPayee(payee)}
                            className="w-full text-left p-4 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-primary/5 transition-all group flex items-center justify-between"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold group-hover:bg-primary group-hover:text-white transition-colors">
                                {payee.name.charAt(0)}
                              </div>
                              <div>
                                <h4 className="font-bold text-sm group-hover:text-primary transition-colors">{payee.name}</h4>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-[10px] text-muted-foreground bg-muted p-0.5 px-1.5 rounded">{payee.account_number}</span>
                                  <span className="text-[10px] text-muted-foreground bg-muted p-0.5 px-1.5 rounded">{payee.ifsc_code}</span>
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transform group-hover:translate-x-1 transition-all" />
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-muted/10 border-t border-border flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Showing {payees.length} saved payees</span>
                  <Button variant="ghost" size="sm" onClick={() => setActivePayeeTab('manual')} className="text-xs font-bold text-primary hover:bg-primary/10">
                    <Plus className="w-3 h-3 mr-2" /> Add New Payee
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Amount */}
        <div className="mb-6">
          <Label className="text-sm font-medium mb-2 block">Amount (₹) *</Label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="text-xl font-bold"
          />
        </div>

        {/* Proof Uploads — hidden when split is active (each split has its own proofs) */}
        {!isSplitPayment && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-1 font-semibold text-sm">Proof Folder / Bill (Multiple) *</Label>
              <div className="relative">
                <Input
                  key={`top-bill-${fileInputKey}`}
                  type="file"
                  multiple
                  id="bill-proof-upload"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      setBillFiles(Array.from(e.target.files));
                      setBillUrl(''); // Clear string url if file selected
                    }
                  }}
                />
                <Label
                  htmlFor="bill-proof-upload"
                  className="flex flex-col items-center justify-center w-full h-24 px-4 py-2 border-2 border-dashed border-primary/20 rounded-xl cursor-pointer hover:bg-primary/5 hover:border-primary/50 transition-all text-sm text-muted-foreground gap-2 group"
                >
                  <UploadCloud className="w-6 h-6 text-primary/50 group-hover:text-primary transition-colors" />
                  {billFiles.length > 0 ? (
                    <span className="text-primary font-bold truncate max-w-[200px]">{billFiles.length} file(s) selected</span>
                  ) : (
                    <span className="font-medium text-center">Click to upload Bill Proofs</span>
                  )}
                </Label>
                {billUrl && billFiles.length === 0 && <p className="text-[10px] text-primary truncate max-w-full absolute -bottom-5 left-1">Draft/Saved: {billUrl}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1 font-semibold text-sm">Bank Proof (Multiple) *</Label>
              <div className="relative">
                <Input
                  key={`top-proof-${fileInputKey}`}
                  type="file"
                  multiple
                  id="bank-proof-upload"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      setWorkProofFiles(Array.from(e.target.files));
                      setWorkProofUrl(''); // Clear string url if file selected
                    }
                  }}
                />
                <Label
                  htmlFor="bank-proof-upload"
                  className="flex flex-col items-center justify-center w-full h-24 px-4 py-2 border-2 border-dashed border-primary/20 rounded-xl cursor-pointer hover:bg-primary/5 hover:border-primary/50 transition-all text-sm text-muted-foreground gap-2 group"
                >
                  <UploadCloud className="w-6 h-6 text-primary/50 group-hover:text-primary transition-colors" />
                  {workProofFiles.length > 0 ? (
                    <span className="text-primary font-bold truncate max-w-[200px]">{workProofFiles.length} file(s) selected</span>
                  ) : (
                    <span className="font-medium text-center">Click to upload Bank Proofs</span>
                  )}
                </Label>
                {workProofUrl && workProofFiles.length === 0 && <p className="text-[10px] text-primary truncate max-w-full absolute -bottom-5 left-1">Draft/Saved: {workProofUrl}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Cut-off */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <Label className="text-sm font-medium mb-2 block">Cut-off Date *</Label>
            <Input
              type="date"
              value={cutoffDate}
              onChange={(e) => setCutoffDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>
          <div>
            <Label className="text-sm font-medium mb-2 block">Cut-off Time *</Label>
            <Input
              type="time"
              value={cutoffTime}
              onChange={(e) => setCutoffTime(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              ⏱️ Minimum 2 hours required for payment processing
            </p>
          </div>
        </div>

        {/* Urgency */}
        <div className="mb-6">
          <Label className="text-sm font-medium mb-2 block">Urgency Level</Label>
          <Select value={urgency} onValueChange={(v) => setUrgency(v as PaymentUrgency)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {urgencyOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className={opt.color}>{opt.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Payment Guardian Warning Banner */}
        {!isSplitPayment && paymentGuardian.isDuplicate && (
          <div className="mb-6">
            <DuplicateWarningBanner
              matches={paymentGuardian.matches}
              confidence={paymentGuardian.confidence}
              recommendation={paymentGuardian.recommendation}
              onOverride={async (reason) => paymentGuardian.handleOverride(user?.id || '', reason)}
              overrideApplied={paymentGuardian.overrideApplied}
            />
          </div>
        )}

        {/* Declaration */}
        <div className="mb-8 p-4 rounded-lg bg-status-late/10 border border-status-late/30">
          <div className="flex items-start gap-3">
            <Checkbox
              id="declaration"
              checked={declaration}
              onCheckedChange={(checked) => setDeclaration(checked as boolean)}
              className="mt-1"
            />
            <div>
              <Label htmlFor="declaration" className="font-medium cursor-pointer">
                I am responsible for this request
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                I confirm all information is accurate. I understand this record cannot be edited or deleted after submission.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            variant="outline"
            onClick={handleManualSaveDraft}
            disabled={isSaving}
            className="h-12 text-base font-semibold border-2 hover:bg-muted/50 rounded-xl transition-all gap-2"
          >
            <SaveIcon className="w-4 h-4" />
            {currentDraftId ? 'Update Draft' : 'Save as Draft'}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!declaration || isSaving || isUploadingFiles || (!isSplitPayment && paymentGuardian.matches.length > 0 && !paymentGuardian.overrideApplied)}
            className="h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-primary/20 transition-all"
          >
            {(isSaving || isUploadingFiles) ? 'Processing/Uploading...' : 'Submit Request'}
          </Button>
        </div>

        {/* Lock Notice */}
        <p className="text-xs text-muted-foreground text-center mt-4 flex items-center justify-center gap-1">
          <Lock className="w-3 h-3" />
          Cannot edit, delete, or resubmit without rejection
        </p>
      </div>
    </motion.div >
  );
}
