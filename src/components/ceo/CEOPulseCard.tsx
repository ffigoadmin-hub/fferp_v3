import { ReactNode } from 'react';
import { ArrowRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PulseMetric {
  value: number;
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

interface CEOPulseCardProps {
  title: string;
  icon: LucideIcon;
  metrics: PulseMetric[];
  onClick: () => void;
  variant: 'primary' | 'destructive';
}

export function CEOPulseCard({ title, icon: Icon, metrics, onClick, variant }: CEOPulseCardProps) {
  const isDestructive = variant === 'destructive';

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 cursor-pointer transition-all duration-300",
        "bg-black/40 backdrop-blur-xl border shadow-lg hover:shadow-2xl",
        "group hover:scale-[1.01]",
        isDestructive
          ? "border-destructive/20 hover:border-destructive/50 hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]"
          : "border-primary/20 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(124,58,237,0.15)]"
      )}
    >
      {/* Gradient Overlay */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
        isDestructive
          ? "bg-gradient-to-br from-destructive/5 to-transparent"
          : "bg-gradient-to-br from-primary/5 to-transparent"
      )} />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "p-2 rounded-lg",
            isDestructive ? "bg-destructive/10" : "bg-primary/10"
          )}>
            <Icon className={cn(
              "w-4 h-4",
              isDestructive ? "text-destructive" : "text-primary"
            )} />
          </div>
          <h3 className={cn(
            "font-bold uppercase tracking-wider text-xs",
            isDestructive ? "text-destructive" : "text-primary"
          )}>
            {title}
          </h3>
        </div>
        <ArrowRight className={cn(
          "w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 group-hover:translate-x-1",
          isDestructive ? "text-destructive" : "text-primary"
        )} />
      </div>

      {/* Metrics Grid */}
      <div className="relative grid grid-cols-3 gap-3">
        {metrics.map((metric, idx) => (
          <div
            key={idx}
            className={cn(
              "p-3 rounded-xl border transition-colors duration-200",
              metric.bgClass,
              metric.borderClass,
              "hover:brightness-110"
            )}
          >
            <p className={cn("text-2xl font-black mb-0.5", metric.colorClass)}>
              {metric.value}
            </p>
            <p className={cn(
              "text-[9px] uppercase font-bold tracking-tight opacity-70",
              metric.colorClass
            )}>
              {metric.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
