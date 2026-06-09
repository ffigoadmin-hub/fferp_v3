import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, Package, Hammer, CreditCard, CheckCircle,
  Clock, AlertTriangle, TrendingUp, FileText, Users, BarChart3,
  ShoppingCart, Truck, Wrench, Plus, RefreshCw, MapPin,
  Pencil, Activity, Layers, IndianRupee, Calendar, Target,
  ChevronRight, CircleDot, Box, Wallet, Timer, Flag, Search, Filter
} from 'lucide-react';
import { CreateWorkOrderForm } from '@/components/work-orders/CreateWorkOrderForm';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useProjectExecution } from '@/hooks/useProjectExecution';
import { useAuth } from '@/contexts/AuthContext';
import { LIFECYCLE_STAGES } from '@/constants/projectCategories';
import { format } from 'date-fns';
import { useMilestones } from '@/hooks/useMilestones';
import { toast } from 'sonner';

// Import modals and components
import { PhaseUpdateModal } from '@/components/engineering/PhaseUpdateModal';
import { BOQItemUpdateModal } from '@/components/engineering/BOQItemUpdateModal';
import { AddPhaseModal } from '@/components/engineering/AddPhaseModal';
import { ProjectGanttChart } from '@/components/engineering/ProjectGanttChart';
import { MilestoneManager } from '@/components/engineering/MilestoneManager';

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'pending': return 'secondary';
    case 'admin_approved':
    case 'boi_verified': return 'default';
    case 'ceo_approved':
    case 'paid':
    case 'completed': return 'default';
    case 'rejected': return 'destructive';
    default: return 'outline';
  }
};

const getStatusStyles = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-status-late/20 text-status-late border-status-late/30';
    case 'ordered':
    case 'sourced':
      return 'bg-primary/20 text-primary border-primary/30';
    case 'delivered':
    case 'completed':
      return 'bg-status-live/20 text-status-live border-status-live/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

