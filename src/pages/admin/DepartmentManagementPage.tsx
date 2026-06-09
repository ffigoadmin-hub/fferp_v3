import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Plus, Search, Pencil, Power, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Department {
    id: string;
    name: string;
    code: string;
    description: string | null;
    is_active: boolean;
    member_count?: number;
}

export function DepartmentManagementPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(true);

    const { data: departments, isLoading } = useQuery({
        queryKey: ['departments'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('departments')
                .select('*')
                .order('name');

            if (error) throw error;
            return data as Department[];
        },
    });

    const filteredDepartments = departments?.filter(dept =>
        dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dept.code.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const handleOpenDialog = (dept?: Department) => {
        if (dept) {
            setEditingDepartment(dept);
            setName(dept.name);
            setCode(dept.code);
            setDescription(dept.description || '');
            setIsActive(dept.is_active);
        } else {
            setEditingDepartment(null);
            setName('');
            setCode('');
            setDescription('');
            setIsActive(true);
        }
        setIsDialogOpen(true);
    };

    const generateCode = (deptName: string) => {
        return deptName
            .toUpperCase()
            .replace(/[^A-Z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .slice(0, 10);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !code.trim()) {
            toast.error('Name and Code are required');
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingDepartment) {
                const { error } = await supabase
                    .from('departments')
                    .update({
                        name: name.trim(),
                        code: code.trim(),
                        description: description.trim() || null,
                        is_active: isActive,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingDepartment.id);

                // Cascading update for profiles if name changed
                if (editingDepartment.name !== name.trim()) {
                    const { error: profileError } = await (supabase
                        .from('profiles') as any)
                        .update({ department: name.trim() })
                        .eq('department', editingDepartment.name);

                    if (profileError) {
                        console.error('Error updating profiles:', profileError);
                    }
                }

                if (error) throw error;
                toast.success('Department updated successfully');
            } else {
                const { error } = await supabase
                    .from('departments')
                    .insert({
                        name: name.trim(),
                        code: code.trim(),
                        description: description.trim() || null,
                        is_active: isActive,
                    });

                if (error) throw error;
                toast.success('Department created successfully');
            }

            setIsDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ['departments'] });
        } catch (error: any) {
            console.error('Error saving department:', error);
            toast.error(error.message || 'Failed to save department');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Building2 className="w-6 h-6" />
                        Departments
                    </h1>
                    <p className="text-muted-foreground">Manage organization departments and structures</p>
                </div>

                <Button onClick={() => handleOpenDialog()} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Department
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle>All Departments</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search departments..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            Loading departments...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredDepartments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No departments found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredDepartments.map((dept) => (
                                        <TableRow key={dept.id}>
                                            <TableCell>
                                                {dept.is_active ? (
                                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">Inactive</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">{dept.name}</TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{dept.code}</TableCell>
                                            <TableCell className="max-w-[300px] truncate text-muted-foreground">
                                                {dept.description || '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleOpenDialog(dept)}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingDepartment ? 'Edit Department' : 'New Department'}</DialogTitle>
                        <DialogDescription>
                            {editingDepartment ? 'Update department details and status.' : 'Create a new department for the organization.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Department Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (!editingDepartment && !code) {
                                        setCode(generateCode(e.target.value));
                                    }
                                }}
                                placeholder="e.g. Engineering"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="code">Department Code</Label>
                            <Input
                                id="code"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                placeholder="e.g. ENG"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Input
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Brief description of the department"
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                                <Label>Active Status</Label>
                                <div className="text-sm text-muted-foreground">
                                    Inactive departments cannot be assigned to new users
                                </div>
                            </div>
                            <Switch
                                checked={isActive}
                                onCheckedChange={setIsActive}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : editingDepartment ? 'Update Department' : 'Create Department'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
