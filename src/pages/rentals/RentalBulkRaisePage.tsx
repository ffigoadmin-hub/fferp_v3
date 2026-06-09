import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Check, Send, AlertCircle, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RentalStatusBadge } from '@/components/rental/RentalStatusBadge';
import { useRentalAccess } from '@/hooks/useRentalAccess';

export default function RentalBulkRaisePage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { access } = useRentalAccess();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const { data: records, isLoading } = useQuery({
        queryKey: ['rental-drafts-bulk'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('rental_monthly_records')
                .select(`
                    *,
                    rental_properties!inner(title, rental_categories!inner(owner_role))
                `)
                .eq('status', 'DRAFT') // Or ELECTRICITY_UPDATED
                .order('month_year', { ascending: false });

            if (error) throw error;

            // Filter by role manually if RLS doesn't catch it all (RLS should handle it)
            return data;
        }
    });

    // Filter implementation
    // Filter implementation (Unified Access: Show all if admin/hr/rsh)
    const filteredRecords = records?.filter(r => {
        if (access?.isAdmin || access?.isHR || access?.isRSH) return true;
        return false;
    });

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleAll = () => {
        if (selectedIds.length === filteredRecords?.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredRecords?.map((r: any) => r.id) || []);
        }
    };

    const bulkRaiseMutation = useMutation({
        mutationFn: async () => {
            if (selectedIds.length === 0) throw new Error("No records selected");

            const { error } = await (supabase as any)
                .from('rental_monthly_records')
                .update({ status: 'RAISED_FOR_APPROVAL' } as any)
                .in('id', selectedIds);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-drafts-bulk'] });
            toast.success(`${selectedIds.length} records raised to CEO`);
            setSelectedIds([]);
            navigate(-1);
        },
        onError: (err) => toast.error(err.message)
    });

    if (isLoading) return <div className="p-8">Loading drafts...</div>;

    const totalAmount = filteredRecords
        ?.filter((r: any) => selectedIds.includes(r.id))
        .reduce((sum: number, r: any) => sum + (r.net_payable_amount || 0), 0) || 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex items-center justify-between sticky top-0 md:static bg-background/95 backdrop-blur z-10 py-4 border-b md:border-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Raise Bulk Rent</h1>
                        <p className="text-sm text-muted-foreground">Select records to send for CEO Approval</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                        <p className="text-xs uppercase font-bold text-muted-foreground">Selected Total</p>
                        <p className="text-xl font-black text-foreground">₹{totalAmount.toLocaleString()}</p>
                    </div>
                    <Button
                        size="lg"
                        className="font-bold shadow-lg shadow-primary/20 gap-2"
                        disabled={selectedIds.length === 0 || bulkRaiseMutation.isPending}
                        onClick={() => bulkRaiseMutation.mutate()}
                    >
                        <Send className="w-4 h-4" />
                        {bulkRaiseMutation.isPending ? 'Processing...' : `Raise ${selectedIds.length} Records`}
                    </Button>
                </div>
            </div>

            <Card className="border-border/50 shadow-sm">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-muted/50 border-border/50">
                                <TableHead className="w-12">
                                    <Checkbox
                                        checked={filteredRecords?.length > 0 && selectedIds.length === filteredRecords?.length}
                                        onCheckedChange={toggleAll}
                                    />
                                </TableHead>
                                <TableHead className="font-bold text-muted-foreground">Property</TableHead>
                                <TableHead className="font-bold text-muted-foreground">Month</TableHead>
                                <TableHead className="font-bold text-muted-foreground">Base Rent</TableHead>
                                <TableHead className="font-bold text-muted-foreground">Additions</TableHead>
                                <TableHead className="font-bold text-muted-foreground">Deductions</TableHead>
                                <TableHead className="font-bold text-muted-foreground">Net Payable</TableHead>
                                <TableHead className="font-bold text-muted-foreground">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRecords?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Check className="w-8 h-8 text-emerald-500" />
                                            No drafts pending action
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredRecords?.map((record: any) => (
                                    <TableRow key={record.id} className="group hover:bg-muted/30 border-border/50">
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.includes(record.id)}
                                                onCheckedChange={() => toggleSelect(record.id)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium text-foreground">{record.rental_properties.title}</TableCell>
                                        <TableCell className="font-mono text-xs">{record.month_year}</TableCell>
                                        <TableCell>₹{record.base_rent?.toLocaleString()}</TableCell>
                                        <TableCell className="text-emerald-600">
                                            {((Number(record.electricity_bill_amount) || 0) + (Number(record.addition_total) || 0)) > 0 
                                                ? `+₹${((Number(record.electricity_bill_amount) || 0) + (Number(record.addition_total) || 0)).toLocaleString()}` 
                                                : '-'}
                                        </TableCell>
                                        <TableCell className="text-destructive">
                                            {record.deduction_total > 0 ? `-₹${record.deduction_total}` : '-'}
                                        </TableCell>
                                        <TableCell className="font-bold text-foreground">₹{record.net_payable_amount?.toLocaleString()}</TableCell>
                                        <TableCell><RentalStatusBadge status={record.status} /></TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
