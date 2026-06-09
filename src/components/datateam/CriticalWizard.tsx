import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    X,
    Loader2,
    AlertCircle,
    FileText,
    Zap,
    Leaf,
    Building2,
    Tractor,
    RefreshCcw,
    ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { WizardSteps } from '@/components/shared/WizardSteps';
import { ESCALATION_BUCKETS, EscalationBucket, WorkflowDepartment, WORKFLOW_DEPARTMENTS, isValidProofUrl } from '@/types/workflows';
import {
    Users,
    Building,
    Briefcase,
    MapPin,
    Key,
    GraduationCap,
    Sprout
} from 'lucide-react';
import { toast } from 'sonner';

const criticalSchema = z.object({
    department: z.string().min(1, 'Department is required'),
    bucket: z.string().optional(),
    issue_type: z.string().min(3, 'Issue type must be at least 3 characters'),
    issue_title: z.string().min(5, 'Location must be at least 5 characters'),
    issue_description: z.string().min(10, 'Description must be at least 10 characters'),
    proof_url: z.string()
        .min(1, 'Proof URL is required')
        .refine(
            (url) => isValidProofUrl(url),
            'Must be a valid Google Drive/Docs/Sheets link'
        ),
});

type CriticalFormData = z.infer<typeof criticalSchema>;

interface CriticalWizardProps {
    onClose: () => void;
    onSubmit: (data: CriticalFormData) => Promise<{ success: boolean }>;
    isSaving: boolean;
}

const WIZARD_STEPS = [
    { id: 'category', title: 'Category', description: 'Department & Type' },
    { id: 'details', title: 'Details', description: 'Issue Information' },
    { id: 'proof', title: 'Proof', description: 'Evidence Link' },
    { id: 'review', title: 'Review', description: 'Confirm & Submit' },
];

const CRITICAL_BUCKETS = [
    { value: 'eng_jv', label: 'Engineering - JV', dept: 'Engineering', icon: Building2 },
    { value: 'eng_direct', label: 'Engineering - Direct', dept: 'Engineering', icon: Building2 },
    { value: 'agri_jv', label: 'Agri - JV', dept: 'Agri Operations', icon: Leaf },
    { value: 'agri_direct', label: 'Agri - Direct', dept: 'Agri Operations', icon: Leaf },
    { value: 'farm_manager', label: 'Farm Manager', dept: 'Farm Manager', icon: Tractor },
    { value: 'buy_back', label: 'Buy-Back', dept: 'Buy-Back', icon: RefreshCcw },
    { value: 'hr', label: 'HR', dept: 'HR', icon: Users },
    { value: 'head_office', label: 'Head Office', dept: 'Head Office', icon: Building },
    { value: 'business_development', label: 'Business Development', dept: 'Business Development', icon: Briefcase },
    { value: 'site_visit', label: 'Site Visit', dept: 'Site Visit', icon: MapPin },
    { value: 'rental_sourcing', label: 'Rental Sourcing', dept: 'Rental Sourcing', icon: Key },
    { value: 'tnskill', label: 'TNSkill', dept: 'TNSkill', icon: GraduationCap },
    { value: 'nursery_landscaping', label: 'Nursery & Landscaping', dept: 'Nursery & Landscaping', icon: Sprout },
];

