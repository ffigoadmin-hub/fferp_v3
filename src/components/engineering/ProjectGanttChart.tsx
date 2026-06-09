import { useMemo } from 'react';
import { format, differenceInDays, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Milestone } from '@/hooks/useMilestones';
import { cn } from '@/lib/utils';
import { CalendarDays, Flag, AlertTriangle } from 'lucide-react';

interface ProjectPhase {
  id: string;
  phase_name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  completion_percentage: number;
  estimated_cost: number;
  actual_cost: number;
}

interface ProjectGanttChartProps {
  phases: ProjectPhase[];
  milestones: Milestone[];
  startDate?: Date;
  endDate?: Date;
}

export function ProjectGanttChart({ phases, milestones, startDate, endDate }: ProjectGanttChartProps) {
  const { days, chartStart, chartEnd } = useMemo(() => {
    // Calculate date range from phases and milestones
    const allDates: Date[] = [];
    
    phases.forEach(p => {
      if (p.started_at) allDates.push(new Date(p.started_at));
      if (p.completed_at) allDates.push(new Date(p.completed_at));
    });
    
    milestones.forEach(m => {
      allDates.push(new Date(m.planned_date));
      if (m.actual_date) allDates.push(new Date(m.actual_date));
    });

    if (allDates.length === 0) {
      allDates.push(new Date());
    }

    const minDate = startDate || startOfMonth(new Date(Math.min(...allDates.map(d => d.getTime()))));
    const maxDate = endDate || endOfMonth(addDays(new Date(Math.max(...allDates.map(d => d.getTime()))), 30));

    return {
      days: eachDayOfInterval({ start: minDate, end: maxDate }),
      chartStart: minDate,
      chartEnd: maxDate,
    };
  }, [phases, milestones, startDate, endDate]);

  const totalDays = differenceInDays(chartEnd, chartStart) + 1;
  const dayWidth = 24; // pixels per day

  const getPositionForDate = (date: Date) => {
    const daysDiff = differenceInDays(date, chartStart);
    return daysDiff * dayWidth;
  };

  const getWidthForRange = (start: Date, end: Date) => {
    const daysDiff = differenceInDays(end, start) + 1;
    return daysDiff * dayWidth;
  };

  const getPhaseBar = (phase: ProjectPhase) => {
    const startDate = phase.started_at ? new Date(phase.started_at) : new Date();
    const endDate = phase.completed_at 
      ? new Date(phase.completed_at) 
      : addDays(startDate, Math.max(7, Math.ceil((100 - phase.completion_percentage) / 10)));

    return {
      left: getPositionForDate(startDate),
      width: getWidthForRange(startDate, endDate),
      progress: phase.completion_percentage,
    };
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-muted',
    in_progress: 'bg-blue-500',
    completed: 'bg-green-500',
    delayed: 'bg-destructive',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="w-5 h-5" />
          Project Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="min-w-max">
            {/* Header - Months and Days */}
            <div className="flex border-b border-border/50">
              <div className="w-48 shrink-0 p-2 font-medium text-sm bg-muted/30">Phase / Milestone</div>
              <div className="flex">
                {days.map((day, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "w-6 text-center text-xs border-l border-border/30 py-1",
                      isToday(day) && "bg-primary/10",
                      day.getDay() === 0 && "bg-muted/50"
                    )}
                  >
                    {day.getDate() === 1 && (
                      <div className="font-medium text-primary">{format(day, 'MMM')}</div>
                    )}
                    <div className={cn("text-muted-foreground", isToday(day) && "text-primary font-bold")}>
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Phases */}
            {phases.map((phase) => {
              const bar = getPhaseBar(phase);
              return (
                <div key={phase.id} className="flex border-b border-border/30 hover:bg-muted/20">
                  <div className="w-48 shrink-0 p-2 text-sm flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {phase.completion_percentage}%
                    </Badge>
                    <span className="truncate">{phase.phase_name}</span>
                  </div>
                  <div className="relative h-10 flex items-center" style={{ width: days.length * dayWidth }}>
                    {/* Phase bar */}
                    <div
                      className="absolute h-6 rounded-md bg-muted overflow-hidden"
                      style={{ left: bar.left, width: bar.width }}
                    >
                      <div
                        className={cn(
                          "h-full transition-all",
                          statusColors[phase.status] || 'bg-blue-500'
                        )}
                        style={{ width: `${bar.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Milestones */}
            {milestones.length > 0 && (
              <>
                <div className="flex border-b border-border/50 bg-muted/30">
                  <div className="w-48 shrink-0 p-2 font-medium text-sm flex items-center gap-2">
                    <Flag className="w-4 h-4" />
                    Milestones
                  </div>
                  <div style={{ width: days.length * dayWidth }} />
                </div>
                {milestones.map((milestone) => {
                  const plannedPos = getPositionForDate(new Date(milestone.planned_date));
                  const actualPos = milestone.actual_date 
                    ? getPositionForDate(new Date(milestone.actual_date)) 
                    : null;
                  const isDelayed = milestone.actual_date && new Date(milestone.actual_date) > new Date(milestone.planned_date);

                  return (
                    <div key={milestone.id} className="flex border-b border-border/30 hover:bg-muted/20">
                      <div className="w-48 shrink-0 p-2 text-sm flex items-center gap-2">
                        {isDelayed && <AlertTriangle className="w-4 h-4 text-destructive" />}
                        <span className="truncate">{milestone.milestone_name}</span>
                      </div>
                      <div className="relative h-10 flex items-center" style={{ width: days.length * dayWidth }}>
                        {/* Planned date marker */}
                        <div
                          className="absolute w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-blue-500"
                          style={{ left: plannedPos - 6, top: 4 }}
                          title={`Planned: ${format(new Date(milestone.planned_date), 'MMM d, yyyy')}`}
                        />
                        
                        {/* Actual date marker */}
                        {actualPos !== null && (
                          <div
                            className={cn(
                              "absolute w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent",
                              isDelayed ? "border-b-destructive" : "border-b-green-500"
                            )}
                            style={{ left: actualPos - 6, bottom: 4 }}
                            title={`Actual: ${format(new Date(milestone.actual_date!), 'MMM d, yyyy')}`}
                          />
                        )}

                        {/* Line between planned and actual if delayed */}
                        {actualPos !== null && isDelayed && (
                          <div
                            className="absolute h-0.5 bg-destructive/50"
                            style={{ 
                              left: plannedPos, 
                              width: actualPos - plannedPos,
                              top: '50%'
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-muted" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-blue-500" />
            <span>Planned Date</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent border-b-green-500" />
            <span>Actual Date</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
