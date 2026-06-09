import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, ShieldCheck, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { RentalField } from "@/components/rental/RentalField";

export default function AdminRentalCategoryPage() {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newCategory, setNewCategory] = useState({
        name: '',
        code: '',
        owner_department: 'Both HR & RSH'
    });

    const { data: categories, isLoading } = useQuery({
        queryKey: ['rental-categories'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('rental_categories')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        }
    });

    const createCategoryMutation = useMutation({
        mutationFn: async (data: typeof newCategory) => {
            const ownerRole = data.owner_department === 'Both HR & RSH' ? 'both'
                : data.owner_department === 'HR' ? 'hr' : 'rsh';
            const { error } = await supabase.from('rental_categories').insert([{
                ...data,
                owner_role: ownerRole,
                status: 'Active'
            }] as any);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-categories'] });
            toast.success('Category created successfully');
            setIsDialogOpen(false);
            setNewCategory({ name: '', code: '', owner_department: 'Both HR & RSH' });
        },
        onError: (error) => toast.error(error.message)
    });

    const deleteCategoryMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('rental_categories').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-categories'] });
            toast.success('Category deleted');
        },
        onError: (error) => toast.error(error.message)
    });

    const handleSubmit = () => {
        if (!newCategory.name || !newCategory.code || newCategory.code.length < 3) {
            toast.error('Please fill all mandatory fields correctly');
            return;
        }
        createCategoryMutation.mutate(newCategory);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Rental Categories</h1>
                    <p className="text-muted-foreground flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" /> Master Data Management
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 font-bold shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90">
                            <Plus className="w-4 h-4" /> New Category
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Rental Category</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <RentalField label="Category Name" required>
                                <Input
                                    placeholder="e.g. JV Polyhouse"
                                    value={newCategory.name}
                                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                                />
                            </RentalField>
                            <RentalField label="Category Code" required helperText="Unique code, min 3 chars">
                                <Input
                                    placeholder="e.g. RC01"
                                    value={newCategory.code}
                                    onChange={(e) => setNewCategory({ ...newCategory, code: e.target.value.toUpperCase() })}
                                />
                            </RentalField>
                            <RentalField label="Owner Department" required>
                                <Select
                                    value={newCategory.owner_department}
                                    onValueChange={(val) => setNewCategory({ ...newCategory, owner_department: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Both HR & RSH">Both HR & RSH</SelectItem>
                                        <SelectItem value="HR">HR Department</SelectItem>
                                        <SelectItem value="Rental Sourcing Head">Rental Sourcing Head (RSH)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </RentalField>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleSubmit} disabled={createCategoryMutation.isPending}>
                                {createCategoryMutation.isPending ? 'Creating...' : 'Create Category'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="bg-card shadow-sm border-border/50">
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Active Categories</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-muted/50 border-border/50">
                                <TableHead className="font-bold text-muted-foreground">Code</TableHead>
                                <TableHead className="font-bold text-muted-foreground">Name</TableHead>
                                <TableHead className="font-bold text-muted-foreground">Owner Department</TableHead>
                                <TableHead className="font-bold text-muted-foreground">Status</TableHead>
                                <TableHead className="text-right font-bold text-muted-foreground">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell>
                                </TableRow>
                            ) : categories?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No categories found</TableCell>
                                </TableRow>
                            ) : (
                                categories?.map((category: any) => (
                                    <TableRow key={category.id} className="group hover:bg-muted/30 border-border/50 transition-colors">
                                        <TableCell className="font-mono font-bold">{category.code}</TableCell>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                                {category.name}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={
                                                category.owner_department === 'Both HR & RSH' ? 'bg-blue-100 text-blue-700' :
                                                    category.owner_department === 'HR' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-emerald-100 text-emerald-700'
                                            }>
                                                {category.owner_department}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Active</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => {
                                                    if (confirm('Are you sure? This might affect existing properties.')) {
                                                        deleteCategoryMutation.mutate(category.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
