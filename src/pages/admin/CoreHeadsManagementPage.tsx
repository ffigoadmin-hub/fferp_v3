import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Star, Search, Filter, UserCheck, UserX, Loader2, AlertTriangle,
    Clock, Trash2, Users, Tag, Target, CheckCircle2, LockOpen, Edit2, Calendar
} from 'lucide-react';
import { useCoreHeads } from '@/hooks/useCoreHeads';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, formatDistanceToNow, isAfter } from 'date-fns';

// ── Countdown timer cell ─────────────────────────────────────────────────────
function CountdownCell({ date }: { date: string | null | undefined }) {
    const [timeLeft, setTimeLeft] = useState('');
    useEffect(() => {
        if (!date) return;
        const tick = () => {
            const d = new Date(date);
            setTimeLeft(isAfter(new Date(), d) ? 'EXPIRED' : formatDistanceToNow(d, { addSuffix: true }));
        };
        tick();
        const id = setInterval(tick, 30_000);
        return () => clearInterval(id);
    }, [date]);
    if (!date) return <span className="text-muted-foreground text-xs">—</span>;
    const expired = isAfter(new Date(), new Date(date));
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium">{format(new Date(date), 'dd MMM, hh:mm a')}</span>
            <span className={`text-[10px] font-mono font-bold flex items-center gap-1 ${expired ? 'text-red-500' : 'text-cyan-500'}`}>
                <Clock className="w-2.5 h-2.5" />{timeLeft}
            </span>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export function CoreHeadsManagementPage() {
    const {
        users, isLoading, error,
        tagCoreHead, untagCoreHead, unlockTargets,
        bulkTagCoreHeads, bulkUntagCoreHeads,
        clearAllWeeklyData,
        globalDeadlines, setGlobalDeadlines,
    } = useCoreHeads();

    const [searchQuery, setSearchQuery] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [coreHeadOnly, setCoreHeadOnly] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Global deadline form state — synced from DB when loaded
    const [targetDeadline, setTargetDeadline] = useState('');
    const [achievementDeadline, setAchievementDeadline] = useState('');
    const [deadlinesSaved, setDeadlinesSaved] = useState(false);

    useEffect(() => {
        if (globalDeadlines.target_date) setTargetDeadline(format(new Date(globalDeadlines.target_date), "yyyy-MM-dd'T'HH:mm"));
        if (globalDeadlines.achievement_date) setAchievementDeadline(format(new Date(globalDeadlines.achievement_date), "yyyy-MM-dd'T'HH:mm"));
    }, [globalDeadlines.target_date, globalDeadlines.achievement_date]);

    const departments = useMemo(() => {
        if (!users) return [];
        return Array.from(new Set(users.map(u => u.department).filter(Boolean))).sort() as string[];
    }, [users]);

    const filteredUsers = useMemo(() => {
        if (!users) return [];
        return users.filter(user => {
            const matchSearch = !searchQuery || user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || user.email?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchDept = departmentFilter === 'all' || user.department === departmentFilter;
            const matchCH = !coreHeadOnly || user.core_head?.is_active;
            return matchSearch && matchDept && matchCH;
        });
    }, [users, searchQuery, departmentFilter, coreHeadOnly]);

    const activeCount = users?.filter(u => u.core_head?.is_active).length || 0;

    const allFilteredIds = filteredUsers.map(u => u.id);
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));
    const someSelected = selectedIds.size > 0;
    const selUntagged = filteredUsers.filter(u => selectedIds.has(u.id) && !u.core_head?.is_active);
    const selTagged = filteredUsers.filter(u => selectedIds.has(u.id) && u.core_head?.is_active);

    const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const toggleSelectAll = () => {
        if (allSelected) setSelectedIds(prev => { const n = new Set(prev); allFilteredIds.forEach(id => n.delete(id)); return n; });
        else setSelectedIds(prev => { const n = new Set(prev); allFilteredIds.forEach(id => n.add(id)); return n; });
    };
    const clearSel = () => setSelectedIds(new Set());

    const handleSaveGlobalDeadlines = () => {
        if (!targetDeadline || !achievementDeadline) return;
        setGlobalDeadlines.mutate(
            { targetDate: new Date(targetDeadline).toISOString(), achievementDate: new Date(achievementDeadline).toISOString() },
            { onSuccess: () => setDeadlinesSaved(true) }
        );
    };

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm text-muted-foreground">Loading users...</p>
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-red-500">
            <AlertTriangle className="w-8 h-8" />
            <p className="font-medium">Failed to load users</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-2xl font-bold">Core Managers Management</h2>
                    <p className="text-muted-foreground mt-1">Tag users and set global weekly deadlines</p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-lg px-4 py-1.5">{activeCount} Active Core Managers</Badge>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="flex items-center gap-2">
                                <Trash2 className="w-4 h-4" />Clear All Weekly Data
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2 text-red-500">
                                    <Trash2 className="w-5 h-5" />Clear ALL Weekly Data?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    Permanently deletes <strong>all weekly targets and achievements</strong> for every Core Manager. Cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => clearAllWeeklyData.mutate()}
                                    disabled={clearAllWeeklyData.isPending}
                                >
                                    {clearAllWeeklyData.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</> : '🗑️ Yes, Clear All'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            {/* ── GLOBAL DEADLINES PANEL ─────────────────────────────────── */}
            <Card className="border-cyan-500/20 bg-cyan-500/5">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-bold text-cyan-300">Global Weekly Deadlines</CardTitle>
                            <CardDescription className="text-xs">
                                These deadlines apply to <strong>all active Core Managers</strong> at once
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-4">
                        {/* Target Deadline */}
                        <div className="space-y-1.5 flex-1 min-w-[200px]">
                            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-cyan-400">
                                <Target className="w-3 h-3" /> Target Deadline
                            </label>
                            <Input
                                type="datetime-local"
                                value={targetDeadline}
                                onChange={e => { setTargetDeadline(e.target.value); setDeadlinesSaved(false); }}
                                className="h-9 text-sm border-cyan-500/30 focus-visible:ring-cyan-500"
                            />
                            {globalDeadlines.target_date && (
                                <p className="text-[10px] text-muted-foreground">
                                    Current: {format(new Date(globalDeadlines.target_date), 'dd MMM yyyy, hh:mm a')}
                                </p>
                            )}
                        </div>

                        {/* Achievement Deadline */}
                        <div className="space-y-1.5 flex-1 min-w-[200px]">
                            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" /> Achievement Deadline
                            </label>
                            <Input
                                type="datetime-local"
                                value={achievementDeadline}
                                onChange={e => { setAchievementDeadline(e.target.value); setDeadlinesSaved(false); }}
                                className="h-9 text-sm border-emerald-500/30 focus-visible:ring-emerald-500"
                            />
                            {globalDeadlines.achievement_date && (
                                <p className="text-[10px] text-muted-foreground">
                                    Current: {format(new Date(globalDeadlines.achievement_date), 'dd MMM yyyy, hh:mm a')}
                                </p>
                            )}
                        </div>

                        <Button
                            onClick={handleSaveGlobalDeadlines}
                            disabled={!targetDeadline || !achievementDeadline || setGlobalDeadlines.isPending}
                            className={`h-9 px-6 font-bold ${deadlinesSaved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-cyan-600 hover:bg-cyan-700'} text-white`}
                        >
                            {setGlobalDeadlines.isPending
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                                : deadlinesSaved
                                    ? <><CheckCircle2 className="w-4 h-4 mr-2" />Saved!</>
                                    : 'Apply to All Core Managers'}
                        </Button>
                    </div>
                    {activeCount > 0 && (
                        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                            <Users className="w-3 h-3" />
                            Will be set for <span className="font-bold text-cyan-400">{activeCount} Core Manager{activeCount > 1 ? 's' : ''}</span>
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* ── Filters ──────────────────────────────────────────────────── */}
            <Card className="p-4">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input placeholder="Search by name or email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
                    </div>
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger className="w-full md:w-52">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                <SelectValue placeholder="All Departments" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <button
                        type="button"
                        onClick={() => setCoreHeadOnly(v => !v)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all whitespace-nowrap
                            ${coreHeadOnly ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-muted/40 text-muted-foreground border-border hover:border-cyan-400 hover:text-cyan-400'}`}
                    >
                        <Star className={`w-3.5 h-3.5 ${coreHeadOnly ? 'fill-white' : ''}`} />
                        Core Managers Only
                        {coreHeadOnly && <span className="ml-1 bg-white/20 rounded px-1 text-xs">{activeCount}</span>}
                    </button>
                </div>
            </Card>

            {/* Bulk Toolbar */}
            {someSelected && (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 flex-wrap">
                    <div className="flex items-center gap-2 text-sm font-semibold text-cyan-400">
                        <Users className="w-4 h-4" />{selectedIds.size} selected
                    </div>
                    <div className="flex-1" />
                    {selUntagged.length > 0 && (
                        <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white flex items-center gap-2"
                            disabled={bulkTagCoreHeads.isPending}
                            onClick={() => bulkTagCoreHeads.mutate(selUntagged.map(u => u.id), { onSuccess: clearSel })}
                        >
                            {bulkTagCoreHeads.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
                            Tag {selUntagged.length}
                        </Button>
                    )}
                    {selTagged.length > 0 && (
                        <Button size="sm" variant="destructive" className="flex items-center gap-2"
                            disabled={bulkUntagCoreHeads.isPending}
                            onClick={() => bulkUntagCoreHeads.mutate(selTagged.map(u => u.id), { onSuccess: clearSel })}
                        >
                            {bulkUntagCoreHeads.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                            Untag {selTagged.length}
                        </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={clearSel} className="text-muted-foreground">Clear</Button>
                </div>
            )}

            <div className="text-sm text-muted-foreground">Showing {filteredUsers.length} of {users?.length ?? 0} users</div>

            {/* ── Users Table ───────────────────────────────────────────────── */}
            <Card>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">
                                    <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                                </TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Role / Dept</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Tagged On</TableHead>
                                <TableHead>Target Deadline</TableHead>
                                <TableHead>Achievement Deadline</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.map(user => {
                                const isCH = user.core_head?.is_active;
                                const isChecked = selectedIds.has(user.id);
                                return (
                                    <TableRow key={user.id} className={isChecked ? 'bg-cyan-500/5' : ''}>
                                        <TableCell>
                                            <Checkbox checked={isChecked} onCheckedChange={() => toggleSelect(user.id)} />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{user.name || '—'}</span>
                                                <span className="text-xs text-muted-foreground font-mono">{user.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <Badge variant="outline" className="w-fit text-[10px] uppercase">{user.role}</Badge>
                                                <span className="text-xs text-muted-foreground">{user.department || 'No Dept'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {isCH ? (
                                                <Badge className="bg-green-100 text-green-700 border-green-200">
                                                    <UserCheck className="w-3 h-3 mr-1" />Core Manager
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-gray-600">Not Tagged</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {user.core_head?.tagged_at ? format(new Date(user.core_head.tagged_at), 'MMM dd, yyyy') : '—'}
                                        </TableCell>
                                        <TableCell>
                                            {isCH && <CountdownCell date={user.core_head?.target_date} />}
                                        </TableCell>
                                        <TableCell>
                                            {isCH && <CountdownCell date={user.core_head?.achievement_date} />}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {isCH && (
                                                    <Button size="sm" variant="outline"
                                                        className="border-amber-300 text-amber-600 hover:bg-amber-50 h-8"
                                                        onClick={() => unlockTargets.mutate(user.id)}
                                                        disabled={unlockTargets.isPending}
                                                    >
                                                        {unlockTargets.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <LockOpen className="w-3 h-3 mr-1" />}
                                                        Unlock
                                                    </Button>
                                                )}
                                                {isCH ? (
                                                    <Button size="sm" variant="destructive" className="h-8"
                                                        onClick={() => untagCoreHead.mutate(user.id)}
                                                        disabled={untagCoreHead.isPending}
                                                    >
                                                        {untagCoreHead.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <UserX className="w-3.5 h-3.5 mr-1" />}
                                                        Untag
                                                    </Button>
                                                ) : (
                                                    <Button size="sm" className="h-8"
                                                        onClick={() => tagCoreHead.mutate(user.id)}
                                                        disabled={tagCoreHead.isPending}
                                                    >
                                                        {tagCoreHead.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <UserCheck className="w-3.5 h-3.5 mr-1" />}
                                                        Tag
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
                {filteredUsers.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        {coreHeadOnly ? 'No Core Managers found. Tag a user to get started.' : 'No users match your search/filter'}
                    </div>
                )}
            </Card>
        </div>
    );
}
