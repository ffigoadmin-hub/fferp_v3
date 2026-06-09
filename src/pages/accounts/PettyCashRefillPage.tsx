import React, { useState } from 'react';
import { usePettyCashReports } from '@/hooks/usePettyCashReports';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, Clock, Plus, Banknote, AlertTriangle } from 'lucide-react';

const PettyCashRefillPage = () => {
    const { refillRequests, isLoading, updateRefillStatus, createManualRefillRequest } = usePettyCashReports();

    const [manualDialogOpen, setManualDialogOpen] = useState(false);
    const [manualAmount, setManualAmount] = useState('10000');
    const [manualNotes, setManualNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed': return <Badge className="bg-emerald-500 text-white">Completed</Badge>;
            case 'pending_director': return <Badge variant="outline" className="text-amber-600 border-amber-600">Pending Director</Badge>;
            case 'director_approved': return <Badge variant="outline" className="text-blue-600 border-blue-600">Director Approved</Badge>;
            case 'admin_approved': return <Badge variant="outline" className="text-indigo-600 border-indigo-600">Admin Approved</Badge>;
            case 'ceo_approved': return <Badge variant="outline" className="text-purple-600 border-purple-600">CEO Approved</Badge>;
            case 'accounts_executed': return <Badge className="bg-blue-500 text-white">Executed</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const handleCreateManualRequest = async () => {
        const amount = parseFloat(manualAmount);
        if (!amount || amount <= 0) return;
        setIsSubmitting(true);
        const result = await createManualRefillRequest(amount, manualNotes || undefined);
        if (result.success) {
            setManualDialogOpen(false);
            setManualAmount('10000');
            setManualNotes('');
        }
        setIsSubmitting(false);
    };

    const pendingRequests = refillRequests.filter(r => r.status !== 'completed');
    const completedRequests = refillRequests.filter(r => r.status === 'completed');

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Petty Cash Refill</h1>
                    <p className="text-muted-foreground">Manage and track petty cash refill requests</p>
                </div>
                <Button className="gap-2" onClick={() => setManualDialogOpen(true)}>
                    <Plus className="w-4 h-4" /> New Manual Request
                </Button>
            </div>

            {/* Active Requests */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-amber-500" /> Active Refill Queue
                        {pendingRequests.length > 0 && (
                            <Badge className="ml-2 bg-amber-100 text-amber-700 border-amber-300" variant="outline">
                                {pendingRequests.length} active
                            </Badge>
                        )}
                    </CardTitle>
                    <CardDescription>Pending and in-progress refill requests going through approval chain</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Refill #</TableHead>
                                <TableHead>Requested Amount</TableHead>
                                <TableHead>Balance at Request</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pendingRequests.map((refill) => (
                                <TableRow key={refill.id}>
                                    <TableCell className="font-bold font-mono">RF-{refill.refill_number.toString().padStart(3, '0')}</TableCell>
                                    <TableCell className="text-emerald-600 font-bold">₹{refill.requested_amount.toLocaleString()}</TableCell>
                                    <TableCell className={refill.current_balance < 550 ? 'text-destructive font-bold' : ''}>
                                        ₹{refill.current_balance.toLocaleString()}
                                        {refill.current_balance < 550 && <AlertTriangle className="inline w-3 h-3 ml-1" />}
                                    </TableCell>
                                    <TableCell>{getStatusBadge(refill.status)}</TableCell>
                                    <TableCell>{format(parseISO(refill.created_at), 'dd MMM yyyy')}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{refill.notes || '—'}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {refill.status === 'pending_director' && (
                                                <Button variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => updateRefillStatus(refill.id, 'director_approved')}>
                                                    Approve
                                                </Button>
                                            )}
                                            {refill.status === 'ceo_approved' && (
                                                <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => updateRefillStatus(refill.id, 'accounts_executed')}>
                                                    Mark Executed
                                                </Button>
                                            )}
                                            {refill.status === 'accounts_executed' && (
                                                <Button variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => updateRefillStatus(refill.id, 'completed')}>
                                                    Mark Complete
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {pendingRequests.length === 0 && !isLoading && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                                            <p>No active refill requests. All systems balanced.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Completed Requests */}
            {completedRequests.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Completed Refills
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Refill #</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {completedRequests.map((refill) => (
                                    <TableRow key={refill.id} className="opacity-60">
                                        <TableCell className="font-bold font-mono">RF-{refill.refill_number.toString().padStart(3, '0')}</TableCell>
                                        <TableCell className="font-bold">₹{refill.requested_amount.toLocaleString()}</TableCell>
                                        <TableCell>{format(parseISO(refill.created_at), 'dd MMM yyyy')}</TableCell>
                                        <TableCell>{getStatusBadge(refill.status)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* New Manual Request Dialog */}
            <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Banknote className="w-5 h-5 text-primary" /> New Manual Refill Request
                        </DialogTitle>
                        <DialogDescription>
                            Create a refill request that will go through the full approval chain (Director → Admin → CEO).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <Label htmlFor="refill-amount">Requested Amount (₹)</Label>
                            <Input
                                id="refill-amount"
                                type="number"
                                min="1"
                                value={manualAmount}
                                onChange={e => setManualAmount(e.target.value)}
                                placeholder="10000"
                                className="mt-1 font-mono text-lg"
                            />
                        </div>
                        <div>
                            <Label htmlFor="refill-notes">Notes (optional)</Label>
                            <Textarea
                                id="refill-notes"
                                value={manualNotes}
                                onChange={e => setManualNotes(e.target.value)}
                                placeholder="Reason for manual refill request..."
                                className="mt-1 text-sm"
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setManualDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleCreateManualRequest}
                            disabled={isSubmitting || !manualAmount || parseFloat(manualAmount) <= 0}
                        >
                            {isSubmitting ? 'Creating...' : 'Submit Request'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PettyCashRefillPage;
