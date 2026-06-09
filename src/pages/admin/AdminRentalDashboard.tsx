import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    Building2,
    MapPin,
    Calendar,
    Banknote,
    Search,
    Loader2,
    TrendingUp,
    ShieldCheck,
    User,
    Filter,
    ArrowUpRight,
    Lock,
    Unlock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { RentalRemarksDialog } from '@/components/rental/RentalRemarksDialog';
import { MessageSquare } from 'lucide-react';

export default function AdminRentalDashboard() {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const queryClient = useQueryClient();

    // Fetch all properties
    const { data: properties, isLoading: propsLoading } = useQuery({
        queryKey: ['admin-all-rental-properties'],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from('rental_properties')
                .select('*, rental_categories(name, owner_role)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    // Fetch all monthly records
    const { data: monthlyRecords, isLoading: recordsLoading } = useQuery({
        queryKey: ['admin-all-rental-records'],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from('rental_monthly_records')
                .select('*, rental_properties(title, location, monthly_base_rent, rental_categories(name, owner_role))')
                .order('month_year', { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    const toggleEditAccessMutation = useMutation({
        mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
            const { error } = await (supabase as any)
                .from('rental_properties')
                .update({ edit_access_enabled: enabled })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-all-rental-properties'] });
            toast.success('Edit access updated');
        },
        onError: (err) => toast.error('Failed to update access: ' + err.message)
    });

    const filteredRecords = monthlyRecords?.filter(record => {
        const matchesSearch = !searchQuery ||
            record.rental_properties?.title?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
            record.rental_properties?.location?.toLowerCase()?.includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === 'all' || record.status?.toUpperCase() === statusFilter.toUpperCase();
        return matchesSearch && matchesStatus;
    });

    const filteredProperties = properties?.filter(property => {
        const matchesSearch = !searchQuery ||
            property.title?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
            property.location?.toLowerCase()?.includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === 'all' || property.status?.toUpperCase() === statusFilter.toUpperCase();
        return matchesSearch && matchesStatus;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'DRAFT': return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">Draft</Badge>;
            case 'ELECTRICITY_UPDATED': return <Badge variant="outline" className="bg-blue-100 text-blue-600 border-blue-300">Updated</Badge>;
            case 'RAISED_FOR_APPROVAL': return <Badge variant="outline" className="bg-amber-100 text-amber-600 border-amber-400">Raised</Badge>;
            case 'APPROVED_BY_CEO': return <Badge variant="outline" className="bg-emerald-100 text-emerald-600 border-emerald-400">Approved</Badge>;
            case 'PAYMENT_EXECUTED': return <Badge variant="secondary" className="bg-status-live/10 text-status-live">Paid</Badge>;
            case 'REJECTED': return <Badge variant="destructive">Rejected</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const totalActiveRent = properties?.filter(p => p.status === 'Active')
        .reduce((sum, p) => sum + (p.monthly_base_rent || 0), 0) || 0;

    const totalPendingAmount = monthlyRecords?.filter(r =>
        ['DRAFT', 'ELECTRICITY_UPDATED', 'RAISED_FOR_APPROVAL', 'APPROVED_BY_CEO'].includes(r.status)
    ).reduce((sum, r) => sum + (r.net_payable_amount || 0), 0) || 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-authority-admin/20 flex items-center justify-center">
                    <LayoutDashboard className="w-7 h-7 text-authority-admin" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-authority-admin">Rental Administration</h1>
                    <p className="text-muted-foreground italic">Global oversight of all leased properties and rent cycles</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-card border-authority-admin/20 shadow-sm border-t-4 border-t-authority-admin">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-bold uppercase tracking-widest">Total Properties</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{properties?.length || 0} Properties</div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-emerald-200/20 shadow-sm border-t-4 border-t-emerald-500">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-bold uppercase tracking-widest text-emerald-500">Total Monthly Liability</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">₹{totalActiveRent.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-amber-200/20 shadow-sm border-t-4 border-t-amber-500">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-bold uppercase tracking-widest text-amber-500">Pending Approvals</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-500">
                            {monthlyRecords?.filter(r => r.status === 'RAISED_FOR_APPROVAL').length || 0} Records
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-rose-200/20 shadow-sm border-t-4 border-t-rose-500">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-bold uppercase tracking-widest text-rose-500">Total Pending Payment</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-rose-500">₹{totalPendingAmount.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2 flex-grow max-w-md">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by title or location..."
                            className="pl-10 h-11 bg-card"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2">

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px] h-11 bg-card">
                            <ShieldCheck className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Filter by Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="DRAFT">Drafted</SelectItem>
                            <SelectItem value="ELECTRICITY_UPDATED">Electricity Updated</SelectItem>
                            <SelectItem value="RAISED_FOR_APPROVAL">Approval Pending</SelectItem>
                            <SelectItem value="APPROVED_BY_CEO">Approved</SelectItem>
                            <SelectItem value="PAYMENT_EXECUTED">Paid</SelectItem>
                            <SelectItem value="REJECTED">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Tabs defaultValue="master" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="master" className="gap-2"><Building2 className="w-4 h-4" /> Property Master & Access</TabsTrigger>
                    <TabsTrigger value="audit" className="gap-2"><Banknote className="w-4 h-4" /> Monthly Audit Records</TabsTrigger>
                </TabsList>

                <TabsContent value="master" className="space-y-4">
                    <Card className="border-none shadow-none bg-transparent">
                        <div className="bg-card rounded-xl border overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-muted/50 border-b">
                                    <tr>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Property Title</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Location</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Moratorium</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Rent Hike</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Edit Access</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right w-32">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {propsLoading ? (
                                        <tr><td colSpan={7} className="p-10 text-center">Loading...</td></tr>
                                    ) : filteredProperties?.length === 0 ? (
                                        <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No properties found.</td></tr>
                                    ) : (
                                        filteredProperties?.map((prop: any) => (
                                            <tr key={prop.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                                <td className="p-4 font-bold">{prop.title}</td>
                                                <td className="p-4 text-sm"><div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {prop.location}</div></td>
                                                <td className="p-4">
                                                    <Badge variant="secondary">{prop.rental_categories?.name}</Badge>
                                                </td>
                                                <td className="p-4">
                                                    {prop.moratorium_period ? (
                                                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                                            {prop.moratorium_period} Months
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {prop.rent_hike_enabled ? (
                                                        <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50">
                                                            {prop.rent_hike_percentage}% / {prop.rent_hike_interval_years}y
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">Disabled</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <Switch
                                                            checked={prop.edit_access_enabled !== false} // Default true
                                                            onCheckedChange={(checked) => toggleEditAccessMutation.mutate({ id: prop.id, enabled: checked })}
                                                        />
                                                        <span className={`text-xs font-bold ${prop.edit_access_enabled !== false ? 'text-emerald-600' : 'text-destructive'}`}>
                                                            {prop.edit_access_enabled !== false ? <Unlock className="w-3 h-3 inline mr-1" /> : <Lock className="w-3 h-3 inline mr-1" />}
                                                            {prop.edit_access_enabled !== false ? 'Editable' : 'Locked'}
                                                        </span>
                                                        <div className="ml-2 pl-2 border-l">
                                                            <RentalRemarksDialog propertyId={prop.id} propertyTitle={prop.title} trigger={
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" title="Remarks">
                                                                    <MessageSquare className="w-4 h-4" />
                                                                </Button>
                                                            } />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    {getStatusBadge(prop.status || 'DRAFT')}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="audit" className="space-y-4">
                    <Card className="border-none shadow-none bg-transparent">
                        <div className="bg-card rounded-xl border overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-muted/50 border-b">
                                    <tr>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Property</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Month</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Owner</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Net Payable</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recordsLoading ? (
                                        <tr><td colSpan={6} className="p-10 text-center">Loading...</td></tr>
                                    ) : filteredRecords?.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-20 text-center text-muted-foreground italic">
                                                No rental records found matching your filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRecords?.map((record) => (
                                            <tr key={record.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                                <td className="p-4">
                                                    <div>
                                                        <p className="font-bold text-foreground">{record.rental_properties?.title || 'Unknown Property'}</p>
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <MapPin className="w-3 h-3" /> {record.rental_properties?.location || 'No Location'}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <Badge variant="outline" className="font-mono text-[11px] font-bold">
                                                        {format(new Date(record.month_year), 'MMM yyyy')}
                                                    </Badge>
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-sm font-medium">{record.rental_properties?.rental_categories?.name || 'Uncategorized'}</span>
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-sm font-medium">{record.rental_properties?.owner_name || 'N/A'}</span>
                                                </td>
                                                <td className="p-4">
                                                    <p className="text-sm font-bold font-mono">₹{record.net_payable_amount?.toLocaleString() || '0'}</p>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {getStatusBadge(record.status)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </motion.div>
    );
}