export default function ProjectExecutionDashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const { summary, details, isLoading, refetch } = useProjectExecution(projectId);
  const { milestones, refetch: refetchMilestones } = useMilestones(projectId || '');
  const [activeTab, setActiveTab] = useState('overview');

  // Modal states
  const [selectedPhase, setSelectedPhase] = useState<any>(null);
  const [phaseModalOpen, setPhaseModalOpen] = useState(false);
  const [selectedBOQItem, setSelectedBOQItem] = useState<any>(null);
  const [boqModalOpen, setBOQModalOpen] = useState(false);
  const [addPhaseModalOpen, setAddPhaseModalOpen] = useState(false);

  // Check if user can edit (Engineering roles)
  const canEdit = true; // Engineering roles can edit - checked via RLS on backend

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground">Loading project data...</p>
        </div>
      </div>
    );
  }

  if (!summary || !details) {
    return (
      <div className="p-8 text-center">
        <div className="authority-card max-w-md mx-auto">
          <AlertTriangle className="h-12 w-12 mx-auto text-status-late mb-4" />
          <p className="text-lg font-semibold">Project not found</p>
          <p className="text-muted-foreground mt-1">The project may not exist or you don't have access</p>
          <Link to="/projects" className="inline-block mt-6">
            <Button>Back to Projects</Button>
          </Link>
        </div>
      </div>
    );
  }

  const currentStage = LIFECYCLE_STAGES.find(s => s.value === summary.lifecycle_stage);
  const stageProgress = ((currentStage?.order || 1) / LIFECYCLE_STAGES.length) * 100;

  const materialProgress = summary.total_boq_items > 0
    ? ((summary.delivered_boq_items / summary.total_boq_items) * 100)
    : 0;

  const phaseProgress = summary.total_phases > 0
    ? ((summary.completed_phases / summary.total_phases) * 100)
    : 0;

  const handlePhaseEdit = (phase: any) => {
    setSelectedPhase(phase);
    setPhaseModalOpen(true);
  };

  const handleBOQEdit = (item: any) => {
    setSelectedBOQItem(item);
    setBOQModalOpen(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto"
    >
      {/* Premium Header */}
      <div className="dashboard-header">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link to={user?.department?.toLowerCase()?.includes('engineering') || user?.role === 'admin' ? "/engineer-dashboard" : "/sourcing-dashboard"}>
              <Button variant="ghost" size="icon" className="shrink-0 hover:bg-primary/10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-lg shrink-0">
                <BarChart3 className="w-7 h-7 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{summary.project_name}</h1>
                  <Badge className="bg-primary/20 text-primary border-primary/30 capitalize">
                    {currentStage?.label || summary.lifecycle_stage}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" />
                    {summary.client_name}
                  </span>
                  {details.project?.location_city && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-primary" />
                      {details.project.location_city}, {details.project.location_state}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-primary" />
                    {format(new Date(details.project?.target_start_date || new Date()), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="shrink-0 border-border/50 hover:bg-primary/10 hover:border-primary/30"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Progress Cards - Premium Design */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="stat-card-primary"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <span className="text-2xl font-bold text-primary">{Math.round(stageProgress)}%</span>
          </div>
          <Progress value={stageProgress} className="h-1.5 mb-2" />
          <p className="text-sm font-medium">Project Stage</p>
          <p className="text-xs text-muted-foreground mt-0.5">{currentStage?.label}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="stat-card-info"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
              <Truck className="w-5 h-5 text-accent" />
            </div>
            <span className="text-2xl font-bold text-accent">{Math.round(materialProgress)}%</span>
          </div>
          <Progress value={materialProgress} className="h-1.5 mb-2" />
          <p className="text-sm font-medium">Material Delivery</p>
          <p className="text-xs text-muted-foreground mt-0.5">{summary.delivered_boq_items}/{summary.total_boq_items} delivered</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="stat-card-success"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-status-live/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-status-live" />
            </div>
            <span className="text-2xl font-bold text-status-live">{Math.round(phaseProgress)}%</span>
          </div>
          <Progress value={phaseProgress} className="h-1.5 mb-2" />
          <p className="text-sm font-medium">Phase Progress</p>
          <p className="text-xs text-muted-foreground mt-0.5">{summary.completed_phases}/{summary.total_phases} completed</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="stat-card-warning"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-status-late/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-status-late" />
            </div>
            <span className="text-2xl font-bold text-status-late">{summary.overall_completion_percentage}%</span>
          </div>
          <Progress value={summary.overall_completion_percentage} className="h-1.5 mb-2" />
          <p className="text-sm font-medium">Overall Completion</p>
          <p className="text-xs text-muted-foreground mt-0.5">{summary.overall_completion_percentage}% complete</p>
        </motion.div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="authority-card group hover:border-primary/30 transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-bold">{summary.total_pos}</p>
              <p className="text-sm text-muted-foreground">Purchase Orders</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="authority-card group hover:border-primary/30 transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-authority-ceo/10 flex items-center justify-center group-hover:bg-authority-ceo/20 transition-colors">
              <Wrench className="w-6 h-6 text-authority-ceo" />
            </div>
            <div>
              <p className="text-3xl font-bold">{summary.total_wos}</p>
              <p className="text-sm text-muted-foreground">Work Orders</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="authority-card group hover:border-status-live/30 transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-status-live/10 flex items-center justify-center group-hover:bg-status-live/20 transition-colors">
              <Wallet className="w-6 h-6 text-status-live" />
            </div>
            <div>
              <p className="text-3xl font-bold">₹{(summary.total_paid / 1000).toFixed(0)}K</p>
              <p className="text-sm text-muted-foreground">Total Paid</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="authority-card group hover:border-status-late/30 transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-status-late/10 flex items-center justify-center group-hover:bg-status-late/20 transition-colors">
              <Timer className="w-6 h-6 text-status-late" />
            </div>
            <div>
              <p className="text-3xl font-bold">₹{(summary.pending_payments / 1000).toFixed(0)}K</p>
              <p className="text-sm text-muted-foreground">Pending Payments</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tabs with Premium Styling */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="premium-tabs inline-flex">
          <TabsList className="bg-transparent gap-1 p-0">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 rounded-lg transition-all"
            >
              <FileText className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="materials"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 rounded-lg transition-all"
            >
              <Box className="w-4 h-4 mr-2" />
              Materials
            </TabsTrigger>
            <TabsTrigger
              value="orders"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 rounded-lg transition-all"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              PO/WO
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 rounded-lg transition-all"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Payments
            </TabsTrigger>
            <TabsTrigger
              value="milestones"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 rounded-lg transition-all"
            >
              <Flag className="w-4 h-4 mr-2" />
              Milestones
            </TabsTrigger>
            <TabsTrigger
              value="timeline"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 rounded-lg transition-all"
            >
              <Activity className="w-4 h-4 mr-2" />
              Timeline
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          {/* BOQ Summary Grid */}
          {(summary?.lifecycle_stage === 'boq_approved' ||
            user?.role === 'admin' ||
            user?.role === 'gmo' ||
            user?.role === 'smo' ||
            user?.department?.toLowerCase().includes('engineering')) ? (
            <div className="authority-card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">BOQ Summary</h3>
                    <p className="text-sm text-muted-foreground">Bill of Quantities overview</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-status-late/10 border border-status-late/20 text-center">
                  <div className="w-10 h-10 mx-auto rounded-full bg-status-late/20 flex items-center justify-center mb-2">
                    <Clock className="w-5 h-5 text-status-late" />
                  </div>
                  <p className="text-3xl font-bold text-status-late">{summary.pending_boq_items}</p>
                  <p className="text-sm text-muted-foreground mt-1">Pending</p>
                </div>
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-center">
                  <div className="w-10 h-10 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-2">
                    <ShoppingCart className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-3xl font-bold text-primary">{summary.ordered_boq_items}</p>
                  <p className="text-sm text-muted-foreground mt-1">Ordered</p>
                </div>
                <div className="p-4 rounded-xl bg-status-live/10 border border-status-live/20 text-center">
                  <div className="w-10 h-10 mx-auto rounded-full bg-status-live/20 flex items-center justify-center mb-2">
                    <CheckCircle className="w-5 h-5 text-status-live" />
                  </div>
                  <p className="text-3xl font-bold text-status-live">{summary.delivered_boq_items}</p>
                  <p className="text-sm text-muted-foreground mt-1">Delivered</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30 border border-border text-center">
                  <div className="w-10 h-10 mx-auto rounded-full bg-muted flex items-center justify-center mb-2">
                    <Box className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-3xl font-bold">{summary.total_boq_items}</p>
                  <p className="text-sm text-muted-foreground mt-1">Total Items</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-border rounded-xl bg-muted/20">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                <Clock className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground">BOQ Approval Pending</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Project BOQ is currently awaiting approval. Details will be visible once finalized.
              </p>
            </div>
          )}

          {/* Phases Progress */}
          <div className="authority-card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-status-live/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-status-live" />
                </div>
                <div>
                  <h3 className="font-semibold">Project Phases</h3>
                  <p className="text-sm text-muted-foreground">{details.phases.length} phases defined</p>
                </div>
              </div>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => setAddPhaseModalOpen(true)} className="border-primary/30 hover:bg-primary/10">
                  <Plus className="w-4 h-4 mr-2" /> Add Phase
                </Button>
              )}
            </div>

            {details.phases.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-xl">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <TrendingUp className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground font-medium">No phases defined yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Add your first phase to track progress</p>
                {canEdit && (
                  <Button variant="outline" className="mt-4" onClick={() => setAddPhaseModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add First Phase
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {details.phases.map((phase: any, index: number) => (
                  <motion.div
                    key={phase.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${phase.status === 'completed'
                      ? 'bg-status-live/5 border-status-live/20'
                      : phase.status === 'in_progress'
                        ? 'bg-primary/5 border-primary/20'
                        : 'bg-muted/20 border-border'
                      } ${canEdit ? 'hover:border-primary/50 cursor-pointer' : ''}`}
                    onClick={() => canEdit && handlePhaseEdit(phase)}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold shrink-0
                      ${phase.status === 'completed'
                        ? 'bg-status-live/20 text-status-live'
                        : phase.status === 'in_progress'
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'}`}>
                      {phase.status === 'completed' ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        phase.phase_order
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">{phase.phase_name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${phase.status === 'completed'
                              ? 'bg-status-live'
                              : phase.status === 'in_progress'
                                ? 'bg-primary'
                                : 'bg-muted-foreground/30'
                              }`}
                            style={{ width: `${phase.completion_percentage || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold w-12 text-right">{phase.completion_percentage || 0}%</span>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 capitalize ${phase.status === 'completed'
                        ? 'border-status-live/30 text-status-live bg-status-live/10'
                        : phase.status === 'in_progress'
                          ? 'border-primary/30 text-primary bg-primary/10'
                          : ''
                        }`}
                    >
                      {phase.status.replace(/_/g, ' ')}
                    </Badge>
                    {canEdit && (
                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="materials" className="space-y-6">
          {summary?.lifecycle_stage === 'boq_approved' ||
            user?.role === 'admin' ||
            user?.role === 'gmo' ||
            user?.role === 'smo' ||
            user?.department?.toLowerCase().includes('engineering') ? (
            <div className="authority-card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">BOQ Items</h3>
                    <p className="text-sm text-muted-foreground">{details.boqItems.length} materials tracked</p>
                  </div>
                </div>
                {canEdit && (
                  <p className="text-sm text-muted-foreground">
                    Click row to update
                  </p>
                )}
              </div>

              {details.boqItems.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-xl">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <Package className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground font-medium">No BOQ items yet</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">BOQ items will appear here once added</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {details.boqItems.map((item: any, index: number) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className={`p-4 rounded-xl border border-border hover:border-primary/30 transition-all ${canEdit ? 'cursor-pointer' : ''
                          }`}
                        onClick={() => canEdit && handleBOQEdit(item)}
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground shrink-0">
                            {item.line_number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-medium">{item.material_name}</p>
                                {item.specification && (
                                  <p className="text-sm text-muted-foreground truncate max-w-[300px]">{item.specification}</p>
                                )}
                              </div>
                              <Badge
                                variant="outline"
                                className={`shrink-0 capitalize ${getStatusStyles(item.status)}`}
                              >
                                {item.status}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
                              <span className="text-muted-foreground">
                                {item.quantity} {item.unit}
                              </span>
                              <Separator orientation="vertical" className="h-4" />
                              <span className="font-medium text-primary">
                                ₹{(item.quantity * (item.estimated_unit_cost || 0)).toLocaleString()}
                              </span>
                              {item.category && (
                                <>
                                  <Separator orientation="vertical" className="h-4" />
                                  <Badge variant="outline" className="text-xs capitalize">{item.category}</Badge>
                                </>
                              )}
                              {item.sourced_via && (
                                <>
                                  <Separator orientation="vertical" className="h-4" />
                                  <span className="text-xs text-muted-foreground uppercase">{item.sourced_via}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {canEdit && <Pencil className="w-4 h-4 text-muted-foreground shrink-0" />}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-muted rounded-xl bg-muted/10">
              <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-muted-foreground">BOQ Pending Approval</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-2">
                The Bill of Quantities for this project involves a multi-stage approval process (Engineer → SMO → GMO).
                Once the GMO grants final approval, the BOQ details will be visible here.
              </p>
              <div className="mt-6 flex items-center gap-2">
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                  Currently: {currentStage?.label || 'In Review'}
                </Badge>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="space-y-6">
          {/* Purchase Orders */}
          <div className="authority-card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Purchase Orders</h3>
                  <p className="text-sm text-muted-foreground">{details.purchaseOrders.length} orders</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Via Material Requests</p>
            </div>

            {details.purchaseOrders.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-xl">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <ShoppingCart className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground font-medium">No purchase orders yet</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead>PO #</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.purchaseOrders.map((po: any) => (
                      <TableRow key={po.id} className="border-border/30">
                        <TableCell className="font-mono text-primary">PO-{String(po.po_number).padStart(3, '0')}</TableCell>
                        <TableCell>{po.vendor_name}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{po.item_description}</TableCell>
                        <TableCell className="font-semibold">₹{Number(po.total_amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(po.status)} className="capitalize">
                            {po.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{format(new Date(po.created_at), 'MMM d')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>

          {/* Work Orders */}
          <div className="authority-card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-authority-ceo/10 flex items-center justify-center">
                  <Hammer className="w-5 h-5 text-authority-ceo" />
                </div>
                <div>
                  <h3 className="font-semibold">Work Orders</h3>
                  <p className="text-sm text-muted-foreground">{details.workOrders.length} orders</p>
                </div>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="default" className="bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" /> New Work Order
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Initiate Budget-Approved Work Order</DialogTitle>
                  </DialogHeader>
                  <CreateWorkOrderForm 
                    initialProjectId={projectId} 
                    onSuccess={() => {
                      refetch();
                      toast.success('Work Order initiated for budget approval');
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {details.workOrders.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-xl">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Hammer className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground font-medium">No work orders yet</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead>WO #</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Negotiated</TableHead>
                      <TableHead>Deviation %</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.workOrders.map((wo: any) => (
                      <TableRow key={wo.id} className="border-border/30">
                        <TableCell className="font-mono text-authority-ceo">WO-{String(wo.wo_number).padStart(3, '0')}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          <div className="flex items-center gap-1">
                            {wo.work_description}
                            {wo.has_budget_deviation && (
                               <AlertTriangle className="w-3 h-3 text-status-late" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-muted-foreground whitespace-nowrap">₹{Number(wo.approved_budget || 0).toLocaleString()}</TableCell>
                        <TableCell className="font-bold whitespace-nowrap">₹{Number(wo.negotiated_amount || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          {wo.budget_deviation_percentage !== null ? (
                            <Badge className={wo.budget_deviation_percentage > 0 ? "bg-status-late/10 text-status-late border-status-late/20" : "bg-status-live/10 text-status-live border-status-live/20"}>
                              {wo.budget_deviation_percentage > 0 ? "+" : ""}{wo.budget_deviation_percentage}%
                            </Badge>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="font-semibold text-status-live whitespace-nowrap">₹{Number(wo.total_paid || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(wo.status)} className="capitalize">
                            {wo.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{format(new Date(wo.created_at), 'MMM d')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <div className="authority-card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-status-live/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-status-live" />
                </div>
                <div>
                  <h3 className="font-semibold">Payments</h3>
                  <p className="text-sm text-muted-foreground">{details.payments.length} payments recorded</p>
                </div>
              </div>
              <Link to="/payment-request">
                <Button size="sm" variant="outline" className="border-primary/30 hover:bg-primary/10">
                  <Plus className="w-4 h-4 mr-2" /> New Payment
                </Button>
              </Link>
            </div>

            {details.payments.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-xl">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <CreditCard className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground font-medium">No payments yet</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {details.payments.map((payment: any, index: number) => (
                    <motion.div
                      key={payment.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="p-4 rounded-xl border border-border hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <IndianRupee className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-primary">PAY-{String(payment.payment_number).padStart(3, '0')}</span>
                              <Badge variant={getStatusBadgeVariant(payment.status)} className="capitalize">
                                {payment.status.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">{payment.purpose}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold">₹{Number(payment.amount).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(payment.created_at), 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                      <Separator className="my-3" />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Vendor: {payment.vendor_name}</span>
                        {payment.requester?.name && (
                          <span className="text-muted-foreground">By: {payment.requester.name}</span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </TabsContent>

        <TabsContent value="milestones" className="space-y-6">
          {/* Gantt Chart */}
          <ProjectGanttChart
            phases={details.phases}
            milestones={milestones}
          />

          {/* Milestone Manager */}
          <MilestoneManager
            projectId={projectId || ''}
            phases={details.phases.map((p: any) => ({ id: p.id, phase_name: p.phase_name }))}
          />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          <div className="authority-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Activity Timeline</h3>
                <p className="text-sm text-muted-foreground">Recent project activity</p>
              </div>
            </div>

            {details.timeline.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-xl">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground font-medium">No activity yet</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-1">
                  {details.timeline.map((event: any, index: number) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex gap-4"
                    >
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-primary shrink-0 ring-4 ring-primary/20" />
                        {index < details.timeline.length - 1 && (
                          <div className="w-0.5 flex-1 bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-8">
                        <div className="p-4 rounded-xl bg-muted/30 border border-border">
                          <p className="font-medium capitalize">{event.action.replace(/_/g, ' ')}</p>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <span>by {event.performed_by_name}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-muted">{event.performed_by_role}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(event.created_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </TabsContent>
      </Tabs >

      {/* Modals */}
      < PhaseUpdateModal
        open={phaseModalOpen}
        onOpenChange={setPhaseModalOpen}
        phase={selectedPhase}
        projectId={projectId || ''
        }
        onSuccess={refetch}
      />

      <BOQItemUpdateModal
        open={boqModalOpen}
        onOpenChange={setBOQModalOpen}
        item={selectedBOQItem}
        onSuccess={refetch}
      />

      <AddPhaseModal
        open={addPhaseModalOpen}
        onOpenChange={setAddPhaseModalOpen}
        projectId={projectId || ''}
        onSuccess={refetch}
      />
    </motion.div >
  );
}
