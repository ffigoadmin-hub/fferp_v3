import { TrendingUp, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CEOOperationalPulseProps {
  isLoading?: boolean;
}

export function CEOOperationalPulse({ isLoading }: CEOOperationalPulseProps) {
  return (
    <div className="flex items-center justify-between bg-black/40 backdrop-blur-xl border border-white/10 p-4 rounded-xl hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-all duration-300">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <TrendingUp className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Operational Pulse</h2>
          <p className="text-xs text-muted-foreground">Real-time escalation and critical ticket intelligence</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="bg-status-live/10 border-status-live/30 text-status-live gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-status-live animate-pulse" />
          Live Feed
        </Badge>
        <span className="text-sm font-mono text-muted-foreground tabular-nums">
          {new Date().toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
