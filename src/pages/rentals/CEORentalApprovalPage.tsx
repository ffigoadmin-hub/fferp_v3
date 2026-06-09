import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, AlertCircle, Building2, MapPin, Calendar, FileText, Zap, ExternalLink, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { RentalStatusBadge } from '@/components/rental/RentalStatusBadge';
import { RentalDiscussionPanel } from '@/components/rental/RentalDiscussionPanel';

export default function CEORentalApprovalPage() {
    const queryClient = useQueryClient();
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [isDiscussionOpen, setIsDiscussionOpen] = useState(false);
    const [discussionRecordId, setDiscussionRecordId] = useState<string | null>(null);

    // Fetch pending approvals
    const { data: records, isLoading } = useQuery({
        queryKey: ['ceo-rental-approvals'],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from('rental_monthly_records')
                .select(`
                    *,
                    rental_properties!inner(title, location, owner_name, farm_name, rental_categories!inner(name, owner_role))
                `)
                .eq('status', 'RAISED_FOR_APPROVAL')
                .order('created_at', { ascending: true }); // Oldest first
            if (error) throw error;
            return data;
        },
    });

    const approveMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase as any)
                .from('rental_monthly_records')
                .update({ status: 'APPROVED_BY_CEO' } as any)
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ceo-rental-approvals'] });
            toast.success('Rental Payment Approved');
        },
        onError: (err) => toast.error(err.message)
    });

    const rejectMutation = useMutation({
        mutationFn: async () => {
            const { error } = await (supabase as any)
                .from('rental_monthly_records')
                .update({ status: 'REJECTED', rejection_reason: rejectionReason } as any)
                .eq('id', selectedRecord.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ceo-rental-approvals'] });
            toast.error('Rental Payment Rejected');
            setIsRejectDialogOpen(false);
            setRejectionReason('');
        },
        onError: (err) => toast.error(err.message)
    });

    // Bulk Approve
    const bulkApproveMutation = useMutation({
        mutationFn: async () => {
            const ids = records?.map((r: any) => r.id) || [];
            if (ids.length === 0) return;
            const { error } = await (supabase as any).from('rental_monthly_records').update({ status: 'APPROVED_BY_CEO' } as any).in('id', ids);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ceo-rental-approvals'] });
            toast.success('All Pending Requests Approved');
        }
    });

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6 pb-20"
        >
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">Rental Approvals</h1>
                    <p className="text-muted-foreground font-medium">Review and approve monthly rental payouts.</p>
                </div>
                {records?.length > 0 && (
                    <Button
                        size="lg"
                        className="bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 font-bold"
                        onClick={() => {
                            if (confirm(`Approve all ${records.length} pending requests totaling ₹${records.reduce((acc: number, r: any) => acc + r.net_payable_amount, 0).toLocaleString()}?`)) {
                                bulkApproveMutation.mutate();
                            }
                        }}
                    >
                        <CheckCircle2 className="w-5 h-5 mr-2" /> Approve All ({records.length})
                    </Button>
                )}
            </div>

            {isLoading ? (
                <div className="p-20 text-center text-muted-foreground">Loading approvals...</div>
            ) : records?.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed rounded-2xl bg-muted/20">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4 opacity-50" />
                    <h3 className="text-xl font-bold">All caught up!</h3>
                    <p className="text-muted-foreground">No pending rental approvals.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {records?.map((record: any) => (
                        <Card key={record.id} className="border-l-4 border-l-amber-500 hover:shadow-lg transition-all duration-300">
                            <CardContent className="p-6">
                                <div className="flex flex-col md:flex-row gap-6">
                                    {/* Left: Property Details */}
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <Badge variant="outline" className="mb-2 bg-background">{record.rental_properties.rental_categories.name}</Badge>
                                                <h3 className="text-xl font-bold flex items-center gap-2">
                                                    {record.rental_properties.title}
                                                </h3>
                                                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                                    <MapPin className="w-3 h-3" /> {record.rental_properties.location}
                                                </p>
                                                <p className="text-sm text-muted-foreground font-medium mt-1">
                                                    Owner: <span className="text-foreground">{record.rental_properties.owner_name}</span>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4 p-3 bg-muted/50 rounded-lg border border-border/50 text-sm">
                                            <div>
                                                <span className="text-muted-foreground text-[10px] uppercase font-bold">Period</span>
                                                <p className="font-bold">{format(new Date(record.month_year), 'MMM yyyy')}</p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground text-[10px] uppercase font-bold">Base Rent</span>
                                                <p className="font-mono">₹{record.base_rent.toLocaleString()}</p>
                                            </div>
                                            {((record.electricity_bill_amount || 0) + (record.addition_total || 0)) > 0 && (
                                                <div>
                                                    <span className="text-muted-foreground text-[10px] uppercase font-bold">Additions</span>
                                                    <p className="font-mono text-emerald-600">+₹{((record.electricity_bill_amount || 0) + (record.addition_total || 0)).toLocaleString()}</p>
                                                </div>
                                            )}
                                            {record.deduction_total > 0 && (
                                                <div>
                                                    <span className="text-muted-foreground text-[10px] uppercase font-bold">Deductions</span>
                                                    <p className="font-mono text-destructive">-₹{record.deduction_total.toLocaleString()}</p>
                                                </div>
                                            )}
                                        </div>

                                        {(record.electricity_bill_proof_url || record.deduction_total > 0) && (
                                            <div className="flex gap-2">
                                                {record.electricity_bill_proof_url && (
                                                    <a href={record.electricity_bill_proof_url} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 text-blue-500 hover:underline">
                                                        <FileText className="w-3 h-3" /> View Proof Folder
                                                    </a>
                                                )}
                                                {/* We can iterate deductions if we fetch them, for now showing general indicator */}
                                                {record.deduction_total > 0 && (
                                                    <span className="text-xs flex items-center gap-1 text-amber-500">
                                                        <AlertCircle className="w-3 h-3" /> Has Deductions
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: Actions & Total */}
                                    <div className="flex flex-col items-end justify-between border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6 min-w-[200px]">
                                        <div className="text-right">
                                            <p className="text-xs uppercase font-bold text-muted-foreground mb-1">Total Payable</p>
                                            <p className="text-3xl font-black text-foreground">₹{record.net_payable_amount.toLocaleString()}</p>
                                        </div>
                                        <div className="flex flex-col gap-2 w-full mt-4">
                                            <Button
                                                className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold"
                                                onClick={() => approveMutation.mutate(record.id)}
                                                disabled={approveMutation.isPending}
                                            >
                                                Approve Payment
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="w-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                                                onClick={() => { setSelectedRecord(record); setIsRejectDialogOpen(true); }}
                                            >
                                                Reject / Query
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Payment Request</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for rejecting the payment for {selectedRecord?.rental_properties?.title}. This will return the request to the department.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea
                            placeholder="Reason for rejection..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => rejectMutation.mutate()}
                            disabled={!rejectionReason || rejectMutation.isPending}
                        >
                            Confirm Rejection
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
