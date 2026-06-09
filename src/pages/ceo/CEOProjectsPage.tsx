import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FolderKanban, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  DollarSign,
  Calendar,
  Users,
  Package,
  Loader2,
  Eye,
  ArrowRight,
  BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface Project {
  id: string;
  project_id: string;
  project_name: string;
  client_name: string;
  lifecycle_stage: string;
  project_type?: string;
  location?: string;
  approved_budget?: number;
  total_spent?: number;
  start_date?: string;
  target_completion_date?: string;
  actual_completion_date?: string | null;
  status?: string;
  created_at: string;
  updated_at: string;
}

interface ProjectStats {
  total: number;
  active: number;
  onTrack: number;
  delayed: number;
  completed: number;
  totalBudget: number;
  totalSpent: number;
}

export default function CEOProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectStats>({
    total: 0, active: 0, onTrack: 0, delayed: 0, completed: 0, totalBudget: 0, totalSpent: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedTab, setSelectedTab] = useState('active');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const projectsData = data || [];
      setProjects(projectsData);

      // Calculate stats
      const active = projectsData.filter(p => p.lifecycle_stage !== 'completed');
      const completed = projectsData.filter(p => p.lifecycle_stage === 'completed');
      const delayed = active.filter(p => {
        if (!p.target_completion_date) return false;
        return new Date(p.target_completion_date) < new Date();
      });
      const onTrack = active.length - delayed.length;
      const totalBudget = projectsData.reduce((acc, p) => acc + (p.approved_budget || 0), 0);
      // total_spent doesn't exist on projects - would need to calculate from payment_requests
      const totalSpent = 0; // TODO: Calculate from approved payments if needed

      setStats({
        total: projectsData.length,
        active: active.length,
        onTrack,
        delayed: delayed.length,
        completed: completed.length,
        totalBudget,
        totalSpent,
      });
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getProjectStatus = (project: Project) => {
    if (project.lifecycle_stage === 'completed') return 'completed';
    if (!project.target_completion_date) return 'on-track';
    const isDelayed = new Date(project.target_completion_date) < new Date();
    return isDelayed ? 'delayed' : 'on-track';
  };

  const getStatusBadge = (project: Project) => {
    const status = getProjectStatus(project);
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'delayed':
        return <Badge variant="destructive">Delayed</Badge>;
      default:
        return <Badge className="bg-blue-500">On Track</Badge>;
    }
  };

  const getLifecycleBadge = (stage: string) => {
    const colors: Record<string, string> = {
      'new_deal': 'bg-purple-500',
      'boq_draft': 'bg-yellow-500',
      'boq_approved': 'bg-blue-500',
      'in_progress': 'bg-indigo-500',
      'execution': 'bg-orange-500',
      'completed': 'bg-green-500',
    };
    return (
      <Badge className={colors[stage] || 'bg-gray-500'}>
        {stage?.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    );
  };

  const getBudgetProgress = (estimated: number | undefined, spent: number | undefined) => {
    if (!estimated) return 0;
    return Math.min(((spent || 0) / estimated) * 100, 100);
  };

  const filteredProjects = projects.filter(p => {
    if (selectedTab === 'active') return p.lifecycle_stage !== 'completed';
    if (selectedTab === 'delayed') {
      if (p.lifecycle_stage === 'completed') return false;
      if (!p.target_completion_date) return false;
      return new Date(p.target_completion_date) < new Date();
    }
    if (selectedTab === 'completed') return p.lifecycle_stage === 'completed';
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
          <TrendingUp className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-1">Project Intelligence</h1>
          <p className="text-muted-foreground">Real-time project overview and insights</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FolderKanban className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.onTrack}</p>
                <p className="text-xs text-muted-foreground">On Track</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{stats.delayed}</p>
                <p className="text-xs text-muted-foreground">Delayed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-amber-500" />
              <div>
                <p className="text-lg font-bold">₹{(stats.totalBudget / 100000).toFixed(1)}L</p>
                <p className="text-xs text-muted-foreground">Budget</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-lg font-bold">₹{(stats.totalSpent / 100000).toFixed(1)}L</p>
                <p className="text-xs text-muted-foreground">Spent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Projects Overview</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
              <TabsTrigger value="delayed" className="text-destructive">
                Delayed ({stats.delayed})
              </TabsTrigger>
              <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
              <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {filteredProjects.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No projects in this category
                  </div>
                ) : (
                  filteredProjects.map((project) => (
                    <div 
                      key={project.id}
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedProject(project)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm text-muted-foreground">
                              {project.project_id}
                            </span>
                            {getStatusBadge(project)}
                            {getLifecycleBadge(project.lifecycle_stage)}
                          </div>
                          <h4 className="font-semibold">{project.project_name}</h4>
                          <p className="text-sm text-muted-foreground">{project.client_name}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="gap-1">
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Location</p>
                          <p className="font-medium">{project.location || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Type</p>
                          <p className="font-medium">{project.project_type || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Expected</p>
                          <p className="font-medium">
                            {project.target_completion_date 
                              ? format(new Date(project.target_completion_date), 'dd MMM yyyy')
                              : 'TBD'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Budget Utilization</p>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={getBudgetProgress(project.approved_budget, project.total_spent)} 
                              className="h-2 flex-1"
                            />
                            <span className="text-xs font-medium">
                              {getBudgetProgress(project.approved_budget, project.total_spent).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>

      {/* Project Detail Dialog */}
      <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-primary" />
              {selectedProject?.project_name}
            </DialogTitle>
          </DialogHeader>

          {selectedProject && (
            <div className="space-y-6">
              {/* Project Info */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">Project ID</p>
                  <p className="font-mono font-medium">{selectedProject.project_id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="font-medium">{selectedProject.client_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  {getStatusBadge(selectedProject)}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stage</p>
                  {getLifecycleBadge(selectedProject.lifecycle_stage)}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-medium">{selectedProject.project_type || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-medium">{selectedProject.location || 'N/A'}</p>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Timeline
                </h4>
                <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <p className="font-medium">
                      {selectedProject.start_date 
                        ? format(new Date(selectedProject.start_date), 'dd MMM yyyy')
                        : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expected Completion</p>
                    <p className="font-medium">
                      {selectedProject.target_completion_date 
                        ? format(new Date(selectedProject.target_completion_date), 'dd MMM yyyy')
                        : 'TBD'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Days Remaining</p>
                    <p className="font-medium">
                      {selectedProject.target_completion_date
                        ? `${differenceInDays(new Date(selectedProject.target_completion_date), new Date())} days`
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Budget */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Budget
                </h4>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Budget Utilization</span>
                    <span className="font-medium">
                      ₹{((selectedProject.total_spent || 0) / 100000).toFixed(2)}L / 
                      ₹{((selectedProject.approved_budget || 0) / 100000).toFixed(2)}L
                    </span>
                  </div>
                  <Progress 
                    value={getBudgetProgress(selectedProject.approved_budget, selectedProject.total_spent)}
                    className="h-3"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {getBudgetProgress(selectedProject.approved_budget, selectedProject.total_spent).toFixed(1)}% utilized
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  className="flex-1 gap-2"
                  onClick={() => {
                    setSelectedProject(null);
                    navigate(`/projects/command/${selectedProject.id}`);
                  }}
                >
                  <Eye className="w-4 h-4" />
                  View Full Details
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setSelectedProject(null);
                    navigate(`/projects/execution/${selectedProject.id}`);
                  }}
                >
                  <Package className="w-4 h-4" />
                  Execution View
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
