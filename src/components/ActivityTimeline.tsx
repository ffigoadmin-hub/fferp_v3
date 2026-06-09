import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import {
  LogIn, LogOut, ClipboardList, FileText, CheckCircle,
  Camera, Clock, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface TimelineEntry {
  id: string;
  timestamp: string;
  type: 'login' | 'day_plan' | 'plan' | 'report' | 'eod' | 'selfie';
  title: string;
  description?: string;
  isLate?: boolean;
  proofUrl?: string;
}

interface ActivityTimelineProps {
  userId: string;
  date: Date;
  className?: string;
}

const typeConfig = {
  login: {
    icon: LogIn,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    label: 'Check-In'
  },
  day_plan: {
    icon: ClipboardList,
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10',
    label: 'Day Plan'
  },
  plan: {
    icon: ClipboardList,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    label: 'Plan'
  },
  report: {
    icon: FileText,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    label: 'Report'
  },
  eod: {
    icon: CheckCircle,
    color: 'text-primary',
    bg: 'bg-primary/10',
    label: 'EOD'
  },
  selfie: {
    icon: Camera,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    label: 'Selfie'
  },
};

export function ActivityTimeline({ userId, date, className }: ActivityTimelineProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const dateStr = format(date, 'yyyy-MM-dd');

  useEffect(() => {
    const fetchTimeline = async () => {
      if (!userId) return;

      setIsLoading(true);
      try {
        // Fetch all activity data in parallel
        const [dayStartResult, dayPlanResult, plansResult, reportsResult, eodResult, selfiesResult] = await Promise.all([
          supabase.from('day_starts').select('submitted_at, location_zone').eq('user_id', userId).eq('date', dateStr).maybeSingle(),
          supabase.from('day_plans').select('id, tasks, expected_output, dependency, submitted_at').eq('user_id', userId).eq('date', dateStr).maybeSingle(),
          supabase.from('hourly_plans').select('id, time_slot, plan_text, submitted_at').eq('user_id', userId).eq('date', dateStr).order('time_slot'),
          supabase.from('hourly_reports').select('id, time_slot, report_text, submitted_at, is_late, delay_minutes').eq('user_id', userId).eq('date', dateStr).order('time_slot'),
          supabase.from('eod_reports').select('id, completed_work, submitted_at, completion_percentage').eq('user_id', userId).eq('date', dateStr).maybeSingle(),
          supabase.from('selfie_records').select('id, selfie_type, selfie_url, captured_at').eq('user_id', userId).eq('date', dateStr).order('captured_at'),
        ]);

        const timeline: TimelineEntry[] = [];

        // Add login entry
        if (dayStartResult.data?.submitted_at) {
          timeline.push({
            id: 'login',
            timestamp: dayStartResult.data.submitted_at,
            type: 'login',
            title: 'Checked In',
            description: dayStartResult.data.location_zone ? `at ${dayStartResult.data.location_zone}` : undefined,
          });
        }

        // Add day plan entry
        if (dayPlanResult.data?.submitted_at) {
          const tasks = (dayPlanResult.data as any).tasks || [];
          const output = (dayPlanResult.data as any).expected_output;
          const dependency = (dayPlanResult.data as any).dependency;

          let desc = tasks.length > 0 ? `Tasks: ${tasks.join(', ')}` : '';
          if (output) desc += (desc ? ' | ' : '') + `Output: ${output}`;
          if (dependency) desc += (desc ? ' | ' : '') + `Deps: ${dependency}`;

          timeline.push({
            id: 'day-plan',
            timestamp: dayPlanResult.data.submitted_at,
            type: 'day_plan',
            title: 'Daily Plan Submitted',
            description: desc,
          });
        }
        (plansResult.data || []).forEach(plan => {
          let planText = plan.plan_text;
          try {
            const parsed = JSON.parse(plan.plan_text);
            planText = parsed.notes || plan.plan_text;
          } catch {
            // Keep original text
          }
          timeline.push({
            id: `plan-${plan.id}`,
            timestamp: plan.submitted_at || '',
            type: 'plan',
            title: `Plan: ${plan.time_slot}`,
            description: planText.substring(0, 100) + (planText.length > 100 ? '...' : ''),
          });
        });

        // Add reports
        (reportsResult.data || []).forEach(report => {
          timeline.push({
            id: `report-${report.id}`,
            timestamp: report.submitted_at || '',
            type: 'report',
            title: `Report: ${report.time_slot}`,
            description: report.report_text.substring(0, 100) + (report.report_text.length > 100 ? '...' : ''),
            isLate: report.is_late,
          });
        });

        // Add selfies
        (selfiesResult.data || []).forEach(selfie => {
          timeline.push({
            id: `selfie-${selfie.id}`,
            timestamp: selfie.captured_at,
            type: 'selfie',
            title: selfie.selfie_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            proofUrl: selfie.selfie_url,
          });
        });

        // Add EOD
        if (eodResult.data?.submitted_at) {
          timeline.push({
            id: 'eod',
            timestamp: eodResult.data.submitted_at,
            type: 'eod',
            title: 'EOD Report Submitted',
            description: `Completion: ${eodResult.data.completion_percentage || 0}%`,
          });
        }

        // Sort by timestamp
        timeline.sort((a, b) => {
          if (!a.timestamp) return 1;
          if (!b.timestamp) return -1;
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        });

        setEntries(timeline);
      } catch (error) {
        console.error('Error fetching timeline:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimeline();

    // Real-time updates
    const channel = supabase
      .channel(`activity-timeline-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'day_starts', filter: `user_id=eq.${userId}` }, fetchTimeline)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'day_plans', filter: `user_id=eq.${userId}` }, fetchTimeline)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hourly_plans', filter: `user_id=eq.${userId}` }, fetchTimeline)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hourly_reports', filter: `user_id=eq.${userId}` }, fetchTimeline)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eod_reports', filter: `user_id=eq.${userId}` }, fetchTimeline)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'selfie_records', filter: `user_id=eq.${userId}` }, fetchTimeline)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, dateStr]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Activity Timeline
          <Badge variant="outline" className="ml-auto font-normal">
            {format(date, 'MMM d, yyyy')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          {entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activity recorded yet
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />

              <div className="space-y-4">
                {entries.map((entry) => {
                  const config = typeConfig[entry.type];
                  const Icon = config.icon;

                  return (
                    <div key={entry.id} className="relative pl-10">
                      {/* Timeline dot */}
                      <div className={cn(
                        "absolute left-2 top-1 w-5 h-5 rounded-full flex items-center justify-center",
                        config.bg
                      )}>
                        <Icon className={cn("w-3 h-3", config.color)} />
                      </div>

                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{entry.title}</span>
                            {entry.isLate && (
                              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                                LATE
                              </Badge>
                            )}
                          </div>
                          {entry.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {entry.description}
                            </p>
                          )}
                        </div>
                        {entry.timestamp && (
                          <span className="text-xs text-muted-foreground font-mono ml-2 shrink-0">
                            {format(parseISO(entry.timestamp), 'hh:mm a')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
