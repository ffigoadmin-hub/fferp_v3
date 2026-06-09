import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, Smartphone, ExternalLink, FileText, Clock, Building, MapPin, AlertTriangle, History, Download, Loader2, CreditCard, ShoppingCart, FolderKanban, Flag, CheckCircle2, Circle, TrendingUp, Calendar, Layers, Camera, Users, ShieldAlert, XCircle, Timer, PhoneCall, MessageSquare, Mail } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { useProjectTimeline } from '@/hooks/useProjectTimeline';
import { useProjectPhases } from '@/hooks/useProjectPhases';
import { useDailySiteUpdates } from '@/hooks/useDailySiteUpdates';
import { useMilestones } from '@/hooks/useMilestones';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

// Types (Mirrored from ProjectsPage to avoid circular deps or complex imports for now)
interface Project {
    id: string;
    project_id: string;
    project_name: string;
    location_city: string;
    location_state: string;
    vertical: string;
    project_type?: string;
    current_spend: number;
    client_name: string;
    client_contact: string;
    assigned_manager_id: string | null;
    assigned_engineer_id: string | null;
    target_start_date: string;
    target_completion_date: string;
    status: string;
    remarks: string | null;
    created_at: string;
    manager?: { name: string };
    engineer?: { name: string };
    deal_file_url: string | null;
    jv_commitments: string | null;
    approved_budget: number;
    total_project_value: number;
}

interface ProjectDetailsDialogProps {
    project: Project | null;
    stats?: { total_escalations: number; critical_escalations: number };
    onClose: () => void;
    statusColors: Record<string, string>;
    initialTab?: string;
}

