import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  ExternalLink,
  IndianRupee,
  User,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  History as HistoryIcon,
  MessageSquare,
  Send,
  MapPin,
  Briefcase,
  Eye,
  Timer,
  Zap,
  Banknote,
  Trash2,
  Shield
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { differenceInHours, differenceInMinutes, format } from 'date-fns';
import { safeFormat } from '@/lib/dateUtils';
import { getPaymentTimelineSteps } from '@/lib/paymentWorkflow';
import { cn } from '@/lib/utils';
import { generateVoucher } from '@/lib/exportUtils';
import { GoogleDriveEmbed } from '@/components/GoogleDriveEmbed';
import { PaymentRequestData, PaymentTimelineEntry } from '@/hooks/usePaymentRequests';
import { PaymentTagBadges } from './PaymentTagBadges';
import { IndividualPaymentReminder } from './IndividualPaymentReminder';
import { supabase } from '@/integrations/supabase/client';
import { DuplicateMatch } from '@/hooks/useDuplicateCheck';
import { ProofPreviewGrid } from './EmbeddedProofPreview';
import { DocumentPreviewModal } from '../DocumentPreviewModal';
import { WOPastTransactions } from '@/components/payment/WOPastTransactions';
import { SplitPaymentBatchView } from '../payments/SplitPaymentBatchView';
import { TransportTripsViewer } from '../payments/TransportTripsViewer';
import { WOAuditProofWidget } from './WOAuditProofWidget';

interface PaymentAuditCardProps {
  request: PaymentRequestData;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onApprove: (note: string, isPettyCash: boolean) => void;
  onReject: (note: string) => void;
  onHold?: (note: string) => void;
  isSaving: boolean;
  showPettyCashOption?: boolean;
  showHoldOption?: boolean;
  roleLabel?: string;
  onDelete?: () => void;
}

