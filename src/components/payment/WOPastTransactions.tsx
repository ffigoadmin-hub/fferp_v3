import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Wallet,
    IndianRupee,
    CheckCircle,
    XCircle,
    Clock,
    ArrowUpRight,
    Layers,
    FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface LinkedPayment {
    id: string;
    purpose: string;
    amount: number;
    status: string;
    payment_type: string | null;
    created_at: string;
    vendor_name: string;
    paid_at: string | null;
    utr_number: string | null;
    requester_name: string;
}

interface WOPayment {
    id: string;
    payment_number: number;
    payment_type: string;
    amount: number;
    status: string;
    created_at: string;
    linked_payment_id: string | null;
    actual_amount?: number; // Added to track real payment amount
}

interface WOPastTransactionsProps {
    workOrderId: string;
    currentPaymentId: string;
}

const statusConfig: Record<string, { bg: string; text: string; label: string; Icon: React.ElementType }> = {
    paid: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Paid', Icon: CheckCircle },
    ceo_approved: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'CEO Approved', Icon: CheckCircle },
    admin_approved: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Admin Approved', Icon: ArrowUpRight },
    ceo_audit: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'CEO Audit', Icon: Clock },
    ceo_hold: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'CEO Hold', Icon: Clock },
    rejected: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rejected', Icon: XCircle },
    pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Pending', Icon: Clock },
};

function getStatusStyle(status: string) {
    const s = (status || '').toLowerCase();
    if (statusConfig[s]) return statusConfig[s];
    if (s.includes('approved') || s === 'paid' || s === 'accounts_paid' || s === 'utr_verified') return statusConfig.paid;
    if (s.includes('reject')) return statusConfig.rejected;
    if (s.includes('hold')) return statusConfig.ceo_hold;
    return statusConfig.pending;
}

