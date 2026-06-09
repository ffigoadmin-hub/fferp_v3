import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { 
  LogIn, Clock, ClipboardList, FileText, CheckCircle,
  AlertCircle, Camera, Loader2, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ActivityTimeline } from './ActivityTimeline';

interface DailyStats {
  loginTime: string | null;
  loginStatus: 'on_time' | 'late' | 'no_login';
  lateMinutes: number;
  selfieVerified: boolean;
  dayPlanStatus: 'submitted' | 'pending';
  hourlyPlansCount: number;
  hourlyReportsCount: number;
  lateReportsCount: number;
  eodStatus: 'submitted' | 'pending';
}

const TOTAL_HOURLY_SLOTS = 8;

export function MyWorkspaceWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Check if user is from Engineering or Agri team (project-based teams)
  const userDepartment = user?.department?.toLowerCase() || '';
  const isProjectTeam = userDepartment.includes('engineering') || userDepartment.includes('agri');
  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        const [dayStartResult, dayPlanResult, hourlyPlansResult, hourlyReportsResult, eodResult, selfiesResult] = await Promise.all([
          supabase.from('day_starts').select('submitted_at').eq('user_id', user.id).eq('date', today).maybeSingle(),
          supabase.from('day_plans').select('id').eq('user_id', user.id).eq('date', today).maybeSingle(),
          supabase.from('hourly_plans').select('id').eq('user_id', user.id).eq('date', today),
          supabase.from('hourly_reports').select('id, is_late').eq('user_id', user.id).eq('date', today),
          supabase.from('eod_reports').select('id').eq('user_id', user.id).eq('date', today).maybeSingle(),
          supabase.from('selfie_records').select('id, selfie_type').eq('user_id', user.id).eq('date', today),
        ]);

        let loginTime: string | null = null;
        let loginStatus: 'on_time' | 'late' | 'no_login' = 'no_login';
        let lateMinutes = 0;

        if (dayStartResult.data?.submitted_at) {
          loginTime = format(new Date(dayStartResult.data.submitted_at), 'hh:mm a');
          const submitTime = new Date(dayStartResult.data.submitted_at);
          const deadline = new Date(submitTime);
          deadline.setHours(10, 15, 0, 0);
          
          if (submitTime > deadline) {
            loginStatus = 'late';
            lateMinutes = Math.floor((submitTime.getTime() - deadline.getTime()) / 60000);
          } else {
            loginStatus = 'on_time';
          }
        }

        const hasMorningSelfie = selfiesResult.data?.some(s => s.selfie_type === 'morning_login') || false;
        const lateReportsCount = hourlyReportsResult.data?.filter(r => r.is_late)?.length || 0;

        setStats({
          loginTime,
          loginStatus,
          lateMinutes,
          selfieVerified: hasMorningSelfie,
          dayPlanStatus: dayPlanResult.data ? 'submitted' : 'pending',
          hourlyPlansCount: hourlyPlansResult.data?.length || 0,
          hourlyReportsCount: hourlyReportsResult.data?.length || 0,
          lateReportsCount,
          eodStatus: eodResult.data ? 'submitted' : 'pending',
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();

    const channel = supabase
      .channel('my-workspace-stats')
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

  const handleQuickLogin = async () => {
    if (!user || stats?.loginStatus !== 'no_login') return;
    
    setIsCheckingIn(true);
    try {
      const { error } = await supabase.from('day_starts').insert({
        user_id: user.id,
        date: today,
        day_plan: 'Quick login from dashboard',
        location_zone: 'Site',
        location_verified: false,
      });

      if (error) throw error;
      toast.success('Checked in successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to check in');
    } finally {
      setIsCheckingIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) return null;

  const reportProgress = (stats.hourlyReportsCount / TOTAL_HOURLY_SLOTS) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Login Status */}
        <Card className={cn(
          "border-2",
          stats.loginStatus === 'no_login' ? 'border-destructive/50 bg-destructive/5' : 
          stats.loginStatus === 'late' ? 'border-status-late/50 bg-status-late/5' :
          'border-status-live/50 bg-status-live/5'
        )}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                stats.loginStatus === 'no_login' ? 'bg-destructive/20' : 
                stats.loginStatus === 'late' ? 'bg-status-late/20' :
                'bg-status-live/20'
              )}>
                <LogIn className={cn(
                  "w-5 h-5",
                  stats.loginStatus === 'no_login' ? 'text-destructive' : 
                  stats.loginStatus === 'late' ? 'text-status-late' :
                  'text-status-live'
                )} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Login</p>
                <p className={cn(
                  "font-bold",
                  stats.loginStatus === 'no_login' ? 'text-destructive' : 
                  stats.loginStatus === 'late' ? 'text-status-late' :
                  'text-status-live'
                )}>
                  {stats.loginTime || 'NO LOGIN'}
                </p>
                {stats.loginStatus === 'late' && (
                  <p className="text-xs text-status-late">+{stats.lateMinutes}m late</p>
                )}
              </div>
            </div>
            {stats.loginStatus === 'no_login' && (
              <Button 
                size="sm" 
                className="w-full mt-3" 
                onClick={handleQuickLogin}
                disabled={isCheckingIn}
              >
                {isCheckingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Quick Login'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Day Plan */}
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/day-plan')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                stats.dayPlanStatus === 'submitted' ? 'bg-status-live/20' : 'bg-status-late/20'
              )}>
                <ClipboardList className={cn(
                  "w-5 h-5",
                  stats.dayPlanStatus === 'submitted' ? 'text-status-live' : 'text-status-late'
                )} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Day Plan</p>
                <p className={cn(
                  "font-bold",
                  stats.dayPlanStatus === 'submitted' ? 'text-status-live' : 'text-status-late'
                )}>
                  {stats.dayPlanStatus === 'submitted' ? 'Submitted' : 'Pending'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hourly Reports */}
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/hourly-report')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                stats.hourlyReportsCount >= 6 ? 'bg-status-live/20' : 
                stats.hourlyReportsCount >= 3 ? 'bg-status-late/20' : 'bg-status-missed/20'
              )}>
                <FileText className={cn(
                  "w-5 h-5",
                  stats.hourlyReportsCount >= 6 ? 'text-status-live' : 
                  stats.hourlyReportsCount >= 3 ? 'text-status-late' : 'text-status-missed'
                )} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Reports</p>
                <p className="font-bold">{stats.hourlyReportsCount}/{TOTAL_HOURLY_SLOTS}</p>
                {stats.lateReportsCount > 0 && (
                  <p className="text-xs text-status-missed">{stats.lateReportsCount} late</p>
                )}
              </div>
            </div>
            <Progress value={reportProgress} className="h-1.5 mt-3" />
          </CardContent>
        </Card>

        {/* EOD */}
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/eod-summary')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                stats.eodStatus === 'submitted' ? 'bg-status-live/20' : 'bg-muted'
              )}>
                <CheckCircle className={cn(
                  "w-5 h-5",
                  stats.eodStatus === 'submitted' ? 'text-status-live' : 'text-muted-foreground'
                )} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">EOD Report</p>
                <p className={cn(
                  "font-bold",
                  stats.eodStatus === 'submitted' ? 'text-status-live' : 'text-muted-foreground'
                )}>
                  {stats.eodStatus === 'submitted' ? 'Submitted' : 'Pending'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Button variant="outline" onClick={() => navigate('/day-plan')} className="justify-start gap-2">
            <ClipboardList className="w-4 h-4" />
            Day Plan
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Button>
          <Button variant="outline" onClick={() => navigate('/hourly-report')} className="justify-start gap-2">
            <FileText className="w-4 h-4" />
            Hourly Report
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Button>
          <Button variant="outline" onClick={() => navigate('/eod-summary')} className="justify-start gap-2">
            <CheckCircle className="w-4 h-4" />
            EOD Summary
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Button>
          {isProjectTeam && (
            <Button variant="outline" onClick={() => navigate('/my-requests')} className="justify-start gap-2">
              <AlertCircle className="w-4 h-4" />
              My Requests
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      {user && <ActivityTimeline userId={user.id} date={new Date()} />}
    </motion.div>
  );
}
