import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderKanban, Clock, Check, X, Pause, Loader2, Package, Hammer,
  CreditCard, CheckCircle, CheckCircle2, AlertTriangle, TrendingUp, FileText,
  BarChart3, Plus, RefreshCw, MapPin, Pencil,
  ChevronDown, Activity,
  Layers, CircleDot, Calendar, Building2, Target, Sparkles,
  ShoppingCart, ClipboardList, LayoutTemplate, Wrench, ArrowRight, Truck, Users, ShieldCheck, Timer, XCircle,
  Download, Upload, Send, Eye, IndianRupee, FileSearch, ClipboardCheck
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { useProjects } from '@/hooks/useProjects';
import { useProjectExecution } from '@/hooks/useProjectExecution';
import { useProjectPhases } from '@/hooks/useProjectPhases';
import { useMilestones, useDeviationRequests } from '@/hooks/useMilestones';
import { useMaterialRequests } from '@/hooks/useMaterialRequests';
import { useVendorWorkRequests, VendorWorkRequest } from '@/hooks/useVendorWorkRequests';
import { getMaterialDisplayStatus } from '@/lib/materialStatusResolver';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useWorkOrderAudits } from '@/hooks/useWorkOrderAudits';
import { useProjectTimeline } from '@/hooks/useProjectTimeline';
import { useDailySiteUpdates } from '@/hooks/useDailySiteUpdates';
import { UploadSignedDocModal } from '@/components/engineering/UploadSignedDocModal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LIFECYCLE_STAGES } from '@/constants/projectCategories';

// Import modals
import { PhaseUpdateModal } from '@/components/engineering/PhaseUpdateModal';
import { BOQItemUpdateModal } from '@/components/engineering/BOQItemUpdateModal';
import { AddPhaseModal } from '@/components/engineering/AddPhaseModal';
import { MaterialRequestModal } from '@/components/engineering/MaterialRequestModal';
import { VendorWorkRequestModal } from '@/components/engineering/VendorWorkRequestModal';
import { ConvertToWorkOrderModal } from '@/components/engineering/ConvertToWorkOrderModal';
import { ProjectDailyLogsWidget } from '@/components/engineering/ProjectDailyLogsWidget';
import { MilestoneManager } from '@/components/engineering/MilestoneManager';
import { ProjectActivityTimeline } from '@/components/engineering/ProjectActivityTimeline';
import { BOQBuilderWorkspace } from '@/components/engineering/BOQBuilderWorkspace';
import { JVProjectBadge } from '@/components/jv/JVProjectBadge';

const statusConfig: Record<string, { bg: string; text: string; label: string; icon: React.ElementType; gradient: string }> = {
  pending: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Pending', icon: Clock, gradient: 'from-amber-500/20 to-amber-600/10' },
  admin_approved: { bg: 'bg-sky-500/10', text: 'text-sky-400', label: 'Admin Approved', icon: Check, gradient: 'from-sky-500/20 to-sky-600/10' },
  ceo_approved: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'CEO Approved', icon: Check, gradient: 'from-emerald-500/20 to-emerald-600/10' },
  ceo_hold: { bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'On Hold', icon: Pause, gradient: 'from-orange-500/20 to-orange-600/10' },
  rejected: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Rejected', icon: X, gradient: 'from-red-500/20 to-red-600/10' },
  ordered: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Ordered', icon: Package, gradient: 'from-blue-500/20 to-blue-600/10' },
  sourced: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', label: 'Sourced', icon: Truck, gradient: 'from-indigo-500/20 to-indigo-600/10' },
  delivered: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Delivered', icon: CheckCircle, gradient: 'from-emerald-500/20 to-emerald-600/10' },
  pending_smo: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Pending SMO', icon: Clock, gradient: 'from-amber-500/20 to-amber-600/10' },
  pending_gmo: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Pending GMO', icon: Clock, gradient: 'from-amber-500/20 to-amber-600/10' },
  pending_gm: { bg: 'bg-violet-500/10', text: 'text-violet-400', label: 'Pending GM', icon: Clock, gradient: 'from-violet-500/20 to-violet-600/10' },
  pending_admin: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', label: 'Pending Admin', icon: Clock, gradient: 'from-cyan-500/20 to-cyan-600/10' },
  pending_ceo: { bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Pending CEO', icon: Clock, gradient: 'from-orange-500/20 to-orange-600/10' },
  rejected_smo: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Rejected (SMO)', icon: X, gradient: 'from-red-500/20 to-red-600/10' },
  quoted: { bg: 'bg-violet-500/10', text: 'text-violet-400', label: 'Quoted', icon: FileText, gradient: 'from-violet-500/20 to-violet-600/10' },
  cancelled: { bg: 'bg-slate-500/10', text: 'text-slate-400', label: 'Cancelled', icon: X, gradient: 'from-slate-500/20 to-slate-600/10' },
  approved_for_sourcing: { bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'Ready for Sourcing', icon: CheckCircle2, gradient: 'from-purple-500/20 to-purple-600/10' },
  shipped: { bg: 'bg-sky-500/10', text: 'text-sky-400', label: 'Shipped', icon: Truck, gradient: 'from-sky-500/20 to-sky-600/10' },
  loading: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', label: 'Loading', icon: Timer, gradient: 'from-cyan-500/20 to-cyan-600/10' },
  unloading: { bg: 'bg-teal-500/10', text: 'text-teal-400', label: 'Unloading', icon: Timer, gradient: 'from-teal-500/20 to-teal-600/10' },
  delayed: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Delayed', icon: AlertTriangle, gradient: 'from-red-500/20 to-red-600/10' },
  sourcing: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Sourcing', icon: Package, gradient: 'from-blue-500/20 to-blue-600/10' },

  // Work Request specific statuses
  vendor_search: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Vendor Search', icon: Truck, gradient: 'from-blue-500/20 to-blue-600/10' },
  vendor_aligned: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', label: 'Vendor Aligned', icon: CheckCircle2, gradient: 'from-indigo-500/20 to-indigo-600/10' },
  wo_created: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'WO Created', icon: CheckCircle, gradient: 'from-emerald-500/20 to-emerald-600/10' },
  work_ongoing: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', label: 'Work Ongoing', icon: Loader2, gradient: 'from-cyan-500/20 to-cyan-600/10' },
  completed: { bg: 'bg-green-500/10', text: 'text-green-400', label: 'Completed', icon: CheckCircle2, gradient: 'from-green-500/20 to-green-600/10' },
};

const stageColors: Record<string, string> = {
  new_deal: 'from-slate-500 to-slate-600',
  engineering_assigned: 'from-blue-500 to-blue-600',
  boq_submitted: 'from-indigo-500 to-indigo-600',
  boq_approved: 'from-violet-500 to-violet-600',
  sourcing: 'from-amber-500 to-amber-600',
  execution: 'from-emerald-500 to-emerald-600',
  completed: 'from-green-500 to-green-600',
};

// --- Subcomponents ---

