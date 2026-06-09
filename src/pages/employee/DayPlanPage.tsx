import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Plus, Trash2, Lock, CheckCircle2, Check, Camera, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useDayPlan } from '@/hooks/useDayPlan';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { SelfieCapture } from '@/components/SelfieCapture';
import { useWeekOffAssignments } from '@/hooks/useWeekOffAssignments';
import { Sun } from 'lucide-react';

interface DayPlanPageProps {
  embedded?: boolean;
}

export function DayPlanPage({ embedded = false }: DayPlanPageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<string[]>(['']);
  const [dependency, setDependency] = useState('');
  const [hasMorningSelfie, setHasMorningSelfie] = useState<boolean | null>(null);
  const [isCheckingSelfie, setIsCheckingSelfie] = useState(true);
  const [showSelfieCapture, setShowSelfieCapture] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const { dayPlan, hasPlan, isSaving, submitDayPlan } = useDayPlan(new Date());
  const { isWeekOffDay } = useWeekOffAssignments();
  const [isWeekOff, setIsWeekOff] = useState(false);

  // Check week off status
  useEffect(() => {
    const checkWeekOff = async () => {
      if (!user) return;
      const today = format(new Date(), 'yyyy-MM-dd');
      const result = await isWeekOffDay(user.id, today);
      setIsWeekOff(result);
    };
    checkWeekOff();
  }, [user, isWeekOffDay]);

  // Check morning selfie status
  useEffect(() => {
    const checkMorningSelfie = async () => {
      if (!user) return;

      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('selfie_records')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', today)
        .eq('selfie_type', 'morning_login')
        .single();

      setHasMorningSelfie(!!data && !error);
      setIsCheckingSelfie(false);
    };

    checkMorningSelfie();

    // Real-time subscription for selfie updates
    const channel = supabase
      .channel('day-plan-selfie-check')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'selfie_records',
          filter: `user_id=eq.${user?.id}`
        },
        () => checkMorningSelfie()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Update current time every second for countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate countdown to selfie window end
  const getSelfieWindowInfo = () => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const seconds = currentTime.getSeconds();
    const timeInSeconds = hours * 3600 + minutes * 60 + seconds;

    const windowStart = 9 * 3600 + 30 * 60; // 9:30 AM
    const windowEnd = 10 * 3600 + 15 * 60; // 10:15 AM

    if (timeInSeconds < windowStart) {
      const remaining = windowStart - timeInSeconds;
      return { status: 'before', label: 'Opens in', remaining };
    }
    if (timeInSeconds <= windowEnd) {
      const remaining = windowEnd - timeInSeconds;
      return { status: 'open', label: 'Window closes in', remaining };
    }
    return { status: 'late', label: 'Window closed', remaining: 0 };
  };

  const formatCountdown = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelfieCapture = () => {
    setHasMorningSelfie(true);
    setShowSelfieCapture(false);
  };

  // Show confirmation view if already submitted (no auto-redirect)

  const addTask = () => {
    // Removed max limit - allow unlimited tasks
    setTasks([...tasks, '']);
  };

  const removeTask = (index: number) => {
    if (tasks.length > 1) {
      setTasks(tasks.filter((_, i) => i !== index));
    }
  };

  const updateTask = (index: number, value: string) => {
    const newTasks = [...tasks];
    newTasks[index] = value;
    setTasks(newTasks);
  };

  const handleSubmit = async () => {
    const filledTasks = tasks.filter(t => t.trim());
    if (filledTasks.length === 0) return;

    const result = await submitDayPlan(
      filledTasks,
      'Tasks submitted', // Default output
      true, // Default to project work
      dependency || undefined
    );

    if (result.success) {
      setTimeout(() => navigate('/hourly-report'), 1500);
    }
  };

  // Loading state
  if (isCheckingSelfie) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Checking attendance status...</p>
        </div>
      </div>
    );
  }

  // Show Week Off Exemption Screen
  if (isWeekOff) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={embedded ? "" : "max-w-2xl mx-auto"}
      >
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-authority-admin/20 via-authority-admin/5 to-transparent p-12 border border-authority-admin/10 shadow-2xl text-center">
          <div className="absolute top-0 right-0 -m-20 w-80 h-80 bg-authority-admin/10 rounded-full blur-[100px] animate-pulse" />

          <div className="relative z-10 space-y-6">
            <div className="w-24 h-24 rounded-full bg-authority-admin/10 border border-authority-admin/20 flex items-center justify-center mx-auto mb-6">
              <Sun className="w-12 h-12 text-authority-admin animate-spin-slow" />
            </div>

            <h2 className="text-4xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/40 bg-clip-text text-transparent">
              Enjoy your Week Off!
            </h2>

            <p className="text-muted-foreground max-w-md mx-auto text-lg">
              Today is your scheduled day off. No attendance marking, day plans, or hourly reports are required.
            </p>

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                variant="outline"
                onClick={() => navigate('/company-calendar')}
                className="rounded-xl border-authority-admin/20 hover:bg-authority-admin/5 w-full sm:w-auto"
              >
                View Company Calendar
              </Button>
              <Button
                onClick={() => navigate('/my-tasks')}
                className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
              >
                Go to My Tasks
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Block access if no morning selfie
  if (!hasMorningSelfie && !hasPlan) {
    const windowInfo = getSelfieWindowInfo();

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={embedded ? "" : "max-w-2xl mx-auto"}
      >
        {!embedded && (
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">Day Plan</h1>
            <p className="text-muted-foreground">Lock your intent before execution begins</p>
          </div>
        )}

        <div className="authority-card">
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-10 h-10 text-destructive" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-destructive">Morning Selfie Required</h2>
            <p className="text-muted-foreground">
              Please capture your morning attendance selfie before accessing Day Plan
            </p>
          </div>

          {/* Countdown Timer */}
          <div className="mb-6 p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Morning Selfie Window</span>
              <Badge
                variant={windowInfo.status === 'open' ? 'default' : windowInfo.status === 'late' ? 'destructive' : 'secondary'}
                className={windowInfo.status === 'open' ? 'bg-green-500' : ''}
              >
                {windowInfo.status === 'open' ? '🟢 OPEN' : windowInfo.status === 'late' ? '🔴 LATE' : '⏳ UPCOMING'}
              </Badge>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">{windowInfo.label}</p>
              {windowInfo.remaining > 0 ? (
                <p className={`text-3xl font-mono font-bold tabular-nums ${windowInfo.status === 'open' && windowInfo.remaining < 300 ? 'text-destructive animate-pulse' :
                  windowInfo.status === 'open' ? 'text-green-500' : 'text-primary'
                  }`}>
                  <Clock className="w-6 h-6 inline-block mr-2" />
                  {formatCountdown(windowInfo.remaining)}
                </p>
              ) : (
                <p className="text-lg font-medium text-destructive">
                  You can still capture - it will be marked as late
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Window: 9:30 AM - 10:15 AM
            </p>
          </div>

          {/* Pending Review Indicator */}
          <div className="mb-6 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-3">
            <Camera className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-600">Pending Verification</p>
              <p className="text-sm text-muted-foreground">
                Your selfie will be reviewed by HR for attendance confirmation
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowSelfieCapture(true)}
            className="w-full h-12 text-base font-semibold"
            disabled={windowInfo.status === 'before'}
          >
            {windowInfo.status === 'before' ? (
              <>
                <Lock className="w-5 h-5 mr-2" />
                Locked Until 9:30 AM
              </>
            ) : (
              <>
                <Camera className="w-5 h-5 mr-2" />
                Capture Morning Selfie
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/day-start')}
            className="w-full mt-3"
          >
            Go to Day Start
          </Button>
        </div>

        <AnimatePresence>
          {showSelfieCapture && (
            <SelfieCapture
              title="Morning Selfie (10:00 AM)"
              selfieType="morning_login"
              onCapture={handleSelfieCapture}
              onClose={() => setShowSelfieCapture(false)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  if (hasPlan && dayPlan) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={embedded ? "" : "max-w-2xl mx-auto"}
      >
        <div className="authority-card">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-status-live/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-status-live" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Day Plan Locked</h2>
            <p className="text-muted-foreground">Your plan has been recorded</p>
          </div>

          <div className="space-y-4 mb-6">
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground mb-2">Planned Tasks</p>
              <div className="space-y-2">
                {dayPlan.tasks.map((task, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-status-live" />
                    <span className="text-sm">{task}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Submitted At</p>
              <p className="font-semibold text-sm">{format(new Date(dayPlan.submitted_at), 'hh:mm a')}</p>
            </div>
            {dayPlan.dependency && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Dependency</p>
                <p className="text-sm">{dayPlan.dependency}</p>
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-muted/20 flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Lock className="w-4 h-4" />
            <span>Plan vs Actual will be calculated at EOD</span>
          </div>

          <Button onClick={() => navigate('/hourly-report')} className="w-full">
            Continue to Hourly Reports
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={embedded ? "" : "max-w-2xl mx-auto"}
    >
      {!embedded && (
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Day Plan</h1>
          <p className="text-muted-foreground">Lock your intent before execution begins</p>
        </div>
      )}

      <div className="authority-card">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              <Label className="text-base font-medium">Planned Tasks *</Label>
            </div>
          </div>

          <div className="space-y-3">
            {tasks.map((task, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-2"
              >
                <span className="text-muted-foreground text-sm w-6">{index + 1}.</span>
                <Input
                  value={task}
                  onChange={(e) => updateTask(index, e.target.value)}
                  placeholder={`Task ${index + 1}`}
                  className="flex-1"
                />
                {tasks.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTask(index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </motion.div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={addTask}
            className="mt-3"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </div>

        <div className="mb-8">
          <Label className="text-sm font-medium mb-2 block">
            Dependency (Optional)
          </Label>
          <Input
            value={dependency}
            onChange={(e) => setDependency(e.target.value)}
            placeholder="E.g., Waiting for design approval, API access needed..."
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={tasks.filter(t => t.trim()).length === 0 || isSaving}
          className="w-full h-12 text-base font-semibold"
        >
          {isSaving ? 'Saving...' : 'Lock Day Plan'}
        </Button>

        <p className="text-xs text-muted-foreground text-center mt-4 flex items-center justify-center gap-1">
          <Lock className="w-3 h-3" />
          Cannot be edited after submission
        </p>
      </div>
    </motion.div>
  );
}
