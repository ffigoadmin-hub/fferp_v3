import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Trash2, Lock, CheckCircle2, AlertTriangle, BarChart, Clock, Briefcase, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEODReport } from '@/hooks/useEODReport';
import { useHourlyReports } from '@/hooks/useHourlyReports';
import { useDayPlan } from '@/hooks/useDayPlan';
import { useDayStart } from '@/hooks/useDayStart';
import { useExtraWorkEntries } from '@/hooks/useExtraWorkEntries';
import { useWeekOffAssignments } from '@/hooks/useWeekOffAssignments';
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';

const issueOptions = [
  'No issues',
  'Technical blockers',
  'Waiting for dependencies',
  'Resource constraints',
  'Unclear requirements',
  'Other',
];

interface EODSummaryPageProps {
  embedded?: boolean;
}

export function EODSummaryPage({ embedded = false }: EODSummaryPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [workSummary, setWorkSummary] = useState('');
  const [issuesFaced, setIssuesFaced] = useState('');
  const [issueDetails, setIssueDetails] = useState('');
  const [spillover, setSpillover] = useState('');
  const [evidenceLinks, setEvidenceLinks] = useState<string[]>(['']);
  const [completedTasks, setCompletedTasks] = useState<Record<number, boolean>>({});

  const { eodReport, hasSubmittedEOD, isSaving, submitEODReport } = useEODReport(new Date());
  const { reports } = useHourlyReports(new Date());
  const { dayPlan } = useDayPlan(new Date());
  const { dayStart } = useDayStart(new Date());
  const { entries: extraWorkEntries, isLoading: isExtraLoading } = useExtraWorkEntries(new Date());
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

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate total login hours
  const calculateLoginHours = () => {
    if (!dayStart?.submitted_at) return '0h 0m';
    const loginTime = new Date(dayStart.submitted_at);
    const now = new Date();
    const diffMinutes = differenceInMinutes(now, loginTime);
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Calculate Plan vs Done based on completed checkboxes
  const totalTasks = dayPlan?.tasks?.length || 0;
  const completedCount = Object.values(completedTasks).filter(Boolean).length;
  const currentCompletionPercentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  // Use persisted percentage if already submitted, otherwise show current calculation
  const plannedVsDone = hasSubmittedEOD && eodReport
    ? eodReport.completion_percentage
    : currentCompletionPercentage;

  // Total login hours display
  const totalLoginHours = calculateLoginHours();

  const addEvidenceLink = () => {
    if (evidenceLinks.length < 5) {
      setEvidenceLinks([...evidenceLinks, '']);
    }
  };

  const removeEvidenceLink = (index: number) => {
    if (evidenceLinks.length > 1) {
      setEvidenceLinks(evidenceLinks.filter((_, i) => i !== index));
    }
  };

  const updateEvidenceLink = (index: number, value: string) => {
    const newLinks = [...evidenceLinks];
    newLinks[index] = value;
    setEvidenceLinks(newLinks);
  };

  const handleSubmit = async () => {
    if (!workSummary.trim() || !issuesFaced) return;

    const plannedWork = dayPlan?.tasks?.join(', ') || 'No plan recorded';
    const pendingItems = spillover || null;

    const result = await submitEODReport(
      plannedWork,
      workSummary,
      pendingItems,
      currentCompletionPercentage
    );
  };

  // WEEK OFF MODE - Show relaxation screen and skip EOD
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
              <Sun className="w-12 h-12 text-authority-admin" />
            </div>

            <h2 className="text-4xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/40 bg-clip-text text-transparent">
              Enjoy your Week Off!
            </h2>

            <p className="text-muted-foreground max-w-md mx-auto text-lg">
              Today is your scheduled day off. No attendance marking, day plans, hourly reports, or EOD summaries are required.
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

  if (hasSubmittedEOD) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={embedded ? "" : "max-w-2xl mx-auto"}
      >
        <div className="authority-card text-center py-12">
          <div className="w-16 h-16 rounded-full bg-status-live/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-status-live" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Day Completed</h2>
          <p className="text-muted-foreground mb-6">Your EOD summary has been recorded</p>

          <div className="max-w-sm mx-auto mb-6">
            <div className="p-4 rounded-lg bg-muted/30 border border-border text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Plan vs Done</p>
              <p className={`text-2xl font-bold ${plannedVsDone >= 80 ? 'text-status-live' : plannedVsDone >= 50 ? 'text-status-late' : 'text-status-missed'}`}>
                {plannedVsDone}%
              </p>
            </div>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg inline-block">
            <div className="flex items-center gap-2 text-sm">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Day record is now immutable</span>
            </div>
          </div>

          <div className="mt-6">
            <Button variant="outline" onClick={() => navigate('/day-start')}>
              Start New Day
            </Button>
          </div>
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
          <h1 className="text-2xl font-bold mb-2">EOD Summary</h1>
          <p className="text-muted-foreground">Complete your day record before logout</p>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        className="mb-6 p-4 rounded-lg bg-status-late/10 border border-status-late/30 flex items-start gap-3"
      >
        <AlertTriangle className="w-5 h-5 text-status-late mt-0.5" />
        <div>
          <p className="font-medium text-status-late">Mandatory Completion</p>
          <p className="text-sm text-muted-foreground">
            Logout is disabled until EOD summary is submitted
          </p>
        </div>
      </motion.div>

      {/* Check if EOD can be accessed (after 7:20 PM) - Updated from 7:29 PM */}
      {(() => {
        const eodOpenTime = new Date();
        eodOpenTime.setHours(19, 20, 0, 0); // Changed to 7:20 PM
        const isBeforeEODTime = currentTime < eodOpenTime;

        if (isBeforeEODTime) {
          return (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 p-4 rounded-lg bg-status-late/10 border border-status-late/30 flex items-start gap-3"
            >
              <Lock className="w-5 h-5 text-status-late mt-0.5" />
              <div>
                <p className="font-medium text-status-late">EOD Summary Opens at 7:20 PM</p>
                <p className="text-sm text-muted-foreground">
                  Current time: {format(currentTime, 'hh:mm:ss a')}. EOD submission is restricted until 7:20 PM to ensure a complete work day.
                </p>
              </div>
            </motion.div>
          );
        }
        return null;
      })()}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="authority-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Plan vs Done</p>
            <p className={`text-2xl font-bold ${plannedVsDone >= 80 ? 'text-status-live' : plannedVsDone >= 50 ? 'text-status-late' : 'text-status-missed'}`}>
              {plannedVsDone}%
            </p>
          </div>
        </div>
        <div className="authority-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Login Hours</p>
            <p className="text-2xl font-bold text-primary">
              {totalLoginHours}
            </p>
          </div>
        </div>
      </div>

      {/* Day Plan Tasks with Checkboxes */}
      {dayPlan && dayPlan.tasks && dayPlan.tasks.length > 0 && (
        <div className="authority-card mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Plan vs Done - Day Tasks ({completedCount}/{totalTasks})</p>
          <div className="space-y-2">
            {dayPlan.tasks.map((task, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded bg-muted/30 border border-border">
                <Checkbox
                  id={`task-${index}`}
                  checked={completedTasks[index] || false}
                  onCheckedChange={(checked) => {
                    setCompletedTasks(prev => ({ ...prev, [index]: !!checked }));
                  }}
                  className="mt-0.5"
                />
                <label htmlFor={`task-${index}`} className="text-sm flex-1 cursor-pointer">
                  {task}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extra Work Entries Summary */}
      {extraWorkEntries.length > 0 && (
        <div className="authority-card mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Extra Work Entries ({extraWorkEntries.length})
            </p>
          </div>
          <div className="space-y-2">
            {extraWorkEntries.map((entry) => (
              <div key={entry.id} className="p-3 rounded bg-muted/30 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded font-medium',
                    entry.work_type === 'assigned' ? 'bg-primary/10 text-primary' : 'bg-status-live/10 text-status-live'
                  )}>
                    {entry.work_type === 'assigned' ? 'NEW ASSIGNED' : 'EXTRA DONE'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Slot: {entry.time_slot}
                  </span>
                </div>
                <p className="text-sm">{entry.description}</p>
                {entry.proof_url && (
                  <a
                    href={entry.proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline mt-1 inline-block"
                  >
                    View Proof →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="authority-card">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-primary" />
            <Label className="text-base font-medium">Work Summary *</Label>
          </div>
          <Textarea
            value={workSummary}
            onChange={(e) => setWorkSummary(e.target.value)}
            placeholder="Summarize your day's accomplishments..."
            className="min-h-[120px]"
          />
        </div>

        <div className="mb-6">
          <Label className="text-sm font-medium mb-2 block">Issues Faced *</Label>
          <Select value={issuesFaced} onValueChange={setIssuesFaced}>
            <SelectTrigger>
              <SelectValue placeholder="Select issue type" />
            </SelectTrigger>
            <SelectContent>
              {issueOptions.map(option => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {issuesFaced && issuesFaced !== 'No issues' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3"
            >
              <Textarea
                value={issueDetails}
                onChange={(e) => setIssueDetails(e.target.value)}
                placeholder="Describe the issues in detail..."
                className="min-h-[80px]"
              />
            </motion.div>
          )}
        </div>

        <div className="mb-6">
          <Label className="text-sm font-medium mb-2 block">Pending Spillover</Label>
          <Textarea
            value={spillover}
            onChange={(e) => setSpillover(e.target.value)}
            placeholder="Tasks that will carry over to tomorrow..."
            className="min-h-[80px]"
          />
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Evidence Links</Label>
            <span className="text-xs text-muted-foreground">{evidenceLinks.length}/5</span>
          </div>
          <div className="space-y-2">
            {evidenceLinks.map((link, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={link}
                  onChange={(e) => updateEvidenceLink(index, e.target.value)}
                  placeholder="Drive link, screenshot URL..."
                />
                {evidenceLinks.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEvidenceLink(index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {evidenceLinks.length < 5 && (
            <Button variant="outline" size="sm" onClick={addEvidenceLink} className="mt-2">
              <Plus className="w-4 h-4 mr-2" />
              Add Link
            </Button>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!workSummary.trim() || !issuesFaced || isSaving || (() => {
            const eodOpenTime = new Date();
            eodOpenTime.setHours(19, 20, 0, 0); // Changed to 7:20 PM
            return currentTime < eodOpenTime;
          })()}
          className="w-full h-12 text-base font-semibold"
        >
          {isSaving ? 'Submitting...' : (() => {
            const eodOpenTime = new Date();
            eodOpenTime.setHours(19, 20, 0, 0); // Changed to 7:20 PM
            return currentTime < eodOpenTime ? 'Available after 7:20 PM' : 'Submit EOD & Close Day';
          })()}
        </Button>

        <p className="text-xs text-muted-foreground text-center mt-4 flex items-center justify-center gap-1">
          <Lock className="w-3 h-3" />
          Cannot be edited after submission
        </p>
      </div>
    </motion.div>
  );
}
