import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectLifecycle } from '@/hooks/useProjectLifecycle';
import { useProjectTimeline } from '@/hooks/useProjectTimeline';
import { useBOQ } from '@/hooks/useBOQ';
import { useProjectPhases } from '@/hooks/useProjectPhases';
import { LIFECYCLE_STAGES, AGING_THRESHOLDS } from '@/constants/projectCategories';
import { format } from 'date-fns';
import { Clock, Users, Package, Hammer, DollarSign, FileText, AlertTriangle, CheckCircle, Calendar } from 'lucide-react';

export default function ProjectCommandPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { project, aging, isLoading } = useProjectLifecycle(projectId);
  const { entries: timeline } = useProjectTimeline(projectId || '');
  const { items: boqItems, totalEstimated } = useBOQ(projectId || '');
  const { phases } = useProjectPhases(projectId || '');

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!project) {
    return <div className="p-6 text-center text-muted-foreground">Project not found</div>;
  }

  const currentStageIndex = LIFECYCLE_STAGES.findIndex(s => s.value === project.lifecycle_stage);
  const progressPercent = ((currentStageIndex + 1) / LIFECYCLE_STAGES.length) * 100;

  const getAgingStatus = (stage: string, days: number) => {
    const thresholds = AGING_THRESHOLDS[stage as keyof typeof AGING_THRESHOLDS];
    if (!thresholds) return 'ok';
    if (days >= thresholds.critical) return 'critical';
    if (days >= thresholds.warning) return 'warning';
    return 'ok';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{project.project_name}</h1>
          <p className="text-muted-foreground">{project.project_id} • {project.client_name}</p>
          <div className="flex gap-2 mt-2">
            <Badge variant={project.project_category === 'DIRECT' ? 'default' : 'secondary'}>
              {project.project_category || 'DIRECT'}
            </Badge>
            {project.vertical && (
              <Badge variant="outline">{project.vertical.name}</Badge>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Age</p>
          <p className="text-3xl font-bold">{aging?.total_age_days || 0} days</p>
        </div>
      </div>

      {/* Lifecycle Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Lifecycle Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercent} className="h-3 mb-4" />
          <div className="flex justify-between text-xs">
            {LIFECYCLE_STAGES.map((stage, idx) => (
              <div
                key={stage.value}
                className={`text-center ${idx <= currentStageIndex ? 'text-primary font-medium' : 'text-muted-foreground'}`}
              >
                {idx <= currentStageIndex ? <CheckCircle className="h-4 w-4 mx-auto mb-1" /> : <Clock className="h-4 w-4 mx-auto mb-1" />}
                <span className="hidden md:block">{stage.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">BOQ Items</p>
                <p className="text-2xl font-bold">{boqItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Est. Cost</p>
                <p className="text-2xl font-bold">₹{totalEstimated.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                <Hammer className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phases</p>
                <p className="text-2xl font-bold">{phases.filter(p => p.status === 'completed').length}/{phases.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                <Calendar className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hand Over</p>
                <p className="text-2xl font-bold">{project.target_start_date ? format(new Date(project.target_start_date), 'dd MMM yy') : 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aging Widget */}
      {aging && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" /> Stage Aging
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(aging.stage_ages).map(([stage, days]) => {
                const status = getAgingStatus(stage, days as number);
                return (
                  <div key={stage} className={`p-3 rounded-lg border ${status === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-950' : status === 'warning' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950' : 'border-border'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {status !== 'ok' && <AlertTriangle className={`h-4 w-4 ${status === 'critical' ? 'text-red-500' : 'text-yellow-500'}`} />}
                      <span className="text-xs font-medium capitalize">{stage.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xl font-bold">{days} days</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Project Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {timeline.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No timeline entries yet</p>
            ) : (
              timeline.map((entry) => (
                <div key={entry.id} className="flex gap-4 border-l-2 border-primary/20 pl-4 pb-4">
                  <div className="flex-1">
                    <p className="font-medium capitalize">{entry.action.replace(/_/g, ' ')}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.performed_by_name} ({entry.performed_by_role}) • {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