export function ProjectDetailsDialog({ project, stats, onClose, statusColors, initialTab = 'overview' }: ProjectDetailsDialogProps) {
    const { user } = useAuth();
    const { phases, isLoading: loadingPhases } = useProjectPhases(project?.id || '');
    const queryClient = useQueryClient();
    const [showLiveUpdate, setShowLiveUpdate] = useState(false);
    const [activeTab, setActiveTab] = useState(initialTab);

    // Sync activeTab when initialTab prop changes (e.g. clicking escalation from card)
    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab, project?.id]);

    const { milestones, isLoading: loadingMilestones } = useMilestones(project?.id || '');

    const { data: projectPayments, isLoading: loadingPayments } = useQuery({
        queryKey: ['project-payments', project?.id],
        queryFn: async () => {
            if (!project) return [];
            const { data, error } = await supabase
                .from('payment_requests')
                .select('*, requester:profiles!payment_requests_requester_id_fkey(name)')
                .eq('project_id', project.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!project,
    });

    const { data: projectWOs, isLoading: loadingWOs } = useQuery({
        queryKey: ['project-work-orders', project?.id],
        queryFn: async () => {
            if (!project) return [];
            const { data, error } = await supabase
                .from('work_orders')
                .select(`
                    *,
                    requester:profiles!work_orders_requester_id_fkey(name),
                    phase:project_phases!work_orders_project_phase_id_fkey(id, phase_name),
                    milestone:project_milestones!work_orders_project_milestone_id_fkey(id, description)
                `)
                .eq('project_id', project.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!project,
    });

    const { data: projectPOs, isLoading: loadingPOs } = useQuery({
        queryKey: ['project-purchase-orders', project?.id],
        queryFn: async () => {
            if (!project) return [];
            const { data, error } = await supabase
                .from('purchase_orders')
                .select('*, requester:profiles!purchase_orders_requester_id_fkey(name)')
                .eq('project_id', project.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!project,
    });

    const { data: executionProofs } = useQuery({
        queryKey: ['project-execution-proofs', project?.id],
        queryFn: async () => {
            if (!project) return [];
            const { data, error } = await supabase
                .from('project_execution_proofs')
                .select('*')
                .eq('project_id', project.id)
                .order('uploaded_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!project,
    });

    // Fetch client escalations for this project
    const { data: projectEscalations, isLoading: loadingEscalations } = useQuery({
        queryKey: ['project-client-escalations', project?.id],
        queryFn: async () => {
            if (!project) return [];
            const { data, error } = await supabase
                .from('client_escalations')
                .select(`
                    *,
                    creator:profiles!client_escalations_created_by_fkey(name, email),
                    resolver:profiles!client_escalations_resolved_by_fkey(name, email)
                `)
                .eq('project_id', project.id)
                .order('created_at', { ascending: false });
            if (error) {
                console.error('Error fetching project escalations:', error);
                return [];
            }
            return data || [];
        },
        enabled: !!project,
    });

    const openEscalations = (projectEscalations || []).filter((e: any) => !['resolved', 'closed'].includes(e.status));
    const closedEscalations = (projectEscalations || []).filter((e: any) => ['resolved', 'closed'].includes(e.status));
    const criticalEscalations = (projectEscalations || []).filter((e: any) => e.priority === 'critical' || e.severity === 'critical');
    const breachedEscalations = (projectEscalations || []).filter((e: any) => e.status === 'breached' || e.ack_late);

    const { entries: timelineEntries, isLoading: loadingTimeline } = useProjectTimeline(project?.id || '');
    const { updates: siteUpdates, isLoading: isLoadingUpdates } = useDailySiteUpdates(project?.id || '');
    
    const totalProjectExpense = useMemo(() => {
        return projectPayments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
    }, [projectPayments]);

    const allDocuments = useMemo(() => {
        if (!project) return [];
        const docs: any[] = [];

        if (project.deal_file_url) {
            docs.push({ name: 'Project Deal Document', url: project.deal_file_url, type: 'Project', date: project.created_at });
        }

        projectPOs?.forEach((po: any) => {
            if (po.po_document_url) docs.push({ name: `${po.po_number} - PO Document`, url: po.po_document_url, type: 'Purchase Order', date: po.created_at });
            if (po.vendor_invoice_url) docs.push({ name: `${po.po_number} - Vendor Invoice`, url: po.vendor_invoice_url, type: 'Purchase Order', date: po.updated_at });
            if (po.cost_comparison_url) docs.push({ name: `${po.po_number} - Cost Comparison`, url: po.cost_comparison_url, type: 'Purchase Order', date: po.created_at });
        });

        projectWOs?.forEach((wo: any) => {
            if (wo.wo_document_url) docs.push({ name: `${wo.wo_number} - WO Document`, url: wo.wo_document_url, type: 'Work Order', date: wo.created_at });
        });

        projectPayments?.forEach((pay: any) => {
            if (pay.bill_url) docs.push({ name: `Payment ${pay.payment_number} - Bill`, url: pay.bill_url, type: 'Payment', date: pay.created_at });
            if (pay.payment_proof_url || pay.payment_proof_screenshot) docs.push({ name: `Payment ${pay.payment_number} - Transaction Proof`, url: pay.payment_proof_url || pay.payment_proof_screenshot, type: 'Payment', date: pay.paid_at || pay.created_at });
            if (pay.work_proof_url) docs.push({ name: `Payment ${pay.payment_number} - Bank Proof`, url: pay.work_proof_url, type: 'Payment', date: pay.created_at });
        });

        executionProofs?.forEach((proof: any) => {
            if (proof.file_url) {
                docs.push({ 
                    name: proof.notes || 'Daily Site Update', 
                    url: proof.file_url, 
                    type: 'Daily Site Update', 
                    date: proof.uploaded_at 
                });
            }
        });

        return docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [project, projectPOs, projectWOs, projectPayments, executionProofs]);

    // Real-time synchronization within the dialog
    useEffect(() => {
        if (!project?.id) return;

        const channel = supabase
            .channel(`project-details-${project.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'payment_requests', filter: `project_id=eq.${project.id}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['project-payments', project.id] });
                    setShowLiveUpdate(true);
                    setTimeout(() => setShowLiveUpdate(false), 3000);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'work_orders', filter: `project_id=eq.${project.id}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['project-work-orders', project.id] });
                    setShowLiveUpdate(true);
                    setTimeout(() => setShowLiveUpdate(false), 3000);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'purchase_orders', filter: `project_id=eq.${project.id}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['project-purchase-orders', project.id] });
                    setShowLiveUpdate(true);
                    setTimeout(() => setShowLiveUpdate(false), 3000);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${project.id}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['projects'] });
                    setShowLiveUpdate(true);
                    setTimeout(() => setShowLiveUpdate(false), 3000);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'escalations', filter: `project_id=eq.${project.id}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['projects'] });
                    queryClient.invalidateQueries({ queryKey: ['project-escalation-stats'] });
                    setShowLiveUpdate(true);
                    setTimeout(() => setShowLiveUpdate(false), 3000);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [project?.id, queryClient]);

    const [editedRemarks, setEditedRemarks] = useState(project?.remarks || '');
    const [isSavingRemarks, setIsSavingRemarks] = useState(false);

    useEffect(() => {
        if (project?.remarks !== undefined) {
            setEditedRemarks(project.remarks || '');
        }
    }, [project?.remarks]);

    const handleSaveRemarks = async () => {
        if (!project?.id) return;
        setIsSavingRemarks(true);
        try {
            const { error } = await supabase
                .from('projects')
                .update({ remarks: editedRemarks })
                .eq('id', project.id);

            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        } catch (error) {
            console.error('Error saving remarks:', error);
        } finally {
            setIsSavingRemarks(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid': return 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30';
            case 'ceo_approved': return 'bg-blue-500/20 text-blue-600 border-blue-500/30';
            case 'admin_approved': return 'bg-indigo-500/20 text-indigo-600 border-indigo-500/30';
            case 'pending': return 'bg-orange-500/20 text-orange-600 border-orange-500/30';
            case 'rejected': return 'bg-red-500/20 text-red-600 border-red-500/30';
            case 'ceo_hold': return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
            default: return 'bg-muted text-muted-foreground';
        }
    };

    const InfoCard = ({ icon: Icon, label, value, subValue, className }: any) => (
        <div className={cn("bg-card/50 backdrop-blur-sm border rounded-xl p-4 flex items-start gap-4 hover:bg-card/80 transition-colors", className)}>
            <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                    <p className="font-semibold text-base">{value}</p>
                    {subValue && !subValue.includes('9949') && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">{subValue}</span>}
                </div>
                {subValue && subValue.includes('9949') && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
            </div>
        </div>
    );

    const today = new Date();
    const startDate = new Date(project?.target_start_date || today);
    const endDate = new Date(project?.target_completion_date || today);
    const totalDays = differenceInDays(endDate, startDate) + 1;
    const elapsedDays = differenceInDays(today, startDate);
    const executionProgress = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

    const availableTabs = useMemo(() => {
        const tabs = ['Overview', 'Financials', 'Timeline', 'Docs'];
        const role = user?.role?.toLowerCase();
        if (['ceo', 'gm', 'admin', 'manager', 'engineer', 'smo', 'gmo'].includes(role || '')) {
            tabs.splice(2, 0, 'Phases', 'Milestones');
        }
        // Always add Escalations tab
        tabs.push('Escalations');
        return tabs;
    }, [user?.role]);

    const WorkOrderApprovalProgress = ({ wo }: { wo: any }) => {
        const stages = [
            { label: 'SMO-P', date: wo.smo_approved_at, by: wo.smo_rejection_reason ? 'Rejected' : (wo.smo_approved_by ? 'Approved' : 'Pending') },
            { label: 'GMO-P', date: wo.gmo_approved_at, by: wo.gmo_rejection_reason ? 'Rejected' : (wo.gmo_approved_by ? 'Approved' : 'Pending') },
            { label: 'GM', date: wo.gm_approved_at, by: wo.gm_rejection_reason ? 'Rejected' : (wo.gm_approved_by ? 'Approved' : 'Pending') },
            { label: 'Admin', date: wo.admin_approved_at, by: wo.admin_rejection_reason ? 'Rejected' : (wo.admin_approved_by ? 'Approved' : 'Pending') },
            { label: 'CEO', date: wo.ceo_approved_at, by: wo.ceo_hold_reason ? 'Hold' : (wo.ceo_approved_by ? 'Approved' : 'Pending') }
        ];

        return (
            <div className="flex items-center gap-1 mt-2">
                {stages.map((stage, idx) => {
                    const isDone = !!stage.date;
                    const isRejected = stage.by === 'Rejected';
                    const isHold = stage.by === 'Hold';
                    return (
                        <div key={stage.label} className="flex items-center">
                            <div className="flex flex-col items-center">
                                <div className={cn(
                                    "w-3 h-3 rounded-full border-2 flex items-center justify-center",
                                    isDone ? "bg-emerald-500 border-emerald-500" : isRejected ? "bg-red-500 border-red-500" : isHold ? "bg-yellow-500 border-yellow-500" : "bg-transparent border-muted-foreground/30"
                                )}>
                                    {isDone && <CheckCircle2 className="w-2 h-2 text-white" />}
                                </div>
                                <span className="text-[7px] font-bold mt-0.5 uppercase opacity-60">{stage.label}</span>
                            </div>
                            {idx < stages.length - 1 && (
                                <div className={cn("w-3 h-0.5 mb-2 mx-0.5 rounded-full", isDone ? "bg-emerald-500" : "bg-muted/40")} />
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <Dialog open={!!project} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl h-[90vh] p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border/50 shadow-2xl flex flex-col">

                {/* Header (Pro Max) */}
                <div className="p-6 border-b border-border/50 bg-muted/20">
                    <DialogHeader>
                        <div className="flex justify-between items-start">
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="h-6 bg-background border-primary/20 text-primary font-mono">
                                        {project?.project_id}
                                    </Badge>
                                    {project && (
                                        <Badge className={cn("h-6 uppercase", statusColors[project.status])}>
                                            {project.status}
                                        </Badge>
                                    )}
                                </div>
                                <DialogTitle className="text-2xl font-bold tracking-tight">
                                    {project?.project_name}
                                </DialogTitle>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary/70" /> {project?.location_city}, {project?.location_state}</span>
                                    <span className="flex items-center gap-1.5"><Building className="w-4 h-4 text-primary/70" /> {project?.vertical} ({project?.project_type})</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {showLiveUpdate && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-status-live/10 border border-status-live/20 text-status-live">
                                        <span className="relative flex h-2 w-2">
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-status-live"></span>
                                        </span>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Real-time Update</span>
                                    </div>
                                )}
                                {project?.deal_file_url && (
                                    <a href={project.deal_file_url} target="_blank" rel="noopener noreferrer">
                                        <Button variant="outline" className="gap-2 bg-background/50 hover:bg-background border-primary/20 hover:border-primary/50 group">
                                            <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" alt="Drive" className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all" />
                                            Project Folder
                                            <ExternalLink className="w-3 h-3 opacity-50" />
                                        </Button>
                                    </a>
                                )}
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                {project && (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-6 border-b border-border/50 bg-background/50">
                            <TabsList className="bg-transparent h-12 p-0 space-x-6">
                                {availableTabs.map(tab => (
                                    <TabsTrigger
                                        key={tab}
                                        value={tab.toLowerCase()}
                                        className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 font-medium"
                                    >
                                        {tab}
                                        {tab === 'Escalations' && (openEscalations.length > 0) && (
                                            <span className={cn(
                                                "ml-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full",
                                                breachedEscalations.length > 0 || criticalEscalations.length > 0
                                                    ? "bg-red-500 text-white animate-pulse"
                                                    : "bg-orange-500/80 text-white"
                                            )}>
                                                {openEscalations.length}
                                            </span>
                                        )}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1 bg-muted/5">
                            <div className="p-6">
                                <TabsContent value="overview" className="mt-0 space-y-5 focus-visible:outline-none">
                                    {/* Key Info Grid - Team Members */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                                        <InfoCard
                                            icon={User}
                                            label="Client"
                                            value={project.client_name}
                                            subValue="Primary"
                                            className="cursor-default hover:shadow-md transition-shadow"
                                        />
                                        <InfoCard
                                            icon={User}
                                            label="Manager"
                                            value={project.manager?.name || 'Unassigned'}
                                            className={cn(
                                                "cursor-default hover:shadow-md transition-shadow",
                                                !project.manager && "opacity-60"
                                            )}
                                        />
                                        <InfoCard
                                            icon={User}
                                            label="Engineer"
                                            value={project.engineer?.name || 'Unassigned'}
                                            className={cn(
                                                "cursor-default hover:shadow-md transition-shadow",
                                                !project.engineer && "opacity-60"
                                            )}
                                        />
                                    </div>

                                    {/* Visual Timeline - Full Width */}
                                    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm p-6 hover:border-primary/20 transition-all duration-300 group shadow-sm hover:shadow-md">
                                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                        <div className="relative">
                                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-5 flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-primary/10">
                                                    <Clock className="w-3.5 h-3.5 text-primary" />
                                                </div>
                                                <span>Visual Timeline</span>
                                            </h4>
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="flex-1 h-2 bg-muted/60 rounded-full overflow-hidden shadow-inner"
                                                    >
                                                        <div
                                                            className={cn(
                                                                "h-full bg-gradient-to-r from-primary via-primary to-status-live shadow-[0_0_10px_rgba(34,197,94,0.4)] relative",
                                                                `w-[${Math.min(executionProgress, 100)}%]`
                                                            )}
                                                        >
                                                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-lg" />
                                                        </div>
                                                    </div>
                                                    <span className="text-sm font-bold text-primary min-w-[50px] text-right">
                                                        {Math.min(executionProgress, 100)}%
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center pt-2">
                                                    <div className="flex flex-col items-start">
                                                        <span className="text-[9px] text-muted-foreground/60 font-mono uppercase tracking-wider mb-1">Start Date</span>
                                                        <span className="text-sm font-semibold text-foreground">{format(new Date(project.target_start_date), 'dd MMM yyyy')}</span>
                                                    </div>
                                                    <div className="flex flex-col items-center px-4">
                                                        <span className="text-[9px] text-primary font-mono uppercase tracking-wider mb-1">Today</span>
                                                        <span className="text-sm font-bold text-primary">{format(new Date(), 'dd MMM yyyy')}</span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] text-muted-foreground/60 font-mono uppercase tracking-wider mb-1">Target Date</span>
                                                        <span className="text-sm font-semibold text-foreground">{format(new Date(project.target_completion_date), 'dd MMM yyyy')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats Grid - 2 Columns */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                        <InfoCard
                                            icon={Smartphone}
                                            label="Contact"
                                            value={project.client_contact || 'N/A'}
                                            className="cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all duration-200"
                                        />
                                        <InfoCard
                                            icon={History}
                                            label="Ageing"
                                            value={`${Math.max(1, (differenceInDays(new Date(), new Date(project.target_start_date)) + 1))} Days`}
                                            subValue={project.target_completion_date && new Date() > new Date(project.target_completion_date) ? "Deadline Crossed" : "Target: " + format(new Date(project.target_completion_date), 'dd MMM')}
                                            className={cn(
                                                "cursor-default transition-all duration-300",
                                                project.target_completion_date && new Date() > new Date(project.target_completion_date)
                                                    ? "bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                                                    : "bg-gradient-to-br from-card to-card/60 hover:bg-muted/30 hover:shadow-md"
                                            )}
                                        />
                                    </div>

                                    {/* Escalations - Full Width — clickable → switches to Escalations tab */}
                                    <div
                                        className={cn(
                                            "bg-card/50 backdrop-blur-sm border rounded-xl p-4 flex items-start gap-4 transition-all duration-300 cursor-pointer hover:scale-[1.005] group",
                                            criticalEscalations.length > 0 || breachedEscalations.length > 0
                                                ? "border-red-500/50 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.15)] hover:shadow-[0_0_25px_rgba(239,68,68,0.2)]"
                                                : openEscalations.length > 0
                                                    ? "border-orange-500/30 bg-orange-500/5 hover:border-orange-500/50 hover:shadow-md"
                                                    : "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/30 hover:shadow-sm"
                                        )}
                                        onClick={() => setActiveTab('escalations')}
                                        title="Click to view all escalations"
                                    >
                                        <div className={cn(
                                            "p-2.5 rounded-lg",
                                            criticalEscalations.length > 0 ? "bg-red-500/20 text-red-500" : openEscalations.length > 0 ? "bg-orange-500/20 text-orange-500" : "bg-emerald-500/20 text-emerald-500"
                                        )}>
                                            <ShieldAlert className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Escalations</p>
                                            <div className="flex items-baseline gap-3 mt-0.5 flex-wrap">
                                                <p className="font-semibold text-base">{openEscalations.length} Open</p>
                                                {criticalEscalations.length > 0 && (
                                                    <span className="text-[10px] text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">{criticalEscalations.length} Critical</span>
                                                )}
                                                {breachedEscalations.length > 0 && (
                                                    <span className="text-[10px] text-white bg-red-600 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">{breachedEscalations.length} SLA Breached</span>
                                                )}
                                                {closedEscalations.length > 0 && (
                                                    <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold uppercase">{closedEscalations.length} Resolved</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all">
                                            <ExternalLink className="w-4 h-4" />
                                        </div>
                                    </div>

                                    {/* JV Commitments */}
                                    {project.jv_commitments && (
                                        <div className="p-4 rounded-xl border border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10 dark:border-yellow-800/30">
                                            <h4 className="flex items-center gap-2 font-semibold text-yellow-800 dark:text-yellow-500 mb-2">
                                                <AlertTriangle className="w-4 h-4" />
                                                JV Commitments & Special Terms
                                            </h4>
                                            <p className="text-sm text-yellow-700/80 dark:text-yellow-400/80 leading-relaxed whitespace-pre-wrap">
                                                {project.jv_commitments}
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="border rounded-xl bg-card p-4 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h4 className="font-semibold flex items-center gap-2.5">
                                                    <div className="p-1.5 rounded-lg bg-primary/10">
                                                        <FileText className="w-4 h-4 text-primary" />
                                                    </div>
                                                    <span className="text-foreground/90">Project Remarks</span>
                                                </h4>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className={cn(
                                                        "h-8 text-[11px] font-bold uppercase tracking-widest transition-all duration-200",
                                                        (isSavingRemarks || (editedRemarks || '').trim() === (project?.remarks || '').trim())
                                                            ? "text-muted-foreground cursor-not-allowed"
                                                            : "text-primary hover:bg-primary/10 hover:text-primary cursor-pointer"
                                                    )}
                                                    disabled={isSavingRemarks || (editedRemarks || '').trim() === (project?.remarks || '').trim()}
                                                    onClick={handleSaveRemarks}
                                                >
                                                    {isSavingRemarks ? (
                                                        <span className="flex items-center gap-2">
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                            Saving...
                                                        </span>
                                                    ) : 'Record Remarks'}
                                                </Button>
                                            </div>
                                            <textarea
                                                className="w-full min-h-[140px] p-4 rounded-xl bg-muted/30 border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all resize-none leading-relaxed font-medium placeholder:text-muted-foreground/40 hover:bg-muted/40 hover:border-border/60"
                                                placeholder="Enter project updates, milestones, or concerns here..."
                                                value={editedRemarks}
                                                onChange={(e) => setEditedRemarks(e.target.value)}
                                                maxLength={1000}
                                            />
                                            <div className="flex justify-end pr-1">
                                                <span className={cn(
                                                    "text-[10px] font-bold tracking-widest uppercase",
                                                    (editedRemarks?.length || 0) > 900 ? "text-red-500" : "text-muted-foreground/40"
                                                )}>
                                                    {editedRemarks?.length || 0} / 1000
                                                </span>
                                            </div>
                                        </div>

                                        {/* Site Updates Feed */}
                                        <div className="border rounded-xl bg-card p-4 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h4 className="font-semibold flex items-center gap-2.5">
                                                    <div className="p-1.5 rounded-lg bg-emerald-500/10">
                                                        <Camera className="w-4 h-4 text-emerald-500" />
                                                    </div>
                                                    <span className="text-foreground/90">Recent Site Updates</span>
                                                </h4>
                                            </div>

                                            <div className="space-y-4">
                                                {isLoadingUpdates ? (
                                                    <div className="flex items-center justify-center py-8">
                                                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                                    </div>
                                                ) : siteUpdates.length === 0 ? (
                                                    <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg">
                                                        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                                        <p className="text-xs">No site updates recorded yet</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                                                        {siteUpdates.map((update, idx) => (
                                                            <div key={update.id} className="relative pl-6 pb-4 last:pb-0 border-l border-border/50">
                                                                <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                                                                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span className="text-xs font-bold text-primary">
                                                                            {format(new Date(update.update_date), 'dd MMM yyyy')}
                                                                        </span>
                                                                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                                                            Reported by {update.reporter?.name || 'Engineer'}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                                                                        {update.work_done}
                                                                    </p>
                                                                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-bold uppercase tracking-widest pt-1">
                                                                        {update.labor_count > 0 && (
                                                                            <span className="flex items-center gap-1">
                                                                                <Users className="w-3 h-3" />
                                                                                {update.labor_count} Labors
                                                                            </span>
                                                                        )}
                                                                        {update.progress_percentage > 0 && (
                                                                            <span className="flex items-center gap-1">
                                                                                <TrendingUp className="w-3 h-3" />
                                                                                {update.progress_percentage}% Done
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* ═══════════════════════════════════════════════
                                    ESCALATIONS TAB  —  Premium Redesign
                                ═══════════════════════════════════════════════ */}
                                <TabsContent value="escalations" className="mt-0 focus-visible:outline-none">
                                    {loadingEscalations ? (
                                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                                            <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
                                            <p className="text-xs text-muted-foreground">Loading escalations…</p>
                                        </div>
                                    ) : (projectEscalations || []).length === 0 ? (
                                        /* ── Empty State ── */
                                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 ring-4 ring-emerald-500/10">
                                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                                            </div>
                                            <p className="font-bold text-base text-foreground/80">All Clear</p>
                                            <p className="text-sm mt-1">No escalations reported for this project.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-5">

                                            {/* ── Stats Banner ── */}
                                            <div className="grid grid-cols-4 gap-2.5">
                                                {[
                                                    {
                                                        label: 'Total',
                                                        value: (projectEscalations || []).length,
                                                        icon: ShieldAlert,
                                                        color: 'text-foreground',
                                                        iconColor: 'text-muted-foreground',
                                                        bg: 'bg-muted/40',
                                                        border: 'border-border/40',
                                                        glow: '',
                                                    },
                                                    {
                                                        label: 'Open',
                                                        value: openEscalations.length,
                                                        icon: AlertTriangle,
                                                        color: 'text-orange-400',
                                                        iconColor: 'text-orange-400',
                                                        bg: 'bg-orange-500/[0.06]',
                                                        border: 'border-orange-500/25',
                                                        glow: openEscalations.length > 0 ? 'shadow-[0_0_12px_rgba(249,115,22,0.08)]' : '',
                                                    },
                                                    {
                                                        label: 'SLA Breached',
                                                        value: breachedEscalations.length,
                                                        icon: Timer,
                                                        color: 'text-red-400',
                                                        iconColor: 'text-red-400',
                                                        bg: 'bg-red-500/[0.06]',
                                                        border: 'border-red-500/25',
                                                        glow: breachedEscalations.length > 0 ? 'shadow-[0_0_16px_rgba(239,68,68,0.12)]' : '',
                                                    },
                                                    {
                                                        label: 'Resolved',
                                                        value: closedEscalations.length,
                                                        icon: CheckCircle2,
                                                        color: 'text-emerald-400',
                                                        iconColor: 'text-emerald-400',
                                                        bg: 'bg-emerald-500/[0.06]',
                                                        border: 'border-emerald-500/25',
                                                        glow: '',
                                                    },
                                                ].map(s => {
                                                    const SIcon = s.icon;
                                                    return (
                                                        <div key={s.label} className={cn(
                                                            'rounded-xl border p-3.5 flex flex-col gap-2 relative overflow-hidden',
                                                            s.bg, s.border, s.glow
                                                        )}>
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{s.label}</p>
                                                                <SIcon className={cn('w-3.5 h-3.5', s.iconColor)} />
                                                            </div>
                                                            <p className={cn('text-3xl font-black leading-none', s.color)}>{s.value}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* ── Escalation Cards ── */}
                                            <div className="space-y-2.5">
                                                {(projectEscalations || []).map((esc: any) => {
                                                    const isResolved = ['resolved', 'closed'].includes(esc.status);
                                                    const isBreached = esc.status === 'breached' || esc.ack_late;
                                                    const isCritical = esc.priority === 'critical' || esc.severity === 'critical';
                                                    const isHigh = esc.priority === 'high' || esc.severity === 'high';

                                                    const SourceIcon = esc.complaint_source === 'call' ? PhoneCall
                                                        : esc.complaint_source === 'email' ? Mail
                                                        : MessageSquare;

                                                    // Left-border color
                                                    const accentColor = isResolved ? 'border-l-emerald-500'
                                                        : isBreached ? 'border-l-red-500'
                                                        : isCritical ? 'border-l-red-400'
                                                        : isHigh ? 'border-l-orange-400'
                                                        : 'border-l-border';

                                                    return (
                                                        <div key={esc.id} className={cn(
                                                            'rounded-xl border border-border/50 border-l-4 bg-card/60 backdrop-blur-sm',
                                                            'hover:bg-card/80 transition-all duration-200',
                                                            'overflow-hidden',
                                                            accentColor,
                                                            isBreached && 'shadow-[0_0_20px_rgba(239,68,68,0.1)] border-red-500/30',
                                                        )}>

                                                            {/* ── Card Header ── */}
                                                            <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                                                                <div className="flex-1 min-w-0">
                                                                    {/* Ticket row */}
                                                                    <div className="flex items-center gap-2 flex-wrap mb-2">
                                                                        <span className="font-mono text-xs font-bold text-foreground/50 bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                                                                            ESC-{String(esc.ticket_number || '?').padStart(3, '0')}
                                                                        </span>
                                                                        {/* Severity pill */}
                                                                        <span className={cn(
                                                                            'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full',
                                                                            isCritical ? 'bg-red-500 text-white animate-pulse'
                                                                                : isBreached ? 'bg-red-600/80 text-white animate-pulse'
                                                                                : isHigh ? 'bg-orange-500/80 text-white'
                                                                                : 'bg-muted text-muted-foreground'
                                                                        )}>
                                                                            {isBreached && !isCritical ? 'SLA Breach' : (esc.priority || esc.severity || 'normal')}
                                                                        </span>
                                                                        {/* Source */}
                                                                        {esc.complaint_source && (
                                                                            <span className="flex items-center gap-1 text-[9px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded capitalize">
                                                                                <SourceIcon className="w-2.5 h-2.5" />
                                                                                {esc.complaint_source}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {/* Title */}
                                                                    <p className="font-semibold text-sm text-foreground leading-snug">
                                                                        {esc.issue_title || esc.title || 'Unnamed Issue'}
                                                                    </p>
                                                                </div>

                                                                {/* Status chip — right aligned */}
                                                                <div className={cn(
                                                                    'shrink-0 text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border',
                                                                    isResolved
                                                                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                                                        : isBreached
                                                                            ? 'border-red-500/40 bg-red-500/10 text-red-400'
                                                                            : 'border-orange-500/30 bg-orange-500/10 text-orange-400'
                                                                )}>
                                                                    {esc.status?.replace(/_/g, ' ') || 'Unknown'}
                                                                </div>
                                                            </div>

                                                            {/* ── Complaint body ── */}
                                                            {(esc.issue_description || esc.complaint_text) && (
                                                                <div className="px-4 pb-3">
                                                                    <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3 border-l-2 border-border/40 pl-2.5 italic">
                                                                        "{esc.issue_description || esc.complaint_text}"
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {/* ── Meta footer ── */}
                                                            <div className="px-4 pb-3 pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground/70 border-t border-border/30">
                                                                {esc.client_name && (
                                                                    <span className="flex items-center gap-1 font-medium text-foreground/50">
                                                                        <User className="w-3 h-3" />
                                                                        {esc.client_name}
                                                                    </span>
                                                                )}
                                                                {esc.creator?.name && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Users className="w-3 h-3" />
                                                                        By {esc.creator.name}
                                                                    </span>
                                                                )}
                                                                <span className="flex items-center gap-1">
                                                                    <Calendar className="w-3 h-3" />
                                                                    {format(new Date(esc.created_at), 'dd MMM yyyy, HH:mm')}
                                                                </span>
                                                                {esc.resolve_deadline && !isResolved && (
                                                                    <span className={cn(
                                                                        'flex items-center gap-1 font-bold ml-auto',
                                                                        isBreached ? 'text-red-400' : 'text-orange-400'
                                                                    )}>
                                                                        <Timer className="w-3 h-3" />
                                                                        {isBreached ? 'SLA Expired' : `Due ${format(new Date(esc.resolve_deadline), 'dd MMM, HH:mm')}`}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* ── Resolution Section (resolved only) ── */}
                                                            {isResolved && esc.resolution_text && (
                                                                <div className="mx-4 mb-4 rounded-lg bg-emerald-500/[0.05] border border-emerald-500/20 px-3.5 py-3">
                                                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                                        <CheckCircle2 className="w-3 h-3" />
                                                                        Resolution
                                                                    </p>
                                                                    <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3">
                                                                        {esc.resolution_text}
                                                                    </p>
                                                                    {esc.resolver?.name && (
                                                                        <p className="text-[10px] text-emerald-500/70 mt-2 font-medium">
                                                                            ✓ Resolved by {esc.resolver.name}
                                                                            {esc.resolved_at ? ` · ${format(new Date(esc.resolved_at), 'dd MMM yyyy')}` : ''}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="financials" className="mt-0 space-y-6 focus-visible:outline-none">
                                    <div className="flex gap-4 mb-4">
                                        <div className="flex-1 bg-card border rounded-xl p-4 flex items-center gap-4">
                                            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-lg"><CreditCard className="w-6 h-6" /></div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Total Payments</p>
                                                <p className="text-2xl font-bold">{projectPayments?.length || 0}</p>
                                            </div>
                                        </div>
                                        <div className="flex-1 bg-card border rounded-xl p-4 flex items-center gap-4">
                                            <div className="p-3 bg-purple-500/10 text-purple-600 rounded-lg"><FileText className="w-6 h-6" /></div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Work Orders</p>
                                                <p className="text-2xl font-bold">{projectWOs?.length || 0}</p>
                                            </div>
                                        </div>
                                        <div className="flex-1 bg-card border rounded-xl p-4 flex items-center gap-4">
                                            <div className="p-3 bg-pink-500/10 text-pink-600 rounded-lg"><ShoppingCart className="w-6 h-6" /></div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Purchase Orders</p>
                                                <p className="text-2xl font-bold">{projectPOs?.length || 0}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Client Payment Timeline */}
                                    <div className="border rounded-xl overflow-hidden bg-card">
                                        <div className="px-4 py-3 border-b bg-muted/30 font-semibold flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CreditCard className="w-4 h-4" /> Project Expense Timeline
                                            </div>
                                            <div className="text-xs font-normal text-muted-foreground">
                                                Total Project Expense: <span className="font-mono font-medium text-foreground">₹{totalProjectExpense.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        {(!projectPayments || projectPayments.length === 0) ? (
                                            <div className="p-8 text-center text-muted-foreground text-sm">No payments recorded yet.</div>
                                        ) : (
                                            <div className="divide-y max-h-[400px] overflow-y-auto">
                                                <div className="grid grid-cols-12 gap-4 p-3 bg-muted/10 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                    <div className="col-span-7">Date & Description</div>
                                                    <div className="col-span-3 text-right">Amount</div>
                                                    <div className="col-span-2 text-center">Status</div>
                                                </div>
                                                {(() => {
                                                    // Display Newest first
                                                    return [...(projectPayments || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((payment: any) => (
                                                        <div key={payment.id} className="grid grid-cols-12 gap-4 p-4 hover:bg-muted/20 transition-colors items-center group text-sm">
                                                            <div className="col-span-7">
                                                                <p className="font-medium truncate" title={payment.detailed_description || payment.description || payment.purpose}>
                                                                    {payment.detailed_description || payment.description || payment.purpose || 'Payment'}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">{format(new Date(payment.created_at), 'dd MMM yyyy')}</p>
                                                            </div>
                                                            <div className="col-span-3 text-right font-mono font-medium text-red-500">
                                                                -₹{payment.amount?.toLocaleString()}
                                                            </div>
                                                            <div className="col-span-2 flex justify-center">
                                                                <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 capitalize", getStatusColor(payment.status))}>
                                                                    {payment.status.replace('_', ' ')}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    ));
                                                })()}
                                            </div>
                                        )}
                                    </div>

                                    <div className="border rounded-xl overflow-hidden bg-card">
                                        <div className="px-4 py-3 border-b bg-muted/30 font-semibold flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-purple-500" /> Work Orders
                                        </div>
                                        {(!projectWOs || projectWOs.length === 0) ? (
                                            <div className="p-8 text-center text-muted-foreground text-sm italic">No work orders recorded.</div>
                                        ) : (
                                            <div className="divide-y relative overflow-hidden">
                                                {projectWOs.map((wo: any) => (
                                                    <div
                                                        key={wo.id}
                                                        className="p-4 hover:bg-muted/30 transition-all flex justify-between items-center group relative cursor-default"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex flex-col items-center justify-center text-purple-600 transition-transform group-hover:scale-105">
                                                                <FileText className="w-4 h-4" />
                                                                <span className="text-[8px] font-black uppercase">WO</span>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-bold text-sm tracking-tight truncate">{wo.wo_number}</p>
                                                                    <Badge variant="outline" className="text-[8px] h-4 bg-muted/50 shrink-0">LATEST</Badge>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">{wo.contractor_name || wo.work_description}</p>
                                                                <WorkOrderApprovalProgress wo={wo} />
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className="font-mono font-black text-sm text-primary">₹{(wo.total_amount || wo.estimated_amount)?.toLocaleString()}</p>
                                                                <div className="flex items-center justify-end gap-2 mt-1">
                                                                    <div className={cn("w-1.5 h-1.5 rounded-full",
                                                                        wo.status === 'completed' || wo.status === 'in_execution' ? "bg-emerald-500" : "bg-purple-500"
                                                                    )} />
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground opacity-70">
                                                                        {wo.status.replace('_', ' ')}
                                                                    </span>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors ml-1"
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            try {
                                                                                const { downloadWorkOrderPDF } = await import('@/lib/generateWorkOrderPDF');
                                                                                await downloadWorkOrderPDF({
                                                                                    woNumber: wo.wo_number,
                                                                                    date: new Date(wo.created_at).toLocaleDateString('en-IN'),
                                                                                    projectName: project?.project_name || 'Project',
                                                                                    phaseName: wo.phase?.phase_name,
                                                                                    vendorName: wo.aligned_vendor_name || 'Vendor',
                                                                                    vendorContact: wo.aligned_vendor_contact || '',
                                                                                    vendorGST: (wo as any).vendor_gst || '',
                                                                                    workDescription: wo.work_description,
                                                                                    detailedScope: wo.work_description,
                                                                                    agreedAmount: wo.total_amount || wo.estimated_amount || 0,
                                                                                    advanceAmount: wo.advance_amount || 0,
                                                                                    startDate: wo.start_date || new Date().toISOString(),
                                                                                    timelineDays: wo.timeline_days || 0,
                                                                                    termsAndConditions: (wo as any).terms_and_conditions || '',
                                                                                    vendorBankName: (wo as any).vendor_bank_name || undefined,
                                                                                    vendorAccountNumber: (wo as any).vendor_account_number || undefined,
                                                                                    vendorIFSC: (wo as any).vendor_ifsc || undefined,
                                                                                    vendorAccountHolder: wo.aligned_vendor_name || undefined,
                                                                                });
                                                                                toast.success('Work Order PDF Downloaded');
                                                                            } catch (e) {
                                                                                console.error('PDF error:', e);
                                                                                toast.error('Failed to generate PDF');
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Download className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </div>
                                                        </div>
                                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-purple-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center" />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="border rounded-xl overflow-hidden bg-card mt-6">
                                        <div className="px-4 py-3 border-b bg-muted/30 font-semibold flex items-center gap-2">
                                            <ShoppingCart className="w-4 h-4 text-orange-500" /> Purchase Orders
                                        </div>
                                        {(!projectPOs || projectPOs.length === 0) ? (
                                            <div className="p-8 text-center text-muted-foreground text-sm italic">No purchase orders recorded.</div>
                                        ) : (
                                            <div className="divide-y relative overflow-hidden">
                                                {projectPOs.map((po: any) => (
                                                    <div
                                                        key={po.id}
                                                        className="p-4 hover:bg-muted/30 transition-all flex justify-between items-center group relative cursor-default"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex flex-col items-center justify-center text-orange-600 transition-transform group-hover:scale-105">
                                                                <ShoppingCart className="w-4 h-4" />
                                                                <span className="text-[8px] font-black uppercase">PO</span>
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-bold text-sm tracking-tight">{po.po_number}</p>
                                                                    <Badge variant="outline" className="text-[8px] h-4 bg-muted/50">VENDOR</Badge>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground font-medium mt-0.5">{po.vendor_name || 'Generic Vendor'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-mono font-black text-sm text-primary">₹{po.total_amount?.toLocaleString()}</p>
                                                            <div className="flex items-center justify-end gap-1.5 mt-1">
                                                                <div className={cn("w-1.5 h-1.5 rounded-full",
                                                                    po.status === 'ordered' ? "bg-emerald-500" : "bg-orange-500"
                                                                )} />
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground opacity-70">
                                                                    {po.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-orange-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center" />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Live Transaction Feed */}
                                    <div className="border rounded-xl bg-card/50 backdrop-blur-sm p-4 mt-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 bg-status-live rounded-full" />
                                                Live Transaction Feed
                                            </h4>
                                            <Badge variant="outline" className="text-[10px] bg-status-live/5 text-status-live border-status-live/10">Streaming</Badge>
                                        </div>
                                        <div className="space-y-3">
                                            {[...(projectPayments || []), ...(projectWOs || []), ...(projectPOs || [])]
                                                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                                .slice(0, 5)
                                                .map((item: any) => (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30 border border-border/50"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className={cn(
                                                                "w-2 h-2 rounded-full",
                                                                item.amount ? "bg-emerald-500" : item.total_amount ? "bg-purple-500" : "bg-pink-500"
                                                            )} />
                                                            <span className="font-medium">{item.payee_name || item.contractor_name || item.vendor_name || 'Transaction'}</span>
                                                        </div>
                                                        <span className="text-muted-foreground font-mono">₹{(item.amount || item.total_amount || item.estimated_amount || 0).toLocaleString()}</span>
                                                    </div>
                                                ))
                                            }
                                            {(!projectPayments?.length && !projectWOs?.length && !projectPOs?.length) && (
                                                <p className="text-center text-xs text-muted-foreground py-4 italic">No live transactions recorded yet.</p>
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="phases" className="mt-0 focus-visible:outline-none">
                                    <div className="p-2 space-y-4">
                                        {loadingPhases ? (
                                            <div className="flex flex-col items-center justify-center py-12">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary/30" />
                                                <p className="text-xs font-bold uppercase tracking-widest mt-2 text-muted-foreground">Loading Phases...</p>
                                            </div>
                                        ) : phases.length === 0 ? (
                                            <div className="p-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                                                <Layers className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                                <p className="text-sm font-medium">No execution phases defined yet.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-4">
                                                {phases.map((phase) => (
                                                    <div key={phase.id} className="p-5 rounded-xl border border-border/50 bg-card/50 hover:border-primary/30 transition-all group shadow-sm">
                                                        <div className="flex items-start justify-between mb-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                                                                    <Layers className="w-5 h-5" />
                                                                </div>
                                                                <div>
                                                                    <h4 className="font-bold text-sm tracking-tight">{phase.phase_name}</h4>
                                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
                                                                        {phase.status.replace(/_/g, ' ')}
                                                                    </p>
                                                                    {phase.description && (
                                                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{phase.description}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <Badge variant="outline" className={cn(
                                                                "h-5 text-[10px] px-2",
                                                                phase.status === 'completed' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                                phase.status === 'in_progress' ? "bg-primary/10 text-primary border-primary/20" :
                                                                "bg-muted/50 text-muted-foreground"
                                                            )}>
                                                                {phase.completion_percentage}% Done
                                                            </Badge>
                                                        </div>
                                                        <div className="space-y-4">
                                                            <div
                                                                className="h-2 bg-muted rounded-full overflow-hidden shadow-inner"
                                                            >
                                                                <div
                                                                    className={cn(
                                                                        "h-full transition-all duration-700 ease-out relative",
                                                                        phase.status === 'completed' ? "bg-emerald-500" : "bg-primary",
                                                                        `w-[${phase.completion_percentage}%]`
                                                                    )}
                                                                >
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-between items-center gap-4 border-t border-border/20 pt-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[9px] uppercase font-black text-muted-foreground/60 tracking-tighter">Budget Est.</span>
                                                                    <span className="text-xs font-bold font-mono">₹{(phase.estimated_cost || 0).toLocaleString()}</span>
                                                                </div>
                                                                <div className="flex flex-col text-right">
                                                                    <span className="text-[9px] uppercase font-black text-muted-foreground/60 tracking-tighter">Timeline</span>
                                                                    <span className="text-xs font-bold text-foreground/80">
                                                                        {phase.started_at ? format(new Date(phase.started_at), 'dd MMM') : '-'} 
                                                                        {" → "} 
                                                                        {phase.completed_at ? format(new Date(phase.completed_at), 'dd MMM') : 'Ongoing'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="milestones" className="mt-0 space-y-6 focus-visible:outline-none">
                                    <div className="p-2 space-y-4">
                                        {loadingMilestones ? (
                                            <div className="flex flex-col items-center justify-center py-12">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary/30" />
                                                <p className="text-xs font-bold uppercase tracking-widest mt-2 text-muted-foreground">Loading Milestones...</p>
                                            </div>
                                        ) : milestones.length === 0 ? (
                                            <div className="p-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                                                <Flag className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                                <p className="text-sm font-medium">No milestones defined for this project.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-8">
                                                {phases.length > 0 ? (
                                                    phases.map((phase) => {
                                                        const phaseMilestones = milestones.filter(m => m.phase_id === phase.id);
                                                        if (phaseMilestones.length === 0) return null;
                                                        return (
                                                            <div key={phase.id} className="space-y-4">
                                                                <div className="flex items-center gap-2 px-2">
                                                                    <div className="h-4 w-1 bg-primary rounded-full" />
                                                                    <h4 className="text-xs font-black uppercase tracking-widest text-primary/80">
                                                                        Phase: {phase.phase_name}
                                                                    </h4>
                                                                    <Badge variant="outline" className="text-[9px] h-4 ml-auto bg-primary/5 uppercase border-primary/20">
                                                                        {phase.completion_percentage}% Done
                                                                    </Badge>
                                                                </div>
                                                                <div className="grid grid-cols-1 gap-3">
                                                                    {phaseMilestones.map((m, idx) => (
                                                                        <div key={m.id} className="p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all flex items-center gap-4 group">
                                                                            <div className={cn(
                                                                                "w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border transition-transform group-hover:scale-105",
                                                                                m.status === 'completed' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-primary/10 border-primary/20 text-primary"
                                                                            )}>
                                                                                <Flag className="w-5 h-5" />
                                                                                <span className="text-[8px] font-black uppercase">{idx + 1}</span>
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center justify-between mb-1">
                                                                                    <h5 className="font-bold text-sm tracking-tight truncate">{m.milestone_name}</h5>
                                                                                    <Badge variant="outline" className={cn(
                                                                                        "text-[9px] h-4 px-1.5 capitalize",
                                                                                        m.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
                                                                                    )}>
                                                                                        {m.status}
                                                                                    </Badge>
                                                                                </div>
                                                                                {m.description && (
                                                                                    <p className="text-xs text-muted-foreground mb-1 line-clamp-2">{m.description}</p>
                                                                                )}
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                                        <div 
                                                                                            className={cn(
                                                                                                "h-full transition-all duration-500",
                                                                                                m.status === 'completed' ? "bg-emerald-500" : "bg-primary",
                                                                                                `w-[${m.completion_percentage}%]`
                                                                                            )}
                                                                                        />
                                                                                    </div>
                                                                                    <span className="text-[10px] font-bold tabular-nums w-8 text-right">{m.completion_percentage}%</span>
                                                                                </div>
                                                                                <div className="flex items-center gap-4 mt-2">
                                                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                                        <Calendar className="w-3 h-3" />
                                                                                        Planned: {format(new Date(m.planned_date), 'dd MMM yyyy')}
                                                                                    </span>
                                                                                    {m.actual_date && (
                                                                                        <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-medium">
                                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                                            Actual: {format(new Date(m.actual_date), 'dd MMM yyyy')}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="grid grid-cols-1 gap-4">
                                                        {milestones.map((m, idx) => (
                                                            <div key={m.id} className="p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all flex items-center gap-4 group">
                                                                <div className={cn(
                                                                    "w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border transition-transform group-hover:scale-105",
                                                                    m.status === 'completed' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-primary/10 border-primary/20 text-primary"
                                                                )}>
                                                                    <Flag className="w-5 h-5" />
                                                                    <span className="text-[8px] font-black uppercase">{idx + 1}</span>
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <h5 className="font-bold text-sm tracking-tight truncate">{m.milestone_name}</h5>
                                                                        <Badge variant="outline" className={cn(
                                                                            "text-[9px] h-4 px-1.5 capitalize",
                                                                            m.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
                                                                        )}>
                                                                            {m.status}
                                                                        </Badge>
                                                                    </div>
                                                                    {m.description && (
                                                                        <p className="text-xs text-muted-foreground mb-1 line-clamp-2">{m.description}</p>
                                                                    )}
                                                                    <div className="flex items-center gap-3">
                                                                        <div
                                                                            className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"
                                                                        >
                                                                            <div
                                                                                className={cn(
                                                                                    "h-full transition-all duration-500",
                                                                                    m.status === 'completed' ? "bg-emerald-500" : "bg-primary",
                                                                                    `w-[${m.completion_percentage}%]`
                                                                                )}
                                                                            />
                                                                        </div>
                                                                        <span className="text-[10px] font-bold tabular-nums w-8 text-right">{m.completion_percentage}%</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-4 mt-2">
                                                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                            <Calendar className="w-3 h-3" />
                                                                            Planned: {format(new Date(m.planned_date), 'dd MMM yyyy')}
                                                                        </span>
                                                                        {m.actual_date && (
                                                                            <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-medium">
                                                                                <CheckCircle2 className="w-3 h-3" />
                                                                                Actual: {format(new Date(m.actual_date), 'dd MMM yyyy')}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Fallback for milestones without phase_id if phases exist */}
                                                {phases.length > 0 && milestones.some(m => !m.phase_id) && (
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-2 px-2">
                                                            <div className="h-4 w-1 bg-slate-400 rounded-full" />
                                                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
                                                                Unassigned Milestones
                                                            </h4>
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-3">
                                                            {milestones.filter(m => !m.phase_id).map((m, idx) => (
                                                                <div key={m.id} className="p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all flex items-center gap-4 group">
                                                                    <div className={cn(
                                                                        "w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border transition-transform group-hover:scale-105",
                                                                        m.status === 'completed' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-primary/10 border-primary/20 text-primary"
                                                                    )}>
                                                                        <Flag className="w-5 h-5" />
                                                                        <span className="text-[8px] font-black uppercase">{idx + 1}</span>
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <h5 className="font-bold text-sm tracking-tight truncate">{m.milestone_name}</h5>
                                                                            <Badge variant="outline" className={cn(
                                                                                "text-[9px] h-4 px-1.5 capitalize",
                                                                                m.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
                                                                            )}>
                                                                                {m.status}
                                                                            </Badge>
                                                                        </div>
                                                                        <div className="flex items-center gap-3">
                                                                            <div
                                                                                className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"
                                                                            >
                                                                                <div
                                                                                    className={cn(
                                                                                        "h-full transition-all duration-500",
                                                                                        m.status === 'completed' ? "bg-emerald-500" : "bg-primary",
                                                                                        `w-[${m.completion_percentage}%]`
                                                                                    )}
                                                                                />
                                                                            </div>
                                                                            <span className="text-[10px] font-bold tabular-nums w-8 text-right">{m.completion_percentage}%</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-4 mt-2">
                                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                                <Calendar className="w-3 h-3" />
                                                                                Planned: {format(new Date(m.planned_date), 'dd MMM yyyy')}
                                                                            </span>
                                                                            {m.actual_date && (
                                                                                <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-medium">
                                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                                    Actual: {format(new Date(m.actual_date), 'dd MMM yyyy')}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="timeline" className="mt-0">
                                    <div className="p-2 space-y-4">
                                        {loadingTimeline ? (
                                            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                                                <Loader2 className="w-8 h-8 animate-spin mb-2 opacity-20" />
                                                <p className="text-xs uppercase font-bold tracking-widest">Loading Timeline...</p>
                                            </div>
                                        ) : timelineEntries.length === 0 ? (
                                            <div className="p-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                                                <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                                <p className="text-sm font-medium">No activity recorded for this project yet.</p>
                                            </div>
                                        ) : (
                                            <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-primary/20 before:via-primary/10 before:to-transparent">
                                                {timelineEntries.map((entry, idx) => (
                                                    <div
                                                        key={entry.id}
                                                        className="relative group"
                                                    >
                                                        <div className="absolute -left-[27px] top-1.5 w-6 h-6 rounded-full bg-card border-2 border-primary/20 flex items-center justify-center z-10 group-hover:border-primary/50 group-hover:scale-110 transition-all duration-300">
                                                            <div className="w-2 h-2 rounded-full bg-primary/60 group-hover:bg-primary" />
                                                        </div>
                                                        <div className="bg-muted/30 border border-border/50 p-4 rounded-xl group-hover:bg-muted/50 transition-colors shadow-sm">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <h5 className="font-bold text-sm tracking-tight text-foreground/90">{entry.action}</h5>
                                                                <span className="text-[10px] font-mono text-muted-foreground font-medium uppercase tracking-tighter">
                                                                    {format(new Date(entry.created_at), 'dd MMM HH:mm')}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <div className="px-1.5 py-0.5 rounded bg-primary/10 text-[9px] font-black text-primary uppercase tracking-wider">
                                                                    {entry.performed_by_role || 'System'}
                                                                </div>
                                                                <span className="text-xs text-muted-foreground font-medium">{entry.performed_by_name || 'Automated Activity'}</span>
                                                            </div>
                                                            {entry.details && (
                                                                <div className="text-[11px] text-muted-foreground/80 leading-relaxed font-medium bg-background/50 p-2 rounded-lg border border-border/30">
                                                                    {Object.entries(entry.details).map(([key, val]) => (
                                                                        <div key={key} className="flex gap-2">
                                                                            <span className="opacity-50 uppercase tracking-tighter font-black text-[9px] mt-0.5">{key}:</span>
                                                                            <span className="break-all">{String(val)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="docs" className="mt-0">
                                    <div className="p-2">
                                        {allDocuments.length === 0 ? (
                                            <div className="p-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                                                <FolderKanban className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                                <p className="text-sm font-medium">No documents shared for this project.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {allDocuments.map((doc, idx) => (
                                                    <div
                                                        key={`${doc.url}-${idx}`}
                                                        className="group p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-md transition-all flex items-start gap-4"
                                                    >
                                                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                                                            <FileText className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h5 className="font-bold text-sm tracking-tight truncate pr-2" title={doc.name}>{doc.name}</h5>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Badge variant="outline" className="text-[8px] h-4 uppercase tracking-tighter bg-muted/50">{doc.type}</Badge>
                                                                <span className="text-[10px] text-muted-foreground font-medium">{format(new Date(doc.date), 'dd MMM yyyy')}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-3">
                                                                <a
                                                                    href={doc.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1 hover:underline"
                                                                >
                                                                    <ExternalLink className="w-3 h-3" /> View
                                                                </a>
                                                                <span className="text-muted-foreground/20">|</span>
                                                                <a
                                                                    href={doc.url}
                                                                    download
                                                                    className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                                                                >
                                                                    <Download className="w-3 h-3" /> Save
                                                                </a>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>
                            </div>
                        </ScrollArea>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    );
}

