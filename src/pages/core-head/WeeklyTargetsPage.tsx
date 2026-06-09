import { useState } from 'react';
import { useWeeklyTargets } from '@/hooks/useWeeklyTargets';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
    Plus, Calendar, Lock, ChevronLeft, ChevronRight, Trash2, Edit2,
    Loader2, Target, AlertCircle, BarChart2, CheckCircle2, FileText, Hash, Clock,
    ShieldCheck, XCircle, Trophy
} from 'lucide-react';
import { format, addWeeks, subWeeks, isAfter, formatDistanceToNow } from 'date-fns';
import { getWeekDays } from '@/lib/weekHelpers';
import { motion, AnimatePresence } from 'framer-motion';

import { useWeeklyAchievements } from '@/hooks/useWeeklyAchievements';
import { cn } from '@/lib/utils';

export function WeeklyTargetsPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const {
        weeklyTarget, isLoading: targetLoading, createWeeklyTarget, addDailyTask,
        updateDailyTask, deleteDailyTask, lockWeeklyTarget, weekInfo,
        coreHeadDeadlines,
    } = useWeeklyTargets(currentDate);

    const { achievement, isLoading: achievementLoading } = useWeeklyAchievements(weeklyTarget?.id);
    const isLoading = targetLoading || achievementLoading;

    const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null);
    const [taskForm, setTaskForm] = useState({
        taskDate: new Date(),
        taskTitle: '',
        taskDescription: '',
        priority: 'medium',
        expectedOutcome: '',
        targetValue: '',
    });

    const weekDays = getWeekDays(weekInfo.startDate);

    const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
    const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

    const handleCreateTarget = () => {
        createWeeklyTarget.mutate();
    };

    const handleSaveTask = () => {
        if (!weeklyTarget) return;

        if (editingTask) {
            updateDailyTask.mutate({
                taskId: editingTask.id,
                updates: {
                    task_title: taskForm.taskTitle,
                    task_description: taskForm.taskDescription,
                    priority: taskForm.priority,
                    expected_outcome: taskForm.expectedOutcome,
                    target_value: taskForm.targetValue ? parseFloat(taskForm.targetValue) : null,
                    task_date: format(taskForm.taskDate, 'yyyy-MM-dd'),
                }
            });
        } else {
            addDailyTask.mutate({
                weeklyTargetId: weeklyTarget.id,
                taskDate: taskForm.taskDate,
                taskTitle: taskForm.taskTitle,
                taskDescription: taskForm.taskDescription,
                priority: taskForm.priority,
                expectedOutcome: taskForm.expectedOutcome,
                targetValue: taskForm.targetValue ? parseFloat(taskForm.targetValue) : undefined,
            });
        }

        setNewTaskDialogOpen(false);
        setEditingTask(null);
        setTaskForm({
            taskDate: new Date(),
            taskTitle: '',
            taskDescription: '',
            priority: 'medium',
            expectedOutcome: '',
            targetValue: '',
        });
    };

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
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-lg border border-primary/20">
                        <Target className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Performance Targets</h1>
                        <p className="text-muted-foreground mt-1">Strategic goal setting & monitoring</p>
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

            {/* Deadline Banners - Enhanced Logic */}
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
                            statusText = "LOCKED LATE";
                            statusIcon = <AlertCircle className="w-3.5 h-3.5" />;
                        } else if (isExpired) {
                            bgColor = "bg-red-500/10 border-red-400/40 text-red-400 animate-pulse";
                            statusText = "EXPIRED";
                            statusIcon = <XCircle className="w-3.5 h-3.5" />;
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
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                    <h3 className="text-lg font-semibold mb-2">No targets set for this week</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                        Ready to plan your week? Initialize this week's target list to start adding daily tasks.
                    </p>
                    <Button onClick={handleCreateTarget} disabled={createWeeklyTarget.isPending}>
                        {createWeeklyTarget.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                        Initialize targets for this week
                    </Button>
                </Card>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Badge variant={weeklyTarget.is_locked ? "default" : "secondary"} className="h-7 px-3">
                                {weeklyTarget.is_locked ? <Lock className="w-3 h-3 mr-1" /> : <Edit2 className="w-3 h-3 mr-1" />}
                                {weeklyTarget.is_locked ? 'Targets Locked' : 'Draft Mode'}
                            </Badge>
                            {weeklyTarget.is_unlocked_by_admin && (
                                <Badge variant="outline" className="h-7 border-yellow-200 bg-yellow-50 text-yellow-700">
                                    Unlocked by Admin
                                </Badge>
                            )}
                        </div>
                        {!weeklyTarget.is_locked && (
                            <Button
                                variant="default"
                                className="bg-black hover:bg-black/90 text-white"
                                onClick={() => lockWeeklyTarget.mutate(weeklyTarget.id)}
                                disabled={lockWeeklyTarget.isPending}
                            >
                                <Lock className="w-4 h-4 mr-2" />
                                Lock & Finalize Targets
                            </Button>
                        )}
                    </div>

                    <Card className="col-span-full">
                        <div className="p-5 flex justify-between items-center bg-black/20 border-b border-border/50">
                            <div>
                                <h4 className="font-bold text-lg flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-amber-500/80" />
                                    Weekly Action Plan
                                </h4>
                                <p className="text-xs text-muted-foreground">Strategic milestones for the selected period</p>
                            </div>
                            {!weeklyTarget.is_locked && (
                                <Button
                                    variant="default"
                                    className="bg-primary text-primary-foreground shadow flex items-center gap-2"
                                    onClick={() => {
                                        setTaskForm(prev => ({ ...prev, taskDate: new Date() }));
                                        setNewTaskDialogOpen(true);
                                    }}
                                >
                                    <Plus className="w-4 h-4" />
                                    Add New Task
                                </Button>
                            )}
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {weeklyTarget.daily_tasks?.sort((a: any, b: any) => new Date(a.task_date).getTime() - new Date(b.task_date).getTime()).map((task: any, index: number) => (
                                <div
                                    key={task.id}
                                    className={cn(
                                        "group p-5 rounded-2xl transition-all relative flex flex-col h-full",
                                        "glass-card border-white/5",
                                        weeklyTarget.is_locked 
                                            ? "opacity-90 shadow-sm brightness-90" 
                                            : "hover:border-primary/30 hover:shadow-glow-primary transition-all duration-300"
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex flex-col gap-1 pr-12">
                                            <Badge variant="outline" className="w-fit text-[10px] font-bold bg-muted/50">
                                                TASK {index + 1}
                                            </Badge>
                                            <h5 className="font-bold text-sm leading-tight text-foreground/90">{task.task_title}</h5>
                                        </div>
                                        <Badge variant="outline" className={cn(
                                            "shrink-0 text-[10px] uppercase px-2 h-5 font-bold",
                                            task.priority === 'high' ? 'border-red-500/20 text-red-500 bg-red-500/10' :
                                            task.priority === 'medium' ? 'border-amber-500/20 text-amber-500 bg-amber-500/10' :
                                            'border-primary/20 text-primary bg-primary/10'
                                        )}>
                                            {task.priority}
                                        </Badge>
                                    </div>
                                    {task.task_description && (
                                        <div className="flex-1 mt-1">
                                            <p className="text-[11px] text-muted-foreground/80 leading-relaxed line-clamp-3">
                                                {task.task_description}
                                            </p>
                                        </div>
                                    )}

                                    {/* Locked Task Indicator */}
                                    {weeklyTarget.is_locked && (
                                        <div className="mt-4 pt-3 border-t border-dashed flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                                            <div className="flex items-center gap-1">
                                                <ShieldCheck className="w-3 h-3 text-primary/50" />
                                                Finalized
                                            </div>
                                            {task.target_value && (
                                                <div className="flex items-center gap-1">
                                                    <Target className="w-3 h-3" />
                                                    Goal: {task.target_value}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Action Buttons - Protected by Lock */}
                                    <div className={cn(
                                        "absolute top-3 right-3 flex flex-col gap-1 transition-all duration-300",
                                        weeklyTarget.is_locked ? "opacity-0 pointer-events-none scale-75" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 bg-background/90 backdrop-blur-sm rounded-lg p-1 shadow-md border"
                                    )}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-primary hover:bg-primary/10"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingTask(task);
                                                setTaskForm({
                                                    taskDate: new Date(task.task_date),
                                                    taskTitle: task.task_title,
                                                    taskDescription: task.task_description || '',
                                                    priority: task.priority,
                                                    expectedOutcome: task.expected_outcome || '',
                                                    targetValue: task.target_value ? task.target_value.toString() : '',
                                                });
                                                setNewTaskDialogOpen(true);
                                            }}
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteDailyTask.mutate(task.id);
                                            }}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {(!weeklyTarget.daily_tasks || weeklyTarget.daily_tasks.length === 0) && (
                                <div className="col-span-full h-40 flex flex-col items-center justify-center text-center opacity-40 border-2 border-dashed rounded-xl border-border">
                                    <Target className="w-10 h-10 mb-3 text-muted-foreground" />
                                    <p className="text-sm font-medium">No tasks defined</p>
                                    <p className="text-xs text-muted-foreground mt-1">Click "Add New Task" to set your targets for the week</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {/* Task Dialog - Premium Redesign */}
            <Dialog open={newTaskDialogOpen} onOpenChange={(open) => {
                setNewTaskDialogOpen(open);
                if (!open) { setEditingTask(null); }
            }}>
                <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
                    {/* Header */}
                    <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-cyan-500/5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                                {editingTask ? <Edit2 className="w-4 h-4 text-primary" /> : <Plus className="w-4 h-4 text-primary" />}
                            </div>
                            <div>
                                <DialogTitle className="text-base font-bold">
                                    {editingTask ? 'Edit Task' : 'Add New Task'}
                                </DialogTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Set task details and scheduling
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-5 space-y-5">
                        {/* Date field removed */}

                        {/* Title */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                <FileText className="w-3.5 h-3.5" /> Title <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <Input
                                    placeholder="What needs to be done?"
                                    value={taskForm.taskTitle}
                                    maxLength={80}
                                    className="pr-12 h-10"
                                    onChange={(e) => setTaskForm(prev => ({ ...prev, taskTitle: e.target.value }))}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums">
                                    {taskForm.taskTitle.length}/80
                                </span>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                <FileText className="w-3.5 h-3.5" /> Description
                            </label>
                            <Textarea
                                placeholder="Describe the task in detail..."
                                className="resize-none h-20 text-sm"
                                value={taskForm.taskDescription}
                                onChange={(e) => setTaskForm(prev => ({ ...prev, taskDescription: e.target.value }))}
                            />
                        </div>

                        {/* Priority chips */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                <AlertCircle className="w-3.5 h-3.5" /> Priority
                            </label>
                            <div className="flex gap-2">
                                {[
                                    { value: 'low', label: 'Low', color: 'border-blue-300 text-blue-600 bg-blue-50 data-[active=true]:bg-blue-500 data-[active=true]:text-white data-[active=true]:border-blue-500' },
                                    { value: 'medium', label: 'Medium', color: 'border-yellow-300 text-yellow-600 bg-yellow-50 data-[active=true]:bg-yellow-500 data-[active=true]:text-white data-[active=true]:border-yellow-500' },
                                    { value: 'high', label: 'High', color: 'border-red-300 text-red-600 bg-red-50 data-[active=true]:bg-red-500 data-[active=true]:text-white data-[active=true]:border-red-500' },
                                ].map(p => (
                                    <button
                                        key={p.value}
                                        type="button"
                                        data-active={taskForm.priority === p.value}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${p.color}`}
                                        onClick={() => setTaskForm(prev => ({ ...prev, priority: p.value }))}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Target Value + Expected Outcome */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    <Hash className="w-3.5 h-3.5" /> Target Value
                                    <span className="normal-case font-normal text-muted-foreground/60">(opt)</span>
                                </label>
                                <Input
                                    type="number"
                                    placeholder="e.g. 100"
                                    className="h-10"
                                    value={taskForm.targetValue}
                                    onChange={(e) => setTaskForm(prev => ({ ...prev, targetValue: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Success Criteria
                                </label>
                                <Input
                                    placeholder="What determines success?"
                                    className="h-10"
                                    value={taskForm.expectedOutcome}
                                    onChange={(e) => setTaskForm(prev => ({ ...prev, expectedOutcome: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 pb-5 flex gap-3">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => setNewTaskDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="flex-1 bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/90 hover:to-cyan-500/90 text-white font-semibold shadow-md"
                            onClick={handleSaveTask}
                            disabled={!taskForm.taskTitle || addDailyTask.isPending || updateDailyTask.isPending}
                        >
                            {(addDailyTask.isPending || updateDailyTask.isPending)
                                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            {editingTask ? 'Update Task' : 'Save Task'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
