
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    History,
    Building2,
    MapPin,
    Calendar,
    TrendingUp,
    Search,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    Wallet,
    CheckCircle2,
    Clock,
    AlertTriangle,
    ExternalLink,
    Banknote,
    Hourglass,
    User
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { RentalStatusBadge } from '@/components/rental/RentalStatusBadge';
import { RentalBreakdownDialog } from '@/components/rental/RentalBreakdownDialog';

export default function CEORentalPortfolioPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [breakdownView, setBreakdownView] = useState<{ open: boolean, title: string, description?: string, records: any[] }>({ open: false, title: '', records: [] });
    const [selectedProperty, setSelectedProperty] = useState<any>(null);

    // 1. Fetch All Properties with their current month status
    const { data: properties, isLoading: propsLoading } = useQuery({
        queryKey: ['ceo-rental-portfolio-properties'],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from('rental_properties')
                .select(`
                    *,
                    rental_categories(name, owner_role),
                    rental_monthly_records(status, month_year, net_payable_amount)
                `)
                .eq('status', 'Active');
            if (error) throw error;
            return data;
        },
    });

    // 2. Fetch Historical Timeline (last 6 months - increased to catch current month data reliably)
    const { data: history, isLoading: historyLoading } = useQuery({
        queryKey: ['ceo-rental-history'],
        queryFn: async () => {
            const sixMonthsAgo = startOfMonth(subMonths(new Date(), 6));
            const { data, error } = await (supabase as any)
                .from('rental_monthly_records')
                .select(`
                    *,
                    rental_properties(title, location, rental_categories(name))
                `)
                .gte('month_year', sixMonthsAgo.toISOString())
                .order('month_year', { ascending: false });
            if (error) throw error;
            return data;
        }
    });

    const filteredProperties = properties?.filter((p: any) => {
        const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.location.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    // Stats Calculation
    const currentMonthRecords = history?.filter((r: any) =>
        new Date(r.month_year).getMonth() === new Date().getMonth() &&
        new Date(r.month_year).getFullYear() === new Date().getFullYear()
    ) || [];

    const totalPortfolioValue = properties?.reduce((acc: number, p: any) => acc + (p.monthly_base_rent || 0), 0) || 0;
    const activePropertiesCount = properties?.length || 0;

    // Total JV Polyhouse Area (in Acres only - skip sq ft entries)
    const totalJVArea = properties
        ?.filter((p: any) => p.rental_categories?.name?.toLowerCase().includes('jv polyhouse'))
        .reduce((sum: number, p: any) => {
            const areaStr = String(p.area || '0').toLowerCase();
            // Skip sq ft entries - they are not in acres
            if (areaStr.includes('sq ft') || areaStr.includes('sqft') || areaStr.includes('sq.ft')) return sum;
            const numericValue = parseFloat(areaStr.replace(/[^0-9.]/g, '')) || 0;
            return sum + numericValue;
        }, 0) || 0;

    // Segment Records
    const raisedRecords = currentMonthRecords.filter((r: any) => r.status === 'RAISED_FOR_APPROVAL');
    const paidRecords = currentMonthRecords.filter((r: any) => r.status === 'PAYMENT_EXECUTED');
    const pendingRecords = currentMonthRecords.filter((r: any) => !['RAISED_FOR_APPROVAL', 'PAYMENT_EXECUTED'].includes(r.status));

    // Calculate Amounts
    const totalRaised = raisedRecords.reduce((sum: number, r: any) => sum + (r.net_payable_amount || 0), 0);
    const totalPaid = paidRecords.reduce((sum: number, r: any) => sum + (r.net_payable_amount || 0), 0);
    const totalPending = pendingRecords.reduce((sum: number, r: any) => sum + (r.net_payable_amount || r.base_rent || 0), 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 pb-20"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">Rental Oversight</h1>
                    <p className="text-muted-foreground font-medium">Strategic view of the IGO Group rental portfolio.</p>
                </div>
            </div>

            {/* Portfolio Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                <Card className="bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-500/20 shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-2 opacity-10"><Building2 className="w-16 h-16 text-indigo-600" /></div>
                    <CardHeader className="pb-1 pt-3 px-3">
                        <CardDescription className="text-indigo-600 dark:text-indigo-400 font-bold uppercase text-[10px] tracking-wider">Total Monthly Commit</CardDescription>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">Total Value</p>
                                <CardTitle className="text-xl font-black text-foreground">₹{totalPortfolioValue.toLocaleString()}</CardTitle>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">Properties</p>
                                <p className="text-xl font-black text-indigo-600">{activePropertiesCount}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Pending Processing */}
                <Card
                    className={`bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20 shadow-sm relative overflow-hidden cursor-pointer hover:bg-amber-500/10 transition-colors ${pendingRecords.length > 0 ? 'ring-1 ring-amber-500/30' : ''}`}
                    onClick={() => setBreakdownView({
                        open: true,
                        title: 'Pending Processing',
                        description: 'Rentals that are either in Draft, Electricity Updated, or HR Approval stage.',
                        records: pendingRecords
                    })}
                >
                    <div className="absolute right-0 top-0 p-2 opacity-10"><Hourglass className="w-16 h-16 text-amber-600" /></div>
                    <CardHeader className="pb-1 pt-3 px-3">
                        <div className="flex justify-between items-start">
                            <CardDescription className="text-amber-600 dark:text-amber-400 font-bold uppercase text-[10px] tracking-wider">Pending</CardDescription>
                            <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20">View</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">Value</p>
                                <CardTitle className="text-xl font-black text-foreground">₹{totalPending.toLocaleString()}</CardTitle>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">Records</p>
                                <p className="text-xl font-black text-amber-600">{pendingRecords.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Raised to CEO */}
                <Card
                    className={`bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20 shadow-sm relative overflow-hidden cursor-pointer hover:bg-blue-500/10 transition-colors ${raisedRecords.length > 0 ? 'ring-1 ring-blue-500/30' : ''}`}
                    onClick={() => setBreakdownView({
                        open: true,
                        title: 'Raised for Approval',
                        description: 'Rentals waiting for CEO approval and payment execution.',
                        records: raisedRecords
                    })}
                >
                    <div className="absolute right-0 top-0 p-2 opacity-10"><AlertTriangle className="w-16 h-16 text-blue-600" /></div>
                    <CardHeader className="pb-1 pt-3 px-3">
                        <div className="flex justify-between items-start">
                            <CardDescription className="text-blue-600 dark:text-blue-400 font-bold uppercase text-[10px] tracking-wider">Action Required</CardDescription>
                            <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-600 border-blue-500/20">View</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">Value</p>
                                <CardTitle className="text-xl font-black text-foreground">₹{totalRaised.toLocaleString()}</CardTitle>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">Approvals</p>
                                <p className="text-xl font-black text-blue-600 animate-pulse">{raisedRecords.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Paid */}
                <Card
                    className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20 shadow-sm relative overflow-hidden cursor-pointer hover:bg-emerald-500/10 transition-colors"
                    onClick={() => setBreakdownView({
                        open: true,
                        title: 'Paid this Month',
                        description: 'Rentals that have been successfully paid this month.',
                        records: paidRecords
                    })}
                >
                    <div className="absolute right-0 top-0 p-2 opacity-10"><Banknote className="w-16 h-16 text-emerald-600" /></div>
                    <CardHeader className="pb-1 pt-3 px-3">
                        <div className="flex justify-between items-start">
                            <CardDescription className="text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[10px] tracking-wider">Paid Amount</CardDescription>
                            <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">View</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">Value</p>
                                <CardTitle className="text-xl font-black text-foreground">₹{totalPaid.toLocaleString()}</CardTitle>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">Done</p>
                                <p className="text-xl font-black text-emerald-600">{paidRecords.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 5. Total JV Polyhouse Area */}
                <Card className="bg-gradient-to-br from-emerald-600/10 to-transparent border-emerald-500/20 shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-2 opacity-10"><MapPin className="w-16 h-16 text-emerald-600" /></div>
                    <CardHeader className="pb-1 pt-3 px-3">
                        <CardDescription className="text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[10px] tracking-wider">JV Polyhouse Area</CardDescription>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">Total Area</p>
                                <CardTitle className="text-xl font-black text-foreground">{totalJVArea.toFixed(2)} <span className="text-sm text-muted-foreground">Acres</span></CardTitle>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="portfolio" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="portfolio" className="font-bold">
                        <LayoutDashboard className="w-4 h-4 mr-2" /> Portfolio
                    </TabsTrigger>
                    <TabsTrigger value="timeline" className="font-bold">
                        <History className="w-4 h-4 mr-2" /> Timeline
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="portfolio" className="mt-6 space-y-4">
                    <div className="flex gap-4 items-center mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by title or location..."
                                className="pl-10"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {filteredProperties?.map((prop: any) => {
                            const latestRecord = prop.rental_monthly_records?.[0]; // Usually current month due to trigger
                            return (
                                <Card
                                    key={prop.id}
                                    className="group hover:border-primary/50 transition-all cursor-pointer"
                                    onClick={() => setSelectedProperty(prop)}
                                >
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                                <Building2 className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-lg">{prop.title}</h3>
                                                    <Badge variant="outline" className="text-[10px] uppercase font-bold">{prop.rental_categories?.name}</Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" /> {prop.location}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <p className="font-mono font-bold">₹{prop.monthly_base_rent?.toLocaleString()}</p>
                                            <div className="flex justify-end">
                                                <RentalStatusBadge status={latestRecord?.status || 'NOT_STARTED'} />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="timeline" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl">Payment Timeline</CardTitle>
                            <CardDescription>Historical and current month rental tracking.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="relative border-l-2 border-muted ml-4 pl-8 space-y-8">
                                {history?.map((record: any, idx: number) => (
                                    <div key={record.id} className="relative">
                                        <div className="absolute -left-[41px] top-1 w-4 h-4 rounded-full bg-background border-2 border-primary z-10" />
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div>
                                                <p className="text-xs font-black text-primary uppercase tracking-tighter mb-1">
                                                    {format(new Date(record.month_year), 'MMMM yyyy')}
                                                </p>
                                                <h4 className="font-bold text-foreground truncate max-w-[300px]">
                                                    {record.rental_properties.title}
                                                </h4>
                                                <p className="text-xs text-muted-foreground">{record.rental_properties.rental_categories.name}</p>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <p className="font-mono font-bold text-sm">₹{record.net_payable_amount.toLocaleString()}</p>
                                                    <div className="flex flex-col items-end">
                                                        <p className="text-[10px] text-muted-foreground">Total Payout</p>
                                                        {record.status === 'PAYMENT_EXECUTED' && record.payment_date && (
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" /> {format(new Date(record.payment_date), 'dd MMM')}
                                                                </span>
                                                                {(record.payment_proof_url || record.payment_proof_link) && (
                                                                    <a
                                                                        href={record.payment_proof_url || record.payment_proof_link}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-[10px] text-blue-500 hover:underline flex items-center gap-1"
                                                                        title="View Proof"
                                                                    >
                                                                        <ExternalLink className="w-3 h-3" /> Proof
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <RentalStatusBadge status={record.status} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Property Details Dialog */}
            <Dialog open={!!selectedProperty} onOpenChange={() => setSelectedProperty(null)}>
                <DialogContent className="max-w-3xl border-white/10 bg-zinc-950 shadow-2xl backdrop-blur-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="border-b border-white/5 p-6 pb-4">
                        <DialogTitle className="flex items-center gap-3 text-2xl font-black text-white">
                            <div className="p-2 rounded-xl bg-primary/20 text-primary">
                                <Building2 className="w-6 h-6" />
                            </div>
                            {selectedProperty?.title}
                        </DialogTitle>
                        <DialogDescription className="flex items-center gap-2 mt-2 font-medium text-zinc-400">
                            <MapPin className="w-4 h-4 text-primary" /> {selectedProperty?.location}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedProperty && (
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Section 1: Agreement Details */}
                                <div className="space-y-4 p-5 rounded-2xl bg-zinc-900/80 border border-white/5 shadow-inner">
                                    <h3 className="font-bold text-xs uppercase tracking-widest text-primary flex items-center gap-2">
                                        <Calendar className="w-4 h-4" /> Agreement Timeline
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-xs text-zinc-500 font-medium mb-1">Start Date</p>
                                            <p className="font-bold text-zinc-200">{format(new Date(selectedProperty.agreement_start_date), 'dd MMM yyyy')}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500 font-medium mb-1">Expiry Date</p>
                                            <p className="font-bold text-zinc-200">{format(new Date(selectedProperty.agreement_expiry_date), 'dd MMM yyyy')}</p>
                                        </div>
                                        <div className="col-span-2 bg-black/20 p-3 rounded-lg border border-white/5">
                                            <p className="text-xs text-zinc-500 font-medium mb-1">Rent Cycle</p>
                                            <p className="font-bold text-zinc-200">Due on <span className="text-primary">{selectedProperty.rent_due_day}</span> of every month</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Financials */}
                                <div className="space-y-4 p-5 rounded-2xl bg-zinc-900/80 border border-white/5 shadow-inner">
                                    <h3 className="font-bold text-xs uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                                        <Wallet className="w-4 h-4" /> Financials
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="col-span-2 bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                                            <p className="text-xs text-emerald-600/70 dark:text-emerald-400 font-bold uppercase tracking-wider mb-1">Monthly Base Rent</p>
                                            <p className="text-3xl font-black text-emerald-500">₹{selectedProperty.monthly_base_rent?.toLocaleString()}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-xs text-zinc-500 font-medium mb-1">Advance Amount</p>
                                            <p className="font-bold text-zinc-200">₹{selectedProperty.advance_amount?.toLocaleString() || 0}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Bank Details */}
                                <div className="col-span-1 md:col-span-2 space-y-4 p-5 rounded-2xl bg-zinc-900/80 border border-white/5 shadow-inner relative overflow-hidden">
                                    <div className="absolute right-0 top-0 p-4 opacity-5 pointer-events-none">
                                        <Banknote className="w-32 h-32" />
                                    </div>
                                    <h3 className="font-bold text-xs uppercase tracking-widest text-blue-500 flex items-center gap-2 relative z-10">
                                        <Building2 className="w-4 h-4" /> Bank / Payee Details
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm relative z-10">
                                        <div>
                                            <p className="text-xs text-zinc-500 font-medium mb-1">Beneficiary Name</p>
                                            <p className="font-bold text-zinc-200">{selectedProperty.holder_name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500 font-medium mb-1">Bank Name</p>
                                            <p className="font-bold text-zinc-200">{selectedProperty.bank_name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500 font-medium mb-1">Branch</p>
                                            <p className="font-bold text-zinc-200">{selectedProperty.branch_name || 'N/A'}</p>
                                        </div>
                                        <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                                            <p className="text-xs text-zinc-500 font-medium mb-1">Account Number</p>
                                            <p className="font-mono text-base font-bold text-blue-400 tracking-wider">{selectedProperty.account_number || 'N/A'}</p>
                                        </div>
                                        <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                                            <p className="text-xs text-zinc-500 font-medium mb-1">IFSC Code</p>
                                            <p className="font-mono font-bold text-zinc-200 tracking-wider">{selectedProperty.ifsc_code || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 4: Owner Info */}
                                <div className="col-span-1 md:col-span-2 space-y-4 p-5 rounded-2xl bg-zinc-900/80 border border-white/5 shadow-inner">
                                    <h3 className="font-bold text-xs uppercase tracking-widest text-purple-500 flex items-center gap-2">
                                        <User className="w-4 h-4" /> Owner Info
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <p className="text-xs text-zinc-500 font-medium mb-1">Owner Name</p>
                                            <p className="font-bold text-zinc-200">{selectedProperty.owner_name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500 font-medium mb-1">Farm Name</p>
                                            <p className="font-bold text-zinc-200">{selectedProperty.farm_name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500 font-medium mb-1">Contact</p>
                                            <p className="font-mono font-bold text-zinc-200">{selectedProperty.phone_number || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500 font-medium mb-1">Category</p>
                                            <Badge className="bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border-purple-500/30">
                                                {selectedProperty.rental_categories?.name}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <RentalBreakdownDialog
                open={breakdownView.open}
                onOpenChange={(open) => setBreakdownView(prev => ({ ...prev, open }))}
                title={breakdownView.title}
                description={breakdownView.description}
                records={breakdownView.records}
            />
        </motion.div>
    );
}
