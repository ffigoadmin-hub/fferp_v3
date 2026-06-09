import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Brain,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    CheckCircle2,
    Clock,
    FileText,
    BarChart3,
    Zap
} from 'lucide-react';
import { AIScoreWithProfile } from '@/hooks/useAIEmployeeScores';
import { cn } from '@/lib/utils';

interface AIScoreCardProps {
    score: AIScoreWithProfile;
    showAnalysis?: boolean;
    compact?: boolean;
}

const statusConfig = {
    working_productively: {
        label: 'Productive',
        color: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30',
        icon: CheckCircle2,
        bgGlow: 'shadow-emerald-500/10',
    },
    idle: {
        label: 'Idle',
        color: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
        icon: Clock,
        bgGlow: 'shadow-amber-500/10',
    },
    needs_attention: {
        label: 'Needs Attention',
        color: 'bg-red-500/20 text-red-600 border-red-500/30',
        icon: AlertTriangle,
        bgGlow: 'shadow-red-500/10',
    },
};

export function AIScoreCard({ score, showAnalysis = false, compact = false }: AIScoreCardProps) {
    const status = statusConfig[score.ai_status] || statusConfig.idle;
    const StatusIcon = status.icon;

    const getScoreColor = (value: number) => {
        if (value >= 80) return 'text-emerald-500';
        if (value >= 60) return 'text-amber-500';
        return 'text-red-500';
    };

    if (compact) {
        return (
            <div className={cn(
                "flex items-center justify-between p-3 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors",
                status.bgGlow
            )}>
                <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                        <span className="font-medium text-sm">{score.userName}</span>
                        <span className="text-xs text-muted-foreground">{score.department}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={cn("text-lg font-bold", getScoreColor(score.ai_score))}>
                        {score.ai_score}
                    </span>
                    <Badge variant="outline" className={cn("text-xs", status.color)}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                    </Badge>
                </div>
            </div>
        );
    }

    return (
        <Card className={cn("overflow-hidden", status.bgGlow)}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Brain className="w-5 h-5 text-purple-500" />
                            {score.userName}
                        </CardTitle>
                        <CardDescription>{score.department}</CardDescription>
                    </div>
                    <div className="text-right">
                        <div className={cn("text-3xl font-bold", getScoreColor(score.ai_score))}>
                            {score.ai_score}
                        </div>
                        <Badge variant="outline" className={cn("mt-1", status.color)}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {status.label}
                        </Badge>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Breakdown Scores */}
                <div className="grid grid-cols-2 gap-3">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> Punctuality
                                        </span>
                                        <span className="font-medium">{score.punctuality_score}/25</span>
                                    </div>
                                    <Progress value={(score.punctuality_score / 25) * 100} className="h-1.5" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>Login timing, selfie compliance</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1">
                                            <FileText className="w-3 h-3" /> Plan Quality
                                        </span>
                                        <span className="font-medium">{score.plan_quality_score}/25</span>
                                    </div>
                                    <Progress value={(score.plan_quality_score / 25) * 100} className="h-1.5" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>Day plan & hourly plan quality</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1">
                                            <BarChart3 className="w-3 h-3" /> Report Quality
                                        </span>
                                        <span className="font-medium">{score.report_quality_score}/25</span>
                                    </div>
                                    <Progress value={(score.report_quality_score / 25) * 100} className="h-1.5" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>Hourly report substance & detail</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1">
                                            <Zap className="w-3 h-3" /> Consistency
                                        </span>
                                        <span className="font-medium">{score.consistency_score}/25</span>
                                    </div>
                                    <Progress value={(score.consistency_score / 25) * 100} className="h-1.5" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>Follow-through & regularity</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                {/* AI Analysis */}
                {showAnalysis && score.ai_analysis && (
                    <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <Brain className="w-3 h-3" /> AI Analysis
                        </p>
                        <ScrollArea className="h-24">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {score.ai_analysis}
                            </p>
                        </ScrollArea>
                    </div>
                )}

                {/* Last Updated */}
                <div className="text-xs text-muted-foreground text-right">
                    Updated: {new Date(score.last_updated).toLocaleTimeString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

interface AIScoreOverviewProps {
    scores: AIScoreWithProfile[];
    averageScore: number;
    statusCounts: {
        working_productively: number;
        idle: number;
        needs_attention: number;
    };
}

export function AIScoreOverview({ scores, averageScore, statusCounts }: AIScoreOverviewProps) {
    const totalScored = scores.length;

    const getScoreColor = (value: number) => {
        if (value >= 80) return 'text-emerald-500';
        if (value >= 60) return 'text-amber-500';
        return 'text-red-500';
    };

    const topPerformers = scores.slice(0, 3);
    const needsAttention = scores.filter(s => s.ai_status === 'needs_attention').slice(0, 3);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Overall Score */}
            <Card className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border-purple-500/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Brain className="w-4 h-4 text-purple-500" />
                        AI Organization Score
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className={cn("text-4xl font-bold", getScoreColor(averageScore))}>
                        {averageScore}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Based on {totalScored} active employees
                    </p>
                    <div className="flex gap-2 mt-3">
                        <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {statusCounts.working_productively} Productive
                        </Badge>
                        <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                            <Clock className="w-3 h-3 mr-1" />
                            {statusCounts.idle} Idle
                        </Badge>
                        <Badge className="bg-red-500/20 text-red-600 border-red-500/30">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {statusCounts.needs_attention} Alert
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Top Performers */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        Top Performers
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {topPerformers.length > 0 ? (
                        topPerformers.map((score, idx) => (
                            <div key={score.id} className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 text-xs flex items-center justify-center font-bold">
                                        {idx + 1}
                                    </span>
                                    {score.userName}
                                </span>
                                <span className="font-bold text-emerald-500">{score.ai_score}</span>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground">No AI scores yet today</p>
                    )}
                </CardContent>
            </Card>

            {/* Needs Attention */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        Needs Attention
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {needsAttention.length > 0 ? (
                        needsAttention.map((score) => (
                            <div key={score.id} className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                    {score.userName}
                                </span>
                                <span className="font-bold text-red-500">{score.ai_score}</span>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground text-emerald-600">
                            ✓ No critical issues
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
