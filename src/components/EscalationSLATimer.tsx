import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle } from 'lucide-react';

interface EscalationSLATimerProps {
  deadline: string;
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
}

type SLAStatus = 'green' | 'yellow' | 'red' | 'breached';

function getTimeRemaining(deadline: string): number {
  const deadlineTime = new Date(deadline).getTime();
  const now = Date.now();
  return Math.max(0, deadlineTime - now);
}

function getSLAStatus(deadline: string): SLAStatus {
  const remaining = getTimeRemaining(deadline);
  const hours = remaining / (1000 * 60 * 60);
  
  if (remaining === 0) return 'breached';
  if (hours < 2) return 'red';
  if (hours < 4) return 'yellow';
  return 'green';
}

function formatTime(ms: number): string {
  if (ms <= 0) return '00:00:00';
  
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function EscalationSLATimer({ 
  deadline, 
  className, 
  showIcon = true,
  compact = false 
}: EscalationSLATimerProps) {
  const [remaining, setRemaining] = useState(getTimeRemaining(deadline));
  const [status, setStatus] = useState<SLAStatus>(getSLAStatus(deadline));

  useEffect(() => {
    const updateTimer = () => {
      const rem = getTimeRemaining(deadline);
      setRemaining(rem);
      setStatus(getSLAStatus(deadline));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const statusConfig: Record<SLAStatus, { 
    bg: string; 
    text: string; 
    border: string;
    label: string;
  }> = {
    green: { 
      bg: 'bg-green-500/10', 
      text: 'text-green-600', 
      border: 'border-green-500/30',
      label: 'Safe'
    },
    yellow: { 
      bg: 'bg-yellow-500/10', 
      text: 'text-yellow-600', 
      border: 'border-yellow-500/30',
      label: 'Warning'
    },
    red: { 
      bg: 'bg-red-500/10', 
      text: 'text-red-600 animate-pulse', 
      border: 'border-red-500/30',
      label: 'Critical'
    },
    breached: { 
      bg: 'bg-black/10 dark:bg-white/10', 
      text: 'text-black dark:text-white animate-pulse font-bold', 
      border: 'border-black/30 dark:border-white/30',
      label: 'BREACHED'
    },
  };

  const config = statusConfig[status];

  if (compact) {
    return (
      <div className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono",
        config.bg,
        config.text,
        className
      )}>
        {showIcon && (status === 'breached' ? (
          <AlertTriangle className="w-3 h-3" />
        ) : (
          <Clock className="w-3 h-3" />
        ))}
        {status === 'breached' ? 'BREACHED' : formatTime(remaining)}
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col items-center gap-1 p-2 rounded-lg border",
      config.bg,
      config.border,
      className
    )}>
      <div className="flex items-center gap-1.5">
        {showIcon && (status === 'breached' ? (
          <AlertTriangle className={cn("w-4 h-4", config.text)} />
        ) : (
          <Clock className={cn("w-4 h-4", config.text)} />
        ))}
        <span className={cn("text-xs font-medium", config.text)}>
          {config.label}
        </span>
      </div>
      <span className={cn("font-mono text-lg font-bold tabular-nums", config.text)}>
        {status === 'breached' ? 'BREACHED' : formatTime(remaining)}
      </span>
    </div>
  );
}

export { getTimeRemaining, getSLAStatus, formatTime };
export type { SLAStatus };
