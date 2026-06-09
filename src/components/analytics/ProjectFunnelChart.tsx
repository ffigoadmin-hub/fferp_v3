import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Filter, ChevronRight, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FunnelStage {
    id: string;
    label: string;
    count: number;
    value: number;
    color: string;
    percentage: number;
}

interface ProjectFunnelChartProps {
    stages: FunnelStage[];
    onStageClick?: (stageId: string) => void;
    activeStageId?: string | null;
}

export function ProjectFunnelChart({ stages, onStageClick, activeStageId }: ProjectFunnelChartProps) {
    const maxCount = Math.max(...stages.map(s => s.count), 1);

    return (
        <Card className="h-full border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden flex flex-col">
            <CardHeader className="pb-4 border-b border-border/10">
                <CardTitle className="flex items-center gap-2 text-lg font-bold tracking-tight">
                    <Layers className="w-5 h-5 text-primary" />
                    <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        Execution Funnel
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-5">
                    {stages.map((stage, index) => {
                        const isActive = activeStageId === stage.id;
                        const isFaded = activeStageId && !isActive;
                        const widthPercentage = Math.max((stage.count / maxCount) * 100, 5);

                        return (
                            <motion.div
                                key={stage.id}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: isFaded ? 0.3 : 1 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => onStageClick?.(stage.id)}
                                className={cn(
                                    "group cursor-pointer relative rounded-xl p-2 -mx-2 transition-all duration-300",
                                    isActive ? "bg-primary/10 shadow-sm" : "hover:bg-muted/50"
                                )}
                            >
                                {/* Connector Line */}
                                {index < stages.length - 1 && (
                                    <div className="absolute left-[34px] top-14 w-0.5 h-6 bg-border/30 group-hover:bg-primary/30 transition-colors z-0" />
                                )}

                                <div className="flex items-center gap-4 relative z-10">
                                    {/* Icon/Index Circle */}
                                    <div className={cn(
                                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-all duration-300 border border-white/5",
                                        isActive ? "scale-110 shadow-md ring-2 ring-primary/20" : "group-hover:scale-105",
                                        stage.color,
                                        "backdrop-blur-md"
                                    )}>
                                        <span className="text-lg font-bold text-white drop-shadow-md">
                                            {stage.count}
                                        </span>
                                    </div>

                                    {/* Progress Bar Container */}
                                    <div className="flex-1 space-y-2">
                                        <div className="flex justify-between items-center px-1">
                                            <span className={cn(
                                                "font-semibold text-sm transition-colors",
                                                isActive ? "text-primary" : "text-foreground group-hover:text-primary"
                                            )}>
                                                {stage.label}
                                            </span>
                                            <span className="text-xs font-mono font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md border border-border/10">
                                                ₹{(stage.value / 100000).toFixed(1)}L
                                            </span>
                                        </div>

                                        <div className="h-4 w-full bg-muted/30 rounded-full overflow-hidden relative">
                                            {/* Background pattern */}
                                            <div className="absolute inset-0 opacity-[0.05] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNCIgaGVpZ2h0PSI0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxjaXJjbGUgY3g9IjEiIGN5PSIxIiByPSIxIiBmaWxsPSIjZmZmIiIvPjwvc3ZnPg==')]" />

                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${widthPercentage}%` }}
                                                transition={{ duration: 0.8, delay: 0.1 + (index * 0.05), ease: "easeOut" }}
                                                className={cn(
                                                    "h-full rounded-full relative overflow-hidden shadow-sm",
                                                    stage.color
                                                )}
                                            >
                                                {/* Shimmer */}
                                                <div className="absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-100%] animate-[shimmer_2s_infinite]" />
                                            </motion.div>
                                        </div>
                                    </div>

                                    <div className={cn(
                                        "transition-all duration-300 transform",
                                        isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                                    )}>
                                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
