import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    ChevronLeft,
    ChevronRight,
    Upload,
    CheckCircle2,
    X,
    Loader2,
    MapPin,
    User,
    Phone,
    FileText,
    Image as ImageIcon,

    AlertCircle,
    Briefcase,
    Calendar,
    Check,
    Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { WizardSteps } from '@/components/shared/WizardSteps';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ESCALATION_BUCKETS, EscalationBucket, WorkflowDepartment, WORKFLOW_DEPARTMENTS } from '@/types/workflows';
import { useAuth } from '@/contexts/AuthContext';

const escalationSchema = z.object({
    department: z.string(),
    client_name: z.string().optional(),
    client_phone: z.string().optional(),
    issue_title: z.string().min(5, 'Issue title must be at least 5 characters'),
    issue_description: z.string().min(10, 'Description must be at least 10 characters'),
    priority: z.enum(['high', 'critical']).optional(),
    urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    project_id: z.string().optional(),
    bucket: z.enum(['eng_jv', 'eng_direct', 'agri_jv', 'agri_direct', 'farm_manager', 'buy_back', 'business_development', 'hr', 'head_office', 'rental_sourcing', 'tnskill', 'nursery_landscaping', 'site_visit', 'purchase', 'vendor_sourcing', 'mts', 'marketing', 'crm', 'data_analytics_legal', 'farmers_factory', 'agrimart', 'palm_cafe', 'finance', 'rnd', 'accounts', 'ceo_office', 'admin', 'it_ai', 'management_ops', 'valluvam']).optional(),
});

type EscalationFormData = z.infer<typeof escalationSchema>;

interface Project {
    id: string;
    project_name: string;
    client_name: string;
    client_contact: string;
    location_city: string;
    location_state: string;
    onboarded_date: string | null;
    project_type: string | null;
}

interface EscalationWizardProps {
    onClose: () => void;
    onSubmit: (data: EscalationFormData & { evidence_url?: string }) => Promise<{ success: boolean }>;
    isSaving: boolean;
    projects: Project[];
    initialProjectId?: string;
}

const WIZARD_STEPS = [
    { id: 'source', title: 'Source', description: 'Project or Direct' },
    { id: 'issue', title: 'Issue', description: 'Details & Category' },
    { id: 'evidence', title: 'Evidence', description: 'Required Proofs' },
    { id: 'review', title: 'Review', description: 'Confirm & Submit' },
];

