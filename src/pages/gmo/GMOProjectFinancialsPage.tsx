import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    IndianRupee, TrendingUp, TrendingDown, Search,
    ChevronDown, ChevronUp, ArrowUpDown, RefreshCw,
    Plus, Calendar, FolderKanban, PiggyBank,
    Wallet, AlertCircle, CheckCircle2, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAllProjectsExecution } from '@/hooks/useProjectExecution';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type SortField = 'project_name' | 'net_contract_value' | 'total_collected' | 'outstanding';
type SortDir = 'asc' | 'desc';

interface ClientCollection {
    id: string;
    project_id: string;
    amount: number;
    collection_date: string;
    payment_mode: string;
    reference_number: string | null;
    description: string | null;
    status: string;
    created_at: string;
}

/* ─── Animated counter ─── */
function AnimatedValue({ value, prefix = '₹' }: { value: number; prefix?: string }) {
    const display = useMemo(() => {
        if (value >= 10000000) return `${prefix}${(value / 10000000).toFixed(2)} Cr`;
        if (value >= 100000) return `${prefix}${(value / 100000).toFixed(2)} L`;
        if (value >= 1000) return `${prefix}${(value / 1000).toFixed(1)} K`;
        return `${prefix}${value.toFixed(0)}`;
    }, [value, prefix]);
    return (
        <motion.span
            key={display}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            {display}
        </motion.span>
    );
}

