import { motion } from 'framer-motion';
import { FileText, Clock, Check, X, Pause, IndianRupee, Filter, Loader2, ExternalLink, Copy, ClipboardList, ShoppingCart, ChevronDown, ChevronUp, User, Calendar, Edit, RotateCcw, Plus, Image, Download, Eye, AlertTriangle, Phone, Package, Truck, Timer } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { usePaymentRequests, PaymentUrgency } from '@/hooks/usePaymentRequests';
import { useMyPaymentRequests } from '@/hooks/usePaymentRequests';
import { getPaymentTimelineSteps, normalizeDepartment } from '@/lib/paymentWorkflow';

import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useProjectPhases } from '@/hooks/useProjectPhases';
import { useProjects } from '@/hooks/useProjects';
import { usePayees, Payee } from '@/hooks/usePayees';
import { useMyMaterialRequests } from '@/hooks/useMaterialRequests';
import { getMaterialDisplayStatus } from '@/lib/materialStatusResolver';
import { useMyVendorWorkRequests } from '@/hooks/useVendorWorkRequests';
import { useTransportExpenses } from '@/hooks/useTransportExpenses';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { PaymentTagSelector } from '@/components/payment/PaymentTagSelector';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown } from 'lucide-react';
import { useState, useEffect, lazy, Suspense } from 'react';
import { ExportButtons } from '@/components/ExportButtons';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { IndividualPaymentReminder } from '@/components/payment/IndividualPaymentReminder';
import { TransportSubmissionForm } from '@/components/transport/TransportSubmissionForm';

const PaymentReceipt = lazy(() =>
  import('@/components/payment/PaymentReceipt').then((module) => ({ default: module.PaymentReceipt }))
);

const statusConfig: Record<string, { bg: string; text: string; label: string; icon: React.ElementType }> = {
  // Workflow-specific statuses
  smo_audit: { bg: 'bg-muted/30', text: 'text-muted-foreground', label: 'Pending SMO', icon: Clock },
  gmo_audit: { bg: 'bg-muted/30', text: 'text-muted-foreground', label: 'Pending GMO', icon: Clock },
  boi_audit: { bg: 'bg-muted/30', text: 'text-muted-foreground', label: 'Pending BOI', icon: Clock },
  gm_audit: { bg: 'bg-muted/30', text: 'text-muted-foreground', label: 'Pending GM', icon: Clock },
  director_audit: { bg: 'bg-muted/30', text: 'text-muted-foreground', label: 'Pending Director', icon: Clock },
  admin_audit: { bg: 'bg-muted/30', text: 'text-muted-foreground', label: 'Pending Admin', icon: Clock },
  ceo_audit: { bg: 'bg-status-late/20', text: 'text-status-late', label: 'Pending CEO', icon: Clock },
  // Legacy statuses (for backward compatibility)
  pending: { bg: 'bg-muted/30', text: 'text-muted-foreground', label: 'Pending', icon: Clock },
  admin_approved: { bg: 'bg-status-late/20', text: 'text-status-late', label: 'Pending CEO', icon: Clock },
  ceo_approved: { bg: 'bg-status-live/20', text: 'text-status-live', label: 'Ready for Payment', icon: Check },
  ceo_hold: { bg: 'bg-authority-ceo/20', text: 'text-authority-ceo', label: 'CEO Hold', icon: Pause },
  rejected: { bg: 'bg-status-missed/20', text: 'text-status-missed', label: 'Rejected', icon: X },
  paid: { bg: 'bg-status-live/20', text: 'text-status-live', label: 'Paid', icon: Check },
  completed: { bg: 'bg-status-live/20', text: 'text-status-live', label: 'Completed', icon: Check },
  // Accounts/Bank statuses
  accounts_execution: { bg: 'bg-primary/20', text: 'text-primary', label: 'Processing', icon: Clock },
  bulk_prepared: { bg: 'bg-primary/20', text: 'text-primary', label: 'Batch Ready', icon: Clock },
  bank_uploaded: { bg: 'bg-primary/20', text: 'text-primary', label: 'Bank Processing', icon: Clock },
  // Material/Work Request statuses
  pending_smo: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Pending SMO', icon: Clock },
  pending_gmo: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Pending GMO', icon: Clock },
  pending_gm: { bg: 'bg-violet-500/10', text: 'text-violet-400', label: 'Pending GM', icon: Clock },
  pending_admin: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', label: 'Pending Admin', icon: Clock },
  pending_ceo: { bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Pending CEO', icon: Clock },
  rejected_smo: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Rejected (SMO)', icon: X },
  quoted: { bg: 'bg-violet-500/10', text: 'text-violet-400', label: 'Quoted', icon: FileText },
  cancelled: { bg: 'bg-slate-500/10', text: 'text-slate-400', label: 'Cancelled', icon: X },
  approved_for_sourcing: { bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'Ready for Sourcing', icon: Check },
  sourcing: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Sourcing', icon: Package },
  ordered: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', label: 'Ordered', icon: Truck },
  delivered: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Delivered', icon: Check },
  vendor_search: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Vendor Search', icon: Truck },
  vendor_aligned: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', label: 'Vendor Aligned', icon: Check },
  wo_created: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'WO Created', icon: Check },
  shipped: { bg: 'bg-sky-500/10', text: 'text-sky-400', label: 'Shipped', icon: Truck },
  loading: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', label: 'Loading', icon: Timer },
  unloading: { bg: 'bg-teal-500/10', text: 'text-teal-400', label: 'Unloading', icon: Timer },
  delayed: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Delayed', icon: AlertTriangle },
};

const urgencyConfig: Record<string, { text: string; icon: string }> = {
  emergency: { text: 'text-status-missed', icon: '🔴' },
  important: { text: 'text-status-late', icon: '🟡' },
  normal: { text: 'text-status-live', icon: '🟢' },
};

// Helper function to parse PO item description - display only descriptions concatenated
const formatPOItemDescription = (itemDescription: string): string => {
  try {
    const items = JSON.parse(itemDescription);
    if (Array.isArray(items)) {
      return items.map((item: any) => item.description).filter(Boolean).join(', ');
    }
    return itemDescription;
  } catch {
    // If not JSON, return as-is
    return itemDescription;
  }
};

