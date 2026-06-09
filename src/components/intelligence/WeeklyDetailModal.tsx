import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Calendar, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface DayData {
    date: string;
    averageScore: number;
    effectiveCount: number;
    laggingCount: number;
    totalEmployees: number;
}

interface WeeklyDetailModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    dayData: DayData | null;
}

export function WeeklyDetailModal({ open, onOpenChange, dayData }: WeeklyDetailModalProps) {
    if (!dayData) return null;

    const effectivePercentage = dayData.totalEmployees > 0
        ? Math.round((dayData.effectiveCount / dayData.totalEmployees) * 100)
        : 0;
    const laggingPercentage = dayData.totalEmployees > 0
        ? Math.round((dayData.laggingCount / dayData.totalEmployees) * 100)
        : 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl bg-slate-950/95 border-slate-700/50 backdrop-blur-xl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-primary" />
                        Daily Performance Overview
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Day Header */}
                    <Card className="bg-gradient-to-r from-slate-900/80 to-slate-900/40 border-slate-700/50 p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase">
                                    {format(new Date(dayData.date), 'EEEE')}
                                </p>
                                <h2 className="text-2xl font-black text-white">
                                    {format(new Date(dayData.date), 'MMMM d, yyyy')}
                                </h2>
                            </div>
                            <div className="text-right">
                                <div className={cn(
                                    "text-4xl font-black font-mono",
                                    dayData.averageScore >= 80 ? "text-green-400" :
                                        dayData.averageScore >= 60 ? "text-yellow-400" : "text-red-500"
                                )}>
                                    {dayData.averageScore}%
                                </div>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Org Average
                                </span>
                            </div>
                        </div>
                    </Card>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3">
                        <Card className="bg-slate-900/60 border-slate-700/50 p-4 text-center">
                            <Users className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                            <p className="text-2xl font-black text-white">{dayData.totalEmployees}</p>
                            <p className="text-[9px] font-semibold text-slate-500 uppercase">Total Employees</p>
                        </Card>
                        <Card className="bg-green-500/10 border-green-500/30 p-4 text-center">
                            <TrendingUp className="w-5 h-5 text-green-400 mx-auto mb-2" />
                            <p className="text-2xl font-black text-green-400">{dayData.effectiveCount}</p>
                            <p className="text-[9px] font-semibold text-green-400/70 uppercase">Effective</p>
                        </Card>
                        <Card className="bg-red-500/10 border-red-500/30 p-4 text-center">
                            <AlertCircle className="w-5 h-5 text-red-400 mx-auto mb-2" />
                            <p className="text-2xl font-black text-red-400">{dayData.laggingCount}</p>
                            <p className="text-[9px] font-semibold text-red-400/70 uppercase">Lagging</p>
                        </Card>
                    </div>

                    {/* Progress Bars */}
                    <Card className="bg-slate-900/40 border-slate-700/50 p-4 space-y-4">
                        <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Performance Distribution</h4>

                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-green-400 font-bold">Effective Employees</span>
                                    <span className="text-green-400 font-mono">{effectivePercentage}%</span>
                                </div>
                                <Progress value={effectivePercentage} className="h-3 bg-slate-800" />
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-red-400 font-bold">Lagging Employees</span>
                                    <span className="text-red-400 font-mono">{laggingPercentage}%</span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-3">
                                    <div
                                        className="bg-gradient-to-r from-red-500 to-red-400 h-3 rounded-full transition-all"
                                        style={{ width: `${laggingPercentage}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Performance Insights */}
                    <Card className={cn(
                        "p-4 flex items-center gap-3",
                        dayData.averageScore >= 80
                            ? "bg-green-500/10 border-green-500/30"
                            : dayData.averageScore >= 60
                                ? "bg-yellow-500/10 border-yellow-500/30"
                                : "bg-red-500/10 border-red-500/30"
                    )}>
                        {dayData.averageScore >= 80 ? (
                            <>
                                <TrendingUp className="w-5 h-5 text-green-400" />
                                <div>
                                    <p className="text-sm font-bold text-green-400">Excellent Performance Day</p>
                                    <p className="text-[10px] text-green-400/70">Team exceeded compliance targets</p>
                                </div>
                            </>
                        ) : dayData.averageScore >= 60 ? (
                            <>
                                <AlertCircle className="w-5 h-5 text-yellow-400" />
                                <div>
                                    <p className="text-sm font-bold text-yellow-400">Moderate Performance</p>
                                    <p className="text-[10px] text-yellow-400/70">Some employees need attention</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <AlertCircle className="w-5 h-5 text-red-400" />
                                <div>
                                    <p className="text-sm font-bold text-red-400">Below Target</p>
                                    <p className="text-[10px] text-red-400/70">Immediate action required</p>
                                </div>
                            </>
                        )}
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    );
}
