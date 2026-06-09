import { useState, useEffect } from 'react';
import { format, differenceInDays } from 'date-fns';
import { Edit, AlertTriangle, MapPin, Calendar, Clock, ArrowRight, Layers, Flag, CheckCircle2, Target, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import type { ProjectInsightsSummary } from '@/hooks/useProjectInsights';

interface Project {
    id: string;
    project_id: string;
    project_name: string;
    location_city: string;
    location_state: string;
    vertical: string;
    project_type?: string;
    current_spend: number;
    client_name: string;
    client_contact: string;
    assigned_manager_id: string | null;
    assigned_engineer_id: string | null;
    target_start_date: string;
    target_completion_date: string;
    status: string;
    remarks: string | null;
    created_at: string;
    manager?: { name: string };
    engineer?: { name: string };
    deal_file_url: string | null;
    jv_commitments: string | null;
    approved_budget: number;
    total_project_value?: number;
}

interface ProjectStats {
    project_id: string;
    total_escalations: number;
    critical_escalations: number;
}

interface ProjectCardProps {
    project: Project;
    stats?: ProjectStats;
    insights?: ProjectInsightsSummary;
    canEdit: boolean;
    onClick: (project: Project) => void;
    onEscalationClick?: (project: Project) => void;
    index: number;
}

const statusColors: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/10',
    upcoming: 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-blue-500/10',
    hold: 'bg-orange-500/10 text-orange-500 border-orange-500/20 shadow-orange-500/10',
    closed: 'bg-slate-500/10 text-slate-500 border-slate-500/20 shadow-slate-500/10',
};

const phaseStatusDot: Record<string, string> = {
    completed: 'bg-emerald-500',
    in_progress: 'bg-primary',
    pending: 'bg-muted-foreground/30',
};

