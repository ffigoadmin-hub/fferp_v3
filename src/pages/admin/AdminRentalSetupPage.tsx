import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Plus, Building2, Edit, Trash2, Search, Loader2, Landmark, Phone, User, MapPin, Calendar, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AdminRentalSetupPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProperty, setEditingProperty] = useState<any>(null);

    // Fetch Categories
    const { data: categories } = useQuery({
        queryKey: ['rental-categories'],
        queryFn: async () => {
            const { data, error } = await (supabase as any).from('rental_categories').select('*').order('name');
            if (error) throw error;
            return data;
        },
    });

    // Fetch Properties
    const { data: properties, isLoading } = useQuery({
        queryKey: ['rental-properties'],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from('rental_properties')
                .select('*, rental_categories(name, owner_role)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    const filteredProperties = properties?.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.location?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const mutation = useMutation({
        mutationFn: async (formData: any) => {
            if (editingProperty) {
                const { error } = await (supabase as any)
                    .from('rental_properties')
                    .update(formData)
                    .eq('id', editingProperty.id);
                if (error) throw error;
            } else {
                const { error } = await (supabase as any)
                    .from('rental_properties')
                    .insert([formData]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-properties'] });
            toast.success(`Property ${editingProperty ? 'updated' : 'added'} successfully`);
            setIsDialogOpen(false);
            setEditingProperty(null);
        },
        onError: (error) => {
            toast.error(error.message);
        }
    });

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this property? This might affect existing rent records.')) return;

        const { error } = await (supabase as any).from('rental_properties').delete().eq('id', id);
        if (error) {
            toast.error(error.message);
        } else {
            toast.success('Property removed');
            queryClient.invalidateQueries({ queryKey: ['rental-properties'] });
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
                        <Settings className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Rental Master Setup</h1>
                        <p className="text-muted-foreground underline underline-offset-4 decoration-primary/30">
                            Authority control for physical rented properties
                        </p>
                    </div>
                </div>
                <Button onClick={() => { setEditingProperty(null); setIsDialogOpen(true); }} className="gap-2 shadow-lg shadow-primary/20">
                    <Plus className="w-4 h-4" /> Add New Property
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors cursor-default">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary/70">Total Properties</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{properties?.length || 0} Properties</div>
                    </CardContent>
                </Card>
                <Card className="bg-status-live/5 border-status-live/20 hover:bg-status-live/10 transition-colors cursor-default">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-status-live/70">Active Leases</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{properties?.filter(p => p.status === 'Active').length || 0}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search properties by title or location..."
                    className="pl-10 max-w-md h-11"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center p-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProperties?.map((p) => (
                        <motion.div key={p.id} layout>
                            <Card className="group hover:shadow-xl transition-all duration-300 border-border/50 border-t-4 border-t-primary">
                                <CardHeader className="pb-4">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="secondary" className="mb-2 bg-primary/10 text-primary">
                                            {p.rental_categories?.name}
                                        </Badge>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => { setEditingProperty(p); setIsDialogOpen(true); }}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">{p.title}</CardTitle>
                                    <CardDescription className="flex items-center gap-1.5 mt-1">
                                        <MapPin className="w-3.5 h-3.5" /> {p.location || 'No location set'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-0">
                                    <div className="grid grid-cols-2 gap-4 py-3 border-y border-border/50">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Monthly Rent</p>
                                            <p className="font-mono font-bold text-lg text-primary">₹{parseInt(p.monthly_base_rent).toLocaleString()}</p>
                                        </div>
                                        <div className="space-y-1 border-l pl-4">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Due Date</p>
                                            <p className="font-bold flex items-center gap-1.5 capitalize text-amber-600">
                                                <Calendar className="w-3.5 h-3.5" /> Day {p.rent_due_day}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Payee Details</p>
                                        <div className="p-3 bg-muted/50 rounded-lg space-y-1.5 border border-border/30">
                                            <div className="flex items-center gap-2 text-xs">
                                                <User className="w-3 h-3 text-primary" /> <span className="font-medium">{p.holder_name || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <Landmark className="w-3 h-3 text-primary" /> <span className="font-mono">{p.account_number || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-1 pt-1 border-t border-border/20">
                                                <Badge variant="outline" className="text-[10px] h-5 opacity-60">{p.bank_name || 'No Bank'}</Badge>
                                                <span className="text-[10px] font-mono opacity-60">{p.ifsc_code}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {p.google_drive_folder_link && (
                                        <Button variant="outline" className="w-full gap-2 h-9 text-xs font-bold border-primary/20 hover:bg-primary/5 hover:text-primary transition-all underline-hover" onClick={() => window.open(p.google_drive_folder_link, '_blank')}>
                                            <ExternalLink className="w-3.5 h-3.5" /> Agreement Docs
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Property Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-primary/20 shadow-2xl">
                    <DialogHeader className="p-6 pb-2 bg-primary/5">
                        <DialogTitle className="text-xl flex items-center gap-2">
                            {editingProperty ? <Edit className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
                            {editingProperty ? 'Edit Property Details' : 'Onboard New Rental Property'}
                        </DialogTitle>
                        <DialogDescription>
                            Enter authoritative commercial and legal details for the property.
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-1 p-6 pt-2">
                        <form id="property-form" onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const data = Object.fromEntries(formData.entries());
                            mutation.mutate(data);
                        }} className="space-y-6 pb-6">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                                <div className="space-y-2">
                                    <Label>Category *</Label>
                                    <Select name="category_id" defaultValue={editingProperty?.category_id} required>
                                        <SelectTrigger className="h-11">
                                            <SelectValue placeholder="Select Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories?.map((c: any) => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Property Title *</Label>
                                    <Input name="title" defaultValue={editingProperty?.title} placeholder="e.g. Hyderabad Warehouse A" required className="h-11" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Physical Location</Label>
                                    <Input name="location" defaultValue={editingProperty?.location} placeholder="Full address or area" className="h-11" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <Select name="status" defaultValue={editingProperty?.status || 'Active'}>
                                        <SelectTrigger className="h-11">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Active">Active</SelectItem>
                                            <SelectItem value="Hold">On Hold</SelectItem>
                                            <SelectItem value="Closed">Closed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Base Rent (₹) *</Label>
                                    <Input name="monthly_base_rent" type="number" defaultValue={editingProperty?.monthly_base_rent || 0} required className="h-11" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Due Day of Month *</Label>
                                    <Input name="rent_due_day" type="number" min="1" max="31" defaultValue={editingProperty?.rent_due_day || 1} required className="h-11" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Agreement Expiry</Label>
                                    <Input name="agreement_expiry_date" type="date" defaultValue={editingProperty?.agreement_expiry_date} className="h-11" />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-border/50">
                                <h3 className="text-sm font-bold flex items-center gap-2 text-primary uppercase tracking-widest">
                                    <Landmark className="w-4 h-4" /> Payee Bank Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Account Holder Name</Label>
                                        <Input name="holder_name" defaultValue={editingProperty?.holder_name} placeholder="Name as per bank" className="h-11 shadow-inner" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Bank Name</Label>
                                        <Input name="bank_name" defaultValue={editingProperty?.bank_name} placeholder="e.g. HDFC Bank" className="h-11 shadow-inner" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Account Number</Label>
                                        <Input name="account_number" defaultValue={editingProperty?.account_number} placeholder="Enter account number" className="h-11 shadow-inner" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>IFSC Code</Label>
                                        <Input name="ifsc_code" defaultValue={editingProperty?.ifsc_code} placeholder="e.g. HDFC0001234" className="h-11 shadow-inner" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 pt-4 border-t border-border/50">
                                <Label>Google Drive Folder Link</Label>
                                <Input name="google_drive_folder_link" defaultValue={editingProperty?.google_drive_folder_link} placeholder="Link to agreements and bills" className="h-11" />
                            </div>

                        </form>
                    </ScrollArea>

                    <DialogFooter className="p-6 pt-2 border-t bg-muted/20">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="h-11 px-8">Cancel</Button>
                        <Button type="submit" form="property-form" disabled={mutation.isPending} className="h-11 px-8 min-w-[140px] shadow-lg shadow-primary/20">
                            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            {editingProperty ? 'Save Changes' : 'Create Property'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
