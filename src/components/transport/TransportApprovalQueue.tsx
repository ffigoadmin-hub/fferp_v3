import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useTransportExpenses } from '@/hooks/useTransportExpenses';
import { getTransportStatusColor, getTransportStatusLabel, getCategoryColor, type TransportExpenseRow } from '@/lib/transportHelpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
    CheckCircle, XCircle, IndianRupee, MapPin, Truck,
    Calendar, User, ExternalLink, CreditCard, Loader2
} from 'lucide-react';

interface Props {
    statusFilter: string;
}

export function TransportApprovalQueue({ statusFilter }: Props) {
    const { user } = useAuth();
    const role = user?.role?.toLowerCase() || '';
    const { expenses, isLoading, approveExpense, rejectExpense, markAsPaid, isSaving } = useTransportExpenses({
        status: statusFilter !== 'all' ? statusFilter : undefined,
    });

    const [selectedExpense, setSelectedExpense] = useState<TransportExpenseRow | null>(null);
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [showPayDialog, setShowPayDialog] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [utrNumber, setUtrNumber] = useState('');
    const [paymentMode, setPaymentMode] = useState('');
    const [paymentRemarks, setPaymentRemarks] = useState('');

    const canApprove = (expense: TransportExpenseRow) => {
        if (expense.status === 'pending' && ['director', 'nsm', 'gm', 'gmo', 'smo', 'boi'].includes(role)) return true;
        if (expense.status === 'dept_head_approved' && role === 'admin') return true;
        if (expense.status === 'admin_approved' && role === 'accounts') return true;
        return false;
    };

    const canMarkPaid = (expense: TransportExpenseRow) => {
        return (expense.status === 'accounts_approved' || expense.status === 'admin_approved') && role === 'accounts';
    };

    const canReject = (expense: TransportExpenseRow) => {
        return ['admin', 'accounts', 'director', 'nsm', 'gm', 'gmo', 'smo', 'boi'].includes(role) && !['paid', 'rejected'].includes(expense.status);
    };

    const handleApprove = async (id: string) => {
        await approveExpense(id);
    };

    const handleReject = async () => {
        if (!selectedExpense || !rejectReason.trim()) return;
        await rejectExpense(selectedExpense.id, rejectReason);
        setShowRejectDialog(false);
        setRejectReason('');
        setSelectedExpense(null);
    };

    const handleMarkPaid = async () => {
        if (!selectedExpense) return;
        await markAsPaid(selectedExpense.id, {
            paymentDate,
            utrNumber: utrNumber || undefined,
            paymentMode: paymentMode || undefined,
            remarks: paymentRemarks || undefined,
        });
        setShowPayDialog(false);
        setSelectedExpense(null);
        setUtrNumber('');
        setPaymentMode('');
        setPaymentRemarks('');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (expenses.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Truck className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">No transport expenses found</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-3">
                {expenses.map((expense, idx) => (
                    <motion.div
                        key={expense.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-all"
                    >
                        {/* Top: Route + Amount */}
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0"
                                        style={{ borderColor: getCategoryColor(expense.category_code), color: getCategoryColor(expense.category_code) }}
                                    >
                                        {expense.category_code.toUpperCase()}
                                    </Badge>
                                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getTransportStatusColor(expense.status))}>
                                        {getTransportStatusLabel(expense.status)}
                                    </Badge>
                                    {expense.is_batch_entry && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-400">BATCH</Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 text-sm font-medium">
                                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <span className="truncate">{expense.from_location}</span>
                                    <span className="text-muted-foreground">→</span>
                                    <span className="truncate">{expense.to_location}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{expense.purpose}</p>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                                <p className="text-lg font-bold flex items-center justify-end">
                                    <IndianRupee className="w-3.5 h-3.5" />{expense.total_amount.toLocaleString('en-IN')}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                    {expense.total_km} km × ₹{expense.rate_per_km}
                                </p>
                            </div>
                        </div>

                        {/* Meta Row */}
                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground mb-3">
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(expense.trip_date), 'dd MMM yyyy')}
                            </span>
                            <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {expense.creator?.name || 'Unknown'}
                            </span>
                            {expense.vendor_name && (
                                <span className="flex items-center gap-1">
                                    <Truck className="w-3 h-3" />{expense.vendor_name}
                                </span>
                            )}
                            {expense.proof_file_url && (
                                <a href={expense.proof_file_url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-primary hover:underline">
                                    <ExternalLink className="w-3 h-3" />Proof
                                </a>
                            )}
                        </div>

                        {/* Rejection reason if applicable */}
                        {expense.status === 'rejected' && expense.rejection_reason && (
                            <div className="p-2 rounded-lg bg-red-500/5 border border-red-500/20 mb-3">
                                <p className="text-xs text-red-400"><strong>Rejected:</strong> {expense.rejection_reason}</p>
                            </div>
                        )}

                        {/* Payment info if paid */}
                        {expense.status === 'paid' && expense.utr_number && (
                            <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 mb-3">
                                <p className="text-xs text-emerald-400">
                                    <CreditCard className="w-3 h-3 inline mr-1" />
                                    UTR: {expense.utr_number}
                                    {expense.payment_date && ` | ${format(new Date(expense.payment_date), 'dd MMM yyyy')}`}
                                </p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            {canApprove(expense) && (
                                <Button size="sm" className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700" disabled={isSaving}
                                    onClick={() => handleApprove(expense.id)}>
                                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                                </Button>
                            )}
                            {canMarkPaid(expense) && (
                                <Button size="sm" className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700" disabled={isSaving}
                                    onClick={() => { setSelectedExpense(expense); setShowPayDialog(true); }}>
                                    <CreditCard className="w-3.5 h-3.5" /> Mark Paid
                                </Button>
                            )}
                            {canReject(expense) && (
                                <Button size="sm" variant="outline" className="h-8 gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10" disabled={isSaving}
                                    onClick={() => { setSelectedExpense(expense); setShowRejectDialog(true); }}>
                                    <XCircle className="w-3.5 h-3.5" /> Reject
                                </Button>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Reject Dialog */}
            <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Transport Expense</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Label>Reason for rejection *</Label>
                        <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Provide a reason..." rows={3} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reject'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Mark as Paid Dialog */}
            <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Mark as Paid</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Payment Date *</Label>
                            <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">UTR Number</Label>
                            <Input value={utrNumber} onChange={e => setUtrNumber(e.target.value)} placeholder="Transaction reference" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Payment Mode</Label>
                            <Input value={paymentMode} onChange={e => setPaymentMode(e.target.value)} placeholder="e.g., UPI, NEFT, Cash" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Remarks</Label>
                            <Textarea value={paymentRemarks} onChange={e => setPaymentRemarks(e.target.value)} placeholder="Optional remarks" rows={2} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPayDialog(false)}>Cancel</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleMarkPaid} disabled={!paymentDate || isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Payment'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
