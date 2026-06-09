import { motion } from 'framer-motion';
import {
    Check, X, Clock, Package, Truck, ShieldCheck, FileText,
    Users, Target, Layers, Hammer, AlertTriangle, Sparkles,
    FolderKanban, Activity, PlayCircle, CheckCircle2, Loader2,
    RefreshCw, ShoppingCart, Zap
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import type { ProjectTimelineEntry } from '@/hooks/useProjectTimeline';

/** Action → display config */
const ACTION_CONFIG: Record<string, {
    icon: React.ElementType;
    color: string;
    bg: string;
    ring: string;
    label: string;
    category: 'lifecycle' | 'approval' | 'material' | 'phase' | 'team' | 'other';
}> = {
    // Lifecycle milestones
    project_created: { icon: FolderKanban, color: 'text-blue-400', bg: 'bg-blue-500/20', ring: 'ring-blue-500/30', label: 'Project Created', category: 'lifecycle' },
    stage_new_deal: { icon: Sparkles, color: 'text-emerald-400', bg: 'bg-emerald-500/20', ring: 'ring-emerald-500/30', label: 'New Deal', category: 'lifecycle' },
    stage_engineering_assigned: { icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/20', ring: 'ring-blue-500/30', label: 'Engineering Assigned', category: 'lifecycle' },
    stage_boq_submitted: { icon: FileText, color: 'text-indigo-400', bg: 'bg-indigo-500/20', ring: 'ring-indigo-500/30', label: 'BOQ Submitted', category: 'lifecycle' },
    stage_boq_approved: { icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-500/20', ring: 'ring-emerald-500/30', label: 'BOQ Approved', category: 'lifecycle' },
    stage_sourcing: { icon: ShoppingCart, color: 'text-amber-400', bg: 'bg-amber-500/20', ring: 'ring-amber-500/30', label: 'Sourcing Started', category: 'lifecycle' },
    stage_execution: { icon: Hammer, color: 'text-emerald-400', bg: 'bg-emerald-500/20', ring: 'ring-emerald-500/30', label: 'Execution Started', category: 'lifecycle' },
    stage_completed: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/20', ring: 'ring-green-500/30', label: 'Project Completed', category: 'lifecycle' },

    // Approval events
    boq_submitted: { icon: FileText, color: 'text-indigo-400', bg: 'bg-indigo-500/20', ring: 'ring-indigo-500/30', label: 'BOQ Submitted', category: 'approval' },
    boq_approved_smo: { icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/20', ring: 'ring-emerald-500/30', label: 'L1 Approval (SMO)', category: 'approval' },
    boq_approved_gmo: { icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/20', ring: 'ring-emerald-500/30', label: 'L2 Approval (GMO)', category: 'approval' },
    boq_rejected: { icon: X, color: 'text-red-400', bg: 'bg-red-500/20', ring: 'ring-red-500/30', label: 'BOQ Rejected', category: 'approval' },

    // Team events
    team_assigned: { icon: Users, color: 'text-sky-400', bg: 'bg-sky-500/20', ring: 'ring-sky-500/30', label: 'Team Assigned', category: 'team' },

    // Material requests
    material_request_created: { icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/20', ring: 'ring-blue-500/30', label: 'Material Requested', category: 'material' },

    // Phase events
    phase_created: { icon: Layers, color: 'text-violet-400', bg: 'bg-violet-500/20', ring: 'ring-violet-500/30', label: 'Phase Created', category: 'phase' },
    phase_started: { icon: PlayCircle, color: 'text-blue-400', bg: 'bg-blue-500/20', ring: 'ring-blue-500/30', label: 'Phase Started', category: 'phase' },
    phase_completed: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/20', ring: 'ring-green-500/30', label: 'Phase Completed', category: 'phase' },

    // Incident events
    client_escalation_created: { icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/20', ring: 'ring-rose-500/30', label: 'Escalation Reported', category: 'approval' },
    client_escalation_resolved: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/20', ring: 'ring-emerald-500/30', label: 'Escalation Resolved', category: 'approval' },
    hourly_critical_created: { icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/20', ring: 'ring-amber-500/30', label: 'Critical Issue', category: 'approval' },
    hourly_critical_resolved: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/20', ring: 'ring-emerald-500/30', label: 'Critical Resolved', category: 'approval' },

    // Work Order Approval stages
    work_order_created: { icon: Hammer, color: 'text-blue-400', bg: 'bg-blue-500/20', ring: 'ring-blue-500/30', label: 'Work Order Created', category: 'approval' },
    wo_approved_smo: { icon: ShieldCheck, color: 'text-blue-400', bg: 'bg-blue-500/20', ring: 'ring-blue-500/30', label: 'WO L1 Approval (SMO)', category: 'approval' },
    wo_approved_gmo: { icon: ShieldCheck, color: 'text-indigo-400', bg: 'bg-indigo-500/20', ring: 'ring-indigo-500/30', label: 'WO L2 Approval (GMO)', category: 'approval' },
    wo_approved_gm: { icon: ShieldCheck, color: 'text-violet-400', bg: 'bg-violet-500/20', ring: 'ring-violet-500/30', label: 'WO L3 Approval (GM)', category: 'approval' },
    wo_approved_admin: { icon: ShieldCheck, color: 'text-sky-400', bg: 'bg-sky-500/20', ring: 'ring-sky-500/30', label: 'WO L4 Approval (Admin)', category: 'approval' },
    wo_approved_ceo: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/20', ring: 'ring-emerald-500/30', label: 'WO Final Approval (CEO)', category: 'approval' },
};

const CATEGORY_COLORS: Record<string, string> = {
    lifecycle: 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]',
    approval: 'border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.05)]',
    material: 'border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.05)]',
    phase: 'border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.05)]',
    team: 'border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.05)]',
    other: 'border-muted-foreground/30',
};

function getConfig(action: string) {
    return ACTION_CONFIG[action] || {
        icon: Activity,
        color: 'text-muted-foreground',
        bg: 'bg-muted/30',
        ring: 'ring-muted-foreground/20',
        label: action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        category: 'other' as const,
    };
}

/** Get a human-readable description for an event */
function getDescription(entry: ProjectTimelineEntry): string | null {
    const d = entry.details;
    switch (entry.action) {
        case 'project_created':
            return d?.client_name ? `Client: ${d.client_name}` : null;
        case 'team_assigned':
            return d?.engineer_name ? `Engineer: ${d.engineer_name}` : null;
        case 'boq_rejected':
            return d?.reason || d?.rejection_reason || 'Revision requested';
        case 'material_request_created': {
            const parts: string[] = [];
            if (d?.items_count) parts.push(`${d.items_count} items`);
            if (d?.items_summary) parts.push(d.items_summary);
            if (d?.urgency && d.urgency !== 'normal') parts.push(`⚡ ${d.urgency}`);
            return parts.join(' · ') || null;
        }
        case 'phase_created':
        case 'phase_started':
        case 'phase_completed':
            return d?.phase_name || null;
        case 'client_escalation_created':
        case 'client_escalation_resolved':
            return `Ticket #${d?.ticket_no}: ${d?.title}`;
        case 'hourly_critical_created':
        case 'hourly_critical_resolved':
            return `Critical #${d?.ticket_no}: ${d?.title}`;
        case 'work_order_created':
        case 'wo_approved_smo':
        case 'wo_approved_gmo':
        case 'wo_approved_gm':
        case 'wo_approved_admin':
        case 'wo_approved_ceo':
            return `WO #${d?.wo_no}: ${d?.title}`;
        default:
            if (d?.label) return d.label;
            if (d?.remark) return d.remark;
            if (d?.notes) return d.notes;
            return null;
    }
}

interface ProjectActivityTimelineProps {
    entries: ProjectTimelineEntry[];
    isLoading: boolean;
    onRefresh?: () => void;
}

export function ProjectActivityTimeline({ entries, isLoading, onRefresh }: ProjectActivityTimelineProps) {
    if (isLoading) {
        return (
            <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
                <CardContent className="py-12">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Loading timeline...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (entries.length === 0) {
        return (
            <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
                <CardHeader className="py-4 px-5 border-b border-border/30 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" /> Project Timeline
                    </CardTitle>
                    {onRefresh && (
                        <Button variant="ghost" size="sm" onClick={onRefresh} className="gap-2 h-8">
                            <RefreshCw className="w-3.5 h-3.5" /> Refresh
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="py-12">
                    <p className="text-center text-muted-foreground text-sm">
                        No activity recorded yet. Events will appear here as the project progresses.
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Group entries by date
    const groups: Record<string, ProjectTimelineEntry[]> = {};
    for (const entry of entries) {
        const dateKey = format(new Date(entry.created_at), 'yyyy-MM-dd');
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(entry);
    }

    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    return (
        <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
            <CardHeader className="py-4 px-5 border-b border-border/30 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> Project Timeline
                    <Badge variant="secondary" className="ml-2 text-xs">{entries.length} events</Badge>
                </CardTitle>
                {onRefresh && (
                    <Button variant="ghost" size="sm" onClick={onRefresh} className="gap-2 h-8">
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </Button>
                )}
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                    <div className="p-5 space-y-6">
                        {sortedDates.map((dateKey, dateIdx) => {
                            const dateEntries = groups[dateKey];
                            const displayDate = format(new Date(dateKey), 'EEE, dd MMM yyyy');
                            const isToday = dateKey === format(new Date(), 'yyyy-MM-dd');

                            return (
                                <div key={dateKey}>
                                    {/* Date Header */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={cn(
                                            "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                                            isToday
                                                ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                                                : "bg-muted/40 text-muted-foreground"
                                        )}>
                                            {isToday ? 'Today' : displayDate}
                                        </div>
                                        <div className="flex-1 h-px bg-border/30" />
                                    </div>

                                    {/* Events for this date */}
                                    <div className="relative pl-8">
                                        {/* Vertical line */}
                                        <div className="absolute left-[15px] top-0 bottom-0 w-px bg-gradient-to-b from-border/60 via-border/30 to-transparent" />

                                        {dateEntries.map((entry, idx) => {
                                            const config = getConfig(entry.action);
                                            const Icon = config.icon;
                                            const description = getDescription(entry);
                                            const timeStr = format(new Date(entry.created_at), 'h:mm a');
                                            const relativeTime = formatDistanceToNow(new Date(entry.created_at), { addSuffix: true });

                                            return (
                                                <motion.div
                                                    key={entry.id}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: (dateIdx * dateEntries.length + idx) * 0.03, duration: 0.2 }}
                                                    className="relative mb-4 last:mb-0"
                                                >
                                                    {/* Icon dot on the timeline */}
                                                    <div className={cn(
                                                        "absolute -left-8 top-1 w-[30px] h-[30px] rounded-full flex items-center justify-center ring-2 ring-background",
                                                        config.bg
                                                    )}>
                                                        <Icon className={cn("w-3.5 h-3.5", config.color)} />
                                                    </div>

                                                    {/* Event card */}
                                                    <div className={cn(
                                                        "ml-2 p-3 rounded-xl border bg-card/50 hover:bg-muted/20 transition-colors",
                                                        CATEGORY_COLORS[config.category] || CATEGORY_COLORS.other
                                                    )}>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className={cn("text-sm font-semibold", config.color)}>
                                                                        {config.label}
                                                                    </span>
                                                                    {entry.performed_by_role && entry.performed_by_role !== 'system' && (
                                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-muted-foreground/30 text-muted-foreground">
                                                                            {entry.performed_by_role.toUpperCase()}
                                                                        </Badge>
                                                                    )}
                                                                    {entry.source === 'lifecycle' && (
                                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-500/30 text-emerald-400">
                                                                            MILESTONE
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                {description && (
                                                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                                        {description}
                                                                    </p>
                                                                )}
                                                                {entry.performed_by_name && (
                                                                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                                                                        by {entry.performed_by_name}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <p className="text-[11px] text-muted-foreground font-mono">{timeStr}</p>
                                                                <p className="text-[10px] text-muted-foreground/60">{relativeTime}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
