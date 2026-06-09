import { cn } from '@/lib/utils';
import { Clock, CheckCircle, AlertTriangle, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SLATimerInfo } from '@/hooks/useSiteVisitSLA';

interface SLATimerBadgeProps {
  sla: SLATimerInfo;
  compact?: boolean;
}

const STATUS_CONFIG = {
  healthy: {
    bg: 'bg-emerald-950/60',
    border: 'border-emerald-800/50',
    text: 'text-emerald-300',
    badge: 'bg-emerald-900 text-emerald-200',
    icon: Clock,
    pulse: false,
    label: 'On Track',
  },
  warning: {
    bg: 'bg-yellow-950/60',
    border: 'border-yellow-800/50',
    text: 'text-yellow-300',
    badge: 'bg-yellow-900 text-yellow-200',
    icon: Clock,
    pulse: false,
    label: 'Check',
  },
  at_risk: {
    bg: 'bg-orange-950/60',
    border: 'border-orange-800/50',
    text: 'text-orange-300',
    badge: 'bg-orange-900 text-orange-200',
    icon: AlertTriangle,
    pulse: false,
    label: 'At Risk',
  },
  breached: {
    bg: 'bg-red-950/80',
    border: 'border-red-700/70',
    text: 'text-red-300',
    badge: 'bg-red-900 text-red-200',
    icon: AlertTriangle,
    pulse: true,
    label: 'BREACHED',
  },
  completed: {
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-700/40',
    text: 'text-emerald-400',
    badge: 'bg-emerald-900/50 text-emerald-300',
    icon: CheckCircle,
    pulse: false,
    label: 'Done',
  },
  completed_late: {
    bg: 'bg-zinc-900/60',
    border: 'border-zinc-700/50',
    text: 'text-zinc-400',
    badge: 'bg-zinc-800 text-zinc-400',
    icon: CheckCircle,
    pulse: false,
    label: 'Done (Late)',
  },
} as const;

export function SLATimerBadge({ sla, compact = false }: SLATimerBadgeProps) {
  const currentStatus = sla?.displayStatus || 'healthy';
  const cfg = STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.healthy;
  const Icon = cfg.icon || Clock;
  const isTerminal = currentStatus === 'completed' || currentStatus === 'completed_late';

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono',
          cfg.bg, cfg.border, cfg.text,
          cfg.pulse && 'animate-pulse',
        )}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span>SLA-{sla.sla_number}</span>
        {!isTerminal && <span className="font-bold">{sla.countdownDisplay}</span>}
        <Badge className={cn('text-[10px] px-1 py-0 h-4', cfg.badge)}>{cfg.label}</Badge>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-3 flex flex-col gap-2 transition-all',
        cfg.bg, cfg.border,
        cfg.pulse && 'animate-pulse',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', cfg.text)} />
          <span className={cn('text-xs font-semibold', cfg.text)}>
            SLA-{sla.sla_number}: {sla.sla_name}
          </span>
        </div>
        <Badge className={cn('text-[10px] font-bold', cfg.badge)}>{cfg.label}</Badge>
      </div>

      {/* Countdown or completion message */}
      {!isTerminal ? (
        <div className="flex items-baseline gap-1">
          <span className={cn('text-xl font-mono font-bold tabular-nums', cfg.text)}>
            {sla.countdownDisplay}
          </span>
          <span className="text-[10px] text-zinc-500">DD:HH:MM</span>
        </div>
      ) : (
        <div className={cn('text-xs', cfg.text)}>
          {sla.completed_at
            ? `Completed ${new Date(sla.completed_at).toLocaleDateString('en-IN')}`
            : 'Completed'}
        </div>
      )}

      {/* Progress bar */}
      {!isTerminal && (
        <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              sla.displayStatus === 'healthy' && 'bg-emerald-500',
              sla.displayStatus === 'warning' && 'bg-yellow-500',
              sla.displayStatus === 'at_risk' && 'bg-orange-500',
              sla.displayStatus === 'breached' && 'bg-red-500',
            )}
            style={{ width: `${Math.min(100, sla.percentageRemaining)}%` }}
          />
        </div>
      )}

      {/* ITC shield badge for ITC-relevant SLAs */}
      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>Deadline: {new Date(sla.deadline_at).toLocaleDateString('en-IN')}</span>
        {sla.percentageRemaining < 20 && !isTerminal && (
          <span className="text-orange-400 font-semibold">
            {Math.round(sla.percentageRemaining)}% remaining
          </span>
        )}
      </div>
    </div>
  );
}

// Summary row of all 4 SLAs (compact mode) for list cards
export function SLASummaryRow({ slas }: { slas: SLATimerInfo[] }) {
  if (!slas?.length) return null;

  const hasBreached = slas.some((s) => s.displayStatus === 'breached');

  return (
    <div className={cn('flex flex-wrap gap-1.5', hasBreached && 'animate-pulse')}>
      {slas.map((sla) => (
        <SLATimerBadge key={sla.id} sla={sla} compact />
      ))}
    </div>
  );
}
