import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnifiedActivity } from '@/hooks/useUnifiedWorkAnalytics';
import { useEmployeeWeeklyPerformance } from '@/hooks/useEmployeeWeeklyPerformance';
import { User, Calendar, CheckCircle2, TrendingUp, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface EmployeeHistoryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employee: UnifiedActivity | null;
    selectedDate?: Date;
}

export function EmployeeHistoryModal({ open, onOpenChange, employee, selectedDate = new Date() }: EmployeeHistoryModalProps) {
    const [activeTab, setActiveTab] = useState<'today' | 'weekly'>('today');

    // Debug log
    console.log('EmployeeHistoryModal - employee:', employee?.userName, 'userId:', employee?.userId, 'selectedDate:', selectedDate);

    const { weeklyData, loading } = useEmployeeWeeklyPerformance(employee?.userId || null, open, selectedDate);

    if (!employee) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] bg-slate-950/95 border-slate-700/50 backdrop-blur-xl flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-3">
                        <User className="w-5 h-5 text-primary" />
                        Employee Performance Profile
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 overflow-y-auto flex-1 max-h-[calc(90vh-100px)] pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
                    {/* Employee Header */}
                    <Card className="bg-gradient-to-r from-slate-900/80 to-slate-900/40 border-slate-700/50 p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-2">
                                <h2 className="text-xl font-black text-white">{employee.userName}</h2>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <Badge variant="outline" className="text-[8px] font-bold uppercase px-1.5 py-0.5 border-slate-600">
                                        {employee.department}
                                    </Badge>
                                    <Badge className="text-[8px] font-bold uppercase px-1.5 py-0.5 bg-primary/20 text-primary border-none">
                                        {employee.type}
                                    </Badge>
                                    <Badge
                                        className={cn(
                                            "text-[8px] font-bold uppercase px-1.5 py-0.5 border-none",
                                            employee.status === 'working' ? "bg-green-500/20 text-green-400" :
                                                employee.status === 'completed' ? "bg-blue-500/20 text-blue-400" :
                                                    employee.status === 'break' ? "bg-yellow-500/20 text-yellow-400" :
                                                        "bg-slate-500/20 text-slate-400"
                                        )}
                                    >
                                        {employee.status}
                                    </Badge>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className={cn(
                                    "text-4xl font-black font-mono",
                                    employee.complianceScore >= 80 ? "text-green-400" :
                                        employee.complianceScore < 50 ? "text-red-500" : "text-white"
                                )}>
                                    {employee.complianceScore}
                                </div>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Today's Score</span>
                            </div>
                        </div>
                    </Card>

                    {/* Tabs */}
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'today' | 'weekly')}>
                        <TabsList className="bg-slate-900/60 border border-slate-800 w-full">
                            <TabsTrigger value="today" className="flex-1 data-[state=active]:bg-primary/20">
                                <Clock className="w-3.5 h-3.5 mr-2" />
                                Today's Activity
                            </TabsTrigger>
                            <TabsTrigger value="weekly" className="flex-1 data-[state=active]:bg-primary/20">
                                <Calendar className="w-3.5 h-3.5 mr-2" />
                                Weekly Report
                            </TabsTrigger>
                        </TabsList>

                        {/* Today's Activity Tab */}
                        <TabsContent value="today" className="mt-4 space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                {/* Login Time */}
                                <Card className="bg-slate-900/60 border-slate-700/50 p-3">
                                    <p className="text-[9px] font-semibold text-slate-500 uppercase flex items-center gap-1 mb-1">
                                        <Clock className="w-3 h-3" />
                                        Login Time
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <p className={cn(
                                            "text-xl font-black",
                                            employee.loginTime ? "text-white" : "text-slate-600"
                                        )}>
                                            {employee.loginTime || '--:--'}
                                        </p>
                                        {employee.loginTime && (
                                            <Badge className={cn(
                                                "text-[7px] font-bold px-1.5 py-0 h-4",
                                                employee.loginTime.includes('AM') && parseInt(employee.loginTime) <= 10
                                                    ? "bg-green-500/30 text-green-400 border-none"
                                                    : "bg-red-500/30 text-red-400 border-none"
                                            )}>
                                                {employee.loginTime.includes('AM') && parseInt(employee.loginTime) <= 10 ? 'On Time' : 'Late'}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-[8px] text-slate-500 mt-1">Target: 10:15 AM</p>
                                </Card>

                                {/* Plans Count */}
                                <Card className="bg-slate-900/60 border-slate-700/50 p-3">
                                    <p className="text-[9px] font-semibold text-slate-500 uppercase flex items-center gap-1 mb-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Plans Submitted
                                    </p>
                                    <div className="flex items-baseline gap-1">
                                        <p className="text-xl font-black text-primary">{employee.metrics.plansCount}</p>
                                        <span className="text-xs text-slate-500">/ 8</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-2 mt-2">
                                        <div
                                            className="bg-gradient-to-r from-primary to-primary/70 h-2 rounded-full transition-all"
                                            style={{ width: `${Math.min(100, (employee.metrics.plansCount / 8) * 100)}%` }}
                                        />
                                    </div>
                                </Card>

                                {/* Reports Count */}
                                <Card className="bg-slate-900/60 border-slate-700/50 p-3">
                                    <p className="text-[9px] font-semibold text-slate-500 uppercase flex items-center gap-1 mb-1">
                                        <TrendingUp className="w-3 h-3" />
                                        Reports Submitted
                                    </p>
                                    <div className="flex items-baseline gap-1">
                                        <p className="text-xl font-black text-green-400">{employee.metrics.reportsCount}</p>
                                        <span className="text-xs text-slate-500">/ 8</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-2 mt-2">
                                        <div
                                            className="bg-gradient-to-r from-green-500 to-green-500/70 h-2 rounded-full transition-all"
                                            style={{ width: `${Math.min(100, (employee.metrics.reportsCount / 8) * 100)}%` }}
                                        />
                                    </div>
                                </Card>

                                {/* Late Reports */}
                                <Card className="bg-slate-900/60 border-slate-700/50 p-3">
                                    <p className="text-[9px] font-semibold text-slate-500 uppercase flex items-center gap-1 mb-1">
                                        <AlertCircle className="w-3 h-3" />
                                        Late Reports
                                    </p>
                                    <p className={cn(
                                        "text-xl font-black",
                                        employee.metrics.lateReports > 0 ? "text-red-400" : "text-green-400"
                                    )}>
                                        {employee.metrics.lateReports}
                                    </p>
                                    <p className="text-[8px] text-slate-500 mt-1">
                                        {employee.metrics.lateReports === 0 ? 'Perfect punctuality' : 'Needs improvement'}
                                    </p>
                                </Card>
                            </div>

                            {/* Quick Stats */}
                            <Card className="bg-slate-900/60 border-slate-700/50 p-3">
                                <h4 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-3">Quick Stats</h4>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                    <div className="flex items-center justify-between border-b border-slate-800/50 pb-1">
                                        <span className="text-[10px] text-slate-500">Email</span>
                                        <span className="text-[10px] text-white font-mono truncate max-w-[140px]">{employee.userEmail}</span>
                                    </div>
                                    <div className="flex items-center justify-between border-b border-slate-800/50 pb-1">
                                        <span className="text-[10px] text-slate-500">Selfies</span>
                                        <span className="text-xs text-white font-bold">{employee.metrics.selfiesCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between border-b border-slate-800/50 pb-1">
                                        <span className="text-[10px] text-slate-500">Last Active</span>
                                        <span className="text-[10px] text-white font-mono">{employee.lastActiveSlot || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center justify-between border-b border-slate-800/50 pb-1">
                                        <span className="text-[10px] text-slate-500">Work Type</span>
                                        <Badge className="text-[7px] font-bold bg-primary/20 text-primary border-none px-1.5 py-0 h-4 capitalize">
                                            {employee.type}
                                        </Badge>
                                    </div>
                                </div>
                            </Card>
                        </TabsContent>

                        {/* Weekly Report Tab */}
                        <TabsContent value="weekly" className="mt-4 space-y-4">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                    <span className="ml-2 text-slate-400">Loading weekly data...</span>
                                </div>
                            ) : weeklyData ? (
                                <>
                                    {/* Summary Stats */}
                                    <div className="grid grid-cols-4 gap-3">
                                        <Card className="bg-gradient-to-b from-slate-900/80 to-slate-900/40 border-slate-700/50 p-4 text-center">
                                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Present</p>
                                            <p className={cn(
                                                "text-3xl font-black mt-1",
                                                weeklyData.summary.presentDays >= 5 ? "text-green-400" :
                                                    weeklyData.summary.presentDays >= 3 ? "text-yellow-400" : "text-red-400"
                                            )}>
                                                {weeklyData.summary.presentDays}
                                            </p>
                                            <p className="text-[10px] text-slate-500 mt-1">/ 6 days</p>
                                        </Card>
                                        <Card className="bg-gradient-to-b from-slate-900/80 to-slate-900/40 border-slate-700/50 p-4 text-center">
                                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Late Days</p>
                                            <p className={cn(
                                                "text-3xl font-black mt-1",
                                                weeklyData.summary.lateDays === 0 ? "text-green-400" :
                                                    weeklyData.summary.lateDays <= 2 ? "text-yellow-400" : "text-red-400"
                                            )}>
                                                {weeklyData.summary.lateDays}
                                            </p>
                                            <p className="text-[10px] text-slate-500 mt-1">after 10:15</p>
                                        </Card>
                                        <Card className="bg-gradient-to-b from-slate-900/80 to-slate-900/40 border-slate-700/50 p-4 text-center">
                                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Total Plans</p>
                                            <p className={cn(
                                                "text-3xl font-black mt-1",
                                                weeklyData.summary.totalPlans >= 40 ? "text-green-400" :
                                                    weeklyData.summary.totalPlans >= 20 ? "text-yellow-400" : "text-primary"
                                            )}>
                                                {weeklyData.summary.totalPlans}
                                            </p>
                                            <p className="text-[10px] text-slate-500 mt-1">/ 48 target</p>
                                        </Card>
                                        <Card className="bg-gradient-to-b from-slate-900/80 to-slate-900/40 border-slate-700/50 p-4 text-center">
                                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Total Reports</p>
                                            <p className={cn(
                                                "text-3xl font-black mt-1",
                                                weeklyData.summary.totalReports >= 40 ? "text-green-400" :
                                                    weeklyData.summary.totalReports >= 20 ? "text-yellow-400" : "text-primary"
                                            )}>
                                                {weeklyData.summary.totalReports}
                                            </p>
                                            <p className="text-[10px] text-slate-500 mt-1">/ 48 target</p>
                                        </Card>
                                    </div>

                                    {/* Weekly Header */}
                                    <div className="flex items-center gap-2 px-2 py-2 bg-slate-900/40 rounded-lg border border-slate-800/50">
                                        <Calendar className="w-4 h-4 text-primary" />
                                        <span className="text-sm font-bold uppercase tracking-wide text-white">
                                            Week: {format(weeklyData.weekStart, 'MMM d')} - {format(weeklyData.weekEnd, 'MMM d, yyyy')}
                                        </span>
                                    </div>

                                    {/* Daily Breakdown Table */}
                                    <Card className="bg-slate-900/40 border-slate-700/50 overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-700/50 bg-slate-800/60">
                                                    <th className="text-left p-3 font-bold text-slate-300 uppercase text-[11px] tracking-wide">Day</th>
                                                    <th className="text-center p-3 font-bold text-slate-300 uppercase text-[11px] tracking-wide">Login</th>
                                                    <th className="text-center p-3 font-bold text-slate-300 uppercase text-[11px] tracking-wide">Plans</th>
                                                    <th className="text-center p-3 font-bold text-slate-300 uppercase text-[11px] tracking-wide">Reports</th>
                                                    <th className="text-center p-3 font-bold text-slate-300 uppercase text-[11px] tracking-wide">Late</th>
                                                    <th className="text-center p-3 font-bold text-slate-300 uppercase text-[11px] tracking-wide">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {weeklyData.days.map((day, index) => (
                                                    <tr key={index} className={cn(
                                                        "border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors",
                                                        day.status === 'absent' && "opacity-60"
                                                    )}>
                                                        <td className="p-3">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-white">{day.dayName}</span>
                                                                <span className="text-[10px] text-slate-500">{format(day.date, 'MMM d')}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            {day.loginTime && day.loginTime !== '----' ? (
                                                                <div className="flex flex-col items-center gap-0.5">
                                                                    <span className="font-mono text-white text-sm">{day.loginTime}</span>
                                                                    {day.isLate && (
                                                                        <Badge className="text-[7px] bg-red-500/20 text-red-400 border-none px-1 py-0">Late</Badge>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-600 text-sm">--:--</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <span className={cn(
                                                                "font-bold text-sm",
                                                                day.plansCount >= 8 ? "text-green-400" :
                                                                    day.plansCount >= 4 ? "text-yellow-400" : "text-slate-400"
                                                            )}>
                                                                {day.plansCount}
                                                            </span>
                                                            <span className="text-slate-600 text-sm">/8</span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <span className={cn(
                                                                "font-bold text-sm",
                                                                day.reportsCount >= 8 ? "text-green-400" :
                                                                    day.reportsCount >= 4 ? "text-yellow-400" : "text-slate-400"
                                                            )}>
                                                                {day.reportsCount}
                                                            </span>
                                                            <span className="text-slate-600 text-sm">/8</span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <span className={cn(
                                                                "font-bold text-sm",
                                                                day.lateReports > 0 ? "text-red-400" : "text-green-400"
                                                            )}>
                                                                {day.lateReports}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <Badge className={cn(
                                                                "text-[9px] font-bold uppercase px-2 py-0.5 border-none",
                                                                day.status === 'completed' ? "bg-green-500/20 text-green-400" :
                                                                    day.status === 'working' ? "bg-blue-500/20 text-blue-400" :
                                                                        day.status === 'absent' ? "bg-red-500/20 text-red-400" :
                                                                            "bg-yellow-500/20 text-yellow-400"
                                                            )}>
                                                                {day.status}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </Card>

                                    {/* Late Reports Warning */}
                                    {weeklyData.summary.totalLateReports > 0 && (
                                        <Card className="bg-red-500/10 border-red-500/30 p-3 flex items-center gap-3">
                                            <AlertCircle className="w-5 h-5 text-red-400" />
                                            <div>
                                                <p className="text-sm font-bold text-red-400">
                                                    {weeklyData.summary.totalLateReports} Late Report{weeklyData.summary.totalLateReports > 1 ? 's' : ''} This Week
                                                </p>
                                                <p className="text-[10px] text-red-400/70">Reports submitted after the slot deadline</p>
                                            </div>
                                        </Card>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-8 text-slate-500">
                                    <p>No weekly data available</p>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
