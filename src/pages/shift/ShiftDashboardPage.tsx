import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Clock, Timer, Coffee, LogOut, ArrowRight, Play,
  CheckCircle2, AlertTriangle, MapPin, Activity,
} from 'lucide-react';
import { useShiftSession } from '@/hooks/useShiftSession';
import { useShiftBreaks } from '@/hooks/useShiftBreaks';
import { useShiftHourlySlots } from '@/hooks/useShiftHourlySlots';
import { useAllSiteVisitRequests } from '@/hooks/useSiteVisitRequests';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function ShiftDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentSession, todayStats, isLoading: sessionLoading } = useShiftSession();
  const { isOnBreak, totalBreakMinutes } = useShiftBreaks(currentSession?.id);
  const { currentSlot, completedSlots, needsNewSlot } = useShiftHourlySlots(currentSession?.id);

  const { data: allRequests, isLoading: requestsLoading } = useAllSiteVisitRequests([
    'assigned', 'visit_in_progress', 'returned_to_rsh',
  ]);

  const activeAssignments = allRequests?.map((r: any) => {
    const myAssignment = r.site_visit_assignments?.find(
      (a: any) => a.assigned_person_user_id === user?.id,
    );
    return myAssignment ? { ...r, assignment_id: myAssignment.id } : null;
  }).filter(Boolean) as any[] || [];

  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Realtime site-visit redirect
  useEffect(() => {
    if (!user || requestsLoading) return;
    const activeMission = activeAssignments.find((a: any) => a.status === 'visit_in_progress');
    if (activeMission?.assignment_id) {
      navigate(`/site-visit-daily-report/${activeMission.assignment_id}`);
      return;
    }
    const channel = (supabase as any)
      .channel('site_visit_updates_dash')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'site_visit_requests' },
        async (payload: any) => {
          const { data: assignment } = await (supabase as any)
            .from('site_visit_assignments').select('id')
            .eq('request_id', payload.new.id)
            .eq('assigned_person_user_id', user.id).maybeSingle();
          if (assignment && payload.new.status === 'visit_in_progress') {
            toast.success('Field Mission Activated', { description: 'Redirecting...' });
            setTimeout(() => navigate(`/site-visit-daily-report/${assignment.id}`), 1500);
          }
        })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user, requestsLoading]);

  if (sessionLoading) {
    return (
      <div className="space-y-4 p-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 p-6">
        <div className="p-5 bg-primary/10 rounded-full">
          <Clock className="w-14 h-14 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Shift Not Started</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Log in with a selfie to begin tracking your work hours.
          </p>
        </div>
        <Button size="lg" onClick={() => navigate('/shift/login')} className="gap-2 h-12 px-8">
          <Play className="w-4 h-4" /> Start Shift
        </Button>
      </div>
    );
  }

  const hoursDisplay = todayStats?.hoursWorked?.toFixed(1) ?? '0.0';
  const progressPct = todayStats?.progressPercent ?? 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6 px-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shift Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {format(time, 'EEEE, MMMM do, yyyy')} · {format(time, 'h:mm:ss a')}
          </p>
        </div>
        {isOnBreak ? (
          <Badge variant="destructive" className="animate-pulse px-4 py-1.5 text-xs font-bold tracking-widest">
            ON BREAK
          </Badge>
        ) : (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 px-4 py-1.5 text-xs font-bold tracking-widest">
            ACTIVE
          </Badge>
        )}
      </div>

      {/* Active Field Mission */}
      {activeAssignments.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <Badge variant="outline" className="text-[10px] font-bold mb-1 border-primary/30 text-primary">
                    {activeAssignments[0].status === 'returned_to_rsh' ? 'Halted Mission' : 'Active Field Mission'}
                  </Badge>
                  <p className="font-bold text-lg leading-tight">{activeAssignments[0].location_title}</p>
                </div>
              </div>
              <Button
                className="shrink-0"
                variant={activeAssignments[0].status === 'returned_to_rsh' ? 'destructive' : 'default'}
                disabled={activeAssignments[0].status === 'returned_to_rsh'}
                onClick={() => navigate(`/site-visit-daily-report/${activeAssignments[0].assignment_id}`)}
              >
                {activeAssignments[0].status === 'returned_to_rsh' ? 'Mission Stopped' : <><Play className="h-4 w-4 mr-2" /> Activate Mission</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main stats card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Hours */}
            <div className="flex flex-col items-center justify-center p-5 bg-muted/50 rounded-xl border">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                Net Work Time
              </span>
              <div className="text-4xl font-bold text-primary tracking-tighter">
                {hoursDisplay}
                <span className="text-lg text-muted-foreground font-normal ml-1">
                  / {currentSession?.targetHours ?? 9}h
                </span>
              </div>
              <Progress value={progressPct} className="h-2 w-full mt-3" />
              <span className="text-[10px] text-muted-foreground mt-1">{progressPct.toFixed(0)}% complete</span>
            </div>

            {/* Current slot */}
            <div className="col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Timer className="w-4 h-4 text-primary" /> Current Slot
                </h3>
                {needsNewSlot && (
                  <Badge variant="destructive" className="animate-pulse text-[10px]">
                    Next Plan Due
                  </Badge>
                )}
              </div>
              <div className="p-4 bg-muted/40 border rounded-xl min-h-[72px] flex items-center">
                {currentSlot ? (
                  <div>
                    <p className="text-[11px] text-muted-foreground font-medium mb-1">
                      {format(new Date(currentSlot.slotStart), 'h:mm a')} · ACTIVE
                    </p>
                    <p className="font-semibold text-base">
                      {currentSlot.plan || 'Awaiting task update...'}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm italic">
                    No active task slot. Update your report to begin.
                  </p>
                )}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => navigate('/shift/hourly')} className="gap-2">
                  {needsNewSlot ? 'Submit Next Slot' : 'Update Activity'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick action cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
          onClick={() => navigate('/shift/hourly')}
        >
          <CardHeader className="p-4 pb-0">
            <Timer className="w-5 h-5 text-blue-500 mb-1" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold">{completedSlots}</div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Slots Done</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
          onClick={() => navigate('/shift/break')}
        >
          <CardHeader className="p-4 pb-0">
            <Coffee className="w-5 h-5 text-orange-500 mb-1" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold">{Math.round(totalBreakMinutes)}m</div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Break Time</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
          onClick={() => navigate('/shift/history')}
        >
          <CardHeader className="p-4 pb-0">
            <Activity className="w-5 h-5 text-violet-500 mb-1" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-sm font-bold">History</div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">View Logs</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-destructive/40 hover:shadow-md transition-all"
          onClick={() => navigate('/shift/logout')}
        >
          <CardHeader className="p-4 pb-0">
            <LogOut className="w-5 h-5 text-red-500 mb-1" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-sm font-bold">Logout</div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">End Shift</p>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