/* ─── Stat Card component ─── */
function StatCard({
    title, value, icon: Icon, accentColor, gradient, delay = 0, subtitle, badge
}: {
    title: string;
    value: number;
    icon: React.ElementType;
    accentColor: string;
    gradient: string;
    delay?: number;
    subtitle?: string;
    badge?: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay }}
        >
            <Card className="relative overflow-hidden border-border/40 bg-card/60 backdrop-blur-md hover:border-border/60 transition-all duration-300 group cursor-default">
                {/* Gradient accent bar */}
                <div className={cn("absolute top-0 left-0 right-0 h-1", gradient)} />
                {/* Subtle background glow */}
                <div className={cn("absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-[0.06] group-hover:opacity-[0.10] transition-opacity duration-500", gradient)} />

                <CardContent className="p-5 relative">
                    <div className="flex items-start justify-between mb-3">
                        <div className={cn("p-2.5 rounded-xl", `bg-${accentColor}/10`)}>
                            <Icon className={cn("w-5 h-5", `text-${accentColor}`)} />
                        </div>
                        {badge && (
                            <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0.5">
                                {badge}
                            </Badge>
                        )}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase mb-1">{title}</p>
                    <p className={cn("text-2xl font-bold tracking-tight", `text-${accentColor}`)}>
                        <AnimatedValue value={value} />
                    </p>
                    {subtitle && (
                        <p className="text-[11px] text-muted-foreground mt-1.5">{subtitle}</p>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}

/* ─── Main page ─── */
export default function GMOProjectFinancialsPage() {
    const { projects, isLoading: projectsLoading, isRefetching, refetch } = useAllProjectsExecution();
    const { user } = useAuth();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [sortField, setSortField] = useState<SortField>('outstanding');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    // Client collections
    const [collections, setCollections] = useState<ClientCollection[]>([]);
    const [collectionsLoading, setCollectionsLoading] = useState(true);

    // Add dialog
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [addingForProject, setAddingForProject] = useState<any>(null);
    const [formData, setFormData] = useState({
        amount: '',
        collection_date: format(new Date(), 'yyyy-MM-dd'),
        payment_mode: 'bank_transfer',
        reference_number: '',
        description: ''
    });
    const [submitting, setSubmitting] = useState(false);

    const fetchCollections = useCallback(async () => {
        try {
            setCollectionsLoading(true);
            const { data, error } = await supabase
                .from('client_collections' as any)
                .select('*')
                .eq('status', 'collected')
                .order('collection_date', { ascending: false });
            if (error) throw error;
            setCollections((data as any[]) || []);
        } catch (err) {
            console.error('Error fetching collections:', err);
        } finally {
            setCollectionsLoading(false);
        }
    }, []);

    useEffect(() => { fetchCollections(); }, [fetchCollections]);

    const collectionByProject = useMemo(() => {
        const map = new Map<string, number>();
        collections.forEach(c => {
            map.set(c.project_id, (map.get(c.project_id) || 0) + (Number(c.amount) || 0));
        });
        return map;
    }, [collections]);

    const collectionsByProjectId = useMemo(() => {
        const map = new Map<string, ClientCollection[]>();
        collections.forEach(c => {
            const arr = map.get(c.project_id) || [];
            arr.push(c);
            map.set(c.project_id, arr);
        });
        return map;
    }, [collections]);

    const processedData = useMemo(() => {
        if (!projects) return null;

        const filtered = projects.filter(p => {
            const q = searchQuery.toLowerCase();
            return !q || (p.project_name || '').toLowerCase().includes(q) ||
                (p.client_name || '').toLowerCase().includes(q);
        });

        const sorted = [...filtered].sort((a, b) => {
            let aVal: any, bVal: any;
            const aC = collectionByProject.get(a.id) || 0;
            const bC = collectionByProject.get(b.id) || 0;
            switch (sortField) {
                case 'project_name': aVal = a.project_name || ''; bVal = b.project_name || ''; break;
                case 'net_contract_value': aVal = a.net_contract_value || 0; bVal = b.net_contract_value || 0; break;
                case 'total_collected': aVal = aC; bVal = bC; break;
                case 'outstanding':
                    aVal = (a.net_contract_value || 0) - aC;
                    bVal = (b.net_contract_value || 0) - bC;
                    break;
                default: aVal = 0; bVal = 0;
            }
            const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal;
            return sortDir === 'asc' ? cmp : -cmp;
        });

        const totalPipeline = projects.reduce((s, p) => s + (Number(p.net_contract_value) || 0), 0);
        const totalCollected = projects.reduce((s, p) => s + (collectionByProject.get(p.id) || 0), 0);
        const totalOutstanding = Math.max(totalPipeline - totalCollected, 0);
        const fullyCollected = projects.filter(p => {
            const net = Number(p.net_contract_value) || 0;
            const col = collectionByProject.get(p.id) || 0;
            return net > 0 && col >= net;
        }).length;

        return { projects: sorted, totalPipeline, totalCollected, totalOutstanding, fullyCollected };
    }, [projects, searchQuery, sortField, sortDir, collectionByProject]);

    const toggleSort = (field: SortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
    };

    const fmt = (v: number) => {
        if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
        if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
        if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
        return `₹${v.toFixed(0)}`;
    };

    const openAddDialog = (project: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setAddingForProject(project);
        setFormData({
            amount: '',
            collection_date: format(new Date(), 'yyyy-MM-dd'),
            payment_mode: 'bank_transfer',
            reference_number: '',
            description: ''
        });
        setShowAddDialog(true);
    };

    const handleAddCollection = async () => {
        if (!addingForProject || !formData.amount || Number(formData.amount) <= 0) {
            toast({ title: 'Please enter a valid amount', variant: 'destructive' });
            return;
        }
        try {
            setSubmitting(true);
            const { error } = await supabase.from('client_collections' as any).insert({
                project_id: addingForProject.id,
                amount: Number(formData.amount),
                collection_date: formData.collection_date,
                payment_mode: formData.payment_mode,
                reference_number: formData.reference_number || null,
                description: formData.description || null,
                status: 'collected',
                created_by: user?.id || null
            } as any);
            if (error) throw error;
            toast({ title: 'Collection recorded', description: `₹${Number(formData.amount).toLocaleString()} for ${addingForProject.project_name}` });
            setShowAddDialog(false);
            fetchCollections();
        } catch (err: any) {
            toast({ title: 'Failed to record', description: err.message, variant: 'destructive' });
        } finally {
            setSubmitting(false);
        }
    };

    const isLoading = projectsLoading || collectionsLoading;

    if (isLoading || !processedData) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground animate-pulse">Loading financial data...</p>
                </div>
            </div>
        );
    }

    const { totalPipeline, totalCollected, totalOutstanding, fullyCollected } = processedData;
    const collectionPercent = totalPipeline > 0 ? (totalCollected / totalPipeline) * 100 : 0;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto"
        >
            {/* ─── Header ─── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                        Project Financials
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Customer collection tracking &bull; {format(new Date(), 'EEEE, MMMM dd, yyyy')}
                    </p>
                </motion.div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { refetch(); fetchCollections(); }}
                    disabled={isRefetching}
                    className="gap-2"
                >
                    <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            {/* ─── Summary Stat Cards ─── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                    title="Total Projects"
                    value={projects.length}
                    icon={FolderKanban}
                    accentColor="primary"
                    gradient="bg-gradient-to-r from-primary to-primary/60"
                    delay={0}
                    subtitle="Active projects"
                    badge={`${fullyCollected} paid`}
                />
                <StatCard
                    title="Total Value"
                    value={totalPipeline}
                    icon={PiggyBank}
                    accentColor="primary"
                    gradient="bg-gradient-to-r from-blue-500 to-cyan-400"
                    delay={0.05}
                    subtitle="Net contract value"
                />
                <StatCard
                    title="Total Collected"
                    value={totalCollected}
                    icon={Wallet}
                    accentColor="emerald-500"
                    gradient="bg-gradient-to-r from-emerald-500 to-teal-400"
                    delay={0.1}
                    subtitle="Customer payments received"
                    badge={`${collectionPercent.toFixed(0)}%`}
                />
                <StatCard
                    title="Outstanding"
                    value={totalOutstanding}
                    icon={AlertCircle}
                    accentColor="amber-500"
                    gradient="bg-gradient-to-r from-amber-500 to-orange-400"
                    delay={0.15}
                    subtitle="Pending from customers"
                />
                <StatCard
                    title="Fully Collected"
                    value={fullyCollected}
                    icon={CheckCircle2}
                    accentColor="emerald-500"
                    gradient="bg-gradient-to-r from-emerald-500 to-green-400"
                    delay={0.2}
                    subtitle="Projects at 100%"
                />
            </div>

            {/* ─── Collection Efficiency Bar ─── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
            >
                <Card className="border-border/40 bg-card/60 backdrop-blur-md">
                    <CardContent className="p-5">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-primary" />
                                <span className="text-sm font-semibold text-foreground">Collection Efficiency</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                                <span className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                    Collected: <span className="font-semibold">{fmt(totalCollected)}</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                                    Outstanding: <span className="font-semibold">{fmt(totalOutstanding)}</span>
                                </span>
                            </div>
                        </div>
                        <div className="relative h-4 bg-muted/40 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${collectionPercent}%` }}
                                transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[11px] font-bold text-foreground drop-shadow-sm">
                                    {collectionPercent.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* ─── Per-Project Table ─── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <Card className="border-border/40 bg-card/60 backdrop-blur-md">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <IndianRupee className="w-5 h-5 text-primary" />
                                Per-Project Breakdown
                            </CardTitle>
                            <div className="relative w-full sm:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by project or client..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-9 bg-background/50"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* Table Header */}
                        <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-3 border-y border-border/30 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            <div className="col-span-3 flex items-center gap-1 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('project_name')}>
                                Project {sortField === 'project_name' && <ArrowUpDown className="h-3 w-3" />}
                            </div>
                            <div className="col-span-2 text-right flex items-center justify-end gap-1 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('net_contract_value')}>
                                Net Value {sortField === 'net_contract_value' && <ArrowUpDown className="h-3 w-3" />}
                            </div>
                            <div className="col-span-2 text-right flex items-center justify-end gap-1 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('total_collected')}>
                                Collected {sortField === 'total_collected' && <ArrowUpDown className="h-3 w-3" />}
                            </div>
                            <div className="col-span-2 text-right flex items-center justify-end gap-1 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('outstanding')}>
                                Outstanding {sortField === 'outstanding' && <ArrowUpDown className="h-3 w-3" />}
                            </div>
                            <div className="col-span-1 text-center">Progress</div>
                            <div className="col-span-2 text-center">Action</div>
                        </div>

                        {/* Table Rows */}
                        <div className="divide-y divide-border/20">
                            {processedData.projects.length === 0 ? (
                                <div className="px-5 py-16 text-center">
                                    <Search className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
                                    <p className="text-sm text-muted-foreground">No projects found</p>
                                </div>
                            ) : (
                                processedData.projects.map((project, idx) => {
                                    const baseValue = Number(project.total_project_value) || Number(project.approved_budget) || 0;
                                    const additions = project.total_additions || 0;
                                    const deductions = project.total_deductions || 0;
                                    const netValue = project.net_contract_value || 0;
                                    const collected = collectionByProject.get(project.id) || 0;
                                    const outstanding = Math.max(netValue - collected, 0);
                                    const pct = netValue > 0 ? Math.min((collected / netValue) * 100, 100) : 0;
                                    const isExpanded = expandedId === project.id;
                                    const projectCollections = collectionsByProjectId.get(project.id) || [];

                                    return (
                                        <motion.div
                                            key={project.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: idx * 0.02 }}
                                        >
                                            {/* Desktop Row */}
                                            <div
                                                className="hidden md:grid grid-cols-12 gap-2 px-5 py-3.5 hover:bg-muted/15 cursor-pointer transition-all duration-200 items-center group"
                                                onClick={() => setExpandedId(isExpanded ? null : project.id)}
                                            >
                                                <div className="col-span-3 flex items-center gap-3 min-w-0">
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                                                        pct >= 100 ? "bg-emerald-500/15 text-emerald-500" :
                                                            pct >= 50 ? "bg-amber-500/15 text-amber-500" :
                                                                "bg-muted/50 text-muted-foreground"
                                                    )}>
                                                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{project.project_name || 'Unnamed'}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{project.client_name || '—'}</p>
                                                    </div>
                                                </div>
                                                <div className="col-span-2 text-right">
                                                    <p className="text-sm font-semibold">{fmt(netValue)}</p>
                                                </div>
                                                <div className="col-span-2 text-right">
                                                    <p className="text-sm font-semibold text-emerald-500">{fmt(collected)}</p>
                                                </div>
                                                <div className="col-span-2 text-right">
                                                    <p className={cn("text-sm font-semibold", outstanding > 0 ? "text-amber-500" : "text-emerald-500")}>
                                                        {fmt(outstanding)}
                                                    </p>
                                                </div>
                                                <div className="col-span-1 flex justify-center">
                                                    <div className="w-full max-w-[80px]">
                                                        <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                                                            <div
                                                                className={cn(
                                                                    "h-full rounded-full transition-all duration-500",
                                                                    pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400"
                                                                )}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                        <p className="text-[10px] text-center text-muted-foreground mt-0.5">{pct.toFixed(0)}%</p>
                                                    </div>
                                                </div>
                                                <div className="col-span-2 flex justify-center">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-xs gap-1.5 h-8 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                                                        onClick={(e) => openAddDialog(project, e)}
                                                    >
                                                        <Plus className="h-3.5 w-3.5" /> Record
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Mobile Row */}
                                            <div
                                                className="md:hidden px-4 py-3 space-y-3 cursor-pointer active:bg-muted/10"
                                                onClick={() => setExpandedId(isExpanded ? null : project.id)}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-semibold truncate">{project.project_name || 'Unnamed'}</p>
                                                        <p className="text-xs text-muted-foreground">{project.client_name || '—'}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                                        <Badge
                                                            variant={pct >= 100 ? 'default' : 'outline'}
                                                            className={cn("text-[10px]", pct >= 100 && "bg-emerald-500")}
                                                        >
                                                            {pct.toFixed(0)}%
                                                        </Badge>
                                                        <Button variant="ghost" size="sm" className="h-7 px-2 text-emerald-500" onClick={(e) => openAddDialog(project, e)}>
                                                            <Plus className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <MobileStat label="Net Value" value={fmt(netValue)} />
                                                    <MobileStat label="Collected" value={fmt(collected)} valueClass="text-emerald-500" />
                                                    <MobileStat label="Outstanding" value={fmt(outstanding)} valueClass={outstanding > 0 ? "text-amber-500" : "text-emerald-500"} />
                                                </div>
                                                <Progress value={pct} className="h-1.5" />
                                            </div>

                                            {/* Expanded Detail */}
                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.3 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="px-4 md:px-6 py-5 bg-muted/5 border-t border-border/20">
                                                            {/* Financial breakdown cards */}
                                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                                                                <MiniCard label="Base Contract" value={fmt(baseValue)} icon={IndianRupee} />
                                                                <MiniCard label="Additions" value={additions > 0 ? `+${fmt(additions)}` : '—'} icon={TrendingUp} valueClass="text-emerald-500" />
                                                                <MiniCard label="Deductions" value={deductions > 0 ? `-${fmt(deductions)}` : '—'} icon={TrendingDown} valueClass="text-red-500" />
                                                                <MiniCard label="Net Value" value={fmt(netValue)} icon={PiggyBank} valueClass="text-primary" />
                                                                <MiniCard label="Outstanding" value={fmt(outstanding)} icon={AlertCircle} valueClass={outstanding > 0 ? "text-amber-500" : "text-emerald-500"} />
                                                            </div>

                                                            {/* Collection progress */}
                                                            <div className="mb-5">
                                                                <div className="flex justify-between text-xs mb-2">
                                                                    <span className="text-muted-foreground font-medium">Collection Progress</span>
                                                                    <span className="font-semibold">{fmt(collected)} of {fmt(netValue)}</span>
                                                                </div>
                                                                <div className="relative h-3 bg-muted/30 rounded-full overflow-hidden">
                                                                    <motion.div
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${pct}%` }}
                                                                        transition={{ duration: 0.8 }}
                                                                        className={cn(
                                                                            "absolute inset-y-0 left-0 rounded-full",
                                                                            pct >= 100 ? "bg-gradient-to-r from-emerald-500 to-green-400" :
                                                                                pct >= 50 ? "bg-gradient-to-r from-amber-400 to-yellow-400" :
                                                                                    "bg-gradient-to-r from-red-400 to-orange-400"
                                                                        )}
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Collection History */}
                                                            <div>
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                                        <Calendar className="h-3.5 w-3.5" /> Collection History
                                                                    </h4>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="text-xs h-7 gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                                                                        onClick={(e) => openAddDialog(project, e)}
                                                                    >
                                                                        <Plus className="h-3 w-3" /> Add Collection
                                                                    </Button>
                                                                </div>
                                                                {projectCollections.length === 0 ? (
                                                                    <div className="text-center py-6 text-xs text-muted-foreground bg-background/30 rounded-lg border border-dashed border-border/30">
                                                                        No collections recorded yet. Click "Add Collection" to start.
                                                                    </div>
                                                                ) : (
                                                                    <div className="border border-border/30 rounded-lg overflow-hidden">
                                                                        <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted/15 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                                            <div className="col-span-3">Date</div>
                                                                            <div className="col-span-3 text-right">Amount</div>
                                                                            <div className="col-span-2">Mode</div>
                                                                            <div className="col-span-2">Reference</div>
                                                                            <div className="col-span-2">Note</div>
                                                                        </div>
                                                                        {projectCollections.map(c => (
                                                                            <div key={c.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs border-t border-border/15 hover:bg-muted/10 transition-colors">
                                                                                <div className="col-span-3 md:col-span-3 font-medium">{format(new Date(c.collection_date), 'dd MMM yyyy')}</div>
                                                                                <div className="col-span-3 md:col-span-3 text-right font-bold text-emerald-500">+₹{Number(c.amount).toLocaleString()}</div>
                                                                                <div className="col-span-3 md:col-span-2 capitalize text-muted-foreground">{(c.payment_mode || '').replace(/_/g, ' ')}</div>
                                                                                <div className="col-span-3 md:col-span-2 truncate text-muted-foreground font-mono text-[10px]">{c.reference_number || '—'}</div>
                                                                                <div className="hidden md:block col-span-2 truncate text-muted-foreground">{c.description || '—'}</div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer Totals */}
                        {processedData.projects.length > 0 && (
                            <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-3.5 border-t-2 border-border/40 bg-muted/25 text-sm font-bold">
                                <div className="col-span-3 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">{processedData.projects.length}</div>
                                    TOTAL
                                </div>
                                <div className="col-span-2 text-right">{fmt(totalPipeline)}</div>
                                <div className="col-span-2 text-right text-emerald-500">{fmt(totalCollected)}</div>
                                <div className="col-span-2 text-right text-amber-500">{fmt(totalOutstanding)}</div>
                                <div className="col-span-1 text-center">
                                    <Badge variant="secondary" className="text-[10px]">{collectionPercent.toFixed(0)}%</Badge>
                                </div>
                                <div className="col-span-2" />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            {/* ─── Add Collection Dialog ─── */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-emerald-500/10">
                                <IndianRupee className="h-5 w-5 text-emerald-500" />
                            </div>
                            Record Customer Collection
                        </DialogTitle>
                        {addingForProject && (
                            <p className="text-sm text-muted-foreground mt-1">
                                {addingForProject.project_name} — {addingForProject.client_name || 'Unknown Client'}
                            </p>
                        )}
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider">Amount (₹) *</Label>
                            <Input
                                type="number"
                                placeholder="Enter collection amount..."
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                className="text-lg font-semibold"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider">Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.collection_date}
                                    onChange={e => setFormData({ ...formData, collection_date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider">Payment Mode</Label>
                                <Select value={formData.payment_mode} onValueChange={v => setFormData({ ...formData, payment_mode: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                        <SelectItem value="cheque">Cheque</SelectItem>
                                        <SelectItem value="cash">Cash</SelectItem>
                                        <SelectItem value="upi">UPI</SelectItem>
                                        <SelectItem value="rtgs">RTGS/NEFT</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider">Reference / UTR</Label>
                            <Input
                                placeholder="Transaction reference number..."
                                value={formData.reference_number}
                                onChange={e => setFormData({ ...formData, reference_number: e.target.value })}
                                className="font-mono"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider">Description</Label>
                            <Input
                                placeholder="e.g. Milestone 1 payment, Booking amount..."
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                        <Button
                            onClick={handleAddCollection}
                            disabled={submitting}
                            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Record Collection
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}

/* ─── Sub-components ─── */

function MobileStat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
    return (
        <div className="bg-background/30 rounded-lg p-2">
            <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
            <p className={cn("text-xs font-bold", valueClass)}>{value}</p>
        </div>
    );
}

function MiniCard({ label, value, icon: Icon, valueClass }: {
    label: string; value: string; icon: React.ElementType; valueClass?: string;
}) {
    return (
        <div className="p-3 rounded-xl bg-background/40 border border-border/20 hover:border-border/40 transition-colors">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5">
                <Icon className="h-3 w-3" />
                {label}
            </div>
            <p className={cn("text-sm font-bold", valueClass)}>{value}</p>
        </div>
    );
}
