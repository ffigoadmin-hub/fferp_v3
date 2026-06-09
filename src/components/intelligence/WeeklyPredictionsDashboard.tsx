import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    AlertTriangle,
    Trophy,
    Lightbulb,
    Building2,
    ChevronDown,
    ChevronUp,
    Calendar,
    Brain,
    Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useWeeklyPredictions, AtRiskEmployee, TopPerformer, RecommendedAction } from '@/hooks/useWeeklyPredictions';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

const trendConfig = {
    improving: { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Improving' },
    stable: { icon: Minus, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Stable' },
    declining: { icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Declining' },
};

const priorityConfig = {
    high: { color: 'text-red-500', bg: 'bg-red-500/20', border: 'border-red-500/30' },
    medium: { color: 'text-amber-500', bg: 'bg-amber-500/20', border: 'border-amber-500/30' },
    low: { color: 'text-blue-500', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
};

function AtRiskCard({ employees }: { employees: AtRiskEmployee[] }) {
    if (employees.length === 0) return null;

    return (
        <Card className="bg-red-500/5 border-red-500/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-500">
                    <AlertTriangle className="w-4 h-4" />
                    At-Risk Employees ({employees.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {employees.slice(0, 5).map((emp, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10">
                        <Badge variant="outline" className={cn(
                            "text-[10px] shrink-0",
                            emp.riskLevel === 'high' ? 'border-red-500 text-red-500' : 'border-amber-500 text-amber-500'
                        )}>
                            {emp.riskLevel}
                        </Badge>
                        <p className="text-xs text-muted-foreground">{emp.reason}</p>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function TopPerformersCard({ performers }: { performers: TopPerformer[] }) {
    if (performers.length === 0) return null;

    return (
        <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-500">
                    <Trophy className="w-4 h-4" />
                    Top Performers ({performers.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {performers.slice(0, 5).map((perf, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/10">
                        <span className="text-emerald-500 font-bold shrink-0">#{i + 1}</span>
                        <p className="text-xs text-muted-foreground">{perf.highlight}</p>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function ActionsCard({ actions }: { actions: RecommendedAction[] }) {
    if (actions.length === 0) return null;

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target className="w-4 h-4 text-purple-500" />
                    Recommended Actions
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {actions.map((action, i) => {
                    const config = priorityConfig[action.priority];
                    return (
                        <div key={i} className={cn("p-2 rounded-lg border", config.bg, config.border)}>
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className={cn("text-[10px]", config.color, config.border)}>
                                    {action.priority}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px]">
                                    {action.target}
                                </Badge>
                            </div>
                            <p className="text-xs">{action.action}</p>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}

function DepartmentInsights({ insights }: { insights: Record<string, string> }) {
    const entries = Object.entries(insights);
    if (entries.length === 0) return null;

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-500" />
                    Department Insights
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {entries.map(([dept, insight], i) => (
                    <div key={i} className="p-2 rounded-lg bg-muted/50">
                        <p className="text-xs font-medium text-primary mb-1">{dept}</p>
                        <p className="text-xs text-muted-foreground">{insight}</p>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

export function WeeklyPredictionsDashboard() {
    const { prediction, isLoading, error } = useWeeklyPredictions();
    const [showFullAnalysis, setShowFullAnalysis] = useState(false);

    if (isLoading) {
        return (
            <Card className="animate-pulse">
                <CardContent className="p-6">
                    <div className="h-40 bg-muted rounded-lg" />
                </CardContent>
            </Card>
        );
    }

    if (error || !prediction) {
        return (
            <Card className="border-dashed">
                <CardContent className="p-6 text-center">
                    <Brain className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                        No weekly predictions available yet
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Predictions are generated weekly on Sunday
                    </p>
                </CardContent>
            </Card>
        );
    }

    const trend = trendConfig[prediction.org_trend] || trendConfig.stable;
    const TrendIcon = trend.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
        >
            {/* Header Card */}
            <Card className="overflow-hidden">
                <div className={cn("h-1", trend.bg.replace('/10', ''))} />
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Brain className="w-5 h-5 text-purple-500" />
                            Weekly AI Predictions
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">
                            <Calendar className="w-3 h-3 mr-1" />
                            {format(parseISO(prediction.week_start), 'MMM d')} - {format(parseISO(prediction.week_end), 'MMM d')}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-6 mb-4">
                        <div className={cn("p-3 rounded-xl", trend.bg)}>
                            <TrendIcon className={cn("w-8 h-8", trend.color)} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <Badge className={cn(trend.bg, trend.color, "border-0")}>
                                    {trend.label}
                                </Badge>
                                <span className="text-2xl font-bold">{prediction.org_avg_score.toFixed(0)}</span>
                                <span className="text-muted-foreground">/100 avg</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {prediction.org_prediction}
                            </p>
                        </div>
                    </div>

                    {/* Full Analysis Collapsible */}
                    <Collapsible open={showFullAnalysis} onOpenChange={setShowFullAnalysis}>
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full justify-between">
                                <span className="flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4" />
                                    Full Analysis
                                </span>
                                {showFullAnalysis ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <ScrollArea className="h-48 mt-2 p-4 bg-muted/30 rounded-lg">
                                <p className="text-sm whitespace-pre-wrap">
                                    {prediction.full_analysis}
                                </p>
                            </ScrollArea>
                        </CollapsibleContent>
                    </Collapsible>
                </CardContent>
            </Card>

            {/* Grid of insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AtRiskCard employees={prediction.at_risk_employees} />
                <TopPerformersCard performers={prediction.top_performers} />
                <ActionsCard actions={prediction.recommended_actions} />
                <DepartmentInsights insights={prediction.department_insights} />
            </div>
        </motion.div>
    );
}
