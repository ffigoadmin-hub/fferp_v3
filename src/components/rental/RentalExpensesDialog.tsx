import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RentalField } from "@/components/rental/RentalField";
import { Upload, Loader2, Trash2, Calendar, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";

interface RentalExpensesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    propertyId: string;
    propertyName: string;
}

export function RentalExpensesDialog({ open, onOpenChange, propertyId, propertyName }: RentalExpensesDialogProps) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        category: 'Maintenance',
        amount: '',
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        proof_url: ''
    });
    const [file, setFile] = useState<File | null>(null);

    // Fetch existing expenses
    const { data: expenses, isLoading } = useQuery({
        queryKey: ['rental-expenses', propertyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('rental_expenses')
                .select('*')
                .eq('property_id', propertyId)
                .order('expense_date', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: open
    });

    const mutation = useMutation({
        mutationFn: async () => {
            let uploadedUrl = formData.proof_url;

            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `expenses/${propertyId}/${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('rental-bills')
                    .upload(fileName, file);

                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('rental-bills').getPublicUrl(fileName);
                uploadedUrl = publicUrl;
            }

            const { error } = await (supabase as any).from('rental_expenses').insert([{
                property_id: propertyId,
                category: formData.category,
                amount: Number(formData.amount),
                expense_date: formData.expense_date,
                description: formData.description,
                proof_url: uploadedUrl
            }]);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-expenses', propertyId] });
            toast.success('Expense recorded successfully');
            setFormData({
                category: 'Maintenance',
                amount: '',
                expense_date: format(new Date(), 'yyyy-MM-dd'),
                description: '',
                proof_url: ''
            });
            setFile(null);
        },
        onError: (err) => toast.error(err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('rental_expenses').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-expenses', propertyId] });
            toast.success('Expense deleted');
        }
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Owner Expenses - {propertyName}</DialogTitle>
                    <DialogDescription>Track property-related expenses (Maintenance, Tax, etc.)</DialogDescription>
                </DialogHeader>

                <div className="grid md:grid-cols-2 gap-6 py-4">
                    {/* Form Section */}
                    <div className="space-y-4 border-r pr-6">
                        <h3 className="font-bold text-sm">Add New Expense</h3>

                        <RentalField label="Category" required>
                            <Select
                                value={formData.category}
                                onValueChange={(val) => setFormData({ ...formData, category: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                                    <SelectItem value="Electricity Bill">Electricity Bill</SelectItem>
                                    <SelectItem value="Property Tax">Property Tax</SelectItem>
                                    <SelectItem value="Legal Fees">Legal Fees</SelectItem>
                                    <SelectItem value="Renovation">Renovation</SelectItem>
                                    <SelectItem value="EB Bill (Owner)">EB Bill (Owner)</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </RentalField>

                        <RentalField label="Date" required>
                            <Input type="date" value={formData.expense_date} onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })} />
                        </RentalField>

                        <RentalField label="Amount (₹)" required>
                            <Input
                                type="number"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            />
                        </RentalField>

                        <RentalField label="Description">
                            <Textarea
                                placeholder="Describe the expense..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </RentalField>

                        <RentalField label="Proof / Bill">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Link / Upload"
                                    value={formData.proof_url}
                                    onChange={(e) => setFormData({ ...formData, proof_url: e.target.value })}
                                    disabled={!!file}
                                />
                                <div className="relative">
                                    <Button size="icon" variant="outline" className="relative">
                                        <Upload className="w-4 h-4" />
                                        <input
                                            type="file"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                                        />
                                    </Button>
                                    {file && <div className="absolute top-[-10px] right-[-10px] bg-green-500 w-3 h-3 rounded-full" />}
                                </div>
                            </div>
                        </RentalField>

                        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full mt-2">
                            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Record Expense
                        </Button>
                    </div>

                    {/* List Section */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-sm flex justify-between items-center">
                            Expense History
                            <Badge variant="outline">{expenses?.length || 0}</Badge>
                        </h3>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {isLoading ? (
                                <p className="text-muted-foreground text-sm">Loading history...</p>
                            ) : expenses?.length === 0 ? (
                                <div className="text-center py-10 border rounded-lg bg-muted/20">
                                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-xs text-muted-foreground">No expenses recorded yet.</p>
                                </div>
                            ) : (
                                expenses?.map((expense: any) => (
                                    <div key={expense.id} className="p-3 border rounded-lg bg-card hover:bg-muted/10 transition-colors text-sm group relative">
                                        <div className="flex justify-between items-start mb-1">
                                            <div>
                                                <p className="font-bold">{expense.category}</p>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" /> {format(new Date(expense.expense_date), 'dd MMM yyyy')}
                                                </p>
                                            </div>
                                            <p className="font-mono font-bold">₹{expense.amount.toLocaleString()}</p>
                                        </div>
                                        {expense.description && (
                                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{expense.description}</p>
                                        )}
                                        {expense.proof_url && (
                                            <a href={expense.proof_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline block mt-1">
                                                View Receipt
                                            </a>
                                        )}

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 h-6 w-6 text-destructive hover:bg-destructive/10"
                                            onClick={() => deleteMutation.mutate(expense.id)}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
