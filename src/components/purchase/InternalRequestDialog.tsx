
import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useMaterialRequests } from '@/hooks/useMaterialRequests';
import { toast } from 'sonner';
import { DEPARTMENTS } from '@/constants/departments';

interface InternalRequestDialogProps {
    children?: React.ReactNode;
}

export function InternalRequestDialog({ children }: InternalRequestDialogProps) {
    const [open, setOpen] = useState(false);
    const { createInternalRequest } = useMaterialRequests();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { register, control, handleSubmit, setValue, reset, formState: { errors } } = useForm({
        defaultValues: {
            requester_department: '',
            requester_name: '',
            urgency: 'normal' as 'low' | 'normal' | 'high' | 'critical',
            notes: '',
            items: [{ material_name: '', quantity: 1, unit: 'pcs', specification: '' }]
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "items"
    });

    const onSubmit = async (data: any) => {
        try {
            setIsSubmitting(true);

            // Transform items to match boq_items format expectation or just store as is
            const boq_items = data.items.map((item: any) => ({
                material_name: item.material_name,
                quantity: Number(item.quantity),
                unit: item.unit,
                specification: item.specification,
                status: 'pending'
            }));

            await createInternalRequest({
                requester_department: data.requester_department,
                requester_name: data.requester_name,
                urgency: data.urgency,
                notes: data.notes,
                boq_items: boq_items
            });

            setOpen(false);
            reset();
        } catch (error) {
            // Error handling is done in hook
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || <Button>Raise Internal Request</Button>}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Raise Internal Purchase Request</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="requester_department">Department <span className="text-red-500">*</span></Label>
                            <Select onValueChange={(val) => setValue('requester_department', val, { shouldValidate: true })} defaultValue="">
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {DEPARTMENTS.map(dept => (
                                        <SelectItem key={dept.value} value={dept.value}>
                                            {dept.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {/* Hidden input to enforce validation if strictly using select, but we allow free text too via another field if needed? 
                   Actually, let's keep it simple. The Select updates the state. 
                   If "Other" is selected, maybe show an input? 
                   For now, let's just assume the Select covers major ones.
               */}
                            <input type="hidden" {...register('requester_department', { required: 'Department is required' })} />
                            {errors.requester_department && <p className="text-sm text-red-500">{errors.requester_department.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="requester_name">Requester Name <span className="text-red-500">*</span></Label>
                            <Input {...register('requester_name', { required: 'Requester Name is required' })} placeholder="Who is asking?" />
                            {errors.requester_name && <p className="text-sm text-red-500">{errors.requester_name.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="urgency">Urgency</Label>
                            <Select defaultValue="normal" onValueChange={(val: any) => setValue('urgency', val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select urgency" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Label>Items Needed</Label>
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ material_name: '', quantity: 1, unit: 'pcs', specification: '' })}>
                                <Plus className="w-4 h-4 mr-2" /> Add Item
                            </Button>
                        </div>

                        {fields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-12 gap-3 items-end p-0 md:p-2 border-b border-border/40 pb-6 mb-2 last:border-0 last:pb-0">
                                <div className="col-span-12 md:col-span-4 space-y-1.5">
                                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Material Name</Label>
                                    <Input
                                        {...register(`items.${index}.material_name`, { required: true })}
                                        placeholder="Item name"
                                        className="bg-background/50 border-border/50 focus:border-primary/50"
                                    />
                                </div>
                                <div className="col-span-4 md:col-span-2 space-y-1.5">
                                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Qty</Label>
                                    <Input
                                        type="number"
                                        {...register(`items.${index}.quantity`, { required: true, min: 1 })}
                                        className="bg-background/50 border-border/50"
                                    />
                                </div>
                                <div className="col-span-4 md:col-span-2 space-y-1.5">
                                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Unit</Label>
                                    <Input
                                        {...register(`items.${index}.unit`, { required: true })}
                                        placeholder="pcs, kg"
                                        className="bg-background/50 border-border/50"
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-3 space-y-1.5">
                                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Specification</Label>
                                    <Input
                                        {...register(`items.${index}.specification`)}
                                        placeholder="Details..."
                                        className="bg-background/50 border-border/50"
                                    />
                                </div>
                                <div className="col-span-4 md:col-span-1 flex justify-end">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => remove(index)}
                                        className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 h-10 w-10 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea {...register('notes')} placeholder="Any additional details or context..." />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Submit Request
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
