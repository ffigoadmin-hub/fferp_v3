// @ts-nocheck
import { useState, useEffect } from 'react';
import { ClipboardCheck, Check, X, Loader2, Eye, ShoppingCart, Hammer, LayoutTemplate, Clock, Zap, Package, Calendar, User, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useMaterialRequests } from '@/hooks/useMaterialRequests';
import { useVendorWorkRequests } from '@/hooks/useVendorWorkRequests';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WorkOrderMonitoringWidget } from '@/components/WorkOrderMonitoringWidget';
import { cn } from '@/lib/utils';


export default function BOQApprovalsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [selectedWork, setSelectedWork] = useState<any>(null);
  const [boqItems, setBoqItems] = useState<any[]>([]);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [materialDetailOpen, setMaterialDetailOpen] = useState(false);
  const [workDetailOpen, setWorkDetailOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [activeTab, setActiveTab] = useState('boq');
  const [rejectType, setRejectType] = useState<'boq' | 'material' | 'work'>('boq');

  // Material & Work Requests Hooks
  const { requests: materialRequests, approveRequest: approveMaterialRequest, rejectRequest: rejectMaterialRequest } = useMaterialRequests();
  const { requests: workRequests, approveRequest: approveWorkRequest, rejectRequest: rejectWorkRequest } = useVendorWorkRequests();

  /*
   ### 1. Unified & Reliable Approval History
   Resolved the issue where approved BOQs weren't appearing in the personal history tab.
   - **Race Condition Fix**: Refactored approval/rejection logic to use mutation variables, ensuring database updates complete before UI feedback.
   - **Enhanced History UI**: Added sub-tabs for **BOQs**, **Materials**, and **Work Orders** with live badge counts to track all SMO actions.
   - **Cache Reliability**: Guaranteed that history lists refresh instantly upon any approval action.
  */

  // Filter requests pending SMO approval
  const pendingMaterial = materialRequests.filter(req => req.approval_status === 'pending_smo');
  const pendingWork = workRequests.filter(req => req.approval_status === 'pending_smo');

  // Fetch projects with submitted BOQs
  const { data: projects, isLoading } = useQuery({
    queryKey: ['boq-pending-approval'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          vertical:project_verticals(name),
          submitter:profiles!projects_boq_submitted_by_fkey(name),
          engineer:profiles!projects_assigned_engineer_id_fkey(name)
        `)
        .eq('lifecycle_stage', 'boq_submitted_smo')
        .order('boq_submitted_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch projects previously approved by SMO (moved to GMO or beyond)
  const { data: historyProjects, isLoading: historyLoading } = useQuery({
    queryKey: ['boq-history-smo'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('projects') as any)
        .select('*, vertical:project_verticals(name), submitter:profiles!projects_boq_submitted_by_fkey(name), engineer:profiles!projects_assigned_engineer_id_fkey(name)')
        .eq('boq_smo_approved_by', user?.id)
        .order('boq_smo_approved_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Add real-time synchronization
  useEffect(() => {
    const channel = supabase
      .channel('boq-approvals-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
        console.log('[BOQApprovals] Project change detected, invalidating query:', payload.eventType);
        queryClient.invalidateQueries({ queryKey: ['boq-pending-approval'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const fetchBOQItems = async (projectId: string) => {
    const { data, error } = await supabase
      .from('project_boq')
      .select('*')
      .eq('project_id', projectId)
      .order('line_number');
    if (error) throw error;
    return data;
  };

  const openViewModal = async (project: any) => {
    setSelectedProject(project);
    const items = await fetchBOQItems(project.id);
    setBoqItems(items || []);
    setViewModalOpen(true);
  };

  const approveMutation = useMutation({
    mutationFn: async (project: any) => {
      const { error } = await supabase
        .from('projects')
        .update({
          lifecycle_stage: 'boq_submitted_gmo',
          boq_smo_approved_by: user?.id,
          boq_smo_approved_at: new Date().toISOString(),
        })
        .eq('id', project.id);

      if (error) throw error;

      await supabase.from('project_timeline').insert({
        project_id: project.id,
        action: 'boq_approved_smo',
        performed_by: user?.id,
        performed_by_name: user?.name,
        performed_by_role: user?.role,
        details: { stage: 'L2 Approval (GMO)' }
      });
    },
    onSuccess: (_, project) => {
      toast.success('BOQ approved and forwarded to GMO!');
      queryClient.invalidateQueries({ queryKey: ['boq-history-smo'] });
      queryClient.invalidateQueries({ queryKey: ['boq-pending-approval'] });
      queryClient.invalidateQueries({ queryKey: ['engineering-projects-boq'] });
      queryClient.invalidateQueries({ queryKey: ['project-lifecycle', project.id] });
      queryClient.invalidateQueries({ queryKey: ['execution-summary', project.id] });
      setViewModalOpen(false);
      setSelectedProject(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve BOQ');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ project, reason }: { project: any, reason: string }) => {
      const { error } = await supabase
        .from('projects')
        .update({
          lifecycle_stage: 'engineering_assigned',
          boq_rejection_reason: reason,
          boq_submitted_at: null,
          boq_submitted_by: null,
        })
        .eq('id', project.id);

      if (error) throw error;

      await supabase.from('project_timeline').insert({
        project_id: project.id,
        action: 'boq_rejected',
        performed_by: user?.id,
        performed_by_name: user?.name,
        performed_by_role: user?.role,
        details: { reason },
      });
    },
    onSuccess: (_, { project }) => {
      toast.success('BOQ rejected and returned to engineer');
      queryClient.invalidateQueries({ queryKey: ['boq-pending-approval'] });
      queryClient.invalidateQueries({ queryKey: ['engineering-projects-boq'] });
      queryClient.invalidateQueries({ queryKey: ['project-lifecycle', project.id] });
      queryClient.invalidateQueries({ queryKey: ['execution-summary', project.id] });
      setRejectModalOpen(false);
      setViewModalOpen(false);
      setSelectedProject(null);
      setRejectReason('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject BOQ');
    },
  });

  const totalEstimated = boqItems.reduce((sum, item) => sum + (item.quantity * (item.estimated_unit_cost || 0)), 0);

  const totalHistoryCount = (historyProjects?.length || 0) +
    materialRequests.filter(req => req.smo_approved_by === user?.id).length +
    workRequests.filter(req => req.smo_approved_by === user?.id).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Project Approvals</h1>
          <p className="text-muted-foreground text-sm">Manage approvals for BOQs, Material Requests, and Work Orders</p>
        </div>
      </div>

      <Tabs defaultValue="boq" value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <div className="flex overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none">
          <TabsList className="h-auto p-1 bg-muted/30 border border-border/50 shrink-0">
            <TabsTrigger value="boq" className="px-4 py-2 gap-2">
              <ClipboardCheck className="w-4 h-4" />
              <span className="whitespace-nowrap">BOQ Approvals</span>
              {projects && projects.length > 0 && <Badge variant="secondary" className="ml-1 bg-indigo-500/20 text-indigo-300">{projects.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="material" className="px-4 py-2 gap-2">
              <Package className="w-4 h-4" />
              <span className="whitespace-nowrap">Final Material Sign-off</span>
              {pendingMaterial.length > 0 && <Badge variant="secondary" className="ml-1 bg-indigo-500/20 text-indigo-300">{pendingMaterial.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="work" className="px-4 py-2 gap-2">
              <Zap className="w-4 h-4" />
              <span className="whitespace-nowrap">Final Work Sign-off</span>
              {pendingWork.length > 0 && <Badge variant="secondary" className="ml-1 bg-indigo-500/20 text-indigo-300">{pendingWork.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="work-orders" className="px-4 py-2 gap-2">
              <FileText className="w-4 h-4" />
              <span className="whitespace-nowrap">Work Orders</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="px-4 py-2 gap-2">
              <Clock className="w-4 h-4" />
              <span className="whitespace-nowrap">My Approval History</span>
              {totalHistoryCount > 0 && <Badge variant="secondary" className="ml-1">{totalHistoryCount}</Badge>}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="boq" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects?.length === 0 ? (
              <Card className="col-span-full border-dashed p-12 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <ClipboardCheck className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No BOQs pending approval</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  You're all caught up! New requests will appear here.
                </p>
              </Card>
            ) : (
              projects?.map((project: any) => (
                <Card key={project.id} className="group hover:shadow-md transition-all duration-300 border-border/50">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline" className="mb-2 bg-blue-50 text-blue-700 border-blue-200">
                        {project.project_id}
                      </Badge>
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
                        Pending L1 (SMO)
                      </Badge>
                    </div>
                    <CardTitle className="text-lg line-clamp-1">{project.project_name}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Badge variant="secondary" className="text-xs font-normal">
                        {project.vertical?.name || 'General'}
                      </Badge>
                      <span>•</span>
                      <span>By {project.submitter?.name || 'Unknown'}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                        <div>
                          <span className="block font-medium text-foreground">Submitted</span>
                          {format(new Date(project.boq_submitted_at), 'MMM d, yyyy')}
                        </div>
                        <div>
                          <span className="block font-medium text-foreground">Engineer</span>
                          {project.engineer?.name || 'Unassigned'}
                        </div>
                        <div className="col-span-2 mt-1 pt-2 border-t border-border/50">
                          <span className="block font-medium text-foreground mb-1">Location</span>
                          {project.site_address || 'No location specified'}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          className="flex-1 gap-2"
                          onClick={() => openViewModal(project)}
                        >
                          <Eye className="w-4 h-4" /> View BOQ
                        </Button>
                        <Button
                          className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => {
                            approveMutation.mutate(project);
                          }}
                          disabled={approveMutation.isPending}
                        >
                          {approveMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          Approve
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 h-8 text-xs"
                        onClick={() => {
                          setSelectedProject(project);
                          setRejectModalOpen(true);
                        }}
                      >
                        Reject & Send Feedback
                      </Button>
                    </div>
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
                <ShoppingCart className="w-5 h-5 text-blue-400" /> Pending Material Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingMaterial.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                  No material requests pending SMO approval.
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingMaterial.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/5 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">REQ-{req.id.slice(0, 8).toUpperCase()}</span>
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending SMO</Badge>
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
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedMaterial(req);
                            setMaterialDetailOpen(true);
                          }}
                          className="gap-2"
                        >
                          <Eye className="w-4 h-4" /> View
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedMaterial(req);
                            setRejectType('material');
                            setRejectModalOpen(true);
                          }}
                          variant="outline"
                          className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="w-4 h-4" /> Reject
                        </Button>
                        <Button size="sm" onClick={() => approveMaterialRequest(req.id, 'smo')} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                          <Check className="w-4 h-4" /> Approve
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
                <Hammer className="w-5 h-5 text-violet-400" /> Pending Work Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingWork.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                  No work requests pending SMO approval.
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingWork.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/5 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">WR-{req.id.slice(0, 8).toUpperCase()}</span>
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending SMO</Badge>
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
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedWork(req);
                            setWorkDetailOpen(true);
                          }}
                          className="gap-2"
                        >
                          <Eye className="w-4 h-4" /> View
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedWork(req);
                            setRejectType('work');
                            setRejectModalOpen(true);
                          }}
                          variant="outline"
                          className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="w-4 h-4" /> Reject
                        </Button>
                        <Button size="sm" onClick={() => approveWorkRequest(req.id, 'smo')} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                          <Check className="w-4 h-4" /> Approve
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
          <WorkOrderMonitoringWidget role="smo" showApprovalActions={true} />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" /> My Personal Approval History
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs defaultValue="history-boq" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="history-boq" className="gap-2">
                    BOQs {historyProjects && historyProjects.length > 0 && <Badge variant="secondary" className="h-5 px-1.5">{historyProjects.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="history-material" className="gap-2">
                    Materials {(() => {
                      const count = materialRequests.filter(req => req.smo_approved_by === user?.id).length;
                      return count > 0 && <Badge variant="secondary" className="h-5 px-1.5">{count}</Badge>;
                    })()}
                  </TabsTrigger>
                  <TabsTrigger value="history-work" className="gap-2">
                    Work Orders {(() => {
                      const count = workRequests.filter(req => req.smo_approved_by === user?.id).length;
                      return count > 0 && <Badge variant="secondary" className="h-5 px-1.5">{count}</Badge>;
                    })()}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="history-boq">
                  {historyLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : historyProjects?.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                      No approved BOQ history found.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border/50">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead>Project</TableHead>
                            <TableHead>Engineer</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Current Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historyProjects?.map((project: any) => (
                            <TableRow key={project.id} className="hover:bg-muted/20">
                              <TableCell>
                                <div className="font-medium">{project.project_name}</div>
                                <div className="text-xs text-muted-foreground font-mono">{project.project_id}</div>
                              </TableCell>
                              <TableCell className="text-sm">{project.engineer?.name}</TableCell>
                              <TableCell className="text-sm">
                                {project.boq_smo_approved_at ? format(new Date(project.boq_smo_approved_at), 'MMM d, yyyy') : 'N/A'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize text-[10px] py-0">
                                  {project.lifecycle_stage.replace(/_/g, ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-2 text-primary"
                                  onClick={() => openViewModal(project)}
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
                    const historyMaterial = materialRequests.filter(req => req.smo_approved_by === user?.id);
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
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {historyMaterial.map(req => (
                              <TableRow key={req.id}>
                                <TableCell className="font-mono text-xs uppercase">{req.id.slice(0, 8)}</TableCell>
                                <TableCell className="text-sm font-medium">{req.project?.project_name}</TableCell>
                                <TableCell className="text-sm">{req.boq_items?.length || 0} items</TableCell>
                                <TableCell className="text-sm">{req.smo_approved_at ? format(new Date(req.smo_approved_at), 'MMM d, yyyy') : 'N/A'}</TableCell>
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
                    const historyWork = workRequests.filter(req => req.smo_approved_by === user?.id);
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
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {historyWork.map(req => (
                              <TableRow key={req.id}>
                                <TableCell className="font-mono text-xs uppercase">{req.id.slice(0, 8)}</TableCell>
                                <TableCell className="text-sm font-medium">{req.project?.project_name}</TableCell>
                                <TableCell className="text-sm capitalize">{req.work_type}</TableCell>
                                <TableCell className="text-sm">{req.smo_approved_at ? format(new Date(req.smo_approved_at), 'MMM d, yyyy') : 'N/A'}</TableCell>
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

      {/* View BOQ Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review BOQ - {selectedProject?.project_name}</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-muted-foreground">
                {boqItems.length} items • Total Estimated: <strong className="text-primary">₹{totalEstimated.toLocaleString()}</strong>
              </p>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Material/Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Est. Cost</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boqItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.line_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.material_name}</p>
                          {item.specification && (
                            <p className="text-sm text-muted-foreground">{item.specification}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{item.category}</Badge>
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>₹{item.estimated_unit_cost?.toLocaleString() || 0}</TableCell>
                      <TableCell className="font-medium">
                        ₹{(item.quantity * (item.estimated_unit_cost || 0)).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {selectedProject?.lifecycle_stage === 'boq_submitted_smo' && (
              <>
                <Button variant="destructive" onClick={() => setRejectModalOpen(true)}>
                  <X className="h-4 w-4 mr-2" /> Reject
                </Button>
                <Button onClick={() => approveMutation.mutate(selectedProject)} disabled={approveMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                  {approveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Approve & Forward to GMO
                </Button>
              </>
            )}
            {selectedProject?.lifecycle_stage !== 'boq_submitted_smo' && (
              <Button variant="outline" onClick={() => setViewModalOpen(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject BOQ</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Rejection Reason *</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain what needs to be corrected..."
              className="mt-2"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRejectModalOpen(false);
              setRejectReason('');
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (rejectType === 'boq') {
                  rejectMutation.mutate({ project: selectedProject, reason: rejectReason });
                } else if (rejectType === 'material') {
                  await rejectMaterialRequest(selectedMaterial.id, rejectReason);
                  setRejectModalOpen(false);
                  setRejectReason('');
                  setSelectedMaterial(null);
                } else if (rejectType === 'work') {
                  await rejectWorkRequest(selectedWork.id, rejectReason);
                  setRejectModalOpen(false);
                  setRejectReason('');
                  setSelectedWork(null);
                }
              }}
              disabled={!rejectReason || rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject {rejectType.toUpperCase()}
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
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>Item Details</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedMaterial?.boq_items?.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm py-2">{item.item_name || item.material_name || item.description}</TableCell>
                          <TableCell className="text-right text-sm py-2 font-medium">{item.quantity || item.requested_quantity} {item.unit}</TableCell>
                          <TableCell className="text-right text-sm py-2">
                            ₹{(item.unit_price || item.estimated_unit_cost || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-sm py-2 font-semibold">
                            ₹{((item.quantity || item.requested_quantity || 0) * (item.unit_price || item.estimated_unit_cost || 0)).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {selectedMaterial?.smo_approved_at && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <div className="text-xs">
                    <div className="text-emerald-500 font-semibold text-sm">Approved by you</div>
                    <div className="text-muted-foreground">on {format(new Date(selectedMaterial.smo_approved_at), 'PPPp')}</div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 border-t border-border/50 bg-muted/20">
            <Button variant="outline" onClick={() => setMaterialDetailOpen(false)}>Close</Button>
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
                <div className="text-sm bg-muted/50 p-4 rounded-md border border-border/30 whitespace-pre-wrap leading-relaxed">
                  {selectedWork?.work_description}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Timeline</Label>
                  <div className="text-sm font-semibold flex items-center gap-2 bg-muted/50 p-2 rounded-md border border-border/30">
                    <Clock className="w-4 h-4 text-indigo-400" /> {selectedWork?.timeline_days} Days
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Request Status</Label>
                  <div className="text-sm font-semibold flex items-center gap-2 bg-muted/50 p-2 rounded-md border border-border/30 capitalize">
                    {selectedWork?.status?.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>

              {selectedWork?.smo_approved_at && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <div className="text-xs">
                    <div className="text-emerald-500 font-semibold text-sm">Approved by you</div>
                    <div className="text-muted-foreground">on {format(new Date(selectedWork.smo_approved_at), 'PPPp')}</div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 border-t border-border/50 bg-muted/20">
            <Button variant="outline" onClick={() => setWorkDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