function ProgressRing({ value, size = 60, strokeWidth = 6, color = 'primary' }: { value: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  const colorClasses: Record<string, string> = {
    primary: 'stroke-primary',
    emerald: 'stroke-emerald-500',
    blue: 'stroke-blue-500',
    violet: 'stroke-violet-500',
    amber: 'stroke-amber-500',
  };

  return (
    <div className={cn("relative", `w-[${size}px] h-[${size}px]`)}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-all duration-500", colorClasses[color])}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold">{Math.round(value)}%</span>
      </div>
    </div>
  );
}

// Separate component for heavy details to enable lazy loading
function ProjectCardDetails({ project, isExpanded }: { project: any; isExpanded: boolean }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [activeApprovalTab, setActiveApprovalTab] = useState('boq');
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data hooks - NOW ONLY FETCHING WHEN EXPANDED (or mounted inside this conditional component)
  const { summary, details, isLoading, refetch } = useProjectExecution(project.id);
  const { phases, addPhase, updatePhaseProgress, refetch: refetchPhases } = useProjectPhases(project.id);
  const { requests: materialRequests, createRequest: createMaterialRequest, approveRequest: approveMaterialRequest, isSaving: isSavingMaterial, refetch: refetchMaterialRequests } = useMaterialRequests(project.id);
  const { requests: workRequests, createRequest: createWorkRequest, approveRequest: approveWorkRequest, isSaving: isSavingWork, refetch: refetchWorkRequests } = useVendorWorkRequests(project.id);
  const { workOrders, sendForApproval, resubmitWorkOrder, refetch: refetchWorkOrders } = useWorkOrders(project.id);
  const { createAudit, isSaving: isSavingAudit } = useWorkOrderAudits();
  const { milestones, refetch: refetchMilestones } = useMilestones(project.id);
  const { requests: deviations, refetch: refetchDeviations } = useDeviationRequests(project.id);
  const { entries: timeline, isLoading: timelineLoading, refetch: refetchTimeline } = useProjectTimeline(project.id);
  const { updates: siteUpdates } = useDailySiteUpdates(project.id);

  // Additional WO states
  const [showUploadSigned, setShowUploadSigned] = useState<{ woId: string; woNumber: number } | null>(null);

  // Audit dialog state
  const [showAuditDialog, setShowAuditDialog] = useState(false);
  const [auditWO, setAuditWO] = useState<any>(null);
  const [auditExplanation, setAuditExplanation] = useState('');
  const [auditProofOfCall, setAuditProofOfCall] = useState('');

  // Modal states
  const [selectedPhase, setSelectedPhase] = useState<any>(null);
  const [phaseModalOpen, setPhaseModalOpen] = useState(false);
  const [selectedBOQItem, setSelectedBOQItem] = useState<any>(null);
  const [boqModalOpen, setBOQModalOpen] = useState(false);
  const [addPhaseModalOpen, setAddPhaseModalOpen] = useState(false);
  const [materialRequestModalOpen, setMaterialRequestModalOpen] = useState(false);
  const [workRequestModalOpen, setWorkRequestModalOpen] = useState(false);
  const [isInternalRequest, setIsInternalRequest] = useState(false);
  const [convertToWOModalOpen, setConvertToWOModalOpen] = useState(false);
  const [selectedWorkRequest, setSelectedWorkRequest] = useState<VendorWorkRequest | null>(null);


  // Initialize auto-refresh and Real-time subscription
  useEffect(() => {
    if (!project.id) return;

    const channel = supabase
      .channel(`project-execution-details-${project.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${project.id}` }, () => {
        refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_work_requests', filter: `project_id=eq.${project.id}` }, () => {
        refetchWorkRequests();
        refetchTimeline();
        refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders', filter: `project_id=eq.${project.id}` }, () => {
        refetchWorkOrders();
        refetchTimeline();
        refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_timeline', filter: `project_id=eq.${project.id}` }, () => {
        refetchTimeline();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [project.id, refetch, refetchWorkRequests, refetchWorkOrders, refetchTimeline]);

  // Self-healing: if a WO has payment_stage='audit_pending' or 'audited' but the audit record
  // was deleted from DB, reset payment_stage so "Send for Audit" button reappears.
  useEffect(() => {
    const auditInProcessWOs = workOrders.filter(wo =>
      wo.payment_stage === 'audit_pending' || wo.payment_stage === 'audited'
    );
    if (auditInProcessWOs.length === 0) return;

    const healOrphanedAudits = async () => {
      for (const wo of auditInProcessWOs) {
        // Check for ANY audit record with correct status for the stage
        const targetStatus = wo.payment_stage === 'audit_pending' ? 'pending' : 'approved';

        const { data: existingAudits, error } = await (supabase as any)
          .from('work_order_final_audits')
          .select('id')
          .eq('work_order_id', wo.id)
          .eq('audit_status', targetStatus)
          .limit(1);

        if (error) continue;

        // No record exists for the current stage — reset payment_stage
        if (!existingAudits || existingAudits.length === 0) {
          console.log(`Self-healing: WO ${wo.wo_number} is in stage '${wo.payment_stage}' but no ${targetStatus} audit found. Resetting stage.`);
          await (supabase as any)
            .from('work_orders')
            .update({ payment_stage: 'advance_paid', updated_at: new Date().toISOString() })
            .eq('id', wo.id);
          refetchWorkOrders();
        }
      }
    };
    healOrphanedAudits();
  }, [workOrders, refetchWorkOrders]);

  const currentStage = LIFECYCLE_STAGES.find(s => s.value === project.lifecycle_stage);
  const canEdit = ['employee', 'admin', 'gmo'].includes(user?.role?.toLowerCase() || '') || 
    (user?.role?.toLowerCase() === 'smo' && user?.department?.toLowerCase() === 'engineering');

  const handlePhaseEdit = (phase: any) => {
    setSelectedPhase(phase);
    setPhaseModalOpen(true);
  };

  const handlePhaseSuccess = () => {
    refetchPhases();
    refetch();
  };

  const handleMaterialRequestSubmit = async (data: any) => {
    await createMaterialRequest({
      project_id: project.id,
      phase_id: data.phase_id,
      boq_items: data.boq_items,
      urgency: data.urgency,
      notes: data.notes,
    });
    setMaterialRequestModalOpen(false);
  };

  const handleWorkRequestSubmit = async (data: any) => {
    await createWorkRequest({
      project_id: project.id,
      phase_id: data.phase_id,
      work_type: data.work_type,
      work_description: data.work_description,
      estimated_budget: data.estimated_budget,
      timeline_days: data.timeline_days,
      aligned_vendor_details: isInternalRequest ? { is_internal: true } : undefined,
    });
    setWorkRequestModalOpen(false);
  };

  // Progress Calculations
  const stageProgress = ((currentStage?.order || 1) / LIFECYCLE_STAGES.length) * 100;
  const materialProgress = summary && summary.total_boq_items > 0
    ? ((summary.delivered_boq_items / summary.total_boq_items) * 100)
    : 0;
  const phaseProgress = phases.length > 0
    ? (phases.filter(p => p.status === 'completed').length / phases.length) * 100
    : 0;
  const overallProgress = summary?.overall_completion_percentage || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading project details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border/50">
      <div className="p-5 space-y-5">
        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Project Dashboard</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && (
              <>
                {project.lifecycle_stage === 'boq_submitted_smo' || project.lifecycle_stage === 'boq_submitted_gmo' ? (
                  <Badge variant="outline" className="gap-2 py-2 px-3 bg-amber-500/10 text-amber-500 border-amber-500/30 font-bold shadow-sm animate-pulse">
                    <Clock className="w-3.5 h-3.5" />
                    PENDING {project.lifecycle_stage === 'boq_submitted_smo' ? 'SMO' : 'GMO'} REVIEW
                  </Badge>
                ) : project.lifecycle_stage === 'boq_approved' ? (
                  <Badge variant="outline" className="gap-2 py-2 px-3 bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-bold shadow-sm">
                    <CheckCircle className="w-3.5 h-3.5" /> BOQ APPROVED
                  </Badge>
                ) : project.lifecycle_stage === 'sourcing' ? (
                  <Badge variant="outline" className="gap-2 py-2 px-3 bg-blue-500/10 text-blue-500 border-blue-500/30 font-bold shadow-sm">
                    <Package className="w-3.5 h-3.5" /> SOURCING
                  </Badge>
                ) : project.lifecycle_stage === 'execution' ? (
                  <Badge variant="outline" className="gap-2 py-2 px-3 bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-bold shadow-sm">
                    <Hammer className="w-3.5 h-3.5" /> EXECUTION
                  </Badge>
                ) : project.boq_rejection_reason ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-2 py-2 px-3 bg-rose-500/10 text-rose-500 border-rose-500/30 font-bold shadow-sm cursor-help" title={project.boq_rejection_reason}>
                      <AlertTriangle className="w-3.5 h-3.5" /> BOQ REJECTED
                    </Badge>
                    <Button size="sm" variant="ghost" className="text-rose-500 hover:bg-rose-500/10 text-[10px] h-8" onClick={() => setActiveTab('approvals')}>
                      Review Feedback
                    </Button>
                  </div>
                ) : (
                  <Badge variant="outline" className="gap-2 py-2 px-3 bg-primary/10 text-primary border-primary/30 font-bold shadow-sm">
                    <FileText className="w-3.5 h-3.5" /> BOQ PREPARATION
                  </Badge>
                )}
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          </div>
        </div>

        {/* Progress Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Project Stage', value: stageProgress, sub: currentStage?.label || 'New', color: 'violet', icon: Target },
            { label: 'Materials', value: materialProgress, sub: `${summary?.delivered_boq_items || 0}/${summary?.total_boq_items || 0} delivered`, color: 'blue', icon: Package },
            { label: 'Phases', value: phaseProgress, sub: `${phases.filter(p => p.status === 'completed').length}/${phases.length} done`, color: 'amber', icon: Layers },
            { label: 'Overall', value: overallProgress, sub: `${overallProgress}% complete`, color: 'emerald', icon: TrendingUp },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="relative p-4 rounded-xl border border-border/50 overflow-hidden bg-gradient-to-br from-background to-muted/20"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center",
                  stat.color === 'violet' && "bg-violet-500/20 text-violet-400",
                  stat.color === 'blue' && "bg-blue-500/20 text-blue-400",
                  stat.color === 'amber' && "bg-amber-500/20 text-amber-400",
                  stat.color === 'emerald' && "bg-emerald-500/20 text-emerald-400"
                )}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <span className={cn("text-2xl font-bold",
                  stat.color === 'violet' && "text-violet-400",
                  stat.color === 'blue' && "text-blue-400",
                  stat.color === 'amber' && "text-amber-400",
                  stat.color === 'emerald' && "text-emerald-400"
                )}>
                  {Math.round(stat.value)}%
                </span>
              </div>
              <Progress value={stat.value} className={cn("h-1.5 mb-2",
                stat.color === 'violet' && "[&>div]:bg-violet-500",
                stat.color === 'blue' && "[&>div]:bg-blue-500",
                stat.color === 'amber' && "[&>div]:bg-amber-500",
                stat.color === 'emerald' && "[&>div]:bg-emerald-500"
              )} />
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <p className="text-xs text-muted-foreground/70">{stat.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Layout for Sidebar + Content */}
        <div className="flex flex-col md:flex-row gap-6 min-h-[600px]">
          {/* Side Nav */}
          <div className="w-full md:w-64 space-y-1">
            {[
              { id: 'overview', icon: BarChart3, label: 'Overview', color: 'text-primary' },
              { id: 'approvals', icon: LayoutTemplate, label: 'BOQ Workspace', color: 'text-blue-400' },
              { id: 'payments', icon: CreditCard, label: 'Payments', color: 'text-amber-400' },
              { id: 'daily-logs', icon: Activity, label: 'Daily Logs', color: 'text-rose-400' },
              { id: 'milestones', icon: Target, label: 'Milestones', color: 'text-indigo-400' },
              { id: 'timeline', icon: Clock, label: 'Timeline', color: 'text-slate-400' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group/nav text-left",
                  activeTab === item.id
                    ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                    : "hover:bg-muted/50 text-muted-foreground"
                )}
              >
                <item.icon className={cn("w-4 h-4 transition-transform group-hover/nav:scale-110", activeTab === item.id ? item.color : "text-muted-foreground")} />
                <span className="text-sm font-medium">{item.label}</span>
                {activeTab === item.id && (
                  <motion.div layoutId={`nav-glow-${project.id}`} className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.6)]" />
                )}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Phases Card */}
                    <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
                      <CardHeader className="py-4 px-5 border-b border-border/30 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Layers className="h-4 w-4 text-indigo-400" /> Project Execution Phases
                        </CardTitle>
                        {canEdit && (
                          <Button size="sm" variant="ghost" onClick={() => setAddPhaseModalOpen(true)} className="h-8 px-2 text-primary hover:bg-primary/10">
                            <Plus className="w-4 h-4 mr-1" /> Add Phase
                          </Button>
                        )}
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {phases.length === 0 ? (
                            <div className="col-span-full py-8 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/50">
                              No phases defined yet
                            </div>
                          ) : (
                            phases.map((phase) => {
                              const phaseMilestones = milestones.filter(m => m.phase_id === phase.id);
                              const startDate = phase.started_at ? format(new Date(phase.started_at), 'MMM d, yyyy') : '-';
                              const endDate = phaseMilestones.length > 0 ? format(new Date(Math.max(...phaseMilestones.map(m => new Date(m.planned_date).getTime()))), 'MMM d, yyyy') : (phase.completed_at ? format(new Date(phase.completed_at), 'MMM d, yyyy') : '-');
                              const hasPendingDeviation = deviations.some(d => phaseMilestones.some(m => m.id === d.milestone_id) && d.status.startsWith('pending'));
                              const hasApprovedDeviation = deviations.some(d => phaseMilestones.some(m => m.id === d.milestone_id) && d.status === 'approved');

                              return (
                                <div key={phase.id} className="p-4 rounded-xl bg-muted/20 border border-border/30 hover:shadow-md transition-all flex flex-col justify-between min-h-[160px]">
                                  <div>
                                    <div className="flex items-start justify-between mb-3 gap-2">
                                      <div className="min-w-0 flex-1">
                                        <h4 className="font-semibold text-sm truncate">{phase.phase_name}</h4>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{phase.status.replace(/_/g, ' ')}</p>
                                        {phase.description && (
                                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{phase.description}</p>
                                        )}
                                      </div>
                                      {canEdit && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 hover:bg-primary/10" onClick={() => handlePhaseEdit(phase)}>
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <div className="flex justify-between text-xs mb-1">
                                          <span className="text-muted-foreground">Completion</span>
                                          <span className="font-medium text-primary">{phase.completion_percentage}%</span>
                                        </div>
                                        <Progress value={phase.completion_percentage} className="h-1.5" />
                                      </div>

                                      <div className="grid grid-cols-2 gap-4 border-t border-border/20 pt-3">
                                        <div>
                                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Start</p>
                                          <p className="text-xs font-semibold">{startDate}</p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">End</p>
                                          <p className="text-xs font-semibold">{endDate}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-4 pt-3 border-t border-border/10 flex items-center justify-between">
                                    <div className="flex gap-1.5">
                                      {hasPendingDeviation && (
                                        <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-500 border-amber-500/20 py-0 px-1.5 h-5">
                                          Deviation Pending
                                        </Badge>
                                      )}
                                      {hasApprovedDeviation && (
                                        <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20 py-0 px-1.5 h-5">
                                          Date Updated
                                        </Badge>
                                      )}
                                      {!hasPendingDeviation && !hasApprovedDeviation && <span />}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-[10px] text-indigo-400 hover:text-indigo-500 hover:bg-indigo-500/10 p-0 px-2 font-medium"
                                      onClick={() => setActiveTab('milestones')}
                                    >
                                      {phaseMilestones.length > 0 ? 'Request Deviation' : 'Add Milestones'}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* BOQ Summary Table */}
                    <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
                      <CardHeader className="py-4 px-5 border-b border-border/30">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                          <Package className="h-4 w-4 text-blue-400" /> BOQ Summary & Tracking
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-border/30">
                              <TableHead className="text-xs font-bold py-2">Item</TableHead>
                              <TableHead className="text-xs font-bold py-2">Total</TableHead>
                              <TableHead className="text-xs font-bold py-2">Requested</TableHead>
                              <TableHead className="text-xs font-bold py-2">Procured</TableHead>
                              <TableHead className="text-xs font-bold py-2">Balance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {!details?.boqItems?.length ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No BOQ items added yet</TableCell>
                              </TableRow>
                            ) : (
                              details.boqItems.slice(0, 5).map((item: any) => (
                                <TableRow key={item.id} className="border-border/20 hover:bg-muted/10">
                                  <TableCell className="py-3">
                                    <div>
                                      <p className="font-medium text-sm">{item.material_name}</p>
                                      <p className="text-[10px] text-muted-foreground line-clamp-1">{item.specification}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-3 font-semibold text-sm">{item.quantity} {item.unit}</TableCell>
                                  <TableCell className="py-3 text-sm text-blue-400">{item.requested_quantity || 0}</TableCell>
                                  <TableCell className="py-3 text-sm text-emerald-400">{item.procured_quantity || 0}</TableCell>
                                  <TableCell className="py-3 text-sm font-medium">{item.quantity - (item.requested_quantity || 0)}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    {/* Recent Site Updates Widget */}
                    <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
                      <CardHeader className="py-4 px-5 border-b border-border/30 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Activity className="h-4 w-4 text-rose-400" /> Recent Site Updates
                        </CardTitle>
                        <Button size="sm" variant="ghost" onClick={() => setActiveTab('daily-logs')} className="h-8 text-[10px] text-primary">
                          View All
                        </Button>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          {siteUpdates.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No recent site updates available.</p>
                          ) : (
                            siteUpdates.slice(0, 3).map((update) => (
                              <div key={update.id} className="p-3 rounded-lg bg-muted/20 border border-border/10 space-y-2">
                                <div className="flex items-center justify-between">
                                  <Badge variant="outline" className="text-[9px] py-0">{update.phase?.phase_name || 'General'}</Badge>
                                  <span className="text-[10px] text-muted-foreground">{format(new Date(update.created_at), 'MMM d, h:mm a')}</span>
                                </div>
                                <p className="text-xs font-medium line-clamp-2">{update.work_done}</p>
                                {update.issues_faced && (
                                  <p className="text-[10px] text-amber-500 font-medium">⚠️ {update.issues_faced}</p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Enhanced Grouped Approval History Section */}
                    {(timeline.some(e => e.action.includes('approved') || e.action.includes('rejected'))) && (
                      <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
                        <CardHeader className="py-4 px-5 border-b border-border/30">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-500" /> Complete Approval History
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <Accordion type="multiple" className="w-full">
                            {/* Grouping Logic */}
                            {(() => {
                              const approvalEvents = timeline.filter(e => e.action.includes('approved') || e.action.includes('rejected'));
                              
                              const groups = {
                                wo: approvalEvents.filter(e => e.action.startsWith('wo_') || e.details?.wo_no),
                                material: approvalEvents.filter(e => e.action.startsWith('mr_') || e.action.startsWith('material_')),
                                boq: approvalEvents.filter(e => e.action.startsWith('boq_')),
                                other: approvalEvents.filter(e => !e.action.startsWith('wo_') && !e.action.startsWith('mr_') && !e.action.startsWith('material_') && !e.action.startsWith('boq_') && !e.details?.wo_no)
                              };

                              const renderEventList = (events: typeof approvalEvents) => (
                                <div className="divide-y divide-border/30">
                                  {events.map((event) => {
                                    const isRejected = event.action.includes('rejected');
                                    let label = event.action.replace(/_/g, ' ');
                                    
                                    if (event.action === 'boq_approved_smo') label = 'BOQ L1 Approval (SMO)';
                                    else if (event.action === 'boq_approved_gmo') label = 'BOQ L2 Approval (GMO)';
                                    else if (event.action === 'wo_approved_smo') label = 'WO L1 Approval (SMO)';
                                    else if (event.action === 'wo_approved_gmo') label = 'WO L2 Approval (GMO)';
                                    else if (event.action === 'wo_approved_gm') label = 'WO L3 Approval (GM)';
                                    else if (event.action === 'wo_approved_admin') label = 'WO L4 Approval (Admin)';
                                    else if (event.action === 'wo_approved_ceo') label = 'WO L5 Final Approval (CEO)';

                                    return (
                                      <div key={event.id} className="p-4 flex items-center gap-4 hover:bg-muted/10 transition-colors">
                                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                                          isRejected ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                        )}>
                                          {isRejected ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <p className="text-sm font-bold uppercase tracking-tight truncate">
                                              {label}
                                            </p>
                                            {event.details?.wo_no && (
                                              <Badge variant="outline" className="text-[10px] h-4 font-mono">WO-{event.details.wo_no}</Badge>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[9px] px-1.5 h-4 font-black uppercase bg-primary/10 text-primary border-0">
                                              {event.performed_by_role || 'System'}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground font-medium">by {event.performed_by_name || 'Authorized Personnel'}</span>
                                          </div>
                                          {event.details?.notes && (
                                            <p className="text-xs text-muted-foreground mt-1 italic opacity-80 line-clamp-1">"{event.details.notes}"</p>
                                          )}
                                        </div>
                                        <div className="text-right shrink-0">
                                          <p className="text-xs font-black text-foreground/80 font-mono">
                                            {format(new Date(event.created_at), 'dd MMM yyyy')}
                                          </p>
                                          <p className="text-[10px] text-muted-foreground/60 font-mono">
                                            {format(new Date(event.created_at), 'HH:mm')}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );

                              return (
                                <>
                                  {groups.wo.length > 0 && (
                                    <AccordionItem value="wo-approvals" className="border-b border-border/30">
                                      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/10">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                                            <Hammer className="w-4 h-4 text-indigo-400" />
                                          </div>
                                          <div className="text-left">
                                            <p className="text-sm font-bold uppercase tracking-wider">Work Order Approvals</p>
                                            <p className="text-[10px] text-muted-foreground">{groups.wo.length} stages recorded</p>
                                          </div>
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent>
                                        {renderEventList(groups.wo)}
                                      </AccordionContent>
                                    </AccordionItem>
                                  )}

                                  {groups.material.length > 0 && (
                                    <AccordionItem value="material-approvals" className="border-b border-border/30">
                                      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/10">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                            <ShoppingCart className="w-4 h-4 text-amber-400" />
                                          </div>
                                          <div className="text-left">
                                            <p className="text-sm font-bold uppercase tracking-wider">Material Request Approvals</p>
                                            <p className="text-[10px] text-muted-foreground">{groups.material.length} events recorded</p>
                                          </div>
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent>
                                        {renderEventList(groups.material)}
                                      </AccordionContent>
                                    </AccordionItem>
                                  )}

                                  {groups.boq.length > 0 && (
                                    <AccordionItem value="boq-approvals" className="border-b border-border/30">
                                      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/10">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                            <FileText className="w-4 h-4 text-blue-400" />
                                          </div>
                                          <div className="text-left">
                                            <p className="text-sm font-bold uppercase tracking-wider">BOQ Workspace Approvals</p>
                                            <p className="text-[10px] text-muted-foreground">{groups.boq.length} decisions recorded</p>
                                          </div>
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent>
                                        {renderEventList(groups.boq)}
                                      </AccordionContent>
                                    </AccordionItem>
                                  )}

                                  {groups.other.length > 0 && (
                                    <AccordionItem value="other-approvals" className="border-none">
                                      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/10">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-lg bg-slate-500/10 flex items-center justify-center">
                                            <Activity className="w-4 h-4 text-slate-400" />
                                          </div>
                                          <div className="text-left">
                                            <p className="text-sm font-bold uppercase tracking-wider">Other Approvals</p>
                                            <p className="text-[10px] text-muted-foreground">{groups.other.length} entries</p>
                                          </div>
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent>
                                        {renderEventList(groups.other)}
                                      </AccordionContent>
                                    </AccordionItem>
                                  )}
                                </>
                              );
                            })()}
                          </Accordion>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {activeTab === 'approvals' && (
                  <div className="space-y-4">
                    <Tabs value={activeApprovalTab} onValueChange={setActiveApprovalTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-3 max-w-lg mb-4">
                        <TabsTrigger value="boq">BOQ Workspace</TabsTrigger>
                        <TabsTrigger value="material">Material Requests</TabsTrigger>
                        <TabsTrigger value="work">Work Requests</TabsTrigger>
                      </TabsList>

                      {activeApprovalTab === 'boq' && <BOQBuilderWorkspace projectId={project.id} />}

                      {activeApprovalTab === 'material' && (
                        <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
                          <CardHeader className="py-4 px-5 border-b border-border/30 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                              <ShoppingCart className="h-4 w-4 text-blue-400" /> Material Requests <Badge variant="secondary" className="ml-2">{materialRequests.filter(r => r.boq_items && r.boq_items.length > 0).length}</Badge>
                            </CardTitle>
                            {canEdit && <Button size="sm" variant="ghost" onClick={() => setMaterialRequestModalOpen(true)} className="h-8 px-2"><Plus className="w-4 h-4" /></Button>}
                          </CardHeader>
                          <CardContent className="p-4">
                            <ScrollArea className="h-[500px]">
                              <div className="space-y-3">
                                {materialRequests.filter(r => r.boq_items && r.boq_items.length > 0).map((req) => (
                                  <div key={req.id} className="p-4 rounded-xl bg-muted/20 border border-border/30 hover:bg-muted/30 transition-all">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[10px] font-mono">REQ-{req.id.slice(0, 5).toUpperCase()}</Badge>
                                        <Badge className={cn("text-[10px] border-0", 
                                          req.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400' :
                                          req.status === 'ordered' ? 'bg-indigo-500/20 text-indigo-400' :
                                          'bg-amber-500/20 text-amber-400'
                                        )}>
                                          {req.status?.toUpperCase()}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {(req as any).approval_status === 'pending_smo' && (user?.role === 'smo' || user?.role === 'admin') && (
                                          <Button size="sm" variant="outline" className="h-6 text-[10px] border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10" onClick={() => approveMaterialRequest(req.id, 'smo')}>
                                            Approve
                                          </Button>
                                        )}
                                        {(req as any).approval_status === 'pending_gmo' && (user?.role === 'gmo' || user?.role === 'admin') && (
                                          <Button size="sm" variant="outline" className="h-6 text-[10px] border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10" onClick={() => approveMaterialRequest(req.id, 'gmo')}>
                                            Approve
                                          </Button>
                                        )}
                                      </div>
                                    </div>

                                    <div className="space-y-1 mb-4 p-2.5 rounded-lg bg-background/40 border border-border/20">
                                      {req.boq_items?.map((item: any, i: number) => (
                                        <p key={i} className="text-xs font-medium flex items-center gap-2">
                                          <span className="w-1 h-1 rounded-full bg-primary/60" />
                                          {item.material_name} <span className="text-muted-foreground font-mono">({item.quantity} {item.unit})</span>
                                        </p>
                                      ))}
                                    </div>

                                    {/* Material Request Status Timeline */}
                                    <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/20">
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Request Progress</span>
                                        <span className="text-[10px] font-bold tabular-nums text-primary/80">Ref: REQ-{req.id.slice(0, 5).toUpperCase()}</span>
                                      </div>

                                      <div className="space-y-3 relative before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border/30">
                                        {[
                                           { label: 'Created', date: req.created_at, status: 'completed' },
                                           { label: 'SMO Approval', date: (req as any).smo_approved_at, status: (req as any).smo_approved_at ? 'completed' : ((req as any).approval_status === 'pending_smo' ? 'pending' : 'waiting') },
                                           { label: 'GMO Approval', date: (req as any).gmo_approved_at, status: (req as any).gmo_approved_at ? 'completed' : ((req as any).approval_status === 'pending_gmo' ? 'pending' : 'waiting') },
                                           { label: 'GM Approval', date: (req as any).gm_approved_at, status: (req as any).gm_approved_at ? 'completed' : ((req as any).approval_status === 'pending_gm' ? 'pending' : 'waiting') },
                                           { label: 'Admin Approval', date: (req as any).admin_approved_at, status: (req as any).admin_approved_at ? 'completed' : ((req as any).approval_status === 'pending_admin' ? 'pending' : 'waiting') },
                                           { label: 'CEO Approval', date: (req as any).ceo_approved_at, status: (req as any).ceo_approved_at ? 'completed' : ((req as any).approval_status === 'pending_ceo' ? 'pending' : 'waiting') },
                                           { label: 'Sourcing Aligned', date: (req as any).status === 'vendor_aligned' || (req as any).status === 'wo_created' || (req as any).status === 'work_ongoing' || (req as any).status === 'completed' ? req.updated_at : null, status: (req as any).status === 'vendor_aligned' || (req as any).status === 'wo_created' || (req as any).status === 'work_ongoing' || (req as any).status === 'completed' ? 'completed' : ((req as any).approval_status === 'approved_for_sourcing' ? 'pending' : 'waiting') },
                                           { label: 'WO Creation', date: (req as any).status === 'wo_created' || (req as any).status === 'work_ongoing' || (req as any).status === 'completed' ? req.updated_at : null, status: (req as any).status === 'wo_created' || (req as any).status === 'work_ongoing' || (req as any).status === 'completed' ? 'completed' : ((req as any).status === 'vendor_aligned' ? 'pending' : 'waiting') },
                                        ].map((step, idx) => {
                                          const isCompleted = step.status === 'completed';
                                          const isPending = step.status === 'pending';
                                          const isRejected = step.status === 'rejected';

                                          return (
                                            <div key={idx} className="flex gap-3 pl-0.5">
                                              <div className={cn(
                                                "w-4 h-4 rounded-full border-2 shrink-0 z-10 flex items-center justify-center transition-all duration-300 translate-y-0.5",
                                                isCompleted ? "bg-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" :
                                                  isRejected ? "bg-red-500 border-red-500" :
                                                    isPending ? "bg-amber-500 border-amber-500 animate-pulse" :
                                                      "bg-background border-muted-foreground/30"
                                              )}>
                                                {isCompleted && <Check className="w-2.5 h-2.5 text-white" />}
                                                {isRejected && <X className="w-2.5 h-2.5 text-white" />}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                  <span className={cn(
                                                    "text-[11px] font-bold uppercase tracking-wider",
                                                    isCompleted ? "text-emerald-400" :
                                                      isPending ? "text-amber-400" :
                                                        "text-muted-foreground/60"
                                                  )}>
                                                    {step.label}
                                                  </span>
                                                  {step.date && (
                                                    <span className="text-[9px] font-mono text-muted-foreground/50 bg-muted/20 px-1.5 py-0.5 rounded">
                                                      {format(new Date(step.date), 'dd MMM, HH:mm')}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      )}

                      {activeApprovalTab === 'work' && (
                        <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
                          <CardHeader className="py-4 px-5 border-b border-border/30 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                              <Hammer className="h-4 w-4 text-violet-400" /> Work Requests <Badge variant="secondary" className="ml-2">{workRequests.length}</Badge>
                            </CardTitle>
                            {canEdit && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-8 px-2">
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 bg-card border-border/50 shadow-2xl">
                                  <DropdownMenuItem 
                                    className="flex items-center gap-2 cursor-pointer focus:bg-primary/10 transition-colors py-2"
                                    onClick={() => {
                                      setIsInternalRequest(false);
                                      setWorkRequestModalOpen(true);
                                    }}
                                  >
                                    <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                                      <Building2 className="w-3.5 h-3.5 text-primary" />
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-tight">New Vendor Request</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="flex items-center gap-2 cursor-pointer focus:bg-indigo-500/10 transition-colors py-2"
                                    onClick={() => {
                                      setIsInternalRequest(true);
                                      setWorkRequestModalOpen(true);
                                    }}
                                  >
                                    <div className="w-6 h-6 rounded bg-indigo-500/10 flex items-center justify-center">
                                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-tight">New Internal Request</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </CardHeader>
                          <CardContent className="p-4">
                            <ScrollArea className="h-[500px]">
                              <div className="space-y-3">
                                {workRequests.map((req) => {
                                  // Find linked WO (try linked_wo_id → vendor_work_request_id → project_id fallback)
                                  const wo = ((req as any).linked_wo_id
                                    ? workOrders.find(w => w.id === (req as any).linked_wo_id)
                                    : null)
                                    || workOrders.find(w => w.vendor_work_request_id === req.id)
                                    || workOrders.find(w => w.project_id === req.project_id);

                                  // WO approval steps for the timeline
                                  const woSteps = [
                                    { key: 'pending_signature', label: 'Awaiting Signature', color: 'text-orange-400' },
                                    { key: 'signed', label: 'Signed', color: 'text-cyan-400' },
                                    { key: 'pending_smo', label: 'SMO Review', color: 'text-blue-400' },
                                    { key: 'pending_gmo', label: 'GMO Review', color: 'text-blue-400' },
                                    { key: 'pending_gm', label: 'GM Review', color: 'text-violet-400' },
                                    { key: 'pending_admin', label: 'Admin Review', color: 'text-amber-400' },
                                    { key: 'pending_ceo', label: 'CEO Review', color: 'text-amber-400' },
                                    { key: 'approved', label: 'Approved', color: 'text-emerald-400' },
                                    { key: 'rejected', label: 'Rejected', color: 'text-red-400' },
                                  ];
                                  const currentStepIdx = wo ? woSteps.findIndex(s => s.key === wo.status) : -1;

                                  return (
                                    <div key={req.id} className="p-4 rounded-xl bg-muted/20 border border-border/30">
                                      <div className="flex justify-between items-start mb-2">
                                        <div>
                                          <Badge variant="outline" className="mb-2 text-[10px]">{req.work_type}</Badge>
                                          <p className="text-sm font-medium">{req.work_description}</p>
                                        </div>
                                        {(() => {
                                          const displayKey = getMaterialDisplayStatus(req as any); const cfg = statusConfig[displayKey] || statusConfig.pending; return (
                                            <Badge className={cn("text-[10px] border-0", cfg.bg, cfg.text)}>
                                              {cfg.label}
                                            </Badge>
                                          );
                                        })()}
                                      </div>

                                      {/* WO Status Timeline - shown when WO exists */}
                                      {wo && (
                                        <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/20">
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] uppercase font-bold tracking-wide text-muted-foreground">WO-{String(wo.wo_number).padStart(3, '0')} Status</span>
                                            <Badge className={cn("text-[9px] border-0",
                                              wo.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                                                wo.status === 'pending_signature' ? 'bg-orange-500/20 text-orange-400' :
                                                  wo.status === 'signed' ? 'bg-cyan-500/20 text-cyan-400' :
                                                    wo.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                                      'bg-blue-500/20 text-blue-400'
                                            )}>
                                              {woSteps.find(s => s.key === wo.status)?.label || wo.status}
                                            </Badge>
                                          </div>
                                          {/* Mini step progress bar */}
                                          {/* Mini step progress bar */}
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Work Order Progress</span>
                                            <span className="text-[10px] font-bold tabular-nums text-primary/80">Ref: WO-{String(wo.wo_number).padStart(3, '0')}</span>
                                          </div>

                                          {/* Detailed Approval Timeline */}
                                          <div className="mt-4 space-y-3 relative before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border/30">
                                            {[
                                              { label: 'Created', role: 'requester', date: wo.created_at, status: 'completed' },
                                              { label: 'SMO Approval', role: 'smo', date: wo.smo_approved_at, status: wo.smo_approved_at ? 'completed' : (wo.status === 'pending_smo' ? 'pending' : (wo.status === 'rejected' && wo.smo_rejection_reason ? 'rejected' : 'waiting')) },
                                              { label: 'GMO Approval', role: 'gmo', date: wo.gmo_approved_at, status: wo.gmo_approved_at ? 'completed' : (wo.status === 'pending_gmo' ? 'pending' : (wo.status === 'rejected' && wo.gmo_rejection_reason ? 'rejected' : 'waiting')) },
                                              { label: 'GM Approval', role: 'gm', date: wo.gm_approved_at, status: wo.gm_approved_at ? 'completed' : (wo.status === 'pending_gm' ? 'pending' : (wo.status === 'rejected' && wo.gm_rejection_reason ? 'rejected' : 'waiting')) },
                                              { label: 'Admin Approval', role: 'admin', date: wo.admin_approved_at, status: wo.admin_approved_at ? 'completed' : (wo.status === 'pending_admin' ? 'pending' : (wo.status === 'rejected' && wo.admin_rejection_reason ? 'rejected' : 'waiting')) },
                                              { label: 'CEO Approval', role: 'ceo', date: wo.ceo_approved_at, status: wo.ceo_approved_at ? 'completed' : (wo.status === 'pending_ceo' ? 'pending' : (wo.status === 'ceo_hold' ? 'on_hold' : (wo.status === 'rejected' && wo.ceo_hold_reason ? 'rejected' : 'waiting'))) },
                                            ].map((step, idx) => {
                                              const isCompleted = step.status === 'completed';
                                              const isPending = step.status === 'pending';
                                              const isRejected = step.status === 'rejected';
                                              const isOnHold = step.status === 'on_hold';

                                              return (
                                                <div key={idx} className="flex gap-3 pl-0.5">
                                                  <div className={cn(
                                                    "w-4 h-4 rounded-full border-2 shrink-0 z-10 flex items-center justify-center transition-all duration-300 translate-y-0.5",
                                                    isCompleted ? "bg-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" :
                                                      isRejected ? "bg-red-500 border-red-500" :
                                                        isPending ? "bg-amber-500 border-amber-500 animate-pulse" :
                                                          isOnHold ? "bg-orange-500 border-orange-500" :
                                                            "bg-background border-muted-foreground/30"
                                                  )}>
                                                    {isCompleted && <Check className="w-2.5 h-2.5 text-white" />}
                                                    {isRejected && <X className="w-2.5 h-2.5 text-white" />}
                                                    {isOnHold && <Pause className="w-2.5 h-2.5 text-white" />}
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                      <span className={cn(
                                                        "text-[11px] font-bold uppercase tracking-wider",
                                                        isCompleted ? "text-emerald-400" :
                                                          isPending ? "text-amber-400" :
                                                            isRejected ? "text-red-400" :
                                                              isOnHold ? "text-orange-400" :
                                                                "text-muted-foreground/60"
                                                      )}>
                                                        {step.label}
                                                      </span>
                                                      {step.date && (
                                                        <span className="text-[9px] font-mono text-muted-foreground/50 bg-muted/20 px-1.5 py-0.5 rounded">
                                                          {format(new Date(step.date), 'dd MMM, HH:mm')}
                                                        </span>
                                                      )}
                                                    </div>
                                                    {!step.date && isPending && (
                                                      <p className="text-[10px] text-muted-foreground/40 mt-0.5 italic">In progress...</p>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                          <div className="mt-6 mb-2">
                                            {wo.status === 'pending_signature' && (
                                              <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/5 border border-orange-500/10">
                                                <Clock className="w-3 h-3 text-orange-500" />
                                                <p className="text-[10px] font-medium text-orange-400">Waiting for vendor to sign the Work Order document</p>
                                              </div>
                                            )}
                                            {wo.status === 'signed' && (
                                              <div className="flex items-center gap-2 p-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                                                <CheckCircle className="w-3 h-3 text-cyan-500" />
                                                <p className="text-[10px] font-medium text-cyan-400">Signed — vendor sourcing team will send for approval</p>
                                              </div>
                                            )}
                                            {(wo.status?.startsWith('pending_')) && wo.status !== 'pending_signature' && (
                                              <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
                                                <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                                                <p className="text-[10px] font-medium text-blue-400">In approval chain — {woSteps.find(s => s.key === wo.status)?.label}</p>
                                              </div>
                                            )}
                                            {wo.status === 'approved' && (
                                              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                                <CheckCircle className="w-3 h-3 text-emerald-500" />
                                                <p className="text-[10px] font-medium text-emerald-400">Work Order fully approved!</p>
                                              </div>
                                            )}
                                            {wo.status === 'rejected' && (
                                              <div className="space-y-2">
                                                <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                                                  <AlertTriangle className="w-3 h-3 text-red-500" />
                                                  <p className="text-[10px] font-medium text-red-400">Work Order Rejected</p>
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/10/30">
                                                  <p className="text-[10px] font-bold text-red-400 uppercase mb-1">Feedback:</p>
                                                  <p className="text-[11px] text-muted-foreground italic">
                                                    {wo.smo_rejection_reason && `SMO: ${wo.smo_rejection_reason}`}
                                                    {wo.gmo_rejection_reason && ` GMO: ${wo.gmo_rejection_reason}`}
                                                    {wo.gm_rejection_reason && ` GM: ${wo.gm_rejection_reason}`}
                                                    {wo.admin_rejection_reason && ` Admin: ${wo.admin_rejection_reason}`}
                                                    {(!wo.smo_rejection_reason && !wo.gmo_rejection_reason && !wo.gm_rejection_reason && !wo.admin_rejection_reason) && 'No specific reason provided.'}
                                                  </p>
                                                </div>
                                              </div>
                                            )}
                                            {wo.signed_document_url && (
                                              <div className="mt-2 text-[10px] border-t border-border/10 pt-2">
                                                <a
                                                  href={wo.signed_document_url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5"
                                                >
                                                  <Eye className="w-3 h-3" />
                                                  VIEW VENDOR-SIGNED DOCUMENT
                                                </a>
                                              </div>
                                            )}
                                          </div>

                                          {/* Engineer Actions */}
                                          <div className="flex gap-2 mt-2 pt-3 border-t border-border/20">
                                            {(wo.status === 'pending_signature' || wo.status === 'wo_created') && (
                                              <>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  className="h-8 text-[10px] font-bold uppercase tracking-wider border-violet-500/30 text-violet-400 hover:text-violet-300 hover:border-violet-500/50 transition-all shadow-lg shadow-violet-900/10"
                                                  onClick={async () => {
                                                    try {
                                                      const { downloadWorkOrderPDF } = await import('@/lib/generateWorkOrderPDF');
                                                      await downloadWorkOrderPDF({
                                                        woNumber: wo.wo_number,
                                                        date: new Date(wo.created_at).toLocaleDateString('en-IN'),
                                                        projectName: project.project_name || 'Project',
                                                        phaseName: req.phase?.phase_name,
                                                        vendorName: req.aligned_vendor_name || 'Vendor',
                                                        vendorContact: req.aligned_vendor_contact || '',
                                                        vendorGST: (req as any).vendor_gst || '',
                                                        workDescription: req.work_description,
                                                        detailedScope: req.work_description,
                                                        agreedAmount: req.final_price || req.estimated_budget || 0,
                                                        advanceAmount: wo.advance_amount || 0,
                                                        startDate: wo.start_date || new Date().toISOString(),
                                                        timelineDays: req.timeline_days || 0,
                                                        termsAndConditions: (wo as any).terms_and_conditions || '',
                                                        vendorBankName: (req as any).vendor_bank_name || undefined,
                                                        vendorAccountNumber: (req as any).vendor_account_number || undefined,
                                                        vendorIFSC: (req as any).vendor_ifsc || undefined,
                                                        vendorAccountHolder: req.aligned_vendor_name || undefined,
                                                      });
                                                      toast.success('Work Order PDF Downloaded');
                                                    } catch (e) {
                                                      toast.error('Failed to generate PDF');
                                                    }
                                                  }}
                                                >
                                                  <Download className="w-3.5 h-3.5 mr-1" />
                                                  Download PDF
                                                </Button>

                                                <Button
                                                  variant="default"
                                                  size="sm"
                                                  className="h-8 text-[10px] font-bold uppercase tracking-wider bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/20 border-0 transition-all"
                                                  onClick={() => setShowUploadSigned({ woId: wo.id, woNumber: wo.wo_number })}
                                                >
                                                  <Upload className="w-3.5 h-3.5 mr-1" />
                                                  Upload Signed
                                                </Button>
                                              </>
                                            )}

                                            {wo.status === 'signed' && (
                                              <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30">
                                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Uploaded</span>
                                                </div>
                                                <Button
                                                  variant="default"
                                                  size="sm"
                                                  className="h-8 text-[10px] font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 border-0 transition-all"
                                                  onClick={() => sendForApproval(wo.id)}
                                                >
                                                  <Send className="w-3.5 h-3.5 mr-1" />
                                                  Send for Approval
                                                </Button>
                                              </div>
                                            )}

                                            {wo.status === 'approved' && (
                                              <>
                                                {wo.advance_amount > 0 && wo.payment_stage !== 'final_paid' && (
                                                  <Button
                                                    variant="default"
                                                    size="sm"
                                                    className="h-8 text-[10px] font-bold uppercase tracking-wider bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20 border-0 transition-all"
                                                    onClick={() => {
                                                      navigate(`/payment-request`, {
                                                        state: {
                                                          workOrderId: wo.id,
                                                          projectId: project.id,
                                                          project_id: project.id,
                                                          amount: wo.advance_amount,
                                                          purpose: `Advance Payment for WO #${wo.wo_number}: ${wo.work_description || 'Project Work'}`,
                                                          vendorName: wo.vendor_name || 'Project Vendor',
                                                          vendorAccountNumber: wo.vendor_account_number || '',
                                                          vendorIfscCode: wo.vendor_ifsc_code || '',
                                                          vendorBankName: '',
                                                          signedDocumentUrl: wo.signed_document_url || '',
                                                          paymentType: 'advance',
                                                          fromWO: true
                                                        }
                                                      });
                                                    }}
                                                  >
                                                    <IndianRupee className="w-3.5 h-3.5 mr-1" />
                                                    Advance Payment
                                                  </Button>
                                                )}
                                                <Button
                                                  variant="default"
                                                  size="sm"
                                                  className="h-8 text-[10px] font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20 border-0 transition-all"
                                                  onClick={() => {
                                                    // Update vendor_work_request status to work_ongoing
                                                    if (req?.id) {
                                                      (supabase as any)
                                                        .from('vendor_work_requests')
                                                        .update({ status: 'work_ongoing' } as any)
                                                        .eq('id', req.id)
                                                        .then(() => { });
                                                    }
                                                    navigate(`/payment-request`, {
                                                      state: {
                                                        workOrderId: wo.id,
                                                        projectId: project.id,
                                                        project_id: project.id,
                                                        amount: wo.estimated_amount,
                                                        purpose: `Progress Payment for WO #${wo.wo_number}: ${wo.work_description || 'Project Work'}`,
                                                        vendorName: wo.vendor_name || 'Project Vendor',
                                                        vendorAccountNumber: wo.vendor_account_number || '',
                                                        vendorIfscCode: wo.vendor_ifsc_code || '',
                                                        vendorBankName: '',
                                                        signedDocumentUrl: wo.signed_document_url || '',
                                                        fromWO: true
                                                      }
                                                    });
                                                  }}
                                                >
                                                  <IndianRupee className="w-3.5 h-3.5 mr-1" />
                                                  Raise Payment
                                                </Button>
                                              </>
                                            )}

                                            {/* Send for Audit - available once WO is approved and not in process or completed */}
                                            {wo.status === 'approved' && wo.payment_stage !== 'audit_pending' && wo.payment_stage !== 'audited' && wo.payment_stage !== 'final_paid' && (
                                              <Button
                                                variant="default"
                                                size="sm"
                                                className="h-8 text-[10px] font-bold uppercase tracking-wider bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20 border-0 transition-all"
                                                onClick={() => {
                                                  setAuditWO(wo);
                                                  setAuditExplanation('');
                                                  setAuditProofOfCall('');
                                                  setShowAuditDialog(true);
                                                }}
                                              >
                                                <FileSearch className="w-3.5 h-3.5 mr-1" />
                                                Send for Audit
                                              </Button>
                                            )}

                                            {/* Audit Pending indicator */}
                                            {wo.payment_stage === 'audit_pending' && (
                                              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/30">
                                                <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Audit Pending</span>
                                              </div>
                                            )}

                                            {/* Raise Final Payment - after audit approved */}
                                            {wo.payment_stage === 'audited' && (
                                              <Button
                                                variant="default"
                                                size="sm"
                                                className="h-8 text-[10px] font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 border-0 transition-all"
                                                onClick={() => navigate(`/payment-request`, {
                                                  state: {
                                                    workOrderId: wo.id,
                                                    projectId: project.id,
                                                    project_id: project.id,
                                                    amount: wo.estimated_amount,
                                                    purpose: `Final Payment for WO #${wo.wo_number}: ${wo.work_description || 'Project Work'}`,
                                                    vendorName: wo.vendor_name || 'Project Vendor',
                                                    vendorAccountNumber: wo.vendor_account_number || '',
                                                    vendorIfscCode: wo.vendor_ifsc_code || '',
                                                    vendorBankName: '',
                                                    signedDocumentUrl: wo.signed_document_url || '',
                                                    paymentType: 'final',
                                                    fromWO: true
                                                  }
                                                })}
                                              >
                                                <ClipboardCheck className="w-3.5 h-3.5 mr-1" />
                                                Raise Final Payment
                                              </Button>
                                            )}

                                            {wo.status === 'rejected' && (
                                              <Button
                                                variant="default"
                                                size="sm"
                                                className="h-8 text-[10px] font-bold uppercase tracking-wider bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/20 border-0 transition-all"
                                                onClick={async () => {
                                                  if (confirm('Are you sure you want to resubmit this Work Order? It will require vendor signature again.')) {
                                                    await resubmitWorkOrder(wo.id, {});
                                                    refetchWorkOrders();
                                                  }
                                                }}
                                              >
                                                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                                                Resubmit Order
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      <div className="flex justify-end gap-2 mt-2">
                                        {(req as any).approval_status === 'pending_smo' && (user?.role === 'smo' || user?.role === 'admin') && (
                                          <Button size="sm" variant="outline" className="h-6 text-[10px] border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10" onClick={() => approveWorkRequest(req.id, 'smo')}>
                                            Approve
                                          </Button>
                                        )}
                                        {(req as any).approval_status === 'pending_gmo' && (user?.role === 'gmo' || user?.role === 'admin') && (
                                          <Button size="sm" variant="outline" className="h-6 text-[10px] border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10" onClick={() => approveWorkRequest(req.id, 'gmo')}>
                                            Approve
                                          </Button>
                                        )}
                                      </div>
                                      {((req.status === 'vendor_aligned') || (req.approval_status === 'approved_for_sourcing' && req.aligned_vendor_details?.is_internal)) && canEdit && (
                                        <Button size="sm" className="mt-2 w-full h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20 font-bold uppercase tracking-wider" onClick={() => { setSelectedWorkRequest(req); setConvertToWOModalOpen(true); }}>
                                          Convert to Work Order
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      )}
                    </Tabs>
                  </div>
                )}


                {activeTab === 'payments' && (
                  <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
                    <CardHeader className="py-4 px-5 border-b border-border/30">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4 text-emerald-400" /> Payments</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <ScrollArea className="h-56">
                        <div className="space-y-2">
                          {details?.payments?.map((payment: any) => (
                            <div key={payment.id} className="p-4 rounded-xl bg-muted/20 border border-border/30 flex justify-between items-center">
                              <div>
                                <p className="text-sm text-muted-foreground">{payment.purpose}</p>
                                <Badge variant="outline" className="mt-1 text-xs">PAY-{String(payment.payment_number).padStart(3, '0')}</Badge>
                              </div>
                              <p className="font-bold text-lg">₹{Number(payment.amount).toLocaleString('en-IN')}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                {activeTab === 'daily-logs' && <ProjectDailyLogsWidget projectId={project.id} phases={phases.map(p => ({ id: p.id, phase_name: p.phase_name }))} canEdit={canEdit} userRole={user?.role} />}

                {activeTab === 'milestones' && <MilestoneManager projectId={project.id} phases={phases.map(p => ({ id: p.id, phase_name: p.phase_name }))} />}

                {activeTab === 'timeline' && (
                  <ProjectActivityTimeline entries={timeline} isLoading={timelineLoading} onRefresh={refetchTimeline} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Modals placed at Details level to ensure they have access to context */}
        {selectedPhase && <PhaseUpdateModal open={phaseModalOpen} onOpenChange={setPhaseModalOpen} phase={selectedPhase} projectId={project.id} onSuccess={handlePhaseSuccess} />}
        {selectedBOQItem && <BOQItemUpdateModal open={boqModalOpen} onOpenChange={setBOQModalOpen} item={selectedBOQItem} onSuccess={refetch} />}
        <AddPhaseModal open={addPhaseModalOpen} onOpenChange={setAddPhaseModalOpen} projectId={project.id} onSuccess={handlePhaseSuccess} />
        <MaterialRequestModal open={materialRequestModalOpen} onOpenChange={setMaterialRequestModalOpen} projectId={project.id} phases={phases.map(p => ({ id: p.id, phase_name: p.phase_name }))} boqItems={(project.lifecycle_stage === 'boq_approved' || project.lifecycle_stage === 'sourcing' || project.lifecycle_stage === 'execution' ? (details?.boqItems || []) : []).map((item: any) => ({ id: item.id, material_name: item.material_name, specification: item.specification, quantity: item.quantity, unit: item.unit }))} onSubmit={handleMaterialRequestSubmit} isLoading={isSavingMaterial} />
        <VendorWorkRequestModal open={workRequestModalOpen} onOpenChange={setWorkRequestModalOpen} projectId={project.id} phases={phases.map(p => ({ id: p.id, phase_name: p.phase_name }))} onSubmit={handleWorkRequestSubmit} isLoading={isSavingWork} isInternal={isInternalRequest} />
        <UploadSignedDocModal open={!!showUploadSigned} onOpenChange={(open) => !open && setShowUploadSigned(null)} workOrderId={showUploadSigned?.woId || ''} woNumber={showUploadSigned?.woNumber || 0} onSuccess={() => { refetchWorkRequests(); refetch(); }} />
        {selectedWorkRequest && <ConvertToWorkOrderModal open={convertToWOModalOpen} onOpenChange={setConvertToWOModalOpen} request={selectedWorkRequest} onSuccess={() => { refetchWorkRequests(); refetch(); }} />}

        {/* Send for Audit Dialog */}
        <Dialog open={showAuditDialog} onOpenChange={setShowAuditDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSearch className="w-5 h-5 text-amber-400" />
                Send for Audit — WO-{auditWO?.wo_number?.toString().padStart(3, '0')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                <p><strong>Work:</strong> {auditWO?.work_description}</p>
                <p><strong>Amount:</strong> ₹{(auditWO?.estimated_amount || 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Explanation of Work Done <span className="text-red-400">*</span></label>
                <Textarea
                  placeholder="Describe the work completed, progress made, and any notes for the audit team..."
                  value={auditExplanation}
                  onChange={(e) => setAuditExplanation(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Proof of Call / Contact</label>
                <Input
                  placeholder="Phone number or call reference (optional)"
                  value={auditProofOfCall}
                  onChange={(e) => setAuditProofOfCall(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAuditDialog(false)}>Cancel</Button>
              <Button
                className="bg-amber-600 hover:bg-amber-500"
                disabled={!auditExplanation.trim() || isSavingAudit}
                onClick={async () => {
                  if (!auditWO) return;
                  const result = await createAudit({
                    workOrderId: auditWO.id,
                    paymentId: undefined as any,
                    explanation: auditExplanation,
                    proofOfCall: auditProofOfCall || undefined,
                  });
                  if (result.success) {
                    // Update WO payment_stage to audit_pending
                    await (supabase as any)
                      .from('work_orders')
                      .update({ payment_stage: 'audit_pending', updated_at: new Date().toISOString() })
                      .eq('id', auditWO.id);
                    setShowAuditDialog(false);
                    refetchWorkOrders();
                    toast.success('Sent for audit successfully');
                  }
                }}
              >
                {isSavingAudit ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                Submit for Audit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}

// Optimized Card Component - Only renders header initially
function ProjectExecutionCard({ project, index }: { project: any; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const projectAge = project.created_at ? differenceInDays(new Date(), new Date(project.created_at)) : 0;
  const currentStage = LIFECYCLE_STAGES.find(s => s.value === project.lifecycle_stage);
  const stageGradient = stageColors[project.lifecycle_stage] || stageColors.new_deal;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }} // Reduced delay for faster perception
      className="group"
    >
      <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/80 hover:border-primary/30 transition-all duration-300">
        <div className="relative cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className={cn("h-1 w-full bg-gradient-to-r", stageGradient)} />

          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              {/* Left Side: Project Info - No data fetching here */}
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0 bg-gradient-to-br", stageGradient)}>
                  <FolderKanban className="w-7 h-7 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <Badge variant="outline" className="font-mono text-xs bg-primary/10 text-primary border-primary/20">{project.project_id}</Badge>
                    <Badge className={cn("capitalize text-xs", project.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-muted text-muted-foreground')}>{project.status}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-lg font-bold truncate leading-tight group-hover:text-primary transition-colors">
                      {project.project_name}
                    </h3>
                    {project.project_type === 'jv' && <JVProjectBadge size="sm" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {project.client_name}</span>
                    {project.location_city && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {project.location_city}</span>}
                    <span className="flex items-center gap-1.5 font-bold text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" /> {projectAge} Days
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Side: Simple Stats - No heavy calculations until expanded */}
              <div className="flex items-center gap-4 shrink-0">
                <Badge variant="outline" className={cn("px-3 py-1.5 text-xs font-medium whitespace-nowrap bg-gradient-to-r text-white border-0", stageGradient)}>
                  {currentStage?.label || project.lifecycle_stage}
                </Badge>
                <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
                  <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
                    <ChevronDown className="w-5 h-5" />
                  </motion.div>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Lazy load details only when expanded */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <ProjectCardDetails project={project} isExpanded={expanded} />
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export function EmployeeProjectsPage({ embedded = false, filters }: { embedded?: boolean; filters?: { project_type?: string } }) {
  const { user } = useAuth();
  const { projects, isLoading } = useProjects();

  const assignedProjects = projects.filter(p => {
    // Apply filters if provided
    if (filters?.project_type && p.project_type !== filters.project_type) return false;

    if (['gmo', 'admin', 'ceo'].includes(user?.role?.toLowerCase() || '')) return true;
    if (user?.role?.toLowerCase() === 'smo' && user?.department?.toLowerCase() === 'engineering') return true;
    return (
      p.assigned_engineer_id === user?.id ||
      p.assigned_project_engineer_id === user?.id ||
      p.assigned_site_manager_id === user?.id ||
      p.assigned_manager_id === user?.id
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header - Hidden if embedded */}
      {!embedded && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 p-6">
          <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <FolderKanban className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">My Assigned Projects</h1>
              <p className="text-white/70 text-sm">Track and manage your project execution</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <Badge variant="secondary" className="bg-white/20 text-white border-0 backdrop-blur-sm px-3 py-1.5">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {assignedProjects.length} Projects
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Projects List */}
      <div className="space-y-4">
        {assignedProjects.map((project, index) => (
          <ProjectExecutionCard key={project.id} project={project} index={index} />
        ))}

        {assignedProjects.length === 0 && (
          <Card className="text-center py-16 border-dashed bg-muted/20">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <FolderKanban className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-semibold">No Projects Assigned</p>
            <p className="text-sm text-muted-foreground mt-1">You don't have any assigned projects yet</p>
          </Card>
        )}
      </div>
    </motion.div>
  );
}
