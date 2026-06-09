import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList, Sprout, MapPin, Calendar, Plus, ExternalLink, Zap, AlertTriangle, ArrowRight,
    CheckCircle2, ListChecks, ChevronDown, ChevronUp, RotateCcw, AlertCircle, Search, Filter,
    MessageSquare, PlusCircle, User as UserIcon, Loader2, Building2, Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { RentalDeductionDialog } from '@/components/rental/RentalDeductionDialog';
import { RentalStatusBadge } from '@/components/rental/RentalStatusBadge';
import { DashboardCard } from '@/components/rental/DashboardCard';
import { RentalExpensesDialog } from '@/components/rental/RentalExpensesDialog';
import { RentalAdditionDialog } from '@/components/rental/RentalAdditionDialog';
import { RentalRemarksDialog } from '@/components/rental/RentalRemarksDialog';
import { RentalRemarksPreview } from '@/components/rental/RentalRemarksPreview';
import { useAuth } from '@/contexts/AuthContext';

export default function HRRentalDashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [creatorFilter, setCreatorFilter] = useState<'all' | 'me' | 'rsh'>('all');
    const [isDeductionDialogOpen, setIsDeductionDialogOpen] = useState(false);
    const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
    const [expensePropertyId, setExpensePropertyId] = useState<string | null>(null);
    const [expensePropertyName, setExpensePropertyName] = useState('');
    const [isAdditionDialogOpen, setIsAdditionDialogOpen] = useState(false);
    const [expandedRemarks, setExpandedRemarks] = useState<Record<string, boolean>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const toggleRemarks = (recordId: string) => {
        setExpandedRemarks(prev => ({ ...prev, [recordId]: !prev[recordId] }));
    };

    // Fetch ALL properties (same as RSH - unified access)
    const { data: properties, isLoading: propsLoading } = useQuery({
        queryKey: ['hr-rental-properties'],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from('rental_properties')
                .select('*, rental_categories!inner(owner_role, name)')
                .eq('status', 'Active');
            if (error) throw error;

            if (!data || data.length === 0) return [];

            // Fetch creator profiles separately
            const creatorIds = [...new Set(data.map((r: any) => r.created_by).filter(Boolean))];

            let profileMap: Record<string, any> = {};
            if (creatorIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, name, role')
                    .in('id', creatorIds as string[]);

                if (profiles) {
                    profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
                }
            }

            // Attach creator info
            return data.map((r: any) => ({
                ...r,
                creator: r.created_by ? profileMap[r.created_by] : null
            }));
        },
    });

    // Fetch ALL monthly records (same as RSH)
    const { data: monthlyRecords, isLoading: recordsLoading } = useQuery({
        queryKey: ['hr-rental-records'],
        queryFn: async () => {
            try {
                const { data, error } = await (supabase as any)
                    .from('rental_monthly_records')
                    .select(`
                        *, 
                        rental_properties!inner(
                            title, 
                            location, 
                            monthly_base_rent, 
                            quotation_amount, 
                            deduction_percentage, 
                            rent_starts_from, 
                            created_by,
                            rental_categories!inner(owner_role), 
                            rental_property_remarks(count)
                        )
                    `)
                    .order('month_year', { ascending: false });

                if (error) throw error;
                if (!data || data.length === 0) return [];

                // Fetch creator profiles separately
                const creatorIds = [...new Set(data.map((r: any) => r.rental_properties?.created_by).filter(Boolean))];

                let profileMap: Record<string, any> = {};
                if (creatorIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, name, role')
                        .in('id', creatorIds as string[]);

                    if (profiles) {
                        profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
                    }
                }

                // Attach creator info
                return data.map((r: any) => ({
                    ...r,
                    rental_properties: {
                        ...r.rental_properties,
                        creator: r.rental_properties?.created_by ? profileMap[r.rental_properties.created_by] : null
                    }
                }));
            } catch (err) {
                console.error('Catch in HR monthlyRecords queryFn:', err);
                throw err;
            }
        },
    });

    const filteredRecords = (monthlyRecords || []).filter((record: any) => {
        if (!record.rental_properties) return false;

        const matchesSearch = !searchQuery ||
            record.rental_properties.title?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
            record.rental_properties.location?.toLowerCase()?.includes(searchQuery.toLowerCase());

        const currentStatus = record.status?.toUpperCase() || '';
        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'DRAFT' && ['DRAFT', 'ELECTRICITY_UPDATED'].includes(currentStatus)) ||
            (statusFilter === 'RAISED_FOR_APPROVAL' && currentStatus === 'RAISED_FOR_APPROVAL') ||
            (statusFilter === 'PAID' && currentStatus === 'PAYMENT_EXECUTED');

        if (!matchesSearch || !matchesStatus) return false;

        const propertyCreatorId = record.rental_properties?.created_by;
        const propertyCreatorRole = record.rental_properties?.creator?.role?.toLowerCase();

        if (creatorFilter === 'me') {
            // Show properties created by any HR-role user
            if (propertyCreatorRole !== 'hr') return false;
        } else if (creatorFilter === 'rsh') {
            if (propertyCreatorRole !== 'rsh') return false;
        }

        return true;
    });

    const raiseMutation = useMutation({
        mutationFn: async (recordId: string) => {
            const { error } = await (supabase as any)
                .from('rental_monthly_records')
                .update({ status: 'RAISED_FOR_APPROVAL' })
                .eq('id', recordId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hr-rental-records'] });
            toast.success('Raised to CEO');
        },
        onError: (error) => toast.error(error.message)
    });

    const resubmitMutation = useMutation({
        mutationFn: async (recordId: string) => {
            const { error } = await (supabase as any)
                .from('rental_monthly_records')
                .update({ status: 'RAISED_FOR_APPROVAL', rejection_reason: null })
                .eq('id', recordId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hr-rental-records'] });
            toast.success('Resubmitted to CEO for approval');
        },
        onError: (error) => toast.error(error.message)
    });

    const generateRecordMutation = useMutation({
        mutationFn: async (prop: any) => {
            const firstDayOfMonth = format(new Date(), 'yyyy-MM-01');

            // Check if record already exists for this property/month
            const { data: existing, error: checkError } = await (supabase as any)
                .from('rental_monthly_records')
                .select('id')
                .eq('property_id', prop.id)
                .eq('month_year', firstDayOfMonth)
                .maybeSingle();

            if (checkError) throw checkError;
            if (existing) throw new Error('Rent record already exists for current month');

            const { error } = await (supabase as any).from('rental_monthly_records').insert({
                property_id: prop.id,
                month_year: firstDayOfMonth,
                status: 'DRAFT',
                base_rent: (Number(prop.rent_after_deduction) > 0) ? Number(prop.rent_after_deduction) : (Number(prop.monthly_base_rent) || 0),
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hr-rental-records'] });
            toast.success('Rent record generated for current month');
        },
        onError: (error: any) => toast.error(error.message)
    });

    const filteredProperties = properties?.filter((prop: any) => {
        // Search Filter
        const matchesSearch = !searchQuery ||
            prop.title?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
            prop.location?.toLowerCase()?.includes(searchQuery.toLowerCase());

        const propertyCreatorId = prop.created_by;
        const propertyCreatorRole = prop.creator?.role?.toLowerCase();

        let matchesCreator = true;
        if (creatorFilter === 'me') {
            // Show properties created by any HR-role user
            matchesCreator = propertyCreatorRole === 'hr';
        } else if (creatorFilter === 'rsh') {
            matchesCreator = propertyCreatorRole === 'rsh';
        }

        return matchesSearch && matchesCreator;
    }) || [];

    const totalJvPolyhouseArea = filteredProperties?.reduce((sum: number, prop: any) => {
        if (prop.rental_categories?.name?.toLowerCase().includes('jv polyhouse') && prop.area) {
            const areaStr = prop.area.toString().trim().toLowerCase();
            const match = areaStr.match(/[\d.]+/);
            if (match) {
                const numericValue = parseFloat(match[0]);
                // Convert sq ft to acres (1 acre = 43,560 sq ft)
                if (areaStr.includes('sq ft') || areaStr.includes('sqft') || areaStr.includes('sq.ft')) {
                    return sum + (numericValue / 43560);
                }
                // Already in acres (plain number or "X Acre")
                return sum + numericValue;
            }
        }
        return sum;
    }, 0) || 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 pb-20"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <Building2 className="w-7 h-7 text-purple-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">HR Rental Dashboard</h1>
                        <p className="text-muted-foreground">Manage Staff Accommodation & Office Rents</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="gap-2 border-purple-500/30 text-purple-600 hover:bg-purple-500/5"
                        onClick={() => navigate('/rentals/bulk-raise')}
                    >
                        <ListChecks className="w-4 h-4" /> Bulk Raise
                    </Button>
                    <Button
                        className="bg-purple-600 hover:bg-purple-700 gap-2 shadow-lg shadow-purple-500/20"
                        onClick={() => navigate('/rentals/new')}
                    >
                        <Plus className="w-4 h-4" /> Add New Property
                    </Button>
                </div>
            </div>

            <div className="space-y-6">
                {/* Stats Cards */}
                <div className={`grid grid-cols-1 ${totalJvPolyhouseArea > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
                    <DashboardCard
                        title="Properties"
                        value={`${filteredProperties?.length || 0} Properties`}
                        icon={<Building2 className="w-4 h-4 text-purple-500" />}
                        className="bg-gradient-to-br from-card to-purple-500/5 hover:from-card hover:to-purple-500/10 transition-colors"
                    />
                    <DashboardCard
                        title="Pending Raise"
                        value={filteredRecords?.filter((r: any) => ['DRAFT', 'ELECTRICITY_UPDATED'].includes(r.status)).length || 0}
                        icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
                        className="bg-gradient-to-br from-card to-amber-500/5 hover:from-card hover:to-amber-500/10 transition-colors"
                    />
                    {totalJvPolyhouseArea > 0 && (
                        <DashboardCard
                            title="Total Area (Acres)"
                            value={`${totalJvPolyhouseArea.toFixed(2)} Acres`}
                            icon={<MapPin className="w-4 h-4 text-green-500" />}
                            className="bg-gradient-to-br from-card to-green-500/5 hover:from-card hover:to-green-500/10 transition-colors"
                        />
                    )}
                </div>



                {/* Search & Filters */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border/50 shadow-sm">
                    <div className="relative w-full md:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search property or location..."
                            className="pl-10 h-10 bg-background/50"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Source:</Label>
                            <Select value={creatorFilter} onValueChange={(v: any) => setCreatorFilter(v)}>
                                <SelectTrigger className="w-full md:w-[150px] h-10 bg-background/50">
                                    <SelectValue placeholder="All Pool" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Pool</SelectItem>
                                    <SelectItem value="me">My Creation</SelectItem>
                                    <SelectItem value="rsh">RSH Created</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Status:</Label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full md:w-[150px] h-10 bg-background/50">
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="DRAFT">Drafted</SelectItem>
                                    <SelectItem value="RAISED_FOR_APPROVAL">Approval Pending</SelectItem>
                                    <SelectItem value="PAID">Paid</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* All Properties Quick Action List */}
                <div className="mb-4">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-indigo-600">
                        <Building2 className="w-5 h-5 text-indigo-600" /> Properties ({filteredProperties.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        {filteredProperties.map((prop: any) => {
                            // Check if property needs a record for this month
                            const hasRecordThisMonth = monthlyRecords?.some((record: any) => {
                                if (record.property_id !== prop.id) return false;
                                return format(new Date(record.month_year), 'yyyy-MM') === format(new Date(), 'yyyy-MM');
                            });

                            return (
                                <Card key={prop.id} className="group flex flex-col justify-between p-4 rounded-xl border-border/50 bg-card hover:shadow-lg transition-all duration-300 relative overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/30">
                                    <div className={`absolute top-0 left-0 w-1 h-full shadow-[2px_0_8px_rgba(0,0,0,0.1)] transition-colors duration-300 ${hasRecordThisMonth ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                                    <div className="flex flex-col h-full gap-3 pl-1">
                                        <div className="space-y-1">
                                            <h4 className="font-bold text-sm text-card-foreground line-clamp-2 transition-colors leading-tight" title={prop.title}>{prop.title}</h4>
                                            <div className="flex items-start gap-1 text-[11px] text-muted-foreground">
                                                <MapPin className="w-3 h-3 mt-0.5 shrink-0 opacity-60" />
                                                <span className="line-clamp-2 leading-snug break-all" title={prop.location}>{prop.location}</span>
                                            </div>
                                        </div>

                                        <div className="pt-3 border-t border-border/30 mt-auto">
                                            {hasRecordThisMonth ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full h-8 text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700 cursor-default"
                                                    disabled
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Rent Generated
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full h-8 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 hover:text-indigo-800 shadow-sm transition-all cursor-pointer"
                                                    onClick={() => generateRecordMutation.mutate(prop)}
                                                    disabled={generateRecordMutation.isPending}
                                                >
                                                    <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Raise Manual
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                {/* Monthly Payout Cycle */}
                <div>
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-purple-600" /> Monthly Payout Cycle
                    </h2>

                    {recordsLoading ? (
                        <div className="flex justify-center p-12">
                            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                        </div>
                    ) : !filteredRecords?.length ? (
                        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-card/50 text-center">
                            <Building2 className="w-12 h-12 text-muted-foreground/50 mb-3" />
                            <h3 className="font-semibold text-lg text-foreground">No matching rent cycles</h3>
                            <p className="text-muted-foreground mb-4">Try adjusting your filters or add a new property.</p>
                            <Button onClick={() => navigate('/rentals/new')}>
                                <PlusCircle className="mr-2 w-4 h-4" /> Add New Property
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-6">
                            {filteredRecords?.map((record: any) => {
                                // Repayment Logic
                                let repaymentText = null;
                                if (record.rental_properties.quotation_amount > 0 && record.rental_properties.deduction_percentage > 0) {
                                    const monthlyDeduction = (record.rental_properties.monthly_base_rent * record.rental_properties.deduction_percentage) / 100;
                                    const monthsToRepay = Math.ceil(record.rental_properties.quotation_amount / monthlyDeduction);
                                    const startDate = new Date(record.rental_properties.rent_starts_from || record.created_at);
                                    const endDate = new Date(startDate);
                                    endDate.setMonth(endDate.getMonth() + monthsToRepay);
                                    repaymentText = `Repayment Active | Ends ${format(endDate, 'dd/MM/yyyy')}`;
                                }

                                const totalAdditions = (Number(record.electricity_bill_amount) || 0) + (Number(record.addition_total) || 0);
                                const totalDeductions = (Number(record.deduction_total) || 0);
                                const isDraft = ['DRAFT', 'ELECTRICITY_UPDATED'].includes(record.status);
                                const isRejected = record.status === 'REJECTED';

                                return (
                                    <div key={record.id} className="group relative bg-card hover:bg-accent/5 transition-all duration-300 border rounded-xl overflow-hidden shadow-sm hover:shadow-md">

                                        {/* Status Glow Strip */}
                                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300 ${record.status === 'PAYMENT_EXECUTED' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
                                            record.status === 'CEO_APPROVAL' ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' :
                                                record.status === 'HR_APPROVAL' ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]' :
                                                    'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                                            }`} />

                                        <div className="p-5 flex flex-col xl:flex-row gap-6 items-center">

                                            {/* 1. Identity & Meta */}
                                            <div className="flex-1 w-full xl:w-auto xl:max-w-[320px] flex flex-col gap-3">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <h3 className="font-extrabold text-2xl tracking-tight text-foreground hover:text-purple-600 cursor-pointer transition-colors" onClick={() => navigate(`/rentals/${record.property_id}/edit`)}>
                                                            {record.rental_properties.title}
                                                        </h3>
                                                        {repaymentText && (
                                                            <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs px-2.5 py-1 rounded-md font-bold border border-amber-200 dark:border-amber-800/50 whitespace-nowrap shadow-sm">
                                                                {repaymentText}
                                                            </span>
                                                        )}
                                                        <div className="scale-90 origin-left">
                                                            <RentalStatusBadge status={record.status} />
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-base font-medium text-muted-foreground">
                                                        <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-purple-600/70" /> {record.rental_properties.location}</span>
                                                        <span className="flex items-center gap-1.5 text-purple-900 bg-purple-200 px-2.5 py-1 rounded-md font-bold border border-purple-300/50 shadow-sm"><Calendar className="w-4 h-4" /> {format(new Date(record.month_year), 'MMM yyyy')}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <RentalRemarksDialog propertyId={record.property_id} propertyTitle={record.rental_properties.title} trigger={
                                                        <Button variant="outline" size="sm" className="h-8 text-xs border-dashed gap-2 text-muted-foreground hover:text-foreground hover:border-purple-500/50 transition-colors">
                                                            <MessageSquare className="w-3.5 h-3.5" /> Remarks
                                                        </Button>
                                                    } />
                                                    <Button variant="outline" size="sm" className="h-8 text-xs border-dashed gap-2 text-muted-foreground hover:text-foreground hover:border-purple-500/50 transition-colors" onClick={() => { setExpensePropertyId(record.property_id); setExpensePropertyName(record.rental_properties.title); setIsExpenseDialogOpen(true); }}>
                                                        <Zap className="w-3.5 h-3.5" /> Expenses
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className={`relative h-8 text-xs border-dashed gap-2 text-muted-foreground hover:text-foreground hover:border-purple-500/50 transition-colors ${expandedRemarks[record.id] ? 'bg-purple-500/5 border-purple-500/50 text-purple-600' : ''}`}
                                                        onClick={() => toggleRemarks(record.id)}
                                                    >
                                                        {expandedRemarks[record.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                        {expandedRemarks[record.id] ? 'Hide' : 'View'}
                                                        {(record.rental_properties.rental_property_remarks?.[0]?.count || 0) > 0 && !expandedRemarks[record.id] && (
                                                            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white animate-pulse">
                                                                {record.rental_properties.rental_property_remarks?.[0]?.count}
                                                            </span>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* 2. Metrics Strip */}
                                            <div className="flex-1 w-full flex flex-wrap xl:justify-center items-center gap-x-12 gap-y-6 border-t xl:border-t-0 xl:border-l border-border/40 pt-4 xl:pt-0 xl:px-8">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Base Rent</span>
                                                    <span className="text-xl font-bold tracking-tight text-foreground">₹{record.base_rent?.toLocaleString()}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Additions</span>
                                                    <span className={`text-xl font-bold tracking-tight flex items-center gap-1 ${totalAdditions > 0 ? 'text-emerald-500' : 'text-muted-foreground/50'}`}>
                                                        {totalAdditions > 0 ? `+₹${totalAdditions.toLocaleString()}` : '—'}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Deductions</span>
                                                    <span className={`text-xl font-bold tracking-tight flex items-center gap-1 ${totalDeductions > 0 ? 'text-rose-500' : 'text-muted-foreground/50'}`}>
                                                        {totalDeductions > 0 ? `-₹${totalDeductions.toLocaleString()}` : '—'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* 3. Net Payable & Actions */}
                                            <div className="min-w-[300px] w-full xl:w-auto flex items-stretch justify-between gap-6 border-t xl:border-t-0 xl:border-l border-border/40 pt-4 xl:pt-0 xl:pl-8">

                                                <div className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/10 rounded-xl p-4 px-6 flex flex-col justify-center min-w-[150px]">
                                                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Net Payable</span>
                                                    <span className="text-3xl font-extrabold tracking-tight text-foreground">₹{record.net_payable_amount?.toLocaleString() || '0'}</span>
                                                </div>

                                                <div className="flex flex-col gap-2 min-w-[150px] items-stretch justify-center">
                                                    {isDraft ? (
                                                        <>
                                                            <Button
                                                                className="w-full justify-between bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20 group/btn transition-all"
                                                                onClick={() => raiseMutation.mutate(record.id)}
                                                            >
                                                                Raise to CEO <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover/btn:translate-x-1" />
                                                            </Button>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <Button variant="secondary" size="sm" className="h-8 text-[11px] px-0 bg-secondary/50 hover:bg-secondary text-foreground font-medium" onClick={() => { setSelectedRecordId(record.id); setIsAdditionDialogOpen(true); }}>
                                                                    <PlusCircle className="w-3 h-3 mr-1.5" /> Add
                                                                </Button>
                                                                <Button variant="secondary" size="sm" className="h-8 text-[11px] px-0 bg-secondary/50 hover:bg-secondary text-foreground font-medium" onClick={() => { setSelectedRecordId(record.id); setIsDeductionDialogOpen(true); }}>
                                                                    <ListChecks className="w-3 h-3 mr-1.5" /> Ded.
                                                                </Button>
                                                            </div>
                                                        </>
                                                    ) : isRejected ? (
                                                        <div className="flex flex-col gap-2 w-full">
                                                            <div className="flex items-start gap-1.5 p-2 rounded-md bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
                                                                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                                                <span className="line-clamp-2 font-medium">{record.rejection_reason || 'Rejected by CEO'}</span>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <Button variant="secondary" size="sm" className="h-8 text-[11px] px-0 bg-secondary/50 hover:bg-secondary" onClick={() => { setSelectedRecordId(record.id); setIsAdditionDialogOpen(true); }}>
                                                                    <PlusCircle className="w-3 h-3 mr-1.5" /> Add
                                                                </Button>
                                                                <Button variant="secondary" size="sm" className="h-8 text-[11px] px-0 bg-secondary/50 hover:bg-secondary" onClick={() => { setSelectedRecordId(record.id); setIsDeductionDialogOpen(true); }}>
                                                                    <ListChecks className="w-3 h-3 mr-1.5" /> Ded.
                                                                </Button>
                                                            </div>
                                                            <Button
                                                                className="w-full bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 gap-2"
                                                                onClick={() => resubmitMutation.mutate(record.id)}
                                                                disabled={resubmitMutation.isPending}
                                                            >
                                                                <RotateCcw className="w-3.5 h-3.5" /> Resubmit
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="h-full flex items-center justify-center">
                                                            {record.status === 'PAYMENT_EXECUTED' ? (
                                                                <div className="flex flex-col gap-2 w-full">
                                                                    <span className="w-full h-10 flex items-center justify-center gap-2 text-emerald-500 font-bold bg-emerald-500/10 rounded-md border border-emerald-500/20 shadow-sm">
                                                                        <CheckCircle2 className="w-4 h-4" /> Paid
                                                                    </span>
                                                                    {(record.payment_proof_url || record.payment_proof_link) && (
                                                                        <a
                                                                            href={record.payment_proof_url || record.payment_proof_link}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="w-full h-8 flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 rounded-md border border-blue-200 dark:border-blue-500/20 transition-colors"
                                                                        >
                                                                            <Download className="w-3 h-3" /> Download Proof
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="w-full flex flex-col gap-2">
                                                                    <div className={`w-full h-10 flex items-center justify-center text-sm font-bold rounded-md border shadow-sm ${record.status === 'APPROVED_BY_CEO'
                                                                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                                        : record.status === 'RAISED_FOR_APPROVAL'
                                                                            ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                                                                            : 'bg-secondary/50 text-muted-foreground border-border/50'
                                                                        }`}>
                                                                        {record.status === 'APPROVED_BY_CEO' ? (
                                                                            <span className="flex items-center gap-2">
                                                                                <CheckCircle2 className="w-4 h-4" /> Approved (Payout Pending)
                                                                            </span>
                                                                        ) : record.status === 'RAISED_FOR_APPROVAL' ? (
                                                                            <span className="flex items-center gap-2">
                                                                                <Loader2 className="w-4 h-4 animate-spin" /> Awaiting CEO Review
                                                                            </span>
                                                                        ) : (
                                                                            'Processing...'
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[10px] text-center text-muted-foreground italic px-2">
                                                                        {record.status === 'APPROVED_BY_CEO'
                                                                            ? 'Action item moved to Accounts for execution'
                                                                            : 'Waiting for standard approval workflow'}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Expanded Remarks Section */}
                                            {expandedRemarks[record.id] && (
                                                <div className="w-full mt-6 pt-6 border-t border-border/40 animate-in fade-in slide-in-from-top-2">
                                                    <RentalRemarksPreview
                                                        propertyId={record.property_id}
                                                        propertyTitle={record.rental_properties.title}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {selectedRecordId && (
                <RentalDeductionDialog
                    open={isDeductionDialogOpen}
                    onOpenChange={(open) => {
                        setIsDeductionDialogOpen(open);
                        if (!open) setSelectedRecordId(null);
                    }}
                    recordId={selectedRecordId}
                />
            )}

            {expensePropertyId && (
                <RentalExpensesDialog
                    open={isExpenseDialogOpen}
                    onOpenChange={(open) => {
                        setIsExpenseDialogOpen(open);
                        if (!open) setExpensePropertyId(null);
                    }}
                    propertyId={expensePropertyId}
                    propertyName={expensePropertyName}
                />
            )}

            {selectedRecordId && (
                <RentalAdditionDialog
                    open={isAdditionDialogOpen}
                    onOpenChange={(open) => {
                        setIsAdditionDialogOpen(open);
                        if (!open) setSelectedRecordId(null);
                    }}
                    recordId={selectedRecordId}
                />
            )}
        </motion.div>
    );
}