export function ProjectCard({ project, stats, insights, canEdit, onClick, onEscalationClick, index }: ProjectCardProps) {
    const today = new Date();
    const startDate = new Date(project.target_start_date);
    const endDate = new Date(project.target_completion_date);
    const totalDuration = differenceInDays(endDate, startDate) + 1;
    const elapsed = differenceInDays(today, startDate);
    const progressPercent = Math.min(100, Math.max(0, (elapsed / (totalDuration || 1)) * 100));
    const projectAge = differenceInDays(today, startDate);

    const totalEsc = stats?.total_escalations || 0;
    const criticalEsc = stats?.critical_escalations || 0;
    const isOverdue = differenceInDays(today, endDate) > 0 && project.status === 'active';

    // Determine Timeline Color
    let timelineColor = "from-emerald-500 to-emerald-400";
    if (progressPercent > 90) timelineColor = "from-red-500 to-red-400";
    else if (progressPercent > 75) timelineColor = "from-orange-500 to-orange-400";

    // Insights data
    const hasPhases = insights && insights.totalPhases > 0;
    const hasMilestones = insights && insights.totalMilestones > 0;
    const hasEscalations = insights && insights.openEscalations > 0;

    return (
        <div
            className={cn(
                "group relative flex flex-col h-full bg-card/40 border border-white/5 rounded-xl p-4 overflow-hidden cursor-pointer",
                "hover:border-primary/40 transition-all duration-300",
                project.status === 'active' ? "border-emerald-500/10" : "border-border/50"
            )}
            onClick={() => onClick(project)}
        >
            {/* Glow Effect on Hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            {/* Header */}
            <div className="flex justify-between items-start mb-3 relative z-10">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="outline" className="text-[9px] font-mono h-4 border-primary/20 bg-primary/5 text-primary shrink-0">
                            {project.project_id}
                        </Badge>
                        {isOverdue && (
                            <Badge variant="destructive" className="text-[9px] h-4 px-1.5 font-bold shrink-0">
                                OVERDUE
                            </Badge>
                        )}
                    </div>
                    <h3 className="font-bold text-base text-foreground/90 group-hover:text-primary transition-colors line-clamp-1" title={project.project_name}>
                        {project.project_name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                        <MapPin className="w-2.5 h-2.5 text-primary/70" />
                        <span>{project.location_city}, {project.location_state}</span>
                    </div>
                </div>

                <div className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm backdrop-blur-md shrink-0", statusColors[project.status] || statusColors.upcoming)}>
                    {project.status}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col gap-3 relative z-10">

                {/* Progress Bar */}
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(startDate, 'dd MMM')}</span>
                        <span className="text-foreground">Ageing: {Math.max(1, projectAge + 1)} days</span>
                        <span className="flex items-center gap-1">{format(endDate, 'dd MMM')} <Clock className="w-3 h-3" /></span>
                    </div>
                    <div className="h-1 w-full bg-secondary/50 rounded-full overflow-hidden">
                        <div
                            className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", timelineColor)}
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    {progressPercent > 100 && (
                        <p className="text-[10px] text-destructive font-medium text-right">Ext. {differenceInDays(today, endDate)} days</p>
                    )}
                </div>

                {/* ═══ PHASES STRIP ═══ */}
                {hasPhases && (
                    <div className="space-y-1.5 p-2.5 rounded-lg bg-primary/[0.03] border border-primary/10">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] uppercase font-black tracking-widest text-primary/70 flex items-center gap-1">
                                <Layers className="w-3 h-3" /> Phases
                            </span>
                            <span className="text-[9px] font-bold text-foreground/60">
                                {insights!.completedPhases}/{insights!.totalPhases} Done
                            </span>
                        </div>
                        {/* Phase dots - visual pipeline */}
                        <div className="flex items-center gap-1">
                            {insights!.phases.slice(0, 6).map((phase, i) => (
                                <div key={phase.id} className="flex items-center gap-0.5 flex-1 min-w-0">
                                    <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                                        <div className="relative w-full">
                                            <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all duration-500",
                                                        phase.status === 'completed'
                                                            ? "bg-emerald-500"
                                                            : phase.status === 'in_progress'
                                                                ? "bg-primary"
                                                                : "bg-muted-foreground/20"
                                                    )}
                                                    style={{ width: `${phase.completion_percentage || 0}%` }}
                                                />
                                            </div>
                                        </div>
                                        <span className="text-[7px] font-bold text-muted-foreground/60 truncate w-full text-center leading-none" title={phase.phase_name}>
                                            {phase.phase_name.length > 8 ? phase.phase_name.slice(0, 7) + '…' : phase.phase_name}
                                        </span>
                                    </div>
                                    {i < Math.min(insights!.phases.length, 6) - 1 && (
                                        <div className={cn(
                                            "w-1 h-[1px] shrink-0 mt-[-8px]",
                                            phase.status === 'completed' ? "bg-emerald-500/40" : "bg-muted/40"
                                        )} />
                                    )}
                                </div>
                            ))}
                            {insights!.totalPhases > 6 && (
                                <span className="text-[8px] font-bold text-muted-foreground/50 shrink-0">+{insights!.totalPhases - 6}</span>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ MILESTONES STRIP ═══ */}
                {hasMilestones && (
                    <div className="space-y-1.5 p-2.5 rounded-lg bg-amber-500/[0.03] border border-amber-500/10">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] uppercase font-black tracking-widest text-amber-600/70 flex items-center gap-1">
                                <Flag className="w-3 h-3" /> Milestones
                            </span>
                            <div className="flex items-center gap-2">
                                {insights!.delayedMilestones > 0 && (
                                    <span className="text-[8px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full">
                                        {insights!.delayedMilestones} Delayed
                                    </span>
                                )}
                                <span className="text-[9px] font-bold text-foreground/60">
                                    {insights!.completedMilestones}/{insights!.totalMilestones}
                                </span>
                            </div>
                        </div>
                        {/* Milestone dots row */}
                        <div className="flex items-center gap-1">
                            {insights!.milestones.slice(0, 8).map((m) => {
                                const isDelayed = m.status !== 'completed' && new Date(m.planned_date) < today;
                                return (
                                    <div
                                        key={m.id}
                                        className={cn(
                                            "w-2.5 h-2.5 rounded-full border transition-all shrink-0",
                                            m.status === 'completed'
                                                ? "bg-emerald-500 border-emerald-500/50"
                                                : isDelayed
                                                    ? "bg-red-500 border-red-500/50 animate-pulse"
                                                    : m.status === 'in_progress'
                                                        ? "bg-primary border-primary/50"
                                                        : "bg-muted border-muted-foreground/20"
                                        )}
                                        title={`${m.milestone_name} - ${m.status}${isDelayed ? ' (DELAYED)' : ''}`}
                                    />
                                );
                            })}
                            {insights!.totalMilestones > 8 && (
                                <span className="text-[8px] font-bold text-muted-foreground/50 shrink-0">+{insights!.totalMilestones - 8}</span>
                            )}
                        </div>
                        {/* Next milestone preview */}
                        {insights!.nextMilestone && (
                            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                                <Target className="w-3 h-3 text-amber-500" />
                                <span className="font-medium truncate">{insights!.nextMilestone.milestone_name}</span>
                                <span className="text-muted-foreground/50">•</span>
                                <span className="font-mono text-[8px]">
                                    {format(new Date(insights!.nextMilestone.planned_date), 'dd MMM')}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ ESCALATION INSIGHTS ═══ */}
                {hasEscalations && (
                    <div
                        className={cn(
                            "p-2.5 rounded-lg border cursor-pointer",
                            insights!.criticalEscalations > 0
                                ? "bg-red-500/[0.05] border-red-500/20 hover:bg-red-500/10 hover:border-red-500/30"
                                : "bg-orange-500/[0.03] border-orange-500/10 hover:bg-orange-500/[0.06]"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            onEscalationClick ? onEscalationClick(project) : onClick(project);
                        }}
                        title="Click to view escalation details"
                    >
                        <div className="flex items-center justify-between">
                            <span className={cn(
                                "text-[9px] uppercase font-black tracking-widest flex items-center gap-1",
                                insights!.criticalEscalations > 0 ? "text-red-500" : "text-orange-500/70"
                            )}>
                                <AlertTriangle className="w-3 h-3" />
                                {insights!.openEscalations} Open Escalation{insights!.openEscalations > 1 ? 's' : ''}
                            </span>
                            {insights!.criticalEscalations > 0 && (
                                <Badge variant="destructive" className="text-[8px] h-4 px-1.5 animate-pulse">
                                    {insights!.criticalEscalations} Critical
                                </Badge>
                            )}
                        </div>
                        {/* Recent escalation titles */}
                        <div className="mt-1.5 space-y-0.5">
                            {insights!.escalations.slice(0, 2).map(esc => (
                                <div key={esc.id} className="flex items-center gap-1.5 text-[9px]">
                                    <div className={cn(
                                        "w-1.5 h-1.5 rounded-full shrink-0",
                                        esc.severity === 'critical' ? "bg-red-500" : esc.severity === 'high' ? "bg-orange-500" : "bg-yellow-500"
                                    )} />
                                    <span className="text-muted-foreground truncate">{esc.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Expenses (Compact) — only if no insights panels to save space */}
                {!hasPhases && !hasMilestones && (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                        <div className="flex flex-col">
                            <span className="text-[8px] uppercase font-bold tracking-wider text-red-500/70">Total Expenses</span>
                            <span className="text-base font-bold text-red-500 font-mono tracking-tighter tabular-nums">
                                ₹{(project.current_spend || 0).toLocaleString()}
                            </span>
                        </div>
                        <div className="p-1 px-1.5 bg-red-500/10 rounded">
                            <ArrowRight className="w-3.5 h-3.5 text-red-500" />
                        </div>
                    </div>
                )}

                {/* Team + Quick Stats Row */}
                <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                        {[project.manager, project.engineer].map((person, i) => (
                            <div key={i} className={cn("w-7 h-7 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold shadow-sm transition-transform hover:scale-110 hover:z-10 bg-background", i === 0 ? "text-primary z-10" : "text-blue-500 z-0")} title={person?.name || 'Unassigned'}>
                                {person?.name ? person.name.charAt(0) : '?'}
                            </div>
                        ))}
                    </div>

                    {/* Compact Insights Summary */}
                    <div className="flex items-center gap-2">
                        {hasPhases && (
                            <div className="flex items-center gap-1 text-[9px] font-bold text-primary/70" title={`${insights!.avgPhaseCompletion}% avg phase completion`}>
                                <TrendingUp className="w-3 h-3" />
                                {insights!.avgPhaseCompletion}%
                            </div>
                        )}
                        {totalEsc > 0 && !hasEscalations && (
                            <div className={cn(
                                "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border",
                                criticalEsc > 0
                                    ? "bg-destructive/10 text-destructive border-destructive/20"
                                    : "bg-orange-500/10 text-orange-600 border-orange-500/20"
                            )}>
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {totalEsc}
                            </div>
                        )}
                    </div>
                </div>

                {/* JV Commitments Preview */}
                {project.jv_commitments && (
                    <div className="mt-auto pt-1">
                        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-2 text-[10px] text-yellow-600/90 leading-tight line-clamp-2">
                            <span className="font-bold text-yellow-700/80 mr-1">JV:</span>
                            {project.jv_commitments}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer / Actions */}
            <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between relative z-10">
                <span className="text-[10px] text-muted-foreground font-medium">{project.project_type || project.vertical}</span>

                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {canEdit && (
                        <Link to={`/projects/${project.id}/edit`}>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded hover:bg-background/80 hover:text-primary">
                                <Edit className="w-3 h-3" />
                            </Button>
                        </Link>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[9px] gap-1 rounded hover:bg-primary/10 hover:text-primary px-2"
                        onClick={() => onClick(project)}
                    >
                        View <ArrowRight className="w-3 h-3" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
