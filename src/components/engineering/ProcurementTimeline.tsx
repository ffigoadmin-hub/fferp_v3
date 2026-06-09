import { useProcurementTimeline, TimelineEntry } from '@/hooks/useProcurementTimeline';
import { Clock, Package, CheckCircle, Truck, FileText, User, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface ProcurementTimelineProps {
  materialRequestId?: string;
  vendorWorkRequestId?: string;
  className?: string;
}

const actionIcons: Record<string, React.ElementType> = {
  'request_created': FileText,
  'quote_added': Package,
  'quote_selected': CheckCircle,
  'boi_approved': CheckCircle,
  'admin_approved': CheckCircle,
  'ceo_approved': CheckCircle,
  'payment_created': CreditCard,
  'status_updated': Clock,
  'ordered': Truck,
  'shipped': Truck,
  'delivered': CheckCircle,
  'vendor_aligned': User,
  'wo_created': FileText,
};

const actionColors: Record<string, string> = {
  'request_created': 'bg-blue-500/20 text-blue-400',
  'quote_added': 'bg-violet-500/20 text-violet-400',
  'quote_selected': 'bg-emerald-500/20 text-emerald-400',
  'boi_approved': 'bg-green-500/20 text-green-400',
  'admin_approved': 'bg-green-500/20 text-green-400',
  'ceo_approved': 'bg-green-500/20 text-green-400',
  'payment_created': 'bg-amber-500/20 text-amber-400',
  'status_updated': 'bg-slate-500/20 text-slate-400',
  'ordered': 'bg-indigo-500/20 text-indigo-400',
  'shipped': 'bg-indigo-500/20 text-indigo-400',
  'delivered': 'bg-green-500/20 text-green-400',
  'vendor_aligned': 'bg-purple-500/20 text-purple-400',
  'wo_created': 'bg-blue-500/20 text-blue-400',
};

function formatActionLabel(action: string): string {
  return action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function ProcurementTimeline({ materialRequestId, vendorWorkRequestId, className }: ProcurementTimelineProps) {
  const { entries, isLoading } = useProcurementTimeline(materialRequestId, vendorWorkRequestId);

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={cn("text-center py-6 text-muted-foreground text-sm", className)}>
        No timeline entries yet
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {entries.map((entry, index) => {
        const Icon = actionIcons[entry.action] || Clock;
        const colorClass = actionColors[entry.action] || 'bg-muted text-muted-foreground';
        const isLast = index === entries.length - 1;

        return (
          <div key={entry.id} className="flex gap-3">
            <div className="relative flex flex-col items-center">
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", colorClass)}>
                <Icon className="w-4 h-4" />
              </div>
              {!isLast && (
                <div className="w-0.5 flex-1 bg-border mt-1" />
              )}
            </div>
            <div className="flex-1 pb-4">
              <p className="font-medium text-sm">{formatActionLabel(entry.action)}</p>
              <p className="text-xs text-muted-foreground">
                {entry.performed_by_name || 'System'} • {format(new Date(entry.created_at), 'dd MMM yyyy, HH:mm')}
              </p>
              {entry.details && typeof entry.details === 'object' && (
                <div className="mt-1 p-2 rounded bg-muted/50 text-xs">
                  {Object.entries(entry.details).map(([key, value]) => (
                    <p key={key}>
                      <span className="text-muted-foreground">{key}:</span> {String(value)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
