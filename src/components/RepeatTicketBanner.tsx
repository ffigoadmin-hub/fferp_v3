import { AlertTriangle, ExternalLink, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RepeatTicketBannerProps {
  isRepeat: boolean;
  repeatCount: number;
  parentTicketId?: string;
  ticketType: 'escalation' | 'critical';
  className?: string;
}

export function RepeatTicketBanner({
  isRepeat,
  repeatCount,
  parentTicketId,
  ticketType,
  className,
}: RepeatTicketBannerProps) {
  if (!isRepeat) return null;

  const ordinal = repeatCount === 1 ? '1st' : repeatCount === 2 ? '2nd' : repeatCount === 3 ? '3rd' : `${repeatCount}th`;
  
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border-2 border-orange-500/30 bg-orange-500/10",
      className
    )}>
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
          <History className="w-5 h-5 text-orange-600" />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="bg-orange-500/20 text-orange-700 border-orange-500/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Repeat Ticket
          </Badge>
          <span className="text-sm font-medium text-orange-700">
            {ordinal} occurrence for this client/issue
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          This issue was previously reported and resolved. Review the parent ticket for context.
        </p>
      </div>

      {parentTicketId && (
        <Button 
          variant="outline" 
          size="sm"
          className="flex-shrink-0 border-orange-500/30 text-orange-700 hover:bg-orange-500/10"
          onClick={() => {
            // Open parent ticket in new tab or modal
            const prefix = ticketType === 'escalation' ? 'ESC' : 'CRIT';
            console.log(`View parent ticket: ${prefix}-${parentTicketId.slice(-6)}`);
          }}
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          View Previous
        </Button>
      )}
    </div>
  );
}
