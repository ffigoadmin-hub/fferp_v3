import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    Loader2,
    MapPin,
    User,
    Phone,
    FileText,
    Building2,
    Calendar,
    Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { WizardSteps } from '@/components/shared/WizardSteps';

const projectSchema = z.object({
    project_name: z.string().min(3, 'Project name is required'),
    client_name: z.string().min(2, 'Client name is required'),
    client_contact: z.string().optional(),
    location_city: z.string().min(2, 'City is required'),
    location_state: z.string().min(2, 'State is required'),
    project_type: z.enum(['amc', 'buy_back', 'jv']),
    onboarded_date: z.string().min(1, 'Onboarded date is required'),
    project_vertical: z.string().min(1, 'Project vertical is required'),
    department: z.enum(['agri', 'civil']),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface ProjectWizardProps {
    onClose: () => void;
    onSubmit: (data: ProjectFormData) => Promise<void>;
    isSaving: boolean;
}

const WIZARD_STEPS = [
    { id: 'basics', title: 'Basics', description: 'Project & Client' },
    { id: 'location', title: 'Location', description: 'Region & Vertical' },
    { id: 'review', title: 'Review', description: 'Confirm Details' },
];

export function ProjectWizard({ onClose, onSubmit, isSaving }: ProjectWizardProps) {
    const [currentStep, setCurrentStep] = useState(0);

    const form = useForm<ProjectFormData>({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            project_type: 'amc',
            department: 'agri',
            onboarded_date: new Date().toISOString().split('T')[0],
        },
    });

    const nextStep = async () => {
        const fields = currentStep === 0
            ? ['project_name', 'client_name', 'client_contact', 'project_type', 'department']
            : ['location_city', 'location_state', 'project_vertical', 'onboarded_date'];

        const isValid = await form.trigger(fields as any);
        if (isValid) {
            setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
        }
    };

    const prevStep = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
    };

    const handleSubmit = async (data: ProjectFormData) => {
        await onSubmit(data);
    };

    return (
        <DialogContent className="max-w-2xl bg-[#0D0D0F] border-white/5 p-0 overflow-hidden flex flex-col h-[85vh]">
            <DialogHeader className="p-6 border-b border-white/5 bg-[#141416]">
                <div className="flex items-center justify-between">
                    <div>
                        <DialogTitle className="text-xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                            Initialize New Project
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground mt-1">Deploy intelligence assets and setup project parameters</p>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        STEP {currentStep + 1} OF {WIZARD_STEPS.length}
                    </Badge>
                </div>
                <div className="mt-6">
                    <WizardSteps steps={WIZARD_STEPS} currentStep={currentStep} />
                </div>
            </DialogHeader>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 overflow-hidden flex flex-col">
                    <ScrollArea className="flex-1 p-6">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-6"
                            >
                                {currentStep === 0 && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="project_name"
                                                render={({ field }: { field: any }) => (
                                                    <FormItem>
                                                        <FormLabel>Project Name</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Building2 className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                                                <Input {...field} className="pl-10 bg-white/5 border-white/10" placeholder="e.g. Green Valley Estate" />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="client_name"
                                                render={({ field }: { field: any }) => (
                                                    <FormItem>
                                                        <FormLabel>Client Name</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                                                <Input {...field} className="pl-10 bg-white/5 border-white/10" placeholder="Full Name" />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="client_contact"
                                            render={({ field }: { field: any }) => (
                                                <FormItem>
                                                    <FormLabel>Client Contact (Optional)</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                                            <Input {...field} className="pl-10 bg-white/5 border-white/10" placeholder="+91..." />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="project_type"
                                                render={({ field }: { field: any }) => (
                                                    <FormItem>
                                                        <FormLabel>Project Type</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="bg-white/5 border-white/10">
                                                                    <SelectValue placeholder="Select type" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent className="bg-[#1A1A1D] border-white/10">
                                                                <SelectItem value="amc">AMC</SelectItem>
                                                                <SelectItem value="buy_back">Buy Back</SelectItem>
                                                                <SelectItem value="jv">JV</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="department"
                                                render={({ field }: { field: any }) => (
                                                    <FormItem>
                                                        <FormLabel>Department</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="bg-white/5 border-white/10">
                                                                    <SelectValue placeholder="Select dept" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent className="bg-[#1A1A1D] border-white/10">
                                                                <SelectItem value="agri">Agri</SelectItem>
                                                                <SelectItem value="civil">Civil</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                )}

                                {currentStep === 1 && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="location_city"
                                                render={({ field }: { field: any }) => (
                                                    <FormItem>
                                                        <FormLabel>City</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                                                <Input {...field} className="pl-10 bg-white/5 border-white/10" placeholder="City" />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="location_state"
                                                render={({ field }: { field: any }) => (
                                                    <FormItem>
                                                        <FormLabel>State</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                                                <Input {...field} className="pl-10 bg-white/5 border-white/10" placeholder="State" />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="project_vertical"
                                            render={({ field }: { field: any }) => (
                                                <FormItem>
                                                    <FormLabel>Project Vertical</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Briefcase className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                                            <Input {...field} className="pl-10 bg-white/5 border-white/10" placeholder="e.g. AMC, Landscaping" />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="onboarded_date"
                                            render={({ field }: { field: any }) => (
                                                <FormItem>
                                                    <FormLabel>Onboarding Date</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Calendar className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                                            <Input {...field} type="date" className="pl-10 bg-white/5 border-white/10" />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                )}

                                {currentStep === 2 && (
                                    <div className="space-y-6">
                                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                                            <h3 className="font-semibold flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.6)]" />
                                                Review Intelligence Parameters
                                            </h3>

                                            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                                                <div className="space-y-1">
                                                    <p className="text-muted-foreground">Project Name</p>
                                                    <p className="font-medium">{form.getValues('project_name')}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-muted-foreground">Client</p>
                                                    <p className="font-medium">{form.getValues('client_name')}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-muted-foreground">Location</p>
                                                    <p className="font-medium">{form.getValues('location_city')}, {form.getValues('location_state')}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-muted-foreground">Vertical</p>
                                                    <p className="font-medium">{form.getValues('project_vertical')}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-muted-foreground">Department</p>
                                                    <Badge variant="outline" className="capitalize">{form.getValues('department')}</Badge>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-muted-foreground">Type</p>
                                                    <Badge variant="outline" className="uppercase">{form.getValues('project_type')}</Badge>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                                            <div className="p-2 rounded-lg bg-primary/20">
                                                <CheckCircle2 className="w-4 h-4 text-primary" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-primary">Ready for Deployment</h4>
                                                <p className="text-xs text-muted-foreground mt-0.5">Initializing the project will create necessary database assets and enable intelligence tracking.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </ScrollArea>

                    <div className="p-6 border-t border-white/5 bg-[#141416] flex items-center justify-between">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={currentStep === 0 ? onClose : prevStep}
                            className="bg-white/5 hover:bg-white/10"
                        >
                            {currentStep === 0 ? 'Cancel' : 'Previous'}
                        </Button>

                        <div className="flex items-center gap-2">
                            {currentStep < WIZARD_STEPS.length - 1 ? (
                                <Button type="button" onClick={nextStep} className="group">
                                    Next Step
                                    <ChevronRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                                </Button>
                            ) : (
                                <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90">
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Initializing...
                                        </>
                                    ) : (
                                        <>
                                            Deploy Project
                                            <CheckCircle2 className="ml-2 w-4 h-4" />
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </Form>
        </DialogContent>
    );
}
