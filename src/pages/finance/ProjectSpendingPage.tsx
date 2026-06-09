import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    IndianRupee, TrendingUp, TrendingDown, Search,
    Filter, Calendar, PieChart, BarChart3, ArrowRight,
    Building2, Wallet, AlertCircle, CheckCircle2,
    Download, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart as RePieChart, Pie, Legend
} from 'recharts';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { useProjects } from '@/hooks/useProjects';
import { format, subMonths, isSameMonth, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

// --- Types ---
type TimeRange = 'this_month' | 'last_month' | 'last_3_months' | 'ytd' | 'custom';

// --- Components ---

function MetricCard({
    title, value, icon: Icon, trend, trendValue, color, delay = 0
}: {
    title: string; value: string; icon: any; trend?: 'up' | 'down' | 'neutral';
    trendValue?: string; color: string; delay?: number
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay }}
        >
            <Card className="relative overflow-hidden border-white/10 bg-black/40 backdrop-blur-xl hover:shadow-2xl hover:shadow-primary/20 transition-all duration-300 group">
                <div className={cn("absolute top-0 left-0 w-1 h-full", color)} />
                <div className={cn("absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-10 group-hover:opacity-20 transition-opacity blur-2xl", color.replace('bg-', 'bg-'))} />

                <CardContent className="p-6 relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <div className={cn("p-2.5 rounded-xl bg-opacity-20 border border-white/5", color.replace('bg-', 'bg-').replace('500', '500/20'))}>
                            <Icon className={cn("w-6 h-6", color.replace('bg-', 'text-'))} />
                        </div>
                        {trend && (
                            <Badge variant="outline" className={cn(
                                "flex items-center gap-1 border-0 bg-opacity-20 backdrop-blur-sm px-2 py-1",
                                trend === 'up' ? "bg-red-500/20 text-red-500" : "bg-emerald-500/20 text-emerald-500"
                            )}>
                                {trend === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                {trendValue}
                            </Badge>
                        )}
                    </div>

                    <div className="space-y-1">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
                        <p className="text-3xl font-bold tracking-tight text-white tabular-nums">{value}</p>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

export default function ProjectSpendingPage() {
    // Data Hook (Using 'paid' status for spending)
    const { requests, isLoading: isPaymentsLoading } = usePaymentRequests(['paid', 'ceo_approved']);
    const { projects, isLoading: isProjectsLoading } = useProjects();
    const isLoading = isPaymentsLoading || isProjectsLoading;

    // State
    const [timeRange, setTimeRange] = useState<TimeRange>('this_month');
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProject, setSelectedProject] = useState<string>('all');

    // --- Analytics Logic ---
    const processedData = useMemo(() => {
        if (!requests) return null;

        // 1. Filter by Date & Status
        const now = new Date();
        let filtered = requests.filter(r =>
            (r.status === 'paid' || r.status === 'ceo_approved') &&
            (r.is_project_work || !!r.project_id)
        );

        if (dateRange?.from) {
            filtered = filtered.filter(r => {
                const date = parseISO(r.created_at);
                return isWithinInterval(date, {
                    start: dateRange.from!,
                    end: dateRange.to || dateRange.from!
                });
            });
        }

        // 2. Filter by Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(r =>
                (r.purpose || '').toLowerCase().includes(q) ||
                (r.vendor_name || '').toLowerCase().includes(q) ||
                (r.project_id || '').toLowerCase().includes(q)
            );
        }

        // 3. Aggregate Stats
        const totalSpent = filtered.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        const uniqueVendors = new Set(filtered.map(r => r.vendor_name)).size;
        const totalTxns = filtered.length;

        // 4. Charts Data

        // Spending Trend (Daily/Monthly)
        const trendMap = new Map<string, number>();
        filtered.forEach(r => {
            const date = format(parseISO(r.created_at), 'MMM dd');
            trendMap.set(date, (trendMap.get(date) || 0) + (Number(r.amount) || 0));
        });
        const trendData = Array.from(trendMap.entries())
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Simplified sort

        // Project Wise Spending
        const projectSpendMap = new Map<string, number>();
        filtered.forEach(r => {
            const project = projects?.find(p => p.id === r.project_id);
            const pName = project?.project_name || r.project_id || 'Operational (No Project)';
            projectSpendMap.set(pName, (projectSpendMap.get(pName) || 0) + (Number(r.amount) || 0));
        });
        const projectData = Array.from(projectSpendMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5); // Top 5

        // Vendor Distribution
        const vendorMap = new Map<string, number>();
        filtered.forEach(r => {
            const vName = r.vendor_name || 'Unknown';
            vendorMap.set(vName, (vendorMap.get(vName) || 0) + (Number(r.amount) || 0));
        });
        const vendorData = Array.from(vendorMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        return {
            filteredRequests: filtered,
            stats: { totalSpent, uniqueVendors, totalTxns },
            charts: { trendData, projectData, vendorData }
        };

    }, [requests, projects, dateRange, searchQuery]);

    // Formatters
    const fmtCurrency = (val: number) =>
        new Intl.NumberFormat('en-IN', {
            style: 'currency', currency: 'INR', maximumFractionDigits: 0
        }).format(val);

    const COLORS = ['#7c3aed', '#10b981', '#ec4899', '#f59e0b', '#3b82f6']; // Neon Violet, Emerald, Pink, Amber, Blue

    if (isLoading || !processedData) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse">Analyzing expenditure...</p>
                </div>
            </div>
        );
    }

    const { stats, charts, filteredRequests } = processedData;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-6 max-w-[1600px] mx-auto space-y-8"
        >
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        Project Spending
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Analysis of project-specific outflows (excluding general department expenses).
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="h-10 gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10">
                                <Calendar className="w-4 h-4 text-primary" />
                                {dateRange?.from ? (
                                    dateRange.to ? (
                                        <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>
                                    ) : (
                                        format(dateRange.from, "LLL dd, y")
                                    )
                                ) : (
                                    <span>Select Date Range</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <CalendarComponent
                                initialFocus
                                mode="range"
                                defaultMonth={dateRange?.from}
                                selected={dateRange}
                                onSelect={setDateRange}
                                numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>

                    <Button variant="outline" size="icon" className="h-10 w-10">
                        <Download className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Total Spending"
                    value={fmtCurrency(stats.totalSpent)}
                    icon={Wallet}
                    color="bg-violet-600"
                    delay={0}
                />
                <MetricCard
                    title="Transactions"
                    value={stats.totalTxns.toString()}
                    icon={ArrowRight}
                    color="bg-blue-600"
                    delay={0.1}
                />
                <MetricCard
                    title="Active Vendors"
                    value={stats.uniqueVendors.toString()}
                    icon={Building2}
                    color="bg-orange-600"
                    delay={0.2}
                />
                <MetricCard
                    title="Avg. Transaction"
                    value={fmtCurrency(stats.totalTxns ? stats.totalSpent / stats.totalTxns : 0)}
                    icon={PieChart}
                    color="bg-emerald-600"
                    delay={0.3}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Spending Trend (Area Chart) */}
                <Card className="lg:col-span-2 border-white/10 bg-black/40 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <TrendingUp className="w-5 h-5 text-violet-500" />
                            Spending Trend
                        </CardTitle>
                        <CardDescription className="text-muted-foreground/70">Daily outflow over selected period</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={charts.trendData}>
                                <defs>
                                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.05} vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="rgba(255,255,255,0.3)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="rgba(255,255,255,0.3)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => `₹${val / 1000}k`}
                                    dx={-10}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(val: number) => [fmtCurrency(val), 'Spent']}
                                    labelStyle={{ color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#7c3aed"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorAmount)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top Projects (Bar Chart) */}
                <Card className="border-white/10 bg-black/40 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <BarChart3 className="w-5 h-5 text-orange-500" />
                            Top Projects
                        </CardTitle>
                        <CardDescription className="text-muted-foreground/70">Highest spending allocation</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.projectData} layout="vertical" margin={{ left: 0, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ffffff" opacity={0.05} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={220}
                                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11, width: 220 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(val: number) => fmtCurrency(val)}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                    {charts.projectData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Vendor Distribution (Donut) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="border-white/10 bg-black/40 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <PieChart className="w-5 h-5 text-pink-500" />
                            Vendor Split
                        </CardTitle>
                        <CardDescription className="text-muted-foreground/70">Spend by vendor</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                                <Pie
                                    data={charts.vendorData}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {charts.vendorData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(val: number) => fmtCurrency(val)}
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend
                                    formatter={(value) => <span style={{ color: 'rgba(255,255,255,0.7)' }}>{value}</span>}
                                />
                            </RePieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Recent Transactions List (Spans 2 cols) */}
                <Card className="lg:col-span-2 border-white/10 bg-black/40 backdrop-blur-xl">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-white">Spending Register</CardTitle>
                            <CardDescription className="text-muted-foreground/70">Detailed record of all outflows</CardDescription>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search vendors, projects..."
                                className="pl-8 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/50 focus:border-violet-500/50 focus:ring-violet-500/20"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-xl border border-white/10 overflow-hidden bg-black/20">
                            <div className="bg-white/5 px-4 py-3 grid grid-cols-12 gap-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                <div className="col-span-2">Date</div>
                                <div className="col-span-3">Vendor / Beneficiary</div>
                                <div className="col-span-3">Project / Purpose</div>
                                <div className="col-span-2 text-right">Amount</div>
                                <div className="col-span-2 text-center">Status</div>
                            </div>
                            <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {filteredRequests.length === 0 ? (
                                    <div className="p-12 text-center text-muted-foreground/50">No records found matching your filters.</div>
                                ) : (
                                    filteredRequests.map((req) => (
                                        <div key={req.id} className="px-4 py-3.5 grid grid-cols-12 gap-4 items-center hover:bg-white/5 transition-colors text-sm group">
                                            <div className="col-span-2 text-muted-foreground group-hover:text-white transition-colors">
                                                {format(parseISO(req.created_at), 'dd MMM yyyy')}
                                            </div>
                                            <div className="col-span-3 font-medium truncate text-white/90" title={req.vendor_name}>
                                                {req.vendor_name || req.beneficiary_name}
                                            </div>
                                            <div className="col-span-3 truncate text-muted-foreground" title={req.purpose}>
                                                <div className="font-medium text-violet-300 text-xs mb-0.5">
                                                    {projects?.find(p => p.id === req.project_id)?.project_name || req.project_id || 'Operational'}
                                                </div>
                                                <div className="text-[10px] opacity-70">{req.purpose}</div>
                                            </div>
                                            <div className="col-span-2 text-right font-bold font-mono text-white/90 tabular-nums">
                                                {fmtCurrency(Number(req.amount))}
                                            </div>
                                            <div className="col-span-2 flex justify-center">
                                                <Badge variant="outline" className={cn(
                                                    "text-[10px] uppercase tracking-wider px-2 py-0.5 border shadow-[0_0_10px_rgba(0,0,0,0.1)]",
                                                    req.status === 'paid'
                                                        ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10 shadow-emerald-500/10"
                                                        : "border-blue-500/30 text-blue-400 bg-blue-500/10 shadow-blue-500/10"
                                                )}>
                                                    {req.status === 'paid' ? 'Paid' : 'Approved'}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </motion.div>
    );
}
