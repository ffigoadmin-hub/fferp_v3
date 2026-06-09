import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useSearchParams } from 'react-router-dom';

import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  Plus,
  Clock,
  CheckCircle2,
  Phone,
  User,
  UserCheck,
  FileCheck,
  Leaf,
  Building2,
  Loader2,
  ArrowRight,
  Timer,
  AlertCircle,
  Upload,
  X,
  ImageIcon,
  Tractor,
  RefreshCcw,
  ClipboardList,

  Mic
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DepartmentBadge } from '@/components/DepartmentBadge';
import { useEscalationEngine } from '@/hooks/useEscalationEngine';
import { UnifiedTicket } from '@/hooks/useRealtimeEscalations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  getTimeRemaining,
  formatTimeRemaining,
  getAckSLAStatus,
  getResolveSLAStatus,
  WorkflowDepartment,
  ClientEscalation,
  ESCALATION_BUCKETS,
  EscalationBucket
} from '@/types/workflows';
import { EscalationWizard } from '@/components/nsm/EscalationWizard';
import { TicketDetailsModal } from '@/components/TicketDetailsModal';

import { format, differenceInDays } from 'date-fns';

// Escalation schema handled in Wizard component

// Project creation schema


// Project type for dropdown
interface Project {
  id: string;
  project_name: string;
  client_name: string;
  client_contact: string;
  location_city: string;
  location_state: string;
  onboarded_date: string | null;
  project_type: string | null;
  project_vertical: string | null;
  department: string | null;
}

