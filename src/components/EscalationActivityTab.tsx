import { useState, useEffect, Fragment } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Circle, CheckCircle, XCircle, Mic, User, Clock, ArrowUpRight, MessageSquare } from 'lucide-react';
import { WorkflowTimelineEntry } from '@/types/workflows';
import { AudioWaveform } from './AudioWaveform';

interface EscalationActivityTabProps {
  timeline: WorkflowTimelineEntry[];
  isLoading: boolean;
}

// Helper to render clickable links in text
const renderClickableText = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80"
          onClick={(e) => e.stopPropagation()}
        >
          {part.length > 30 ? part.slice(0, 30) + '...' : part}
        </a>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
};

// Get action details
const getActionDetails = (action: string) => {
  const actionMap: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    'created': { label: 'Ticket Created', icon: <Circle className="w-3 h-3 fill-current" />, color: 'bg-primary' },
    'status_acknowledged': { label: 'Acknowledged', icon: <CheckCircle className="w-3 h-3" />, color: 'bg-green-500' },
    'acknowledged': { label: 'Acknowledged', icon: <CheckCircle className="w-3 h-3" />, color: 'bg-green-500' },
    'ack_late': { label: 'Acknowledged (Late)', icon: <Clock className="w-3 h-3" />, color: 'bg-yellow-500' },
    'forwarded_to_gm': { label: 'Forwarded to GM', icon: <ArrowUpRight className="w-3 h-3" />, color: 'bg-orange-500' },
    'gm_acknowledged': { label: 'GM Acknowledged', icon: <CheckCircle className="w-3 h-3" />, color: 'bg-blue-500' },
    'pushed_to_ceo': { label: 'Pushed to CEO', icon: <ArrowUpRight className="w-3 h-3" />, color: 'bg-red-500' },
    'resolved': { label: 'Resolved', icon: <CheckCircle className="w-3 h-3" />, color: 'bg-green-600' },
    'status_resolved': { label: 'Resolved', icon: <CheckCircle className="w-3 h-3" />, color: 'bg-green-600' },
    'breached': { label: 'SLA Breached', icon: <XCircle className="w-3 h-3" />, color: 'bg-destructive' },
    'blast_triggered': { label: 'Blast Triggered', icon: <XCircle className="w-3 h-3" />, color: 'bg-destructive' },
    'comment_added': { label: 'Comment Added', icon: <MessageSquare className="w-3 h-3" />, color: 'bg-muted-foreground' },
    'voice_comment': { label: 'Voice Comment', icon: <Mic className="w-3 h-3" />, color: 'bg-purple-500' },
  };

  const key = Object.keys(actionMap).find(k => action.toLowerCase().includes(k));
  return key ? actionMap[key] : { label: action.replace(/_/g, ' '), icon: <Circle className="w-3 h-3" />, color: 'bg-muted-foreground' };
};

export function EscalationActivityTab({ timeline, isLoading }: EscalationActivityTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Clock className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-sm">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-0">
        {timeline.map((entry, index) => {
          const actionDetails = getActionDetails(entry.action);
          const isLast = index === timeline.length - 1;
          const isVoiceComment = entry.details?.audioUrl || entry.details?.audio_url;

          return (
            <div key={entry.id} className="relative pb-6 last:pb-0">
              {/* Connector line */}
              {!isLast && (
                <div className="absolute left-4 top-8 w-0.5 h-full bg-border -translate-x-1/2" />
              )}

              <div className="flex gap-4">
                {/* Icon node */}
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white",
                  actionDetails.color
                )}>
                  {actionDetails.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-sm">
                      {actionDetails.label}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(entry.created_at), 'MMM dd, hh:mm a')}
                    </span>
                  </div>

                  {/* Who performed */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <User className="w-3 h-3" />
                    <span className="font-medium">
                      {entry.performed_by_name || 'System'}
                    </span>
                    {entry.performed_by_role && (
                      <Badge variant="outline" className="text-xs py-0 px-1">
                        {entry.performed_by_role}
                      </Badge>
                    )}
                  </div>

                  {/* Details */}
                  {entry.details && (
                    <div className="p-3 rounded-lg bg-muted/50 border text-sm space-y-2">
                      {/* Voice comment audio player */}
                      {isVoiceComment && (
                        <AudioWaveform 
                          src={entry.details.audioUrl || entry.details.audio_url} 
                          compact
                          className="bg-background"
                        />
                      )}

                      {/* Text comment */}
                      {entry.details.comment && (
                        <p className="text-foreground">
                          {renderClickableText(entry.details.comment)}
                        </p>
                      )}

                      {/* Resolution text */}
                      {entry.details.resolution_text && (
                        <p className="text-foreground">
                          <span className="font-medium">Resolution: </span>
                          {renderClickableText(entry.details.resolution_text)}
                        </p>
                      )}

                      {/* Proof URL */}
                      {entry.details.proof_url && (
                        <a 
                          href={entry.details.proof_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          📎 View Proof
                        </a>
                      )}

                      {/* Late acknowledgment indicator */}
                      {entry.details.ack_late && (
                        <Badge variant="destructive" className="text-xs">
                          Acknowledged Late
                        </Badge>
                      )}

                      {/* Additional metadata */}
                      {entry.details.forwarded_by && (
                        <p className="text-xs text-muted-foreground">
                          Forwarded by: {entry.details.forwarded_by}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
