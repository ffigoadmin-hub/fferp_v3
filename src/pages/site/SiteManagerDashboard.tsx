import { useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Calendar, CheckCircle, AlertTriangle, RefreshCw, MapPin, Users, Cloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDailySiteUpdates } from '@/hooks/useDailySiteUpdates';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { DailyUpdateForm } from '@/components/site/DailyUpdateForm';
import { useProjectPhases } from '@/hooks/useProjectPhases';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function SiteManagerDashboard() {
  const { user } = useAuth();
  const { projects } = useProjects();
  const { updates, isLoading, createUpdate, refetch, isSaving } = useDailySiteUpdates();
  
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [updateFormOpen, setUpdateFormOpen] = useState(false);

  // Fetch phases for the selected project
  const { phases: projectPhases } = useProjectPhases(selectedProject || undefined);

  // Filter projects assigned to this site manager
  const myProjects = projects.filter(p => p.assigned_site_manager_id === user?.id);

  const todayUpdates = updates.filter(u => u.update_date === format(new Date(), 'yyyy-MM-dd'));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-emerald-400 bg-clip-text text-transparent">
            Site Manager Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">Submit daily updates and track project progress</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'My Projects', value: myProjects.length, icon: MapPin, color: 'text-blue-400 bg-blue-500/20' },
          { label: 'Today Updates', value: todayUpdates.length, icon: Calendar, color: 'text-emerald-400 bg-emerald-500/20' },
          { label: 'Total Updates', value: updates.length, icon: Camera, color: 'text-violet-400 bg-violet-500/20' },
          { label: 'Issues Reported', value: updates.filter(u => u.issues_faced).length, icon: AlertTriangle, color: 'text-amber-400 bg-amber-500/20' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.color)}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Projects List */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">My Assigned Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {myProjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No projects assigned to you yet</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {myProjects.map(project => {
                const projectUpdates = updates.filter(u => u.project_id === project.id);
                const todayUpdate = projectUpdates.find(u => u.update_date === format(new Date(), 'yyyy-MM-dd'));

                return (
                  <motion.div key={project.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{project.project_name}</h3>
                        <p className="text-sm text-muted-foreground">{project.client_name}</p>
                      </div>
                      {todayUpdate ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Updated Today
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                          Pending
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <MapPin className="w-3.5 h-3.5" />
                      {project.location_city}, {project.location_state}
                    </div>
                    <Button size="sm" className="w-full" onClick={() => { setSelectedProject(project.id); setUpdateFormOpen(true); }}>
                      <Camera className="w-4 h-4 mr-2" />
                      Submit Daily Update
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Updates */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Recent Updates</CardTitle>
        </CardHeader>
        <CardContent>
          {updates.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No updates submitted yet</p>
          ) : (
            <div className="space-y-3">
              {updates.slice(0, 5).map(update => (
                <div key={update.id} className="p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{update.project?.project_name}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(update.update_date), 'dd MMM yyyy')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{update.work_done}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {update.labor_count} workers</span>
                    <span className="flex items-center gap-1"><Cloud className="w-3 h-3" /> {update.weather_conditions}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Form Modal */}
      {selectedProject && (
        <DailyUpdateForm
          open={updateFormOpen}
          onOpenChange={setUpdateFormOpen}
          projectId={selectedProject}
          phases={projectPhases || []}
          onSubmit={async (data) => {
            await createUpdate({ ...data, project_id: selectedProject });
          }}
          isLoading={isSaving}
        />
      )}
    </div>
  );
}