function SLATimer({
  deadline,
  type = 'resolve',
  status,
  createdAt,
  resolvedAt
}: {
  deadline: string;
  type?: 'ack' | 'resolve';
  status?: string;
  createdAt?: string;
  resolvedAt?: string;
}) {
  const [remaining, setRemaining] = useState(getTimeRemaining(deadline));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(getTimeRemaining(deadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (status === 'resolved' || status === 'pending_closure_approval' || status === 'proof_submitted') {
    if (createdAt && (resolvedAt || deadline)) {
      const start = new Date(createdAt).getTime();
      const end = new Date(resolvedAt || Date.now()).getTime();
      const elapsed = end - start;
      const totalMins = Math.floor(elapsed / 60000);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;

      return (
        <div className="flex items-center gap-2 font-mono text-green-500">
          <CheckCircle2 className="w-4 h-4" />
          <span>TAKEN: {h > 0 ? `${h}h ${m}m` : `${m}m`}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 font-mono text-green-400">
        <CheckCircle2 className="w-4 h-4" />
        <span>PROOF SUBMITTED</span>
      </div>
    );
  }

  const slaStatus = type === 'ack'
    ? getAckSLAStatus(deadline)
    : getResolveSLAStatus(deadline);

  const statusColors = {
    ok: 'text-green-500',
    warning: 'text-yellow-500',
    critical: 'text-orange-500 animate-pulse',
    breached: 'text-destructive animate-pulse',
  };

  return (
    <div className={`flex items-center gap-2 font-mono ${statusColors[slaStatus]}`}>
      <Timer className="w-4 h-4" />
      <span>{remaining > 0 ? formatTimeRemaining(remaining) : 'BREACHED'}</span>
    </div>
  );
}

function EscalationCard({ escalation, onClick }: { escalation: ClientEscalation, onClick?: () => void }) {
  const getStatusBadge = () => {
    switch (escalation.status) {
      case 'open':
        return <Badge variant="destructive" className="animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.3)]">Open</Badge>;
      case 'acknowledged':
        return <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">Acknowledged</Badge>;
      case 'pending_closure_approval':
        return <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 border-amber-500/30">Pending Audit</Badge>;
      case 'escalated_gm':
        return <Badge className="bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]">GM Desk</Badge>;
      case 'escalated_ceo':
        return <Badge className="bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.3)]">Escalated</Badge>;
      case 'resolved':
      case 'closed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Resolved</Badge>;
      case 'in_progress':
      case 'grace_period':
        return <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">In Progress</Badge>;
      case 'proof_submitted':
      case 'waiting_audit':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Proof Submitted</Badge>;
      default:
        return <Badge>{escalation.status}</Badge>;
    }
  };

  const bucketLabel = (ESCALATION_BUCKETS || []).find(b => b.value === escalation.bucket)?.label || escalation.department;
  const isActive = !['resolved', 'closed'].includes(escalation.status);

  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer hover:shadow-lg transition-all border-white/5 bg-[#111114] hover:bg-[#16161a] group",
        (escalation.ack_late || escalation.gm_ack_late) ? 'border-destructive/50' : ''
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <span className="text-sm font-mono text-muted-foreground">#{escalation.ticket_number}</span>
              <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter">
                {format(new Date(escalation.created_at), 'dd MMM • HH:mm')}
              </span>
            </div>
            {getStatusBadge()}
            {escalation.urgency && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-500 uppercase text-[10px]">
                {escalation.urgency}
              </Badge>
            )}
            {escalation.ack_late && (
              <Badge variant="destructive" className="text-xs">Late ACK</Badge>
            )}
            {(escalation.escalation_proof_url || escalation.call_record_url || (escalation.proof_screenshot_urls && escalation.proof_screenshot_urls.length > 0)) && (
              <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary text-[9px] font-black uppercase tracking-widest">
                <ImageIcon className="w-2.5 h-2.5 mr-1" /> Evidence
              </Badge>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge variant="outline" className="bg-blue-500/5 text-blue-400 border-blue-500/20 font-bold tracking-wider text-[10px] uppercase">
              {bucketLabel}
            </Badge>
            {escalation.project?.project_name && (
              <div className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {escalation.project.project_name}
              </div>
            )}
          </div>
        </div>

        <h3 className="font-semibold mb-1">{escalation.issue_title}</h3>
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{escalation.issue_description}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/30">
            <User className="w-4 h-4 text-primary/60" />
            <span className="font-medium text-foreground/80">{escalation.client_name}</span>
          </div>
          {escalation.client_phone && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/30">
              <Phone className="w-4 h-4 text-emerald-500/60" />
              <span>{escalation.client_phone}</span>
            </div>
          )}
          {escalation.raw?.project?.location_city && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/30">
              <Building2 className="w-4 h-4 text-blue-500/60" />
              <span>{escalation.raw.project.location_city}</span>
            </div>
          )}
        </div>

        {(escalation.assigned_to || escalation.assigned_user_id || escalation.assigned_role) && (
          <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
            <UserCheck className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
              Assigned: {escalation.assigned_user?.name || escalation.assigned_user_names?.[0] || 'Responsible Party'}
              {escalation.assigned_user?.department ? ` | ${escalation.assigned_user.department}` : ''}
              {(!escalation.assigned_role || escalation.assigned_role.toLowerCase() === 'employee') ? '' : ` (${escalation.assigned_role})`}
            </span>
          </div>
        )}

        {isActive && (
          <div className="pt-3 border-t">
            {escalation.status === 'open' && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">ACK Deadline:</span>
                <SLATimer
                  deadline={escalation.ack_deadline}
                  type="ack"
                  status={escalation.status}
                  createdAt={escalation.created_at}
                  resolvedAt={escalation.acknowledged_at || undefined}
                />
              </div>
            )}
            {escalation.acknowledged_at && escalation.status !== 'resolved' && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Resolve Deadline:</span>
                <SLATimer
                  deadline={escalation.resolve_deadline}
                  type="resolve"
                  status={escalation.status}
                  createdAt={escalation.created_at}
                  resolvedAt={escalation.resolved_at || escalation.proof_submitted_at || undefined}
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t flex items-center justify-between text-[10px] text-muted-foreground/80">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
              {escalation.creator?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex flex-col">
              <span className="leading-tight">
                Created by <span className="text-foreground font-semibold">{escalation.creator?.name || 'Unknown'}</span>
              </span>
              <span className="text-[9px] text-muted-foreground/60 font-medium uppercase tracking-tight">
                {escalation.creator?.role || 'User'} {escalation.creator?.department ? `• ${escalation.creator.department}` : ''}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-medium">{format(new Date(escalation.created_at), 'dd MMM, HH:mm')}</span>
            <span className="text-[8px] uppercase tracking-tighter opacity-50">Timestamp</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NSMDashboardPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<UnifiedTicket | null>(null);

  // Handle ?create=true from URL
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setIsDialogOpen(true);
    }
  }, [searchParams]);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');

  // Project Intelligence state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Project Creation state


  const {
    tickets: allTickets,
    isLoading,
    isSaving,
    createEscalation,
    acknowledge,
    resolve,
    addComment,
    escalateToGM,
    escalateToCEO,
    verifyAndClose,
    rejectProof,
    deleteTicket
  } = useEscalationEngine({
    userId: user?.id,
    role: user?.role
  });

  // Date filtering helper
  const filterByDate = (items: typeof allTickets) => {
    if (dateFilter === 'all') return items;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    return items.filter(item => {
      const createdAt = new Date(item.created_at);
      switch (dateFilter) {
        case 'today':
          return createdAt >= today;
        case 'yesterday':
          return createdAt >= yesterday && createdAt < today;
        case 'week':
          return createdAt >= weekAgo;
        case 'month':
          return createdAt >= monthAgo;
        default:
          return true;
      }
    });
  };

  // Ownership filter: only see what you created, unless you are an admin or manager
  const escalations = useMemo(() => {
    const userRoleLower = user?.role?.toLowerCase();
    const isManagement = ['admin', 'ceo', 'nsm', 'hr', 'gm', 'gmo', 'smo', 'auditor', 'rsh', 'regional head'].includes(userRoleLower || '');
    
    const filtered = allTickets.filter(t =>
      (t.type === 'escalation' || t.type === 'site_visit') &&
      (t.created_by === user?.id || isManagement)
    );
    return filterByDate(filtered);
  }, [allTickets, user?.id, user?.role, dateFilter]);

  // 5-stage escalation lifecycle classification (Assigned merged into Open)
  const openEscalations = useMemo(() => 
    escalations.filter(e => e.status === 'open' && !e.assigned_user && !e.assigned_role), 
  [escalations]);
  
  const inProgressEscalations = useMemo(() => 
    escalations.filter(e => 
      e.status === 'acknowledged' || 
      e.status === 'in_progress' || 
      e.status === 'grace_period' ||
      (e.status === 'open' && (e.assigned_user || e.assigned_role))
    ), 
  [escalations]);
  
  const escalatedList = useMemo(() => 
    escalations.filter(e => e.status === 'escalated_gm' || e.status === 'escalated_ceo'), 
  [escalations]);
  
  const proofSubmittedEscalations = useMemo(() => 
    escalations.filter(e => 
      e.status === 'resolved' || 
      e.status === 'pending_closure_approval' || 
      e.status === 'proof_submitted' || 
      e.status === 'waiting_audit'
    ), 
  [escalations]);
  
  const closedEscalations = useMemo(() => 
    escalations.filter(e => e.status === 'closed'), 
  [escalations]);





  // Fetch projects function (reusable)
  const fetchProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, client_name, client_contact, location_city, location_state, onboarded_date, project_type, project_vertical, department')
        .order('project_name')
        .limit(100);
      if (error) throw error;
      setProjects((data || []) as unknown as Project[]);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // Create project handler


  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Handle project selection
  const handleProjectSelect = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    setSelectedProject(project || null);
  };

  // Calculate project age
  const getProjectAge = (onboardedDate: string | null): string => {
    if (!onboardedDate) return 'N/A';
    try {
      const onboardDate = new Date(onboardedDate);
      const today = new Date();
      // Reset time to midnight for accurate day calculation
      onboardDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const days = Math.floor((today.getTime() - onboardDate.getTime()) / (1000 * 60 * 60 * 24));
      if (days < 0) return 'Future';
      if (days === 0) return 'Today';
      if (days < 30) return `${days} days`;
      const months = Math.floor(days / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    } catch {
      return 'N/A';
    }
  };



  // Wizard handles upload logic internally now


  const handleWizardSubmit = async (data: any) => {
    const result = await createEscalation({
      department: data.department,
      client_name: data.client_name || 'N/A', // Shield against nulls
      client_phone: data.client_phone,
      issue_title: data.issue_title,
      issue_description: data.issue_description,
      priority: data.priority,
      evidence_url: data.evidence_url,
      project_id: data.project_id,
      escalation_proof_url: data.evidence_url,

      bucket: data.bucket,
    });

    return result;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Filter counts for local display
  const myOpenCount = openEscalations.length;
  const myInProgressCount = inProgressEscalations.length;
  const myEscalatedCount = escalatedList.length;
  const myProofSubmittedCount = proofSubmittedEscalations.length;
  const myClosedCount = closedEscalations.length;
  const activeCount = myOpenCount + myInProgressCount + myEscalatedCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-1">
              Intelligence Hub & Escalations
            </h1>
            <p className="text-muted-foreground">
              {['nsm', 'hr'].includes(user?.role?.toLowerCase() || '') ? 'Client Escalation Management' : 'Raise and track client issues'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/dashboard/my-escalations">
              <AlertTriangle className="w-4 h-4" />
              My Escalations
            </Link>
          </Button>

          {user?.role?.toLowerCase() !== 'auditor' && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Raise Escalation
                </Button>
              </DialogTrigger>
              <EscalationWizard
                onClose={() => setIsDialogOpen(false)}
                onSubmit={handleWizardSubmit}
                isSaving={isSaving}
                projects={projects}
                initialProjectId={selectedProject?.id}
              />
            </Dialog>
          )}
        </div>
      </div>

      {/* Date Filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground mr-2">Filter by:</span>
        {[
          { value: 'all', label: 'All Time' },
          { value: 'today', label: 'Today' },
          { value: 'yesterday', label: 'Yesterday' },
          { value: 'week', label: 'This Week' },
          { value: 'month', label: 'This Month' },
        ].map(({ value, label }) => (
          <Button
            key={value}
            variant={dateFilter === value ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setDateFilter(value as typeof dateFilter)}
          >
            {label}
          </Button>
        ))}
        {dateFilter !== 'all' && (
          <Badge variant="secondary" className="ml-2 text-xs">
            {escalations.length} escalations
          </Badge>
        )}
      </div>

      {/* Stats Cards - 5 Lifecycle Stages */}
      <div className="grid grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{myOpenCount}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Clock className="w-4 h-4 text-cyan-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{myInProgressCount}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <AlertCircle className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{myEscalatedCount}</p>
                <p className="text-xs text-muted-foreground">Escalated</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <FileCheck className="w-4 h-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{myProofSubmittedCount}</p>
                <p className="text-xs text-muted-foreground">Submitted</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{myClosedCount}</p>
                <p className="text-xs text-muted-foreground">Closed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different states */}
      <Tabs defaultValue="open">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="open" className="relative">
            Open
            {openEscalations.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-destructive text-destructive-foreground">
                {openEscalations.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="in_progress">In Progress ({inProgressEscalations.length})</TabsTrigger>
          <TabsTrigger value="escalated">Escalated ({escalatedList.length})</TabsTrigger>
          <TabsTrigger value="proof_submitted" className="relative">
            <FileCheck className="w-3.5 h-3.5 mr-1" />
            Proof Submitted
            {proofSubmittedEscalations.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-500">
                {proofSubmittedEscalations.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="closed">Closed ({closedEscalations.length})</TabsTrigger>

        </TabsList>

        <TabsContent value="open" className="mt-4">
          {openEscalations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-medium">No open escalations</p>
                <p className="text-muted-foreground">All client issues have been acknowledged or assigned</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {openEscalations.slice(0, 50).map((esc) => (
                <EscalationCard key={esc.id} escalation={esc.raw} onClick={() => setSelectedTicket(esc)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="in_progress" className="mt-4">
          {inProgressEscalations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No escalations currently in progress
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {inProgressEscalations.slice(0, 50).map((esc) => (
                <EscalationCard key={esc.id} escalation={esc.raw} onClick={() => setSelectedTicket(esc)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="escalated" className="mt-4">
          {escalatedList.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No escalations pending with GM/CEO
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {escalatedList.filter(e => e.status === 'escalated_gm').length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Badge className="bg-orange-500">GM DESK</Badge>
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {escalatedList.filter(e => e.status === 'escalated_gm').slice(0, 50).map((esc) => (
                      <EscalationCard key={esc.id} escalation={esc.raw} onClick={() => setSelectedTicket(esc)} />
                    ))}
                  </div>
                </div>
              )}
              {escalatedList.filter(e => e.status === 'escalated_ceo').length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Badge className="bg-red-500">PRIORITY REVIEW</Badge>
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {escalatedList.filter(e => e.status === 'escalated_ceo').slice(0, 50).map((esc) => (
                      <EscalationCard key={esc.id} escalation={esc.raw} onClick={() => setSelectedTicket(esc)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="proof_submitted" className="mt-4">
          {proofSubmittedEscalations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileCheck className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                <p className="text-lg font-medium">No proof submissions</p>
                <p className="text-muted-foreground">No escalations have proof pending review</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {proofSubmittedEscalations.slice(0, 50).map((esc) => (
                <EscalationCard key={esc.id} escalation={esc.raw} onClick={() => setSelectedTicket(esc)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="closed" className="mt-4">
          {closedEscalations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No closed escalations yet
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {closedEscalations.slice(0, 50).map((esc) => (
                <EscalationCard key={esc.id} escalation={esc.raw} onClick={() => setSelectedTicket(esc)} />
              ))}
            </div>
          )}
        </TabsContent>


      </Tabs>

      {/* Intelligence Hub Modal */}
      {selectedTicket && (
        <TicketDetailsModal
          open={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          ticket={selectedTicket}
          ticketType={selectedTicket.type}
          timeline={[]}
          timelineLoading={false}
          role={user?.role || 'user'}
          onAcknowledge={() => acknowledge(selectedTicket.id, selectedTicket.type)}
          onAddComment={(comment, audioUrl) => addComment(selectedTicket.id, selectedTicket.type, comment, audioUrl)}
          onVerifyAndClose={() => verifyAndClose(selectedTicket.id, selectedTicket.type)}
          onRejectProof={(reason) => rejectProof(selectedTicket.id, selectedTicket.type, reason)}
          onDelete={() => deleteTicket(selectedTicket.id, selectedTicket.type)}
          isSaving={isSaving}
        />
      )
      }
    </motion.div >
  );
}
