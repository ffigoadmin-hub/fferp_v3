import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  Clock, ClipboardList, FileText, CheckCircle,
  XCircle, AlertTriangle, Camera, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface DailyStats {
  loginTime: string | null;
  loginStatus: 'on_time' | 'late' | 'no_login';
  lateMinutes: number;
  selfieVerified: boolean;
  selfieCount: number;
  dayPlanStatus: 'submitted' | 'pending';
  dayPlanDetails?: {
    tasks: string[];
    expected_output?: string;
    dependency?: string;
  };
  hourlyReportsCount: number;
  hourlyPlansCount: number;
  lateReportsCount: number;
  eodStatus: 'submitted' | 'pending';
}

const TOTAL_HOURLY_SLOTS = 8;

export function DailyActivitySummaryWidget() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        // Fetch all data in parallel
        const [dayStartResult, dayPlanResult, hourlyPlansResult, hourlyReportsResult, eodResult, selfiesResult] = await Promise.all([
          supabase.from('day_starts').select('submitted_at').eq('user_id', user.id).eq('date', today).maybeSingle(),
          supabase.from('day_plans').select('id, tasks, expected_output, dependency').eq('user_id', user.id).eq('date', today).maybeSingle(),
          supabase.from('hourly_plans').select('id').eq('user_id', user.id).eq('date', today),
          supabase.from('hourly_reports').select('id, is_late').eq('user_id', user.id).eq('date', today),
          supabase.from('eod_reports').select('id').eq('user_id', user.id).eq('date', today).maybeSingle(),
          supabase.from('selfie_records').select('id, selfie_type').eq('user_id', user.id).eq('date', today),
        ]);

        // Calculate login status
        let loginTime: string | null = null;
        let loginStatus: 'on_time' | 'late' | 'no_login' = 'no_login';
        let lateMinutes = 0;

        if (dayStartResult.data?.submitted_at) {
          loginTime = format(new Date(dayStartResult.data.submitted_at), 'hh:mm a');
          const submitTime = new Date(dayStartResult.data.submitted_at);
          const deadline = new Date(submitTime);
          deadline.setHours(10, 15, 0, 0); // 10:15 AM deadline

          if (submitTime > deadline) {
            loginStatus = 'late';
            lateMinutes = Math.floor((submitTime.getTime() - deadline.getTime()) / 60000);
          } else {
            loginStatus = 'on_time';
          }
        }

        // Check selfie
        const selfieCount = selfiesResult.data?.length || 0;
        const hasMorningSelfie = selfiesResult.data?.some(s => s.selfie_type === 'morning_login') || false;

        // Count late reports
        const lateReportsCount = hourlyReportsResult.data?.filter(r => r.is_late)?.length || 0;

        setStats({
          loginTime,
          loginStatus,
          lateMinutes,
          selfieVerified: hasMorningSelfie,
          selfieCount,
          dayPlanStatus: dayPlanResult.data ? 'submitted' : 'pending',
          dayPlanDetails: dayPlanResult.data ? {
            tasks: (dayPlanResult.data as any).tasks || [],
            expected_output: (dayPlanResult.data as any).expected_output,
            dependency: (dayPlanResult.data as any).dependency,
          } : undefined,
          hourlyPlansCount: hourlyPlansResult.data?.length || 0,
          hourlyReportsCount: hourlyReportsResult.data?.length || 0,
          lateReportsCount,
          eodStatus: eodResult.data ? 'submitted' : 'pending',
        });
      } catch (error) {
        console.error('Error fetching daily stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();

    // Real-time updates
    const channel = supabase
      .channel('daily-activity-summary')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'day_starts', filter: `user_id=eq.${user?.id}` }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'day_plans', filter: `user_id=eq.${user?.id}` }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hourly_plans', filter: `user_id=eq.${user?.id}` }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hourly_reports', filter: `user_id=eq.${user?.id}` }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eod_reports', filter: `user_id=eq.${user?.id}` }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'selfie_records', filter: `user_id=eq.${user?.id}` }, fetchStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, today]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const reportProgress = (stats.hourlyReportsCount / TOTAL_HOURLY_SLOTS) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Daily Activity Summary
            <Badge variant="outline" className="ml-auto font-normal">
              {format(new Date(), 'MMM d, yyyy')}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Login Status */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Login Status</span>
              </div>
              {stats.loginStatus === 'no_login' ? (
                <Badge variant="destructive" className="text-xs">No Login</Badge>
              ) : stats.loginStatus === 'late' ? (
                <Badge variant="destructive" className="text-xs">LATE +{stats.lateMinutes}m</Badge>
              ) : (
                <Badge className="text-xs bg-status-live/20 text-status-live border-status-live/30">On Time</Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{stats.loginTime || 'Not logged in'}</span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1">
                <Camera className="w-3 h-3" />
                {stats.selfieVerified ? (
                  <span className="text-status-live">Selfie Verified</span>
                ) : (
                  <span className="text-status-missed">Selfie Pending</span>
                )}
              </span>
            </div>
          </div>

          {/* Day Plan Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Day Plan</span>
            </div>
            {stats.dayPlanStatus === 'submitted' ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-status-live cursor-help">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Submitted</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="w-80 p-3">
                    <div className="space-y-2">
                      {stats.dayPlanDetails?.tasks && stats.dayPlanDetails.tasks.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1">Planned Tasks:</p>
                          <ul className="text-xs list-disc pl-4 space-y-1">
                            {stats.dayPlanDetails.tasks.map((task, i) => (
                              <li key={i}>{task}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {stats.dayPlanDetails?.expected_output && (
                        <div>
                          <p className="text-xs font-semibold">Expected Output:</p>
                          <p className="text-xs text-muted-foreground">{stats.dayPlanDetails.expected_output}</p>
                        </div>
                      )}
                      {stats.dayPlanDetails?.dependency && (
                        <div>
                          <p className="text-xs font-semibold">Dependencies:</p>
                          <p className="text-xs text-muted-foreground">{stats.dayPlanDetails.dependency}</p>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <div className="flex items-center gap-1 text-status-late">
                <XCircle className="w-4 h-4" />
                <span className="text-sm">Pending</span>
              </div>
            )}
          </div>

          {/* Hourly Reporting Progress */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Hourly Reporting</span>
              </div>
              <span className={cn(
                "text-sm font-bold",
                stats.hourlyReportsCount >= 6 ? "text-status-live" :
                  stats.hourlyReportsCount >= 3 ? "text-status-late" : "text-status-missed"
              )}>
                {stats.hourlyReportsCount}/{TOTAL_HOURLY_SLOTS}
              </span>
            </div>
            <Progress value={reportProgress} className="h-2" />
            {stats.lateReportsCount > 0 && (
              <div className="flex items-center gap-1 mt-2 text-status-missed text-xs">
                <AlertTriangle className="w-3 h-3" />
                <span>{stats.lateReportsCount} late report{stats.lateReportsCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* EOD Report Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">EOD Report</span>
            </div>
            {stats.eodStatus === 'submitted' ? (
              <div className="flex items-center gap-1 text-status-live">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Submitted</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-muted-foreground">
                <XCircle className="w-4 h-4" />
                <span className="text-sm">Pending</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
