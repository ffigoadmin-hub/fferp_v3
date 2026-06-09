import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Clock, AlertTriangle, Eye, MessageSquare, Building2, FileText, Package } from 'lucide-react';
import { format } from 'date-fns';
import { useFarmManagerRemarks } from '@/hooks/useFarmManagerRemarks';
import { useProjectPhases } from '@/hooks/useProjectPhases';
import { ProjectDailyLogsWidget } from '@/components/engineering/ProjectDailyLogsWidget';
import { MilestoneManager } from '@/components/engineering/MilestoneManager';
import { DailySiteReportForm } from '@/components/farm/DailySiteReportForm';
import { Project } from '@/hooks/useProjects';

interface ConstructionModeViewProps {
  projects: Project[];
  selectedProjectId: string;
  updates: any[];
}

export default function ConstructionModeView({ projects, selectedProjectId, updates }: ConstructionModeViewProps) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [remarkDialogOpen, setRemarkDialogOpen] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<any>(null);
  const [remarkType, setRemarkType] = useState<'verified' | 'followed_up' | 'needs_attention'>('verified');
  const [remarkText, setRemarkText] = useState('');
  const [dsrFormOpen, setDsrFormOpen] = useState(false);
  const [dsrProject, setDsrProject] = useState<Project | null>(null);
  
  const { addRemark, isAdding } = useFarmManagerRemarks();
  const { phases } = useProjectPhases(selectedProjectId !== 'all' ? selectedProjectId : undefined);

  const filteredProjects = selectedProjectId === 'all' 
    ? projects 
    : projects.filter(p => p.id === selectedProjectId);

  const handleAddRemark = async () => {
    if (!selectedUpdate) return;
    await addRemark({
      siteUpdateId: selectedUpdate.id,
      remarkType,
      remarkText,
      projectId: selectedUpdate.project_id,
    });
    setRemarkDialogOpen(false);
    setRemarkText('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'execution': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'on_hold': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  };

  const formattedPhases = phases.map(p => ({ id: p.id, phase_name: p.phase_name }));

  return (
    <div className="space-y-6">
      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="updates">Site Updates</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(project => (
              <Card key={project.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedProject(project)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{project.project_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{project.client_name}</p>
                    </div>
                    <Badge className={getStatusColor(project.status)}>
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Status</span>
                        <span className="capitalize">{project.status}</span>
                      </div>
                      <Progress value={project.status === 'completed' ? 100 : project.status === 'execution' ? 50 : 25} />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span>{project.vertical || 'General'}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDsrProject(project);
                          setDsrFormOpen(true);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Add DSR
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedProject(project)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="updates" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Site Updates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {updates.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No updates found</p>
                  ) : (
                    updates.map(update => (
                      <div key={update.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">{update.work_done}</p>
                            <p className="text-sm text-muted-foreground">
                              {update.project?.project_name || 'Unknown Project'} • {format(new Date(update.created_at || update.update_date), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUpdate(update);
                              setRemarkDialogOpen(true);
                            }}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Remark
                          </Button>
                        </div>
                        {update.issues_faced && (
                          <div className="flex items-center gap-2 text-amber-600 text-sm">
                            <AlertTriangle className="h-4 w-4" />
                            {update.issues_faced}
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Labor: {update.labor_count || 0}</span>
                          <span>Progress: {update.progress_percentage || 0}%</span>
                          {update.weather_conditions && <span>Weather: {update.weather_conditions}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="milestones" className="mt-4">
          {selectedProjectId !== 'all' ? (
            <MilestoneManager projectId={selectedProjectId} phases={formattedPhases} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Select a specific project to view milestones
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Daily Logs Widget for Selected Project */}
      {selectedProject && (
        <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{selectedProject.project_name} - Daily Logs</DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1">
              <ProjectDailyLogsWidget projectId={selectedProject.id} phases={formattedPhases} canEdit={true} />
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* Remark Dialog */}
      <Dialog open={remarkDialogOpen} onOpenChange={setRemarkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Verification Remark</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Remark Type</label>
              <Select value={remarkType} onValueChange={(v: any) => setRemarkType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="verified">✓ Verified</SelectItem>
                  <SelectItem value="followed_up">📞 Followed Up</SelectItem>
                  <SelectItem value="needs_attention">⚠️ Needs Attention</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Remark (Optional)</label>
              <Textarea
                value={remarkText}
                onChange={(e) => setRemarkText(e.target.value)}
                placeholder="Add any additional notes..."
              />
            </div>
            <Button onClick={handleAddRemark} disabled={isAdding} className="w-full">
              {isAdding ? 'Adding...' : 'Add Remark'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DSR Form */}
      {dsrProject && (
        <DailySiteReportForm
          open={dsrFormOpen}
          onOpenChange={setDsrFormOpen}
          projectId={dsrProject.id}
          projectName={dsrProject.project_name}
          phases={formattedPhases}
          onSuccess={() => setDsrProject(null)}
        />
      )}
    </div>
  );
}
