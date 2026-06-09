import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalyticsMetricCardProps {
    title: string;
    value: string | number;
    subValue?: string;
    trend?: {
        value: number;
        isPositive: boolean;
        label: string;
    };
    icon: LucideIcon;
    colorScheme: 'blue' | 'purple' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate' | 'primary';
    onClick?: () => void;
    className?: string;
}

// Using theme-aware colors instead of hardcoded tailwind colors
const colorStyles = {
    primary: {
        bg: 'bg-primary/10',
        text: 'text-primary',
        border: 'border-primary/20',
        iconBg: 'bg-primary',
        gradient: 'from-primary/5 to-primary/10',
        shadow: 'shadow-primary/5'
    },
    blue: {
        bg: 'bg-blue-500/10',
        text: 'text-blue-500',
        border: 'border-blue-500/20',
        iconBg: 'bg-blue-500',
        gradient: 'from-blue-500/5 to-blue-500/10',
        shadow: 'shadow-blue-500/5'
    },
    purple: {
        bg: 'bg-purple-500/10',
        text: 'text-purple-500',
        border: 'border-purple-500/20',
        iconBg: 'bg-purple-500',
        gradient: 'from-purple-500/5 to-purple-500/10',
        shadow: 'shadow-purple-500/5'
    },
    emerald: {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-500',
        border: 'border-emerald-500/20',
        iconBg: 'bg-emerald-500',
        gradient: 'from-emerald-500/5 to-emerald-500/10',
        shadow: 'shadow-emerald-500/5'
    },
    amber: {
        bg: 'bg-amber-500/10',
        text: 'text-amber-500',
        border: 'border-amber-500/20',
        iconBg: 'bg-amber-500',
        gradient: 'from-amber-500/5 to-amber-500/10',
        shadow: 'shadow-amber-500/5'
    },
    rose: {
        bg: 'bg-rose-500/10',
        text: 'text-rose-500',
        border: 'border-rose-500/20',
        iconBg: 'bg-rose-500',
        gradient: 'from-rose-500/5 to-rose-500/10',
        shadow: 'shadow-rose-500/5'
    },
    indigo: {
        bg: 'bg-indigo-500/10',
        text: 'text-indigo-500',
        border: 'border-indigo-500/20',
        iconBg: 'bg-indigo-500',
        gradient: 'from-indigo-500/5 to-indigo-500/10',
        shadow: 'shadow-indigo-500/5'
    },
    slate: {
        bg: 'bg-slate-500/10',
        text: 'text-slate-500',
        border: 'border-slate-500/20',
        iconBg: 'bg-slate-500',
        gradient: 'from-slate-500/5 to-slate-500/10',
        shadow: 'shadow-slate-500/5'
    }
};

export function AnalyticsMetricCard({
    title,
    value,
    subValue,
    trend,
    icon: Icon,
    colorScheme,
    onClick,
    className
}: AnalyticsMetricCardProps) {
    const styles = colorStyles[colorScheme] || colorStyles.primary;

    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={cn("h-full", className)}
            onClick={onClick}
        >
            <Card className={cn(
                "h-full overflow-hidden border bg-card/40 backdrop-blur-md relative group",
                "transition-all duration-300 hover:shadow-xl hover:bg-card/60",
                styles.border,
                styles.shadow
            )}>
                {/* Gradient Background */}
                <div className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity group-hover:opacity-70",
                    styles.gradient
                )} />

                {/* Glow Effect */}
                <div className={cn(
                    "absolute -inset-1 opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-2xl",
                    styles.bg
                )} />

                <CardContent className="p-6 relative z-10">
                    {/* Decorative Background Icon */}
                    <div className="absolute -right-6 -bottom-6 opacity-[0.03] rotate-12 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
                        <Icon className={cn("w-32 h-32", styles.text)} />
                    </div>

                    <div className="flex items-start justify-between mb-4">
                        <div className={cn(
                            "p-3 rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3",
                            styles.bg,
                            "border border-white/5"
                        )}>
                            <Icon className={cn("w-6 h-6", styles.text)} />
                        </div>
                        {trend && (
                            <div className={cn(
                                "flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-md border",
                                trend.isPositive
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                            )}>
                                <span className="text-lg leading-none">{trend.isPositive ? '↗' : '↘'}</span>
                                <span>{Math.abs(trend.value)}% {trend.label}</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1 relative z-10">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest opacity-80">{title}</h3>
                        <div className="flex items-baseline gap-2">
                            <span className={cn(
                                "text-3xl font-black tracking-tight drop-shadow-sm",
                                "text-foreground" // Use foreground color for value for better contrast
                            )}>
                                {value}
                            </span>
                            {subValue && (
                                <span className="text-sm text-muted-foreground font-medium">
                                    {subValue}
                                </span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
