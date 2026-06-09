import { useState, useMemo, useEffect, useRef } from 'react';
import { useWeeklyTargets } from '@/hooks/useWeeklyTargets';
import { useWeeklyAchievements } from '@/hooks/useWeeklyAchievements';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
    CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Loader2, Target, Send, ShieldCheck, ChevronDown, ChevronUp, History, Clock, XCircle, Trophy
} from 'lucide-react';
import { format, addWeeks, subWeeks, isAfter, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function WeeklyAchievementsPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const { weeklyTarget, isLoading: targetLoading, weekInfo, coreHeadDeadlines } = useWeeklyTargets(currentDate);
    const {
        achievement, isLoading: achievementLoading, createAchievement,
        updateAchievement, addTaskAchievement, submitAchievement
    } = useWeeklyAchievements(weeklyTarget?.id);

    const [resultDialogOpen, setResultDialogOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [resultForm, setResultForm] = useState({
        actualAchievement: '',
        actualValue: '',
        status: 'completed',
        notes: '',
    });

    // Local state for achievement form (to avoid lag)
    const [localSummary, setLocalSummary] = useState('');
    const [localVictories, setLocalVictories] = useState('');
    const [localChallenges, setLocalChallenges] = useState('');
    const [savingField, setSavingField] = useState<string | null>(null);

    // Debounce timers
    const summaryTimeoutRef = useRef<NodeJS.Timeout>();
    const victoriesTimeoutRef = useRef<NodeJS.Timeout>();
    const challengesTimeoutRef = useRef<NodeJS.Timeout>();

    // Collapsible state
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

    // Sync local state with achievement data on load
    useEffect(() => {
        if (achievement) {
            setLocalSummary(achievement.overall_summary || '');
            setLocalVictories(achievement.key_achievements || '');
            setLocalChallenges(achievement.challenges_faced || '');
        }
    }, [achievement?.id]);

    // Cleanup debounce timers on unmount
    useEffect(() => {
        return () => {
            if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
            if (victoriesTimeoutRef.current) clearTimeout(victoriesTimeoutRef.current);
            if (challengesTimeoutRef.current) clearTimeout(challengesTimeoutRef.current);
        };
    }, []);

    // Debounced save for summary
    const handleSummaryChange = (value: string) => {
        setLocalSummary(value);
        setSavingField('summary');
        clearTimeout(summaryTimeoutRef.current);
        summaryTimeoutRef.current = setTimeout(() => {
            if (achievement) {
                updateAchievement.mutate({
                    achievementId: achievement.id,
                    updates: { overall_summary: value }
                });
            }
            setSavingField(null);
        }, 1500);
    };

    // Debounced save for victories
    const handleVictoriesChange = (value: string) => {
        setLocalVictories(value);
        setSavingField('victories');
        clearTimeout(victoriesTimeoutRef.current);
        victoriesTimeoutRef.current = setTimeout(() => {
            if (achievement) {
                updateAchievement.mutate({
                    achievementId: achievement.id,
                    updates: { key_achievements: value }
                });
            }
            setSavingField(null);
        }, 1500);
    };

    // Debounced save for challenges
    const handleChallengesChange = (value: string) => {
        setLocalChallenges(value);
        setSavingField('challenges');
        clearTimeout(challengesTimeoutRef.current);
        challengesTimeoutRef.current = setTimeout(() => {
            if (achievement) {
                updateAchievement.mutate({
                    achievementId: achievement.id,
                    updates: { challenges_faced: value }
                });
            }
            setSavingField(null);
        }, 1500);
    };

    const toggleTask = (taskId: string) => {
        const newExpanded = new Set(expandedTasks);
        if (newExpanded.has(taskId)) newExpanded.delete(taskId);
        else newExpanded.add(taskId);
        setExpandedTasks(newExpanded);
    };

    const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
    const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

    const handleStartAchievement = () => {
        if (!weeklyTarget) return;
        createAchievement.mutate({
            weeklyTargetId: weeklyTarget.id,
            weekStartDate: weekInfo.startDate,
            weekEndDate: weekInfo.endDate,
            weekNumber: weekInfo.weekNumber,
            year: weekInfo.year,
        });
    };

    const handleSaveResult = () => {
        if (!achievement || !selectedTask) return;

        addTaskAchievement.mutate({
            weeklyAchievementId: achievement.id,
            dailyTaskId: selectedTask.id,
            actualAchievement: resultForm.actualAchievement,
            actualValue: resultForm.actualValue ? parseFloat(resultForm.actualValue) : undefined,
            status: resultForm.status,
            notes: resultForm.notes,
        });

        setResultDialogOpen(false);
        setSelectedTask(null);
    };

    const isLoading = targetLoading || achievementLoading;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-6 pb-20"
        >
            {/* Header Section - Matched to Global UI */}
            <div className="dashboard-header flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/30 to-emerald-500/10 flex items-center justify-center shadow-lg border border-green-500/20">
                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Achievement Reports</h1>
                        <p className="text-muted-foreground mt-1">Validation of results against strategic targets</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-inner">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={handlePrevWeek}
                            className="h-8 w-8 hover:bg-white/5"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <div className="px-5 font-bold text-xs tracking-wider uppercase text-foreground/90 min-w-[200px] text-center">
                            {weekInfo.label}
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={handleNextWeek}
                            className="h-8 w-8 hover:bg-white/5"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Deadline Banners - Mirrored from Targets for consistency */}
            {(coreHeadDeadlines?.target_date || coreHeadDeadlines?.achievement_date) && (
                <div className="flex flex-wrap gap-4">
                    {coreHeadDeadlines?.target_date && (() => {
                        const deadline = new Date(coreHeadDeadlines.target_date);
                        const isLocked = !!weeklyTarget?.is_locked;
                        const lockedAt = weeklyTarget?.locked_at ? new Date(weeklyTarget.locked_at) : null;
                        
                        const isExpired = !isLocked && isAfter(new Date(), deadline);
                        const isLate = isLocked && lockedAt && isAfter(lockedAt, deadline);
                        const isCompliant = isLocked && !isLate;
                        
                        let bgColor = "bg-cyan-500/10 border-cyan-400/30 text-cyan-400";
                        let statusText = formatDistanceToNow(deadline, { addSuffix: true });
                        let statusIcon = <Clock className="w-3.5 h-3.5" />;
                        
                        if (isCompliant) {
                            bgColor = "bg-emerald-500/10 border-emerald-400/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]";
                            statusText = "COMPLIANT";
                            statusIcon = <CheckCircle2 className="w-3.5 h-3.5" />;
                        } else if (isLate) {
                            bgColor = "bg-amber-500/10 border-amber-400/40 text-amber-500";
                            statusText = "LOCKED LATE";
                            statusIcon = <AlertCircle className="w-3.5 h-3.5" />;
                        } else if (isExpired) {
                            bgColor = "bg-red-500/10 border-red-400/40 text-red-400 animate-pulse";
                            statusText = "EXPIRED";
                            statusIcon = <XCircle className="w-3.5 h-3.5 text-red-500" />;
                        }

                        return (
                            <div className={cn(
                                "flex items-center gap-4 px-5 py-3 rounded-2xl border text-sm font-medium transition-all duration-300",
                                bgColor
                            )}>
                                <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                                    <Target className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Target Setting</span>
                                    <span className="font-bold text-base leading-tight">
                                        {format(deadline, 'dd MMM, hh:mm a')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 ml-2 px-3 py-1 rounded-full bg-black/30 text-[10px] font-black tracking-wider uppercase">
                                    {statusIcon}
                                    {statusText}
                                </div>
                            </div>
                        );
                    })()}

                    {coreHeadDeadlines?.achievement_date && (() => {
                        const deadline = new Date(coreHeadDeadlines.achievement_date);
                        const isSubmitted = !!achievement?.is_submitted;
                        const submittedAt = achievement?.submitted_at ? new Date(achievement.submitted_at) : null;
                        
                        const isExpired = !isSubmitted && isAfter(new Date(), deadline);
                        const isLate = isSubmitted && submittedAt && isAfter(submittedAt, deadline);
                        const isCompliant = isSubmitted && !isLate;
                        
                        let bgColor = "bg-indigo-500/10 border-indigo-400/30 text-indigo-400";
                        let statusText = formatDistanceToNow(deadline, { addSuffix: true });
                        let statusIcon = <Clock className="w-3.5 h-3.5" />;

                        if (isCompliant) {
                            bgColor = "bg-emerald-500/10 border-emerald-400/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]";
                            statusText = "COMPLIANT";
                            statusIcon = <CheckCircle2 className="w-3.5 h-3.5" />;
                        } else if (isLate) {
                            bgColor = "bg-amber-500/10 border-amber-400/40 text-amber-500";
                            statusText = "SUBMITTED LATE";
                            statusIcon = <AlertCircle className="w-3.5 h-3.5" />;
                        } else if (isExpired) {
                            bgColor = "bg-red-500/10 border-red-400/40 text-red-400 animate-pulse";
                            statusText = "EXPIRED";
                            statusIcon = <XCircle className="w-3.5 h-3.5 text-red-500" />;
                        }

                        return (
                            <div className={cn(
                                "flex items-center gap-4 px-5 py-3 rounded-2xl border text-sm font-medium transition-all duration-300",
                                bgColor
                            )}>
                                <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Achievement Reporting</span>
                                    <span className="font-bold text-base leading-tight">
                                        {format(deadline, 'dd MMM, hh:mm a')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 ml-2 px-3 py-1 rounded-full bg-black/30 text-[10px] font-black tracking-wider uppercase">
                                    {statusIcon}
                                    {statusText}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {!weeklyTarget ? (
                <Card className="p-12 text-center border-dashed">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                    <h3 className="text-lg font-semibold mb-2">No targets found for this week</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                        You must first set and lock your targets in the "Weekly Targets" section before you can report achievements.
                    </p>
                </Card>
            ) : !achievement ? (
                <Card className="p-12 text-center border-dashed">
                    <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                    <h3 className="text-lg font-semibold mb-2">Ready to report your progress?</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                        Initializa your achievement report for this week to start logging your results for each task.
                    </p>
                    <Button onClick={handleStartAchievement} disabled={createAchievement.isPending}>
                        {createAchievement.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Start Achievement Report
                    </Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Form */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Target className="w-5 h-5 text-primary" />
                                Task Results
                            </h3>
                            <div className="space-y-4">
                                {weeklyTarget.daily_tasks?.sort((a: any, b: any) => new Date(a.task_date).getTime() - new Date(b.task_date).getTime()).map((task: any, index: number) => {
                                    const result = achievement.task_achievements?.find((r: any) => r.daily_task_id === task.id);
                                    const isExpanded = expandedTasks.has(task.id);

                                    return (
                                        <div
                                            key={task.id}
                                            className="glass-card p-0 overflow-hidden border-white/5"
                                        >
                                            {/* Header Section */}
                                            <div
                                                className={cn(
                                                    "p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors border-l-4",
                                                    result?.status === 'completed' ? 'border-l-green-500' :
                                                    result?.status === 'partial' ? 'border-l-yellow-500' :
                                                    result?.status === 'not_completed' ? 'border-l-red-500' : 'border-l-transparent'
                                                )}
                                                onClick={() => toggleTask(task.id)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Badge variant="outline" className="text-[10px] uppercase font-mono px-2 flex items-center justify-center h-5 bg-muted/40 font-bold border-white/10">
                                                        TASK {index + 1}
                                                    </Badge>
                                                    <div>
                                                        <h4 className="font-bold text-sm text-foreground/90 leading-none">{task.task_title}</h4>
                                                        {(!isExpanded && result) && (
                                                            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1 max-w-[300px]">
                                                                {result.actual_achievement}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    {result && !isExpanded && (
                                                        <Badge variant="outline" className={cn(
                                                            "font-bold uppercase text-[10px]",
                                                            result.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                                                            result.status === 'partial' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' :
                                                            'bg-red-500/10 text-red-500 border-red-500/30'
                                                        )}>
                                                            {result.status}
                                                        </Badge>
                                                    )}
                                                    <div className="flex items-center gap-1.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                                                        <span className="text-[10px] font-bold uppercase tracking-tight">Logs</span>
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Collapsible Details Section */}
                                            {isExpanded && (
                                                <div className="px-4 pb-4 pt-1 border-t border-white/5 bg-black/20">
                                                    <div className="flex items-start justify-between gap-6 py-3">
                                                        <div className="flex-1 space-y-3">
                                                            <div>
                                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Achievement Log</label>
                                                                {result ? (
                                                                    <p className="mt-1 text-sm font-medium text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                                                        {result.actual_achievement}
                                                                    </p>
                                                                ) : (
                                                                    <p className="mt-1 text-xs text-muted-foreground italic opacity-50">No achievement recorded yet for this task.</p>
                                                                )}
                                                            </div>

                                                            {result?.notes && (
                                                                <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-2 shadow-inner">
                                                                    <History className="w-3.5 h-3.5 text-primary mt-0.5" />
                                                                    <div>
                                                                        <label className="text-[10px] font-bold text-primary/70 uppercase leading-none">Evidence / Notes</label>
                                                                        <p className="text-xs text-foreground/70 mt-1">{result.notes}</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="space-y-3 min-w-[120px]">
                                                            {!achievement.is_submitted && (
                                                                <Button
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    className="w-full h-8 transition-all shadow-md font-bold text-[10px] uppercase tracking-wider bg-primary/10 hover:bg-primary hover:text-white"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedTask(task);
                                                                        setResultForm({
                                                                            actualAchievement: result?.actual_achievement || '',
                                                                            actualValue: result?.actual_value?.toString() || '',
                                                                            status: result?.status || 'completed',
                                                                            notes: result?.notes || '',
                                                                        });
                                                                        setResultDialogOpen(true);
                                                                    }}
                                                                >
                                                                    {result ? 'Update Result' : 'Log Achievement'}
                                                                </Button>
                                                            )}
                                                            {result && (
                                                                <div className="flex flex-col gap-1">
                                                                    <label className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-tight">Status</label>
                                                                    <Badge className={cn(
                                                                        "w-fit justify-center text-[10px] font-bold uppercase py-0.5",
                                                                        result.status === 'completed' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                                                        result.status === 'partial' ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' :
                                                                        'bg-red-500/20 text-red-400 border-red-500/30'
                                                                    )}>
                                                                        {result.status.replace('_', ' ')}
                                                                    </Badge>
                                                                    {result.actual_value && (
                                                                        <div className="mt-1">
                                                                            <label className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-tight">Value</label>
                                                                            <p className="text-xs font-bold text-foreground/90 tracking-wide">{result.actual_value}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>

                        <Card className="p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Send className="w-5 h-5 text-primary" />
                                Overall Reflection
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Weekly Summary</label>
                                    {achievement.is_submitted ? (
                                        <div className="min-h-[120px] p-4 rounded-xl border border-white/5 bg-black/20 text-sm whitespace-pre-wrap text-foreground/80 shadow-inner">
                                            {achievement.overall_summary || <span className="text-muted-foreground italic opacity-50">No summary provided.</span>}
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <Textarea
                                                placeholder="Summarize your week's performance..."
                                                className="min-h-[120px] resize-none"
                                                value={localSummary}
                                                onChange={(e) => handleSummaryChange(e.target.value)}
                                                disabled={achievement.is_submitted}
                                            />
                                            {savingField === 'summary' && (
                                                <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">
                                                    Saving...
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Key Victories</label>
                                        {achievement.is_submitted ? (
                                            <div className="min-h-[100px] p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-sm whitespace-pre-wrap text-emerald-400/90 shadow-inner">
                                                {achievement.key_achievements || <span className="text-emerald-500/30 italic">None logged.</span>}
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <Textarea
                                                    placeholder="Major wins..."
                                                    className="resize-none min-h-[100px]"
                                                    value={localVictories}
                                                    onChange={(e) => handleVictoriesChange(e.target.value)}
                                                    disabled={achievement.is_submitted}
                                                />
                                                {savingField === 'victories' && (
                                                    <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">
                                                        Saving...
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Challenges</label>
                                        {achievement.is_submitted ? (
                                            <div className="min-h-[100px] p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-sm whitespace-pre-wrap text-red-400/90 shadow-inner">
                                                {achievement.challenges_faced || <span className="text-red-500/30 italic">None logged.</span>}
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <Textarea
                                                    placeholder="Obstacles encountered..."
                                                    className="resize-none min-h-[100px]"
                                                    value={localChallenges}
                                                    onChange={(e) => handleChallengesChange(e.target.value)}
                                                    disabled={achievement.is_submitted}
                                                />
                                                {savingField === 'challenges' && (
                                                    <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">
                                                        Saving...
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Sidebar / Submission */}
                    <div className="space-y-6">
                        <Card className="p-6 overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-primary/5 rounded-full blur-2xl" />

                            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-6">Submission Queue</h3>

                            <div className="space-y-6">
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-muted-foreground">Status</span>
                                    <div className="flex items-center gap-2">
                                        {achievement.is_submitted ? (
                                            <Badge className="bg-green-500 hover:bg-green-600">
                                                <ShieldCheck className="w-3 h-3 mr-1" /> Submitted
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="opacity-70 animate-pulse">Drafting</Badge>
                                        )}
                                        {achievement.is_late && (
                                            <Badge variant="destructive">LATE</Badge>
                                        )}
                                    </div>
                                </div>

                                {achievement.is_submitted && (
                                    <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Performance Score</span>
                                            <span className="text-xl font-black text-foreground">{Math.round(achievement.completion_percentage)}%</span>
                                        </div>
                                        <div className="w-full bg-white/5 rounded-full h-2">
                                            <div
                                                className="h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                                                style={{ width: `${achievement.completion_percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3 pt-4 border-t">
                                    <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                                        By submitting, you confirm that these achievements are accurate and evidence-based as per IGO Chain policy.
                                    </p>
                                    {!achievement.is_submitted && (
                                        <Button
                                            className="w-full bg-authority-admin hover:bg-black text-white font-bold py-6 group"
                                            onClick={() => submitAchievement.mutate(achievement.id)}
                                            disabled={submitAchievement.isPending}
                                        >
                                            {submitAchievement.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                                            Finalize & Submit Report
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>

                        {achievement.submission_deadline && (
                            <Card className="p-4 bg-amber-50 border-amber-200 shadow-none">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                                    <div>
                                        <h4 className="text-xs font-bold text-amber-900">Deadline Notice</h4>
                                        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                                            Submission due by: <strong>{format(new Date(achievement.submission_deadline), 'PPp')}</strong>
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            )}

            {/* Result Entry Dialog */}
            <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            Log Achievement
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="p-3 bg-muted rounded-lg space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Target Task</p>
                            <p className="text-sm font-semibold">{selectedTask?.task_title}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">What was achieved?</label>
                            <Textarea
                                placeholder="Describe the outcome..."
                                className="resize-none"
                                value={resultForm.actualAchievement}
                                onChange={(e) => setResultForm(prev => ({ ...prev, actualAchievement: e.target.value }))}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Status</label>
                                <Select
                                    value={resultForm.status}
                                    onValueChange={(val) => setResultForm(prev => ({ ...prev, status: val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="partial">Partial</SelectItem>
                                        <SelectItem value="not_completed">Not Completed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Actual Value (Opt)</label>
                                <Input
                                    type="number"
                                    placeholder="e.g. 95"
                                    value={resultForm.actualValue}
                                    onChange={(e) => setResultForm(prev => ({ ...prev, actualValue: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Notes / Proof Link</label>
                            <Input
                                placeholder="Remarks or URL to evidence..."
                                value={resultForm.notes}
                                onChange={(e) => setResultForm(prev => ({ ...prev, notes: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResultDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveResult} disabled={!resultForm.actualAchievement}>Save Result</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
