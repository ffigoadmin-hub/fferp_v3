import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    ShieldCheck,
    Check,
    X,
    FileText,
    ExternalLink,
    IndianRupee,
    User,
    Building2,
    Clock,
    Banknote,
    CreditCard,
    FolderKanban,
    AlertCircle,
    Camera
} from 'lucide-react';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { useProjects } from '@/hooks/useProjects';
import { useRealtimePayments } from '@/hooks/useRealtimePayments';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { differenceInHours, format } from 'date-fns';

const urgencyConfig: Record<string, { bg: string; border: string; text: string; label: string }> = {
    emergency: { bg: 'bg-status-missed/10', border: 'border-status-missed/40', text: 'text-status-missed', label: '🔴 EMERGENCY' },
    important: { bg: 'bg-status-late/10', border: 'border-status-late/40', text: 'text-status-late', label: '🟡 IMPORTANT' },
    normal: { bg: 'bg-status-live/10', border: 'border-status-live/40', text: 'text-status-live', label: '🟢 NORMAL' },
};

export default function AuditorPaymentAuditPage() {
    const { requests, isLoading, refresh: refetch } = useRealtimePayments(['auditor_audit']);
    const { updateStatus, isSaving } = usePaymentRequests({ skipFetch: true }); // For actions only
    const { projects } = useProjects();
    const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const handleVerify = async (id: string) => {
        const result = await updateStatus(id, 'admin_audit');
        if (result.success) {
            toast.success('Payment verified and moved to Admin Audit');
            setSelectedPayment(null);
        }
    };

    const handleReject = async (id: string) => {
        if (!rejectionReason.trim()) {
            toast.error('Rejection reason is mandatory');
            return;
        }
        const result = await updateStatus(id, 'rejected', { rejectionReason });
        if (result.success) {
            toast.success('Payment rejected and returned to requester');
            setSelectedPayment(null);
            setRejectionReason('');
        }
    };

    const getProjectDetails = (projectId: string | null | undefined) => {
        if (!projectId) return null;
        return projects.find(p => p.id === projectId);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground animate-pulse font-medium">Loading Farmers Factory requests...</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-7xl mx-auto p-4 md:p-8 space-y-8"
        >
            {/* Header Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-authority-admin/15 via-background to-background p-8 border border-authority-admin/20 shadow-xl">
                <div className="absolute top-0 right-0 -m-12 w-64 h-64 bg-authority-admin/10 rounded-full blur-3xl" />
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-4 rounded-2xl bg-authority-admin/10 border border-authority-admin/20 shadow-inner">
                            <ShieldCheck className="w-8 h-8 text-authority-admin" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-foreground">Farmers Factory Audit</h1>
                            <p className="text-muted-foreground font-medium flex items-center gap-2">
                                Verification Pipeline <span className="w-1.5 h-1.5 rounded-full bg-authority-admin animate-pulse" /> Auditor Mode
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-background/50 backdrop-blur-md p-4 rounded-2xl border border-border shadow-sm">
                        <div className="text-center px-4 border-r">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Queue Total</p>
                            <p className="text-2xl font-black text-authority-admin">{requests.length}</p>
                        </div>
                        <div className="px-4">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                            <Badge variant="outline" className="bg-authority-admin/10 text-authority-admin border-authority-admin/30 font-bold uppercase">Active</Badge>
                        </div>
                    </div>
                </div>
            </div>

            {/* Checklist Alert */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-4 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 text-blue-600 shadow-sm"
            >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-semibold truncate">Ensure all Google Drive links are accessible and match the requested amount before verification.</p>
            </motion.div>

            {/* Requests List */}
            <div className="grid gap-6">
                {requests.map((payment, index) => {
                    const urgencyStyle = urgencyConfig[payment.urgency] || urgencyConfig.normal;
                    const hoursUntilCutoff = differenceInHours(new Date(`${payment.cutoff_date}T${payment.cutoff_time}`), new Date());
                    const isExpanded = selectedPayment === payment.id;
                    const project = getProjectDetails(payment.project_id);
                    const paymentType = payment.payment_type || 'bank_account';

                    return (
                        <motion.div
                            key={payment.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                                'group relative overflow-hidden rounded-2xl bg-card border border-border/50 hover:border-authority-admin/40 transition-all duration-300 shadow-sm hover:shadow-xl',
                                isExpanded && 'ring-2 ring-authority-admin/30 border-authority-admin/50'
                            )}
                        >
                            <div className={cn('absolute top-0 left-0 w-1.5 h-full', urgencyStyle.text.replace('text-', 'bg-'))} />

                            <div
                                className="p-6 cursor-pointer select-none"
                                onClick={() => setSelectedPayment(isExpanded ? null : payment.id)}
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex items-start gap-5">
                                        <div className={cn('px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase shadow-sm', urgencyStyle.bg, urgencyStyle.text)}>
                                            {payment.urgency}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold group-hover:text-authority-admin transition-colors">{payment.purpose}</h3>
                                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                                <span className="font-semibold text-foreground/70">{payment.vendor_name}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {payment.requester?.name || 'Unknown'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8">
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Amount</p>
                                            <p className="text-2xl font-black flex items-center justify-end text-authority-admin">
                                                <IndianRupee className="w-4 h-4" />{Number(payment.amount).toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                        <div className={cn(
                                            'w-16 h-16 rounded-2xl flex flex-col items-center justify-center border shadow-inner transition-all',
                                            hoursUntilCutoff <= 24 ? 'bg-status-missed/10 border-status-missed/20 text-status-missed' : 'bg-muted/30 border-border/50'
                                        )}>
                                            <p className="text-[10px] font-bold uppercase opacity-60">Timer</p>
                                            <p className="text-lg font-black">{hoursUntilCutoff}h</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {isExpanded && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="px-6 pb-6 pt-2 space-y-6 border-t border-border/50 bg-muted/5"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {/* Identification */}
                                        <div className="p-4 rounded-xl bg-background border shadow-sm">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Identification</p>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-muted-foreground">Payment ID</span>
                                                    <Badge variant="outline" className="font-mono text-[10px]">PAY-{String(payment.payment_number).padStart(4, '0')}</Badge>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-muted-foreground">Type</span>
                                                    <Badge variant="secondary" className="text-[10px] uppercase font-bold">{paymentType.replace('_', ' ')}</Badge>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-muted-foreground">Department</span>
                                                    <Badge variant="outline" className="text-[10px] uppercase font-bold border-authority-admin/40 text-authority-admin">{payment.department?.replace('_', ' ')}</Badge>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Timeline */}
                                        <div className="p-4 rounded-xl bg-background border shadow-sm">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Submission Timeline</p>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                                    <div>
                                                        <p className="text-xs font-bold leading-none">{format(new Date(payment.created_at), 'dd MMM yyyy')}</p>
                                                        <p className="text-[10px] text-muted-foreground">{format(new Date(payment.created_at), 'HH:mm')}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Clock className="w-4 h-4 text-authority-admin" />
                                                    <div>
                                                        <p className="text-xs font-bold leading-none">{format(new Date(payment.cutoff_date), 'dd MMM yyyy')}</p>
                                                        <p className="text-[10px] text-authority-admin">Cut-off Target</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Project/Work Order */}
                                        <div className="p-4 rounded-xl bg-background border shadow-sm">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Project Correlation</p>
                                            {payment.is_project_work ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-3">
                                                        <FolderKanban className="w-4 h-4 text-primary" />
                                                        <p className="text-xs font-bold truncate">{project?.project_name || 'Project Reference Not Found'}</p>
                                                    </div>
                                                    {payment.wo_number && (
                                                        <Badge variant="outline" className="w-full justify-center text-[10px] font-mono border-primary/30 text-primary">WO-{payment.wo_number}</Badge>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center h-full">
                                                    <p className="text-xs text-muted-foreground italic">Non-Project Expense</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Payment Details Card */}
                                    <div className="p-5 rounded-2xl bg-authority-admin/5 border border-authority-admin/15 shadow-inner">
                                        <h4 className="text-xs font-black text-authority-admin uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                            {paymentType === 'upi' ? <CreditCard className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                                            Financial Destination Details
                                        </h4>

                                        {paymentType === 'upi' ? (
                                            <div className="flex flex-col md:flex-row gap-8">
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">UPI Identifier</p>
                                                    <p className="font-mono font-black text-lg text-foreground tracking-tight underline decoration-authority-admin/30 underline-offset-4">
                                                        {payment.vendor_upi || payment.vendor_bank_details}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Payee Name</p>
                                                    <p className="font-bold text-foreground">{payment.beneficiary_name || payment.vendor_name}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Account Number</p>
                                                    <p className="font-mono font-black text-foreground tracking-widest">
                                                        {payment.vendor_account_number || payment.vendor_bank_details}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">IFSC Code</p>
                                                    <p className="font-mono font-bold text-authority-admin">{payment.vendor_ifsc_code || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Beneficiary</p>
                                                    <p className="font-bold text-foreground truncate">{payment.beneficiary_name || payment.vendor_name}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Proof Links */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <a
                                            href={payment.bill_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group/link flex items-center justify-between p-4 rounded-xl bg-background border hover:border-primary/40 hover:shadow-lg transition-all duration-300"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover/link:bg-primary group-hover/link:text-white transition-colors">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold">Invoices & Bills</p>
                                                    <p className="text-[10px] text-muted-foreground">Verified Proof Folder</p>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover/link:text-primary transition-colors" />
                                        </a>

                                        <a
                                            href={payment.work_proof_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group/link flex items-center justify-between p-4 rounded-xl bg-background border hover:border-primary/40 hover:shadow-lg transition-all duration-300"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 rounded-lg bg-green-500/10 text-green-600 group-hover/link:bg-green-500 group-hover/link:text-white transition-colors">
                                                    <Camera className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold">Work Verification</p>
                                                    <p className="text-[10px] text-muted-foreground">Site Execution Evidence</p>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover/link:text-primary transition-colors" />
                                        </a>
                                    </div>

                                    {/* Audit Actions */}
                                    <div className="space-y-4 pt-4 border-t border-border/50">
                                        <Textarea
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            placeholder="Reason for rejection (e.g. Blurry photo, Incomplete work proof)..."
                                            className="bg-background/80 focus:ring-authority-admin/30 resize-none min-h-[100px]"
                                        />
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <Button
                                                onClick={() => handleVerify(payment.id)}
                                                disabled={isSaving}
                                                className="flex-1 h-12 rounded-xl bg-authority-admin hover:bg-authority-admin/90 font-black shadow-lg shadow-authority-admin/20 transition-all active:scale-95 translate-y-0 hover:-translate-y-1"
                                            >
                                                <Check className="w-5 h-5 mr-2" /> VERIFY & ESCALATE TO ADMIN
                                            </Button>
                                            <Button
                                                onClick={() => handleReject(payment.id)}
                                                disabled={isSaving}
                                                variant="destructive"
                                                className="flex-shrink-0 h-12 rounded-xl font-bold px-8 transition-all active:scale-95"
                                            >
                                                <X className="w-5 h-5 mr-2" /> REJECT
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    );
                })}

                {requests.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-4 rounded-[2.5rem] bg-muted/20 border-2 border-dashed border-border/50"
                    >
                        <div className="w-20 h-20 rounded-full bg-authority-admin/10 flex items-center justify-center text-authority-admin/30">
                            <ShieldCheck className="w-10 h-10" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-foreground/80">Audit Queue Clear</h3>
                            <p className="text-muted-foreground max-w-xs mx-auto">All Farmers Factory payments have been verified or addressed.</p>
                        </div>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}