// Payment Approval Chain Component
function PaymentApprovalChain({ request }: { request: PaymentRequestData }) {
  const department = request.requester?.department?.toLowerCase() || 'others';

  // Define approval steps based on department
  const getApprovalSteps = () => {
    const timeline = request.audit_timeline || [];

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
      // Define which status indicates approval by this role
      // When SMO approves, status becomes gmo_audit or boi_audit
      // When GMO approves, status becomes boi_audit
      // etc.

      const roleToNextStatusMap: Record<string, string[]> = {
        'smo': ['gmo_audit', 'boi_audit'], // SMO can forward to GMO (eng) or BOI (agri)
        'gmo': ['boi_audit'],
        'boi': ['gm_audit', 'director_audit', 'admin_audit'], // BOI can forward to GM (eng), Director (agri), or Admin (others)
        'director': ['admin_audit'],
        'gm': ['admin_audit'],
        'admin': ['ceo_audit', 'ceo_approved'], // Admin forwards to CEO or marks as petty cash
        'ceo': ['ceo_approved', 'paid'],
      };

      const expectedStatuses = roleToNextStatusMap[role.toLowerCase()] || [];

      // Find timeline entry where role matches AND status is one of the expected next statuses
      const entry = timeline.find(t => {
        const entryRole = t.role?.toLowerCase() || '';
        const entryStatus = t.status?.toLowerCase() || '';
        return entryRole === role.toLowerCase() && expectedStatuses.some(s => entryStatus === s);
      });

      if (entry) {
        return { name: entry.user_name, timestamp: entry.timestamp };
      }

      return null;
    };

    let steps: Array<{
      role: string;
      label: string;
      status: 'approved' | 'current' | 'pending' | 'skipped';
      approvedBy?: string;
      approvedAt?: string;
    }> = [];

    if (department === 'engineering') {
      steps = [
        { role: 'smo', label: 'SMO', status: 'pending' },
        { role: 'gmo', label: 'GMO', status: 'pending' },
        { role: 'boi', label: 'BOI', status: 'pending' },
        { role: 'gm', label: 'GM', status: 'pending' },
        { role: 'admin', label: 'Admin', status: 'pending' },
        { role: 'ceo', label: 'CEO', status: 'pending' },
      ];
    } else if (department === 'agri_mart') {
      steps = [
        { role: 'director', label: 'Director', status: 'pending' },
        { role: 'admin', label: 'Admin', status: 'pending' },
        { role: 'ceo', label: 'CEO', status: 'pending' },
      ];
    } else if (department === 'agri') {
      steps = [
        { role: 'smo', label: 'SMO', status: 'pending' },
        { role: 'boi', label: 'BOI', status: 'pending' },
        { role: 'director', label: 'Director', status: 'pending' },
        { role: 'admin', label: 'Admin', status: 'pending' },
        { role: 'ceo', label: 'CEO', status: 'pending' },
      ];
    } else if (department.includes('r&d') || department === 'rnd' || department === 'r_and_d') {
      steps = [
        { role: 'gm', label: 'GM', status: 'pending' },
        { role: 'admin', label: 'Admin', status: 'pending' },
        { role: 'ceo', label: 'CEO', status: 'pending' },
      ];
    } else {
      steps = [
        { role: 'admin', label: 'Admin', status: 'pending' },
        { role: 'ceo', label: 'CEO', status: 'pending' },
      ];
    }

    // Use database timestamps as source of truth, then find approver name
    const currentStatus = request.status?.toLowerCase() || '';
    let foundCurrent = false;

    steps = steps.map((step) => {
      // Check database approval timestamps
      const approvalTimestampField = `${step.role}_approved_at` as keyof typeof request;
      const approvedAt = (request as any)[approvalTimestampField];

      if (approvedAt) {
        // Find who approved from timeline
        const approverInfo = findApproverForRole(step.role);

        return {
          ...step,
          status: 'approved' as const,
          approvedBy: approverInfo?.name || 'System',
          approvedAt: approverInfo?.timestamp || approvedAt,
        };
      }

      // Check if current status matches this step
      if (!foundCurrent && currentStatus.includes(step.role)) {
        foundCurrent = true;
        return { ...step, status: 'current' as const };
      }

      return step;
    });

    // Find the first pending step and mark as current if no current was found
    if (!foundCurrent) {
      const firstPendingIdx = steps.findIndex(s => s.status === 'pending');
      if (firstPendingIdx >= 0) {
        steps[firstPendingIdx].status = 'current';
      }
    }

    return steps;
  };

  const steps = getApprovalSteps();

  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const isApproved = step.status === 'approved';
        const isCurrent = step.status === 'current';

        return (
          <div
            key={step.role}
            className={cn(
              "flex items-center justify-between p-2 rounded-lg text-xs transition-all",
              isApproved && "bg-status-live/10 border border-status-live/30",
              isCurrent && "bg-primary/10 border border-primary/30 ring-1 ring-primary/20",
              !isApproved && !isCurrent && "bg-muted/30 border border-border opacity-60"
            )}
          >
            <div className="flex items-center gap-2">
              {isApproved ? (
                <CheckCircle2 className="w-4 h-4 text-status-live" />
              ) : isCurrent ? (
                <Clock className="w-4 h-4 text-primary animate-pulse" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
              )}
              <span className={cn(
                "font-semibold",
                isApproved && "text-status-live",
                isCurrent && "text-primary"
              )}>
                {step.label}
              </span>
              {isApproved && step.approvedBy && (
                <span className="text-muted-foreground">
                  by {step.approvedBy}
                </span>
              )}
            </div>
            <div className="text-right">
              {isApproved && step.approvedAt && (
                <span className="text-status-live font-mono">
                  {safeFormat(step.approvedAt, 'dd MMM, hh:mm a')}
                </span>
              )}
              {isCurrent && (
                <Badge variant="outline" className="text-[10px] border-primary text-primary">
                  Pending
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const urgencyConfig: Record<string, { bg: string; text: string; border: string; label: string; icon: React.ElementType }> = {
  emergency: {
    bg: 'bg-status-missed/10',
    text: 'text-status-missed',
    border: 'border-status-missed/30',
    label: 'Emergency',
    icon: Zap
  },
  important: {
    bg: 'bg-status-late/10',
    text: 'text-status-late',
    border: 'border-status-late/30',
    label: 'Important',
    icon: AlertTriangle
  },
  normal: {
    bg: 'bg-status-live/10',
    text: 'text-status-live',
    border: 'border-status-live/30',
    label: 'Normal',
    icon: CheckCircle2
  },
};

export function PaymentAuditCard({
  request,
  isExpanded,
  onToggleExpand,
  onApprove,
  onReject,
  onHold,
  isSaving,
  showPettyCashOption = false,
  showHoldOption = false,
  roleLabel,
  onDelete
}: PaymentAuditCardProps) {
  const [note, setNote] = useState('');
  const [isPettyCash, setIsPettyCash] = useState(false);

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Payment Guardian: live duplicate check on expand
  const [guardianMatches, setGuardianMatches] = useState<DuplicateMatch[]>([]);
  const [guardianConfidence, setGuardianConfidence] = useState(0);
  const [guardianRecommendation, setGuardianRecommendation] = useState<'allow' | 'warn' | 'flag'>('allow');
  const [guardianChecked, setGuardianChecked] = useState(false);
  const [guardianLoading, setGuardianLoading] = useState(false);
  const [guardianExpanded, setGuardianExpanded] = useState(false);

  useEffect(() => {
    if (!isExpanded || guardianChecked || !request.vendor_name || !request.amount) return;
    let cancelled = false;
    const runCheck = async () => {
      setGuardianLoading(true);
      try {
        const { data } = await supabase.functions.invoke('duplicate-payment-detector', {
          body: {
            vendor_name: request.vendor_name,
            amount: request.amount,
            account_number: request.vendor_account_number,
            ifsc: request.vendor_ifsc_code,
            upi: request.vendor_upi,
            bill_url: request.bill_url,
            requester_id: request.requester_id,
            exclude_id: request.id, // exclude self
          },
        });
        if (!cancelled && data) {
          setGuardianMatches(data.matches || []);
          setGuardianConfidence(data.confidence || 0);
          setGuardianRecommendation(data.recommendation || 'allow');
          setGuardianChecked(true);
        }
      } catch {
        // fail silently — guardian is advisory only
      } finally {
        if (!cancelled) setGuardianLoading(false);
      }
    };
    runCheck();
    return () => { cancelled = true; };
  }, [isExpanded, guardianChecked, request.id, request.vendor_name, request.amount,
    request.vendor_account_number, request.vendor_ifsc_code, request.vendor_upi,
    request.bill_url, request.requester_id]);

  const urgencyStyle = urgencyConfig[request.urgency] || urgencyConfig.normal;
  const UrgencyIcon = urgencyStyle.icon;
  const projectInfo = request.project || null;
  const phaseInfo =
    request.phase ||
    request.work_order?.boq_item?.phase ||
    request.project?.current_phase ||
    request.project?.default_phase ||
    null;
  const signedWoUrl = request.work_order?.signed_document_url || null;

  // Calculate time metrics
  const now = new Date();
  const createdAt = new Date(request.created_at);
  const cutoffTime = new Date(`${request.cutoff_date}T${request.cutoff_time}`);
  const hoursUntilCutoff = differenceInHours(cutoffTime, now);
  const hoursPending = differenceInHours(now, createdAt);
  const isOverdue = hoursUntilCutoff <= 0;
  const isUrgentCutoff = hoursUntilCutoff > 0 && hoursUntilCutoff <= 12;

  const handleApprove = () => {
    onApprove(note, isPettyCash);
    setNote('');
    setIsPettyCash(false);
  };

  const handleReject = () => {
    onReject(note);
    setNote('');
  };

  const handleHold = () => {
    if (onHold) {
      onHold(note);
      setNote('');
    }
  };

  // Dynamically build display fields for older Transport payments that lack the detailed description
  let displayPurpose = request.purpose;
  let displayDetailedDescription = request.detailed_description;

  if (request.is_transport_payment && request.transport_trips && request.transport_trips.length > 0 && (!request.detailed_description || request.detailed_description === request.purpose)) {
    const trips = request.transport_trips;

    const categoryNames = trips.map((t: any) => {
      let name = t.category_code || t.category || 'Unknown';
      const match = t.purpose?.match(/\[OTHER_CAT:\s*(.*?)\]/);
      if (match) name = match[1].toUpperCase();
      return name.toUpperCase();
    });
    const uniqueCategories = [...new Set(categoryNames)].join(', ');

    const dates = trips.map((t: any) => t.trip_date).filter(Boolean);
    const uniqueDatesStr = dates.length > 0
      ? [...new Set(dates.map((d: any) => safeFormat(d, 'dd MMM yy')))].join(', ')
      : 'Unknown Date';

    displayPurpose = `Transport Payment - ${uniqueDatesStr} - ${uniqueCategories}`;

    const lines = trips.map((t: any, idx: number) => {
      const catName = categoryNames[idx];
      const dist = typeof t.distance_km === 'number' ? t.distance_km : parseFloat(t.distance_km || '0');
      const rate = typeof t.rate_per_km === 'number' ? t.rate_per_km : parseFloat(t.rate_per_km || '0');
      const calcAmt = Math.round(dist * rate * 100) / 100;
      const cleanPurpose = t.purpose ? t.purpose.replace(/\[OTHER_CAT:.*?\]/, '').trim() : 'N/A';

      return `#${idx + 1} ${catName}
Date: ${t.trip_date ? safeFormat(t.trip_date, 'dd MMM yyyy') : 'N/A'}
Route: ${t.from_location || 'N/A'} -> ${t.to_location || 'N/A'}
Distance: ${dist} KM | Rate: ₹${rate}/KM | Total: ₹${calcAmt}
Driver: ${t.driver_name || 'N/A'}
Vehicle: ${t.vehicle_number || t.vehicle_name || 'N/A'}
Purpose: ${cleanPurpose || 'N/A'}`;
    });
    displayDetailedDescription = lines.join('\n\n---\n\n');
  }

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-200",
        isExpanded ? "border-primary/40 shadow-lg" : "hover:border-primary/20",
        request.urgency === 'emergency' && "border-status-missed/40",
        request.urgency === 'important' && "border-status-late/40"
      )}
    >
      {/* Header - Always Visible */}
      <div
        className={cn(
          "p-2 sm:p-2.5 cursor-pointer transition-colors",
          isExpanded && "bg-muted/30"
        )}
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: Main Info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Urgency Indicator */}
            <div className={cn(
              "w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0",
              urgencyStyle.bg
            )}>
              <UrgencyIcon className={cn("w-4 h-4 sm:w-5 sm:h-5", urgencyStyle.text)} />
            </div>

            <div className="flex-1 min-w-0">
              {/* Top Row: ID + Department + Urgency */}
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                <span className="font-mono text-xs text-primary font-bold">
                  PAY-{request.payment_number || request.id.slice(0, 8).toUpperCase()}
                </span>
                <Badge variant="secondary" className="text-[10px] uppercase h-5 font-bold">
                  {(request.department || request.requester?.department || 'Others').toLowerCase() === 'others'
                    ? `Others (${request.requester?.department || 'General'})`
                    : (request.requester?.department || request.department || 'Others')}
                </Badge>
                <Badge className={cn("text-[10px] h-5", urgencyStyle.bg, urgencyStyle.text, "border-0")}>
                  {urgencyStyle.label}
                </Badge>
                {request.status === 'gm_hold' && (
                  <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/10 text-amber-600 border-amber-500/20">
                    <Clock className="w-3 h-3 mr-1" /> GM HOLD
                  </Badge>
                )}
                {/* Payment Tags */}
                {(request as any).tags && (request as any).tags.length > 0 && (
                  <PaymentTagBadges tags={(request as any).tags} size="sm" maxDisplay={2} />
                )}
              </div>

              {/* Purpose / Description - Primary Title */}
              <h3 className="font-semibold text-sm sm:text-base leading-tight">
                {displayPurpose}
              </h3>

              {/* Meta Row: Requester • Vendor • Time */}
              <div className="flex flex-wrap items-center gap-2.5 mt-1 text-[10px] sm:text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {request.requester?.name || 'Unknown'}
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {request.vendor_name}
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {hoursPending}h ago
                </span>
              </div>
            </div>
          </div>

          {/* Right: Amount + Cutoff + Expand */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-lg sm:text-xl font-bold flex items-center justify-end">
                <IndianRupee className="w-4 h-4" />
                {Number(request.amount).toLocaleString('en-IN')}
              </p>
              <div className={cn(
                "flex items-center gap-1 text-xs justify-end mt-1",
                isOverdue ? "text-status-missed font-bold" : isUrgentCutoff ? "text-status-late" : "text-muted-foreground"
              )}>
                <Timer className="w-3 h-3" />
                {isOverdue ? 'OVERDUE' : `${hoursUntilCutoff}h to cutoff`}
              </div>
            </div>

            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
              isExpanded ? "bg-primary/10" : "bg-muted/50"
            )}>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="px-2 pb-2 pt-0 border-t border-dashed space-y-2">
              {/* Quick Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2">
                <div className={cn("p-2 rounded-lg", urgencyStyle.bg, urgencyStyle.border, "border")}>
                  <p className="text-[9px] uppercase text-muted-foreground mb-0.5">Amount</p>
                  <p className="font-bold text-base flex items-center">
                    <IndianRupee className="w-3.5 h-3.5" />
                    {Number(request.amount).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50 border border-border">
                  <p className="text-[9px] uppercase text-muted-foreground mb-0.5">Due Date</p>
                  <p className="font-bold font-mono text-xs">
                    {safeFormat(request.cutoff_date, 'dd MMM')}
                  </p>
                  <p className="text-[9px] text-muted-foreground">{request.cutoff_time}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50 border border-border">
                  <p className="text-[9px] uppercase text-muted-foreground mb-0.5">Submitted</p>
                  <p className="font-bold font-mono text-xs">
                    {format(createdAt, 'dd MMM')}
                  </p>
                  <p className="text-[9px] text-muted-foreground">{format(createdAt, 'HH:mm')}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50 border border-border">
                  <p className="text-[9px] uppercase text-muted-foreground mb-0.5">Reference</p>
                  <p className="font-bold font-mono text-xs">
                    #{request.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Project Summary */}
              {request.is_project_work && (
                <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold">Project</p>
                      <p className="text-sm font-semibold text-foreground">
                        {projectInfo?.project_name || 'N/A'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {projectInfo?.client_name ? `Client: ${projectInfo.client_name}` : 'Client: N/A'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {phaseInfo?.phase_name
                          ? `Phase: ${phaseInfo.phase_name}${phaseInfo.status ? ` (${phaseInfo.status.replace(/_/g, ' ')})` : ''}`
                          : `Stage: ${(projectInfo as any)?.lifecycle_stage || (projectInfo as any)?.status || 'N/A'}`}
                      </p>
                    </div>
                    {signedWoUrl && (
                      <Button
                        variant="outline"
                        className="h-9 border-emerald-500/60 text-emerald-600 hover:bg-emerald-500/15 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(signedWoUrl, '_blank');
                        }}
                      >
                        <FileText className="w-4 h-4 mr-2" /> SIGNED WO
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Guardian Flag */}
              {(guardianLoading || guardianChecked) && (
                <div className={cn(
                  "rounded-lg border p-2.5 space-y-1.5 transition-all text-xs",
                  guardianLoading
                    ? "bg-muted/30 border-border"
                    : guardianMatches.length > 0
                      ? (guardianRecommendation === 'flag' ? "bg-red-500/8 border-red-500/50" : "bg-amber-500/8 border-amber-500/50")
                      : "bg-emerald-500/8 border-emerald-500/30"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {guardianLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
                          <span className="text-[11px] font-semibold text-muted-foreground">Payment Guardian scanning...</span>
                        </>
                      ) : guardianMatches.length > 0 ? (
                        <>
                          <span className={cn(
                            "text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5",
                            guardianRecommendation === 'flag' ? "text-red-500" : "text-amber-500"
                          )}>
                            {guardianRecommendation === 'flag' ? '🚨' : '⚠️'}
                            {guardianRecommendation === 'flag' ? 'Duplicate Flagged' : 'Possible Duplicate'}
                            <span className="font-mono text-[10px] opacity-80">({guardianConfidence}% confidence)</span>
                          </span>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-bold uppercase tracking-wide">
                            Payment Guardian Verified - No Issues Found
                          </span>
                        </div>
                      )}
                    </div>
                    {!guardianLoading && guardianMatches.length > 0 && (
                      <button
                        onClick={() => setGuardianExpanded(p => !p)}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                      >
                        {guardianExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {guardianExpanded ? 'Hide' : `View ${guardianMatches.length} match${guardianMatches.length > 1 ? 'es' : ''}`}
                      </button>
                    )}
                  </div>

                  {/* Rule badges */}
                  {!guardianLoading && guardianMatches.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {[...new Set(guardianMatches.map(m => m.rule))].map(rule => (
                        <span key={rule} className={cn(
                          "text-[9px] font-medium px-1.5 py-0.5 rounded-full border",
                          guardianRecommendation === 'flag'
                            ? "border-red-400/40 text-red-400 bg-red-500/10"
                            : "border-amber-400/40 text-amber-400 bg-amber-500/10"
                        )}>
                          {rule === 'exact_same_day_duplicate' ? 'Same-Day Duplicate'
                            : rule === 'invoice_hash_duplicate' ? 'Same Invoice'
                              : rule === 'bank_account_duplicate' ? 'Same Bank + Amount'
                                : rule === 'upi_duplicate' ? 'Same UPI + Amount'
                                  : rule === 'fuzzy_vendor_match' ? 'Similar Vendor'
                                    : rule === 'requester_pattern_anomaly' ? 'Pattern Anomaly'
                                      : rule}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Expanded match details */}
                  {guardianExpanded && (
                    <div className="space-y-2 mt-1">
                      {guardianMatches.map((match, idx) => (
                        <MatchDetail key={idx} match={match} rule={match.rule} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Override Reason Display */}
              {request.override_reason && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-0.5">
                        Duplicate Override Justification
                      </p>
                      <p className="text-xs text-emerald-800 dark:text-emerald-300 italic">
                        "{request.override_reason}"
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Split Payment Batch View */}
              {request.is_split_payment && (
                <SplitPaymentBatchView
                  paymentId={request.id}
                  totalAmount={request.amount}
                  splits={request.splits || []}
                />
              )}

              {/* Transport Trips Viewer */}
              {request.is_transport_payment && request.transport_trips && request.transport_trips.length > 0 && (
                <div className="mt-2 mb-4">
                  <TransportTripsViewer trips={request.transport_trips} />
                </div>
              )}

              {/* WO Audit Proof — shown for payments linked to a work order */}
              {(request as any).work_order_id && (
                <WOAuditProofWidget workOrderId={(request as any).work_order_id} />
              )}

              {/* Past WO Transactions — show all payment history for this work order */}
              {(request as any).work_order_id && (
                <WOPastTransactions
                  workOrderId={(request as any).work_order_id}
                  currentPaymentId={request.id}
                />
              )}

              {/* Purpose - Full */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5 flex items-center gap-2">
                  <FileText className="w-2.5 h-2.5" /> Purpose / Description
                </p>
                <p className="text-xs leading-relaxed">{displayPurpose}</p>
                {displayDetailedDescription && (
                  <div className="mt-2 p-2 rounded-lg bg-muted flex flex-col gap-0.5 border border-border/50">
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Full Details</span>
                    <p className="text-xs border-l-2 border-primary/30 pl-2 py-0.5 whitespace-pre-wrap">{displayDetailedDescription}</p>
                  </div>
                )}
              </div>

              {/* Two Column Layout - Stacks on tablet/small laptop to prevent squeezing */}
              <div className="grid lg:grid-cols-2 gap-4">
                {/* Left: Vendor & Requester Details */}
                <div className="space-y-4">
                  {/* Vendor Details */}
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 flex items-center gap-2">
                      <Building2 className="w-2.5 h-2.5" /> Vendor Details
                    </p>
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Name</p>
                        <p className="font-semibold">{request.vendor_name}</p>
                      </div>
                      {request.vendor_account_number && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Account</p>
                            <p className="font-mono text-xs">{request.vendor_account_number}</p>
                          </div>
                          {request.vendor_ifsc_code && (
                            <div>
                              <p className="text-xs text-muted-foreground">IFSC</p>
                              <p className="font-mono text-xs">{request.vendor_ifsc_code}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {request.vendor_upi && (
                        <div>
                          <p className="text-xs text-muted-foreground">UPI</p>
                          <p className="font-mono text-xs">{request.vendor_upi}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Bank Details</p>
                        <p className="text-xs text-muted-foreground/80">{request.vendor_bank_details}</p>
                      </div>
                    </div>
                  </div>

                  {/* Requester Details */}
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 flex items-center gap-2">
                      <User className="w-2.5 h-2.5" /> Requester
                    </p>
                    <div className="space-y-1.5 text-xs">
                      <div>
                        <p className="text-xs text-muted-foreground">Name</p>
                        <p className="font-semibold">{request.requester?.name || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Department</p>
                        <p className="font-medium capitalize text-primary">
                          {(request.department || request.requester?.department || 'others').toLowerCase() === 'others'
                            ? `Others (${request.requester?.department || 'General'})`
                            : (request.requester?.department || request.department || 'Others')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Document Previews - Direct Internal Proof Access */}
                  <div className="space-y-3">
                    {request.bill_url && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                          <FileText className="w-2.5 h-2.5" /> Proof Folder / Invoices
                        </p>
                        <ProofPreviewGrid
                          proofs={request.bill_url}
                          onExpand={(u, t) => { setPreviewUrl(u); setPreviewTitle(t); setShowPreview(true); }}
                        />
                      </div>
                    )}

                    {request.work_proof_url && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                          <HistoryIcon className="w-2.5 h-2.5" /> Bank Proof / Confirmation
                        </p>
                        <ProofPreviewGrid
                          proofs={request.work_proof_url}
                          onExpand={(u, t) => { setPreviewUrl(u); setPreviewTitle(t); setShowPreview(true); }}
                        />
                      </div>
                    )}
                  </div>

                  {(request.payment_proof_url || request.payment_proof_screenshot) && (
                    <div className="mt-2">
                      <a
                        href={request.payment_proof_url || request.payment_proof_screenshot || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border border-status-live/30 bg-status-live/5 text-status-live hover:bg-status-live/10 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-full bg-status-live/10 flex items-center justify-center group-hover:bg-status-live/20 transition-colors">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">View Payment Transaction Proof</span>
                          <span className="text-[10px] opacity-70">UTR / Screenshot confirmed by Accounts</span>
                        </div>
                        <ExternalLink className="w-3 h-3 ml-auto opacity-50 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </div>
                  )}

                  {request.status === 'paid' && (
                    <div className="mt-2">
                      <Button
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2 border-primary/30 text-primary hover:bg-primary/5 py-6 rounded-xl"
                        onClick={(e) => {
                          e.stopPropagation();
                          generateVoucher(request);
                        }}
                      >
                        <FileText className="w-5 h-5" />
                        <div className="flex flex-col items-start">
                          <span className="font-bold">DOWNLOAD PAYMENT VOUCHER</span>
                          <span className="text-[10px] opacity-70">Official professional transaction summary</span>
                        </div>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Right: Timeline & Actions */}
                <div className="space-y-4">
                  {/* Complete Approval Chain */}
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Approval Chain
                      </span>
                    </p>
                    <PaymentApprovalChain request={request} />
                  </div>

                  {/* Audit History */}
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <HistoryIcon className="w-2.5 h-2.5" /> Audit History
                      </span>
                      <span className="text-primary text-[9px]">{request.audit_timeline?.length || 0} events</span>
                    </p>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
                      {(() => {
                        const timeline = request.audit_timeline || [];
                        const currentStatus = request.status?.toLowerCase() || '';
                        const workflowSteps = getPaymentTimelineSteps(request);

                        const isRejected = currentStatus === 'rejected';
                        const isOnHold = currentStatus === 'ceo_hold' || currentStatus === 'gm_hold';
                        const requesterEntry = timeline[0];

                        return workflowSteps.map((step, idx) => {
                          let matchedEntry: any = null;
                          let isCompleted = false;
                          let isCurrent = false;

                          if (step.role === 'requester') {
                            matchedEntry = requesterEntry;
                            isCompleted = true;
                          } else {
                            matchedEntry = timeline.find((t: any) =>
                              t.role?.toLowerCase() === step.role &&
                              t.status !== 'rejected' &&
                              !t.status?.includes('hold') &&
                              !t.notes?.includes('Reversed') &&
                              !t.notes?.includes('raised') &&
                              !t.notes?.includes('resubmitted')
                            );
                            isCompleted = !!matchedEntry;

                            if (!isCompleted) {
                              const prevStep = workflowSteps[idx - 1];
                              if (prevStep) {
                                const prevCompleted = prevStep.role === 'requester' || !!timeline.find((t: any) =>
                                  t.role?.toLowerCase() === prevStep.role &&
                                  t.status !== 'rejected' &&
                                  !t.status?.includes('hold') &&
                                  !t.notes?.includes('Reversed')
                                );
                                isCurrent = prevCompleted && !isRejected && !isOnHold;
                              }
                              if (currentStatus === step.role + '_audit' || currentStatus === step.status) {
                                isCurrent = true;
                              }
                            }
                          }

                          return (
                            <div key={idx} className={cn(
                              "text-[11px] flex gap-2 border-l-2 pl-2.5 py-1 relative",
                              isCompleted ? "border-green-500/50" : isCurrent ? "border-primary" : "border-muted-foreground/20"
                            )}>
                              <div className={cn(
                                "absolute -left-[5px] top-[9px] w-2 h-2 rounded-full",
                                isCompleted ? "bg-green-500" : isCurrent ? "bg-primary animate-pulse" : "bg-muted-foreground/30"
                              )} />
                              <div className="flex-1">
                                <div className="flex justify-between items-start gap-2">
                                  <span className={cn(
                                    "font-semibold",
                                    isCompleted ? "text-green-400" : isCurrent ? "text-primary" : "text-muted-foreground/50"
                                  )}>
                                    {isCompleted
                                      ? `✓ ${step.label}`
                                      : isCurrent
                                        ? `⏳ Awaiting ${step.label.replace(' Audited', '').replace(' Verified', '').replace(' Approved', '').replace(' Completed', '')} Audit`
                                        : step.label}
                                  </span>
                                  {matchedEntry && isCompleted && (
                                    <span className="text-muted-foreground text-[10px] whitespace-nowrap">
                                      {safeFormat(matchedEntry.timestamp, 'dd/MM HH:mm')}
                                    </span>
                                  )}
                                </div>
                                {isCompleted && matchedEntry && (
                                  <p className="text-muted-foreground">
                                    {step.role === 'requester' ? 'Requested by' : 'by'} <span className="font-medium text-foreground">{matchedEntry.user_name}</span>
                                  </p>
                                )}
                                {isCompleted && matchedEntry && matchedEntry.notes && matchedEntry.notes !== 'Status updated' && matchedEntry.notes !== 'Request raised' && !matchedEntry.notes.startsWith('Approved by') && !matchedEntry.notes.startsWith('Request raised') && (
                                  <p className="text-muted-foreground/80 italic mt-0.5 text-[11px]">"{matchedEntry.notes}"</p>
                                )}
                                {isCurrent && !isRejected && (
                                  <p className={cn(
                                    "font-medium",
                                    currentStatus.includes('hold') ? "text-amber-500" : "text-primary"
                                  )}>
                                    {currentStatus === 'gm_hold' && step.role === 'gm' ? 'ON HOLD' : 'Pending review...'}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}

                      {/* Show rejection if applicable */}
                      {request.status === 'rejected' && (() => {
                        const rejEntry = (request.audit_timeline || []).find((e: any) => e.status === 'rejected');
                        return rejEntry ? (
                          <div className="text-xs flex gap-2 border-l-2 border-red-500 pl-3 py-1.5 relative">
                            <div className="absolute -left-[5px] top-[9px] w-2 h-2 rounded-full bg-red-500" />
                            <div className="flex-1">
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-semibold text-red-400">❌ Rejected</span>
                                <span className="text-muted-foreground text-[10px] whitespace-nowrap">
                                  {safeFormat(rejEntry.timestamp, 'dd/MM HH:mm')}
                                </span>
                              </div>
                              <p className="text-muted-foreground">by <span className="font-medium text-foreground">{rejEntry.user_name}</span></p>
                              {rejEntry.notes && <p className="text-red-400/80 italic mt-0.5 text-[11px]">"{rejEntry.notes}"</p>}
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* Action Panel */}
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-primary uppercase flex items-center gap-2">
                        <MessageSquare className="w-2.5 h-2.5" />
                        {roleLabel ? `${roleLabel} Action` : 'Your Action'}
                      </p>

                      <div className="flex items-center gap-1">
                        <IndividualPaymentReminder
                          payment={{
                            id: request.id,
                            status: request.status,
                            purpose: request.purpose,
                            amount: Number(request.amount),
                            urgency: request.urgency,
                            payment_number: request.payment_number
                          }}
                          showText={false}
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary transition-all"
                        />
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete();
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <Textarea
                      placeholder="Add notes for approval or provide rejection reason..."
                      className="min-h-[60px] text-xs resize-none bg-background"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />

                    {showPettyCashOption && (
                      <div className={cn(
                        "p-3 rounded-xl border-2 transition-all duration-200",
                        isPettyCash
                          ? "border-amber-500 bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                          : "border-amber-500/30 bg-amber-500/5"
                      )}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                              isPettyCash ? "bg-amber-500 text-black" : "bg-amber-500/20 text-amber-600"
                            )}>
                              <Banknote className="w-4 h-4" />
                            </div>
                            <div>
                              <Label htmlFor={`petty-cash-${request.id}`} className="text-sm font-semibold cursor-pointer block">
                                Petty Cash
                              </Label>
                              <p className="text-[10px] text-muted-foreground">
                                Route directly to accounts
                              </p>
                            </div>
                          </div>
                          <Switch
                            id={`petty-cash-${request.id}`}
                            checked={isPettyCash}
                            onCheckedChange={setIsPettyCash}
                            className="data-[state=checked]:bg-amber-500"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        className="flex-1"
                        disabled={isSaving || !note.trim()}
                        onClick={handleReject}
                      >
                        <XCircle className="w-4 h-4 mr-2" /> Reject
                      </Button>

                      {showHoldOption && request.status !== 'gm_hold' && (
                        <Button
                          variant="outline"
                          className="flex-1 border-amber-500/50 text-amber-600 hover:bg-amber-500/5"
                          disabled={isSaving}
                          onClick={handleHold}
                        >
                          <Clock className="w-4 h-4 mr-2" /> Hold
                        </Button>
                      )}

                      <Button
                        className="flex-1 bg-status-live hover:bg-status-live/90"
                        disabled={isSaving}
                        onClick={handleApprove}
                      >
                        <Send className="w-4 h-4 mr-2" /> {isPettyCash ? 'Approve & Petty Cash' : 'Approve & Forward'}
                      </Button>
                    </div>

                    {!note.trim() && (
                      <p className="text-[10px] text-muted-foreground mt-3 pt-3 border-t border-dashed w-full text-center">
                        Created on {format(createdAt, 'PPP')} at {format(createdAt, 'p')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </motion.div>
        )
        }
      </AnimatePresence >

      <DocumentPreviewModal
        url={previewUrl}
        title={previewTitle}
        open={showPreview}
        onOpenChange={setShowPreview}
      />
    </Card >
  );
}

function MatchDetail({ match, rule }: { match: DuplicateMatch; rule: string }) {
  // If it's a pattern anomaly on requester_id, we don't have a payment ID to fetch
  const isPatternAnomaly = rule === 'requester_pattern_anomaly';

  const { data: details, isLoading } = useQuery({
    queryKey: ['payment-details', match.payment_id],
    queryFn: async () => {
      if (!match.payment_id || isPatternAnomaly) return null;
      const { data, error } = await supabase
        .from('payment_requests')
        .select(`
          id, 
          purpose, 
          status, 
          created_at, 
          amount,
          payment_number,
          requester:requester_id(name, department)
        `)
        .eq('id', match.payment_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!match.payment_id && !isPatternAnomaly,
  });

  if (isPatternAnomaly) {
    return (
      <div className="rounded-md bg-background/50 border border-border/60 p-2 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-amber-500">Pattern Anomaly Detected</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          This request deviates from the usual pattern for this vendor or requester (e.g., high frequency or unusual amount).
        </p>
      </div>
    );
  }

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    if (s === 'paid') return <Badge className="h-4 text-[9px] bg-green-500 text-white hover:bg-green-600 border-none px-1.5">Paid</Badge>;
    if (s === 'rejected') return <Badge className="h-4 text-[9px] bg-red-500 text-white hover:bg-red-600 border-none px-1.5">Rejected</Badge>;
    if (s?.includes('approved')) return <Badge className="h-4 text-[9px] bg-emerald-500 text-white hover:bg-emerald-600 border-none px-1.5">Approved</Badge>;
    return <Badge variant="outline" className="h-4 text-[9px] border-amber-500 text-amber-500 px-1.5">{status?.replace(/_/g, ' ') || 'Pending'}</Badge>;
  };

  return (
    <div className="rounded-md bg-background/40 border border-border/60 p-2.5 space-y-2 transition-colors hover:bg-background/60">
      {/* Header: Vendor + Confidence */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold truncate max-w-[180px] text-foreground/90">{match.vendor}</span>
          {details?.status && getStatusBadge(details.status)}
        </div>
        <span className={cn(
          "text-[9px] font-bold px-1.5 py-0.5 rounded",
          match.confidence >= 80 ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
        )}>{match.confidence}% Match</span>
      </div>

      {isLoading ? (
        <div className="space-y-1 animate-pulse">
          <div className="h-3 w-3/4 bg-muted rounded"></div>
          <div className="h-3 w-1/2 bg-muted rounded"></div>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-[10px]">

          {/* Conflicting Payment Link */}
          <div className="col-span-2 flex items-center justify-between border-b border-border/30 pb-1.5 mb-0.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <span className="font-medium">Conflict with:</span>
              <code className="bg-muted px-1 py-0.5 rounded text-[9px]">#{details?.payment_number || match.payment_id?.slice(0, 8)}</code>
            </div>
            {/* Note: In future could link to payment details modal */}
          </div>

          {/* Amount & Date */}
          <div className="flex flex-col">
            <span className="text-muted-foreground font-medium">Amount</span>
            <div className="flex items-center gap-1 text-foreground font-mono">
              <IndianRupee className="w-2.5 h-2.5" />
              {(match.amount || details?.amount || 0).toLocaleString('en-IN')}
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-muted-foreground font-medium">Date</span>
            <div className="flex items-center gap-1 text-foreground">
              <Calendar className="w-2.5 h-2.5 text-muted-foreground" />
              {details?.created_at
                ? format(new Date(details.created_at), 'dd MMM yy')
                : (match.date ? new Date(match.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—')}
            </div>
          </div>

          {/* Requester Info */}
          {(details as any)?.requester && (
            <div className="col-span-2 flex items-center gap-1.5 pt-0.5">
              <User className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Requester:</span>
              <span className="font-medium text-foreground">{(details as any).requester.name}</span>
              <span className="text-[9px] text-muted-foreground">({(details as any).requester.department})</span>
            </div>
          )}

          {/* Purpose */}
          <div className="col-span-2 mt-0.5">
            <span className="text-muted-foreground font-medium block mb-0.5">Purpose:</span>
            <p className="text-foreground/80 line-clamp-2 leading-snug bg-muted/30 p-1.5 rounded border border-border/30">
              {details?.purpose || 'No purpose description available'}
            </p>
          </div>
        </div>
      )}
      {/* Link */}
      {match.payment_id && (
        <a
          href={`/admin/payment-approvals?highlight=${match.payment_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-medium mt-1 text-primary hover:underline hover:text-primary/80 transition-colors"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />
          View full payment details #{match.payment_id.slice(0, 8).toUpperCase()}
        </a>
      )}
    </div>
  );
}
