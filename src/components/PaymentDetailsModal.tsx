import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  IndianRupee, Calendar, Clock, User, Building2, FileText, Eye,
  ExternalLink, MapPin, CreditCard, Briefcase, CheckCircle, XCircle, Image, History as HistoryIcon, PauseCircle, AlertTriangle, Maximize2, Loader2
} from 'lucide-react';
import { ProofPreviewGrid } from './payment/EmbeddedProofPreview';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { SplitPaymentBatchView } from './payments/SplitPaymentBatchView';
import { TransportTripsViewer } from './payments/TransportTripsViewer';
import { PaymentReceipt } from './payment/PaymentReceipt';

interface PaymentDetailsModalProps {
  payment: {
    id: string;
    purpose: string;
    amount: number;
    vendor_name: string;
    vendor_bank_details: string;
    vendor_account_number?: string | null;
    vendor_ifsc_code?: string | null;
    vendor_upi?: string | null;
    urgency: string;
    status: string;
    cutoff_date: string;
    cutoff_time: string;
    bill_url: string;
    work_proof_url: string;
    is_project_work: boolean;
    payment_type?: string | null;
    wo_number?: string | null;
    created_at: string;
    detailed_description?: string | null;
    department?: string | null;
    tags?: string[] | null;
    is_split_payment?: boolean;
    splits?: any[];
    is_transport_payment?: boolean | null;
    transport_trips?: any[] | null;
    requester?: {
      name: string;
      department: string;
    } | null;
    project?: {
      project_id: string;
      project_name: string;
      vertical?: string;
      client_name?: string;
      location_city?: string;
      location_state?: string;
      status?: string | null;
      lifecycle_stage?: string | null;
      current_phase_id?: string | null;
      current_phase?: {
        id: string;
        phase_name: string;
        phase_order: number;
        status?: string | null;
      } | null;
      default_phase?: {
        id: string;
        phase_name: string;
        phase_order: number;
        status?: string | null;
      } | null;
    } | null;
    phase?: {
      id: string;
      phase_name: string;
      phase_order: number;
      status?: string | null;
    } | null;
    work_order?: {
      id: string;
      wo_number: number;
      work_description: string;
      estimated_amount: number;
      signed_document_url?: string | null;
      boq_item?: {
        id: string;
        phase_id?: string | null;
        phase?: {
          id: string;
          phase_name: string;
          phase_order: number;
        } | null;
      } | null;
    } | null;
    // All approval tracking fields
    smo_approved_by?: string | null;
    smo_approved_at?: string | null;
    gmo_approved_by?: string | null;
    gmo_approved_at?: string | null;
    director_approved_by?: string | null;
    director_approved_at?: string | null;
    boi_approved_by?: string | null;
    boi_approved_at?: string | null;
    gm_approved_by?: string | null;
    gm_approved_at?: string | null;
    admin_approved_by?: string | null;
    admin_approved_at?: string | null;
    ceo_approved_by?: string | null;
    ceo_approved_at?: string | null;
    ceo_hold_reason?: string | null;
    admin_rejection_reason?: string | null;
    payment_proof_url?: string | null;
    payment_proof_screenshot?: string | null;
    utr_verified_at?: string | null;
    // Legacy fields for backward compatibility
    admin_approved_by_profile?: { name: string } | null;
    // Timeline for names
    audit_timeline?: Array<{
      status: string;
      user_id: string;
      user_name: string;
      role: string;
      notes?: string;
      timestamp: string;
    }>;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const urgencyConfig: Record<string, { bg: string; text: string; label: string }> = {
  emergency: { bg: 'bg-status-missed/20', text: 'text-status-missed', label: '🔴 Emergency' },
  important: { bg: 'bg-status-late/20', text: 'text-status-late', label: '🟡 Important' },
  normal: { bg: 'bg-status-live/20', text: 'text-status-live', label: '🟢 Normal' },
};

// Generate approval chain based on department
function getApprovalChain(payment: PaymentDetailsModalProps['payment']) {
  if (!payment) return [];

  const department = payment.requester?.department?.toLowerCase() || 'others';
  const timeline = payment.audit_timeline || [];

  // Detect starting point from timeline - admin/CEO initiated requests skip prior steps
  const firstTimelineEntry = timeline[0];
  const startedAtAdmin = firstTimelineEntry?.status?.toLowerCase().includes('admin') &&
    !payment.smo_approved_at && !payment.gmo_approved_at && !payment.boi_approved_at && !payment.gm_approved_at && !payment.director_approved_at;
  const startedAtCEO = firstTimelineEntry?.status?.toLowerCase().includes('ceo') &&
    !payment.admin_approved_at && !payment.smo_approved_at && !payment.gmo_approved_at && !payment.boi_approved_at;

  /**
   * Helper to find the approver for a specific role.
   * 
   * The timeline entry that represents an approval is when:
   * - The user's role matches the role we're looking for, AND
   * - The status AFTER their action (the new status they approved TO) is the next step
   * 
   * For example: SMO approves → status becomes 'gmo_audit'
   * So we look for entry where role='smo' and status='gmo_audit' (the resulting status)
   */
  const findApproverForRole = (role: string): { name: string; timestamp: string } | null => {
    const roleToNextStatusMap: Record<string, string[]> = {
      'smo': ['gmo_audit', 'boi_audit'],
      'gmo': ['boi_audit'],
      'boi': ['gm_audit', 'director_audit', 'admin_audit'],
      'director': ['admin_audit'],
      'gm': ['admin_audit'],
      'admin': ['ceo_audit', 'ceo_approved'],
      'ceo': ['ceo_approved', 'paid'],
    };

    const expectedStatuses = roleToNextStatusMap[role.toLowerCase()] || [];

    const entry = timeline.find(t => {
      const entryRole = t.role?.toLowerCase() || '';
      const entryStatus = t.status?.toLowerCase() || '';
      return entryRole === role.toLowerCase() && expectedStatuses.some(s => entryStatus === s);
    });

    if (entry) {
      return { name: entry.user_name, timestamp: entry.timestamp };
    }

    // Fallback: If this role INITIATED the request, they effectively approved it by creating it
    if (timeline.length > 0) {
      const firstEntry = timeline[0];
      const firstEntryRole = firstEntry.role?.toLowerCase() || '';

      // Direct role match (e.g., role='smo' in timeline)
      if (firstEntryRole === role.toLowerCase()) {
        return { name: firstEntry.user_name, timestamp: firstEntry.timestamp };
      }

      // Requester role match: When role='requester' but the initial status
      // skips this step (e.g., SMO raised → status='gmo_audit', meaning SMO step is implicitly done)
      if (firstEntryRole === 'requester') {
        const firstStatus = firstEntry.status?.toLowerCase() || '';
        // If the initial status is one of the NEXT statuses for this role,
        // it means this role raised the request and their step was auto-verified
        if (expectedStatuses.some(s => firstStatus === s)) {
          return { name: firstEntry.user_name, timestamp: firstEntry.timestamp };
        }
      }
    }

    return null;
  };

  // Define steps based on department
  const paymentStatus = payment.status?.toLowerCase() || '';
  const isGMHold = paymentStatus === 'gm_hold';
  const isCEOHold = paymentStatus === 'ceo_hold';
  const holdReason = payment.ceo_hold_reason || null;

  let steps: Array<{
    role: string;
    label: string;
    approvedAt: string | null;
    approverName: string | null;
    skipped?: boolean;
    isHold?: boolean;
    holdReason?: string | null;
  }> = [];

  // CEO-initiated requests: only show CEO and Accounts
  if (startedAtCEO) {
    const ceoInfo = findApproverForRole('ceo');
    steps = [
      { role: 'ceo', label: 'CEO Approval', approvedAt: payment.ceo_approved_at || ceoInfo?.timestamp || null, approverName: ceoInfo?.name || null },
    ];
  }
  // Admin-initiated requests: skip all prior steps, start from Admin
  else if (startedAtAdmin) {
    const adminInfo = findApproverForRole('admin');
    const ceoInfo = findApproverForRole('ceo');
    steps = [
      { role: 'admin', label: 'Admin Approval', approvedAt: payment.admin_approved_at || adminInfo?.timestamp || null, approverName: adminInfo?.name || payment.admin_approved_by_profile?.name || null },
      { role: 'ceo', label: 'CEO Approval', approvedAt: payment.ceo_approved_at || ceoInfo?.timestamp || null, approverName: ceoInfo?.name || null },
    ];
  }
  else if (department === 'engineering') {
    const smoInfo = findApproverForRole('smo');
    const gmoInfo = findApproverForRole('gmo');
    const boiInfo = findApproverForRole('boi');
    const gmInfo = findApproverForRole('gm');
    const adminInfo = findApproverForRole('admin');
    const ceoInfo = findApproverForRole('ceo');
    steps = [
      { role: 'smo', label: 'SMO Audit', approvedAt: payment.smo_approved_at || smoInfo?.timestamp || null, approverName: smoInfo?.name || null },
      { role: 'gmo', label: 'GMO Audit', approvedAt: payment.gmo_approved_at || gmoInfo?.timestamp || null, approverName: gmoInfo?.name || null },
      { role: 'boi', label: 'BOI Audit', approvedAt: payment.boi_approved_at || boiInfo?.timestamp || null, approverName: boiInfo?.name || null },
      { role: 'gm', label: 'GM Approval', approvedAt: payment.gm_approved_at || gmInfo?.timestamp || null, approverName: gmInfo?.name || null, isHold: isGMHold, holdReason: isGMHold ? holdReason : null },
      { role: 'admin', label: 'Admin Verification', approvedAt: payment.admin_approved_at || adminInfo?.timestamp || null, approverName: adminInfo?.name || payment.admin_approved_by_profile?.name || null },
      { role: 'ceo', label: 'CEO Approval', approvedAt: payment.ceo_approved_at || ceoInfo?.timestamp || null, approverName: ceoInfo?.name || null, isHold: isCEOHold, holdReason: isCEOHold ? holdReason : null },
    ];
  } else if (department?.includes('agri') || department?.includes('farm')) {
    const smoInfo = findApproverForRole('smo');
    const boiInfo = findApproverForRole('boi');
    const directorInfo = findApproverForRole('director');
    const adminInfo = findApproverForRole('admin');
    const ceoInfo = findApproverForRole('ceo');
    steps = [
      { role: 'smo', label: 'SMO Audit', approvedAt: payment.smo_approved_at || smoInfo?.timestamp || null, approverName: smoInfo?.name || null },
      { role: 'boi', label: 'BOI Audit', approvedAt: payment.boi_approved_at || boiInfo?.timestamp || null, approverName: boiInfo?.name || null },
      { role: 'director', label: 'Director Approval', approvedAt: payment.director_approved_at || directorInfo?.timestamp || null, approverName: directorInfo?.name || null },
      { role: 'admin', label: 'Admin Verification', approvedAt: payment.admin_approved_at || adminInfo?.timestamp || null, approverName: adminInfo?.name || payment.admin_approved_by_profile?.name || null },
      { role: 'ceo', label: 'CEO Approval', approvedAt: payment.ceo_approved_at || ceoInfo?.timestamp || null, approverName: ceoInfo?.name || null, isHold: isCEOHold, holdReason: isCEOHold ? holdReason : null },
    ];
  } else if (department?.includes('purchase') || department?.includes('r&d') || department === 'rnd') {
    // Purchase & R&D Flow: GM -> Admin -> CEO
    const gmInfo = findApproverForRole('gm');
    const adminInfo = findApproverForRole('admin');
    const ceoInfo = findApproverForRole('ceo');
    steps = [
      { role: 'gm', label: 'GM Audit', approvedAt: payment.gm_approved_at || gmInfo?.timestamp || null, approverName: gmInfo?.name || null, isHold: isGMHold, holdReason: isGMHold ? holdReason : null },
      { role: 'admin', label: 'Admin Verification', approvedAt: payment.admin_approved_at || adminInfo?.timestamp || null, approverName: adminInfo?.name || payment.admin_approved_by_profile?.name || null },
      { role: 'ceo', label: 'CEO Approval', approvedAt: payment.ceo_approved_at || ceoInfo?.timestamp || null, approverName: ceoInfo?.name || null, isHold: isCEOHold, holdReason: isCEOHold ? holdReason : null },
    ];
  } else {
    // Others department flow
    const boiInfo = findApproverForRole('boi');
    const adminInfo = findApproverForRole('admin');
    const ceoInfo = findApproverForRole('ceo');
    steps = [
      { role: 'boi', label: 'BOI Audit', approvedAt: payment.boi_approved_at || boiInfo?.timestamp || null, approverName: boiInfo?.name || null },
      { role: 'admin', label: 'Admin Verification', approvedAt: payment.admin_approved_at || adminInfo?.timestamp || null, approverName: adminInfo?.name || payment.admin_approved_by_profile?.name || null },
      { role: 'ceo', label: 'CEO Approval', approvedAt: payment.ceo_approved_at || ceoInfo?.timestamp || null, approverName: ceoInfo?.name || null, isHold: isCEOHold, holdReason: isCEOHold ? holdReason : null },
    ];
  }

  return steps;
}

export function PaymentDetailsModal({ payment, open, onOpenChange }: PaymentDetailsModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showVoucher, setShowVoucher] = useState(false);

  if (!payment) return null;

  const urgencyStyle = urgencyConfig[payment.urgency] || urgencyConfig.normal;
  const approvalChain = getApprovalChain(payment);
  const phaseInfo =
    payment.phase ||
    payment.work_order?.boq_item?.phase ||
    payment.project?.current_phase ||
    payment.project?.default_phase ||
    null;
  const signedWoUrl = payment.work_order?.signed_document_url || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-xl">Payment Details</span>
            <Badge className={cn(urgencyStyle.bg, urgencyStyle.text, 'border-0')}>
              {urgencyStyle.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Amount & Purpose */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground mb-1">Amount</p>
            <p className="text-3xl font-bold flex items-center">
              <IndianRupee className="w-7 h-7" />
              {Number(payment.amount).toLocaleString('en-IN')}
            </p>
            <p className="text-lg font-medium mt-2">{payment.purpose}</p>
            {payment.detailed_description && (
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap leading-relaxed border-t border-border/30 pt-2">
                {payment.detailed_description}
              </p>
            )}
          </div>

          {/* Requester Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <User className="w-4 h-4" /> Requested By
              </div>
              <p className="font-semibold">{payment.requester?.name || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">{payment.requester?.department}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calendar className="w-4 h-4" /> Requested On
              </div>
              <p className="font-semibold">{format(new Date(payment.created_at), 'dd MMM yyyy')}</p>
              <p className="text-sm text-muted-foreground">{format(new Date(payment.created_at), 'hh:mm a')}</p>
            </div>
          </div>

          {/* Cut-off Time */}
          <div className="p-3 rounded-lg bg-status-late/10 border border-status-late/30">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="w-4 h-4" /> Payment Cut-off
            </div>
            <p className="font-semibold font-mono">
              {format(new Date(`${payment.cutoff_date}T${payment.cutoff_time}`), 'dd MMM yyyy, hh:mm a')}
            </p>
          </div>

          <Separator />

          {/* Project Details */}
          {payment.is_project_work && payment.project && (
            <>
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" /> Project Details
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">Project ID</p>
                    <p className="font-semibold">{payment.project.project_id}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">Project Name</p>
                    <p className="font-semibold">{payment.project.project_name}</p>
                  </div>
                  {payment.project.vertical && (
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Vertical</p>
                      <p className="font-semibold capitalize">{payment.project.vertical}</p>
                    </div>
                  )}
                  {payment.project.client_name && (
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Client</p>
                      <p className="font-semibold">{payment.project.client_name}</p>
                    </div>
                  )}
                  {(payment.project.location_city || payment.project.location_state) && (
                    <div className="p-3 rounded-lg bg-muted/30 col-span-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" /> Location
                      </div>
                      <p className="font-semibold">
                        {[payment.project.location_city, payment.project.location_state].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                  <div className="p-3 rounded-lg bg-muted/30 col-span-2">
                    <p className="text-xs text-muted-foreground">Phase / Stage</p>
                    <p className="font-semibold">
                      {phaseInfo?.phase_name
                        ? `${phaseInfo.phase_name}${(phaseInfo as any).status ? ` (${(phaseInfo as any).status.replace(/_/g, ' ')})` : ''}`
                        : (payment.project as any)?.lifecycle_stage || (payment.project as any)?.status || 'N/A'}
                    </p>
                  </div>
                </div>
                {signedWoUrl && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      className="border-emerald-500/60 text-emerald-600 hover:bg-emerald-500/15 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                      onClick={() => window.open(signedWoUrl, '_blank')}
                    >
                      <FileText className="w-4 h-4 mr-2" /> SIGNED WORK ORDER
                    </Button>
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Payment Type & WO */}
          {(payment.payment_type || payment.wo_number) && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {payment.payment_type && (
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">Payment Type</p>
                    <p className="font-semibold capitalize">{payment.payment_type.replace('_', ' ')}</p>
                  </div>
                )}
                {payment.wo_number && (
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">Work Order #</p>
                    <p className="font-semibold">{payment.wo_number}</p>
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Payee Details */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Payee Details
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/30 col-span-2">
                <p className="text-xs text-muted-foreground">Payee Name</p>
                <p className="font-semibold">{payment.vendor_name}</p>
              </div>
              {payment.vendor_account_number && (
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">Account Number</p>
                  <p className="font-semibold font-mono">{payment.vendor_account_number}</p>
                </div>
              )}
              {payment.vendor_ifsc_code && (
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">IFSC Code</p>
                  <p className="font-semibold font-mono">{payment.vendor_ifsc_code}</p>
                </div>
              )}
              {payment.vendor_upi && (
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">UPI ID</p>
                  <p className="font-semibold">{payment.vendor_upi}</p>
                </div>
              )}
              <div className="p-3 rounded-lg bg-muted/30 col-span-2">
                <p className="text-xs text-muted-foreground">Bank Details</p>
                <p className="font-semibold text-sm">{payment.vendor_bank_details}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* NEW: Split Payment Batch View */}
          {payment.is_split_payment && (
            <div className="mt-2 mb-4">
              <SplitPaymentBatchView
                paymentId={payment.id}
                totalAmount={payment.amount}
                splits={payment.splits || []}
              />
              <Separator className="mt-6" />
            </div>
          )}

          {/* NEW: Transport Trips Viewer */}
          {payment.is_transport_payment && payment.transport_trips && payment.transport_trips.length > 0 && (
            <div className="mt-2 mb-4">
              <TransportTripsViewer trips={payment.transport_trips} />
              <Separator className="mt-6" />
            </div>
          )}

          {/* Complete Approval Chain */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Approval Chain
            </h4>
            <div className="space-y-2">
              {approvalChain.map((step, index) => {
                const isApproved = !!step.approvedAt;
                const isOnHold = !!(step as any).isHold;
                const stepHoldReason = (step as any).holdReason;
                const isCurrentStep = !isApproved && !isOnHold &&
                  (index === 0 || approvalChain[index - 1]?.approvedAt);

                return (
                  <div key={step.role}>
                    <div
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg transition-all",
                        isApproved && "bg-status-live/10 border border-status-live/30",
                        isOnHold && "bg-orange-500/10 border border-orange-500/30 ring-1 ring-orange-500/20",
                        isCurrentStep && "bg-primary/10 border border-primary/30 ring-1 ring-primary/20",
                        !isApproved && !isCurrentStep && !isOnHold && "bg-muted/20 border border-border opacity-50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {isApproved ? (
                          <CheckCircle className="w-5 h-5 text-status-live" />
                        ) : isOnHold ? (
                          <PauseCircle className="w-5 h-5 text-orange-500 animate-pulse" />
                        ) : isCurrentStep ? (
                          <Clock className="w-5 h-5 text-primary animate-pulse" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                        )}
                        <div>
                          <p className={cn(
                            "font-medium",
                            isApproved && "text-status-live",
                            isOnHold && "text-orange-500",
                            isCurrentStep && "text-primary"
                          )}>
                            {step.label}
                          </p>
                          {isApproved && step.approverName && (
                            <p className="text-xs text-muted-foreground">
                              By {step.approverName}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {isApproved && step.approvedAt && (
                          <p className="text-sm font-mono text-status-live">
                            {format(new Date(step.approvedAt), 'dd MMM yyyy, hh:mm a')}
                          </p>
                        )}
                        {isOnHold && (
                          <Badge variant="outline" className="text-xs border-orange-500 text-orange-500 bg-orange-500/10">
                            ON HOLD
                          </Badge>
                        )}
                        {isCurrentStep && (
                          <Badge variant="outline" className="text-xs border-primary text-primary">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                    {isOnHold && stepHoldReason && (
                      <div className="mt-1 ml-8 p-2 rounded-md bg-orange-500/5 border border-orange-500/20">
                        <p className="text-xs text-orange-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span className="font-semibold">Hold Reason:</span> {stepHoldReason}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Documents */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Evidence & Proofs
            </h4>
            <div className="space-y-4">
              {/* Proof Folder / Invoices */}
              <div className="p-4 rounded-xl border border-border bg-muted/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">Proof Folder (Invoices & Photos)</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => window.open(payment.bill_url?.split(',')[0]?.trim(), '_blank')}>
                    <ExternalLink className="w-3 h-3 mr-1" /> Open
                  </Button>
                </div>
                {payment.bill_url && (
                  <ProofPreviewGrid
                    proofs={payment.bill_url}
                    onExpand={(u, t) => { setPreviewUrl(u); setPreviewTitle(t); setShowPreview(true); }}
                  />
                )}
              </div>

              {/* Bank Proof / Account Confirmation */}
              {payment.work_proof_url && (
                <div className="p-4 rounded-xl border border-border bg-muted/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <HistoryIcon className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">Bank Proof (Account Confirmation)</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => window.open(payment.work_proof_url, '_blank')}>
                      <ExternalLink className="w-3 h-3 mr-1" /> Open
                    </Button>
                  </div>
                  <ProofPreviewGrid
                    proofs={payment.work_proof_url}
                    onExpand={(u, t) => { setPreviewUrl(u); setPreviewTitle(t); setShowPreview(true); }}
                  />
                </div>
              )}

              {/* Transaction Proof */}
              {(payment.payment_proof_url || payment.payment_proof_screenshot) && (
                <div className="p-4 rounded-xl border border-status-live/30 bg-status-live/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-status-live" />
                      <span className="text-sm font-semibold text-status-live">Transaction Proof</span>
                    </div>
                    {payment.utr_verified_at && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-status-live hover:text-status-live hover:bg-status-live/10" onClick={() => window.open(payment.payment_proof_url || payment.payment_proof_screenshot || '', '_blank')}>
                        <ExternalLink className="w-3 h-3 mr-1" /> Open
                      </Button>
                    )}
                  </div>
                  {payment.utr_verified_at ? (
                    <ProofPreviewGrid
                      proofs={payment.payment_proof_url || payment.payment_proof_screenshot || ''}
                      onExpand={(u, t) => { setPreviewUrl(u); setPreviewTitle(t); setShowPreview(true); }}
                    />
                  ) : (
                    <div className="text-center p-4">
                      <p className="text-xs text-muted-foreground italic">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Transaction proof confirmation pending by Accounts.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Official Voucher Button */}
          {payment.status === 'paid' && (
            <div className="pt-4 border-t border-border/30">
              <Button
                variant="outline"
                className="w-full h-14 text-base font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.97] uppercase tracking-tighter"
                onClick={() => setShowVoucher(true)}
              >
                <CheckCircle className="w-5 h-5 mr-3" /> View Official Payment Voucher
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Payment Receipt / Voucher Modal */}
      {showVoucher && (
        <PaymentReceipt
          isOpen={showVoucher}
          onClose={() => setShowVoucher(false)}
          payment={{
            id: payment.id,
            payment_number: (payment as any).payment_number || 0,
            vendor_name: payment.vendor_name,
            amount: payment.amount,
            purpose: payment.purpose,
            created_at: payment.created_at,
            paid_at: (payment as any).paid_at || payment.created_at,
            utr_number: (payment as any).utr_number,
            requester_name: payment.requester?.name || 'Unknown',
            department: payment.requester?.department || 'Others',
            is_split_payment: payment.is_split_payment,
            splits: payment.splits,
            bank_name: payment.vendor_bank_details || (payment.transport_trips?.[0] as any)?.bank_name,
            account_number: payment.vendor_account_number || (payment.transport_trips?.[0] as any)?.payee_account,
            ifsc_code: payment.vendor_ifsc_code || (payment.transport_trips?.[0] as any)?.payee_ifsc,
          }}
        />
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        url={previewUrl}
        title={previewTitle}
        open={showPreview}
        onOpenChange={setShowPreview}
      />
    </Dialog>
  );
}
