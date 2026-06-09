import { FolderKanban, Activity, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface StatsRibbonProps {
    totalProjects: number;
    activeProjects: number;
    criticalEscalations: number;
    upcomingProjects: number;
}

export function ProjectStatsRibbon({ totalProjects, activeProjects, criticalEscalations, upcomingProjects }: StatsRibbonProps) {
    const stats = [
        {
            label: "Total Projects",
            value: totalProjects,
            icon: FolderKanban,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
            border: "border-blue-500/20"
        },
        {
            label: "Active Operations",
            value: activeProjects,
            icon: Activity,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20"
        },
        {
            label: "Critical Issues",
            value: criticalEscalations,
            icon: AlertTriangle,
            color: "text-red-500",
            bg: "bg-red-500/10",
            border: "border-red-500/20",
            pulse: criticalEscalations > 0
        },
        {
            label: "Upcoming Pipeline",
            value: upcomingProjects,
            icon: Clock,
            color: "text-orange-500",
            bg: "bg-orange-500/10",
            border: "border-orange-500/20"
        }
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, i) => {
                const Icon = stat.icon;
                return (
                    <div key={stat.label}>
                        <Card className={cn(
                            "relative overflow-hidden border p-4 flex items-center justify-between backdrop-blur-md transition-all hover:bg-card/80",
                            stat.bg,
                            stat.border
                        )}>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <h2 className={cn("text-2xl font-bold", stat.color)}>{stat.value}</h2>
                                    {stat.pulse && (
                                        <span className="relative flex h-2 w-2 rounded-full bg-red-500"></span>
                                    )}
                                </div>
                            </div>
                            <div className={cn("p-3 rounded-xl", "bg-background/50", stat.color)}>
                                <Icon className="w-5 h-5" />
                            </div>

                            {/* Background Decoration */}
                            <div className="absolute -right-6 -bottom-6 opacity-10 rotate-12 transform scale-150 text-current pointer-events-none">
                                <Icon className={cn("w-24 h-24", stat.color)} />
                            </div>
                        </Card>
                    </div>
                )
            })}
        </div>
    );
}
