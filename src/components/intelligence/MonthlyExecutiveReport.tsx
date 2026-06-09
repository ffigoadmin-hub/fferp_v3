import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    AlertOctagon,
    Award,
    Lightbulb,
    Target,
    FileText,
    ChevronRight,
    ShieldCheck,
    Zap,
    Briefcase,
    History,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMonthlyReports, MonthlyReport } from '@/hooks/useMonthlyReports';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

export function MonthlyExecutiveReport() {
    const { report, isLoading, error } = useMonthlyReports();
    const [activeTab, setActiveTab] = useState('summary');

    if (isLoading) {
        return (
            <Card className="animate-pulse h-[500px]">
                <CardContent className="p-6">
                    <div className="space-y-4">
                        <div className="h-8 bg-muted rounded w-1/3" />
                        <div className="h-32 bg-muted rounded" />
                        <div className="grid grid-cols-3 gap-4">
                            <div className="h-24 bg-muted rounded" />
                            <div className="h-24 bg-muted rounded" />
                            <div className="h-24 bg-muted rounded" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error || !report) {
        return (
            <Card className="border-dashed h-[300px] flex items-center justify-center">
                <div className="text-center p-6">
                    <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-muted-foreground">No Monthly Report Available</h3>
                    <p className="text-sm text-muted-foreground/60 mt-1 max-w-[250px] mx-auto">
                        Reports are generated at the beginning of each month based on last month's performance.
                    </p>
                </div>
            </Card>
        );
    }

    const isPositive = report.improvement_from_last_month >= 0;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
        >
            {/* Executive Header Card */}
            <Card className="border-primary/20 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <ShieldCheck className="w-48 h-48" />
                </div>
                <CardHeader className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-primary/20 rounded-2xl">
                                <BarChart3 className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black text-white uppercase tracking-tighter">
                                    Monthly Executive Report
                                </CardTitle>
                                <CardDescription className="text-slate-400 font-medium">
                                    {format(parseISO(report.month), 'MMMM yyyy')} Analysis
                                </CardDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary py-1 px-4">
                            AI PRO GENERATED
                        </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                        <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Compliance Score</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-white">{report.avg_org_score.toFixed(0)}</span>
                                <span className="text-slate-400 font-bold text-sm">/100</span>
                            </div>
                        </div>

                        <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Growth Index</p>
                            <div className="flex items-center gap-2">
                                {isPositive ? (
                                    <TrendingUp className="w-6 h-6 text-emerald-500" />
                                ) : (
                                    <TrendingDown className="w-6 h-6 text-red-500" />
                                )}
                                <span className={cn(
                                    "text-3xl font-black",
                                    isPositive ? "text-emerald-500" : "text-red-500"
                                )}>
                                    {isPositive ? '+' : ''}{report.improvement_from_last_month.toFixed(1)}%
                                </span>
                            </div>
                        </div>

                        <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Active Workforce</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-white">{report.total_active_employees}</span>
                                <span className="text-slate-400 font-bold text-sm">STAFF</span>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Tabs defaultValue="summary" className="w-full">
                <TabsList className="bg-slate-900/50 border border-slate-800 p-1 rounded-xl mb-6">
                    <TabsTrigger value="summary" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-8">Executive Summary</TabsTrigger>
                    <TabsTrigger value="performance" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-8">Org Performance</TabsTrigger>
                    <TabsTrigger value="strategy" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-8">Strategic Analysis</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-6">
                    <Card className="bg-slate-900/30 border-slate-800">
                        <CardContent className="p-8">
                            <div className="prose prose-invert max-w-none">
                                <h4 className="text-primary font-bold mb-4 uppercase tracking-widest text-xs">Summary for the CEO</h4>
                                <p className="text-slate-300 leading-relaxed text-lg whitespace-pre-wrap">
                                    {report.executive_summary}
                                </p>

                                <div className="mt-8 p-4 bg-primary/5 rounded-xl border border-primary/20 flex items-start gap-4">
                                    <Zap className="w-6 h-6 text-primary shrink-0 mt-1" />
                                    <div>
                                        <h5 className="font-bold text-white text-sm">Next Quarter Projection</h5>
                                        <p className="text-slate-400 text-sm italic">{report.quarterly_projection}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="performance" className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-slate-900/30 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Award className="w-4 h-4 text-emerald-500" />
                                Department Efficiency Rankings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {report.top_departments.map((dept, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 flex items-center justify-center bg-primary/10 text-primary rounded-lg text-xs font-bold">#{i + 1}</span>
                                        <div>
                                            <p className="text-sm font-bold text-white uppercase tracking-tighter">{dept.dept}</p>
                                            <p className="text-[10px] text-slate-500 italic">{dept.reason}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-primary">{dept.avgScore.toFixed(0)}</p>
                                        <p className="text-[8px] text-slate-400 uppercase">AVG SCORE</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900/30 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <History className="w-4 h-4 text-primary" />
                                Success Stories & Milestones
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {report.success_stories.map((story, i) => (
                                <div key={i} className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                    <h5 className="text-sm font-bold text-emerald-500 mb-1">{story.title}</h5>
                                    <p className="text-xs text-slate-400 leading-relaxed">{story.description}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="strategy" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="md:col-span-2 bg-slate-900/30 border-slate-800">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <Briefcase className="w-4 h-4 text-primary" />
                                    Strategic Deep Dive
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[400px] pr-4">
                                    <p className="text-sm text-slate-400 leading-7 whitespace-pre-wrap">
                                        {report.detailed_analysis}
                                    </p>
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card className="bg-red-500/5 border-red-500/20">
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold text-red-500 flex items-center gap-2">
                                        <AlertOctagon className="w-4 h-4" />
                                        Major Concerns
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {report.strategic_concerns.map((c, i) => (
                                        <div key={i} className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-white uppercase">{c.concern}</span>
                                                <Badge className={cn(
                                                    "text-[8px] h-4",
                                                    c.impact === 'high' ? 'bg-red-500' : 'bg-amber-500'
                                                )}>{c.impact}</Badge>
                                            </div>
                                            <p className="text-[10px] text-slate-500 italic">Evidence: {c.evidence}</p>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card className="bg-purple-500/5 border-purple-500/20">
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold text-purple-500 flex items-center gap-2">
                                        <Target className="w-4 h-4" />
                                        Key Recommendations
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {report.strategic_recommendations.map((r, i) => (
                                        <div key={i} className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
                                            <p className="text-xs font-bold text-white mb-2">{r.recommendation}</p>
                                            <div className="flex items-center justify-between">
                                                <Badge variant="secondary" className="text-[8px] opacity-70">{r.timeframe}</Badge>
                                                <span className="text-[8px] text-purple-400 font-bold uppercase">{r.expectedROI}</span>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            <div className="flex justify-center pt-8">
                <Button variant="ghost" className="text-slate-500 hover:text-primary transition-all gap-2 uppercase tracking-widest font-black text-[10px]">
                    Download Full PDF Report <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </motion.div>
    );
}
