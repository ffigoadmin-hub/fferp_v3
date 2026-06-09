import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Minus, FileText, AlertCircle, CheckCircle2, TrendingUp, Wallet, ArrowDownToLine, Clock, ExternalLink, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ProjectVariation } from '@/types/financials';
import { cn } from '@/lib/utils';

interface ProjectFinancialsProps {
    projectId: string;
    baseValue: number;
    discountPercentage?: number;
    onUpdate?: () => void;
}

export function ProjectFinancials({ projectId, baseValue, discountPercentage = 0, onUpdate }: ProjectFinancialsProps) {
    const [variations, setVariations] = useState<ProjectVariation[]>([]);
    const [collections, setCollections] = useState<any[]>([]);
    const [totalCollected, setTotalCollected] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isCollectionDialogOpen, setIsCollectionDialogOpen] = useState(false);
    const { toast } = useToast();

    // Form State
    const [formData, setFormData] = useState({
        type: 'addition',
        amount: '',
        category: 'change_order',
        description: ''
    });

    const [collectionFormData, setCollectionFormData] = useState({
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        mode: 'bank_transfer',
        proof_url: '',
        remarks: ''
    });

    const fetchData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Variations
            const variationsRes = await supabase
                .from('project_variations')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false });

            if (variationsRes.error) throw variationsRes.error;
            setVariations((variationsRes.data || []) as any);

            // 2. Fetch Client Collections
            const collectionsRes = await supabase
                .from('client_collections')
                .select('*')
                .eq('project_id', projectId)
                .order('collection_date', { ascending: false });

            if (collectionsRes.error) throw collectionsRes.error;
            setCollections(collectionsRes.data || []);

            const collected = (collectionsRes.data || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
            setTotalCollected(collected);

        } catch (err) {
            console.error('Error fetching financial data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [projectId]);

    const handleSubmit = async () => {
        if (!formData.amount || !formData.description) {
            toast({ title: 'Missing Fields', description: 'Please fill in amount and description', variant: 'destructive' });
            return;
        }

        try {
            const { error } = await supabase.from('project_variations').insert({
                project_id: projectId,
                type: formData.type,
                amount: Number(formData.amount),
                category: formData.category,
                description: formData.description,
                status: 'pending'
            });

            if (error) throw error;

            toast({ title: 'Variation Recorded', description: 'The variation has been submitted for approval.' });
            setIsDialogOpen(false);
            setFormData({ type: 'addition', amount: '', category: 'change_order', description: '' });
            fetchData();
            onUpdate?.();
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to record variation', variant: 'destructive' });
        }
    };

    const handleApprove = async (id: string, status: 'approved' | 'rejected') => {
        try {
            const { error } = await supabase
                .from('project_variations')
                .update({ status, approved_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            toast({ title: `Variation ${status}`, description: `Project value has been updated.` });
            fetchData();
            onUpdate?.();
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
        }
    };

    // Calculations
    const discountAmount = (Number(baseValue) || 0) * (Number(discountPercentage) || 0) / 100;
    const baseAfterDiscount = (Number(baseValue) || 0) - discountAmount;

    const approvedAdditions = variations
        .filter(v => v.status === 'approved' && v.type === 'addition')
        .reduce((sum, v) => sum + Number(v.amount), 0);

    const approvedDeductions = variations
        .filter(v => v.status === 'approved' && v.type === 'deduction')
        .reduce((sum, v) => sum + Number(v.amount), 0);

    const netValue = baseAfterDiscount + approvedAdditions - approvedDeductions;
    const pendingBalance = netValue - totalCollected;

    const handleTransactionSubmit = async () => {
        if (!collectionFormData.amount || !collectionFormData.date) {
            toast({ title: 'Missing Info', description: 'Amount and date are required', variant: 'destructive' });
            return;
        }

        try {
            const { error } = await supabase.from('client_collections').insert({
                project_id: projectId,
                amount: Number(collectionFormData.amount),
                collection_date: collectionFormData.date,
                payment_mode: collectionFormData.mode,
                proof_url: collectionFormData.proof_url || null,
                remarks: collectionFormData.remarks || null
            });

            if (error) throw error;
            toast({ title: 'Collection Added', description: 'Transaction record successfully created.' });
            setIsCollectionDialogOpen(false);
            setCollectionFormData({
                amount: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                mode: 'bank_transfer',
                proof_url: '',
                remarks: ''
            });
            fetchData();
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to record transaction', variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-6">

            {/* Financial Health Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-emerald-500/5 border-emerald-500/10 p-3">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> Net Contract Value
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{(netValue / 100000).toFixed(2)}L</div>
                        <p className="text-xs text-muted-foreground">Revised billable total</p>
                    </CardContent>
                </Card>

                <Card className="bg-emerald-500/5 border-emerald-500/10 p-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-bold text-emerald-500/70 uppercase">Total Collected</p>
                            <h3 className="text-xl font-black font-mono text-emerald-500">₹{totalCollected.toLocaleString()}</h3>
                        </div>
                        <ArrowDownToLine className="w-4 h-4 text-emerald-500/40" />
                    </div>
                </Card>

                <Card className="bg-rose-500/5 border-rose-500/10 p-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-bold text-rose-500/70 uppercase">Total Expenses</p>
                            <h3 className="text-xl font-black font-mono text-rose-500">₹{approvedAdditions.toLocaleString()}</h3>
                        </div>
                        <ShoppingCart className="w-4 h-4 text-rose-500/40" />
                    </div>
                </Card>

                <Card className="bg-blue-500/5 border-blue-500/10 p-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-bold text-blue-500/70 uppercase">Net Contract</p>
                            <h3 className="text-xl font-black font-mono text-blue-500">₹{netValue.toLocaleString()}</h3>
                        </div>
                        <FileText className="w-4 h-4 text-blue-500/40" />
                    </div>
                </Card>

                <Card className="bg-slate-500/5 border-slate-500/10 p-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-bold text-slate-500/70 uppercase">Pending Bal</p>
                            <h3 className="text-xl font-black font-mono text-slate-500">₹{pendingBalance.toLocaleString()}</h3>
                        </div>
                        <Wallet className="w-4 h-4 text-slate-500/40" />
                    </div>
                </Card>
            </div>

            {/* Ledger Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="bg-card/40 border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-4 pt-4">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Plus className="w-4 h-4 text-rose-500" />
                            Contract Variations
                        </CardTitle>
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="gap-2">
                                    <Plus className="w-3 h-3" /> Variation
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-card/95 backdrop-blur-xl border-primary/20">
                                <DialogHeader>
                                    <DialogTitle>Project Variation Request</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Variation Type</Label>
                                            <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="addition">Addition (+)</SelectItem>
                                                    <SelectItem value="deduction">Deduction (-)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Category</Label>
                                            <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="change_order">Change Order</SelectItem>
                                                    <SelectItem value="scope_change">Scope Change</SelectItem>
                                                    <SelectItem value="penalty">Penalty</SelectItem>
                                                    <SelectItem value="incentive">Incentive</SelectItem>
                                                    <SelectItem value="correction">Correction</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Variation Amount (₹)</Label>
                                        <Input
                                            type="number"
                                            placeholder="Enter amount"
                                            value={formData.amount}
                                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Rationale / Description</Label>
                                        <Textarea
                                            placeholder="Why is this change needed?"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="min-h-[100px]"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                                    <Button onClick={handleSubmit}>Submit</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent className="px-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-border/50">
                                        <TableHead className="text-[10px] uppercase">Date</TableHead>
                                        <TableHead className="text-[10px] uppercase text-right">Impact</TableHead>
                                        <TableHead className="text-[10px] uppercase">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-8 text-xs opacity-50">Loading...</TableCell></TableRow>
                                    ) : variations.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-8 text-xs opacity-50 italic">No variations</TableCell></TableRow>
                                    ) : variations.slice(0, 5).map((v) => (
                                        <TableRow key={v.id} className="text-xs">
                                            <TableCell>{format(new Date(v.created_at), 'dd MMM')}</TableCell>
                                            <TableCell className={cn("text-right font-mono font-bold", v.type === 'addition' ? "text-emerald-500" : "text-rose-500")}>
                                                {v.type === 'addition' ? '+' : '-'}₹{(Number(v.amount)).toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={v.status === 'approved' ? 'default' : v.status === 'rejected' ? 'destructive' : 'outline'} className="text-[9px] h-4">
                                                    {v.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Transaction History Section */}
                <Card className="bg-card/40 backdrop-blur-sm border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm uppercase text-emerald-500">
                                <Plus className="w-4 h-4" /> Transaction History
                            </CardTitle>
                        </div>
                        <Dialog open={isCollectionDialogOpen} onOpenChange={setIsCollectionDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="gap-2 border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10">
                                    <Plus className="w-3 h-3" /> Transaction
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-card/95 backdrop-blur-xl border-emerald-500/20">
                                <DialogHeader>
                                    <DialogTitle>Record Client Payment</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Collection Date</Label>
                                            <Input
                                                type="date"
                                                value={collectionFormData.date}
                                                onChange={(e) => setCollectionFormData({ ...collectionFormData, date: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Amount (₹)</Label>
                                            <Input
                                                type="number"
                                                placeholder="Amount received"
                                                value={collectionFormData.amount}
                                                onChange={(e) => setCollectionFormData({ ...collectionFormData, amount: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Payment Mode</Label>
                                        <Select value={collectionFormData.mode} onValueChange={(v) => setCollectionFormData({ ...collectionFormData, mode: v })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                                <SelectItem value="upi">UPI</SelectItem>
                                                <SelectItem value="cash">Cash</SelectItem>
                                                <SelectItem value="cheque">Cheque</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Proof Link (Google Drive / Doc)</Label>
                                        <Input
                                            placeholder="Paste document URL here"
                                            value={collectionFormData.proof_url}
                                            onChange={(e) => setCollectionFormData({ ...collectionFormData, proof_url: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Remarks</Label>
                                        <Textarea
                                            placeholder="e.g. 10% Advance payment"
                                            value={collectionFormData.remarks}
                                            onChange={(e) => setCollectionFormData({ ...collectionFormData, remarks: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setIsCollectionDialogOpen(false)}>Cancel</Button>
                                    <Button onClick={handleTransactionSubmit} className="bg-emerald-600 hover:bg-emerald-700">Record Transaction</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent className="px-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-border/50">
                                        <TableHead className="text-[10px] uppercase">Date</TableHead>
                                        <TableHead className="text-[10px] uppercase">Details</TableHead>
                                        <TableHead className="text-[10px] uppercase text-right">Received</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-8 text-xs opacity-50">Loading...</TableCell></TableRow>
                                    ) : collections.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-8 text-xs opacity-50 italic">No transactions</TableCell></TableRow>
                                    ) : collections.map((c) => (
                                        <TableRow key={c.id} className="text-xs">
                                            <TableCell>{format(new Date(c.collection_date), 'dd MMM')}</TableCell>
                                            <TableCell className="max-w-[150px]">
                                                <div className="font-medium truncate">{c.remarks || 'Client Payment'}</div>
                                                {c.proof_url && (
                                                    <a href={c.proof_url} target="_blank" rel="noreferrer" className="text-primary flex items-center gap-1 hover:underline mt-0.5">
                                                        Proof <ExternalLink className="w-2 h-2" />
                                                    </a>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-bold text-emerald-500">
                                                ₹{(Number(c.amount)).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}