export function WOPastTransactions({ workOrderId, currentPaymentId }: WOPastTransactionsProps) {
    const [allRequests, setAllRequests] = useState<LinkedPayment[]>([]);
    const [woPayments, setWoPayments] = useState<WOPayment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [woInfo, setWoInfo] = useState<{ wo_number: number; estimated_amount: number } | null>(null);

    useEffect(() => {
        if (!workOrderId) {
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const [paymentRes, woPaymentRes, woRes] = await Promise.all([
                    (supabase as any)
                        .from('payment_requests')
                        .select(`
                            id, purpose, amount, status, payment_type, created_at,
                            vendor_name, paid_at, utr_number,
                            requester:profiles!payment_requests_requester_id_fkey(name)
                        `)
                        .eq('work_order_id', workOrderId)
                        .order('created_at', { ascending: true }),
                    (supabase as any)
                        .from('work_order_payments')
                        .select('id, payment_number, payment_type, amount, status, created_at, linked_payment_id')
                        .eq('work_order_id', workOrderId)
                        .order('payment_number', { ascending: true }),
                    (supabase as any)
                        .from('work_orders')
                        .select('wo_number, estimated_amount')
                        .eq('id', workOrderId)
                        .single(),
                ]);

                if (paymentRes.data && woPaymentRes.data) {
                    const requests: LinkedPayment[] = paymentRes.data.map((p: any) => ({
                        ...p,
                        requester_name: p.requester?.name || 'Unknown',
                    }));
                    setAllRequests(requests);

                    const requestDataMap = new Map<string, LinkedPayment>(requests.map((r) => [r.id, r]));

                    // Create a type-based map for fallback matching (linking by type if ID link is missing)
                    const typeMap = new Map<string, LinkedPayment>();
                    requests.forEach(r => {
                        if (r.payment_type) {
                            // Map the FIRST request of this type found (usually the advance)
                            if (!typeMap.has(r.payment_type.toLowerCase())) {
                                typeMap.set(r.payment_type.toLowerCase(), r);
                            }
                        }
                    });

                    const enrichedWoPayments = woPaymentRes.data.map((wp: any) => {
                        let resolvedStatus = wp.status;
                        let actualAmount = Number(wp.amount);

                        // Try finding match by ID first, then by type
                        const request = wp.linked_payment_id
                            ? requestDataMap.get(wp.linked_payment_id)
                            : typeMap.get(wp.payment_type?.toLowerCase());

                        if (request) {
                            const ls = (request.status || '').toLowerCase();
                            // Expanded definition of "Paid" to catch all completed states
                            if (['paid', 'ceo_approved', 'accounts_paid', 'utr_verified', 'utr_match_verified', 'utr_processed'].includes(ls)) {
                                resolvedStatus = 'paid';
                            } else if (ls === 'rejected') {
                                resolvedStatus = 'rejected';
                            } else {
                                resolvedStatus = 'pending'; // Reflect active request status
                            }
                            // SOURCE OF TRUTH: Use actual amount from request
                            actualAmount = Number(request.amount);
                        }

                        return { ...wp, status: resolvedStatus, actual_amount: actualAmount };
                    });

                    setWoPayments(enrichedWoPayments);
                }

                if (woRes.data) {
                    setWoInfo(woRes.data);
                }
            } catch (err) {
                console.error('Error fetching past transactions:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [workOrderId]);

    // Calculate Summary Stats from ACTUAL Payment Requests (Real Money)
    const { totalPaid, totalInPipeline, accountedRequestIds } = useMemo(() => {
        let paid = 0;
        let pipeline = 0;
        const ids = new Set<string>();

        // We use allRequests as the absolute source of truth for what money is moving
        allRequests.forEach(p => {
            const amt = Number(p.amount) || 0;
            const status = p.status?.toLowerCase() || '';
            const isPaid = ['paid', 'accounts_paid', 'ceo_approved', 'utr_verified'].includes(status);

            if (isPaid) paid += amt;
            else if (status !== 'rejected') pipeline += amt;

            ids.add(p.id);
        });

        return { totalPaid: paid, totalInPipeline: pipeline, accountedRequestIds: ids };
    }, [allRequests]);

    if (isLoading) return null;
    if (allRequests.length === 0 && woPayments.length === 0) return null;

    const woValue = woInfo?.estimated_amount || 0;
    const otherLinkedRequests = allRequests.filter(p => p.id !== currentPaymentId);

    return (
        <Card className="border-violet-500/30 bg-violet-500/5 overflow-hidden">
            <CardHeader className="pb-2 pt-3 px-4 bg-muted/10 border-b border-border/50">
                <CardTitle className="text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-violet-400" />
                        WO Financial History
                    </div>
                    <Badge className="bg-violet-500/20 text-violet-400 border-0 text-[10px]">
                        {allRequests.length} Transactions
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-4 space-y-4">
                {/* Summary Metrics */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="p-2.5 rounded-lg bg-background/50 border border-border/50 text-center">
                        <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-1">WO Value</p>
                        <p className="font-bold text-sm tracking-tight flex items-center justify-center">
                            <IndianRupee className="w-3.5 h-3.5 mr-0.5 text-muted-foreground" />
                            {woValue.toLocaleString('en-IN')}
                        </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                        <p className="text-[9px] text-emerald-500/70 uppercase font-bold tracking-wider mb-1">Total Paid</p>
                        <p className="font-bold text-sm text-emerald-400 tracking-tight flex items-center justify-center">
                            <IndianRupee className="w-3.5 h-3.5 mr-0.5" />
                            {totalPaid.toLocaleString('en-IN')}
                        </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                        <p className="text-[9px] text-blue-500/70 uppercase font-bold tracking-wider mb-1">Pipeline</p>
                        <p className="font-bold text-sm text-blue-400 tracking-tight flex items-center justify-center">
                            <IndianRupee className="w-3.5 h-3.5 mr-0.5" />
                            {(totalInPipeline).toLocaleString('en-IN')}
                        </p>
                    </div>
                </div>

                {/* Status Milestones - Enhanced with Actual Amounts */}
                {woPayments.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 tracking-wide">
                            <Wallet className="w-3 h-3" /> Payment Milestones
                        </p>
                        <div className="grid gap-2">
                            {woPayments.map((wp) => {
                                const style = getStatusStyle(wp.status);
                                const { Icon } = style;
                                return (
                                    <div
                                        key={wp.id}
                                        className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-border/60 text-xs shadow-sm hover:border-violet-500/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center font-mono text-[10px] text-muted-foreground">
                                                {wp.payment_number}
                                            </div>
                                            <div>
                                                <p className="font-semibold capitalize text-[13px]">{wp.payment_type}</p>
                                                <div className="flex items-center mt-0.5">
                                                    <Badge className={cn(style.bg, style.text, 'border-0 text-[10px] h-4.5 px-1.5 flex items-center font-bold')}>
                                                        <Icon className="w-2.5 h-2.5 mr-1" />
                                                        {style.label}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-sm flex items-center justify-end">
                                                <IndianRupee className="w-3 h-3 mr-0.5 text-muted-foreground" />
                                                {(wp.actual_amount || wp.amount).toLocaleString('en-IN')}
                                            </p>
                                            <p className="text-[9px] text-muted-foreground mt-0.5">Realized Amount</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* List of Requests for Context */}
                {otherLinkedRequests.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 tracking-wide">
                            <FileText className="w-3 h-3" /> Transaction Logs
                        </p>
                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                            {otherLinkedRequests.map((lp) => {
                                const style = getStatusStyle(lp.status);
                                const { Icon } = style;
                                return (
                                    <div
                                        key={lp.id}
                                        className="p-3 rounded-lg bg-muted/10 border border-border/40 text-xs hover:bg-muted/20 transition-all border-l-2 border-l-violet-500/50"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold truncate max-w-[180px]">{lp.purpose}</span>
                                            <span className="font-bold text-emerald-400">
                                                <IndianRupee className="w-3 h-3 inline mr-0.5" />
                                                {lp.amount.toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px]">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <span>{format(new Date(lp.created_at), 'dd MMM yyyy')}</span>
                                                <span>•</span>
                                                <span className="text-primary/70">{lp.requester_name}</span>
                                            </div>
                                            <Badge className={cn(style.bg, style.text, 'border-0 text-[9px] h-4')}>
                                                <Icon className="w-2 h-2 mr-1" />
                                                {style.label}
                                            </Badge>
                                        </div>
                                        {lp.utr_number && (
                                            <div className="mt-2 text-[9px] bg-emerald-500/5 p-1 rounded font-mono text-emerald-400 border border-emerald-500/10 flex items-center gap-1">
                                                <CheckCircle className="w-2 h-2" /> UTR: {lp.utr_number}
                                            </div>
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
}
