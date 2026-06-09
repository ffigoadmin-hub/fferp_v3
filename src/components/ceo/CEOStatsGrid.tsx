import { IndianRupee, AlertOctagon, FolderKanban, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CEOStatsGridProps {
  weeklySpend: string;
  adminRejections: number;
  activeProjects: number;
  pendingApprovals: number;
}

export function CEOStatsGrid({ weeklySpend, adminRejections, activeProjects, pendingApprovals }: CEOStatsGridProps) {
  const stats = [
    {
      label: 'Weekly Spend',
      value: weeklySpend,
      badge: '+12%',
      badgeClass: 'text-status-live border-status-live/30 bg-status-live/10',
      icon: IndianRupee,
      iconClass: 'text-primary',
      valueClass: 'text-foreground'
    },
    {
      label: 'Admin Rejections',
      value: adminRejections.toString(),
      badge: 'This Month',
      badgeClass: 'text-muted-foreground border-border bg-muted/50',
      icon: AlertOctagon,
      iconClass: 'text-destructive',
      valueClass: 'text-destructive'
    },
    {
      label: 'Active Projects',
      value: activeProjects.toString(),
      icon: FolderKanban,
      iconClass: 'text-primary',
      valueClass: 'text-foreground'
    },
    {
      label: 'Approvals Pending',
      value: pendingApprovals.toString(),
      icon: Clock,
      iconClass: 'text-status-pending',
      valueClass: 'text-status-pending'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, idx) => (
        <div
          key={idx}
          className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-4 hover:border-violet-500/30 hover:shadow-[0_0_15px_rgba(124,58,237,0.1)] transition-all duration-300 group"
        >
          <div className="flex items-center gap-2 mb-2">
            <stat.icon className={cn("w-3.5 h-3.5", stat.iconClass)} />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {stat.label}
            </p>
          </div>
          <div className="flex items-end gap-2">
            <p className={cn("text-2xl font-black", stat.valueClass)}>
              {stat.value}
            </p>
            {stat.badge && (
              <Badge variant="outline" className={cn("mb-1 text-[10px]", stat.badgeClass)}>
                {stat.badge}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
