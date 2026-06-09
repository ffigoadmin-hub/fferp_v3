import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2,
    XCircle,
    Clock,
    FileText,
    ExternalLink,
    MessageSquare,
    ChevronDown,
    ChevronUp,
    History as HistoryIcon,
    ShieldCheck,
    Send,
    Wallet,
    AlertTriangle
} from 'lucide-react';
import { usePaymentRequests, PaymentStatus, PAYMENT_STATUS_LABELS } from '@/hooks/usePaymentRequests';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { normalizeDepartment } from '@/lib/paymentWorkflow';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PaymentReceipt } from './PaymentReceipt';

interface HierarchicalPaymentAuditWidgetProps {
    roles: string[];
    targetStatuses: PaymentStatus[];
    title: string;
    subtitle: string;
}

export function HierarchicalPaymentAuditWidget({
    roles,
    targetStatuses,
    title,
    subtitle
}: HierarchicalPaymentAuditWidgetProps) {
    const { user } = useAuth();
    const { requests: rawRequests, isLoading, isSaving, updateStatus } = usePaymentRequests(targetStatuses);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [isPettyCash, setIsPettyCash] = useState(false);
    const [confirmPettyCashApproval, setConfirmPettyCashApproval] = useState<string | null>(null);
    const [pendingApprovalData, setPendingApprovalData] = useState<{ id: string, status: PaymentStatus, department: string } | null>(null);
    const [receiptDialog, setReceiptDialog] = useState<{ open: boolean; payment: any }>({ open: false, payment: null });

    // Filter requests ensuring SMO only sees their own department's requests
    const requests = rawRequests.filter(r => {
        if (roles.includes('smo')) {
            // SMO can only audit their own department
            const auditorDept = user?.department?.toLowerCase();
            const requestDept = r.requester?.department?.toLowerCase();

            if (auditorDept === 'engineering') return requestDept === 'engineering';
            if (auditorDept?.includes('agri')) return requestDept?.includes('agri');
            // Other SMOs logic if needed
        }
        return true;
    });

    /**
     * Enterprise Payment Workflow Routing
     * 
     * ENGINEERING (7 steps): smo_audit → gmo_audit → boi_audit → gm_audit → admin_audit → ceo_audit → paid
     * AGRI (6 steps): smo_audit → boi_audit → director_audit → admin_audit → ceo_audit → paid
     * OTHERS (3 steps): admin_audit → ceo_audit → paid
     */
    const getNextStatus = (currentStatus: PaymentStatus, department: string, pettyCashOverride: boolean = false): PaymentStatus => {
        const dept = normalizeDepartment(department);

        // Petty Cash Bypass (Admin Only) - Skip CEO queue
        if (currentStatus === 'admin_audit' && pettyCashOverride) {
            return 'ceo_approved';
        }

        switch (currentStatus) {
            case 'smo_audit':
                // Engineering: SMO → GMO
                if (dept === 'engineering') return 'gmo_audit';
                // Agri: SMO → BOI
                if (dept === 'agri') return 'boi_audit';
                // Others/Agri Mart: Fallback to Admin (though they shouldn't hit SMO)
                return 'admin_audit';

            case 'gmo_audit':
                // Engineering: GMO → BOI (financial compliance)
                return 'boi_audit';

            case 'boi_audit':
                // Engineering: BOI → GM
                if (dept === 'engineering') return 'gm_audit';
                // Agri: BOI → Director
                if (dept === 'agri' || dept === 'agri_mart') return 'director_audit';
                // Others: BOI → Admin
                return 'admin_audit';

            case 'director_audit':
                // Agri & Agri Mart: Director → Admin
                return 'admin_audit';

            case 'gm_audit':
                // Engineering, R&D, Purchase: GM → Admin
                return 'admin_audit';

            case 'admin_audit':
                // All: Admin → CEO
                return 'ceo_audit';

            case 'ceo_audit':
                // All: CEO → Approved
                return 'ceo_approved';

            default:
                return 'ceo_approved';
        }
    };

    const handleAction = async (id: string, action: 'approve' | 'reject', currentStatus: PaymentStatus, department: string) => {
        if (action === 'approve') {
            // If petty cash is enabled, show confirmation first
            if (isPettyCash && currentStatus === 'admin_audit') {
                setPendingApprovalData({ id, status: currentStatus, department });
                setConfirmPettyCashApproval(id);
                return;
            }
            await executeApproval(id, currentStatus, department);
        } else {
            if (!note) {
                toast.error('Please provide a reason for rejection');
                return;
            }
            const res = await updateStatus(id, 'rejected', { rejectionReason: note });
            if (res.success) {
                toast.success('Request rejected');
                setNote('');
                setExpandedId(null);
            }
        }
    };

    const executeApproval = async (id: string, currentStatus: PaymentStatus, department: string) => {
        const nextStatus = getNextStatus(currentStatus, department, isPettyCash);
        const res = await updateStatus(id, nextStatus, {
            holdReason: note,
            isPettyCash: isPettyCash
        });
        if (res.success) {
            toast.success(isPettyCash
                ? `Petty Cash Approved (CEO Bypassed). Status: ${nextStatus}`
                : `Request forwarded to Audit Level: ${nextStatus}`
            );
            setNote('');
            setExpandedId(null);
            setIsPettyCash(false);
            setConfirmPettyCashApproval(null);
            setPendingApprovalData(null);
        }
    };

    const confirmPettyCashAction = async () => {
        if (pendingApprovalData) {
            await executeApproval(pendingApprovalData.id, pendingApprovalData.status, pendingApprovalData.department);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Clock className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-xl font-bold">{title}</h2>
                    <p className="text-sm text-muted-foreground">{subtitle}</p>
                </div>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    {requests.length} Pending
                </Badge>
            </div>

            {requests.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <ShieldCheck className="w-12 h-12 text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground font-medium">Clear Queue</p>
                        <p className="text-sm text-muted-foreground">All payment requests in your jurisdiction are caught up.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {requests.map((request) => (
                        <Card key={request.id} className="overflow-hidden border-primary/10 hover:border-primary/30 transition-all">
                            <div
                                className="p-4 flex items-center justify-between cursor-pointer"
                                onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${request.urgency === 'emergency' ? 'bg-red-100 text-red-600' :
                                        request.urgency === 'important' ? 'bg-amber-100 text-amber-600' :
                                            'bg-blue-100 text-blue-600'
                                        }`}>
                                        {request.urgency === 'emergency' ? '!' : <FileText className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold flex items-center gap-2">
                                            {request.vendor_name}
                                            <Badge variant="secondary" className="text-[10px] uppercase">
                                                {request.requester?.department}
                                            </Badge>
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            Requested by {request.requester?.name} • ₹{request.amount.toLocaleString('en-IN')}
                                        </p>
                                        <p className="text-xs font-medium mt-1 text-foreground/80">
                                            {request.purpose}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right mr-2 hidden sm:block">
                                        <p className="text-[10px] uppercase text-muted-foreground">Status</p>
                                        <Badge variant="outline" className={`capitalize ${request.status === 'paid' ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100' : ''}`}>
                                            {request.status === 'ceo_approved' || request.status === 'admin_approved' ? 'Waiting for Payment' :
                                                request.status === 'paid' ? 'Payment Completed' :
                                                    request.status.replace('_', ' ')}
                                        </Badge>
                                    </div>
                                    {expandedId === request.id ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                                </div>
                            </div>

                            <AnimatePresence>
                                {expandedId === request.id && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                    >
                                        <CardContent className="px-4 pb-4 pt-0 border-t border-dashed">
                                            <div className="grid md:grid-cols-2 gap-6 mt-4">
                                                <div className="space-y-4">
                                                    <div>
                                                        <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Purpose</p>
                                                        <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 italic">
                                                            "{request.purpose}"
                                                        </p>
                                                        {request.detailed_description && (
                                                            <div className="mt-2 p-3 rounded-lg bg-muted/50 flex flex-col gap-1 border border-border/50">
                                                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Detailed Description</span>
                                                                <p className="text-xs whitespace-pre-wrap text-muted-foreground italic leading-relaxed">
                                                                    {request.detailed_description}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div className="p-2 rounded bg-muted/50">
                                                            <p className="text-muted-foreground mb-1 uppercase tracking-tighter">Due Date</p>
                                                            <p className="font-mono font-bold">{request.cutoff_date}</p>
                                                        </div>
                                                        <div className="p-2 rounded bg-muted/50">
                                                            <p className="text-muted-foreground mb-1 uppercase tracking-tighter">Reference</p>
                                                            <p className="font-mono font-bold">#{request.id.slice(0, 8)}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <Button variant="outline" size="sm" asChild className="w-full text-xs">
                                                            <a href={request.bill_url?.split(',')[0]?.trim()} target="_blank" rel="noopener noreferrer">
                                                                <FileText className="w-3 h-3 mr-2" /> Proof Folder
                                                            </a>
                                                        </Button>
                                                        {request.work_proof_url && (
                                                            <Button variant="outline" size="sm" asChild className="w-full text-xs">
                                                                <a href={request.work_proof_url} target="_blank" rel="noopener noreferrer">
                                                                    <HistoryIcon className="w-3 h-3 mr-2" /> Bank Proof
                                                                </a>
                                                            </Button>
                                                        )}
                                                    </div>

                                                    {/* Payment Details Block */}
                                                    {request.status === 'paid' && (
                                                        <div className="mt-4 p-3 bg-green-50/50 border border-green-100 rounded-lg">
                                                            <p className="text-xs font-bold text-green-700 uppercase mb-2 flex items-center gap-2">
                                                                <CheckCircle2 className="w-3 h-3" /> Payment Complete
                                                            </p>
                                                            {request.utr_number && (
                                                                <div className="mb-2">
                                                                    <p className="text-[10px] text-muted-foreground uppercase">UTR / Reference</p>
                                                                    <p className="font-mono text-xs font-medium">{request.utr_number}</p>
                                                                </div>
                                                            )}
                                                            {(request.payment_proof_url || request.payment_proof_screenshot) && (
                                                                <Button variant="outline" size="sm" asChild className="w-full text-xs bg-white h-7 hover:bg-green-50">
                                                                    <a href={request.payment_proof_url || request.payment_proof_screenshot || ''} target="_blank" rel="noopener noreferrer">
                                                                        <ExternalLink className="w-3 h-3 mr-2" /> View Payment Proof
                                                                    </a>
                                                                </Button>
                                                            )}

                                                            {/* Professional Receipt */}
                                                            <Button
                                                                variant="default"
                                                                size="sm"
                                                                className="w-full text-xs bg-emerald-500 hover:bg-emerald-600 text-white h-8 mt-3 border-none shadow-sm transition-all font-bold"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setReceiptDialog({ open: true, payment: request });
                                                                }}
                                                            >
                                                                <FileText className="w-3 h-3 mr-2" /> Generate Official Voucher
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-4">
                                                    <div>
                                                        <p className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center justify-between">
                                                            Audit Timeline
                                                            <HistoryIcon className="w-3 h-3" />
                                                        </p>

                                                        {/* Reversal Warning Alert */}
                                                        {request.accounts_reversal_reason && (
                                                            <div className="mb-3 p-3 rounded-lg bg-amber-500/15 border-2 border-amber-500 animate-pulse">
                                                                <div className="flex items-start gap-2">
                                                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                                                    <div className="flex-1">
                                                                        <p className="text-xs font-bold text-amber-500">
                                                                            ⚠️ NEEDS REVIEW - CONTACT ADMIN
                                                                        </p>
                                                                        <p className="text-[10px] text-muted-foreground mt-1">
                                                                            <span className="font-medium">Issue:</span> {request.accounts_reversal_reason}
                                                                        </p>
                                                                        <p className="text-[10px] text-amber-600 mt-1">
                                                                            Bank details need correction before payment can proceed.
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="space-y-1 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
                                                            {(() => {
                                                                const rawDept = (request.requester?.department || request.department || 'others');
                                                                const dept = normalizeDepartment(rawDept);
                                                                const timeline = request.audit_timeline || [];
                                                                const currentStatus = request.status?.toLowerCase() || '';

                                                                // Define complete workflow chain per department
                                                                let workflowSteps: { role: string; label: string; status: string }[] = [];
                                                                if (dept === 'engineering') {
                                                                    workflowSteps = [
                                                                        { role: 'requester', label: 'Payment Requested', status: 'smo_audit' },
                                                                        { role: 'smo', label: 'SMO Audited', status: 'gmo_audit' },
                                                                        { role: 'gmo', label: 'GMO Audited', status: 'boi_audit' },
                                                                        { role: 'boi', label: 'BOI Audited', status: 'gm_audit' },
                                                                        { role: 'gm', label: 'GM Audited', status: 'admin_audit' },
                                                                        { role: 'admin', label: 'Admin Verified', status: 'ceo_audit' },
                                                                        { role: 'ceo', label: 'CEO Approved', status: 'ceo_approved' },
                                                                        { role: 'accounts', label: 'Payment Completed', status: 'paid' },
                                                                    ];
                                                                } else if (dept === 'agri_mart') {
                                                                    workflowSteps = [
                                                                        { role: 'requester', label: 'Payment Requested', status: 'director_audit' },
                                                                        { role: 'director', label: 'Director Audited', status: 'admin_audit' },
                                                                        { role: 'admin', label: 'Admin Verified', status: 'ceo_audit' },
                                                                        { role: 'ceo', label: 'CEO Approved', status: 'ceo_approved' },
                                                                        { role: 'accounts', label: 'Payment Completed', status: 'paid' },
                                                                    ];
                                                                } else if (dept === 'agri') {
                                                                    workflowSteps = [
                                                                        { role: 'requester', label: 'Payment Requested', status: 'smo_audit' },
                                                                        { role: 'smo', label: 'SMO Audited', status: 'boi_audit' },
                                                                        { role: 'boi', label: 'BOI Audited', status: 'director_audit' },
                                                                        { role: 'director', label: 'Director Audited', status: 'admin_audit' },
                                                                        { role: 'admin', label: 'Admin Verified', status: 'ceo_audit' },
                                                                        { role: 'ceo', label: 'CEO Approved', status: 'ceo_approved' },
                                                                        { role: 'accounts', label: 'Payment Completed', status: 'paid' },
                                                                    ];
                                                                } else if (dept === 'r_and_d' || dept === 'purchase') {
                                                                    workflowSteps = [
                                                                        { role: 'requester', label: 'Payment Requested', status: 'gm_audit' },
                                                                        { role: 'gm', label: 'GM Audited', status: 'admin_audit' },
                                                                        { role: 'admin', label: 'Admin Verified', status: 'ceo_audit' },
                                                                        { role: 'ceo', label: 'CEO Approved', status: 'ceo_approved' },
                                                                        { role: 'accounts', label: 'Payment Completed', status: 'paid' },
                                                                    ];
                                                                } else {
                                                                    workflowSteps = [
                                                                        { role: 'requester', label: 'Payment Requested', status: 'admin_audit' },
                                                                        { role: 'admin', label: 'Admin Verified', status: 'ceo_audit' },
                                                                        { role: 'ceo', label: 'CEO Approved', status: 'ceo_approved' },
                                                                        { role: 'accounts', label: 'Payment Completed', status: 'paid' },
                                                                    ];
                                                                }

                                                                // Check for rejection/hold
                                                                const isRejected = currentStatus === 'rejected';
                                                                const isOnHold = currentStatus === 'ceo_hold';

                                                                // Map each workflow step to timeline data
                                                                const statusOrder = workflowSteps.map(s => s.status);
                                                                const currentIdx = statusOrder.indexOf(currentStatus);

                                                                // Find the requester entry (first timeline entry)
                                                                const requesterEntry = timeline[0];

                                                                return workflowSteps.map((step, idx) => {
                                                                    // Find matching timeline entry for this role
                                                                    let matchedEntry: any = null;
                                                                    let isCompleted = false;
                                                                    let isCurrent = false;

                                                                    if (step.role === 'requester') {
                                                                        matchedEntry = requesterEntry;
                                                                        isCompleted = true; // Always completed
                                                                    } else {
                                                                        // Find timeline entry where this role approved
                                                                        // The role matches AND it's not a rejection
                                                                        matchedEntry = timeline.find(t =>
                                                                            t.role?.toLowerCase() === step.role &&
                                                                            t.status !== 'rejected' &&
                                                                            !t.notes?.includes('Reversed')
                                                                        );

                                                                        // Step is completed if we found a matching entry
                                                                        isCompleted = !!matchedEntry;

                                                                        // Step is current if:
                                                                        // - Not completed AND the previous step IS completed
                                                                        // - OR status directly matches
                                                                        if (!isCompleted) {
                                                                            const prevStep = workflowSteps[idx - 1];
                                                                            if (prevStep) {
                                                                                const prevCompleted = prevStep.role === 'requester' || !!timeline.find(t =>
                                                                                    t.role?.toLowerCase() === prevStep.role &&
                                                                                    t.status !== 'rejected' &&
                                                                                    !t.notes?.includes('Reversed')
                                                                                );
                                                                                isCurrent = prevCompleted && !isRejected && !isOnHold;
                                                                            }
                                                                            // Also check direct status match
                                                                            if (currentStatus === step.role + '_audit' || currentStatus === step.status) {
                                                                                isCurrent = true;
                                                                            }
                                                                        }
                                                                    }

                                                                    const isPending = !isCompleted && !isCurrent;

                                                                    return (
                                                                        <div key={idx} className={cn(
                                                                            "text-[10px] flex gap-2 border-l-2 pl-2 py-1 relative",
                                                                            isCompleted ? "border-green-500/50" : isCurrent ? "border-primary" : "border-muted-foreground/20"
                                                                        )}>
                                                                            <div className={cn(
                                                                                "absolute -left-[5px] top-[7px] w-2 h-2 rounded-full",
                                                                                isCompleted ? "bg-green-500" : isCurrent ? "bg-primary animate-pulse" : "bg-muted-foreground/30"
                                                                            )} />
                                                                            <div className="flex-1">
                                                                                <div className="flex justify-between font-bold">
                                                                                    <span className={cn(
                                                                                        isCompleted ? "text-green-500" : isCurrent ? "text-primary" : "text-muted-foreground/50"
                                                                                    )}>
                                                                                        {isCompleted ? `✓ ${step.label}` : isCurrent ? `⏳ Awaiting ${step.label.replace(' Audited', '').replace(' Verified', '').replace(' Approved', '').replace(' Completed', '')} Audit` : step.label}
                                                                                    </span>
                                                                                    {matchedEntry && isCompleted && (
                                                                                        <span className="text-muted-foreground font-normal">{format(new Date(matchedEntry.timestamp), 'dd/MM HH:mm')}</span>
                                                                                    )}
                                                                                </div>
                                                                                {isCompleted && matchedEntry && (
                                                                                    <p className="text-muted-foreground">
                                                                                        {step.role === 'requester' ? 'Requested by' : 'by'} <span className="font-medium text-foreground">{matchedEntry.user_name}</span>
                                                                                        {matchedEntry.notes && matchedEntry.notes !== 'Status updated' && matchedEntry.notes !== 'Request raised' && !matchedEntry.notes.startsWith('Approved by') && !matchedEntry.notes.startsWith('Request raised') && (
                                                                                            <span className="italic"> — "{matchedEntry.notes}"</span>
                                                                                        )}
                                                                                    </p>
                                                                                )}
                                                                                {isCurrent && !isRejected && (
                                                                                    <p className="text-primary font-medium">Pending review...</p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                });
                                                            })()}

                                                            {/* Show rejection if applicable */}
                                                            {request.status === 'rejected' && (() => {
                                                                const rejEntry = (request.audit_timeline || []).find(e => e.status === 'rejected');
                                                                return rejEntry ? (
                                                                    <div className="text-[10px] flex gap-2 border-l-2 border-red-500 pl-2 py-1 relative">
                                                                        <div className="absolute -left-[5px] top-[7px] w-2 h-2 rounded-full bg-red-500" />
                                                                        <div className="flex-1">
                                                                            <div className="flex justify-between font-bold text-red-500">
                                                                                <span>❌ Rejected</span>
                                                                                <span className="text-muted-foreground font-normal">{format(new Date(rejEntry.timestamp), 'dd/MM HH:mm')}</span>
                                                                            </div>
                                                                            <p className="text-red-400">
                                                                                by <span className="font-medium">{rejEntry.user_name}</span>: "{rejEntry.notes}"
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2 pt-2">
                                                        <div className="relative">
                                                            <MessageSquare className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                                                            <Textarea
                                                                placeholder="Add follow-up notes or rejection reason..."
                                                                className="pl-8 min-h-[80px] text-xs resize-none"
                                                                value={note}
                                                                onChange={(e) => setNote(e.target.value)}
                                                            />
                                                        </div>

                                                        {request.status === 'admin_audit' && (
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
                                                                            <Wallet className="w-4 h-4" />
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
                                                                {isPettyCash && (
                                                                    <div className="mt-2 pt-2 border-t border-amber-500/20">
                                                                        <p className="text-[10px] text-amber-600 flex items-center gap-1.5">
                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                            Will bypass CEO approval queue
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="flex gap-2">
                                                            <Button
                                                                variant="destructive"
                                                                className="flex-1"
                                                                disabled={isSaving}
                                                                onClick={() => handleAction(request.id, 'reject', request.status, request.requester?.department || '')}
                                                            >
                                                                <XCircle className="w-4 h-4 mr-2" /> Reject
                                                            </Button>
                                                            <Button
                                                                variant="default"
                                                                className="flex-1 bg-green-600 hover:bg-green-700"
                                                                disabled={isSaving}
                                                                onClick={() => handleAction(request.id, 'approve', request.status, request.requester?.department || '')}
                                                            >
                                                                <Send className="w-4 h-4 mr-2" /> Follow up & Forward
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </Card>
                    ))}
                </div>
            )}

            {/* Petty Cash Confirmation Dialog */}
            <Dialog open={!!confirmPettyCashApproval} onOpenChange={(open) => {
                if (!open) {
                    setConfirmPettyCashApproval(null);
                    setPendingApprovalData(null);
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="w-5 h-5" />
                            Confirm Petty Cash Approval
                        </DialogTitle>
                        <DialogDescription>
                            This payment will <strong>bypass CEO approval</strong> and go directly to the Petty Cash execution queue.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                        <p className="text-sm text-amber-800 dark:text-amber-300">
                            <strong>⚠️ Warning:</strong> This action cannot be undone. The payment will be marked as Petty Cash and routed to Accounts for immediate execution.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setConfirmPettyCashApproval(null);
                            setPendingApprovalData(null);
                        }}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-amber-600 hover:bg-amber-700"
                            onClick={confirmPettyCashAction}
                            disabled={isSaving}
                        >
                            {isSaving ? 'Processing...' : 'Confirm as Petty Cash'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Payment Receipt Dialog */}
            {receiptDialog.payment && (
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
                        requester_name: receiptDialog.payment.requester?.name || 'Authorized Auditor',
                        department: receiptDialog.payment.requester?.department || 'Accounts',
                        is_split_payment: receiptDialog.payment.is_split_payment,
                        splits: receiptDialog.payment.splits
                    }}
                />
            )}
        </div>
    );
}
