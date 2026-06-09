import { useState } from 'react';
import { motion } from 'framer-motion';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import {
    Truck, IndianRupee, MapPin, Activity, TrendingUp,
    Filter, Loader2, Route, Download, ArrowRight, Calendar, User, Tag, Info, Hash
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useTransportAnalytics } from '@/hooks/useTransportAnalytics';

const CHART_COLORS = [
    '#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#ef4444',
];

const formatCurrency = (val: number) =>
    val >= 100000 ? `₹${(val / 100000).toFixed(1)}L`
        : val >= 1000 ? `₹${(val / 1000).toFixed(1)}K`
            : `₹${val.toFixed(0)}`;

const formatKm = (val: number) =>
    val >= 1000 ? `${(val / 1000).toFixed(1)}K km` : `${val.toFixed(0)} km`;

// ---- CSV Export Utility ----
function exportToCSV(rows: any[], filename: string) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
        headers.join(','),
        ...rows.map(row =>
            headers.map(h => {
                const v = row[h] ?? '';
                return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
            }).join(',')
        )
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ---- Stat Card ----
const StatCard = ({ icon: Icon, label, value, sub, color }: {
    icon: any; label: string; value: string; sub?: string; color: string;
}) => (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="relative overflow-hidden border-0 shadow-md">
            <div className={`absolute inset-0 opacity-5 bg-gradient-to-br ${color}`} />
            <CardContent className="p-5">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">{label}</p>
                        <p className="text-2xl font-extrabold mt-1">{value}</p>
                        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
                    </div>
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} opacity-90`}>
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                </div>
            </CardContent>
        </Card>
    </motion.div>
);

// ---- Pie label (truncated to avoid overlap) ----
const renderPieLabel = ({ category_name, percent }: any) => {
    if (percent < 0.05) return '';
    const label = (category_name?.length > 9) ? category_name.slice(0, 9) + '…' : category_name;
    return `${label} ${(percent * 100).toFixed(0)}%`;
};

// ---- Main Dashboard ----
export function TransportAnalysisDashboard() {
    const defaultFrom = format(startOfMonth(subMonths(new Date(), 2)), 'yyyy-MM-dd');
    const defaultTo = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    const [dateFrom, setDateFrom] = useState(defaultFrom);
    const [dateTo, setDateTo] = useState(defaultTo);
    const [appliedFrom, setAppliedFrom] = useState(defaultFrom);
    const [appliedTo, setAppliedTo] = useState(defaultTo);
    const [statusFilter, setStatusFilter] = useState('paid');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [appliedStatus, setAppliedStatus] = useState('paid');
    const [appliedCategory, setAppliedCategory] = useState('all');
    const [paymentTypeFilter, setPaymentTypeFilter] = useState<'all' | 'individual' | 'bulk'>('all');
    const [specificBatchFilter, setSpecificBatchFilter] = useState('all');
    const [appliedPaymentType, setAppliedPaymentType] = useState<'all' | 'individual' | 'bulk'>('all');
    const [appliedSpecificBatch, setAppliedSpecificBatch] = useState('all');

    const { summaryStats, categoryBreakdown, masterCategories, monthlyTrends, topRoutes, rawTrips, availableBatches, isLoading } =
        useTransportAnalytics({ from: appliedFrom, to: appliedTo }, appliedStatus, appliedCategory, appliedPaymentType, appliedSpecificBatch);

    const applyFilter = () => {
        setAppliedFrom(dateFrom);
        setAppliedTo(dateTo);
        setAppliedStatus(statusFilter);
        setAppliedCategory(categoryFilter);
        setAppliedPaymentType(paymentTypeFilter);
        setAppliedSpecificBatch(specificBatchFilter);
    };

    const monthlyChartData = monthlyTrends.map(m => ({
        ...m,
        label: format(new Date(`${m.month}-01`), 'MMM yy'),
    }));

    const handleExportCSV = () => {
        const selectedCatName = appliedCategory === 'all'
            ? 'AllCategories'
            : masterCategories.find(c => c.code === appliedCategory)?.name || appliedCategory;

        const filename = `transport_analysis_${appliedFrom}_to_${appliedTo}_${appliedStatus}_${selectedCatName}.csv`;

        const exportRows = rawTrips.map((t, i) => ({
            'S.No': i + 1,
            'Request ID': t.request_id,
            'Requester': t.requester_name,
            'Department': t.requester_dept,
            'Trip Date': t.trip_date,
            'Category Code': t.category_code,
            'Category Name': t.category_name,
            'From': t.from_location,
            'To': t.to_location,
            'Distance (KM)': t.distance_km,
            'Rate / KM (₹)': t.rate_per_km,
            'Amount (₹)': t.amount,
            'Purpose': t.purpose,
            'Driver': t.driver_name,
            'Vehicle': t.vehicle_number,
            'Status': t.status,
            'Created At': t.created_at,
        }));
        exportToCSV(exportRows, filename);
    };

    const renderTripTable = (trips: typeof rawTrips) => (
        <div className="rounded-xl border border-border/40 overflow-hidden bg-muted/5 shadow-inner">
            <Table>
                <TableHeader className="bg-muted/40 backdrop-blur-sm">
                    <TableRow className="hover:bg-transparent border-border/40">
                        <TableHead className="text-[10px] uppercase tracking-wider font-bold w-12 text-center">#</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-bold min-w-[110px]">Date & Category</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-bold">Requester Details</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-bold min-w-[220px]">Route (From → To)</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-bold">Trip Purpose</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-bold text-right">Distance</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-bold text-right">Rate/KM</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-bold text-right">Fare</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-bold min-w-[120px]">Payment Execution</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {trips.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                                <div className="flex flex-col items-center gap-2 opacity-50">
                                    <Truck className="w-10 h-10" />
                                    <p className="text-sm font-medium">No records found for this selection</p>
                                </div>
                              </TableCell>
                        </TableRow>
                    ) : (
                        trips.slice(0, 50).map((trip, i) => (
                            <TableRow key={i} className="hover:bg-muted/20 border-border/20 transition-all duration-200">
                                <TableCell className="text-center text-muted-foreground/60 font-mono text-[10px]">
                                    {(i + 1).toString().padStart(2, '0')}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                                            <Calendar className="w-3 h-3 text-blue-400/70" />
                                            {trip.trip_date ? format(new Date(trip.trip_date), 'dd MMM yyyy') : '-'}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Tag className="w-3 h-3 text-muted-foreground/50" />
                                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight">
                                                {trip.category_name}
                                            </span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1.5 font-bold text-xs">
                                                <User className="w-3 h-3 text-indigo-400" />
                                                {trip.requester_name}
                                            </div>
                                            {trip.batch_number && (
                                                <Badge className="text-[9px] h-3.5 px-1 bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                                                    Bulk: {trip.batch_number}
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="text-[9px] text-muted-foreground font-semibold px-1 rounded bg-muted/40 w-fit">
                                            {trip.requester_dept}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2 max-w-[240px]">
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[10px] font-medium line-clamp-1 text-muted-foreground/80 lowercase" title={trip.from_location}>
                                                {trip.from_location}
                                            </span>
                                            <span className="text-[11px] font-bold line-clamp-1 lowercase" title={trip.to_location}>
                                                {trip.to_location}
                                            </span>
                                        </div>
                                        <div className="flex-shrink-0 flex flex-col items-center justify-center">
                                            <ArrowRight className="w-3 h-3 text-primary/40" />
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-start gap-1.5 max-w-[180px]">
                                        <Info className="w-3 h-3 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                                        <span className="text-[10px] leading-tight text-muted-foreground line-clamp-2 italic" title={trip.purpose}>
                                            {trip.purpose}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-mono font-bold">{trip.distance_km.toFixed(1)}</span>
                                        <span className="text-[9px] text-muted-foreground uppercase opacity-60">km</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex flex-col items-end">
                                        {trip.rate_per_km > 0 ? (
                                            <>
                                                <span className="text-xs font-mono font-bold text-blue-400">₹{trip.rate_per_km}</span>
                                                <span className="text-[9px] text-muted-foreground uppercase opacity-60">per km</span>
                                            </>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground italic">Fixed</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-mono font-extrabold text-emerald-400 italic">
                                            ₹{trip.amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                                        </span>
                                        <span className="text-[9px] text-muted-foreground opacity-60">
                                            {trip.rate_per_km > 0 ? `Total` : 'Fixed Cost'}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1 min-w-[100px]">
                                        {trip.paid_at ? (
                                            <>
                                                <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[10px]">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-slow shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                    {format(new Date(trip.paid_at), 'dd MMM, HH:mm')}
                                                </div>
                                                <Badge variant="outline" className="text-[8px] h-3 px-1 w-fit bg-emerald-500/5 text-emerald-500/70 border-emerald-500/10">
                                                    EXECUTED
                                                </Badge>
                                            </>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground/40 italic flex items-center gap-1">
                                                <Activity className="w-3 h-3 animate-spin-slow opacity-20" />
                                                Pending...
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Header */}
            <div className="dashboard-header">
                <div className="relative z-10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/30 to-indigo-500/20 flex items-center justify-center shadow-lg">
                            <Truck className="w-7 h-7 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold">Transport Analysis</h1>
                            <p className="text-muted-foreground text-sm mt-0.5">Category-wise breakdown · Admin view</p>
                        </div>
                    </div>
                    <Button
                        onClick={handleExportCSV}
                        disabled={rawTrips.length === 0}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                        size="sm"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                        {rawTrips.length > 0 && (
                            <Badge className="ml-1 bg-emerald-800 text-emerald-100 text-xs px-1.5">
                                {rawTrips.length}
                            </Badge>
                        )}
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                            <Filter className="w-4 h-4" />
                            Filters
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">From</Label>
                            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-38" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">To</Label>
                            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-38" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Status</Label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="h-8 w-36">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="paid">✅ Paid</SelectItem>
                                    <SelectItem value="ceo_approved">CEO Approved</SelectItem>
                                    <SelectItem value="admin_audit">Admin Audit</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Category</Label>
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="h-8 w-44 text-xs">
                                    <SelectValue placeholder="All Categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs">All Categories</SelectItem>
                                    {masterCategories.map(cat => (
                                        <SelectItem key={cat.code} value={cat.code} className="text-xs">
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Type</Label>
                            <Select value={paymentTypeFilter} onValueChange={(v: any) => setPaymentTypeFilter(v)}>
                                <SelectTrigger className="h-8 w-32 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs">All Types</SelectItem>
                                    <SelectItem value="individual" className="text-xs">Individual</SelectItem>
                                    <SelectItem value="bulk" className="text-xs">Bulk Raised</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {paymentTypeFilter === 'bulk' && availableBatches.length > 0 && (
                            <div className="space-y-1 animate-in fade-in slide-in-from-left-2 duration-300">
                                <Label className="text-xs">Bulk Batch ID</Label>
                                <Select value={specificBatchFilter} onValueChange={setSpecificBatchFilter}>
                                    <SelectTrigger className="h-8 w-40 text-xs border-blue-500/30 bg-blue-500/5 text-blue-400">
                                        <SelectValue placeholder="Select Batch" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all" className="text-xs italic text-muted-foreground">All Bulk Batches</SelectItem>
                                        {availableBatches.map(batch => (
                                            <SelectItem key={batch} value={batch} className="text-xs font-mono font-bold">
                                                {batch}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <Button onClick={applyFilter} size="sm" className="h-8 px-6 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
                            Apply Filter
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                <div className="flex justify-center items-center py-24">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <StatCard icon={Truck} label="Total Requests" value={summaryStats.total_requests.toString()} color="from-blue-500 to-indigo-500" />
                        <StatCard icon={Route} label="Total Trips" value={summaryStats.total_trips.toString()} color="from-violet-500 to-purple-500" />
                        <StatCard icon={IndianRupee} label="Total Spend" value={formatCurrency(summaryStats.total_amount)} color="from-emerald-500 to-teal-500" />
                        <StatCard icon={MapPin} label="Total KM" value={formatKm(summaryStats.total_km)} color="from-amber-500 to-orange-500" />
                        <StatCard icon={TrendingUp} label="Avg ₹/Trip" value={formatCurrency(summaryStats.avg_cost_per_trip)} color="from-rose-500 to-pink-500" />
                        <StatCard icon={Activity} label="In Progress" value={summaryStats.pending_requests.toString()} sub="awaiting approval" color="from-sky-500 to-cyan-500" />
                    </div>

                    {/* Charts */}
                    {categoryBreakdown.length > 0 && (
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Pie Chart */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Spend by Category</CardTitle>
                                    <CardDescription>Total cost distribution across transport types</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={260}>
                                        <PieChart>
                                            <Pie
                                                data={categoryBreakdown}
                                                dataKey="total_amount"
                                                nameKey="category_name"
                                                cx="50%" cy="50%"
                                                outerRadius={95}
                                                label={renderPieLabel}
                                                labelLine={false}
                                                fontSize={10}
                                            >
                                                {categoryBreakdown.map((_, i) => (
                                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(val: number) => [formatCurrency(val), 'Spend']}
                                                labelFormatter={(_, p) => p?.[0]?.payload?.category_name ?? ''}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            {/* Bar Chart - KM */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Distance by Category (KM)</CardTitle>
                                    <CardDescription>Total kilometres per transport type</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={260}>
                                        <BarChart data={categoryBreakdown} margin={{ top: 4, right: 8, left: 0, bottom: 50 }}>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                            <XAxis dataKey="category_name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" />
                                            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}km`} />
                                            <Tooltip formatter={(val: number) => [`${val.toFixed(0)} km`, 'Distance']} />
                                            <Bar dataKey="total_km" radius={[4, 4, 0, 0]}>
                                                {categoryBreakdown.map((_, i) => (
                                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Monthly Trend */}
                    {monthlyChartData.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" />
                                    Monthly Spend Trend
                                </CardTitle>
                                <CardDescription>Transport cost over selected period</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={200}>
                                    <LineChart data={monthlyChartData} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatCurrency(v)} />
                                        <Tooltip
                                            formatter={(val: number, name: string) => [
                                                name === 'total_amount' ? formatCurrency(val)
                                                    : name === 'total_km' ? `${val.toFixed(0)} km` : val,
                                                name === 'total_amount' ? 'Spend' : name === 'total_km' ? 'Distance' : 'Trips'
                                            ]}
                                        />
                                        <Legend />
                                        <Line type="monotone" dataKey="total_amount" stroke="#6366f1" strokeWidth={2} dot={false} name="total_amount" />
                                        <Line type="monotone" dataKey="total_trips" stroke="#10b981" strokeWidth={2} dot={false} name="total_trips" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* Category Table */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Category-wise Breakdown</CardTitle>
                                    <CardDescription>Detailed metrics per transport category</CardDescription>
                                </div>
                                {appliedCategory !== 'all' && (
                                    <Badge variant="secondary">
                                        {masterCategories.find(c => c.code === appliedCategory)?.name || appliedCategory}
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {categoryBreakdown.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-24 gap-2 text-muted-foreground text-sm">
                                    <Truck className="w-8 h-8 opacity-30" />
                                    No transport data found for selected filters.
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Category</TableHead>
                                            <TableHead className="text-right">Trips</TableHead>
                                            <TableHead className="text-right">Total KM</TableHead>
                                            <TableHead className="text-right">Total Spend</TableHead>
                                            <TableHead className="text-right">Avg ₹/Trip</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {categoryBreakdown.map((cat, i) => (
                                            <TableRow key={cat.category_code}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-2.5 h-2.5 rounded-full"
                                                            style={{ background: cat.color_code || CHART_COLORS[i % CHART_COLORS.length] }}
                                                        />
                                                        <span className="font-medium">{cat.category_name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">{cat.total_trips}</TableCell>
                                                <TableCell className="text-right">{cat.total_km.toFixed(0)} km</TableCell>
                                                <TableCell className="text-right font-semibold">{formatCurrency(cat.total_amount)}</TableCell>
                                                <TableCell className="text-right text-muted-foreground">{formatCurrency(cat.avg_amount_per_trip)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    {/* Top Routes */}
                    {topRoutes.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Route className="w-4 h-4" />
                                    Top Routes by Spend
                                </CardTitle>
                                <CardDescription>Most frequent and costliest routes</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>#</TableHead>
                                            <TableHead>From</TableHead>
                                            <TableHead>To</TableHead>
                                            <TableHead className="text-right">Trips</TableHead>
                                            <TableHead className="text-right">Total KM</TableHead>
                                            <TableHead className="text-right">Total Spend</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topRoutes.map((route, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="text-muted-foreground font-mono text-xs">{i + 1}</TableCell>
                                                <TableCell className="font-medium">{route.from_location}</TableCell>
                                                <TableCell>{route.to_location}</TableCell>
                                                <TableCell className="text-right">{route.trip_count}</TableCell>
                                                <TableCell className="text-right">{route.total_km.toFixed(0)} km</TableCell>
                                                <TableCell className={cn('text-right font-semibold', route.total_amount > 10000 ? 'text-status-missed' : '')}>
                                                    {formatCurrency(route.total_amount)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                    {/* Detailed Trip Records */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                Detailed Trip Records
                            </CardTitle>
                            <CardDescription>Granular view of individual transport transactions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="all" className="w-full">
                                <div className="flex items-center justify-between mb-4 mt-1">
                                    <TabsList className="bg-muted/50">
                                        <TabsTrigger value="all" className="text-xs">All Trips</TabsTrigger>
                                        <TabsTrigger value="individual" className="text-xs">Individual</TabsTrigger>
                                        <TabsTrigger value="bulk" className="text-xs">Bulk Payments</TabsTrigger>
                                    </TabsList>
                                    <div className="text-[10px] text-muted-foreground font-medium bg-muted/30 px-2 py-1 rounded border border-border/50">
                                        Showing {rawTrips.length} records
                                    </div>
                                </div>

                                <TabsContent value="all" className="mt-0">
                                    {renderTripTable(rawTrips)}
                                </TabsContent>
                                <TabsContent value="individual" className="mt-0">
                                    {renderTripTable(rawTrips.filter(t => !t.bulk_batch_id))}
                                </TabsContent>
                                <TabsContent value="bulk" className="mt-0">
                                    {renderTripTable(rawTrips.filter(t => !!t.bulk_batch_id))}
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </>
            )}
        </motion.div>
    );
}
