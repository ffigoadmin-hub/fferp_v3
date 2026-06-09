import { useState, useEffect, useRef, useCallback } from 'react';
import { useWorkOrderAudits } from '@/hooks/useWorkOrderAudits';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    FileSearch,
    CheckCircle,
    XCircle,
    Clock,
    Phone,
    Image,
    FileText,
    AlertTriangle,
    Search,
    IndianRupee,
    ExternalLink,
    FileSignature,
    TrendingUp,
    Banknote,
    CalendarDays,
    User,
    Building,
    Hammer,
    ClipboardCheck,
    Layers,
    LayoutGrid,
    ShieldCheck,
} from 'lucide-react';
import { format } from 'date-fns';

const statusConfig: Record<string, { bg: string; text: string; label: string; icon: React.ElementType }> = {
    pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Pending Review', icon: Clock },
    approved: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Approved', icon: CheckCircle },
    rejected: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rejected', icon: XCircle },
};

interface PaymentTransaction {
    id: string;
    amount: number;
    status: string;
    purpose: string;
    created_at: string;
    tags: string[] | null;
    phase?: { phase_name: string } | null;
}

export default function DataTeamWOAuditPage() {
    const { audits, isLoading, approveAudit, rejectAudit } = useWorkOrderAudits();
    const [search, setSearch] = useState('');
    const [selectedAudit, setSelectedAudit] = useState<any>(null);
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [showApproveDialog, setShowApproveDialog] = useState(false);
    const [approveExplanation, setApproveExplanation] = useState('');
    const [approveProofUrl, setApproveProofUrl] = useState('');
    const [actingId, setActingId] = useState('');
    const [actingWOId, setActingWOId] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [rejectingId, setRejectingId] = useState('');
    const [rejectingWOId, setRejectingWOId] = useState('');
    const [linkedPayments, setLinkedPayments] = useState<PaymentTransaction[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(false);

    // Fetch linked payment transactions when an audit is selected
    const lastPayRefetchRef = useRef<number>(0);

    const fetchLinkedPayments = useCallback(async (woId: string, silent = false) => {
        const now = Date.now();
        if (silent && now - lastPayRefetchRef.current < 2000) return;
        lastPayRefetchRef.current = now;

        if (!silent) setLoadingPayments(true);
        try {
            const { data, error } = await (supabase as any)
                .from('payment_requests')
                .select('id, amount, status, purpose, created_at, tags, phase:project_phases(phase_name)')
                .eq('work_order_id', woId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLinkedPayments(data || []);
        } catch (error) {
            console.error('Error fetching linked payments:', error);
        } finally {
            setLoadingPayments(false);
        }
    }, []);

    useEffect(() => {
        if (!selectedAudit?.work_order_id) {
            setLinkedPayments([]);
            return;
        }

        fetchLinkedPayments(selectedAudit.work_order_id);

        // Real-time listener for THIS SPECIFIC work order's payments
        const channel = supabase
            .channel(`wo-payments-${selectedAudit.work_order_id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'payment_requests',
                    filter: `work_order_id=eq.${selectedAudit.work_order_id}`
                },
                () => {
                    fetchLinkedPayments(selectedAudit.work_order_id, true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedAudit?.work_order_id, fetchLinkedPayments]);

    const filtered = audits.filter((a) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            a.explanation?.toLowerCase().includes(q) ||
            a.work_order?.work_description?.toLowerCase().includes(q) ||
            a.work_order?.wo_number?.toString().includes(q)
        );
    });

    const pendingCount = audits.filter(a => a.audit_status === 'pending').length;
    const approvedCount = audits.filter(a => a.audit_status === 'approved').length;
    const rejectedCount = audits.filter(a => a.audit_status === 'rejected').length;

    const handleReject = async () => {
        if (!rejectReason.trim()) return;
        await rejectAudit(rejectingId, rejectingWOId, rejectReason);
        setShowRejectDialog(false);
        setRejectReason('');
        setRejectingId('');
        setRejectingWOId('');
    };

    const handleApprove = async () => {
        if (!approveExplanation.trim()) return;
        await approveAudit(actingId, actingWOId, approveExplanation, approveProofUrl);
        setShowApproveDialog(false);
        setApproveExplanation('');
        setApproveProofUrl('');
        setActingId('');
        setActingWOId('');
    };

    // Calculate total raised payments for a WO
    const totalRaisedAmount = linkedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const woEstimated = selectedAudit?.work_order?.estimated_amount || 0;
    const remainingAmount = woEstimated - totalRaisedAmount;

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/20">
                    <FileSearch className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Work Order Final Audits</h1>
                    <p className="text-sm text-muted-foreground">
                        Review and approve final payment audits for completed work orders
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="bg-amber-500/10 border-amber-500/20">
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
                        <p className="text-xs text-amber-400/70">Pending</p>
                    </CardContent>
                </Card>
                <Card className="bg-emerald-500/10 border-emerald-500/20">
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-emerald-400">{approvedCount}</p>
                        <p className="text-xs text-emerald-400/70">Approved</p>
                    </CardContent>
                </Card>
                <Card className="bg-red-500/10 border-red-500/20">
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-red-400">{rejectedCount}</p>
                        <p className="text-xs text-red-400/70">Rejected</p>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by WO number, description..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Audit List */}
            {filtered.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="p-12 text-center">
                        <FileSearch className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground">No audits found</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map((audit) => {
                        const status = statusConfig[audit.audit_status] || statusConfig.pending;
                        const StatusIcon = status.icon;
                        const woAmount = audit.work_order?.estimated_amount || 0;

                        return (
                            <Card key={audit.id} className="hover:border-indigo-500/30 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 space-y-2">
                                            {/* Header row */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className="text-xs font-mono">
                                                    WO-{audit.work_order?.wo_number?.toString().padStart(3, '0') || '???'}
                                                </Badge>
                                                <Badge className={`${status.bg} ${status.text} border-0 text-xs`}>
                                                    <StatusIcon className="w-3 h-3 mr-1" />
                                                    {status.label}
                                                </Badge>
                                            </div>

                                            {/* WO Description */}
                                            <p className="text-sm font-medium">
                                                {audit.work_order?.work_description || 'Work Order'}
                                            </p>

                                            {/* Details row */}
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Building className="w-3 h-3" />
                                                    {audit.work_order?.project?.project_name || 'N/A'}
                                                </span>
                                                {audit.work_order?.boq_item?.phase?.phase_name && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1 text-indigo-400">
                                                            <Layers className="w-3 h-3" />
                                                            {audit.work_order.boq_item.phase.phase_name}
                                                        </span>
                                                    </>
                                                )}
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <IndianRupee className="w-3 h-3" />
                                                    ₹{woAmount.toLocaleString('en-IN')}
                                                </span>
                                                {audit.work_order?.signed_document_url && (
                                                    <>
                                                        <span>•</span>
                                                        <a
                                                            href={audit.work_order.signed_document_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-[10px] font-bold text-blue-400 hover:bg-blue-500/20 transition-all shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                                                        >
                                                            <FileSignature className="w-3 h-3" />
                                                            Signed WO
                                                        </a>
                                                    </>
                                                )}
                                            </div>

                                            {/* Explanation preview */}
                                            <div className="bg-muted/30 rounded-lg p-3 text-sm">
                                                <div className="flex items-start gap-2">
                                                    <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                                    <p className="line-clamp-2">{audit.explanation}</p>
                                                </div>
                                            </div>

                                            {/* Evidence indicators + date */}
                                            <div className="flex items-center gap-3">
                                                {audit.image_urls && audit.image_urls.length > 0 && (
                                                    <div className="flex items-center gap-1 text-xs text-purple-400">
                                                        <Image className="w-3 h-3" />
                                                        <span>{audit.image_urls.length} Image{audit.image_urls.length > 1 ? 's' : ''}</span>
                                                    </div>
                                                )}
                                                <span className="text-xs text-muted-foreground ml-auto">
                                                    {format(new Date(audit.created_at), 'dd MMM yyyy, HH:mm')}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-2 shrink-0">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-xs"
                                                onClick={() => setSelectedAudit(audit)}
                                            >
                                                View Details
                                            </Button>
                                            {audit.audit_status === 'pending' && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                                        onClick={() => {
                                                            setActingId(audit.id);
                                                            setActingWOId(audit.work_order_id);
                                                            setShowApproveDialog(true);
                                                        }}
                                                    >
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                                        onClick={() => {
                                                            setRejectingId(audit.id);
                                                            setRejectingWOId(audit.work_order_id);
                                                            setShowRejectDialog(true);
                                                        }}
                                                    >
                                                        <XCircle className="w-3 h-3 mr-1" />
                                                        Reject
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* ─── Detail View Dialog ─── */}
            <Dialog open={!!selectedAudit} onOpenChange={() => setSelectedAudit(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileSearch className="w-5 h-5 text-indigo-400" />
                            Audit Details — WO-{selectedAudit?.work_order?.wo_number?.toString().padStart(3, '0') || '???'}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedAudit && (
                        <div className="space-y-4">
                            {/* ── Work Order Info ── */}
                            <Card className="border-border/50">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Hammer className="w-4 h-4 text-indigo-400" />
                                        Work Order Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm space-y-2">
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                        <div className="col-span-2">
                                            <p className="text-muted-foreground text-xs">Description</p>
                                            <p className="font-medium text-sm">{selectedAudit.work_order?.work_description || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Project</p>
                                            <p className="font-medium flex items-center gap-1.5">
                                                <Building className="w-3.5 h-3.5 text-indigo-400" />
                                                {selectedAudit.work_order?.project?.project_name || 'N/A'}
                                                <span className="text-[10px] text-muted-foreground">({selectedAudit.work_order?.project?.project_id || 'N/A'})</span>
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Project Phase</p>
                                            <p className="font-medium flex items-center gap-1.5">
                                                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                                                {selectedAudit.work_order?.boq_item?.phase?.phase_name || 'General Phase'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Work Order Value</p>
                                            <p className="font-bold text-sm text-indigo-400">
                                                ₹{(selectedAudit.work_order?.estimated_amount || 0).toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Payment Stage</p>
                                            <Badge variant="outline" className="text-[10px] mt-0.5 bg-indigo-500/5">
                                                {selectedAudit.work_order?.payment_stage?.replace(/_/g, ' ')?.toUpperCase() || 'N/A'}
                                            </Badge>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Requester</p>
                                            <p className="font-medium flex items-center gap-1 text-sm">
                                                <User className="w-3 h-3 text-muted-foreground" />
                                                {selectedAudit.work_order?.requester?.name || 'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Total Project Budget</p>
                                            <p className="font-medium text-muted-foreground">
                                                ₹{(selectedAudit.work_order?.project?.total_project_value || 0).toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Signed WO Document */}
                                    {selectedAudit.work_order?.signed_document_url && (
                                        <div className="mt-2 pt-2 border-t border-border/30">
                                            <a
                                                href={selectedAudit.work_order.signed_document_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors text-xs font-medium"
                                            >
                                                <FileSignature className="w-4 h-4" />
                                                View Signed Work Order Document
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* ── Payment Transactions ── */}
                            <Card className="border-border/50">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Banknote className="w-4 h-4 text-emerald-400" />
                                        Payment Transactions
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm space-y-3">
                                    {/* Summary row */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">WO Value</p>
                                            <p className="text-sm font-bold text-white">₹{woEstimated.toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="bg-emerald-500/10 rounded-lg p-2.5 text-center">
                                            <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider">Total Raised</p>
                                            <p className="text-sm font-bold text-emerald-400">₹{totalRaisedAmount.toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className={`rounded-lg p-2.5 text-center ${remainingAmount >= 0 ? 'bg-amber-500/10' : 'bg-red-500/10'}`}>
                                            <p className={`text-[10px] uppercase tracking-wider ${remainingAmount >= 0 ? 'text-amber-400/70' : 'text-red-400/70'}`}>Remaining</p>
                                            <p className={`text-sm font-bold ${remainingAmount >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                                ₹{Math.abs(remainingAmount).toLocaleString('en-IN')}
                                                {remainingAmount < 0 && ' (Over)'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Transaction list */}
                                    {loadingPayments ? (
                                        <div className="flex items-center justify-center py-4">
                                            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                                        </div>
                                    ) : linkedPayments.length === 0 ? (
                                        <div className="text-center py-4 text-muted-foreground text-xs">
                                            No payment transactions linked to this Work Order
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {linkedPayments.map((p) => (
                                                <div key={p.id} className="flex items-center justify-between bg-muted/20 rounded-lg p-2.5 border border-border/20">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium truncate">{p.purpose || 'Payment'}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                <CalendarDays className="w-2.5 h-2.5" />
                                                                {format(new Date(p.created_at), 'dd MMM yyyy')}
                                                            </span>
                                                            {p.phase?.phase_name && (
                                                                <span className="text-[10px] text-indigo-400 flex items-center gap-1">
                                                                    <Layers className="w-2.5 h-2.5" />
                                                                    {p.phase.phase_name}
                                                                </span>
                                                            )}
                                                            {p.tags && p.tags.length > 0 && (
                                                                <span className="text-[10px] text-blue-400">
                                                                    • {p.tags.join(', ')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0 ml-3">
                                                        <p className="text-xs font-bold text-emerald-400">₹{(p.amount || 0).toLocaleString('en-IN')}</p>
                                                        <Badge variant="outline" className="text-[9px] mt-0.5">
                                                            {p.status?.replace(/_/g, ' ')?.toUpperCase()}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Progress bar */}
                                    {woEstimated > 0 && (
                                        <div className="pt-1">
                                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                                                <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Payment Progress</span>
                                                <span>{Math.min(100, Math.round((totalRaisedAmount / woEstimated) * 100))}%</span>
                                            </div>
                                            <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                                                    style={{ width: `${Math.min(100, (totalRaisedAmount / woEstimated) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* ── Audit Explanation & Evidence ── */}
                            <Card className="border-border/50">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-amber-400" />
                                        Audit Submission
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm space-y-3">
                                    <div>
                                        <p className="font-medium text-muted-foreground mb-1 text-xs">Explanation</p>
                                        <p className="whitespace-pre-wrap bg-muted/30 p-3 rounded-lg">
                                            {selectedAudit.explanation}
                                        </p>
                                    </div>



                                    {selectedAudit.image_urls && selectedAudit.image_urls.length > 0 && (
                                        <div>
                                            <p className="font-medium text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                                                <Image className="w-3.5 h-3.5" /> Evidence Images
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {selectedAudit.image_urls.map((url: string, i: number) => (
                                                    <img
                                                        key={i}
                                                        src={url}
                                                        alt={`Evidence ${i + 1}`}
                                                        className="rounded-lg border w-full h-40 object-cover"
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedAudit.audit_remarks && (
                                        <div>
                                            <p className="font-medium text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                                                <AlertTriangle className="w-3.5 h-3.5" /> Data Team Review Explanation
                                            </p>
                                            <p className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg">
                                                {selectedAudit.audit_remarks}
                                            </p>
                                        </div>
                                    )}

                                    {selectedAudit.approval_proof_url && (
                                        <div>
                                            <p className="font-medium text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                                                <ClipboardCheck className="w-3.5 h-3.5" /> Approval Proof
                                            </p>
                                            <a
                                                href={selectedAudit.approval_proof_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-xs font-medium"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                View Official Audit Proof Document
                                            </a>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/30">
                                        <span className="flex items-center gap-1">
                                            <User className="w-3 h-3 text-indigo-400" />
                                            Raised by: <span className="font-bold text-foreground">{selectedAudit.requester?.name || 'Unknown'}</span>
                                        </span>
                                        {selectedAudit.auditor && (
                                            <>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                                    Audited by: <span className="font-bold text-emerald-400">{selectedAudit.auditor.name}</span>
                                                </span>
                                            </>
                                        )}
                                        <span className="ml-auto flex items-center gap-1">
                                            <CalendarDays className="w-3 h-3" />
                                            {format(new Date(selectedAudit.created_at), 'dd MMM yyyy, HH:mm')}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Approve Dialog */}
            <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-400">
                            <CheckCircle className="w-5 h-5" />
                            Approve Work Order Audit
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Audit Explanation (Mandatory)</label>
                            <Textarea
                                placeholder="Explain findings and audit details..."
                                value={approveExplanation}
                                onChange={(e) => setApproveExplanation(e.target.value)}
                                rows={3}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Proof of Audit URL (Mandatory)</label>
                            <Input
                                placeholder="Link to documentation, report or proof..."
                                value={approveProofUrl}
                                onChange={(e) => setApproveProofUrl(e.target.value)}
                            />
                            <p className="text-[10px] text-muted-foreground">Provide a link to the official audit document or external proof.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handleApprove}
                            disabled={!approveExplanation.trim() || !approveProofUrl.trim()}
                        >
                            Confirm Approval
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-400">
                            <XCircle className="w-5 h-5" />
                            Reject Audit
                        </DialogTitle>
                    </DialogHeader>
                    <Textarea
                        placeholder="Reason for rejection..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={4}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={!rejectReason.trim()}
                        >
                            Reject
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
