import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Search, Filter, Eye, CheckCircle2, TrendingUp, Users, Target,
    Loader2, AlertCircle, Clock, Calendar, Lock
} from 'lucide-react';
import { format, isAfter } from 'date-fns';
import { getWeekInfo } from '@/lib/weekHelpers';

// ── Data fetching ─────────────────────────────────────────────────────────────
function useMonitorData() {
    const weekInfo = getWeekInfo();
    const weekStart = format(weekInfo.startDate, 'yyyy-MM-dd');

    // 1. All active Core Managers with their profile
    const { data: coreHeads, isLoading: loadingCH, error: errorCH } = useQuery({
        queryKey: ['monitor-core-heads'],
        queryFn: async () => {
            const { data: ch, error } = await (supabase.from('core_heads') as any)
                .select('id, user_id, is_active, tagged_at, target_date, achievement_date, profiles:profiles!core_heads_user_id_fkey(id, name, email, department, role)')
                .eq('is_active', true)
                .order('tagged_at', { ascending: false });
            if (error) {
                // core_heads is an IGO-Chain table — silently return empty in FFERPv2
                const isMissing = error?.code === 'PGRST205' || error?.message?.includes('schema cache');
                if (isMissing) return [] as any[];
                console.error('[Dashboard] error loading core_heads:', error);
                throw error;
            }
            return (ch || []) as any[];
        },
        refetchInterval: 30_000, // real-time-ish: poll every 30s
    });

    // 2. All weekly targets (with tasks) – join later
    const { data: weeklyTargets, isLoading: loadingWT, error: errorWT } = useQuery({
        queryKey: ['monitor-weekly-targets'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('weekly_targets')
                .select('*, daily_tasks(*)')
                .order('week_start_date', { ascending: false });
            if (error) {
                const isMissing = error?.code === 'PGRST205' || (error as any)?.message?.includes('schema cache');
                if (isMissing) return [] as any[];
                console.error('[Dashboard] error loading weekly_targets:', error);
                throw error;
            }
            return (data || []) as any[];
        },
        refetchInterval: 30_000,
    });

    // 3. All weekly achievements
    const { data: weeklyAchievements, isLoading: loadingWA, error: errorWA } = useQuery({
        queryKey: ['monitor-weekly-achievements'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('weekly_achievements')
                .select('*, task_achievements(*)')
                .order('week_start_date', { ascending: false });
            if (error) {
                const isMissing = error?.code === 'PGRST205' || (error as any)?.message?.includes('schema cache');
                if (isMissing) return [] as any[];
                console.error('[Dashboard] error loading weekly_achievements:', error);
                throw error;
            }
            return (data || []) as any[];
        },
        refetchInterval: 30_000,
    });

    return {
        coreHeads: coreHeads || [],
        weeklyTargets: weeklyTargets || [],
        weeklyAchievements: weeklyAchievements || [],
        weekStart,
        weekInfo,
        isLoading: loadingCH || loadingWT || loadingWA,
        error: errorCH || errorWT || errorWA
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcCompletion(tasks: any[]): number {
    if (!tasks || tasks.length === 0) return 0;
    const done = tasks.filter((t: any) => t.status === 'completed' || t.is_completed).length;
    return Math.round((done / tasks.length) * 100);
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export function WeeklyAchievementsDashboard() {
    const [searchQuery, setSearchQuery] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedRow, setSelectedRow] = useState<any>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const { coreHeads, weeklyTargets, weeklyAchievements, weekStart, weekInfo, isLoading, error } = useMonitorData();

    // Build rows: one row per Core Manager, joined with their THIS-WEEK target & achievement
    const rows = useMemo(() => {
        return coreHeads.map((ch: any) => {
            const profile = ch.profiles || {};
            const allTargets = weeklyTargets.filter((wt: any) => wt.core_head_id === ch.user_id);
            const thisWeekTarget = allTargets.find((wt: any) => wt.week_start_date === weekStart);
            const allSubmitted = allTargets.filter((wt: any) => wt.is_locked);
            
            const allAch = weeklyAchievements.filter((wa: any) => wa.core_head_id === ch.user_id);
            const thisWeekAch = allAch.find((wa: any) => wa.weekly_target_id === thisWeekTarget?.id);

            const completion = thisWeekAch ? (thisWeekAch.completion_percentage || 0) : 0;

            const achievementDeadline = ch.achievement_date ? new Date(ch.achievement_date) : null;
            let lateFlag = false;
            if (achievementDeadline) {
                if (thisWeekAch?.is_submitted && thisWeekAch.submitted_at) {
                    lateFlag = isAfter(new Date(thisWeekAch.submitted_at), achievementDeadline);
                } else {
                    lateFlag = isAfter(new Date(), achievementDeadline);
                }
            }

            return {
                coreHeadId: ch.user_id,
                coreHeadDbId: ch.id,
                name: profile.name || 'Unknown',
                email: profile.email || '',
                department: profile.department || '',
                role: profile.role || '',
                targetDeadline: ch.target_date,
                achievementDeadline: ch.achievement_date,
                thisWeekTarget,
                thisWeekAch,
                allSubmitted,
                completion,
                isSubmitted: thisWeekAch?.is_submitted || false,
                isLate: lateFlag,
                submittedAt: thisWeekAch?.submitted_at || null,
                weekNumber: weekInfo.weekNumber,
            };
        });
    }, [coreHeads, weeklyTargets, weeklyAchievements, weekStart, weekInfo]);

    // Metrics
    const metrics = useMemo(() => {
        const submitted = rows.filter(r => r.isSubmitted);
        const locked = rows.filter(r => !r.isSubmitted && r.thisWeekTarget?.is_locked);
        const ongoing = rows.filter(r => !r.isSubmitted && !r.thisWeekTarget?.is_locked && r.thisWeekTarget);
        const notStarted = rows.filter(r => !r.thisWeekTarget);

        const avgCompletion = submitted.length > 0
            ? Math.round(submitted.reduce((s, r) => s + r.completion, 0) / submitted.length)
            : 0;
        const late = rows.filter(r => r.isLate).length;

        return {
            totalCoreHeads: rows.length,
            submittedThisWeek: submitted.length,
            lockedThisWeek: locked.length,
            ongoingThisWeek: ongoing.length,
            notStartedThisWeek: notStarted.length,
            averageCompletion: avgCompletion,
            lateSubmissions: late,
        };
    }, [rows]);

    // Unique departments from Core Managers
    const departments = useMemo(() => {
        return Array.from(new Set(rows.map(r => r.department).filter(Boolean))).sort() as string[];
    }, [rows]);

    // Filtered rows
    const filtered = useMemo(() => {
        return rows.filter(r => {
            const mSearch = !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.department.toLowerCase().includes(searchQuery.toLowerCase());
            const mDept = departmentFilter === 'all' || r.department === departmentFilter;
            const mStatus =
                statusFilter === 'all' ||
                (statusFilter === 'submitted' && r.isSubmitted) ||
                (statusFilter === 'pending' && !r.isSubmitted) ||
                (statusFilter === 'late' && r.isLate);
            return mSearch && mDept && mStatus;
        });
    }, [rows, searchQuery, departmentFilter, statusFilter]);

    if (isLoading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
    );

    if (error) {
        const isMissing = (error as any)?.code === 'PGRST205' || (error as any)?.message?.includes('schema cache');
        return (
            <div className={`p-6 rounded-lg flex flex-col items-center justify-center border ${isMissing ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                <AlertCircle className="w-10 h-10 mb-2" />
                <h3 className="font-bold text-lg">{isMissing ? 'Feature Not Available' : 'Failed to load dashboard data'}</h3>
                <p className="opacity-90 mt-1 max-w-lg text-center">
                    {isMissing
                        ? 'Weekly Performance Hub uses IGO Chain tables not present in the Farmers Factory ERP database.'
                        : (error instanceof Error ? error.message : JSON.stringify(error))
                    }
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold">Weekly Performance Hub</h2>
                    <p className="text-muted-foreground mt-1">
                        Monitor Core Manager targets and achievements
                    </p>
                </div>
                <Badge variant="outline" className="text-sm px-3 py-1 self-start md:self-auto">
                    <Calendar className="w-3.5 h-3.5 mr-1.5" />
                    {format(weekInfo.startDate, 'dd MMM')} – {format(weekInfo.endDate, 'dd MMM yyyy')}
                </Badge>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {[
                    { label: 'Total Managers', value: metrics.totalCoreHeads, subtext: 'Active', color: 'blue', icon: Users, gradient: 'from-blue-500/20 to-transparent' },
                    { label: 'Submitted', value: metrics.submittedThisWeek, subtext: 'Weekly', color: 'emerald', icon: CheckCircle2, gradient: 'from-emerald-500/20 to-transparent' },
                    { label: 'Locked', value: metrics.lockedThisWeek, subtext: 'Finalized', color: 'indigo', icon: Lock, gradient: 'from-indigo-500/20 to-transparent' },
                    { label: 'Ongoing', value: metrics.ongoingThisWeek, subtext: 'In Draft', color: 'amber', icon: Clock, gradient: 'from-amber-500/20 to-transparent' },
                    { label: 'Pending', value: metrics.notStartedThisWeek, subtext: 'No Target', color: 'slate', icon: Calendar, gradient: 'from-slate-500/20 to-transparent' },
                    { label: 'Avg Comp.', value: `${metrics.averageCompletion}%`, subtext: 'Performance', color: 'cyan', icon: TrendingUp, gradient: 'from-cyan-500/20 to-transparent' },
                    { label: 'Late', value: metrics.lateSubmissions, subtext: 'Past Due', color: 'rose', icon: AlertCircle, gradient: 'from-rose-500/20 to-transparent' },
                ].map((item, idx) => (
                    <Card key={idx} className="p-4 border-none shadow-2xl bg-slate-900/40 backdrop-blur-xl hover:bg-slate-900/60 transition-all border-t border-white/5 group overflow-hidden relative">
                        <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                        <div className={`absolute -top-2 -right-2 p-2 opacity-[0.03] group-hover:opacity-10 transition-opacity`}>
                            <item.icon className="w-16 h-16" />
                        </div>
                        <div className="flex flex-col items-center text-center space-y-1.5 relative z-10">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">
                                {item.label}
                            </p>
                            <p className="text-3xl font-black tracking-tight text-white leading-none py-1 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                                {item.value}
                            </p>
                            <p className={`text-[9px] font-bold uppercase tracking-wider leading-none text-${item.color}-400/80`}>
                                {item.subtext}
                            </p>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <Card className="p-4 bg-slate-900/40 backdrop-blur-xl border-white/5 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="flex flex-col lg:flex-row gap-3 relative z-10">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <Input 
                            placeholder="Search by name or department..." 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            className="pl-10 bg-slate-950/40 border-white/5 focus:border-primary/50 transition-all placeholder:text-slate-600" 
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                            <SelectTrigger className="w-44 bg-slate-950/40 border-white/5 focus:ring-primary/20">
                                <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-primary/60" /><SelectValue placeholder="Department" /></div>
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10">
                                <SelectItem value="all">All Departments</SelectItem>
                                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-40 bg-slate-950/40 border-white/5 focus:ring-primary/20">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10">
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="submitted">✅ Submitted</SelectItem>
                                <SelectItem value="pending">⏳ Pending</SelectItem>
                                <SelectItem value="late">🔴 Late</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Card>

            {/* Table */}
            <Card className="bg-slate-900/40 backdrop-blur-xl border-white/5 shadow-2xl overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none opacity-50" />
                <div className="overflow-x-auto relative z-10">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-white/5 hover:bg-transparent bg-slate-950/30">
                                <TableHead className="text-slate-400 font-bold uppercase text-[10px] tracking-widest py-4">Core Manager</TableHead>
                                <TableHead className="text-slate-400 font-bold uppercase text-[10px] tracking-widest py-4">Department</TableHead>
                                <TableHead className="text-slate-400 font-bold uppercase text-[10px] tracking-widest py-4">Targets This Week</TableHead>
                                <TableHead className="text-slate-400 font-bold uppercase text-[10px] tracking-widest py-4">Task Completion</TableHead>
                                <TableHead className="text-slate-400 font-bold uppercase text-[10px] tracking-widest py-4">Locked At</TableHead>
                                <TableHead className="text-slate-400 font-bold uppercase text-[10px] tracking-widest py-4">Status</TableHead>
                                <TableHead className="text-right text-slate-400 font-bold uppercase text-[10px] tracking-widest py-4">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map(row => (
                                <TableRow key={row.coreHeadId} className="border-white/5 transition-colors group">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-semibold">{row.name}</span>
                                            <span className="text-xs text-muted-foreground font-mono">{row.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm">{row.department || '—'}</span>
                                            <Badge variant="outline" className="w-fit text-[10px] uppercase">{row.role}</Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-medium">
                                                {row.thisWeekTarget
                                                    ? `${(row.thisWeekTarget.daily_tasks || []).length} tasks`
                                                    : <span className="text-muted-foreground italic text-xs">Not initialized</span>
                                                }
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {row.allSubmitted.length} total locked weeks
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {row.isSubmitted ? (
                                            <div className="flex flex-col gap-1 w-36">
                                                <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                                                    <span>{row.completion}%</span>
                                                </div>
                                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                                                    <div
                                                        className={`h-2 rounded-full transition-all ${row.completion >= 80 ? 'bg-green-500' : row.completion >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                        style={{ width: `${row.completion}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ) : <span className="text-muted-foreground text-xs italic">—</span>}
                                    </TableCell>
                                    <TableCell>
                                        {row.submittedAt ? (
                                            <div className="flex flex-col">
                                                <span className="text-xs font-medium">{format(new Date(row.submittedAt), 'dd MMM, hh:mm a')}</span>
                                                {row.isLate && (
                                                    <span className="text-[10px] text-red-500 font-bold flex items-center gap-0.5">
                                                        <Clock className="w-2.5 h-2.5" /> After deadline
                                                    </span>
                                                )}
                                            </div>
                                        ) : <span className="text-muted-foreground italic text-xs">—</span>}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {row.isSubmitted ? (
                                                <Badge className="bg-green-100 text-green-700 border-green-200">
                                                    <CheckCircle2 className="w-3 h-3 mr-1" />Submitted
                                                </Badge>
                                            ) : row.thisWeekTarget?.is_locked ? (
                                                <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                                                    <Lock className="w-3 h-3 mr-1" />Locked
                                                </Badge>
                                            ) : row.thisWeekTarget ? (
                                                <Badge variant="secondary">Draft</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-muted-foreground">Not Started</Badge>
                                            )}
                                            {row.isLate && <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-200">Late</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            disabled={!row.thisWeekTarget}
                                            onClick={() => { setSelectedRow(row); setDetailsOpen(true); }}
                                        >
                                            <Eye className="w-4 h-4 mr-1 text-primary" />
                                            View
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {filtered.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        {coreHeads.length === 0 ? 'No active Core Managers tagged yet.' : 'No users match your filters.'}
                    </div>
                )}
            </Card>

            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] p-0 overflow-hidden flex flex-col bg-slate-950 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
                    <DialogHeader className="p-6 border-b border-white/5 relative z-10 bg-slate-900/50 backdrop-blur-xl">
                        <DialogTitle className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <Target className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-lg font-black text-white tracking-tight">Weekly Performance Review</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-slate-400">{selectedRow?.name}</span>
                                    <span className="text-slate-600">•</span>
                                    <Badge variant="outline" className="text-[10px] h-5 bg-slate-800 border-white/5 text-slate-300 font-bold uppercase tracking-wider">{selectedRow?.department}</Badge>
                                </div>
                            </div>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {selectedRow?.thisWeekTarget ? (
                            <>
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div className="p-3 rounded-xl bg-muted/40 border text-center">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Tasks</p>
                                        <p className="text-2xl font-black mt-0.5">{(selectedRow.thisWeekTarget.daily_tasks || []).length}</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-muted/40 border text-center">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Completion</p>
                                        <p className="text-2xl font-black mt-0.5">{Math.round(selectedRow.completion)}%</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-muted/40 border text-center">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Status</p>
                                        <p className="text-sm font-bold mt-1">{selectedRow.isSubmitted ? '✅ Submitted' : selectedRow.thisWeekTarget?.is_locked ? '🔒 Locked' : '✏️ Draft'}</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {[...(selectedRow.thisWeekTarget.daily_tasks || [])].sort((a: any, b: any) => new Date(a.task_date).getTime() - new Date(b.task_date).getTime()).map((task: any, index: number) => {
                                        const result = selectedRow.thisWeekAch?.task_achievements?.find((r: any) => r.daily_task_id === task.id);
                                        return (
                                            <Card key={task.id} className="p-5 bg-slate-900/40 border-white/5 backdrop-blur-md shadow-lg hover:shadow-cyan-500/5 transition-all group relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-slate-800 group-hover:bg-primary/40 transition-colors" />
                                                <div className="flex items-start justify-between gap-4 relative z-10">
                                                    <div className="flex-1 space-y-3">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest font-mono">
                                                                TASK {index + 1}
                                                            </span>
                                                            <h5 className="font-bold text-base tracking-tight text-white/90">{task.task_title}</h5>
                                                            <Badge variant="outline" className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold ${
                                                                task.priority === 'high' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                                                                task.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                                                                'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                                            }`}>
                                                                {task.priority}
                                                            </Badge>
                                                        </div>
                                                        
                                                        <div className="space-y-1.5">
                                                            {task.task_description && <p className="text-sm text-slate-400 leading-relaxed">{task.task_description}</p>}
                                                            {task.expected_outcome && (
                                                                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium italic">
                                                                    <CheckCircle2 className="w-3.5 h-3.5 text-primary/40" />
                                                                    <span>{task.expected_outcome}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {result && (
                                                            <div className="mt-4 p-4 rounded-xl border border-white/5 bg-slate-950/50 backdrop-blur-sm relative overflow-hidden group/ach">
                                                                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover/ach:opacity-100 transition-opacity" />
                                                                <p className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-[0.15em] flex items-center gap-2">
                                                                     <Target className="w-3 h-3 text-primary/60" /> Logged Achievement
                                                                </p>
                                                                <p className="text-sm font-semibold text-slate-200 leading-relaxed">
                                                                    {result.actual_achievement}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                                        {result ? (
                                                            <Badge className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-xl ${
                                                                result.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 
                                                                result.status === 'partial' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : 
                                                                'bg-rose-500/15 text-rose-400 border-rose-500/20'
                                                            }`}>
                                                                <div className="flex items-center gap-1.5">
                                                                    {result.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                                                                    {result.status.replace('_', ' ')}
                                                                </div>
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest opacity-40 bg-slate-800">
                                                                Pending
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                                {selectedRow.thisWeekAch && selectedRow.thisWeekAch.overall_summary && (
                                    <div className="mt-6 space-y-4 border-t pt-6">
                                        <h4 className="font-bold text-lg">Overall Reflection</h4>
                                        <div className="p-4 rounded-xl border bg-slate-50 text-sm whitespace-pre-wrap text-slate-800 shadow-sm">
                                            {selectedRow.thisWeekAch.overall_summary}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p>This Core Manager hasn't initialized targets for Week {selectedRow?.weekNumber} yet.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
