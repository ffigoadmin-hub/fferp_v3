import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { UnifiedActivity } from '@/hooks/useUnifiedWorkAnalytics';
import { Trophy, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopPerformersModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    activities: UnifiedActivity[];
}

export function TopPerformersModal({ open, onOpenChange, activities }: TopPerformersModalProps) {
    // Calculate org-wide metrics
    const totalEmployees = activities.length;
    const averageCompliance = totalEmployees > 0
        ? Math.round(activities.reduce((sum, a) => sum + a.complianceScore, 0) / totalEmployees)
        : 0;

    const effectiveCount = activities.filter(a => a.complianceScore >= 70).length;
    const laggingCount = activities.filter(a => a.complianceScore < 70).length;

    // Get top 20 performers
    const topPerformers = [...activities]
        .sort((a, b) => b.complianceScore - a.complianceScore)
        .slice(0, 20);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[85vh] bg-slate-950/95 border-slate-800 backdrop-blur-xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-wider text-white flex items-center gap-3">
                        <Trophy className="w-6 h-6 text-primary" />
                        Organizational Intelligence
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 overflow-y-auto pr-2">
                    {/* Org Compliance Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Overall Score */}
                        <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30 p-6 backdrop-blur-xl">
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Org Compliance</p>
                                <div className="flex items-baseline gap-2">
                                    <h2 className="text-5xl font-black text-white">{averageCompliance}</h2>
                                    <span className="text-2xl font-bold text-primary">%</span>
                                </div>
                                <p className="text-xs text-slate-400">Overall productivity score today</p>
                            </div>
                        </Card>

                        {/* Effective */}
                        <Card className="bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/30 p-6 backdrop-blur-xl">
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <TrendingUp className="w-3 h-3" />
                                    Effective
                                </p>
                                <h2 className="text-5xl font-black text-green-400">{effectiveCount}</h2>
                                <p className="text-xs text-slate-400">Personnel ≥ 70% compliance</p>
                            </div>
                        </Card>

                        {/* Lagging */}
                        <Card className="bg-gradient-to-br from-red-500/20 to-red-500/5 border-red-500/30 p-6 backdrop-blur-xl">
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <AlertTriangle className="w-3 h-3" />
                                    Lagging
                                </p>
                                <h2 className="text-5xl font-black text-red-400">{laggingCount}</h2>
                                <p className="text-xs text-slate-400">Personnel &lt; 70% compliance</p>
                            </div>
                        </Card>
                    </div>

                    {/* Top 20 Performers */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 px-2">
                            <Users className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
                                Top 20 Compliant Personnel
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {topPerformers.map((employee, index) => (
                                <Card
                                    key={employee.id}
                                    className={cn(
                                        "bg-slate-900/40 border-slate-800 p-3 backdrop-blur-xl transition-all hover:border-primary/40",
                                        index < 3 && "border-primary/30 bg-gradient-to-r from-primary/10 to-transparent"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {/* Rank Badge */}
                                            <div className={cn(
                                                "w-8 h-8 rounded-full flex items-center justify-center font-black text-sm",
                                                index === 0 ? "bg-yellow-500/20 text-yellow-400" :
                                                    index === 1 ? "bg-slate-400/20 text-slate-300" :
                                                        index === 2 ? "bg-orange-500/20 text-orange-400" :
                                                            "bg-slate-800 text-slate-400"
                                            )}>
                                                {index + 1}
                                            </div>

                                            <div className="space-y-1">
                                                <h4 className="font-bold text-white text-sm">{employee.userName}</h4>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-[8px] font-black uppercase px-1 py-0 h-3.5">
                                                        {employee.department}
                                                    </Badge>
                                                    <Badge variant="secondary" className="text-[8px] font-black uppercase px-1 py-0 h-3.5 bg-primary/20 text-primary">
                                                        {employee.type}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <div className="text-right">
                                            <div className={cn(
                                                "text-2xl font-black font-mono",
                                                employee.complianceScore >= 90 ? "text-green-400" :
                                                    employee.complianceScore >= 80 ? "text-primary" :
                                                        "text-slate-300"
                                            )}>
                                                {employee.complianceScore}
                                            </div>
                                            <span className="text-[8px] font-bold text-slate-500 uppercase">Score</span>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