// Approval Timeline Component
function ApprovalTimeline({ item, type }: { item: any; type: 'payment' | 'wo' | 'po' | 'material' | 'work' | 'transport' }) {
  const isRejected = item.status === 'rejected';
  const isReversed = !!item.accounts_reversal_reason;
  const rawDept = item.department || item.requester?.department || 'others';
  const department = normalizeDepartment(rawDept);

  const isCEOHold = item.status === 'ceo_hold';
  const isGMHold = item.status === 'gm_hold';
  const holdReason = item.ceo_hold_reason;

  // Determine workflow steps based on department
  const getWorkflowSteps = () => {
    if (type === 'payment') {
      return getPaymentTimelineSteps(item).map((step) => {
        const approvalMap: Record<string, { approvedAt?: string | null; approvedBy?: string | null; isHold?: boolean; holdReason?: string | null }> = {
          requester: { approvedAt: item.created_at, approvedBy: item.requester?.name, },
          smo: { approvedAt: item.smo_approved_at, approvedBy: item.smo_approved_by_profile?.name },
          gmo: { approvedAt: item.gmo_approved_at, approvedBy: item.gmo_approved_by_profile?.name },
          boi: { approvedAt: item.boi_approved_at, approvedBy: item.boi_approved_by_profile?.name },
          director: { approvedAt: item.director_approved_at, approvedBy: item.director_approved_by_profile?.name },
          gm: { approvedAt: item.gm_approved_at, approvedBy: item.gm_approved_by_profile?.name, isHold: isGMHold, holdReason: isGMHold ? holdReason : null },
          admin: { approvedAt: item.admin_approved_at, approvedBy: item.admin_approved_by_profile?.name },
          ceo: { approvedAt: item.ceo_approved_at, approvedBy: item.ceo_approved_by_profile?.name, isHold: isCEOHold, holdReason: isCEOHold ? holdReason : null },
          accounts: { approvedAt: item.paid_at, approvedBy: item.accounts_executed_by_profile?.name || item.paid_by_profile?.name },
        };

        return {
          key: step.role === 'requester' ? 'submitted' : step.role,
          label: step.role === 'requester' ? 'Submitted' : step.label,
          alwaysShow: step.role === 'requester',
          ...approvalMap[step.role],
        };
      });
    }

    const isSalaryAdvance = item.tags?.includes('Salary Advance') || item.tags?.includes('salary_advance') || item.purpose?.toLowerCase().includes('salary advance');

    let steps: any[] = [];

    const isJV = item.is_jv_payment === true || department === 'jv_engineering';

    if (isJV) {
      // JV ENGINEERING: SMO → Director → GM → Admin → CEO
      steps = [
        { key: 'submitted', label: 'Submitted', approvedAt: item.created_at, approvedBy: item.requester?.name, alwaysShow: true },
        { key: 'smo', label: 'SMO Audit', approvedAt: item.smo_approved_at, approvedBy: item.smo_approved_by_profile?.name },
        { key: 'director', label: 'Director Audit', approvedAt: item.director_approved_at, approvedBy: item.director_approved_by_profile?.name },
        { key: 'gm', label: 'GM Approval', approvedAt: item.gm_approved_at, approvedBy: item.gm_approved_by_profile?.name, isHold: isGMHold, holdReason: isGMHold ? holdReason : null },
      ];
    } else if (department === 'engineering') {
      // ENGINEERING: SMO → GMO → BOI → GM → (HR if Salary Advance) → Admin → CEO
      steps = [
        { key: 'submitted', label: 'Submitted', approvedAt: item.created_at, approvedBy: item.requester?.name, alwaysShow: true },
        { key: 'smo', label: 'SMO Audit', approvedAt: item.smo_approved_at, approvedBy: item.smo_approved_by_profile?.name },
        { key: 'gmo', label: 'GMO Audit', approvedAt: item.gmo_approved_at, approvedBy: item.gmo_approved_by_profile?.name },
        { key: 'boi', label: 'BOI Audit', approvedAt: item.boi_approved_at, approvedBy: item.boi_approved_by_profile?.name },
        { key: 'gm', label: 'GM Approval', approvedAt: item.gm_approved_at, approvedBy: item.gm_approved_by_profile?.name, isHold: isGMHold, holdReason: isGMHold ? holdReason : null },
      ];
    } else if (department.includes('agri')) {
      // AGRI: SMO → BOI → Director → (HR if Salary Advance) → Admin → CEO
      steps = [
        { key: 'submitted', label: 'Submitted', approvedAt: item.created_at, approvedBy: item.requester?.name, alwaysShow: true },
        { key: 'smo', label: 'SMO Audit', approvedAt: item.smo_approved_at, approvedBy: item.smo_approved_by_profile?.name },
        { key: 'boi', label: 'BOI Audit', approvedAt: item.boi_approved_at, approvedBy: item.boi_approved_by_profile?.name },
        { key: 'director', label: 'Director Approval', approvedAt: item.director_approved_at, approvedBy: item.director_approved_by_profile?.name },
      ];
    } else if (department === 'agri_mart' || department === 'accounts') {
      // AGRI MART / ACCOUNTS: Director → (HR if Salary Advance) → Admin → CEO
      steps = [
        { key: 'submitted', label: 'Submitted', approvedAt: item.created_at, approvedBy: item.requester?.name, alwaysShow: true },
        { key: 'director', label: 'Director Approval', approvedAt: item.director_approved_at, approvedBy: item.director_approved_by_profile?.name },
      ];
    } else if (String(department) === 'r_and_d' || String(department) === 'purchase' || String(department) === 'rnd') {
      // R&D / PURCHASE: GM → (HR if Salary Advance) → Admin → CEO
      steps = [
        { key: 'submitted', label: 'Submitted', approvedAt: item.created_at, approvedBy: item.requester?.name, alwaysShow: true },
        { key: 'gm', label: 'GM Approval', approvedAt: item.gm_approved_at, approvedBy: item.gm_approved_by_profile?.name },
      ];
    } else {
      // OTHERS: (HR if Salary Advance) → Admin → CEO
      steps = [
        { key: 'submitted', label: 'Submitted', approvedAt: item.created_at, approvedBy: item.requester?.name, alwaysShow: true },
      ];
    }

    // Add HR Audit step for Salary Advance
    if (isSalaryAdvance) {
      steps.push({ key: 'hr', label: 'HR Audit', approvedAt: item.hr_approved_at, approvedBy: item.hr_approved_by_profile?.name });
    }

    // Final common steps
    steps.push(
      { key: 'admin', label: 'Admin Approval', approvedAt: item.admin_approved_at, approvedBy: item.admin_approved_by_profile?.name },
      { key: 'ceo', label: 'CEO Approval', approvedAt: item.ceo_approved_at, approvedBy: item.ceo_approved_by_profile?.name, isHold: isCEOHold, holdReason: isCEOHold ? holdReason : null },
    );

    return steps;
  };

  const getMaterialWorkflowSteps = () => {
    return [
      { key: 'submitted', label: 'Submitted', approvedAt: item.created_at, approvedBy: item.requester?.name, alwaysShow: true },
      { key: 'smo', label: 'SMO Audit', approvedAt: item.smo_approved_at, approvedBy: item.smo_approved_by_profile?.name },
      { key: 'gmo', label: 'GMO Audit', approvedAt: item.gmo_approved_at, approvedBy: item.gmo_approved_by_profile?.name },
      { key: 'gm', label: 'GM Verification', approvedAt: item.gm_approved_at, approvedBy: item.gm_approved_by_profile?.name },
      { key: 'admin', label: 'Admin Approval', approvedAt: item.admin_approved_at, approvedBy: item.admin_approved_by_profile?.name },
      { key: 'ceo', label: 'CEO Approval', approvedAt: item.ceo_approved_at, approvedBy: item.ceo_approved_by_profile?.name },
      { key: 'sourcing', label: 'Sourcing', approvedAt: item.status === 'sourcing' || item.status === 'ordered' || item.status === 'delivered' ? item.updated_at : null, approvedBy: null },
      { key: 'ordered', label: 'Ordered', approvedAt: item.status === 'ordered' || item.status === 'delivered' ? item.updated_at : null, approvedBy: null },
      { key: 'delivered', label: 'Delivered', approvedAt: item.status === 'delivered' ? item.updated_at : null, approvedBy: null },
    ];
  };

  const getWorkWorkflowSteps = () => {
    return [
      { key: 'submitted', label: 'Submitted', approvedAt: item.created_at, approvedBy: item.requester?.name, alwaysShow: true },
      { key: 'smo', label: 'SMO Audit', approvedAt: item.smo_approved_at, approvedBy: item.smo_approved_by_profile?.name },
      { key: 'gmo', label: 'GMO Audit', approvedAt: item.gmo_approved_at, approvedBy: item.gmo_approved_by_profile?.name },
      { key: 'sourcing', label: 'Vendor Sourcing', approvedAt: item.status === 'vendor_search' || item.status === 'vendor_aligned' || item.status === 'wo_created' ? item.updated_at : null, approvedBy: null },
      { key: 'aligned', label: 'Vendor Aligned', approvedAt: item.status === 'vendor_aligned' || item.status === 'wo_created' ? item.updated_at : null, approvedBy: null },
      { key: 'wo', label: 'WO Created', approvedAt: item.status === 'wo_created' ? item.updated_at : null, approvedBy: null },
    ];
  };

  const getTransportWorkflowSteps = () => {
    return [
      { key: 'submitted', label: 'Submitted', approvedAt: item.created_at, approvedBy: item.creator?.name || item.requester?.name, alwaysShow: true },
      { key: 'dept_head', label: 'Dept Head Approval', approvedAt: item.dept_head_approved_at, approvedBy: item.dept_head_approved_by_profile?.name },
      { key: 'admin', label: 'Admin Verified', approvedAt: item.admin_approved_at, approvedBy: item.admin_approved_by_profile?.name },
      { key: 'accounts', label: 'Accounts Approved', approvedAt: item.accounts_approved_at, approvedBy: item.accounts_approved_by_profile?.name },
      { key: 'paid', label: 'Paid', approvedAt: item.paid_at, approvedBy: item.paid_by_profile?.name },
    ];
  };

  const steps = type === 'material' ? getMaterialWorkflowSteps() : type === 'work' ? getWorkWorkflowSteps() : type === 'transport' ? getTransportWorkflowSteps() : getWorkflowSteps();

  const renderStep = (step: any, index: number) => {
    const isCompleted = !!step.approvedAt;
    const isHold = !!step.isHold;
    const stepHoldReason = step.holdReason;

    // A step is "current" if it's not completed, not on hold, and the previous step (if any) was completed
    const isCurrent = !isCompleted && !isHold && !isRejected && (index === 0 || !!steps[index - 1]?.approvedAt);

    const isSubmitted = step.key === 'submitted';

    // Only show steps that are completed, current, on hold, or the very next pending one
    const shouldShow = step.alwaysShow || isCompleted || isCurrent || isHold;
    if (!shouldShow && !isCurrent) return null;

    return (
      <div key={step.key} className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center min-w-8",
            isCompleted ? "bg-status-live/20" :
              isHold ? "bg-orange-500/20" :
                (isRejected && isCurrent) ? "bg-status-missed/20" :
                  isCurrent ? "bg-primary/20" : "bg-muted/50"
          )}>
            {isCompleted ? (
              <Check className="w-4 h-4 text-status-live" />
            ) : isHold ? (
              <Pause className="w-4 h-4 text-orange-500 animate-pulse" />
            ) : (isRejected && isCurrent) ? (
              <X className="w-4 h-4 text-status-missed" />
            ) : isCurrent ? (
              <Clock className="w-4 h-4 text-primary" />
            ) : (
              <Clock className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <p className={cn(
              "text-sm font-medium",
              isHold ? "text-orange-500" : ""
            )}>
              {isRejected && isCurrent ? `Rejected at ${step.label}` : isHold ? `${step.label} (ON HOLD)` : step.label}
            </p>
            <p className="text-xs text-muted-foreground">
              {isCompleted
                ? format(new Date(step.approvedAt), 'dd MMM yyyy, HH:mm')
                : isHold
                  ? 'Waiting for clarification...'
                  : isRejected && isCurrent
                    ? 'Request rejected'
                    : 'Pending verification...'}
            </p>
            {step.approvedBy && isCompleted && (
              <p className="text-xs text-muted-foreground">By: {step.approvedBy}</p>
            )}
          </div>
        </div>

        {/* Hold Reason Block */}
        {isHold && stepHoldReason && (
          <div className="ml-11 mt-1 p-2 rounded-md bg-orange-500/5 border border-orange-500/20">
            <p className="text-xs text-orange-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span><span className="font-semibold">Hold Reason:</span> {stepHoldReason}</span>
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-4 p-4 rounded-lg bg-muted/20 border border-border">
      <p className="text-sm font-medium mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        Approval Timeline
        <span className="text-xs text-muted-foreground ml-2 capitalize">({department} Flow)</span>
      </p>

      {/* Reversal Warning - Needs Review */}
      {isReversed && type === 'payment' && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border-2 border-amber-500/50 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-black" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-amber-500 flex items-center gap-2">
                ⚠️ NEEDS REVIEW - CONTACT ADMIN IMMEDIATELY
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium">Issue:</span> {item.accounts_reversal_reason}
              </p>
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <Phone className="w-3 h-3" />
                Bank details need correction. Please contact Admin to resolve.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {steps.map((step, index) => renderStep(step, index))}

        {/* Accounts Execution - Only for payments after CEO approval */}
        {type === 'payment' && item.ceo_approved_at && (
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              item.paid_at ? "bg-status-live/20" : "bg-muted/50"
            )}>
              {item.paid_at ? (
                <Check className="w-4 h-4 text-status-live" />
              ) : (
                <IndianRupee className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {item.paid_at ? 'Payment Released' : 'Accounts (Payment Release)'}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.paid_at
                  ? format(new Date(item.paid_at), 'dd MMM yyyy, HH:mm')
                  : 'Ready for payment release'}
              </p>
              {item.utr_number && (
                <p className="text-xs text-primary font-medium">UTR: {item.utr_number}</p>
              )}
              {item.accounts_executed_by_profile?.name && (
                <p className="text-xs text-muted-foreground">By: {item.accounts_executed_by_profile.name}</p>
              )}
            </div>
          </div>
        )}

        {/* Ready for Payment Badge - for WO/PO after CEO approval */}
        {(type === 'wo' || type === 'po') && item.ceo_approved_at && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-status-live/20 flex items-center justify-center">
              <IndianRupee className="w-4 h-4 text-status-live" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-status-live">Ready for Payment</p>
              <p className="text-xs text-muted-foreground">
                Approved on {format(new Date(item.ceo_approved_at), 'dd MMM yyyy, HH:mm')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const REQUEST_FILTER_GROUPS: Record<string, string[]> = {
  submitted: ['pending', 'smo_audit', 'gmo_audit', 'boi_audit', 'director_audit', 'gm_audit', 'admin_audit', 'ceo_audit', 'admin_approved', 'pending_smo', 'pending_gmo', 'pending_gm', 'pending_admin', 'pending_ceo'],
  pending_smo: ['pending', 'smo_audit', 'pending_smo'],
  pending_gmo: ['gmo_audit', 'pending_gmo'],
  pending_boi: ['boi_audit'],
  pending_director: ['director_audit'],
  pending_gm: ['gm_audit', 'pending_gm'],
  pending_admin: ['admin_audit', 'pending_admin'],
  pending_ceo: ['ceo_audit', 'admin_approved', 'pending_ceo'],
  approved: ['ceo_approved', 'completed'],
  on_hold: ['ceo_hold', 'gm_hold'],
  rejected: ['rejected', 'rejected_smo'],
  paid: ['paid', 'accounts_execution', 'bulk_prepared', 'bank_uploaded'],
};

function matchesRequestFilter(status: string | null | undefined, filterStatus: string, approvalStatus?: string | null) {
  if (filterStatus === 'all') return true;

  const candidates = [status, approvalStatus].filter(Boolean) as string[];
  const group = REQUEST_FILTER_GROUPS[filterStatus];

  if (group) {
    return candidates.some((candidate) => group.includes(candidate));
  }

  return candidates.includes(filterStatus);
}

function SubmittedPaymentDetails({ request }: { request: any }) {
  const detailRows = [
    { label: 'Department', value: request.requester?.department || request.department || 'N/A' },
    { label: 'Submitted', value: request.created_at ? format(new Date(request.created_at), 'dd MMM yyyy, HH:mm') : 'N/A' },
    { label: 'Cutoff', value: request.cutoff_date && request.cutoff_time ? `${request.cutoff_date} ${request.cutoff_time}` : 'N/A' },
    { label: 'Vendor', value: request.vendor_name || 'N/A' },
    { label: 'Beneficiary', value: request.beneficiary_name || 'N/A' },
    { label: 'Payment Type', value: request.payment_type ? String(request.payment_type).replace(/_/g, ' ') : 'N/A' },
    { label: 'Account / UPI', value: request.vendor_account_number || request.vendor_upi || 'N/A' },
    { label: 'IFSC', value: request.vendor_ifsc_code || 'N/A' },
  ];

  return (
    <div className="mt-4 p-4 rounded-lg bg-muted/20 border border-border space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <ClipboardList className="w-4 h-4" />
          Submitted Details
        </p>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          {statusConfig[request.status]?.label || request.status}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {detailRows.map((row) => (
          <div key={row.label} className="rounded-md border border-border/60 bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{row.label}</p>
            <p className="mt-1 text-sm font-medium break-all">{row.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border/60 bg-background/40 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Purpose</p>
          <p className="mt-1 text-sm font-medium whitespace-pre-wrap">{request.purpose || 'N/A'}</p>
        </div>
        <div className="rounded-md border border-border/60 bg-background/40 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Description</p>
          <p className="mt-1 text-sm whitespace-pre-wrap text-foreground/90">{request.detailed_description || request.vendor_bank_details || 'No additional details provided.'}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {request.bill_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={request.bill_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" /> Bill / Invoice
            </a>
          </Button>
        )}
        {request.work_proof_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={request.work_proof_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" /> Work Proof
            </a>
          </Button>
        )}
        {(request.tags || []).map((tag: string) => (
          <Badge key={tag} variant="secondary">{tag}</Badge>
        ))}
      </div>
    </div>
  );
}

export function MyRequestsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { requests: myRequests, isLoading: paymentLoading, resubmitPaymentRequest, isSaving: paymentSaving } = useMyPaymentRequests();
  const { workOrders } = useWorkOrders();
  const { requests: myMaterialRequests, isLoading: materialLoading } = useMyMaterialRequests();
  const { requests: myWorkRequests, isLoading: workLoading } = useMyVendorWorkRequests();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { payees, addPayee } = usePayees();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openProjectCombobox, setOpenProjectCombobox] = useState(false);
  const [openPayeeCombobox, setOpenPayeeCombobox] = useState(false);
  const [savePayee, setSavePayee] = useState(false);

  // Edit dialogs state
  const [editPaymentDialog, setEditPaymentDialog] = useState<{ open: boolean; payment: any }>({ open: false, payment: null });

  // Receipt State
  const [receiptDialog, setReceiptDialog] = useState<{ open: boolean; payment: any }>({ open: false, payment: null });

  const [editPaymentForm, setEditPaymentForm] = useState({
    purpose: '',
    vendorName: '',
    vendorBankDetails: '',
    amount: 0,
    billUrl: '',
    workProofUrl: '',
    cutoffDate: '',
    cutoffTime: '',
    urgency: 'normal',
    isProjectWork: true,
    projectId: '',
    phaseId: '',
    workOrderId: '',
    woNumber: '',
    paymentType: 'bank_transfer',
    vendorUpi: '',
    vendorAccountNumber: '',
    vendorIfscCode: '',
    beneficiaryName: '',
    detailedDescription: '',
    tags: [] as string[],
  });

  // Split payment editing state
  const [editSplits, setEditSplits] = useState<any[]>([]);

  const [editProjectId, setEditProjectId] = useState('');
  const { phases: editPhases, isLoading: editPhasesLoading } = useProjectPhases(editProjectId || undefined);

  useEffect(() => {
    if (editPaymentForm.projectId !== editProjectId) {
      setEditProjectId(editPaymentForm.projectId || '');
    }
  }, [editPaymentForm.projectId, editProjectId]);

  const isEngineeringLikeUser = ['engineering', 'jv_engineering'].includes(normalizeDepartment(user?.department));


  const filteredRequests = (filterStatus === 'all'
    ? myRequests
    : myRequests.filter(r => matchesRequestFilter(r.status, filterStatus))
  ).filter(r => r.status !== 'draft');

  const filteredMaterialRequests = (filterStatus === 'all'
    ? myMaterialRequests
    : myMaterialRequests.filter(r => matchesRequestFilter(r.status, filterStatus, (r as any).approval_status))
  ).filter(r => r.boq_items && r.boq_items.length > 0);

  const filteredWorkRequests = (filterStatus === 'all'
    ? myWorkRequests
    : myWorkRequests.filter(r => matchesRequestFilter(r.status, filterStatus, (r as any).approval_status))
  );

  const filteredTransportRequests = (filterStatus === 'all'
    ? myRequests
    : myRequests.filter(r => matchesRequestFilter(r.status, filterStatus))
  ).filter(r => r.status !== 'draft' && r.is_transport_payment);

  const totalAmount = filteredRequests.reduce((sum, r) => sum + Number(r.amount), 0);

  const isLoading = paymentLoading || materialLoading || workLoading;

  // Open Payment edit dialog
  const openPaymentEditDialog = (payment: any) => {
    setEditProjectId(payment.project_id || '');
    setEditPaymentForm({
      purpose: payment.purpose || '',
      vendorName: payment.vendor_name || '',
      vendorBankDetails: payment.vendor_bank_details || '',
      amount: payment.amount || 0,
      billUrl: payment.bill_url || '',
      workProofUrl: payment.work_proof_url || '',
      cutoffDate: payment.cutoff_date || '',
      cutoffTime: payment.cutoff_time || '',
      urgency: payment.urgency || 'normal',
      isProjectWork: payment.is_project_work ?? true,
      projectId: payment.project_id || '',
      phaseId: payment.phase_id || '',
      workOrderId: payment.work_order_id || '',
      woNumber: payment.wo_number || '',
      paymentType: payment.payment_type || 'bank_transfer',
      vendorUpi: payment.vendor_upi || '',
      vendorAccountNumber: payment.vendor_account_number || '',
      vendorIfscCode: payment.vendor_ifsc_code || '',
      beneficiaryName: payment.beneficiary_name || '',
      detailedDescription: payment.detailed_description || '',
      tags: payment.tags || [],
    });
    // Populate split entries for split payments
    if (payment.is_split_payment && payment.splits) {
      setEditSplits(payment.splits.map((s: any) => ({
        id: s.id,
        split_number: s.split_number,
        split_title: s.split_title || '',
        payee_name: s.payee_name || '',
        beneficiary_name: s.beneficiary_name || s.payee_name || '',
        amount: s.amount || 0,
        payment_method: s.payment_method || 'bank_transfer',
        account_number: s.account_number || '',
        ifsc_code: s.ifsc_code || '',
        upi_id: s.upi_id || '',
      })));
    } else {
      setEditSplits([]);
    }
    setEditPaymentDialog({ open: true, payment });
  };

  // Handle Payment resubmit
  const handlePaymentResubmit = async () => {
    if (!editPaymentDialog.payment) return;
    const isEngineering = (user?.department || '').toLowerCase().includes('engineering');
    if (editPaymentForm.isProjectWork && isEngineering) {
      if (!editPaymentForm.phaseId) {
        toast.error('Please select a project phase for Engineering payments');
        return;
      }
      if (!editPhasesLoading && editPhases.length === 0) {
        toast.error('No project phases configured. Please contact Admin.');
        return;
      }
    }
    const result = await resubmitPaymentRequest(editPaymentDialog.payment.id, {
      ...editPaymentForm,
      ...(editPaymentDialog.payment.is_split_payment && editSplits.length > 0 ? { splits: editSplits } : {}),
    });
    if (result.success) {
      setEditPaymentDialog({ open: false, payment: null });
    }
  };

  const handleSelectPayee = (payee: Payee) => {
    setEditPaymentForm(prev => ({
      ...prev,
      vendorName: payee.name,
      paymentType: 'bank_transfer',
      vendorAccountNumber: payee.account_number || '',
      vendorIfscCode: payee.ifsc_code || '',
      beneficiaryName: payee.name,
    }));
    setOpenPayeeCombobox(false);
    toast.success('Payee details pre-filled');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">My Requests</h1>
          <p className="text-muted-foreground">Track your payment, work order, and purchase order requests</p>
        </div>
        <ExportButtons
          data={filteredRequests.map(r => ({
            id: `PAY-${r.id.slice(0, 6).toUpperCase()}`,
            department: r.department || 'others',
            purpose: r.purpose,
            vendor: r.vendor_name,
            amount: r.amount,
            status: statusConfig[r.status]?.label || r.status,
            urgency: r.urgency,
            created: format(new Date(r.created_at), 'dd MMM yyyy'),
            cutoff: `${r.cutoff_date} ${r.cutoff_time}`,
            proof_url: r.payment_proof_url || r.payment_proof_screenshot || 'N/A'
          }))}
          filename="my-payment-requests"
          title="My Payment Requests"
          headers={[
            { key: 'id', label: 'ID' },
            { key: 'department', label: 'Department' },
            { key: 'purpose', label: 'Purpose' },
            { key: 'vendor', label: 'Vendor' },
            { key: 'amount', label: 'Amount' },
            { key: 'status', label: 'Status' },
            { key: 'urgency', label: 'Urgency' },
            { key: 'created', label: 'Created' },
            { key: 'cutoff', label: 'Cutoff' },
            { key: 'proof_url', label: 'Payment Transaction Proof' },
          ]}
        />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4 mb-6">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="submitted">Submitted / In Review</SelectItem>
            <SelectItem value="pending_smo">Pending SMO</SelectItem>
            <SelectItem value="pending_gmo">Pending GMO</SelectItem>
            <SelectItem value="pending_boi">Pending BOI</SelectItem>
            <SelectItem value="pending_director">Pending Director</SelectItem>
            <SelectItem value="pending_gm">Pending GM</SelectItem>
            <SelectItem value="pending_admin">Pending Admin</SelectItem>
            <SelectItem value="pending_ceo">Pending CEO</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments" className="gap-2">
            <IndianRupee className="w-4 h-4" />
            Payments
            {filteredRequests.length > 0 && <Badge variant="secondary">{filteredRequests.length}</Badge>}
          </TabsTrigger>

          {isEngineeringLikeUser && (
            <>
              <TabsTrigger value="material-requests" className="gap-2">
                <Package className="w-4 h-4" />
                Material Requests
                {filteredMaterialRequests.length > 0 && <Badge variant="secondary">{filteredMaterialRequests.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="vendor-work-requests" className="gap-2">
                <Truck className="w-4 h-4" />
                Vendor Work Requests
                {filteredWorkRequests.length > 0 && <Badge variant="secondary">{filteredWorkRequests.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="transport" className="gap-2">
                <Truck className="w-4 h-4 text-emerald-400" />
                Transport
                {filteredTransportRequests.length > 0 && <Badge variant="secondary">{filteredTransportRequests.length}</Badge>}
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{filteredRequests.length} payment requests</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Total:</span>
              <span className="text-lg font-bold flex items-center">
                <IndianRupee className="w-4 h-4" />
                {totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {filteredRequests.map((request, index) => {
            const status = statusConfig[request.status] || statusConfig.pending;
            const urgency = urgencyConfig[request.urgency] || urgencyConfig.normal;
            const StatusIcon = status.icon;
            const isExpanded = expandedId === `payment-${request.id}`;

            return (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="authority-card"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', status.bg)}>
                      <StatusIcon className={cn('w-6 h-6', status.text)} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-muted-foreground">
                          PAY-{String(request.payment_number || 0).padStart(3, '0')}
                        </span>
                        <span className={cn('text-sm', urgency.text)}>
                          {urgency.icon} {request.urgency.toUpperCase()}
                        </span>
                      </div>
                      <h3 className="font-semibold mb-1">{request.purpose}</h3>
                      <p className="text-sm text-muted-foreground">
                        {request.vendor_name} • {format(new Date(request.created_at), 'dd MMM yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold flex items-center justify-end mb-2">
                      <IndianRupee className="w-5 h-5" />
                      {Number(request.amount).toLocaleString('en-IN')}
                    </p>
                    <span className={cn('inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold', status.bg, status.text)}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </div>
                </div>

                {(request.admin_rejection_reason || request.ceo_hold_reason) && (
                  <div className={cn('mt-4 p-3 rounded-lg', request.admin_rejection_reason ? 'bg-status-missed/10 border border-status-missed/30' : 'bg-authority-ceo/10 border border-authority-ceo/30')}>
                    <p className={cn('text-sm font-medium', request.admin_rejection_reason ? 'text-status-missed' : 'text-authority-ceo')}>
                      {request.admin_rejection_reason ? 'Rejection Reason:' : 'Hold Reason:'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {request.admin_rejection_reason || request.ceo_hold_reason}
                    </p>
                  </div>
                )}

                {(request.status === 'paid' || request.paid_at) && (
                  <div className="mt-4 p-3 rounded-lg bg-status-live/10 border border-status-live/30">
                    <p className="text-sm font-medium text-status-live mb-2">
                      {(request.utr_number || request.is_petty_cash) ? 'Payment Released' : 'Payment Completed'}
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Status:</span>
                          <Badge variant="outline" className={cn(
                            "text-[10px] px-1.5 py-0",
                            request.utr_verified_at ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          )}>
                            {request.utr_verified_at ? 'UTR Verified' : 'Verification Awaited'}
                          </Badge>
                        </div>
                        {request.utr_number && (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs font-medium">{request.utr_number}</span>
                            <button onClick={() => { navigator.clipboard.writeText(request.utr_number || ''); toast.success('UTR copied'); }} className="text-primary hover:text-primary/80">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>


                      {(request.payment_proof_url || request.payment_proof_screenshot) && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <Image className="w-3 h-3" /> Payment Screenshot / Proof
                          </p>
                          <div className="relative group">
                            <img
                              src={request.payment_proof_url || request.payment_proof_screenshot || ''}
                              alt="Payment proof"
                              className="max-h-48 rounded-lg border shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(request.payment_proof_url || request.payment_proof_screenshot || '', '_blank')}
                            />
                            <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs shadow-lg"
                                onClick={(e) => { e.stopPropagation(); window.open(request.payment_proof_url || request.payment_proof_screenshot || '', '_blank'); }}
                              >
                                <Eye className="w-3 h-3 mr-1" /> View
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs shadow-lg"
                                asChild
                              >
                                <a href={request.payment_proof_url || request.payment_proof_screenshot || ''} download target="_blank" rel="noopener noreferrer">
                                  <Download className="w-3 h-3 mr-1" /> Download
                                </a>
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {(request.utr_number || request.is_petty_cash) ? (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full mt-2 bg-emerald-500 hover:bg-emerald-600 text-white border-none shadow-md shadow-emerald-500/20 transition-all h-10 font-bold active:scale-[0.98]"
                          onClick={() => setReceiptDialog({ open: true, payment: request })}
                        >
                          <FileText className="w-4 h-4 mr-2" /> Download Professional Voucher
                        </Button>
                      ) : (
                        <div className="w-full mt-2 p-3 text-center rounded-md bg-amber-500/10 border border-amber-500/20">
                          <Clock className="w-4 h-4 inline mr-1.5 text-amber-500" />
                          <span className="text-sm font-medium text-amber-500">Waiting for UTR — Voucher available after payment reference is recorded</span>
                        </div>
                      )}

                      {!request.utr_verified_at && !request.is_petty_cash && (
                        <div className="p-3 bg-white/5 rounded-md border border-white/10 mt-2">
                          <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                            <Clock className="w-3 h-3 inline mr-1 text-amber-500" />
                            Financial voucher is available, but UTR match is still being verified by our accounts team for audit compliance.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Resubmit Button for rejected/hold */}
                {(request.status === 'rejected' || request.status === 'ceo_hold') && (
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPaymentEditDialog(request)}
                      className="gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edit & Resubmit
                    </Button>
                  </div>
                )}

                {/* View Timeline Button */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : `payment-${request.id}`)}
                    className="mt-4 flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {isExpanded ? 'Hide Timeline' : 'View Approval Timeline'}
                  </button>

                  <div className="mt-4">
                    <IndividualPaymentReminder
                      payment={{
                        id: request.id,
                        status: request.status,
                        purpose: request.purpose,
                        amount: Number(request.amount),
                        urgency: request.urgency,
                        payment_number: request.payment_number
                      }}
                      className="text-primary hover:text-primary/80 transition-colors p-0 h-auto"
                      showText={true}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <>
                    <SubmittedPaymentDetails request={request} />
                    <ApprovalTimeline item={request} type="payment" />
                  </>
                )}
              </motion.div>
            );
          })}

          {filteredRequests.length === 0 && (
            <div className="authority-card text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold">No Payment Requests</p>
            </div>
          )}
        </TabsContent>



        {/* Material Requests & Vendor Work Requests Tabs - Engineering Only */}
        {isEngineeringLikeUser && (
          <>
            {/* Material Requests Tab */}
            <TabsContent value="material-requests" className="space-y-4 mt-4">
              <span className="text-sm text-muted-foreground">{filteredMaterialRequests.length} material requests</span>
              {filteredMaterialRequests.map((req, index) => {
                const displayKey = getMaterialDisplayStatus(req);
                const status = statusConfig[displayKey] || statusConfig[req.status] || statusConfig.pending;
                const StatusIcon = status.icon;
                const isExpanded = expandedId === `material-${req.id}`;

                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="authority-card mb-4 p-4 rounded-lg bg-card border border-border"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', status.bg)}>
                          <StatusIcon className={cn('w-6 h-6', status.text)} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">{req.project?.project_name}</Badge>
                            <span className={cn("text-xs font-semibold uppercase",
                              req.urgency === 'critical' ? 'text-red-500' :
                                req.urgency === 'high' ? 'text-amber-500' : 'text-blue-500'
                            )}>
                              {req.urgency} Priority
                            </span>
                          </div>
                          <h3 className="font-semibold mb-1">
                            {req.boq_items?.length || 0} Items Requested
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(req.created_at), 'dd MMM yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={cn('inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold', status.bg, status.text)}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </div>
                    </div>

                    {/* View Timeline Button for Material Request */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : `material-${req.id}`)}
                      className="mt-4 flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {isExpanded ? 'Hide Timeline' : 'View Approval Timeline'}
                    </button>

                    {isExpanded && <ApprovalTimeline item={req} type="material" />}
                  </motion.div>
                );
              })}
              {filteredMaterialRequests.length === 0 && (
                <div className="authority-card text-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-semibold">No Material Requests</p>
                </div>
              )}
            </TabsContent>

            {/* Vendor Work Requests Tab */}
            <TabsContent value="vendor-work-requests" className="space-y-4 mt-4">
              <span className="text-sm text-muted-foreground">{filteredWorkRequests.length} vendor work requests</span>
              {filteredWorkRequests.map((req, index) => {
                const displayKey = getMaterialDisplayStatus(req as any);
                const status = statusConfig[displayKey] || statusConfig[req.status] || statusConfig.pending;
                const StatusIcon = status.icon;
                const isExpanded = expandedId === `work-${req.id}`;

                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="authority-card mb-4 p-4 rounded-lg bg-card border border-border"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', status.bg)}>
                          <StatusIcon className={cn('w-6 h-6', status.text)} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">{req.work_type}</Badge>
                            <span className="text-xs text-muted-foreground">{format(new Date(req.created_at), 'dd MMM yyyy')}</span>
                          </div>
                          <h3 className="font-semibold mb-1">{req.work_description}</h3>
                          <p className="text-sm text-muted-foreground">
                            {req.project?.project_name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={cn('inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold', status.bg, status.text)}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </div>
                    </div>

                    {/* View Timeline Button for Work Request */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : `work-${req.id}`)}
                      className="mt-4 flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {isExpanded ? 'Hide Timeline' : 'View Approval Timeline'}
                    </button>

                    {isExpanded && <ApprovalTimeline item={req} type="work" />}
                  </motion.div>
                );
              })}
              {filteredWorkRequests.length === 0 && (
                <div className="authority-card text-center py-12">
                  <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-semibold">No Vendor Work Requests</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="transport" className="space-y-4 mt-4">
              <span className="text-sm text-muted-foreground">{filteredRequests.filter(r => r.is_transport_payment).length} transport requests</span>
              {filteredRequests.filter(r => r.is_transport_payment).map((request, index) => {
                const status = statusConfig[request.status] || statusConfig.pending;
                const StatusIcon = status.icon;
                const isExpanded = expandedId === `transport-${request.id}`;

                return (
                  <motion.div
                    key={request.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn("authority-card mb-4 p-4 rounded-lg bg-card border",
                      request.status === 'rejected' ? 'border-status-missed bg-status-missed/5' :
                        'border-primary bg-primary/5 hover:border-primary'
                    )}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                          statusConfig[request.status]?.bg, statusConfig[request.status]?.text
                        )}>
                          <Truck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              TRANSPORT
                            </Badge>
                            <span className="text-xs text-muted-foreground">{format(new Date(request.created_at), 'dd MMM yyyy')}</span>
                          </div>
                          <h3 className="font-semibold mb-1">{request.vendor_name || 'Multiple Vendors'}</h3>
                          <p className="text-sm text-muted-foreground">
                            {request.purpose}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {request.transport_trips?.length || 0} Trips Registered
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold flex items-center justify-end mb-2">
                          <IndianRupee className="w-5 h-5" />
                          {Number(request.amount).toLocaleString('en-IN')}
                        </p>
                        <span className={cn('inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold', statusConfig[request.status]?.bg, statusConfig[request.status]?.text)}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig[request.status]?.label || request.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-4">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : `transport-${request.id}`)}
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {isExpanded ? 'Hide Timeline' : 'View Approval Timeline'}
                      </button>
                      <Button variant="outline" size="sm" onClick={() => setReceiptDialog({ open: true, payment: request })}>
                        View Details
                      </Button>
                    </div>

                    {isExpanded && <ApprovalTimeline item={request} type="payment" />}
                  </motion.div>
                );
              })}
              {filteredRequests.filter(r => r.is_transport_payment).length === 0 && (
                <div className="authority-card text-center py-12">
                  <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-semibold">No Transport Expenses</p>
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Payment Edit Dialog */}
      <Dialog open={editPaymentDialog.open} onOpenChange={(open) => setEditPaymentDialog({ open, payment: open ? editPaymentDialog.payment : null })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit & Resubmit Payment Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-muted-foreground/10">
              <div className="flex-1">
                <p className="text-sm font-semibold mb-1">Work Type</p>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs transition-colors", !editPaymentForm.isProjectWork ? "text-primary font-bold" : "text-muted-foreground")}>Non-Project</span>
                  <Switch
                    checked={editPaymentForm.isProjectWork}
                    onCheckedChange={(checked) => {
                      if (!checked) setEditProjectId('');
                      setEditPaymentForm({ ...editPaymentForm, isProjectWork: checked, projectId: '', phaseId: '', workOrderId: '', woNumber: '' });
                    }}
                  />
                  <span className={cn("text-xs transition-colors", editPaymentForm.isProjectWork ? "text-primary font-bold" : "text-muted-foreground")}>Project Based</span>
                </div>
              </div>
            </div>

            {editPaymentForm.isProjectWork && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <Label>Project *</Label>
                  <Popover open={openProjectCombobox} onOpenChange={setOpenProjectCombobox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openProjectCombobox}
                        className="w-full justify-between"
                      >
                        {editPaymentForm.projectId
                          ? projects.find((p) => p.id === editPaymentForm.projectId)?.project_name
                          : "Select project..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Search project..." />
                        <CommandList>
                          <CommandEmpty>No project found.</CommandEmpty>
                          <CommandGroup>
                            {projects.map((p) => (
                              <CommandItem
                                key={p.id}
                                value={p.project_name}
                                onSelect={() => {
                                  setEditProjectId(p.id);
                                  setEditPaymentForm({ ...editPaymentForm, projectId: p.id, phaseId: '', workOrderId: '', woNumber: '' });
                                  setOpenProjectCombobox(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    editPaymentForm.projectId === p.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="font-medium">{p.project_id} - {p.project_name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Project Phase *</Label>
                  <Select
                    value={editPaymentForm.phaseId || ''}
                    onValueChange={(value) => setEditPaymentForm({ ...editPaymentForm, phaseId: value })}
                    disabled={!editPaymentForm.projectId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!editPaymentForm.projectId ? "Select project first" : (editPhasesLoading ? "Loading phases..." : "Select phase")} />
                    </SelectTrigger>
                    <SelectContent>
                      {editPhasesLoading ? (
                        <SelectItem value="loading" disabled>Loading phases...</SelectItem>
                      ) : editPhases.length === 0 ? (
                        <SelectItem value="none" disabled>No phases found</SelectItem>
                      ) : (
                        editPhases.map((phase) => (
                          <SelectItem key={phase.id} value={phase.id}>
                            {phase.phase_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Work Order *</Label>
                  <Select
                    disabled={!editPaymentForm.projectId}
                    value={editPaymentForm.workOrderId}
                    onValueChange={(value) => {
                      const wo = workOrders.find(w => w.id === value);
                      setEditPaymentForm({
                        ...editPaymentForm,
                        workOrderId: value,
                        woNumber: wo ? wo.wo_number.toString() : '',
                        phaseId: wo?.boq_item?.phase?.id || wo?.boq_item?.phase_id || editPaymentForm.phaseId
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!editPaymentForm.projectId ? "Select project first" : "Select Work Order"} />
                    </SelectTrigger>
                    <SelectContent>
                      {workOrders
                        .filter(wo => wo.project_id === editPaymentForm.projectId && (wo.status === 'ceo_approved' || wo.status === 'admin_approved' || wo.status === 'pending' || wo.status === 'pending_admin'))
                        .map((wo) => (
                          <SelectItem key={wo.id} value={wo.id}>
                            WO #{wo.wo_number} - {wo.work_description}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div>
              <Label>Payment Purpose *</Label>
              <Input
                value={editPaymentForm.purpose}
                onChange={(e) => setEditPaymentForm({ ...editPaymentForm, purpose: e.target.value })}
                placeholder="Brief purpose of payment"
              />
            </div>

            <div>
              <Label>Detailed Description</Label>
              <Textarea
                value={editPaymentForm.detailedDescription}
                onChange={(e) => setEditPaymentForm({ ...editPaymentForm, detailedDescription: e.target.value })}
                rows={3}
                placeholder="Optional detailed explanation..."
              />
            </div>

            {/* Payee Details — Split vs Single */}
            {editPaymentDialog.payment?.is_split_payment && editSplits.length > 0 ? (
              <div className="space-y-4 p-4 rounded-xl bg-muted/20 border border-muted-foreground/10">
                <div className="flex items-center justify-between gap-4">
                  <Label className="font-bold">Split Payment Details ({editSplits.length} Splits)</Label>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <IndianRupee className="w-3.5 h-3.5" />
                    {editSplits.reduce((sum: number, s: any) => sum + Number(s.amount), 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="space-y-4">
                  {editSplits.map((split: any, index: number) => (
                    <div key={split.id || index} className="p-3 rounded-lg bg-background/50 border border-border space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/20 text-primary">Split #{split.split_number || index + 1}</span>
                          <span className="text-sm font-mono flex items-center gap-0.5 ml-auto">
                            <IndianRupee className="w-3 h-3" />{Number(split.amount).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Split Title</Label>
                          <Input
                            value={split.split_title}
                            onChange={(e) => {
                              const updated = [...editSplits];
                              updated[index] = { ...updated[index], split_title: e.target.value };
                              setEditSplits(updated);
                            }}
                            placeholder="Split title / description"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Payee Name</Label>
                          <Input
                            value={split.payee_name}
                            onChange={(e) => {
                              const updated = [...editSplits];
                              updated[index] = { ...updated[index], payee_name: e.target.value };
                              setEditSplits(updated);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Beneficiary Name</Label>
                          <Input
                            value={split.beneficiary_name}
                            onChange={(e) => {
                              const updated = [...editSplits];
                              updated[index] = { ...updated[index], beneficiary_name: e.target.value };
                              setEditSplits(updated);
                            }}
                          />
                        </div>
                      </div>
                      {split.payment_method === 'upi' ? (
                        <div className="space-y-1">
                          <Label className="text-xs">UPI ID / Number *</Label>
                          <Input
                            value={split.upi_id}
                            onChange={(e) => {
                              const updated = [...editSplits];
                              updated[index] = { ...updated[index], upi_id: e.target.value };
                              setEditSplits(updated);
                            }}
                            placeholder="example@okaxis"
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Account Number *</Label>
                            <Input
                              value={split.account_number}
                              onChange={(e) => {
                                const updated = [...editSplits];
                                updated[index] = { ...updated[index], account_number: e.target.value };
                                setEditSplits(updated);
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">IFSC Code *</Label>
                            <Input
                              value={split.ifsc_code}
                              onChange={(e) => {
                                const updated = [...editSplits];
                                updated[index] = { ...updated[index], ifsc_code: e.target.value };
                                setEditSplits(updated);
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 p-4 rounded-xl bg-muted/20 border border-muted-foreground/10">
                <div className="flex items-center justify-between gap-4">
                  <Label className="font-bold">Payee Details</Label>
                  <div className="flex items-center gap-4">
                    <Popover open={openPayeeCombobox} onOpenChange={setOpenPayeeCombobox}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 gap-2">
                          <User className="w-3.5 h-3.5" /> Use Saved Payee
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="end">
                        <Command>
                          <CommandInput placeholder="Search saved payees..." />
                          <CommandList>
                            <CommandEmpty>No payee found.</CommandEmpty>
                            <CommandGroup>
                              {payees.map((payee) => (
                                <CommandItem
                                  key={payee.id}
                                  value={payee.name}
                                  onSelect={() => handleSelectPayee(payee)}
                                >
                                  <div className="flex flex-col">
                                    <span>{payee.name}</span>
                                    <span className="text-[10px] text-muted-foreground">{payee.bank_name} • {payee.account_number}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Payee Name *</Label>
                    <Input
                      value={editPaymentForm.vendorName}
                      onChange={(e) => setEditPaymentForm({ ...editPaymentForm, vendorName: e.target.value })}
                      placeholder="Enter name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (₹) *</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        className="pl-9"
                        value={editPaymentForm.amount}
                        onChange={(e) => setEditPaymentForm({ ...editPaymentForm, amount: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">Payment Method</Label>
                  <Tabs value={editPaymentForm.paymentType === 'upi' ? 'upi' : 'bank_transfer'} onValueChange={(v) => setEditPaymentForm({ ...editPaymentForm, paymentType: v })}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="bank_transfer">Bank Transfer</TabsTrigger>
                      <TabsTrigger value="upi">UPI (GPay/PhonePe)</TabsTrigger>
                    </TabsList>
                    <TabsContent value="bank_transfer" className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Account Number *</Label>
                          <Input
                            value={editPaymentForm.vendorAccountNumber}
                            onChange={(e) => setEditPaymentForm({ ...editPaymentForm, vendorAccountNumber: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>IFSC Code *</Label>
                          <Input
                            value={editPaymentForm.vendorIfscCode}
                            onChange={(e) => setEditPaymentForm({ ...editPaymentForm, vendorIfscCode: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Beneficiary Name</Label>
                        <Input
                          value={editPaymentForm.beneficiaryName}
                          onChange={(e) => setEditPaymentForm({ ...editPaymentForm, beneficiaryName: e.target.value })}
                        />
                      </div>
                    </TabsContent>
                    <TabsContent value="upi" className="pt-4">
                      <div className="space-y-2">
                        <Label>UPI ID / Number *</Label>
                        <Input
                          value={editPaymentForm.vendorUpi}
                          onChange={(e) => setEditPaymentForm({ ...editPaymentForm, vendorUpi: e.target.value })}
                          placeholder="example@okaxis or mobile number"
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            )}

            {editPaymentDialog.payment?.is_transport_payment ? (
              <div className="mt-4 border-t pt-6">
                <TransportSubmissionForm
                  editData={editPaymentDialog.payment}
                  isResubmitting={true}
                  onSuccess={() => setEditPaymentDialog({ open: false, payment: null })}
                  onCancel={() => setEditPaymentDialog({ open: false, payment: null })}
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Required By (Date) *</Label>
                    <Input
                      type="date"
                      value={editPaymentForm.cutoffDate}
                      onChange={(e) => setEditPaymentForm({ ...editPaymentForm, cutoffDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Required By (Time) *</Label>
                    <Input
                      type="time"
                      value={editPaymentForm.cutoffTime}
                      onChange={(e) => setEditPaymentForm({ ...editPaymentForm, cutoffTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Bill / Invoice Folder</Label>
                    <Input
                      value={editPaymentForm.billUrl}
                      onChange={(e) => setEditPaymentForm({ ...editPaymentForm, billUrl: e.target.value })}
                      placeholder="Drive link"
                    />
                  </div>
                  <div>
                    <Label>Bank Proof Folder</Label>
                    <Input
                      value={editPaymentForm.workProofUrl}
                      onChange={(e) => setEditPaymentForm({ ...editPaymentForm, workProofUrl: e.target.value })}
                      placeholder="Drive link"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Categorization Tags</Label>
                  <PaymentTagSelector
                    value={editPaymentForm.tags}
                    onChange={(tags) => setEditPaymentForm({ ...editPaymentForm, tags })}
                  />
                </div>

                <div>
                  <Label>Urgency</Label>
                  <Select value={editPaymentForm.urgency} onValueChange={(value: any) => setEditPaymentForm({ ...editPaymentForm, urgency: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">🟢 Normal</SelectItem>
                      <SelectItem value="important">🟡 Important</SelectItem>
                      <SelectItem value="emergency">🔴 Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editPaymentDialog.payment && (editPaymentDialog.payment.admin_rejection_reason || editPaymentDialog.payment.ceo_hold_reason) && (
                  <div className={cn(
                    'p-3 rounded-lg border',
                    editPaymentDialog.payment.admin_rejection_reason
                      ? 'bg-status-missed/10 border-status-missed/30'
                      : 'bg-authority-ceo/10 border-authority-ceo/30'
                  )}>
                    <p className={cn(
                      'text-sm font-medium',
                      editPaymentDialog.payment.admin_rejection_reason ? 'text-status-missed' : 'text-authority-ceo'
                    )}>
                      {editPaymentDialog.payment.admin_rejection_reason ? 'Rejection Reason:' : 'Hold Reason:'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {editPaymentDialog.payment.admin_rejection_reason || editPaymentDialog.payment.ceo_hold_reason}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          {!editPaymentDialog.payment?.is_transport_payment && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditPaymentDialog({ open: false, payment: null })}>
                Cancel
              </Button>
              <Button onClick={handlePaymentResubmit} disabled={paymentSaving}>
                {paymentSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                Resubmit for Approval
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>



      {/* Payment Receipt Dialog */}
      {
        receiptDialog.payment && (
          <Suspense fallback={null}>
            <PaymentReceipt
              isOpen={receiptDialog.open}
              onClose={() => setReceiptDialog({ open: false, payment: null })}
              payment={{
                id: receiptDialog.payment.id,
                payment_number: receiptDialog.payment.payment_number,
                vendor_name: receiptDialog.payment.vendor_name,
                amount: Number(receiptDialog.payment.amount),
                purpose: receiptDialog.payment.purpose,
                created_at: receiptDialog.payment.created_at,
                paid_at: receiptDialog.payment.paid_at,
                utr_number: receiptDialog.payment.utr_number,
                requester_name: receiptDialog.payment.requester?.name || 'Anonymous',
                department: receiptDialog.payment.requester?.department || 'General',
                is_split_payment: receiptDialog.payment.is_split_payment,
                splits: receiptDialog.payment.splits
              }}
            />
          </Suspense>
        )
      }
    </motion.div >
  );
}
