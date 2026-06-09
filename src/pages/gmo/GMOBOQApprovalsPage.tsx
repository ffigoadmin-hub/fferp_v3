// @ts-nocheck

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Check, X, Eye, FileText, ArrowRight, ShieldCheck, AlertTriangle, ShoppingCart, Hammer, LayoutTemplate, Clock, Package, User, Zap, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { Project } from '@/hooks/useProjects';
import { BOQItem } from '@/hooks/useBOQ';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useMaterialRequests } from '@/hooks/useMaterialRequests';
import { useVendorWorkRequests } from '@/hooks/useVendorWorkRequests';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { WorkOrderMonitoringWidget } from '@/components/WorkOrderMonitoringWidget';

interface GMOProject extends Omit<Project, 'vertical'> {
    vertical?: { name: string };
    engineer?: { name: string };
    submitter?: { name: string };
    location?: string;
}

export default function GMOBOQApprovalsPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [selectedProject, setSelectedProject] = useState<GMOProject | null>(null);
    const [boqItems, setBoqItems] = useState<BOQItem[]>([]);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('boq');

    // Detail Modal State
    const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
    const [selectedWork, setSelectedWork] = useState<any>(null);
    const [materialDetailOpen, setMaterialDetailOpen] = useState(false);
    const [workDetailOpen, setWorkDetailOpen] = useState(false);

    const { requests: materialRequests, approveRequest: approveMaterialRequest } = useMaterialRequests();
    const { requests: workRequests, approveRequest: approveWorkRequest } = useVendorWorkRequests();

    const pendingMaterial = materialRequests.filter(req => req.approval_status === 'pending_gmo');
    const pendingWork = workRequests.filter(req => req.approval_status === 'pending_gmo');

    // 1. Fetch Projects Pending GMO Approval (L2)
    const { data: projects, isLoading } = useQuery({
        queryKey: ['boq-pending-gmo-approval'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('projects')
                .select(`
          *,
          vertical:project_verticals(name),
          submitter:profiles!projects_boq_submitted_by_fkey(name),
          engineer:profiles!projects_assigned_engineer_id_fkey(name)
        `)
                .eq('lifecycle_stage', 'boq_submitted_gmo')
                .order('boq_submitted_at', { ascending: true });
            if (error) throw error;
            return data || [];
        },
    });

    // Fetch project history (already approved by GMO)
    const { data: historyProjects, isLoading: historyLoading } = useQuery({
        queryKey: ['boq-history-gmo'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('projects')
                .select(`
          *,
          vertical:project_verticals(name),
          submitter:profiles!projects_boq_submitted_by_fkey(name),
          engineer:profiles!projects_assigned_engineer_id_fkey(name)
        `)
                .eq('boq_approved_by', user?.id)
                .order('boq_approved_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
    });

    // 2. Fetch BOQ Items for Selected Project
    const { isLoading: isLoadingItems } = useQuery({
        queryKey: ['boq-items', selectedProject?.id],
        queryFn: async () => {
            if (!selectedProject) return [];
            const { data, error } = await supabase
                .from('project_boq')
                .select('*')
                .eq('project_id', selectedProject.id)
                .order('line_number', { ascending: true });
            if (error) throw error;
            setBoqItems(data as BOQItem[]);
            return data;
        },
        enabled: !!selectedProject,
    });

    // 3. Approve Mutation (GMO -> Approved)
    const approveMutation = useMutation({
        mutationFn: async () => {
            if (!selectedProject) return;

            const { error } = await supabase
                .from('projects')
                .update({
                    lifecycle_stage: 'boq_approved',
                    boq_approved_at: new Date().toISOString(),
                    boq_approved_by: user?.id,
                    stage_boq_approved_at: new Date().toISOString(),
                })
                .eq('id', selectedProject.id);

            if (error) throw error;

            await supabase.from('project_timeline').insert({
                project_id: selectedProject.id,
                action: 'boq_approved_gmo',
                performed_by: user?.id,
                performed_by_name: user?.name,
                performed_by_role: user?.role,
                details: { stage: 'Approved' }
            });
        },
        onSuccess: () => {
            toast.success('BOQ finally approved and Live!');
            queryClient.invalidateQueries({ queryKey: ['boq-pending-gmo-approval'] });
            queryClient.invalidateQueries({ queryKey: ['boq-history-gmo'] });
            queryClient.invalidateQueries({ queryKey: ['project-lifecycle', selectedProject?.id] });
            setSelectedProject(null);
        },
        onError: (error) => {
            toast.error('Failed to approve BOQ: ' + error.message);
        }
    });

    // 4. Reject Mutation
    const rejectMutation = useMutation({
        mutationFn: async () => {
            if (!selectedProject) return;

            const { error } = await supabase
                .from('projects')
                .update({
                    lifecycle_stage: 'engineering_assigned', // Send back to drafting
                    boq_rejection_reason: `GMO Rejection: ${rejectReason}`,
                })
                .eq('id', selectedProject.id);

            if (error) throw error;

            await supabase.from('project_timeline').insert({
                project_id: selectedProject.id,
                action: 'boq_rejected',
                performed_by: user?.id,
                performed_by_name: user?.name,
                performed_by_role: user?.role,
                details: { reason: rejectReason, stage: 'GMO Rejection' }
            });
        },
        onSuccess: () => {
            toast.success('BOQ rejected and returned to engineer');
            queryClient.invalidateQueries({ queryKey: ['boq-pending-gmo-approval'] });
            queryClient.invalidateQueries({ queryKey: ['boq-history-gmo'] });
            setSelectedProject(null);
            setRejectModalOpen(false);
            setRejectReason('');
        },
    });

    const totalEstimated = boqItems.reduce((sum, item) => sum + (item.quantity * (item.estimated_unit_cost || 0)), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 bg-purple-500/10 p-6 rounded-2xl border border-purple-500/20">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                    <ShieldCheck className="w-8 h-8 text-purple-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-purple-900 dark:text-purple-100">Project Approvals</h1>
                    <p className="text-muted-foreground">Final review and approval for BOQs, Materials, and Work Orders</p>
                </div>
            </div>

            <Tabs defaultValue="boq" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none">
                    <TabsList className="h-auto p-1 bg-muted/30 border border-border/50 shrink-0">
                        <TabsTrigger value="boq" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-muted-foreground data-[state=active]:text-foreground h-9">
                            <LayoutTemplate className="w-4 h-4" /> BOQ Approvals
                            {projects && projects.length > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-purple-100 text-purple-700 hover:bg-purple-100">{projects.length}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="material" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-muted-foreground data-[state=active]:text-foreground h-9">
                            <ShoppingCart className="w-4 h-4" /> Final Material Sign-off
                            {pendingMaterial.length > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-blue-100 text-blue-700 hover:bg-blue-100">{pendingMaterial.length}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="work" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-muted-foreground data-[state=active]:text-foreground h-9">
                            <Hammer className="w-4 h-4" /> Final Work Sign-off
                            {pendingWork.length > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-amber-100 text-amber-700 hover:bg-amber-100">{pendingWork.length}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="work-orders" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-muted-foreground data-[state=active]:text-foreground h-9">
                            <FileText className="w-4 h-4" /> Work Orders
                        </TabsTrigger>
                        <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-muted-foreground data-[state=active]:text-foreground h-9">
                            <Clock className="w-4 h-4" /> My Approval History
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="boq">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <Card key={i} className="h-48 flex items-center justify-center bg-muted/20">
                                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                </Card>
                            ))
                        ) : projects?.length === 0 ? (
                            <div className="col-span-full h-64 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 rounded-2xl border-dashed border-2 border-muted">
                                <ShieldCheck className="w-12 h-12 mb-4 opacity-20" />
                                <p>No projects pending GMO approval</p>
                            </div>
                        ) : (
                            projects?.map((project: any) => (
                                <Card key={project.id} className="group hover:shadow-lg transition-all border-l-4 border-l-purple-500">
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-start">
                                            <Badge variant="outline" className="mb-2 bg-purple-50 text-purple-700 border-purple-200">
                                                {project.project_id}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground font-mono">
                                                {format(new Date(project.boq_submitted_at), 'MMM d, HH:mm')}
                                            </span>
                                        </div>
                                        <CardTitle className="line-clamp-1">{project.project_name}</CardTitle>
                                        <p className="text-sm text-muted-foreground line-clamp-1">{project.location_city}</p>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3 mb-4">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Engineer:</span>
                                                <span className="font-medium">{project.engineer?.name || 'Unassigned'}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Vertical:</span>
                                                <span className="font-medium">{project.vertical?.name}</span>
                                            </div>
                                        </div>
                                        <Button
                                            className="w-full bg-purple-600 hover:bg-purple-700"
                                            onClick={() => setSelectedProject(project)}
                                        >
                                            <Eye className="w-4 h-4 mr-2" /> Review BOQ
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="material" className="space-y-4">
                    <Card className="border-border/50">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-purple-600" /> Material Requests Pending Final Approval
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {pendingMaterial.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                                    No material requests pending GMO approval.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {pendingMaterial.map(req => (
                                        <div key={req.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/5 transition-colors">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-sm font-medium">REQ-{req.id.slice(0, 8).toUpperCase()}</span>
                                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">Pending GMO</Badge>
                                                    <span className="text-xs text-muted-foreground">• {format(new Date(req.created_at), 'PPP')}</span>
                                                </div>
                                                <div className="text-sm font-medium">{req.project?.project_name || 'Unknown Project'}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Requested by {req.requester?.name} ({req.requester?.department})
                                                </div>
                                                <div className="mt-2 text-xs bg-muted/50 p-2 rounded w-fit">
                                                    {req.boq_items?.length || 0} items requested
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2"
                                                    onClick={() => {
                                                        setSelectedMaterial(req);
                                                        setMaterialDetailOpen(true);
                                                    }}
                                                >
                                                    <Eye className="w-4 h-4" /> Details
                                                </Button>
                                                <Button size="sm" onClick={() => approveMaterialRequest(req.id, 'gmo')} className="gap-2 bg-purple-600 hover:bg-purple-700">
                                                    <Check className="w-4 h-4" /> Final Approve
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="work" className="space-y-4">
                    <Card className="border-border/50">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Hammer className="w-5 h-5 text-purple-600" /> Work Requests Pending Final Approval
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {pendingWork.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                                    No work requests pending GMO approval.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {pendingWork.map(req => (
                                        <div key={req.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/5 transition-colors">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-sm font-medium">WR-{req.id.slice(0, 8).toUpperCase()}</span>
                                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">Pending GMO</Badge>
                                                    <span className="text-xs text-muted-foreground">• {format(new Date(req.created_at), 'PPP')}</span>
                                                </div>
                                                <div className="text-sm font-medium">{req.project?.project_name || 'Unknown Project'}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {req.work_type.toUpperCase()} - {req.work_description}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Requested by {req.requester?.name} ({req.requester?.department})
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2"
                                                    onClick={() => {
                                                        setSelectedWork(req);
                                                        setWorkDetailOpen(true);
                                                    }}
                                                >
                                                    <Eye className="w-4 h-4" /> Details
                                                </Button>
                                                <Button size="sm" onClick={() => approveWorkRequest(req.id, 'gmo')} className="gap-2 bg-purple-600 hover:bg-purple-700">
                                                    <Check className="w-4 h-4" /> Final Approve
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="work-orders" className="space-y-4">
                    <WorkOrderMonitoringWidget role="gmo" showApprovalActions={true} />
                </TabsContent>

                <TabsContent value="history" className="space-y-4">
                    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-400" /> My Approval History
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="history-boq" className="w-full">
                                <TabsList className="mb-4 bg-muted/50 p-1 h-auto flex-wrap justify-start">
                                    <TabsTrigger value="history-boq" className="gap-2">
                                        <LayoutTemplate className="w-3.5 h-3.5" /> BOQs
                                        <Badge variant="secondary" className="ml-1.5 h-5 px-1">{historyProjects?.length || 0}</Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="history-material" className="gap-2">
                                        <Package className="w-3.5 h-3.5" /> Materials
                                        <Badge variant="secondary" className="ml-1.5 h-5 px-1">{materialRequests.filter(req => req.gmo_approved_by === user?.id).length || 0}</Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="history-work" className="gap-2">
                                        <Zap className="w-3.5 h-3.5" /> Work Orders
                                        <Badge variant="secondary" className="ml-1.5 h-5 px-1">{workRequests.filter(req => req.gmo_approved_by === user?.id).length || 0}</Badge>
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="history-boq">
                                    {historyLoading ? (
                                        <div className="flex justify-center py-12">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        </div>
                                    ) : historyProjects?.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                                            No BOQ approval history found.
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-xl border border-border/50">
                                            <Table>
                                                <TableHeader className="bg-muted/30">
                                                    <TableRow>
                                                        <TableHead>Project</TableHead>
                                                        <TableHead>Engineer</TableHead>
                                                        <TableHead>Approved Date</TableHead>
                                                        <TableHead className="text-right">Action</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {historyProjects?.map((project: any) => (
                                                        <TableRow key={project.id} className="hover:bg-muted/20">
                                                            <TableCell className="font-medium">
                                                                <div>{project.project_name}</div>
                                                                <div className="text-xs text-muted-foreground font-mono">{project.project_id}</div>
                                                            </TableCell>
                                                            <TableCell className="text-sm">{project.engineer?.name}</TableCell>
                                                            <TableCell className="text-sm">
                                                                {project.boq_approved_at || project.stage_boq_approved_at ? format(new Date(project.boq_approved_at || project.stage_boq_approved_at), 'MMM d, yyyy') : 'N/A'}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 gap-2 text-primary"
                                                                    onClick={() => setSelectedProject(project)}
                                                                >
                                                                    <Eye className="w-4 h-4" /> View
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="history-material">
                                    {(() => {
                                        const historyMaterial = materialRequests.filter(req => req.gmo_approved_by === user?.id);
                                        return historyMaterial.length === 0 ? (
                                            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                                                No approved material history found.
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto rounded-xl border border-border/50">
                                                <Table>
                                                    <TableHeader className="bg-muted/30">
                                                        <TableRow>
                                                            <TableHead>Request ID</TableHead>
                                                            <TableHead>Project</TableHead>
                                                            <TableHead>Amount</TableHead>
                                                            <TableHead>Date</TableHead>
                                                            <TableHead>Status</TableHead>
                                                            <TableHead className="text-right">Action</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {historyMaterial.map(req => (
                                                            <TableRow key={req.id}>
                                                                <TableCell className="font-mono text-xs uppercase">{req.id.slice(0, 8)}</TableCell>
                                                                <TableCell className="text-sm font-medium">{req.project?.project_name}</TableCell>
                                                                <TableCell className="text-sm">{req.boq_items?.length || 0} items</TableCell>
                                                                <TableCell className="text-sm">{req.gmo_approved_at ? format(new Date(req.gmo_approved_at), 'MMM d, yyyy') : 'N/A'}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className="capitalize text-[10px] py-0">{req.approval_status?.replace(/_/g, ' ')}</Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 gap-2 text-primary"
                                                                        onClick={() => {
                                                                            setSelectedMaterial(req);
                                                                            setMaterialDetailOpen(true);
                                                                        }}
                                                                    >
                                                                        <Eye className="w-4 h-4" /> Details
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        );
                                    })()}
                                </TabsContent>

                                <TabsContent value="history-work">
                                    {(() => {
                                        const historyWork = workRequests.filter(req => req.gmo_approved_by === user?.id);
                                        return historyWork.length === 0 ? (
                                            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                                                No approved work request history found.
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto rounded-xl border border-border/50">
                                                <Table>
                                                    <TableHeader className="bg-muted/30">
                                                        <TableRow>
                                                            <TableHead>Request ID</TableHead>
                                                            <TableHead>Project</TableHead>
                                                            <TableHead>Type</TableHead>
                                                            <TableHead>Date</TableHead>
                                                            <TableHead>Status</TableHead>
                                                            <TableHead className="text-right">Action</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {historyWork.map(req => (
                                                            <TableRow key={req.id}>
                                                                <TableCell className="font-mono text-xs uppercase">{req.id.slice(0, 8)}</TableCell>
                                                                <TableCell className="text-sm font-medium">{req.project?.project_name}</TableCell>
                                                                <TableCell className="text-sm capitalize">{req.work_type}</TableCell>
                                                                <TableCell className="text-sm">{req.gmo_approved_at ? format(new Date(req.gmo_approved_at), 'MMM d, yyyy') : 'N/A'}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className="capitalize text-[10px] py-0">{req.approval_status?.replace(/_/g, ' ')}</Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 gap-2 text-primary"
                                                                        onClick={() => {
                                                                            setSelectedWork(req);
                                                                            setWorkDetailOpen(true);
                                                                        }}
                                                                    >
                                                                        <Eye className="w-4 h-4" /> Details
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        );
                                    })()}
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>


            {/* Review Dialog */}
            <Dialog open={!!selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <FileText className="w-5 h-5 text-purple-600" />
                            Review BOQ: {selectedProject?.project_name}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto pr-2">
                        {isLoadingItems ? (
                            <div className="h-40 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Card className="bg-slate-50 border-slate-200">
                                        <CardContent className="p-4">
                                            <p className="text-xs text-muted-foreground uppercase font-bold">Total Items</p>
                                            <p className="text-2xl font-bold text-slate-700">{boqItems.length}</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-emerald-50 border-emerald-200">
                                        <CardContent className="p-4">
                                            <p className="text-xs text-muted-foreground uppercase font-bold text-emerald-600">Total Value</p>
                                            <p className="text-2xl font-bold text-emerald-700">
                                                ₹{totalEstimated.toLocaleString('en-IN')}
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-purple-50 border-purple-200">
                                        <CardContent className="p-4">
                                            <p className="text-xs text-muted-foreground uppercase font-bold text-purple-600">Approval Stage</p>
                                            <p className="text-2xl font-bold text-purple-700">L2 (Final)</p>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
                                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Item</th>
                                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Est. Rate</th>
                                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {boqItems.map((item) => (
                                                <tr key={item.id} className="hover:bg-muted/30">
                                                    <td className="px-4 py-3 font-mono text-xs">{item.line_number}</td>
                                                    <td className="px-4 py-3 font-medium">{item.material_name}</td>
                                                    <td className="px-4 py-3 capitalize">
                                                        <Badge variant="outline" className={
                                                            item.category === 'labour' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                                                        }>
                                                            {item.category}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">{item.quantity} {item.unit}</td>
                                                    <td className="px-4 py-3 text-right">₹{item.estimated_unit_cost?.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right font-medium">
                                                        ₹{((item.quantity || 0) * (item.estimated_unit_cost || 0)).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="mt-6 border-t pt-4">
                        <Button variant="outline" onClick={() => setSelectedProject(null)} className="mr-auto">
                            Close
                        </Button>
                        {selectedProject?.lifecycle_stage === 'boq_submitted_gmo' && (
                            <>
                                <Button variant="destructive" onClick={() => setRejectModalOpen(true)}>
                                    <X className="h-4 w-4 mr-2" /> Reject
                                </Button>
                                <Button
                                    onClick={() => approveMutation.mutate()}
                                    disabled={approveMutation.isPending}
                                    className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200"
                                >
                                    {approveMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <ShieldCheck className="h-4 w-4 mr-2" />
                                    )}
                                    Final Approve & Go Live
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Reason Dialog */}
            <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" /> Reject BOQ
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="text-sm font-medium mb-2 block">Reason for Rejection</label>
                        <Textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Please provide specific feedback for the engineer..."
                            className="min-h-[100px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRejectModalOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => rejectMutation.mutate()}
                            disabled={!rejectReason || rejectMutation.isPending}
                        >
                            {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Confirm Rejection
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Material Detail Modal */}
            <Dialog open={materialDetailOpen} onOpenChange={setMaterialDetailOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-border/50 bg-background/95 backdrop-blur-xl">
                    <DialogHeader className="p-6 pb-2">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                    <Package className="w-5 h-5 text-indigo-400" /> Material Request Details
                                </DialogTitle>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <span className="font-mono uppercase">{selectedMaterial?.id?.slice(0, 8)}</span>
                                    <span>•</span>
                                    <span>{selectedMaterial?.created_at && format(new Date(selectedMaterial.created_at), 'MMMM d, yyyy')}</span>
                                </div>
                            </div>
                            <Badge variant="outline" className="capitalize bg-muted/50">
                                {selectedMaterial?.approval_status?.replace(/_/g, ' ')}
                            </Badge>
                        </div>
                    </DialogHeader>

                    <ScrollArea className="flex-1 p-6 pt-2">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="bg-muted/30 border-none shadow-none">
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                            <LayoutTemplate className="w-4 h-4" /> Project Information
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold">{selectedMaterial?.project?.project_name}</div>
                                            <div className="text-xs text-muted-foreground font-mono">{selectedMaterial?.project?.project_id}</div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-muted/30 border-none shadow-none">
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                            <User className="w-4 h-4" /> Requested By
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold">{selectedMaterial?.requester?.name}</div>
                                            <div className="text-xs text-muted-foreground">{selectedMaterial?.requester?.department}</div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-indigo-400" /> Items Requested
                                </h3>
                                <div className="rounded-lg border border-border/50 max-h-[300px] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="bg-muted/30 sticky top-0 z-10">
                                            <TableRow>
                                                <TableHead>Item Details</TableHead>
                                                <TableHead className="text-right">Quantity</TableHead>
                                                <TableHead className="text-right">Unit</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedMaterial?.boq_items?.map((item: any, idx: number) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="text-sm py-2">{item.item_name || item.material_name}</TableCell>
                                                    <TableCell className="text-right text-sm py-2 font-medium">{item.quantity || item.requested_quantity}</TableCell>
                                                    <TableCell className="text-right text-sm py-2">{item.unit}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {selectedMaterial?.gmo_approved_at && (
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    <div className="text-xs">
                                        <div className="text-emerald-500 font-semibold text-sm">Approved by you</div>
                                        <div className="text-muted-foreground">on {format(new Date(selectedMaterial.gmo_approved_at), 'PPPp')}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    <DialogFooter className="p-4 border-t border-border/50 bg-muted/20 sm:justify-between">
                        <Button variant="outline" onClick={() => setMaterialDetailOpen(false)}>Close</Button>
                        {selectedMaterial?.approval_status === 'pending_gmo' && (
                            <Button
                                onClick={() => {
                                    approveMaterialRequest(selectedMaterial.id, 'gmo');
                                    setMaterialDetailOpen(false);
                                }}
                                className="gap-2 bg-purple-600 hover:bg-purple-700"
                            >
                                <Check className="w-4 h-4" /> Final Approve
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Work Request Detail Modal */}
            <Dialog open={workDetailOpen} onOpenChange={setWorkDetailOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-border/50 bg-background/95 backdrop-blur-xl">
                    <DialogHeader className="p-6 pb-2">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-indigo-400" /> Work Request Details
                                </DialogTitle>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <span className="font-mono uppercase">{selectedWork?.id?.slice(0, 8)}</span>
                                    <span>•</span>
                                    <span>{selectedWork?.created_at && format(new Date(selectedWork.created_at), 'MMMM d, yyyy')}</span>
                                </div>
                            </div>
                            <Badge variant="outline" className="capitalize bg-muted/50">
                                {selectedWork?.approval_status?.replace(/_/g, ' ')}
                            </Badge>
                        </div>
                    </DialogHeader>

                    <ScrollArea className="flex-1 p-6 pt-2">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="bg-muted/30 border-none shadow-none">
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                            <LayoutTemplate className="w-4 h-4" /> Project Information
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold">{selectedWork?.project?.project_name}</div>
                                            <div className="text-xs text-muted-foreground font-mono">{selectedWork?.project?.project_id}</div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-muted/30 border-none shadow-none">
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                            <User className="w-4 h-4" /> Requested By
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold">{selectedWork?.requester?.name}</div>
                                            <div className="text-xs text-muted-foreground">{selectedWork?.requester?.department}</div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Work Type</Label>
                                    <div className="text-sm font-semibold capitalize bg-muted/50 p-2 rounded-md border border-border/30">
                                        {selectedWork?.work_type?.replace(/_/g, ' ')}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Estimated Budget</Label>
                                    <div className="text-sm font-semibold bg-muted/50 p-2 rounded-md border border-border/30">
                                        ₹{selectedWork?.estimated_budget?.toLocaleString() || 'N/A'}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Work Description</Label>
                                <div className="text-sm bg-muted/50 p-4 rounded-md border border-border/30 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">
                                    {selectedWork?.work_description}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Timeline</Label>
                                    <div className="text-sm font-semibold flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-indigo-400" /> {selectedWork?.timeline_days} Days
                                    </div>
                                </div>
                            </div>

                            {selectedWork?.gmo_approved_at && (
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    <div className="text-xs">
                                        <div className="text-emerald-500 font-semibold text-sm">Approved by you</div>
                                        <div className="text-muted-foreground">on {format(new Date(selectedWork.gmo_approved_at), 'PPPp')}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    <DialogFooter className="p-4 border-t border-border/50 bg-muted/20 sm:justify-between">
                        <Button variant="outline" onClick={() => setWorkDetailOpen(false)}>Close</Button>
                        {selectedWork?.approval_status === 'pending_gmo' && (
                            <Button
                                onClick={() => {
                                    approveWorkRequest(selectedWork.id, 'gmo');
                                    setWorkDetailOpen(false);
                                }}
                                className="gap-2 bg-purple-600 hover:bg-purple-700"
                            >
                                <Check className="w-4 h-4" /> Final Approve
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