export function CriticalWizard({ onClose, onSubmit, isSaving }: CriticalWizardProps) {
    const [currentStep, setCurrentStep] = useState(0);

    const form = useForm<CriticalFormData>({
        resolver: zodResolver(criticalSchema),
        defaultValues: {
            department: 'agri',
            issue_type: '',
            issue_title: '',
            issue_description: '',
            proof_url: '',
        },
    });

    const handleNext = async () => {
        let fieldsToValidate: (keyof CriticalFormData)[] = [];

        switch (currentStep) {
            case 0: // Category
                fieldsToValidate = ['department'];
                break;
            case 1: // Details
                fieldsToValidate = ['issue_type', 'issue_title', 'issue_description'];
                break;
            case 2: // Proof
                fieldsToValidate = ['proof_url'];
                break;
        }

        const isValid = await form.trigger(fieldsToValidate);
        if (!isValid) return;

        if (currentStep < WIZARD_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSubmit = async (data: CriticalFormData) => {
        const result = await onSubmit(data);
        if (result.success) {
            onClose();
        }
    };

    const selectedBucketKey = CRITICAL_BUCKETS.find(b => b.dept === form.watch('department'));

    return (
        <DialogContent className="max-w-3xl p-0 bg-[#0A0A0B] border-white/5 text-white h-[90vh] flex flex-col">
            <div className="flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-white/5">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black tracking-tighter uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">
                            Critical Issue Wizard
                        </DialogTitle>
                    </DialogHeader>

                    <div className="mt-6">
                        <WizardSteps steps={WIZARD_STEPS} currentStep={currentStep} />
                    </div>
                </div>

                {/* Content */}
                <ScrollArea className="flex-1 p-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                            <AnimatePresence mode="wait">
                                {/* Step 1: Category */}
                                {currentStep === 0 && (
                                    <motion.div
                                        key="step-0"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-6"
                                    >
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-black uppercase tracking-widest text-white/60">Department Selection</h3>

                                            <FormField
                                                control={form.control}
                                                name="department"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Critical Department *</FormLabel>
                                                        <Select onValueChange={(val) => {
                                                            const bucket = CRITICAL_BUCKETS.find(b => b.value === val);
                                                            field.onChange(bucket?.dept || val);
                                                            form.setValue('bucket', val);
                                                        }} value={CRITICAL_BUCKETS.find(b => b.dept === field.value)?.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="bg-white/5 border-white/10 h-12">
                                                                    <SelectValue placeholder="Select department" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {CRITICAL_BUCKETS.map((bucket) => {
                                                                    const Icon = bucket.icon;
                                                                    return (
                                                                        <SelectItem key={bucket.value} value={bucket.value}>
                                                                            <div className="flex items-center gap-3">
                                                                                <Icon className="w-4 h-4" />
                                                                                <span>{bucket.label}</span>
                                                                            </div>
                                                                        </SelectItem>
                                                                    );
                                                                })}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormDescription className="text-xs">
                                                            This determines the SLA and routing for the hourly critical
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            {selectedBucketKey && (
                                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                                                    <Zap className="w-5 h-5 text-amber-500 mt-0.5" />
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-amber-500">Selected: {selectedBucketKey.label}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">Will be routed to {selectedBucketKey.dept.toUpperCase()} handlers</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 2: Details */}
                                {currentStep === 1 && (
                                    <motion.div
                                        key="step-1"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-6"
                                    >
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-black uppercase tracking-widest text-white/60">Issue Details</h3>

                                            <FormField
                                                control={form.control}
                                                name="issue_type"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Issue Type *</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="e.g., Sensor Failure, Equipment Down"
                                                                {...field}
                                                                className="bg-white/5 border-white/10 h-12"
                                                            />
                                                        </FormControl>
                                                        <FormDescription className="text-xs">
                                                            Brief categorization of the critical issue
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="issue_title"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Location / Title *</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="e.g., Polyhouse 4, Sector B"
                                                                {...field}
                                                                className="bg-white/5 border-white/10 h-12"
                                                            />
                                                        </FormControl>
                                                        <FormDescription className="text-xs">
                                                            Specific location or identifier for the issue
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="issue_description"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Description *</FormLabel>
                                                        <FormControl>
                                                            <Textarea
                                                                placeholder="Provide detailed information about the critical issue..."
                                                                rows={8}
                                                                {...field}
                                                                className="bg-white/5 border-white/10 resize-none"
                                                            />
                                                        </FormControl>
                                                        <FormDescription className="text-xs">
                                                            Include all relevant details for rapid diagnosis
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 3: Proof */}
                                {currentStep === 2 && (
                                    <motion.div
                                        key="step-2"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-6"
                                    >
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-black uppercase tracking-widest text-white/60">Evidence Documentation</h3>

                                            <FormField
                                                control={form.control}
                                                name="proof_url"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Proof URL (Google Drive/Docs) *</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="https://drive.google.com/..."
                                                                {...field}
                                                                className="bg-white/5 border-white/10 h-12"
                                                            />
                                                        </FormControl>
                                                        <FormDescription className="text-xs flex items-center gap-2">
                                                            <ExternalLink className="w-3 h-3" />
                                                            Must be a valid Google Drive, Docs, or Sheets link
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                                                <div className="flex items-start gap-3">
                                                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                                                    <div className="text-sm">
                                                        <p className="font-bold text-red-500 mb-1">CRITICAL SLA</p>
                                                        <p className="text-muted-foreground">10 min ACK | 45 min Resolution</p>
                                                        <p className="text-xs text-muted-foreground mt-2">This is an hourly critical - immediate attention required</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 4: Review */}
                                {currentStep === 3 && (
                                    <motion.div
                                        key="step-3"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-6"
                                    >
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-black uppercase tracking-widest text-white/60">Review Critical Submission</h3>

                                            <div className="space-y-4 p-6 bg-white/5 border border-white/10 rounded-2xl">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Department</p>
                                                        <Badge variant="outline" className="capitalize">{form.getValues('department')}</Badge>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Type</p>
                                                        <p className="font-bold text-white">{form.getValues('issue_type')}</p>
                                                    </div>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Location</p>
                                                    <p className="font-bold text-white">{form.getValues('issue_title')}</p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Description</p>
                                                    <p className="text-sm text-muted-foreground">{form.getValues('issue_description')}</p>
                                                </div>

                                                <div className="pt-4 border-t border-white/10">
                                                    <div className="flex items-center gap-2">
                                                        <ExternalLink className="w-4 h-4 text-green-500" />
                                                        <span className="text-sm">Proof link provided</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                                <p className="text-xs text-amber-500 font-bold">⚡ Once submitted, this will trigger immediate BOI dispatch and SLA monitoring</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </form>
                    </Form>
                </ScrollArea>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <Button
                        variant="ghost"
                        onClick={currentStep === 0 ? onClose : handlePrevious}
                        className="gap-2"
                    >
                        {currentStep === 0 ? (
                            <>
                                <X className="w-4 h-4" />
                                Cancel
                            </>
                        ) : (
                            <>
                                <ChevronLeft className="w-4 h-4" />
                                Previous
                            </>
                        )}
                    </Button>

                    {currentStep < WIZARD_STEPS.length - 1 ? (
                        <Button onClick={handleNext} className="gap-2 bg-amber-600 hover:bg-amber-700">
                            Next
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button
                            onClick={form.handleSubmit(handleSubmit)}
                            disabled={isSaving}
                            className="gap-2 bg-red-600 hover:bg-red-700 font-black tracking-widest uppercase"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <Zap className="w-4 h-4" />
                                    Submit Critical
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </DialogContent>
    );
}
