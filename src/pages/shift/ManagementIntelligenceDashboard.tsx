import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    Search,
    Filter,
    RefreshCw,
    Users,
    Clock,
    Activity,
    ShieldCheck,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Brain,
    Sparkles
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { format, subDays, addDays } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';

// Intelligence Components
import { AIScoreOverview } from '@/components/intelligence/AIScoreDisplay';
import { WeeklyPredictionsDashboard } from '@/components/intelligence/WeeklyPredictionsDashboard';
import { MonthlyExecutiveReport } from '@/components/intelligence/MonthlyExecutiveReport';
import { UnifiedActivityGrid } from '@/components/intelligence/UnifiedActivityGrid';
import { WeeklyDetailModal } from '@/components/intelligence/WeeklyDetailModal';

// Hooks
import { useUnifiedWorkAnalytics } from '@/hooks/useUnifiedWorkAnalytics';
import { useWeeklyWorkAnalytics } from '@/hooks/useWeeklyWorkAnalytics';
import { useAIEmployeeScores } from '@/hooks/useAIEmployeeScores';

// Constants & Utils
import { DEPARTMENTS } from '@/constants/departments';
import { cn } from '@/lib/utils';

export default function ManagementIntelligenceDashboard() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const { activities, isLoading: isTodayLoading, refetch: refetchToday } = useUnifiedWorkAnalytics(selectedDate);
    const { weeklyData, isLoading: isWeeklyLoading, refetch: refetchWeekly } = useWeeklyWorkAnalytics();
    const { scores: aiScores, averageScore, statusCounts, refetch: refetchAI } = useAIEmployeeScores(selectedDate);
    const [activeTab, setActiveTab] = useState<'today' | 'weekly' | 'predictions' | 'monthly'>('today');
    const [searchQuery, setSearchQuery] = useState('');
    const [deptFilter, setDeptFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [selectedDayForDetail, setSelectedDayForDetail] = useState<any>(null);
    const [weeklyDetailOpen, setWeeklyDetailOpen] = useState(false);

    const filteredActivities = activities.filter(a => {
        // Exclude CEO and Auditor roles from the list
        const excludedRoles = ['ceo', 'auditor'];
        if (excludedRoles.includes(a.role?.toLowerCase())) return false;

        const matchesSearch = a.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.userEmail.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDept = deptFilter === 'all' || a.department === deptFilter;
        const matchesType = typeFilter === 'all' || a.type === typeFilter;
        return matchesSearch && matchesDept && matchesType;
    });

    return (
        <div className="space-y-6 p-1">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-[22px] font-black tracking-tight flex items-center gap-3" style={{ color: '#111827' }}>
                        <ShieldCheck className="w-6 h-6" style={{ color: '#2563EB' }} />
                        Intelligence <span style={{ color: '#2563EB' }}>Hub</span>
                    </h1>
                    <p className="text-[12px] mt-0.5 font-medium" style={{ color: '#6B7280' }}>Real-time cross-platform employee monitoring</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Date Navigation */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-[#EFF6FF]">
                                    <Calendar className="w-4 h-4" style={{ color: '#2563EB' }} />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={(date) => date && setSelectedDate(date)}
                                    disabled={(date) => date > new Date()}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                            className="h-8 w-8 p-0 hover:bg-[#EFF6FF] transition-all" style={{ color: '#6B7280' }}>
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <div className="px-3 text-center min-w-[140px]" style={{ borderLeft: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB' }}>
                            <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#9CA3AF' }}>Selected Date</p>
                            <p className="text-sm font-black" style={{ color: '#111827' }}>{format(selectedDate, 'MMM dd, yyyy')}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                            disabled={format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')}
                            className="h-8 w-8 p-0 hover:bg-[#EFF6FF] transition-all disabled:opacity-30" style={{ color: '#6B7280' }}>
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                        <div className="h-5 w-px mx-1" style={{ background: '#E5E7EB' }} />
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}
                            className="h-8 px-3 text-[10px] font-bold uppercase hover:bg-[#EFF6FF] transition-all" style={{ color: '#2563EB' }}>
                            Today
                        </Button>
                    </div>

                    {/* Tab bar */}
                    <div className="flex p-1 rounded-xl gap-0.5" style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
                        {(['today', 'weekly', 'predictions', 'monthly'] as const).map((tab) => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className="rounded-lg text-[11px] font-bold uppercase tracking-wide px-4 py-1.5 transition-all"
                                style={activeTab === tab
                                    ? { background: '#FFFFFF', color: '#2563EB', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                                    : { color: '#6B7280' }}>
                                {tab === 'today' ? 'Today' : tab === 'weekly' ? 'History' : tab === 'predictions' ? 'Predictions' : 'Reports'}
                            </button>
                        ))}
                    </div>

                    <Button variant="outline" size="sm"
                        onClick={() => { if (activeTab === 'today') refetchToday(); else if (activeTab === 'weekly') refetchWeekly(); refetchAI(); }}
                        disabled={isTodayLoading || isWeeklyLoading}
                        style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>
                        <RefreshCw className={cn("w-4 h-4 mr-2", (isTodayLoading || isWeeklyLoading) && "animate-spin")} />
                        Sync {activeTab === 'today' ? 'Live' : 'Data'}
                    </Button>
                </div>
            </div>

            {activeTab === 'predictions' ? (
                <WeeklyPredictionsDashboard />
            ) : activeTab === 'monthly' ? (
                <MonthlyExecutiveReport />
            ) : (
                <div className="space-y-6">
                    {/* AI Intelligence Layer */}
                    {aiScores.length > 0 ? (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4" style={{ color: '#2563EB' }} />
                                    <h2 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: '#111827' }}>AI Strategic Analysis</h2>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
                                        Live Governance
                                    </span>
                                </div>
                                <p className="text-[10px] font-bold uppercase" style={{ color: '#9CA3AF' }}>
                                    Updated {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <AIScoreOverview scores={aiScores} averageScore={averageScore} statusCounts={statusCounts} />
                        </motion.div>
                    ) : (
                        <div className="p-12 rounded-2xl flex flex-col items-center justify-center text-center space-y-4"
                            style={{ background: '#F9FAFB', border: '1px dashed #D1D5DB' }}>
                            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#EFF6FF' }}>
                                <Brain className="w-8 h-8 animate-pulse" style={{ color: '#93C5FD' }} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-bold" style={{ color: '#374151' }}>AI Engine Warming Up</h3>
                                <p className="max-w-md mx-auto" style={{ color: '#6B7280' }}>The strategic audit layer is currently processing raw activity data. Analysis results will appear here shortly.</p>
                            </div>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="p-4 rounded-2xl" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
                                <Input placeholder="Search by name or email..." value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10" style={{ background: '#F9FAFB', borderColor: '#E5E7EB', color: '#111827' }} />
                            </div>

                            <Select value={deptFilter} onValueChange={setDeptFilter}>
                                <SelectTrigger style={{ background: '#F9FAFB', borderColor: '#E5E7EB', color: '#374151' }}>
                                    <Users className="w-4 h-4 mr-2" style={{ color: '#9CA3AF' }} />
                                    <SelectValue placeholder="All Departments" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Every Department</SelectItem>
                                    {DEPARTMENTS.map((d, index) => (
                                        <SelectItem key={d.value} value={d.value}>{index + 1}. {d.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger style={{ background: '#F9FAFB', borderColor: '#E5E7EB', color: '#374151' }}>
                                    <Activity className="w-4 h-4 mr-2" style={{ color: '#9CA3AF' }} />
                                    <SelectValue placeholder="Work Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Platforms</SelectItem>
                                    <SelectItem value="regular">Regular Work</SelectItem>
                                    <SelectItem value="shift">Shift Basis</SelectItem>
                                </SelectContent>
                            </Select>

                            <div className="flex items-center gap-2 px-4 rounded-xl" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                                <Clock className="w-4 h-4" style={{ color: '#2563EB' }} />
                                <span className="text-xs font-mono font-bold" style={{ color: '#374151' }}>
                                    {activities.filter(a => a.status === 'working').length} Active Now
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Personnel Grid */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: '#374151' }}>
                                {activeTab === 'today' ? 'Personnel Deployment Matrix' : 'Weekly Compliance History'}
                            </h3>
                            <p className="text-[10px] font-bold uppercase" style={{ color: '#9CA3AF' }}>
                                {activeTab === 'today' ? 'Normalized Data Stream • Real-time Active' : '7-Day Collective Movement Summary'}
                            </p>
                        </div>

                        {activeTab === 'today' ? (
                            <>
                                {filteredActivities.length === 0 && !isTodayLoading ? (
                                    <div className="py-16 text-center space-y-4 rounded-2xl" style={{ background: '#F9FAFB', border: '1px dashed #D1D5DB' }}>
                                        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: '#EFF6FF' }}>
                                            <Search className="w-7 h-7" style={{ color: '#93C5FD' }} />
                                        </div>
                                        <p className="font-medium" style={{ color: '#6B7280' }}>No personnel detected matching the current filters</p>
                                    </div>
                                ) : (
                                    <UnifiedActivityGrid activities={filteredActivities} selectedDate={selectedDate} />
                                )}
                            </>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {weeklyData.map((day, idx) => (
                                    <div key={idx}
                                        className="rounded-2xl p-4 cursor-pointer transition-all duration-200"
                                        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#BFDBFE'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(37,99,235,0.08)'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
                                        onClick={() => { setSelectedDayForDetail(day); setWeeklyDetailOpen(true); }}>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] font-bold uppercase" style={{ color: '#9CA3AF' }}>{format(new Date(day.date), 'EEEE')}</p>
                                                    <h4 className="font-bold" style={{ color: '#111827' }}>{format(new Date(day.date), 'MMM dd')}</h4>
                                                </div>
                                                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                                                    day.averageScore >= 85 ? "bg-green-50 text-green-600" :
                                                    day.averageScore >= 70 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600")}>
                                                    {day.averageScore}%
                                                </span>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center text-[10px] font-bold uppercase" style={{ color: '#9CA3AF' }}>
                                                    <span>Daily Intensity</span>
                                                    <span>{day.totalEmployees} Active</span>
                                                </div>
                                                <Progress value={day.averageScore} className="h-1.5" />
                                            </div>
                                            <div className="pt-2 flex justify-between items-center" style={{ borderTop: '1px solid #F3F4F6' }}>
                                                <div className="flex -space-x-1.5">
                                                    {[1, 2, 3].map(i => (
                                                        <div key={i} className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold"
                                                            style={{ background: '#EFF6FF', color: '#2563EB', border: '2px solid #FFFFFF' }}>P</div>
                                                    ))}
                                                </div>
                                                <span className="text-[9px] font-black uppercase" style={{ color: '#2563EB' }}>View Detail</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            <WeeklyDetailModal
                open={weeklyDetailOpen}
                onOpenChange={setWeeklyDetailOpen}
                dayData={selectedDayForDetail}
            />
        </div>
    );
}
