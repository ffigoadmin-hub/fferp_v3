import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Check, User, Quote, Link as LinkIcon, Sprout } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface AgriHandoverDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: any;
    onSuccess?: () => void;
}

export function AgriHandoverDialog({ open, onOpenChange, project, onSuccess }: AgriHandoverDialogProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [engineerId, setEngineerId] = useState('');
    const [managerId, setManagerId] = useState('');
    const [verticalId, setVerticalId] = useState('');
    const [testimonialText, setTestimonialText] = useState('');
    const [testimonialUrl, setTestimonialUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch Agri Employees
    const { data: agriEngineers } = useQuery({
        queryKey: ['agri-engineers'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, department')
                .ilike('role', 'employee')
                .ilike('department', '%agri%')
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            return data;
        },
        enabled: open,
    });

    // Fetch SMOs (Managers)
    const { data: smos } = useQuery({
        queryKey: ['smos'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, department')
                .ilike('role', 'smo')
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            return data;
        },
        enabled: open,
    });

    // Fetch Agri Verticals
    const { data: agriVerticals } = useQuery({
        queryKey: ['agri-verticals'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('project_verticals')
                .select('id, name')
                .eq('category', 'Agri')
                .order('name');
            if (error) throw error;
            return data;
        },
        enabled: open,
    });

    const handoverMutation = useMutation({
        mutationFn: async () => {
            if (!engineerId) throw new Error('Agri Engineer is required');
            if (!testimonialText) throw new Error('Customer Testimonial is required');
            if (!verticalId) throw new Error('Agri Vertical is required');

            // Update project
            const { error: projectError } = await supabase
                .from('projects')
                .update({
                    department: 'Agri',
                    vertical_id: verticalId,
                    // We might update 'vertical' text column too if it exists, for backward compat
                    // vertical: agriVerticals?.find(v => v.id === verticalId)?.name || 'Agri', 
                    assigned_project_engineer_id: engineerId,
                    assigned_manager_id: managerId || null,
                    lifecycle_stage: 'agri_handover', // Or whatever strict stage Agri starts at
                    customer_testimonial_text: testimonialText,
                    customer_testimonial_url: testimonialUrl || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', project.id);

            if (projectError) throw projectError;

            // Log to timeline
            const { error: timelineError } = await supabase.from('project_timeline').insert({
                project_id: project.id,
                action: 'handover_to_agri',
                performed_by: user?.id,
                performed_by_name: user?.name,
                performed_by_role: user?.role,
                details: {
                    engineer_id: engineerId,
                    manager_id: managerId,
                    testimonial_text: testimonialText,
                    testimonial_url: testimonialUrl,
                    previous_stage: project.lifecycle_stage
                },
            });

            if (timelineError) throw timelineError;
        },
        onSuccess: () => {
            toast.success('Project successfully handed over to Agri team!');
            queryClient.invalidateQueries({ queryKey: ['engineering-projects'] });
            queryClient.invalidateQueries({ queryKey: ['gmo-projects'] });
            onOpenChange(false);
            onSuccess?.();
            // Reset form
            setEngineerId('');
            setManagerId('');
            setTestimonialText('');
            setTestimonialUrl('');
            setVerticalId('');
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to handover project');
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sprout className="w-5 h-5 text-green-600" />
                        Handover to Agri
                    </DialogTitle>
                    <DialogDescription>
                        Transfer this engineering project to the Agricultural department.
                        A customer testimonial is required for this step.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-4">
                        <h4 className="font-medium text-sm text-primary flex items-center gap-2">
                            <User className="w-4 h-4" /> Team Assignment
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Agri Vertical <span className="text-red-500">*</span></Label>
                                <Select value={verticalId} onValueChange={setVerticalId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select vertical" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {agriVerticals?.map((v) => (
                                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Agri Engineer <span className="text-red-500">*</span></Label>
                                <Select value={engineerId} onValueChange={setEngineerId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select engineer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {agriEngineers?.map((eng) => (
                                            <SelectItem key={eng.id} value={eng.id}>{eng.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Agri Manager (Optional)</Label>
                                <Select value={managerId} onValueChange={setManagerId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select manager" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {smos?.map((smo) => (
                                            <SelectItem key={smo.id} value={smo.id}>{smo.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-medium text-sm text-primary flex items-center gap-2">
                            <Quote className="w-4 h-4" /> Customer Testimonial
                        </h4>

                        <div className="space-y-2">
                            <Label>Testimonial Text <span className="text-red-500">*</span></Label>
                            <Textarea
                                placeholder="Enter the customer's feedback and testimonial here..."
                                className="min-h-[100px]"
                                value={testimonialText}
                                onChange={(e) => setTestimonialText(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Media Link (Video/Image) <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                            <div className="flex items-center gap-2">
                                <LinkIcon className="w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="https://drive.google.com/..."
                                    value={testimonialUrl}
                                    onChange={(e) => setTestimonialUrl(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        onClick={() => handoverMutation.mutate()}
                        disabled={!engineerId || !verticalId || !testimonialText || handoverMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        {handoverMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Check className="w-4 h-4 mr-2" />
                        )}
                        Confirm Handover
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
