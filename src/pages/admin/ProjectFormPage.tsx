import { useState, useEffect } from 'react';
import { FolderKanban, ArrowLeft, Loader2, Database, ExternalLink, Eye, X, AlertTriangle, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PROJECT_CATEGORIES } from '@/constants/projectCategories';
import { addDays, format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { ProjectFinancials } from '@/components/projects/ProjectFinancials';

const projectStatuses = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'active', label: 'Active' },
  { value: 'hold', label: 'On Hold' },
  { value: 'engineering_complete', label: 'Engineering Complete' },
  { value: 'forwarded_to_agri', label: 'Forwarded to Agri Team' },
  { value: 'agri_in_progress', label: 'Agri In Progress' },
  { value: 'closed', label: 'Closed' },
];

export function ProjectFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const isEditing = !!projectId;
  const queryClient = useQueryClient();
  const userRoleLower = user?.role?.toLowerCase() || '';
  const isBDData = userRoleLower === 'bd_data' || userRoleLower === 'business development' || userRoleLower.includes('bd') || user?.department?.toLowerCase()?.includes('business development');

  // Form state
  const [projectIdInput, setProjectIdInput] = useState('');
  const [projectName, setProjectName] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [domain, setDomain] = useState('Civil'); // Default to Civil or Agri
  const [category, setCategory] = useState('');
  const [verticalId, setVerticalId] = useState('');
  const [totalProjectValue, setTotalProjectValue] = useState('');

  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [assignedManagerId, setAssignedManagerId] = useState('');
  const [assignedEngineerId, setAssignedEngineerId] = useState('');
  const [handOverDate, setHandOverDate] = useState('');
  const [targetCompletionDate, setTargetCompletionDate] = useState('');
  const [defaultDuration, setDefaultDuration] = useState<number | null>(null);
  const [showDurationWarning, setShowDurationWarning] = useState(false);
  const [jvCommitments, setJvCommitments] = useState('');
  const [workOrderCountMin, setWorkOrderCountMin] = useState('');
  const [workOrderCountMax, setWorkOrderCountMax] = useState('');
  const [status, setStatus] = useState('upcoming');
  const [remarks, setRemarks] = useState('');
  const [driveFolderUrl, setDriveFolderUrl] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('0');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Calculate Project Aging
  const projectAging = handOverDate ? Math.floor((new Date().getTime() - new Date(handOverDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  // Auto-generate Project ID: PRJ-001, PRJ-002, etc.
  const { data: nextProjectNumber } = useQuery({
    queryKey: ['next-project-number'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('project_id')
        .like('project_id', 'PRJ-___');

      if (error) throw error;

      let maxNumber = 0;
      (data || []).forEach(p => {
        const match = p.project_id?.match(/^PRJ-(\d{3})$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) maxNumber = num;
        }
      });

      return maxNumber + 1;
    },
    enabled: !isEditing,
  });

  // Set auto-generated project ID when creating new project
  useEffect(() => {
    if (!isEditing && nextProjectNumber && !projectIdInput) {
      const paddedNumber = String(nextProjectNumber).padStart(3, '0');
      setProjectIdInput(`PRJ-${paddedNumber}`);
    }

    if (!isEditing && !handOverDate) {
      const today = format(new Date(), 'yyyy-MM-dd');
      setHandOverDate(today);
    }
  }, [nextProjectNumber, isEditing, projectIdInput, handOverDate]);

  const { data: verticals, isLoading: verticalsLoading } = useQuery({
    queryKey: ['project-verticals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_verticals')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data;
    },
  });

  const filteredVerticals = verticals?.filter(v => {
    if (category === 'AMC' || category === 'BUY_BACK') {
      return v.category === 'DIRECT';
    }
    return v.category === category;
  }) || [];

  const selectedVertical = verticals?.find(v => v.id === verticalId);

  const { data: existingProject, refetch: refetchProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('*, project_verticals(*)')
        .eq('id', projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if ((selectedVertical as any)?.default_duration_days) {
      setDefaultDuration((selectedVertical as any).default_duration_days);
      const isHandOverChanged = isEditing && existingProject && handOverDate !== existingProject.target_start_date;
      const isVerticalChanged = isEditing && existingProject && verticalId !== existingProject.vertical_id;

      if (handOverDate && (!isEditing || isHandOverChanged || isVerticalChanged)) {
        const startDate = new Date(handOverDate);
        const standardDuration = (selectedVertical as any).default_duration_days || 0;
        const autoCompletionDate = addDays(startDate, standardDuration + 10);
        setTargetCompletionDate(format(autoCompletionDate, 'yyyy-MM-dd'));
      }
    } else {
      setDefaultDuration(null);
    }
  }, [selectedVertical, handOverDate, isEditing, existingProject, verticalId]);

  useEffect(() => {
    if (defaultDuration && handOverDate && targetCompletionDate) {
      const start = new Date(handOverDate);
      const end = new Date(targetCompletionDate);
      const days = differenceInDays(end, start);
      setShowDurationWarning(days > defaultDuration);
    } else {
      setShowDurationWarning(false);
    }
  }, [defaultDuration, handOverDate, targetCompletionDate]);

  const { data: smos } = useQuery({
    queryKey: ['smos-for-project'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, department, role')
        .ilike('role', 'smo')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: employees } = useQuery({
    queryKey: ['employees-for-project'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, department, role')
        .ilike('role', 'employee')
        .or('department.ilike.%engineering%,department.ilike.%agri%')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existingProject) {
      setProjectIdInput(existingProject.project_id);
      setProjectName(existingProject.project_name);
      setLocationCity(existingProject.location_city);
      setLocationState(existingProject.location_state);
      setCategory(existingProject.project_category || '');
      setVerticalId(existingProject.vertical_id || '');
      setTotalProjectValue(existingProject.total_project_value?.toString() || '');

      const dbVertical = existingProject.vertical;
      if (dbVertical === 'Agri' || dbVertical === 'Civil') {
        setDomain(dbVertical);
      } else {
        setDomain('Civil');
      }

      setClientName(existingProject.client_name);
      setClientContact(existingProject.client_contact);
      setAssignedManagerId(existingProject.assigned_manager_id || '');
      setAssignedEngineerId(existingProject.assigned_engineer_id || '');
      setHandOverDate(existingProject.target_start_date);
      setTargetCompletionDate(existingProject.target_completion_date || existingProject.target_start_date);
      setWorkOrderCountMin(existingProject.work_order_count_min?.toString() || '');
      setWorkOrderCountMax(existingProject.work_order_count_max?.toString() || '');
      setStatus(existingProject.status || 'upcoming');
      setRemarks(existingProject.remarks || '');
      setJvCommitments((existingProject as any).jv_commitments || '');
      setDriveFolderUrl(existingProject.deal_file_url || '');
      setDiscountPercentage((existingProject as any).discount_percentage?.toString() || '0');
    }
  }, [existingProject]);

  useEffect(() => {
    if (category && !isEditing) {
      setVerticalId('');
    }
  }, [category, isEditing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const projectData: any = {
        project_id: projectIdInput,
        project_name: projectName,
        location_city: locationCity,
        location_state: locationState,
        vertical: domain,
        project_type: selectedVertical?.name || '',
        vertical_id: verticalId || null,
        project_category: category || null,
        total_project_value: Number(totalProjectValue) || 0,
        client_name: clientName,
        client_contact: clientContact,
        assigned_manager_id: assignedManagerId && assignedManagerId !== 'none' ? assignedManagerId : null,
        assigned_engineer_id: assignedEngineerId || null,
        target_start_date: handOverDate,
        target_completion_date: targetCompletionDate,
        work_order_count_min: workOrderCountMin ? parseInt(workOrderCountMin) : null,
        work_order_count_max: workOrderCountMax ? parseInt(workOrderCountMax) : null,
        status,
        remarks: remarks || null,
        jv_commitments: jvCommitments || null,
        deal_file_url: driveFolderUrl || null,
        discount_percentage: Number(discountPercentage) || 0,
        updated_at: new Date().toISOString(),
      };

      if (isEditing) {
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', projectId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('projects')
          .insert({
            ...projectData,
            created_by: user?.id,
          });
        if (error) {
          if (error.message.includes('duplicate')) {
            throw new Error('Project ID or name already exists');
          }
          throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success(`Project ${isEditing ? 'updated' : 'created'} successfully`);
      if (!isEditing) {
        navigate('/projects');
      } else {
        refetchProject();
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save project');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectIdInput.trim()) return toast.error('Project ID is required');
    if (!projectName.trim()) return toast.error('Project Name is required');
    if (!locationCity.trim() || !locationState) return toast.error('Location is required');
    if (!domain) return toast.error('Vertical (Agri/Civil) is required');
    if (!category) return toast.error('Category is required');
    if (!verticalId) return toast.error('Project Type is required');
    if (!clientName.trim()) return toast.error('Client Name is required');
    if (!clientContact.trim()) return toast.error('Client Contact is required');
    if (!handOverDate) return toast.error('Hand Over Date is required');
    saveMutation.mutate();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <FolderKanban className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{isEditing ? 'Edit Project' : 'Create New Project'}</h1>
            <p className="text-muted-foreground">Comprehensive system governance for {projectName || 'new project'}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 pb-20">
        <div className="authority-card space-y-6 bg-card/40 backdrop-blur-xl border-border/50 shadow-2xl">
          {/* Identity & Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/10">
                <Database className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm uppercase tracking-wider opacity-70">Project Identity</h3>
              </div>
              <div className="space-y-2">
                <Label>Project ID (Internal)</Label>
                <Input value={projectIdInput} disabled className="bg-muted/50 font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Project Name *</Label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Official project title"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/10">
                <ExternalLink className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm uppercase tracking-wider opacity-70">Location Details</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>City *</Label>
                  <Input value={locationCity} onChange={(e) => setLocationCity(e.target.value)} placeholder="City" />
                </div>
                <div className="space-y-2">
                  <Label>State *</Label>
                  <Input value={locationState} onChange={(e) => setLocationState(e.target.value)} placeholder="State" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Google Drive Archive</Label>
                <Input
                  value={driveFolderUrl}
                  onChange={(e) => setDriveFolderUrl(e.target.value)}
                  placeholder="URL to drawings/docs"
                />
              </div>
            </div>
          </div>

          {/* Classification & Financials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-primary/5 rounded-2xl border border-primary/10">
            <div className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                <FolderKanban className="w-4 h-4" /> System Classification
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Select value={domain} onValueChange={setDomain}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Civil">Civil</SelectItem>
                      <SelectItem value="Agri">Agri</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Sub-Vertical / Type</Label>
                <Select value={verticalId} onValueChange={setVerticalId} disabled={!category}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredVerticals.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-500">
                <Wallet className="w-4 h-4" /> Financial Integrity
              </h3>
              <div className="space-y-2">
                <Label className="text-emerald-600/70">Base Contract Value (Lump Sum)</Label>
                <div className="relative group">
                  <span className="absolute left-3 top-3 text-emerald-500 font-bold">₹</span>
                  <Input
                    type="number"
                    value={totalProjectValue}
                    onChange={(e) => setTotalProjectValue(e.target.value)}
                    className="pl-8 text-xl font-mono font-bold bg-emerald-500/5 border-emerald-500/20 focus:border-emerald-500 transition-all text-emerald-700"
                    placeholder="0.00"
                  />
                  <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-md" />
                </div>
                {isEditing && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 italic px-1 pt-1 border-b border-border/5 mb-2 pb-1">
                    <AlertTriangle className="w-3 h-3" /> Base value only. Record changes in the Audit Ledger below.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4 mt-4 bg-background/30 p-3 rounded-lg border border-border/10">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold opacity-60">Discount (%)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={discountPercentage}
                        onChange={(e) => setDiscountPercentage(e.target.value)}
                        className="h-8 bg-background/50 font-mono"
                        placeholder="0"
                      />
                      <span className="absolute right-2 top-1.5 text-xs opacity-40">%</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold opacity-60">Discount Value</Label>
                    <div className="h-8 flex items-center px-1 font-mono text-rose-500 font-bold">
                      ₹{((Number(totalProjectValue) || 0) * (Number(discountPercentage) || 0) / 100).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="mt-2 px-1 flex justify-between items-center bg-primary/5 p-2 rounded border border-primary/10">
                  <span className="text-[11px] font-bold uppercase opacity-70">Net Base Value:</span>
                  <span className="font-mono font-black text-primary">
                    ₹{((Number(totalProjectValue) || 0) - ((Number(totalProjectValue) || 0) * (Number(discountPercentage) || 0) / 100)).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Lifecycle Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projectStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Timeline & Client */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-bold opacity-70">Client Protocol</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Client Name</Label>
                  <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Contact Access</Label>
                  <Input value={clientContact} onChange={(e) => setClientContact(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold opacity-70">Project Timeline</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Handover Date</Label>
                  <Input type="date" value={handOverDate} onChange={(e) => setHandOverDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Target Finish</Label>
                  <Input
                    type="date"
                    value={targetCompletionDate}
                    onChange={(e) => setTargetCompletionDate(e.target.value)}
                    className={cn(showDurationWarning ? "border-rose-500/50 bg-rose-500/5 text-rose-600" : "")}
                  />
                </div>
              </div>
              {defaultDuration && (
                <Badge variant="outline" className={cn(
                  "w-fit font-mono text-[10px]",
                  showDurationWarning ? "border-rose-500/30 text-rose-500 bg-rose-500/5" : "text-emerald-600 bg-emerald-500/5 border-emerald-500/20"
                )}>
                  {showDurationWarning ? '⚠️ ' : '✅ '} Standard Cycle: {defaultDuration}d (+10 buffer)
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-border/10">
            <Label>Remarks & Scope Intelligence</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="High-level project scope or audit notes..."
              className="bg-transparent/20 min-h-[100px]"
            />
          </div>

          <div className="flex justify-end gap-4 pt-6">
            <Link to="/projects">
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
            <Button
              type="submit"
              className="w-[200px] bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditing ? 'Update Records' : 'Initialize Project')}
            </Button>
          </div>
        </div>
      </form>

      {/* Financial Governance Module (Edit Mode) */}
      {isEditing && projectId && (
        <div className="space-y-4 pt-8 border-t-2 border-dashed border-border/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold uppercase text-primary">Financial Governance</h2>
              <p className="text-muted-foreground text-xs">Real-time contract audit and collection tracking</p>
            </div>
            <Badge variant="secondary" className="h-fit text-[10px]">Secure Audit Log Active</Badge>
          </div>

          <ProjectFinancials
            projectId={projectId}
            baseValue={Number(totalProjectValue) || 0}
            discountPercentage={Number(discountPercentage) || 0}
            onUpdate={() => refetchProject()}
          />
        </div>
      )}
    </div>
  );
}
