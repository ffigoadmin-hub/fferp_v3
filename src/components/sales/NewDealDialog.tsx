import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Wallet, Building2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface NewDealDialogProps {
    onSuccess?: () => void;
}

export function NewDealDialog({ onSuccess }: NewDealDialogProps) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        clientName: '',
        projectName: '',
        location: '',
        baseValue: '',
        bookingAmount: '',
        source: 'referral'
    });

    const handleSubmit = async () => {
        if (!formData.clientName || !formData.projectName || !formData.baseValue) {
            toast({ title: 'Missing Info', description: 'Please fill required fields', variant: 'destructive' });
            return;
        }

        setLoading(true);
        try {
            // 1. Create Project (in 'new_deal' stage)
            const { data: project, error: projError } = await supabase
                .from('projects')
                .insert({
                    project_name: formData.projectName,
                    client_name: formData.clientName,
                    client_contact: 'Pending',
                    location_city: formData.location.split(',')[0].trim(),
                    location_state: formData.location.split(',')[1]?.trim() || 'Karnataka', // Default or parse
                    project_id: `PRJ-BD-${Date.now().toString().slice(-6)}`,
                    total_project_value: Number(formData.baseValue), // Set as Base Value
                    lifecycle_stage: 'new_deal',
                    status: 'active',
                    vertical: 'Residential', // Default
                    target_start_date: new Date().toISOString().split('T')[0]
                } as any) // Cast to any to bypass strict checks if types are still mismatched
                .select()
                .single();

            if (projError) throw projError;

            // 2. Add Payment Request (Booking Amount)
            if (formData.bookingAmount && Number(formData.bookingAmount) > 0) {
                const { error: payError } = await supabase
                    .from('payment_requests')
                    .insert({
                        project_id: project.id,
                        amount: Number(formData.bookingAmount),
                        status: 'paid', // Assuming booking amount is collected immediately
                        detailed_description: `Booking Amount for ${formData.projectName}`,
                        bill_url: 'NA',
                        cutoff_date: new Date().toISOString().split('T')[0],
                        cutoff_time: '12:00',
                        purpose: 'Booking Amount',
                        vendor_bank_details: 'NA - Incoming',
                        vendor_name: formData.clientName,
                        work_proof_url: 'NA',
                        requester_id: user?.id || '00000000-0000-0000-0000-000000000000' // Fallback if no user
                    });

                if (payError) throw payError;
            }

            toast({ title: 'Deal Created', description: 'New deal added to pipeline.' });
            setOpen(false);
            setFormData({
                clientName: '',
                projectName: '',
                location: '',
                baseValue: '',
                bookingAmount: '',
                source: 'referral'
            });
            onSuccess?.();

        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to create deal', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2 shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-primary/80 hover:scale-105 transition-all">
                    <Plus className="w-4 h-4" /> New Deal
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-card/95 backdrop-blur-xl border-primary/20">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Building2 className="w-5 h-5 text-primary" />
                        Register New Opportunity
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Client Name</Label>
                            <div className="relative">
                                <User className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Enter client name"
                                    className="pl-8"
                                    value={formData.clientName}
                                    onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Location</Label>
                            <Input
                                placeholder="Site Location"
                                value={formData.location}
                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Project Name</Label>
                        <Input
                            placeholder="e.g. Villa 45 Renovation"
                            value={formData.projectName}
                            onChange={e => setFormData({ ...formData, projectName: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-primary font-semibold">Base Contract Value</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    className="pl-7 font-bold text-lg"
                                    value={formData.baseValue}
                                    onChange={e => setFormData({ ...formData, baseValue: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-emerald-500 font-semibold flex items-center gap-1">
                                <Wallet className="w-3 h-3" /> Booking Amount
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    className="pl-7 border-emerald-500/30 focus:border-emerald-500"
                                    value={formData.bookingAmount}
                                    onChange={e => setFormData({ ...formData, bookingAmount: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Creating...' : 'Create Deal & Record Payment'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