export function EscalationWizard({ onClose, onSubmit, isSaving, projects, initialProjectId }: EscalationWizardProps) {
    const { user } = useAuth();
    const isCEO = user?.role?.toLowerCase() === 'ceo';
    const [currentStep, setCurrentStep] = useState(0);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [evidenceUrl, setEvidenceUrl] = useState('');
    const [evidenceFileName, setEvidenceFileName] = useState<string | null>(null);
    const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
    const [isProjectRelated, setIsProjectRelated] = useState(false); // New toggle state
    const [subDivision, setSubDivision] = useState<'jv' | 'direct' | null>(null);

    const form = useForm<EscalationFormData>({
        resolver: zodResolver(escalationSchema),
        defaultValues: {
            department: 'agri',
            priority: 'high',
            urgency: 'medium',
            client_name: '',
        },
    });

    useEffect(() => {
        if (initialProjectId) {
            setIsProjectRelated(true);
            handleProjectSelect(initialProjectId);
            form.setValue('project_id', initialProjectId);
        }
    }, [initialProjectId]);

    const handleProjectSelect = (projectId: string) => {
        const project = projects.find(p => p.id === projectId);
        setSelectedProject(project || null);
        if (project) {
            form.setValue('client_name', project.client_name);
            form.setValue('client_phone', project.client_contact || '');
        }
    };

    const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('File size must be less than 5MB');
            return;
        }

        setIsUploadingEvidence(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `escalation-evidence/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('escalation-proofs')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('escalation-proofs')
                .getPublicUrl(filePath);

            setEvidenceUrl(publicUrl);
            setEvidenceFileName(file.name);
            toast.success('Evidence uploaded');
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error('Failed to upload evidence');
        } finally {
            setIsUploadingEvidence(false);
        }
    };



    const handleNext = async () => {
        // Validate current step before proceeding
        let fieldsToValidate: (keyof EscalationFormData)[] = [];

        switch (currentStep) {
            case 0: // Source Selection

                if (isProjectRelated) {
                    if (!form.getValues('project_id')) {
                        toast.error('Please select a project');
                        return;
                    }
                }
                break;
            case 1: // Issue
                if (!form.getValues('bucket')) {
                    toast.error('Please complete department selection');
                    return;
                }
                fieldsToValidate = ['bucket', 'issue_title', 'issue_description'];
                break;
            case 2: // Evidence
                if (!evidenceUrl) {
                    toast.error('Evidence screenshot is required');
                    return;
                }
                break;
        }

        const isValid = await form.trigger(fieldsToValidate);
        if (!isValid) return;

        if (currentStep < WIZARD_STEPS.length - 1) {
            // CEO Skip Logic: Skip Evidence (2) to Review (3)
            if (isCEO && currentStep === 1) {
                setCurrentStep(3);
            } else {
                setCurrentStep(currentStep + 1);
            }
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            // CEO Skip Logic: Skip back from Review (3) to Issue (1)
            if (isCEO && currentStep === 3) {
                setCurrentStep(1);
            } else {
                setCurrentStep(currentStep - 1);
            }
        }
    };

    const handleSubmit = async (data: EscalationFormData) => {
        if (!isCEO && !evidenceUrl) {
            toast.error('Evidence is required');
            return;
        }

        // PERFECT FIX: Ensure client_name is never null or empty string
        const finalClientName = data.client_name?.trim() || (isProjectRelated ? 'Selected Project' : 'Direct Client');

        const result = await onSubmit({
            ...data,
            client_name: finalClientName,
            evidence_url: evidenceUrl,
        });

        if (result.success) {
            onClose();
        }
    };

    const getProjectAge = (onboardedDate: string | null): string => {
        if (!onboardedDate) return 'N/A';
        const days = Math.floor((new Date().getTime() - new Date(onboardedDate).getTime()) / (1000 * 60 * 60 * 24));
        if (days < 30) return `${days} days`;
        const months = Math.floor(days / 30);
        return `${months} month${months > 1 ? 's' : ''}`;
    };

    return (
        <DialogContent className="max-w-3xl p-0 bg-[#0A0A0B] border-white/5 text-white h-[90vh] flex flex-col">
            <div className="flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-white/5">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black tracking-wide uppercase text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">
                            Escalation Intake Wizard
                        </DialogTitle>
                    </DialogHeader>

                    {/* Wizard Steps */}
                    <div className="mt-8">
                        <WizardSteps steps={WIZARD_STEPS} currentStep={currentStep} variant="orange" />
                    </div>
                </div>

                {/* Content */}
                <ScrollArea className="flex-1 p-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                            <AnimatePresence mode="wait">
                                {/* Step 1: Source Selection */}
                                {currentStep === 0 && (
                                    <motion.div
                                        key="step-0"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-6"
                                    >
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-black uppercase tracking-widest text-white/60">Escalation Source</h3>

                                            {/* Project Association Selection - Premium Cards */}
                                            <div className="space-y-4">
                                                <div className="flex flex-col gap-1">
                                                    <Label className="text-sm font-black uppercase tracking-[0.2em] text-amber-500/80">Context Selection</Label>
                                                    <p className="text-xs text-muted-foreground">Is this escalation tied to a specific onboarded project?</p>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <motion.button
                                                        type="button"
                                                        whileHover={{ scale: 1.02, translateY: -2 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={() => setIsProjectRelated(true)}
                                                        className={cn(
                                                            "relative group p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 text-center",
                                                            isProjectRelated
                                                                ? "bg-amber-500/10 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                                                                : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.08]"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                                                            isProjectRelated ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20" : "bg-white/5 text-white/40 group-hover:text-white/60"
                                                        )}>
                                                            <Briefcase className="w-6 h-6" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <span className={cn("text-xs font-black uppercase tracking-widest block", isProjectRelated ? "text-amber-500" : "text-white/40")}>Project-Based</span>
                                                            <p className="text-[10px] text-muted-foreground leading-tight">Escalation for an existing project client</p>
                                                        </div>
                                                        {isProjectRelated && (
                                                            <motion.div layoutId="active-highlight" className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center border-2 border-[#0A0A0B]">
                                                                <Check className="w-2.5 h-2.5 text-black stroke-[4px]" />
                                                            </motion.div>
                                                        )}
                                                    </motion.button>

                                                    <motion.button
                                                        type="button"
                                                        whileHover={{ scale: 1.02, translateY: -2 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={() => {
                                                            setIsProjectRelated(false);
                                                            form.setValue('project_id', undefined);
                                                            setSelectedProject(null);
                                                        }}
                                                        className={cn(
                                                            "relative group p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 text-center",
                                                            !isProjectRelated
                                                                ? "bg-amber-500/10 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                                                                : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.08]"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                                                            !isProjectRelated ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20" : "bg-white/5 text-white/40 group-hover:text-white/60"
                                                        )}>
                                                            <User className="w-6 h-6" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <span className={cn("text-xs font-black uppercase tracking-widest block", !isProjectRelated ? "text-amber-500" : "text-white/40")}>Direct Link</span>
                                                            <p className="text-[10px] text-muted-foreground leading-tight">Standalone escalation for a new contact</p>
                                                        </div>
                                                        {!isProjectRelated && (
                                                            <motion.div layoutId="active-highlight" className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center border-2 border-[#0A0A0B]">
                                                                <Check className="w-2.5 h-2.5 text-black stroke-[4px]" />
                                                            </motion.div>
                                                        )}
                                                    </motion.button>
                                                </div>
                                            </div>

                                            {/* Manual Concern Person Details (if NO - Project) */}
                                            {!isProjectRelated && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="space-y-4 pt-4 border-t border-white/10"
                                                >
                                                    <h4 className="text-sm font-bold uppercase tracking-wider text-amber-400">Concern Person Details</h4>

                                                    <FormField
                                                        control={form.control}
                                                        name="client_name"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Name (Optional)</FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder="Enter concern person name" {...field} className="bg-white/5 border-white/10 h-12" />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="client_phone"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Contact (Optional)</FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder="Enter contact number" {...field} className="bg-white/5 border-white/10 h-12" />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </motion.div>
                                            )}
                                            {/* Conditional: Project Selection (if YES - Project) */}
                                            {isProjectRelated && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="space-y-4 pt-4 border-t border-white/10"
                                                >
                                                    <h4 className="text-sm font-bold uppercase tracking-wider text-amber-400">Project Selection</h4>

                                                    <FormField
                                                        control={form.control}
                                                        name="project_id"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Select Project *</FormLabel>
                                                                <Select
                                                                    onValueChange={(value) => {
                                                                        field.onChange(value);
                                                                        handleProjectSelect(value);
                                                                    }}
                                                                    value={field.value}
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger className="bg-white/5 border-white/10 h-12">
                                                                            <SelectValue placeholder="Select project" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        {projects.map((project) => (
                                                                            <SelectItem key={project.id} value={project.id}>
                                                                                {project.project_name} - {project.client_name}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    {selectedProject && (
                                                        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl space-y-3">
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <User className="w-4 h-4 text-orange-400" />
                                                                <span className="text-muted-foreground">Client:</span>
                                                                <span className="font-bold text-white">{selectedProject.client_name}</span>
                                                            </div>
                                                            {selectedProject.client_contact && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <Phone className="w-4 h-4 text-orange-400" />
                                                                    <span className="text-muted-foreground">Phone:</span>
                                                                    <span className="font-bold text-white">{selectedProject.client_contact}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <Calendar className="w-4 h-4 text-orange-400" />
                                                                <span className="text-muted-foreground">Project Age:</span>
                                                                <span className="font-bold text-white">{getProjectAge(selectedProject.onboarded_date)}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <MapPin className="w-4 h-4 text-orange-400" />
                                                                <span className="text-muted-foreground">Location:</span>
                                                                <span className="font-bold text-white">{selectedProject.location_city}, {selectedProject.location_state}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 2: Issue */}
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

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="department"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Department *</FormLabel>
                                                            <Select
                                                                onValueChange={(value) => {
                                                                    field.onChange(value);
                                                                    const dept = value as WorkflowDepartment;

                                                                    // For Eng/Agri, reset bucket and ask for sub-division
                                                                    if (dept === 'Engineering' || dept === 'Agri Operations') {
                                                                        setSubDivision(null);
                                                                        form.setValue('bucket', undefined);
                                                                    } else {
                                                                        // For others, map directly to bucket
                                                                        setSubDivision(null);
                                                                        const bucketMap: Record<string, EscalationBucket> = {
                                                                            'HR': 'hr',
                                                                            'Business Development': 'business_development',
                                                                            'Buy-Back': 'buy_back',
                                                                            'Site Visit': 'site_visit',
                                                                            'Farm Manager': 'farm_manager',
                                                                            'Rental Sourcing': 'rental_sourcing',
                                                                            'TNSkill': 'tnskill',
                                                                            'Nursery & Landscaping': 'nursery_landscaping',
                                                                            'Head Office': 'head_office',
                                                                            'Purchase': 'purchase',
                                                                            'Vendor Sourcing': 'vendor_sourcing',
                                                                            'MTS': 'mts',
                                                                            'Marketing': 'marketing',
                                                                            'CRM': 'crm',
                                                                            'Data Analytics & Legal': 'data_analytics_legal',
                                                                            'Farmers Factory': 'farmers_factory',
                                                                            'AgriMart': 'agrimart',
                                                                            'Palm Cafe': 'palm_cafe',
                                                                            'Finance': 'finance',
                                                                            'R&D': 'rnd',
                                                                            'Accounts': 'accounts',
                                                                            'CEO Office': 'ceo_office',
                                                                            'Admin': 'admin',
                                                                            'IT & AI': 'it_ai',
                                                                            'Management Operations Team': 'management_ops',
                                                                            'Valluvam': 'valluvam'
                                                                        };
                                                                        const bucketVal = bucketMap[dept];
                                                                        if (bucketVal) {
                                                                            form.setValue('bucket', bucketVal);
                                                                        }
                                                                    }
                                                                }}
                                                                value={field.value}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger className="bg-white/5 border-white/10 h-12">
                                                                        <SelectValue placeholder="Select department" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {WORKFLOW_DEPARTMENTS.map((dept) => (
                                                                        <SelectItem key={dept.value} value={dept.value} className="flex items-center gap-2">
                                                                            {dept.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="urgency"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Urgency Level *</FormLabel>
                                                            <Select
                                                                onValueChange={field.onChange}
                                                                value={field.value}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger className="bg-white/5 border-white/10 h-12">
                                                                        <SelectValue placeholder="Select urgency" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="low">Low</SelectItem>
                                                                    <SelectItem value="medium">Medium</SelectItem>
                                                                    <SelectItem value="high">High</SelectItem>
                                                                    <SelectItem value="critical">Critical</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                {/* Conditional Sub-division for Eng/Agri */}
                                                {(form.watch('department') === 'Engineering' || form.watch('department') === 'Agri Operations') && (
                                                    <div className="space-y-2">
                                                        <Label className={!subDivision ? "text-destructive" : ""}>Sub-Division (JV/Direct) *</Label>
                                                        <Select
                                                            onValueChange={(val) => {
                                                                setSubDivision(val as 'jv' | 'direct');
                                                                const dept = form.getValues('department');
                                                                if (dept === 'Agri Operations') {
                                                                    form.setValue('bucket', val === 'jv' ? 'agri_jv' : 'agri_direct');
                                                                } else if (dept === 'Engineering') {
                                                                    form.setValue('bucket', val === 'jv' ? 'eng_jv' : 'eng_direct');
                                                                }
                                                            }}
                                                            value={subDivision || ''}
                                                        >
                                                            <SelectTrigger className="bg-white/5 border-white/10 h-12">
                                                                <SelectValue placeholder="Select type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="jv">Joint Venture (JV)</SelectItem>
                                                                <SelectItem value="direct">Direct / Owned</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                            </div>

                                            <FormField
                                                control={form.control}
                                                name="issue_title"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Issue Title *</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Brief title for the issue" {...field} className="bg-white/5 border-white/10 h-12" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="issue_description"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Issue Description *</FormLabel>
                                                        <FormControl>
                                                            <Textarea
                                                                placeholder="Detailed description of the client issue..."
                                                                rows={6}
                                                                {...field}
                                                                className="bg-white/5 border-white/10 resize-none"
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 3: Evidence */}
                                {currentStep === 2 && (
                                    <motion.div
                                        key="step-2"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-6"
                                    >
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-black uppercase tracking-widest text-white/60">Evidence Upload</h3>

                                            {/* Evidence Screenshot - Premium Upload Zone */}
                                            <div className="space-y-4">
                                                <div className="flex flex-col gap-1">
                                                    <Label className="text-sm font-black uppercase tracking-[0.2em] text-amber-500/80">Support Evidence</Label>
                                                    <p className="text-xs text-muted-foreground">Attach a screenshot or photographic proof of the issue</p>
                                                </div>

                                                {evidenceUrl ? (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="relative group overflow-hidden rounded-2xl border-2 border-green-500/30 bg-green-500/5 p-4 flex flex-col items-center gap-3"
                                                    >
                                                        <div className="w-16 h-16 rounded-xl bg-green-500/20 flex items-center justify-center text-green-500">
                                                            <CheckCircle2 className="w-8 h-8" />
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-sm font-bold text-green-400">Evidence Secured</p>
                                                            <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{evidenceFileName}</p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => { setEvidenceUrl(''); setEvidenceFileName(null); }}
                                                            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-500 transition-colors"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </motion.div>
                                                ) : (
                                                    <div className="relative group">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handleEvidenceUpload}
                                                            disabled={isUploadingEvidence}
                                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                        />
                                                        <motion.div
                                                            whileHover={{ borderColor: 'rgba(245, 158, 11, 0.4)', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                                                            className={cn(
                                                                "h-48 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-4 transition-all",
                                                                isUploadingEvidence ? "bg-white/5" : "bg-transparent group-hover:bg-white/[0.03]"
                                                            )}
                                                        >
                                                            <div className={cn(
                                                                "w-14 h-14 rounded-full flex items-center justify-center transition-all",
                                                                isUploadingEvidence ? "bg-amber-500 animate-pulse" : "bg-white/5 text-white/40 group-hover:bg-amber-500/10 group-hover:text-amber-500"
                                                            )}>
                                                                {isUploadingEvidence ? (
                                                                    <Loader2 className="w-6 h-6 animate-spin text-black" />
                                                                ) : (
                                                                    <Upload className="w-6 h-6" />
                                                                )}
                                                            </div>
                                                            <div className="text-center space-y-1">
                                                                <p className="text-sm font-black uppercase tracking-widest">
                                                                    {isUploadingEvidence ? "Uploading Evidence..." : "Drop Evidence Here"}
                                                                </p>
                                                                <p className="text-[10px] text-muted-foreground uppercase tracking-tight">
                                                                    PNG, JPG or PDF up to 10MB
                                                                </p>
                                                            </div>
                                                        </motion.div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* SLA Requirements - Refined */}
                                            <div className="p-5 bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-2xl relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                                    <Timer className="w-12 h-12" />
                                                </div>
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0">
                                                        <AlertCircle className="w-5 h-5" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-black uppercase tracking-widest text-amber-500">SLA Enforcement</p>
                                                        <div className="grid grid-cols-2 gap-4 mt-2">
                                                            <div className="space-y-0.5">
                                                                <p className="text-[10px] text-muted-foreground uppercase">ACK Window</p>
                                                                <p className="text-sm font-bold text-white">10 Minutes</p>
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <p className="text-[10px] text-muted-foreground uppercase">Resolution</p>
                                                                <p className="text-sm font-bold text-white">2 Hours</p>
                                                            </div>
                                                        </div>
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
                                            <h3 className="text-lg font-black uppercase tracking-widest text-white/60">Review & Confirm</h3>

                                            <div className="space-y-4 p-6 bg-white/5 border border-white/10 rounded-2xl">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Concern Person</p>
                                                        <p className="font-bold text-white">
                                                            {form.getValues('client_name') || (isProjectRelated ? 'Selected Project' : 'Direct Client')}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Department</p>
                                                        <Badge variant="outline">{ESCALATION_BUCKETS.find(b => b.value === form.getValues('bucket'))?.label}</Badge>
                                                    </div>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Issue</p>
                                                    <p className="font-bold text-white">{form.getValues('issue_title')}</p>
                                                    <p className="text-sm text-muted-foreground mt-2">{form.getValues('issue_description')}</p>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                                                    <div className="flex items-center gap-2">
                                                        <ImageIcon className="w-4 h-4 text-green-500" />
                                                        <span className="text-sm">
                                                            {evidenceUrl ? 'Evidence Uploaded' : isCEO ? 'CEO Direct (No Evidence Needed)' : 'No Evidence'}
                                                        </span>
                                                    </div>

                                                </div>
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
                        <Button onClick={handleNext} className="gap-2 bg-orange-600 hover:bg-orange-700 font-bold transition-all shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                            Next
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button
                            onClick={form.handleSubmit(handleSubmit)}
                            disabled={isSaving}
                            className="gap-2 bg-green-600 hover:bg-green-700 font-black tracking-widest uppercase"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Submit Escalation
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div >
        </DialogContent >
    );
}
