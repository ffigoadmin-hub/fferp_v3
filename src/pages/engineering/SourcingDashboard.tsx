import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw, Filter, Layers, Zap, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAllProjectsExecution } from '@/hooks/useProjectExecution';
import { AnalyticsMetricCard } from '@/components/analytics/AnalyticsMetricCard';
import { ProjectFunnelChart } from '@/components/analytics/ProjectFunnelChart';
import { RiskHeatmapWidget } from '@/components/analytics/RiskHeatmapWidget';
import { calculateProjectRisk } from '@/lib/riskEngine';
import { LIFECYCLE_STAGES } from '@/constants/projectCategories';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';
import {
  Building2, MapPin, ArrowRight
} from 'lucide-react';

export default function SourcingDashboard() {
  const { projects, isLoading, isRefetching, refetch } = useAllProjectsExecution();
  const [filterStage, setFilterStage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Advanced Data Processing ---
  const processedData = useMemo(() => {
    if (!projects) return null;

    // 1. Calculate Risks for ALL projects
    const projectsWithRisk = projects.map(p => ({
      ...p,
      riskAnalysis: calculateProjectRisk(p)
    }));

    // 2. Aggregate Funnel Data
    const stages = [
      { id: 'new_deal', label: 'New Deals', color: 'bg-primary/40' },
      { id: 'engineering_assigned', label: 'In Preparation', color: 'bg-primary/50' },
      { id: 'boq_submitted', label: 'Review Pending', color: 'bg-primary/55' },
      { id: 'boq_approved', label: 'Execution Ready', color: 'bg-primary/60' },
      { id: 'sourcing', label: 'Sourcing', color: 'bg-primary/70' },
      { id: 'execution', label: 'In Execution', color: 'bg-primary/80' },
      { id: 'completed', label: 'Completed', color: 'bg-primary' }
    ];

    const funnel = stages.map(stage => {
      const stageProjects = projects.filter(p => p.lifecycle_stage === stage.id);
      const count = stageProjects.length;
      // FIX: Ensure numeric conversion to prevent "0" string concatenation issues
      const value = stageProjects.reduce((sum, p) => sum + (Number(p.total_project_value) || 0), 0);
      return {
        ...stage,
        count,
        value,
        percentage: projects.length > 0 ? (count / projects.length) * 100 : 0
      };
    });

    // 3. Financial Totals
    const totalPipelineValue = projects.reduce((sum, p) => sum + (Number(p.total_project_value) || Number(p.approved_budget) || 0), 0);
    const totalPaid = projects.reduce((sum, p) => sum + (Number(p.total_paid) || 0), 0);
    const totalPending = Math.max(totalPipelineValue - totalPaid, 0);

    // 4. Critical Risks
    const highRisks = projectsWithRisk
      .filter(p => p.riskAnalysis.score >= 40) // Medium or higher
      .map(p => ({
        id: p.id,
        projectName: p.project_name,
        analysis: p.riskAnalysis
      }));

    return {
      projectsWithRisk,
      funnel,
      financials: { totalPipelineValue, totalPaid, totalPending },
      highRisks
    };
  }, [projects]);

  if (isLoading || !processedData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <div className="space-y-2 text-center">
            <h3 className="text-xl font-medium tracking-tight text-foreground">Loading Command Center</h3>
            <p className="text-sm text-muted-foreground animate-pulse">Aggregating analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  const { funnel, financials, highRisks, projectsWithRisk } = processedData;

  // Filter Logic
  const filteredProjects = projectsWithRisk.filter(p => {
    const matchesStage = filterStage ? p.lifecycle_stage === filterStage : true;
    const matchesSearch = searchQuery
      ? p.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesStage && matchesSearch;
  });

  const activeExecCount = projects.filter(p => p.lifecycle_stage === 'execution').length;

  return (
    // Changed main container to use theme background or be transparent
    <div className="min-h-screen p-4 lg:p-8 space-y-8 font-sans animate-fade-in relative z-10">

      {/* Top Navigation / Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col xl:flex-row xl:items-center justify-between gap-6"
      >
        <div>
          <Badge variant="outline" className="mb-2 bg-primary/10 text-primary border-primary/20">
            v2.0 Analytics
          </Badge>
          {/* Text colors to use theme variable */}
          <h1 className="text-4xl font-black tracking-tighter text-foreground drop-shadow-sm">
            Project Execution
          </h1>
          <p className="text-muted-foreground font-medium mt-1">
            Real-time project tracking & risk monitoring.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              // Glassmorphic Input
              className="pl-9 w-64 bg-background/50 backdrop-blur-sm border-border/50 focus:border-primary/50"
            />
          </div>
          {filterStage && (
            <Button variant="secondary" onClick={() => setFilterStage(null)} className="gap-2">
              <Filter className="w-4 h-4" /> Clear: {funnel.find(f => f.id === filterStage)?.label}
            </Button>
          )}
          <Button onClick={() => refetch()} disabled={isRefetching} className="gap-2 shadow-lg shadow-primary/25 transition-all hover:scale-105">
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnalyticsMetricCard
          title="Total Projects"
          value={projects.length}
          subValue="Active Pipeline"
          icon={Layers}
          colorScheme="primary"
          trend={{ value: 12, isPositive: true, label: "vs last month" }}
        />
        <AnalyticsMetricCard
          title="Execution Sites"
          value={activeExecCount}
          subValue="On-Ground Teams"
          icon={Building2}
          colorScheme="emerald"
          trend={{ value: 4, isPositive: true, label: "new sites" }}
        />
        <AnalyticsMetricCard
          title="Critical Risks"
          value={highRisks.filter(r => r.analysis.level === 'Critical').length}
          subValue="Attention Needed"
          icon={Zap}
          colorScheme="rose"
          className="cursor-pointer ring-offset-2 hover:ring-2 hover:ring-rose-500/20"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left Col: Funnel & List (Spans 2) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Funnel Chart */}
          <div className="h-[400px]">
            <ProjectFunnelChart
              stages={funnel}
              onStageClick={(id) => setFilterStage(id === filterStage ? null : id)}
              activeStageId={filterStage}
            />
          </div>

          {/* Project List */}
          <Card className="border-border/50 shadow-sm bg-card/40 backdrop-blur-sm min-h-[400px] flex flex-col">
            <CardHeader className="pb-3 border-b border-border/10 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold">
                {filterStage ? funnel.find(f => f.id === filterStage)?.label : 'All Projects'}
              </CardTitle>
              <Badge variant="outline">{filteredProjects.length} Records</Badge>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-[400px]">
                {filteredProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <p>No projects match your criteria.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/10">
                    {filteredProjects.map((project, i) => (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="p-4 hover:bg-muted/50 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-start gap-4">
                          {/* Risk Indicator Orb */}
                          <div className={`mt-1 w-2 h-2 rounded-full ${project.riskAnalysis.level === 'Critical' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                            project.riskAnalysis.level === 'High' ? 'bg-orange-500' :
                              'bg-slate-300'
                            }`} />

                          <div>
                            <h4 className="font-semibold text-sm text-foreground">{project.project_name}</h4>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {project.client_name || 'No Client'}
                              </span>
                              <span>•</span>
                              <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-muted/50">
                                {LIFECYCLE_STAGES.find(s => s.value === project.lifecycle_stage)?.label || project.lifecycle_stage}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 md:gap-10">
                          <div className="text-right hidden sm:block">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Value</p>
                            <p className="text-xs font-bold text-foreground tracking-tight">
                              ₹{(Number(project.net_contract_value || project.total_project_value) / 100000).toFixed(2)}L
                            </p>
                          </div>

                          <div className="text-right hidden sm:block border-l border-border/10 pl-6 md:pl-10">
                            <p className="text-[10px] text-emerald-600 uppercase tracking-wider font-bold mb-0.5">Spend</p>
                            <p className="text-sm font-black text-emerald-600 tracking-tight">
                              ₹{(Number(project.total_paid) / 100000).toFixed(2)}L
                            </p>
                          </div>

                          <Link to={`/projects/execution/${project.id}`}>
                            <Button size="icon" variant="ghost" className="h-9 w-9 opacity-40 group-hover:opacity-100 hover:bg-primary/10 hover:text-primary transition-all">
                              <ArrowRight className="w-5 h-5" />
                            </Button>
                          </Link>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Risks (Spans 1) */}
        <div className="xl:col-span-1">
          {/* Risk Heatmap - Expanded to fill column */}
          <div className="h-[824px]">
            <RiskHeatmapWidget risks={highRisks} />
          </div>
        </div>

      </div>
    </div>
  );
}
