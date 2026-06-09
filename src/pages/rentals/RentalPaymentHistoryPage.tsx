import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    History, Calendar, Building2, ArrowLeft, Download, Search,
    ChevronLeft, ChevronRight, Filter, X, CreditCard, CheckCircle2,
    AlertCircle, FileText, Grid3X3, List, Circle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfYear, endOfYear, eachMonthOfInterval, getYear, setYear } from 'date-fns';
import { cn } from '@/lib/utils';

interface PaymentRecord {
    id: string;
    property_id: string;
    month_year: string;
    base_rent: number;
    electricity_bill_amount: number;
    addition_total: number;
    deduction_total: number;
    net_payable_amount: number;
    status: string;
    payment_date: string | null;
    payment_mode: string | null;
    payment_proof_url: string | null;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;
    rental_properties: {
        id: string;
        title: string;
        location: string;
        owner_name: string;
        holder_name: string;
        bank_name: string;
        account_number: string;
        ifsc_code: string;
        rental_categories?: {
            name: string;
        };
    };
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
    'DRAFT': { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', label: 'Draft' },
    'ELECTRICITY_UPDATED': { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-300', label: 'Updated' },
    'RAISED_FOR_APPROVAL': { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-300', label: 'Pending' },
    'APPROVED_BY_CEO': { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-300', label: 'Approved' },
    'PAYMENT_EXECUTED': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-400', label: 'Paid' },
    'REJECTED': { bg: 'bg-rose-100', text: 'text-rose-600', border: 'border-rose-300', label: 'Rejected' },
};

export default function RentalPaymentHistoryPage() {
    const navigate = useNavigate();
    const [selectedYear, setSelectedYear] = useState(getYear(new Date()));
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
    const [selectedRecord, setSelectedRecord] = useState<PaymentRecord | null>(null);

    const currentYear = getYear(new Date());
    const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

    const yearStart = startOfYear(setYear(new Date(), selectedYear));
    const yearEnd = endOfYear(setYear(new Date(), selectedYear));
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

    const { data: records, isLoading } = useQuery({
        queryKey: ['rental-payment-history', selectedYear],
        queryFn: async () => {
            const start = yearStart.toISOString();
            const end = yearEnd.toISOString();

            const { data, error } = await (supabase as any)
                .from('rental_monthly_records')
                .select(`
                    *,
                    rental_properties!inner(
                        id,
                        title,
                        location,
                        owner_name,
                        holder_name,
                        bank_name,
                        account_number,
                        ifsc_code,
                        rental_categories(name)
                    )
                `)
                .gte('month_year', start)
                .lte('month_year', end)
                .order('month_year', { ascending: true });

            if (error) throw error;
            return data as PaymentRecord[];
        },
    });

    const { data: properties } = useQuery({
        queryKey: ['rental-properties-list'],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from('rental_properties')
                .select(`
                    id,
                    title,
                    location,
                    owner_name,
                    holder_name,
                    monthly_base_rent,
                    rental_categories(name)
                `)
                .eq('status', 'Active')
                .order('title', { ascending: true });

            if (error) throw error;
            return data;
        },
    });

    const recordsByProperty = useMemo(() => {
        const grouped: Record<string, Record<string, PaymentRecord>> = {};
        
        (records || []).forEach((record: PaymentRecord) => {
            const propertyId = record.property_id;
            const monthKey = format(new Date(record.month_year), 'yyyy-MM');
            
            if (!grouped[propertyId]) {
                grouped[propertyId] = {};
            }
            grouped[propertyId][monthKey] = record;
        });
        
        return grouped;
    }, [records]);

    const filteredProperties = useMemo(() => {
        if (!properties) return [];
        if (!searchQuery) return properties;
        
        return properties.filter((p: any) => 
            p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.owner_name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [properties, searchQuery]);

    const filteredRecords = useMemo(() => {
        if (!records) return [];
        return (records as PaymentRecord[]).filter((record: PaymentRecord) => {
            const matchesSearch = !searchQuery ||
                record.rental_properties?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                record.rental_properties?.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                record.rental_properties?.owner_name?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus = statusFilter === 'all' || record.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [records, searchQuery, statusFilter]);

    const stats = {
        total: filteredRecords.length,
        paid: filteredRecords.filter((r: PaymentRecord) => r.status === 'PAYMENT_EXECUTED').length,
        pending: filteredRecords.filter((r: PaymentRecord) => ['DRAFT', 'ELECTRICITY_UPDATED', 'RAISED_FOR_APPROVAL', 'APPROVED_BY_CEO'].includes(r.status)).length,
        rejected: filteredRecords.filter((r: PaymentRecord) => r.status === 'REJECTED').length,
        totalAmount: filteredRecords.reduce((sum, r: PaymentRecord) => sum + (r.net_payable_amount || 0), 0),
        paidAmount: filteredRecords.filter((r: PaymentRecord) => r.status === 'PAYMENT_EXECUTED').reduce((sum, r: PaymentRecord) => sum + (r.net_payable_amount || 0), 0),
    };

    const downloadCSV = () => {
        if (!filteredRecords.length) return;

        const headers = ["Property", "Category", "Location", "Month", "Base Rent", "Additions", "Deductions", "Net Payable", "Status", "Payment Date", "Payment Mode"];

        const csvContent = [
            headers.join(","),
            ...filteredRecords.map((r: PaymentRecord) => [
                `"${r.rental_properties?.title || ''}"`,
                `"${r.rental_properties?.rental_categories?.name || ''}"`,
                `"${r.rental_properties?.location || ''}"`,
                `"${format(new Date(r.month_year), 'MMM yyyy')}"`,
                r.base_rent || 0,
                (r.electricity_bill_amount || 0) + (r.addition_total || 0),
                r.deduction_total || 0,
                r.net_payable_amount || 0,
                `"${r.status}"`,
                r.payment_date ? format(new Date(r.payment_date), 'yyyy-MM-dd') : '-',
                `"${r.payment_mode || '-'}"`,
            ].join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `rental_payment_history_${selectedYear}.csv`);
        link.click();
    };

    const navigateYear = (direction: 'prev' | 'next') => {
        setSelectedYear(prev => direction === 'prev' ? prev - 1 : prev + 1);
    };

    const getRecordForPropertyAndMonth = (propertyId: string, monthKey: string) => {
        return recordsByProperty[propertyId]?.[monthKey] || null;
    };

    const getStatusColor = (status: string | null) => {
        if (!status) return { bg: 'bg-gray-50', text: 'text-gray-400', border: 'border-gray-200', label: '-' };
        return STATUS_COLORS[status] || STATUS_COLORS['DRAFT'];
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 pb-20"
        >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                            <History className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Rental Payment History</h1>
                            <p className="text-sm text-muted-foreground">Yearly calendar view of all rental payments</p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
                    >
                        {viewMode === 'calendar' ? <List className="w-4 h-4 mr-2" /> : <Grid3X3 className="w-4 h-4 mr-2" />}
                        {viewMode === 'calendar' ? 'List View' : 'Calendar View'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadCSV} disabled={!filteredRecords.length}>
                        <Download className="w-4 h-4 mr-2" /> Export CSV
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className="bg-gradient-to-br from-card to-blue-500/5 border shadow-sm">
                    <CardContent className="p-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Records</p>
                        <p className="text-xl font-bold mt-1">{stats.total}</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-card to-emerald-500/5 border shadow-sm">
                    <CardContent className="p-3">
                        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Paid</p>
                        <p className="text-xl font-bold text-emerald-600 mt-1">{stats.paid}</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-card to-amber-500/5 border shadow-sm">
                    <CardContent className="p-3">
                        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Pending</p>
                        <p className="text-xl font-bold text-amber-600 mt-1">{stats.pending}</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-card to-rose-500/5 border shadow-sm">
                    <CardContent className="p-3">
                        <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide">Rejected</p>
                        <p className="text-xl font-bold text-rose-600 mt-1">{stats.rejected}</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-card to-purple-500/5 border shadow-sm col-span-2 md:col-span-1">
                    <CardContent className="p-3">
                        <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Total Amount</p>
                        <p className="text-lg font-bold mt-1">₹{stats.totalAmount.toLocaleString()}</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border shadow-sm">
                <CardContent className="p-3">
                    <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateYear('prev')}>
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Select
                                value={String(selectedYear)}
                                onValueChange={(val) => setSelectedYear(Number(val))}
                            >
                                <SelectTrigger className="w-[120px] h-9">
                                    <Calendar className="w-4 h-4 mr-2" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {yearOptions.map((year) => (
                                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateYear('next')}>
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-[280px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search property, location, owner..."
                                    className="pl-10 h-9"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            {viewMode === 'list' && (
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-[140px] h-9">
                                        <Filter className="w-4 h-4 mr-2" />
                                        <SelectValue placeholder="All Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="DRAFT">Draft</SelectItem>
                                        <SelectItem value="ELECTRICITY_UPDATED">Electricity Updated</SelectItem>
                                        <SelectItem value="RAISED_FOR_APPROVAL">Raised for Approval</SelectItem>
                                        <SelectItem value="APPROVED_BY_CEO">Approved by CEO</SelectItem>
                                        <SelectItem value="PAYMENT_EXECUTED">Paid</SelectItem>
                                        <SelectItem value="REJECTED">Rejected</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                            {searchQuery && (
                                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSearchQuery('')}>
                                    <X className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-3 text-xs bg-muted/30 p-2 rounded-lg">
                <span className="font-semibold text-muted-foreground">Status:</span>
                {Object.entries(STATUS_COLORS).map(([status, colors]) => (
                    <div key={status} className="flex items-center gap-1">
                        <div className={cn("w-2.5 h-2.5 rounded-sm", colors.bg, colors.border)} />
                        <span className="text-muted-foreground">{colors.label}</span>
                    </div>
                ))}
                <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm bg-gray-100 border border-gray-300" />
                    <span className="text-muted-foreground">No Record</span>
                </div>
            </div>

            {viewMode === 'calendar' ? (
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="p-12 text-center text-muted-foreground">Loading...</div>
                    ) : filteredProperties.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/30">
                            <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                            <p className="text-muted-foreground">No properties found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto border rounded-lg shadow-sm">
                            <div className="min-w-[1000px]">
                                <div className="grid grid-cols-[280px_repeat(12,1fr)] gap-px bg-border">
                                    <div className="bg-muted/50 p-3 font-semibold text-sm text-foreground sticky left-0 z-20 border-r">
                                        Property
                                    </div>
                                    {months.map((month, index) => (
                                        <div key={index} className="bg-muted/50 p-2 text-center font-semibold text-xs text-muted-foreground">
                                            {format(month, 'MMM')}
                                        </div>
                                    ))}
                                </div>

                                <div className="grid gap-px bg-border">
                                    {filteredProperties.map((property: any) => (
                                        <div 
                                            key={property.id} 
                                            className="grid grid-cols-[280px_repeat(12,1fr)] gap-px hover:bg-muted/20 transition-colors"
                                        >
                                            <div className="bg-background p-3 flex flex-col justify-center min-w-0 sticky left-0 z-10 border-r border-border">
                                                <p className="font-semibold text-sm truncate text-foreground" title={property.title}>{property.title}</p>
                                                <p className="text-xs text-muted-foreground truncate" title={property.location}>{property.location}</p>
                                                <p className="text-xs text-muted-foreground/70 truncate">{property.owner_name || property.holder_name || 'No owner'}</p>
                                            </div>

                                            {months.map((month, index) => {
                                                const monthKey = format(month, 'yyyy-MM');
                                                const record = getRecordForPropertyAndMonth(property.id, monthKey);
                                                const colors = getStatusColor(record?.status || null);

                                                return (
                                                    <div
                                                        key={index}
                                                        onClick={() => record && setSelectedRecord(record)}
                                                        className={cn(
                                                            "bg-background p-2 min-h-[56px] cursor-pointer transition-all hover:brightness-95 flex flex-col items-center justify-center gap-1",
                                                            record ? colors.bg : 'bg-gray-50/50'
                                                        )}
                                                    >
                                                        {record ? (
                                                            <>
                                                                <div className={cn("w-2 h-2 rounded-full shrink-0", 
                                                                    record.status === 'PAYMENT_EXECUTED' ? 'bg-green-500' : 
                                                                    record.status === 'REJECTED' ? 'bg-rose-500' : 
                                                                    record.status === 'RAISED_FOR_APPROVAL' ? 'bg-amber-500' : 'bg-blue-500'
                                                                )} />
                                                                <span className={cn("text-[10px] font-semibold leading-tight text-center", colors.text)}>
                                                                    ₹{(record.net_payable_amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-300 text-[10px]">-</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="p-12 text-center text-muted-foreground">Loading...</div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/30">
                            <History className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                            <p className="text-muted-foreground">No rental payment records found for {selectedYear}</p>
                        </div>
                    ) : (
                        filteredRecords.map((record: PaymentRecord) => (
                            <Card key={record.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-5">
                                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                                <Building2 className="w-6 h-6 text-blue-500" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-bold text-lg">{record.rental_properties?.title}</h3>
                                                    <Badge 
                                                        variant="outline" 
                                                        className={cn(
                                                            getStatusColor(record.status).bg,
                                                            getStatusColor(record.status).text,
                                                            getStatusColor(record.status).border
                                                        )}
                                                    >
                                                        {getStatusColor(record.status).label}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {record.rental_properties?.location} • {record.rental_properties?.rental_categories?.name}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground uppercase">Month</p>
                                                <p className="font-semibold">{format(new Date(record.month_year), 'MMM yyyy')}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground uppercase">Net Payable</p>
                                                <p className="text-xl font-bold text-blue-600">₹{(record.net_payable_amount || 0).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        <div className="min-w-[120px]">
                                            {record.status === 'PAYMENT_EXECUTED' ? (
                                                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    <div>
                                                        <p className="text-xs font-semibold">Paid</p>
                                                        <p className="text-xs">{record.payment_date ? format(new Date(record.payment_date), 'dd MMM') : '-'}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className={cn(
                                                    "flex items-center gap-2 px-3 py-2 rounded-lg",
                                                    getStatusColor(record.status).bg,
                                                    getStatusColor(record.status).text
                                                )}>
                                                    <Circle className="w-4 h-4" />
                                                    <span className="text-xs font-semibold">{getStatusColor(record.status).label}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}

            <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Rental Record Details</DialogTitle>
                    </DialogHeader>
                    {selectedRecord && (
                        <div className="space-y-6">
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <Building2 className="w-7 h-7 text-blue-500" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl">{selectedRecord.rental_properties?.title}</h3>
                                    <p className="text-muted-foreground">{selectedRecord.rental_properties?.location}</p>
                                    <Badge 
                                        variant="outline" 
                                        className={cn(
                                            "mt-2",
                                            getStatusColor(selectedRecord.status).bg,
                                            getStatusColor(selectedRecord.status).text,
                                            getStatusColor(selectedRecord.status).border
                                        )}
                                    >
                                        {getStatusColor(selectedRecord.status).label}
                                    </Badge>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-muted/50 p-3 rounded-lg">
                                    <p className="text-xs text-muted-foreground">Month</p>
                                    <p className="font-semibold">{format(new Date(selectedRecord.month_year), 'MMMM yyyy')}</p>
                                </div>
                                <div className="bg-muted/50 p-3 rounded-lg">
                                    <p className="text-xs text-muted-foreground">Base Rent</p>
                                    <p className="font-semibold">₹{(selectedRecord.base_rent || 0).toLocaleString()}</p>
                                </div>
                                <div className="bg-blue-50 p-3 rounded-lg">
                                    <p className="text-xs text-blue-600">Additions</p>
                                    <p className="font-semibold text-blue-700">+₹{((selectedRecord.electricity_bill_amount || 0) + (selectedRecord.addition_total || 0)).toLocaleString()}</p>
                                </div>
                                <div className="bg-rose-50 p-3 rounded-lg">
                                    <p className="text-xs text-rose-600">Deductions</p>
                                    <p className="font-semibold text-rose-700">-₹{(selectedRecord.deduction_total || 0).toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                                <p className="text-xs text-blue-600 uppercase mb-1">Net Payable Amount</p>
                                <p className="text-3xl font-bold text-blue-700">₹{(selectedRecord.net_payable_amount || 0).toLocaleString()}</p>
                            </div>

                            {selectedRecord.status === 'PAYMENT_EXECUTED' && (
                                <div className="space-y-3">
                                    <h4 className="font-semibold">Payment Details</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">Payment Date</p>
                                            <p className="font-medium">{selectedRecord.payment_date ? format(new Date(selectedRecord.payment_date), 'dd MMM yyyy') : '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Payment Mode</p>
                                            <p className="font-medium">{selectedRecord.payment_mode || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Bank</p>
                                            <p className="font-medium">{selectedRecord.rental_properties?.bank_name || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Account Number</p>
                                            <p className="font-medium font-mono">{selectedRecord.rental_properties?.account_number || '-'}</p>
                                        </div>
                                    </div>
                                    {selectedRecord.payment_proof_url && (
                                        <Button variant="outline" className="w-full gap-2" asChild>
                                            <a href={selectedRecord.payment_proof_url} target="_blank" rel="noopener noreferrer">
                                                <FileText className="w-4 h-4" /> View Payment Proof
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            )}

                            {selectedRecord.status === 'REJECTED' && (
                                <div className="bg-rose-50 border border-rose-200 p-4 rounded-lg">
                                    <p className="text-xs text-rose-600 uppercase mb-1">Rejection Reason</p>
                                    <p className="text-rose-700">{selectedRecord.rejection_reason || 'No reason provided'}</p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
