import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RentalField } from "@/components/rental/RentalField";
import { Upload, Loader2, Link } from 'lucide-react';

interface RentalDeductionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    recordId: string;
}

export function RentalDeductionDialog({ open, onOpenChange, recordId }: RentalDeductionDialogProps) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        type: '',
        amount: '',
        remarks: '',
        proof_url: ''
    });
    const [file, setFile] = useState<File | null>(null);

    const mutation = useMutation({
        mutationFn: async () => {
            let uploadedUrl = formData.proof_url;

            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `deductions/${recordId}/${Date.now()}.${fileExt}`;
                const { data, error: uploadError } = await supabase.storage
                    .from('rental-bills')
                    .upload(fileName, file);

                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('rental-bills').getPublicUrl(fileName);
                uploadedUrl = publicUrl;
            }

            const { error } = await (supabase as any).from('rental_deductions').insert([{
                record_id: recordId,
                type: formData.type,
                amount: Number(formData.amount),
                remarks: formData.remarks,
                proof_url: uploadedUrl
            } as any]);

            if (error) throw error;

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-records'] }); // Generic key, should be specific
            queryClient.invalidateQueries({ queryKey: ['rsh-rental-records'] });
            queryClient.invalidateQueries({ queryKey: ['hr-rental-records'] });
            toast.success('Deduction added successfully');
            onOpenChange(false);
            setFormData({ type: '', amount: '', remarks: '', proof_url: '' });
            setFile(null);
        },
        onError: (err) => toast.error(err.message)
    });

    const isInternalType = ['Electricity', 'Water', 'Repair'].includes(formData.type);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Deduction / Issue</DialogTitle>
                    <DialogDescription>Record expenses that reduce the payable rent.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <RentalField label="Deduction Type" required>
                        <Select
                            value={formData.type}
                            onValueChange={(val) => setFormData({ ...formData, type: val })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Water">Water</SelectItem>
                                <SelectItem value="Repair">Repair</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </RentalField>

                    <RentalField label="Amount to Deduct (₹)" required>
                        <Input
                            type="number"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        />
                    </RentalField>

                    <RentalField label="Remarks" required={!isInternalType}>
                        <Textarea
                            placeholder="Explain the reason..."
                            value={formData.remarks}
                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                        />
                    </RentalField>

                    <RentalField label="Proof Document" required>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Paste Link OR Upload File"
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
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                        {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Add Deduction
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
