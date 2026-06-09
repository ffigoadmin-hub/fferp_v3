import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, ChevronUp, Building2, CreditCard, FileText,
    CheckCircle2, AlertTriangle, Eye, ExternalLink, User, Calendar,
    Clock, Banknote, Trash2, History as HistoryIcon, Download, Zap, Timer,
    XCircle, PauseCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { differenceInHours } from 'date-fns';
import { safeFormat } from '@/lib/dateUtils';
import { validateIFSC, validateAccountNumber } from '@/utils/paymentValidation';
import { generateVoucher } from '@/lib/exportUtils';
import { ProofPreviewGrid } from './EmbeddedProofPreview';
import { DocumentPreviewModal } from '../DocumentPreviewModal';
import { SplitPaymentBatchView } from '@/components/payments/SplitPaymentBatchView';
import type { PaymentRequestData } from '@/hooks/usePaymentRequests';

interface PaymentRegistryCardProps {
    payment: PaymentRequestData;
    onViewDetails?: (payment: PaymentRequestData) => void;
    onDelete?: (id: string) => void;
    onResubmit?: (id: string) => void;
    role?: string;
}

const urgencyConfig: Record<string, { bg: string; text: string; border: string; label: string; icon: React.ElementType }> = {
    emergency: { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30', label: 'Emergency', icon: Zap },
    important: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/30', label: 'Important', icon: AlertTriangle },
    normal: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30', label: 'Normal', icon: CheckCircle2 },
};

export function PaymentRegistryCard({ payment, onViewDetails, onDelete, onResubmit, role = 'admin' }: PaymentRegistryCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Preview state
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewTitle, setPreviewTitle] = useState('');
    const [showPreview, setShowPreview] = useState(false);

    // Validation checks
    const ifscValid = validateIFSC(payment.vendor_ifsc_code);
    const accountValid = validateAccountNumber(payment.vendor_account_number);
    const upiValid = !!payment.vendor_upi;
    const hasAllBankDetails = payment.is_petty_cash || upiValid || (ifscValid && accountValid && (payment.beneficiary_name || payment.vendor_name));

    const urgencyStyle = urgencyConfig[payment.urgency] || urgencyConfig.normal;
    const UrgencyIcon = urgencyStyle.icon;

    // Time metrics
    const now = new Date();
    const cutoffTime = payment.cutoff_date && payment.cutoff_time ? new Date(`${payment.cutoff_date}T${payment.cutoff_time}`) : null;
    const hoursUntilCutoff = cutoffTime ? differenceInHours(cutoffTime, now) : null;
    const isOverdue = hoursUntilCutoff !== null && hoursUntilCutoff <= 0;

    const statusColors: Record<string, string> = {
        'admin_audit': 'bg-authority-admin/20 text-authority-admin border-authority-admin/30',
        'ceo_audit': 'bg-authority-ceo/20 text-authority-ceo border-authority-ceo/30',
        'ceo_approved': 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30',
        'paid': 'bg-blue-500/20 text-blue-500 border-blue-500/30',
        'rejected': 'bg-red-500/20 text-red-500 border-red-500/30',
        'ceo_hold': 'bg-amber-500/20 text-amber-500 border-amber-500/30',
        'gm_hold': 'bg-orange-500/20 text-orange-500 border-orange-500/30',
        'bulk_prepared': 'bg-violet-500/20 text-violet-500 border-violet-500/30',
    };

    const statusLabels: Record<string, string> = {
        'pending': 'PAYMENT INITIATED',
        'smo_audit': 'AWAITING SMO',
        'gmo_audit': 'AWAITING GMO',
        'boi_audit': 'AWAITING BOI',
        'director_audit': 'AWAITING DIRECTOR',
        'gm_audit': 'AWAITING GM',
        'admin_audit': 'AWAITING ADMIN',
        'ceo_audit': 'AWAITING CEO',
        'ceo_approved': 'CEO APPROVED',
        'paid': 'PAYMENT DONE',
        'rejected': 'PAYMENT REJECTED',
        'ceo_hold': 'CEO HOLD',
        'gm_hold': 'GM HOLD',
        'bulk_prepared': 'BULK PREPARED',
    };

    const projectInfo = (payment as any).project || null;
    const phaseInfo =
        (payment as any).phase ||
        (payment as any).work_order?.boq_item?.phase ||
        (payment as any).project?.current_phase ||
        (payment as any).project?.default_phase ||
        null;
    const signedWoUrl = (payment as any).work_order?.signed_document_url || null;

    return (
        <Card className={cn(
            "overflow-hidden transition-all duration-300 bg-slate-950 border-slate-800",
            isExpanded ? "ring-2 ring-primary/40 shadow-2xl shadow-primary/10" : "hover:border-slate-700",
            payment.urgency === 'emergency' && !isExpanded && "border-red-500/30"
        )}>
            <div
                className={cn(
                    "p-4 cursor-pointer selection-none",
                    isExpanded && "bg-slate-900/50"
                )}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Status & Amount Block */}
                        <div className="text-center min-w-[100px] p-2 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Amount</p>
                            <p className="text-xl font-bold text-slate-50 font-mono tracking-tight glow-sm">
                                ₹{Number(payment.amount).toLocaleString('en-IN')}
                            </p>
                            <Badge
                                variant="outline"
                                className={cn("text-[8px] h-4 mt-2 px-1 border-0 uppercase font-black", urgencyStyle.bg, urgencyStyle.text)}
                            >
                                {payment.urgency}
                            </Badge>
                        </div>

                        <div className="flex-1 min-w-0 pt-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded leading-none">
                                    PAY-{payment.payment_number || payment.id.slice(0, 8).toUpperCase()}
                                </span>
                                <Badge variant="outline" className={cn("text-[10px] h-4 font-bold border-0 gap-1", statusColors[payment.status] || 'bg-slate-800 text-slate-400')}>
                                    {payment.status === 'rejected' && <XCircle className="w-3 h-3" />}
                                    {payment.status.includes('hold') && <PauseCircle className="w-3 h-3" />}
                                    {statusLabels[payment.status] || payment.status.replace('_', ' ').toUpperCase()}
                                </Badge>
                                {payment.is_petty_cash && (
                                    <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[10px] h-4">
                                        PETTY CASH
                                    </Badge>
                                )}
                            </div>

                            <h3 className="font-bold text-slate-200 text-lg leading-tight truncate font-sans">
                                {payment.purpose}
                            </h3>

                            <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                                <span className="flex items-center gap-1">
                                    <User className="w-3 h-3 text-slate-500" />
                                    {payment.requester?.name || 'Unknown'}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-slate-700" />
                                <span className="flex items-center gap-1 font-semibold text-slate-300">
                                    <Building2 className="w-3 h-3 text-slate-500" />
                                    {payment.vendor_name}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 shrink-0 pt-1">
                        <div className="text-right hidden sm:block">
                            {hoursUntilCutoff !== null && (
                                <div className={cn(
                                    "flex items-center gap-1 text-[10px] font-bold justify-end mb-2 tracking-tighter",
                                    isOverdue ? "text-red-500" : hoursUntilCutoff <= 12 ? "text-amber-500" : "text-slate-500"
                                )}>
                                    <Timer className="w-3 h-3" />
                                    {isOverdue ? "OVERDUE" : `${hoursUntilCutoff}H LEFT`}
                                </div>
                            )}
                            {/* Security/Validation Indicators */}
                            <div className="flex items-center gap-1 justify-end">
                                {hasAllBankDetails ? (
                                    <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1 px-1.5 font-bold">
                                        <CheckCircle2 className="w-2.5 h-2.5" /> SECURE
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-500 border-red-500/20 gap-1 px-1.5 font-bold">
                                        <AlertTriangle className="w-2.5 h-2.5" /> INCOMPLETE
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "rounded-full w-8 h-8 transition-colors",
                                isExpanded ? "bg-primary/20 text-primary" : "bg-slate-900 border border-slate-800 text-slate-400"
                            )}
                        >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                    >
                        <div className="px-5 pb-5 pt-2 border-t border-slate-800/50 bg-slate-950">
                            {/* Rejection/Hold Alert */}
                            {(payment.status === 'rejected' || payment.status.includes('hold')) && (
                                <div className={cn(
                                    "mt-4 p-3 rounded-lg border",
                                    payment.status === 'rejected' ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                )}>
                                    <div className="flex items-start gap-3">
                                        {payment.status === 'rejected' ? <XCircle className="w-5 h-5 mt-0.5" /> : <PauseCircle className="w-5 h-5 mt-0.5" />}
                                        <div>
                                            <p className="font-bold text-xs uppercase tracking-wider mb-1">
                                                {payment.status === 'rejected' ? 'Rejection Reason' : 'Hold Reason'}
                                            </p>
                                            <p className="text-sm font-medium">
                                                {payment.admin_rejection_reason || payment.ceo_hold_reason || 'No reason provided'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Project Summary */}
                            {payment.is_project_work && (
                                <div className="mt-4 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Project</p>
                                            <p className="text-sm font-semibold text-slate-100">
                                                {projectInfo?.project_name || 'N/A'}
                                            </p>
                                            <p className="text-[11px] text-slate-400">
                                                {projectInfo?.client_name ? `Client: ${projectInfo.client_name}` : 'Client: N/A'}
                                            </p>
                                            <p className="text-[11px] text-slate-400">
                                                {phaseInfo?.phase_name
                                                    ? `Phase: ${phaseInfo.phase_name}${phaseInfo.status ? ` (${phaseInfo.status.replace(/_/g, ' ')})` : ''}`
                                                    : `Stage: ${(projectInfo as any)?.lifecycle_stage || (projectInfo as any)?.status || 'N/A'}`}
                                            </p>
                                        </div>
                                        {signedWoUrl && (
                                            <Button
                                                variant="outline"
                                                className="h-9 border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/15 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
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

                            {/* NEW: Split Payment Batch View */}
                            {payment.is_split_payment && (
                                <div className="mt-4 mb-4" onClick={(e) => e.stopPropagation()}>
                                    <SplitPaymentBatchView
                                        paymentId={payment.id}
                                        totalAmount={payment.amount}
                                        splits={payment.splits || []}
                                    />
                                </div>
                            )}

                            <div className="grid md:grid-cols-2 gap-6 mt-4">
                                {/* Information Column */}
                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                <CreditCard className="w-3 h-3" /> Payment Details
                                            </h4>
                                            <Badge variant="outline" className="text-[9px] font-mono border-slate-800">
                                                {payment.is_petty_cash ? 'CASH' : (Number(payment.amount) >= 200000 ? 'RTGS' : 'NEFT')}
                                            </Badge>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Beneficiary</p>
                                                    <p className="text-sm font-semibold truncate text-slate-200">
                                                        {payment.beneficiary_name || payment.vendor_name}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Account Num</p>
                                                    <p className="text-sm font-mono text-slate-300">
                                                        {payment.vendor_account_number || 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase">IFSC Code</p>
                                                    <p className="text-sm font-mono text-slate-300">
                                                        {payment.vendor_ifsc_code || 'N/A'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase">UPI ID</p>
                                                    <p className="text-sm font-mono text-primary/80 italic">
                                                        {payment.vendor_upi || 'None'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        {/* Proof Previews Internal */}
                                        {payment.bill_url && (
                                            <div className="space-y-1.5 mb-2">
                                                <p className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-2">
                                                    <FileText className="w-2.5 h-2.5" /> Proof Folder
                                                </p>
                                                <ProofPreviewGrid
                                                    proofs={payment.bill_url}
                                                    onExpand={(u, t) => { setPreviewUrl(u); setPreviewTitle(t); setShowPreview(true); }}
                                                />
                                            </div>
                                        )}

                                        {payment.work_proof_url && (
                                            <div className="space-y-1.5 mb-2">
                                                <p className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-2">
                                                    <CheckCircle2 className="w-2.5 h-2.5" /> Bank Proof
                                                </p>
                                                <ProofPreviewGrid
                                                    proofs={payment.work_proof_url}
                                                    onExpand={(u, t) => { setPreviewUrl(u); setPreviewTitle(t); setShowPreview(true); }}
                                                />
                                            </div>
                                        )}
                                        {payment.status === 'paid' && (
                                            <Button
                                                variant="ghost"
                                                className="flex-1 h-12 bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-slate-800 hover:text-emerald-300 transition-all gap-2"
                                                onClick={(e) => { e.stopPropagation(); generateVoucher(payment); }}
                                            >
                                                <Download className="w-4 h-4" /> Voucher
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Audit/Timeline Column */}
                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center justify-between">
                                            <span className="flex items-center gap-2">
                                                <HistoryIcon className="w-3 h-3" /> Audit History
                                            </span>
                                            <span className="font-mono text-[9px] opacity-50">#{payment.id.slice(0, 6)}</span>
                                        </p>

                                        <div className="space-y-3">
                                            {(payment.audit_timeline || []).slice(-3).map((entry, idx) => (
                                                <div key={idx} className="flex gap-3 text-xs group">
                                                    <div className="flex flex-col items-center gap-1 pt-1">
                                                        <div className="w-2 h-2 rounded-full bg-primary/40 group-last:bg-primary shadow-[0_0_8px_rgba(245,158,11,0.2)]" />
                                                        <div className="w-0.5 flex-1 bg-slate-800 group-last:hidden" />
                                                    </div>
                                                    <div className="flex-1 pb-2">
                                                        <div className="flex justify-between items-center mb-0.5">
                                                            <span className="font-bold text-slate-300">{entry.user_name}</span>
                                                            <span className="text-[9px] text-slate-500">{safeFormat(entry.timestamp, 'dd/MM HH:mm')}</span>
                                                        </div>
                                                        <p className="text-slate-500 text-[10px] line-clamp-1 italic">
                                                            {entry.notes || 'No description provided'}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!payment.audit_timeline || payment.audit_timeline.length === 0) && (
                                                <p className="text-[10px] text-slate-600 italic py-4 text-center">No timeline history available</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            className="flex-1 h-12 bg-slate-900 border border-slate-800 text-slate-400 hover:border-blue-500/50 hover:text-blue-400 transition-all gap-2"
                                            onClick={(e) => { e.stopPropagation(); onViewDetails?.(payment); }}
                                        >
                                            <FileText className="w-4 h-4" /> Full Details
                                        </Button>
                                        {role === 'admin' && (
                                            <Button
                                                variant="ghost"
                                                className="w-12 h-12 bg-slate-900 border border-slate-800 text-slate-500 hover:border-red-500/50 hover:text-red-500 transition-all p-0"
                                                onClick={(e) => { e.stopPropagation(); onDelete?.(payment.id); }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                        {onResubmit && (payment.status === 'rejected' || payment.status.includes('hold')) && (
                                            <Button
                                                variant="ghost"
                                                className="w-12 h-12 bg-slate-900 border border-slate-800 text-amber-500 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all p-0"
                                                onClick={(e) => { e.stopPropagation(); onResubmit(payment.id); }}
                                                title="Quick Resubmit"
                                            >
                                                <HistoryIcon className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <DocumentPreviewModal
                url={previewUrl}
                title={previewTitle}
                open={showPreview}
                onOpenChange={setShowPreview}
            />
        </Card>
    );
}
