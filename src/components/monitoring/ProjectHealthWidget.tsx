import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Activity, AlertTriangle, CheckCircle2, Clock, Eye, 
  RefreshCw, TrendingUp, Loader2, ArrowRight
} from 'lucide-react';
import { useProjectHealth, ProjectHealthData } from '@/hooks/useProjectHealth';
import { LIFECYCLE_STAGES } from '@/constants/projectCategories';

interface ProjectHealthWidgetProps {
  vertical?: string;
  compact?: boolean;
  maxItems?: number;
}

const getStageLabel = (stage: string) => {
  const stageInfo = LIFECYCLE_STAGES.find(s => s.value === stage);
  return stageInfo?.label || stage.replace(/_/g, ' ');
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'healthy': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'warning': return <Clock className="w-4 h-4 text-amber-500" />;
    case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
    default: return null;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'healthy': return 'border-l-green-500';
    case 'warning': return 'border-l-amber-500';
    case 'critical': return 'border-l-red-500';
    default: return 'border-l-gray-500';
  }
};

export function ProjectHealthWidget({ vertical, compact = false, maxItems = 10 }: ProjectHealthWidgetProps) {
  const { projects, summary, isLoading, refetch } = useProjectHealth(vertical);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredProjects = projects
    .filter(p => stageFilter === 'all' || p.lifecycle_stage === stageFilter)
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .slice(0, maxItems);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            Project Health
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{summary.total_projects}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-green-500/10 cursor-pointer" onClick={() => setStatusFilter('healthy')}>
            <p className="text-2xl font-bold text-green-600">{summary.healthy}</p>
            <p className="text-xs text-green-600">Healthy</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-amber-500/10 cursor-pointer" onClick={() => setStatusFilter('warning')}>
            <p className="text-2xl font-bold text-amber-600">{summary.warning}</p>
            <p className="text-xs text-amber-600">Warning</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-red-500/10 cursor-pointer" onClick={() => setStatusFilter('critical')}>
            <p className="text-2xl font-bold text-red-600">{summary.critical}</p>
            <p className="text-xs text-red-600">Critical</p>
          </div>
        </div>

        {/* Filters */}
        {!compact && (
          <div className="flex gap-2 mt-3">
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {LIFECYCLE_STAGES.filter(s => s.value !== 'completed').map(stage => (
                  <SelectItem key={stage.value} value={stage.value}>{stage.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            {statusFilter !== 'all' && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setStatusFilter('all')}>
                Clear
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 pt-0">
        <ScrollArea className={compact ? "h-[250px]" : "h-[400px]"}>
          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingUp className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No projects found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProjects.map((project, index) => (
                <ProjectHealthItem key={project.id} project={project} index={index} compact={compact} />
              ))}
            </div>
          )}
        </ScrollArea>

        {!compact && projects.length > maxItems && (
          <div className="mt-4 text-center">
            <Link to="/sourcing-dashboard">
              <Button variant="outline" size="sm" className="gap-2">
                View All Projects <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectHealthItem({ project, index, compact }: { project: ProjectHealthData; index: number; compact: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`p-3 rounded-lg border border-l-4 ${getStatusColor(project.status)} hover:bg-muted/50 transition-colors`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {getStatusIcon(project.status)}
            <p className="font-medium text-sm truncate">{project.project_name}</p>
          </div>
          <p className="text-xs text-muted-foreground truncate">{project.client_name}</p>
          
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {getStageLabel(project.lifecycle_stage)}
            </Badge>
            {project.days_in_stage > 0 && (
              <span className="text-xs text-muted-foreground">
                {project.days_in_stage}d in stage
              </span>
            )}
          </div>

          {!compact && (
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>BOQ: {project.boq_count}</span>
              <span>PO: {project.po_count}</span>
              <span>WO: {project.wo_count}</span>
            </div>
          )}
        </div>

        <Link to={`/projects/execution/${project.id}`}>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <Eye className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
