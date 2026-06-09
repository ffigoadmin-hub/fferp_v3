import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, Building2, CreditCard, FileText,
  CheckCircle2, AlertTriangle, Eye, ExternalLink, User, Calendar,
  RotateCcw, Clock, Banknote, Layers as LayersIcon, Edit2, Save, X,
  Truck, Loader2, ClipboardCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { validateIFSC, validateAccountNumber, isPaymentValid } from '@/utils/paymentValidation';
import type { PaymentRequestData } from '@/hooks/usePaymentRequests';
import { SplitPaymentBatchView } from '@/components/payments/SplitPaymentBatchView';

interface PaymentVerificationCardProps {
  payment: PaymentRequestData;
  isSelected: boolean;
  onToggleSelect: () => void;
  onViewDocument?: (url: string) => void;
  onReverseToAdmin?: (paymentId: string, reason: string) => void;
  onReject?: (paymentId: string, reason: string) => void;
  onHold?: (paymentId: string, reason: string) => void;
  onEditBankDetails?: (paymentId: string, data: {
    vendorAccountNumber: string;
    vendorIfscCode: string;
    vendorUpi: string;
    beneficiaryName: string;
    paymentType: string;
  }) => Promise<void>;
  showReverseOption?: boolean;
  showRejectOption?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  payees?: any[]; // Added payees prop
}

