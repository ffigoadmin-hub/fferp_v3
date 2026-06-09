
import { IndianRupee, Truck, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ProcurementStatsGridProps {
    stats: {
        totalValue: number;
        ordered: number;
        inTransit: number;
        delivered: number;
        delayed: number;
    };
}

export function ProcurementStatsGrid({ stats }: ProcurementStatsGridProps) {
    const metrics = [
        {
            label: 'Active Value',
            value: `₹${(stats.totalValue / 100000).toFixed(1)}L`,
            subtext: 'In Pipeline',
            icon: IndianRupee,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20',
            shadow: 'shadow-[0_0_20px_rgba(16,185,129,0.1)]',
        },
        {
            label: 'In Transit',
            value: stats.inTransit,
            subtext: 'Shipments',
            icon: Truck,
            color: 'text-cyan-400',
            bg: 'bg-cyan-500/10',
            border: 'border-cyan-500/20',
            shadow: 'shadow-[0_0_20px_rgba(6,182,212,0.1)]',
        },
        {
            label: 'Critical Delays',
            value: stats.delayed,
            subtext: 'Action Required',
            icon: AlertTriangle,
            color: 'text-red-400',
            bg: 'bg-red-500/10',
            border: 'border-red-500/20',
            shadow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
            animate: true
        },
        {
            label: 'Avg Lead Time',
            value: '4.2 Days',
            subtext: '-12% vs Last Month',
            icon: Clock,
            color: 'text-violet-400',
            bg: 'bg-violet-500/10',
            border: 'border-violet-500/20',
            shadow: 'shadow-[0_0_20px_rgba(139,92,246,0.1)]',
        }
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {metrics.map((metric, idx) => (
                <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={cn(
                        "relative overflow-hidden rounded-xl p-5",
                        "bg-black/40 backdrop-blur-xl border",
                        "group hover:scale-[1.02] transition-all duration-300",
                        metric.border,
                        "hover:border-opacity-50"
                    )}
                >
                    {/* Ambient Glow */}
                    <div className={cn(
                        "absolute -right-10 -top-10 w-32 h-32 rounded-full blur-[50px] transition-opacity opacity-20 group-hover:opacity-40",
                        metric.bg.replace('/10', '/30')
                    )} />

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className={cn("p-2 rounded-lg", metric.bg)}>
                                <metric.icon className={cn("w-5 h-5", metric.color)} />
                            </div>
                            {metric.label === 'Active Value' && (
                                <div className="flex items-center text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    <TrendingUp className="w-3 h-3 mr-1" />
                                    +8.4%
                                </div>
                            )}
                        </div>

                        <div>
                            <h3 className={cn("text-3xl font-black tracking-tight", metric.color)}>
                                {metric.value}
                            </h3>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">
                                {metric.label}
                            </p>
                            {metric.subtext && (
                                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                    {metric.subtext}
                                </p>
                            )}
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