export function PaymentVerificationCard({
  payment,
  isSelected,
  onToggleSelect,
  onViewDocument,
  onReverseToAdmin,
  onReject,
  onHold,
  onEditBankDetails,
  showReverseOption = false,
  showRejectOption = false,
  disabled = false,
  disabledReason,
  payees = [] // Added payees default
}: PaymentVerificationCardProps) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReverseForm, setShowReverseForm] = useState(false);
  const [reverseReason, setReverseReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showHoldForm, setShowHoldForm] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    paymentType: payment.payment_type || 'bank_transfer',
    vendorAccountNumber: payment.vendor_account_number || '',
    vendorIfscCode: payment.vendor_ifsc_code || '',
    vendorUpi: payment.vendor_upi || '',
    beneficiaryName: payment.beneficiary_name || payment.vendor_name || '',
  });

  // Transport detection - be more robust
  const isTransport = !!(payment.is_transport_payment || 
                        payment.purpose?.toLowerCase().includes('transport') || 
                        payment.vendor_name?.toLowerCase().includes('multiple vendors'));

  // Transport multi-vendor: vendor_name is 'Multiple Vendors' OR trips have actually different drivers
  const isTransportMultiVendor = !!(isTransport && (() => {
    if (payment.vendor_name?.toLowerCase() === 'multiple vendors' || payment.vendor_name?.toLowerCase() === 'split_payment_batch') return true;
    if (payment.transport_trips && payment.transport_trips.length > 1) {
      const drivers = new Set(payment.transport_trips.map((t: any) => t.driver_name?.toLowerCase().trim()).filter(Boolean));
      return drivers.size > 1; // Only multi-vendor if trips have DIFFERENT drivers
    }
    return false;
  })());

  // Validation checks
  // Validation checks with Transport Fallback
  const firstTrip = isTransport && payment.transport_trips && payment.transport_trips.length > 0 ? payment.transport_trips[0] as any : null;
  
  // Payee Master Suggestion Logic (Moved up for display fallback)
  const suggestedPayee = (() => {
    if (isTransportMultiVendor || !payees?.length) return null;
    
    const vendorName = payment.vendor_name?.toLowerCase().trim();
    const beneficiaryName = payment.beneficiary_name?.toLowerCase().trim();
    const tripDrivers = isTransport ? (payment.transport_trips || []).map((t: any) => t.driver_name?.toLowerCase().trim()).filter(Boolean) : [];
    
    return payees.find(p => {
      const pName = p.name?.toLowerCase().trim();
      return (vendorName && pName === vendorName) || 
             (beneficiaryName && pName === beneficiaryName) ||
             (tripDrivers.some((d: string) => pName === d));
    });
  })();

  const displayIfsc = payment.vendor_ifsc_code || firstTrip?.payee_ifsc || suggestedPayee?.ifsc_code;
  const displayAccount = payment.vendor_account_number || firstTrip?.payee_account || suggestedPayee?.account_number;
  const displayUpi = payment.vendor_upi || firstTrip?.payee_upi || suggestedPayee?.upi_id;
  const displayBeneficiary = payment.beneficiary_name || payment.vendor_name || firstTrip?.beneficiary_name || firstTrip?.vendor_name || suggestedPayee?.name;

  const ifscValid = validateIFSC(displayIfsc);
  const accountValid = validateAccountNumber(displayAccount);
  const upiValid = !!displayUpi;

  // Use centralized validation
  const validationResult = isPaymentValid(payment, payees);
  const hasAllBankDetails = validationResult.isValid;

  const getDepartmentBadge = (dept: string) => {
    const deptLower = dept?.toLowerCase() || '';
    const rawDept = (payment.department || payment.requester?.department || '').toLowerCase();
    let label = dept;

    if (rawDept === 'others' && payment.requester?.department) {
      label = `Others (${payment.requester.department})`;
    }

    if (deptLower.includes('eng')) return { label: label || 'Engineering', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
    if (deptLower.includes('agri') || deptLower.includes('farm') || deptLower.includes('nursery')) {
      return { label: label || 'Agri Operations', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
    }
    return { label: label || 'Unknown', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
  };

  const deptBadge = getDepartmentBadge(payment.department || payment.requester?.department || '');


  const handleApplySuggestion = async () => {
    if (!suggestedPayee || !onEditBankDetails) return;
    
    setIsSavingEdit(true);
    try {
      await onEditBankDetails(payment.id, {
        vendorAccountNumber: suggestedPayee.account_number || '',
        vendorIfscCode: suggestedPayee.ifsc_code || '',
        vendorUpi: suggestedPayee.upi_id || '',
        beneficiaryName: suggestedPayee.name || '',
        paymentType: suggestedPayee.upi_id ? 'upi' : 'bank_transfer'
      });
      // Update local form state too
      setEditForm({
        paymentType: suggestedPayee.upi_id ? 'upi' : 'bank_transfer',
        vendorAccountNumber: suggestedPayee.account_number || '',
        vendorIfscCode: suggestedPayee.ifsc_code || '',
        vendorUpi: suggestedPayee.upi_id || '',
        beneficiaryName: suggestedPayee.name || '',
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
            "glass-card border-white/5 transition-all duration-300",
            isSelected ? "ring-2 ring-primary bg-primary/5 shadow-glow-primary scale-[1.005]" : "hover:border-white/10",
            !hasAllBankDetails && (isTransportMultiVendor && !payment.is_split_payment ? "border-amber-500/50" : "border-destructive/40")
        )}
    >
      {/* Main Row - Always Visible */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div className="mt-1" title={disabled ? disabledReason : undefined}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              disabled={disabled}
              className={cn("w-5 h-5", disabled && "opacity-50 cursor-not-allowed")}
            />
          </div>

          <div className={cn("flex-1 min-w-0", disabled && "opacity-60")}>
            {/* Top Row: Payee & Amount */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={cn("text-[10px] font-bold", deptBadge.color)}>
                    {deptBadge.label}
                  </Badge>
                  {payment.payment_number && (
                    <span className="text-xs font-mono text-muted-foreground">
                      #{payment.payment_number}
                    </span>
                  )}
                </div>
                <p className="font-semibold text-lg truncate">{payment.vendor_name}</p>
                <p className="text-sm text-muted-foreground line-clamp-1">{payment.purpose}</p>
              </div>

              <div className="text-right shrink-0">
                <p className="font-bold text-xl text-primary">₹{Number(payment.amount).toLocaleString()}</p>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    payment.urgency === 'emergency' && "border-red-500 text-red-500",
                    payment.urgency === 'important' && "border-amber-500 text-amber-500"
                  )}
                >
                  {payment.urgency}
                </Badge>
                {payment.status === 'gm_hold' && (
                  <Badge className="bg-amber-500 text-white border-amber-600 animate-pulse mt-1" variant="outline">
                    <Clock className="w-3 h-3 mr-1" /> GM HOLD
                  </Badge>
                )}
              </div>
            </div>

            {/* Bank Details Summary Row */}
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/5">
              {/* Common Transport Badge - Always show if transport */}
              {isTransport && (
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 px-2 py-0.5 flex items-center gap-1 shrink-0" variant="outline">
                  <Truck className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold tracking-tight uppercase tracking-widest font-mono">Transport</span>
                </Badge>
              )}

              {validationResult.isMasterMatch && (
                <Badge className="bg-primary/10 text-primary border-primary/20 px-2 py-0.5 flex items-center gap-1 shrink-0" variant="outline">
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold tracking-tight uppercase tracking-widest font-mono">Master Match</span>
                </Badge>
              )}

              {payment.is_split_payment ? (
                <div className="flex items-center gap-2">
                  <LayersIcon className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                    SPLIT BATCH ({payment.splits?.length || payment.total_splits || 0})
                  </span>
                  {(payment.splits?.length || 0) === 0 ? (
                    <div className="flex items-center gap-1 text-amber-500">
                      <Clock className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-tight">Loading splits...</span>
                    </div>
                  ) : hasAllBankDetails ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-tight">Valid</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-destructive animate-pulse">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-tight">Missing Info</span>
                    </div>
                  )}
                </div>
              ) : displayAccount ? (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-mono font-medium truncate max-w-[120px]">
                    {displayIfsc || 'No IFSC'}
                  </span>
                  {ifscValid ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  )}
                  <div className="h-4 w-px bg-border mx-1" />
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-mono font-medium truncate max-w-[150px]">
                    {displayAccount}
                  </span>
                  {accountValid ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  )}
                </div>
              ) : displayUpi ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">UPI</span>
                  <span className="text-sm font-mono font-medium text-primary truncate max-w-[200px]">
                    {displayUpi}
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
              ) : payment.is_petty_cash ? (
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-amber-500">PETTY CASH</span>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
              ) : isTransportMultiVendor && !payment.is_split_payment ? (
                <div className="flex items-center gap-2 text-amber-600">
                  <Truck className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-tight">Multi-Vendor ({payment.transport_trips?.length || 0} Trips)</span>
                  <Badge className="text-[9px] bg-amber-500/10 border-amber-500/20 text-amber-600" variant="outline">Needs Split</Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-tight">Missing Bank/UPI Details</span>
                  {onEditBankDetails && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors whitespace-nowrap"
                    >
                      + Add Details
                    </button>
                  )}
                </div>
              )}

              <div className="h-4 w-px bg-border flex-shrink-0" />

              <div className="flex items-center gap-2 min-w-0 flex-1">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate font-medium">
                  {displayBeneficiary || 'No Beneficiary'}
                </span>
              </div>
            </div>

            {/* NEW: Split Payment Batch View */}
            {payment.is_split_payment && (
              <div className="mt-3">
                <SplitPaymentBatchView
                  paymentId={payment.id}
                  totalAmount={payment.amount}
                  splits={payment.splits || []}
                />
              </div>
            )}

            {/* Expand/Collapse */}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" /> Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" /> View Full Details & Documents
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-border">
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                {/* Left: Full Bank Details */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> Bank Account Details
                    {onEditBankDetails && !isEditing && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="ml-auto p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                        aria-label="Edit bank details"
                        title="Edit bank details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </h4>

                  {isEditing ? (
                    /* Edit Mode */
                    <div className="space-y-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <Tabs
                        value={editForm.paymentType === 'upi' ? 'upi' : 'bank_transfer'}
                        onValueChange={(v) => setEditForm({ ...editForm, paymentType: v })}
                      >
                        <TabsList className="grid w-full grid-cols-2 h-8">
                          <TabsTrigger value="bank_transfer" className="text-xs">Bank Transfer</TabsTrigger>
                          <TabsTrigger value="upi" className="text-xs">UPI</TabsTrigger>
                        </TabsList>
                        <TabsContent value="bank_transfer" className="space-y-2 pt-2">
                          <div>
                            <Label className="text-xs">Beneficiary Name</Label>
                            <Input
                              value={editForm.beneficiaryName}
                              onChange={(e) => setEditForm({ ...editForm, beneficiaryName: e.target.value })}
                              className="h-8 text-sm"
                              placeholder="Enter beneficiary name"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Account Number</Label>
                            <Input
                              value={editForm.vendorAccountNumber}
                              onChange={(e) => setEditForm({ ...editForm, vendorAccountNumber: e.target.value })}
                              className="h-8 text-sm font-mono"
                              placeholder="Enter account number"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">IFSC Code</Label>
                            <Input
                              value={editForm.vendorIfscCode}
                              onChange={(e) => setEditForm({ ...editForm, vendorIfscCode: e.target.value.toUpperCase() })}
                              className="h-8 text-sm font-mono"
                              placeholder="e.g. KKBK0000123"
                              maxLength={11}
                            />
                          </div>
                        </TabsContent>
                        <TabsContent value="upi" className="space-y-2 pt-2">
                          <div>
                            <Label className="text-xs">Beneficiary Name</Label>
                            <Input
                              value={editForm.beneficiaryName}
                              onChange={(e) => setEditForm({ ...editForm, beneficiaryName: e.target.value })}
                              className="h-8 text-sm"
                              placeholder="Enter beneficiary name"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">UPI ID</Label>
                            <Input
                              value={editForm.vendorUpi}
                              onChange={(e) => setEditForm({ ...editForm, vendorUpi: e.target.value })}
                              className="h-8 text-sm font-mono"
                              placeholder="e.g. name@upi"
                            />
                          </div>
                        </TabsContent>
                      </Tabs>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1 flex-1"
                          disabled={isSavingEdit}
                          onClick={async () => {
                            if (!onEditBankDetails) return;
                            setIsSavingEdit(true);
                            try {
                              await onEditBankDetails(payment.id, editForm);
                              setIsEditing(false);
                            } finally {
                              setIsSavingEdit(false);
                            }
                          }}
                        >
                          <Save className="w-3 h-3" /> {isSavingEdit ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            setEditForm({
                              paymentType: payment.payment_type || 'bank_transfer',
                              vendorAccountNumber: payment.vendor_account_number || '',
                              vendorIfscCode: payment.vendor_ifsc_code || '',
                              vendorUpi: payment.vendor_upi || '',
                              beneficiaryName: payment.beneficiary_name || payment.vendor_name || '',
                            });
                            setIsEditing(false);
                          }}
                        >
                          <X className="w-3 h-3" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : isTransportMultiVendor && !payment.is_split_payment ? (
                    /* Transport Multi-Vendor: Show contextual summary instead of empty bank fields */
                    <div className="space-y-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <div className="flex items-center gap-2 text-amber-600">
                        <Truck className="w-5 h-5" />
                        <span className="text-sm font-bold">Multi-Vendor Transport Payment</span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>This request covers <strong>{payment.transport_trips?.length || 0} trips</strong> to <strong>{payment.transport_trips?.length || 0} different payees</strong>.</p>
                        <p>Individual bank details need to be added per payee via <strong>Split Payment</strong>.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded bg-muted/30 border">
                          <span className="text-[10px] text-muted-foreground">Total Trips</span>
                          <p className="font-bold text-sm">{payment.transport_trips?.length || 0}</p>
                        </div>
                        <div className="p-2 rounded bg-muted/30 border">
                          <span className="text-[10px] text-muted-foreground">Total Amount</span>
                          <p className="font-bold text-sm">₹{Number(payment.amount).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Read-only Mode */
                    <div className="space-y-2 p-3 rounded-lg bg-muted/30 border">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Beneficiary Name</span>
                        <span className="font-medium text-sm">{displayBeneficiary || '-'}</span>
                      </div>
                      {payment.payment_type === 'upi' || upiValid ? (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">UPI ID</span>
                          <span className={cn("font-mono text-sm", upiValid ? "text-primary" : "text-destructive")}>
                            {displayUpi || 'Not Provided'}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Account Number</span>
                            <span className={cn("font-mono text-sm", accountValid ? "text-foreground" : "text-destructive")}>
                              {displayAccount || 'Not Provided'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">IFSC Code</span>
                            <span className={cn("font-mono text-sm", ifscValid ? "text-foreground" : "text-destructive")}>
                              {displayIfsc || 'Not Provided'}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Payment Type</span>
                        <Badge variant="outline" className="text-xs uppercase">
                          {payment.payment_type === 'upi' ? 'UPI' : (Number(payment.amount) >= 200000 ? 'RTGS' : 'NEFT')}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Validation Status */}
                  {!isEditing && (
                    <div className="space-y-3">
                      {/* Suggestions UI */}
                      {suggestedPayee && (
                        <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2 animate-in fade-in slide-in-from-top-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-primary">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Payee Master Match Found</span>
                            </div>
                            <Badge className="h-4 bg-primary/20 text-primary border-primary/30 text-[9px]">Ready</Badge>
                          </div>
                          <div className="flex items-center gap-3 bg-card/50 p-2 rounded border border-border/50">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">{suggestedPayee.name}</p>
                              <p className="text-[10px] font-mono text-muted-foreground truncate opacity-75">
                                {suggestedPayee.account_number ? `${suggestedPayee.account_number} • ${suggestedPayee.ifsc_code}` : suggestedPayee.upi_id}
                              </p>
                            </div>
                            <Button 
                              size="sm" 
                              className="bg-primary hover:bg-primary/90 text-white h-7 px-3 text-[11px]"
                              onClick={handleApplySuggestion}
                              disabled={isSavingEdit}
                            >
                              {isSavingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                              Apply
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            Auto-fills bank details for "{payment.vendor_name || suggestedPayee.name}" from your Master List.
                          </p>
                        </div>
                      )}

                      <div className={cn(
                        "p-3 rounded-lg border",
                        hasAllBankDetails ? "bg-green-500/10 border-green-500/30" 
                          : isTransportMultiVendor && !payment.is_split_payment 
                            ? "bg-amber-500/10 border-amber-500/30" 
                            : "bg-destructive/10 border-destructive/30"
                      )}>
                        <div className="flex items-center gap-2">
                          {hasAllBankDetails ? (
                            <>
                              <CheckCircle2 className="w-5 h-5 text-green-500" />
                              <span className="text-sm font-medium text-green-500">Ready for Bank Upload</span>
                            </>
                          ) : isTransportMultiVendor && !payment.is_split_payment ? (
                            <>
                              <Truck className="w-5 h-5 text-amber-600" />
                              <span className="text-sm font-medium text-amber-600">
                                Requires Split Payment Conversion
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-5 h-5 text-destructive" />
                              <span className="text-sm font-medium text-destructive">
                                {validationResult.error || (payment.is_split_payment ? "Split Batch Incomplete" : "Missing Bank Details")}
                              </span>
                            </>
                          )}
                        </div>
                        {!hasAllBankDetails && (
                          <div className="mt-2 space-y-2">
                            {isTransportMultiVendor && !payment.is_split_payment ? (
                              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 space-y-2">
                                <p className="text-[11px] text-amber-600 font-medium leading-relaxed">
                                  💡 This request has <strong>{payment.transport_trips?.length || 0} trips</strong> across multiple vendors.
                                  It must be converted to individual split payments to include specific bank details per trip.
                                </p>
                                <Button
                                  size="sm"
                                  className="w-full bg-amber-500 hover:bg-amber-600 text-white gap-2 h-8 text-xs font-bold shadow-sm"
                                  onClick={() => {
                                    setReverseReason('Convert to Split Payment: This is a multi-vendor transport request. Admin needs to split this into individual payee entries so bank details can be added for each trip.');
                                    setShowReverseForm(true);
                                    // Scroll to reverse form
                                    const el = document.getElementById(`reverse-form-${payment.id}`);
                                    el?.scrollIntoView({ behavior: 'smooth' });
                                  }}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Convert to Split Payment
                                </Button>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {validationResult.error 
                                  ? "Please correct the issues above to enable batching and bank file generation."
                                  : payment.is_split_payment 
                                    ? "Check individual splits for missing information."
                                    : "Invalid or missing account details hinder bank file generation."
                                }
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Transport Trip Breakdown (if applicable) */}
                {isTransport && payment.transport_trips && payment.transport_trips.length > 0 && (
                  <div className="md:col-span-2 mt-4 space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2 text-amber-600">
                      <Truck className="w-4 h-4" /> Transport Trip Breakdown ({payment.transport_trips.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {payment.transport_trips.map((trip: any, idx: number) => {
                        let payee = null;
                        let isMissing = false;
                        
                        if (payment.is_split_payment && payment.splits && payment.splits.length > 0) {
                          const tripTotal = Math.round((trip.distance_km || 0) * (trip.rate_per_km || 0));
                          payee = payment.splits.find(s => 
                            (trip.driver_name && s.payee_name?.toLowerCase().includes(trip.driver_name.toLowerCase())) ||
                            (trip.vendor_name && s.payee_name?.toLowerCase().includes(trip.vendor_name.toLowerCase()))
                          ) || payment.splits.find(s => s.amount === tripTotal) || payment.splits[idx];
                          
                          if (!payee || (!payee.upi_id && !payee.account_number)) isMissing = true;
                        } else if (!isTransportMultiVendor) {
                          // Fallback to top-level if trip object doesn't have its own
                          payee = {
                            payment_method: trip.payment_method || (payment as any).payment_type || (payment.vendor_upi ? 'upi' : 'bank_transfer'),
                            upi_id: trip.payee_upi || payment.vendor_upi,
                            account_number: trip.payee_account || payment.vendor_account_number,
                            ifsc_code: trip.payee_ifsc || payment.vendor_ifsc_code,
                            beneficiary_name: trip.beneficiary_name || payment.beneficiary_name || payment.vendor_name
                          };
                          if (!payee.upi_id && !payee.account_number) isMissing = true;
                        } else {
                          // For multi-vendor without split, we now look at trip-level details first
                          // This handles cases where user entered details per trip but didn't convert to split yet
                          if (trip.payee_account || trip.payee_upi) {
                            payee = {
                              payment_method: trip.payment_method || 'bank_transfer',
                              upi_id: trip.payee_upi,
                              account_number: trip.payee_account,
                              ifsc_code: trip.payee_ifsc,
                              beneficiary_name: trip.beneficiary_name || trip.vendor_name
                            };
                            isMissing = false;
                          } else {
                            isMissing = true;
                          }
                        }

                        const isUPI = payee?.payment_method === 'upi' || !!payee?.upi_id;

                        return (
                        <div key={idx} className="p-3 rounded-lg border bg-amber-500/5 border-amber-500/10 space-y-1 flex flex-col">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-bold text-amber-600 uppercase">Trip {idx + 1}</span>
                            <span className="text-[10px] font-mono opacity-60">
                              {trip.trip_date ? new Date(trip.trip_date).toLocaleDateString() : 'No Date'}
                            </span>
                          </div>
                          <div className="text-sm font-semibold truncate">{trip.from_location} → {trip.to_location}</div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{trip.distance_km} KM @ ₹{trip.rate_per_km}/KM</span>
                            <span className="font-bold text-foreground">₹{Math.round(trip.distance_km * trip.rate_per_km).toLocaleString()}</span>
                          </div>
                          <div className="text-[10px] opacity-75 truncate mb-auto pb-2">
                            {trip.vehicle_number || 'No Vehicle'} | {trip.driver_name || 'No Driver'}
                          </div>

                          {/* Payee Details Inline */}
                          {isMissing && isTransportMultiVendor && !payment.is_split_payment ? (
                             <div className="mt-2 pt-2 border-t border-destructive/20 text-[10px] space-y-0.5 bg-destructive/10 p-1.5 rounded text-destructive">
                               <div className="font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Bank Details Missing</div>
                               <div className="opacity-80">Convert to Split Payment to add</div>
                             </div>
                          ) : payee ? (
                             <div className={cn(
                               "mt-2 pt-2 border-t text-[10px] space-y-0.5 p-1.5 rounded",
                               isMissing ? "bg-destructive/10 border-destructive/20 text-destructive" : "bg-primary/5 border-primary/10 text-primary"
                             )}>
                               <div className="font-semibold flex items-center justify-between">
                                 <span className="flex items-center gap-1">
                                   {isMissing ? <AlertTriangle className="w-3 h-3"/> : <CreditCard className="w-3 h-3"/>}
                                   Payee Details
                                 </span>
                                 <span className="uppercase opacity-70 text-[9px]">{isUPI ? 'UPI' : 'Bank'}</span>
                               </div>
                               <div className="truncate font-medium">
                                 {payee.beneficiary_name || payee.payee_name || trip.driver_name || trip.vendor_name || 'Unknown Payee'}
                               </div>
                               <div className="truncate opacity-80 font-mono">
                                 {isUPI ? (
                                   payee.upi_id || 'UPI ID Missing'
                                 ) : (
                                   payee.account_number ? `${payee.account_number} • ${payee.ifsc_code || 'No IFSC'}` : 'Account Details Missing'
                                 )}
                               </div>
                             </div>
                          ) : null}
                        </div>
                      )})}
                    </div>
                  </div>
                )}

                {/* Right: Request Details & Documents */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Request Information
                  </h4>
                  <div className="space-y-2 p-3 rounded-lg bg-muted/30 border">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Requester</span>
                      <span className="font-medium text-sm">{payment.requester?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Department</span>
                      <span className="font-medium text-sm">{payment.department || payment.requester?.department || '-'}</span>
                    </div>
                    {payment.wo_number && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">WO Number</span>
                        <span className="font-mono text-sm">{payment.wo_number}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Created</span>
                      <span className="text-sm">{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '-'}</span>
                    </div>
                  </div>

                  {/* Document Links */}
                  <div className="flex gap-2">
                    {payment.bill_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => onViewDocument?.(payment.bill_url?.split(',')[0]?.trim()!)}
                      >
                        <Eye className="w-4 h-4" /> View Proof Folder
                      </Button>
                    )}
                    {payment.work_proof_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => onViewDocument?.(payment.work_proof_url!)}
                      >
                        <Eye className="w-4 h-4" /> Payment Bank Proof
                      </Button>
                    )}
                  </div>

                  {/* Reverse to Admin Option */}
                  {showReverseOption && (!hasAllBankDetails || user?.role === 'gm') && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      {!showReverseForm ? (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 border-amber-500 text-amber-500 hover:bg-amber-500/10"
                            onClick={() => setShowReverseForm(true)}
                          >
                            <RotateCcw className="w-4 h-4" /> Reverse to Admin
                          </Button>
                          {user?.role === 'gm' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full gap-2 border-red-500 text-red-500 hover:bg-red-500/10"
                              onClick={() => setShowHoldForm(true)}
                            >
                              <AlertTriangle className="w-4 h-4" /> Hold Payment
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-amber-500">Reason for reversal:</p>
                          <Textarea
                            placeholder="Describe the issue requiring correction..."
                            value={reverseReason}
                            onChange={(e) => setReverseReason(e.target.value)}
                            className="min-h-[80px]"
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                setShowReverseForm(false);
                                setReverseReason('');
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 bg-amber-500 hover:bg-amber-600"
                              disabled={!reverseReason.trim()}
                              onClick={() => {
                                onReverseToAdmin?.(payment.id, reverseReason.trim());
                                setShowReverseForm(false);
                                setReverseReason('');
                              }}
                            >
                              <RotateCcw className="w-4 h-4 mr-1" /> Send to Admin
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Reject Form */}
                      {showRejectForm && (
                        <div className="space-y-3 mt-4 pt-4 border-t border-red-600/20">
                          <p className="text-sm font-medium text-red-600">Reason for rejection:</p>
                          <Textarea
                            placeholder="Describe why this payment should be rejected..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="min-h-[80px] border-red-600/30"
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                setShowRejectForm(false);
                                setRejectReason('');
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 bg-red-600 hover:bg-red-700"
                              disabled={!rejectReason.trim()}
                              onClick={() => {
                                onReject?.(payment.id, rejectReason.trim());
                                setShowRejectForm(false);
                                setRejectReason('');
                              }}
                            >
                              <X className="w-4 h-4 mr-1" /> Reject Payment
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Hold Form (GM Only) */}
                      {showHoldForm && (
                        <div className="space-y-3 mt-4 pt-4 border-t border-red-500/20">
                          <p className="text-sm font-medium text-red-500">Reason for putting on hold:</p>
                          <Textarea
                            placeholder="Describe why this payment should be held..."
                            value={holdReason}
                            onChange={(e) => setHoldReason(e.target.value)}
                            className="min-h-[80px] border-red-500/30"
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                setShowHoldForm(false);
                                setHoldReason('');
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 bg-red-500 hover:bg-red-600"
                              disabled={!holdReason.trim()}
                              onClick={() => {
                                onHold?.(payment.id, holdReason.trim());
                                setShowHoldForm(false);
                                setHoldReason('');
                              }}
                            >
                              <AlertTriangle className="w-4 h-4 mr-1" /> Hold
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reject Payment Option - Available for Accountants */}
                  {showRejectOption && user?.role === 'accounts' && (
                    <div className="mt-3 p-3 rounded-lg bg-red-600/10 border border-red-600/30">
                      {!showRejectForm ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 border-red-600 text-red-600 hover:bg-red-600/10"
                          onClick={() => setShowRejectForm(true)}
                        >
                          <X className="w-4 h-4" /> Reject Payment
                        </Button>
                      ) : (
                        <div className="space-y-3 mt-4 pt-4 border-t border-red-600/20">
                          <p className="text-sm font-medium text-red-600">Reason for rejection:</p>
                          <Textarea
                            placeholder="Describe why this payment should be rejected..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="min-h-[80px] border-red-600/30"
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                setShowRejectForm(false);
                                setRejectReason('');
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 bg-red-600 hover:bg-red-700"
                              disabled={!rejectReason.trim()}
                              onClick={() => {
                                onReject?.(payment.id, rejectReason.trim());
                                setShowRejectForm(false);
                                setRejectReason('');
                              }}
                            >
                              <X className="w-4 h-4 mr-1" /> Reject Payment
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
