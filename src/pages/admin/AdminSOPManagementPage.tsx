import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    FileText,
    Plus,
    Search,
    Pencil,
    Trash2,
    Users,
    Building2,
    Calendar,
    AlertCircle,
    ChevronDown,
    Download,
    Upload,
    X,
    Loader2,
} from 'lucide-react';
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
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SOP {
    id: string;
    name: string;
    code?: string;
    description?: string;
    category?: string;
    content: string;
    attachment_url?: string;
    version: number;
    is_active: boolean;
    created_by: string;
    updated_by?: string;
    created_at: string;
    updated_at: string;
}

interface SOPAssignment {
    id: string;
    sop_id: string;
    assigned_to_user_id?: string;
    assigned_to_department?: string;
    assigned_by: string;
    assigned_at: string;
    is_active: boolean;
    acknowledged_at?: string;
    acknowledged_by_user_id?: string;
    updated_at: string;
    sop?: SOP;
    assigned_user?: {
        id: string;
        name: string;
        email: string;
    };
}

interface Department {
    name: string;
}

interface Profile {
    id: string;
    name: string;
    email: string;
    department: string;
}

type DialogType = 'create-sop' | 'edit-sop' | 'assign-sop' | null;

export function AdminSOPManagementPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [dialogType, setDialogType] = useState<DialogType>(null);
    const [editingSOP, setEditingSOP] = useState<SOP | null>(null);
    const [selectedSOPForAssignment, setSelectedSOPForAssignment] = useState<SOP | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState<string>('all');

    // Form states
    const [sopForm, setSopForm] = useState({
        name: '',
        code: '',
        description: '',
        category: '',
        content: '',
        attachment_url: '',
        is_active: true,
    });

    const [uploadingFile, setUploadingFile] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const [assignmentForm, setAssignmentForm] = useState({
        assignmentType: 'department' as 'department' | 'user',
        selectedDepartment: '',
        selectedUsers: [] as string[],
    });

    // Fetch SOPs
    const { data: sops, isLoading: sopsLoading } = useQuery({
        queryKey: ['sops'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sops')
                .select('*')
                .order('name');

            if (error) throw error;
            return (data as SOP[]) || [];
        },
    });

    // Fetch Departments
    const { data: departments } = useQuery({
        queryKey: ['departments'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('departments')
                .select('name')
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            return (data as Department[]) || [];
        },
    });

    // Fetch all users (for assignment)
    const { data: allUsers } = useQuery({
        queryKey: ['all-users'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, email, department')
                .order('name');

            if (error) throw error;
            return (data as Profile[]) || [];
        },
    });

    // Fetch assignments
    const { data: assignments } = useQuery({
        queryKey: ['sop-assignments'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sop_assignments')
                .select(`
                    *,
                    sop:sops(*),
                    assigned_user:profiles!assigned_to_user_id(id, name, email)
                `)
                .eq('is_active', true)
                .order('assigned_at', { ascending: false });

            if (error) throw error;
            return (data as SOPAssignment[]) || [];
        },
    });

    const filteredSOPs = useMemo(() => {
        return sops?.filter(sop => {
            const matchesSearch = sop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (sop.code?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (sop.description?.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesCategory = categoryFilter === 'all' || sop.category === categoryFilter;
            return matchesSearch && matchesCategory;
        }) || [];
    }, [sops, searchQuery, categoryFilter]);

    const categories = useMemo(() => {
        return Array.from(new Set(sops?.map(s => s.category).filter(Boolean))) || [];
    }, [sops]);

    const handleOpenSOPDialog = (sop?: SOP) => {
        if (sop) {
            setEditingSOP(sop);
            setSopForm({
                name: sop.name,
                code: sop.code || '',
                description: sop.description || '',
                category: sop.category || '',
                content: sop.content,
                attachment_url: sop.attachment_url || '',
                is_active: sop.is_active,
            });
        } else {
            setEditingSOP(null);
            setSopForm({
                name: '',
                code: '',
                description: '',
                category: '',
                content: '',
                attachment_url: '',
                is_active: true,
            });
        }
        setDialogType('create-sop');
        setSelectedFile(null);
    };

    const handleOpenAssignmentDialog = (sop: SOP) => {
        setSelectedSOPForAssignment(sop);
        setAssignmentForm({
            assignmentType: 'department',
            selectedDepartment: '',
            selectedUsers: [],
        });
        setDialogType('assign-sop');
    };

    const handleSubmitSOP = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sopForm.name.trim() || !sopForm.content.trim()) {
            toast.error('Name and Content are required');
            return;
        }

        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            let finalAttachmentUrl = sopForm.attachment_url;

            // Handle file upload if a new file is selected
            if (selectedFile) {
                setUploadingFile(true);
                const fileExt = selectedFile.name.split('.').pop();
                const filePath = `sop-attachments/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('sops')
                    .upload(filePath, selectedFile);

                if (uploadError) throw uploadError;

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('sops')
                    .getPublicUrl(filePath);

                finalAttachmentUrl = publicUrl;
                setUploadingFile(false);
            }

            if (editingSOP) {
                const { error } = await supabase
                    .from('sops')
                    .update({
                        name: sopForm.name.trim(),
                        code: sopForm.code.trim() || null,
                        description: sopForm.description.trim() || null,
                        category: sopForm.category || null,
                        content: sopForm.content.trim(),
                        attachment_url: finalAttachmentUrl || null,
                        version: editingSOP.version + 1,
                        is_active: sopForm.is_active,
                        updated_by: user.id,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingSOP.id);

                if (error) throw error;
                toast.success('SOP updated successfully');
            } else {
                const { error } = await supabase
                    .from('sops')
                    .insert({
                        name: sopForm.name.trim(),
                        code: sopForm.code.trim() || null,
                        description: sopForm.description.trim() || null,
                        category: sopForm.category || null,
                        content: sopForm.content.trim(),
                        attachment_url: finalAttachmentUrl || null,
                        is_active: sopForm.is_active,
                        created_by: user.id,
                    });

                if (error) throw error;
                toast.success('SOP created successfully');
            }

            setDialogType(null);
            setSelectedFile(null);
            queryClient.invalidateQueries({ queryKey: ['sops'] });
        } catch (error: any) {
            console.error('Error saving SOP:', error);
            toast.error(error.message || 'Failed to save SOP');
        } finally {
            setIsSubmitting(false);
            setUploadingFile(false);
        }
    };

    const handleSubmitAssignment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSOPForAssignment) return;

        if (assignmentForm.assignmentType === 'department' && !assignmentForm.selectedDepartment) {
            toast.error('Please select a department');
            return;
        }

        if (assignmentForm.assignmentType === 'user' && assignmentForm.selectedUsers.length === 0) {
            toast.error('Please select at least one user');
            return;
        }

        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            let assignmentData: any[] = [];

            if (assignmentForm.assignmentType === 'department') {
                assignmentData = [
                    {
                        sop_id: selectedSOPForAssignment.id,
                        assigned_to_department: assignmentForm.selectedDepartment,
                        assigned_by: user.id,
                        is_active: true,
                    },
                ];
            } else {
                assignmentData = assignmentForm.selectedUsers.map(userId => ({
                    sop_id: selectedSOPForAssignment.id,
                    assigned_to_user_id: userId,
                    assigned_by: user.id,
                    is_active: true,
                }));
            }

            const { error } = await supabase
                .from('sop_assignments')
                .insert(assignmentData);

            if (error) throw error;
            toast.success(`SOP assigned to ${assignmentForm.assignmentType === 'department' ? 'department' : 'users'}`);
            setDialogType(null);
            queryClient.invalidateQueries({ queryKey: ['sop-assignments'] });
        } catch (error: any) {
            console.error('Error creating assignment:', error);
            toast.error(error.message || 'Failed to create assignment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteSOP = async (sopId: string) => {
        if (!window.confirm('Are you sure you want to delete this SOP?')) return;

        try {
            const { error } = await supabase
                .from('sops')
                .delete()
                .eq('id', sopId);

            if (error) throw error;
            toast.success('SOP deleted');
            queryClient.invalidateQueries({ queryKey: ['sops'] });
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete SOP');
        }
    };

    const handleDeleteAssignment = async (assignmentId: string) => {
        if (!window.confirm('Are you sure you want to delete this assignment?')) return;

        try {
            const { error } = await supabase
                .from('sop_assignments')
                .delete()
                .eq('id', assignmentId);

            if (error) throw error;
            toast.success('Assignment deleted');
            queryClient.invalidateQueries({ queryKey: ['sop-assignments'] });
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete assignment');
        }
    };

    const getSOPStats = (sop: SOP) => {
        const sopAssignments = assignments?.filter(a => a.sop_id === sop.id) || [];
        const acknowledged = sopAssignments.filter(a => a.acknowledged_at).length;
        return { total: sopAssignments.length, acknowledged };
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
                        <FileText className="w-6 h-6" />
                        Standard Operating Procedures
                    </h1>
                    <p className="text-muted-foreground">Create, manage, and assign SOPs to users and departments</p>
                </div>

                <Button onClick={() => handleOpenSOPDialog()} className="gap-2">
                    <Plus className="w-4 h-4" />
                    New SOP
                </Button>
            </div>

            <Tabs defaultValue="sops" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="sops">SOP Master List</TabsTrigger>
                    <TabsTrigger value="assignments">Assignments</TabsTrigger>
                </TabsList>

                {/* SOPs Tab */}
                <TabsContent value="sops" className="space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <CardTitle>All SOPs</CardTitle>
                                <div className="flex gap-2">
                                    <div className="relative flex-1 md:w-64">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search SOPs..."
                                            className="pl-9"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                        <SelectTrigger className="w-40">
                                            <SelectValue placeholder="Filter by category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Categories</SelectItem>
                                            {categories.map(cat => (
                                                <SelectItem key={cat} value={cat || ''}>{cat}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Code</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead>Version</TableHead>
                                            <TableHead>Assignments</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sopsLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-24 text-center">
                                                    Loading SOPs...
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredSOPs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                                    No SOPs found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredSOPs.map((sop) => {
                                                const stats = getSOPStats(sop);
                                                return (
                                                    <TableRow key={sop.id}>
                                                        <TableCell className="font-medium max-w-xs truncate">{sop.name}</TableCell>
                                                        <TableCell className="font-mono text-xs text-muted-foreground">{sop.code || '-'}</TableCell>
                                                        <TableCell>{sop.category || '-'}</TableCell>
                                                        <TableCell>v{sop.version}</TableCell>
                                                        <TableCell>
                                                            {stats.total > 0 && (
                                                                <Badge variant="outline">
                                                                    {stats.acknowledged}/{stats.total}
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {sop.is_active ? (
                                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                                    Active
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">
                                                                    Inactive
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleOpenAssignmentDialog(sop)}
                                                                    title="Assign SOP"
                                                                >
                                                                    <Users className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleOpenSOPDialog(sop)}
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleDeleteSOP(sop.id)}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Assignments Tab */}
                <TabsContent value="assignments" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>SOP Assignments</CardTitle>
                            <CardDescription>Track SOP assignments and acknowledgments</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>SOP</TableHead>
                                            <TableHead>Assigned To</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Assigned Date</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {!assignments || assignments.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                    No assignments found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            assignments.map((assignment) => (
                                                <TableRow key={assignment.id}>
                                                    <TableCell className="font-medium">{assignment.sop?.name || 'Unknown'}</TableCell>
                                                    <TableCell>
                                                        {assignment.assigned_to_user_id ? (
                                                            <div className="flex items-center gap-2">
                                                                <Users className="w-4 h-4 text-blue-600" />
                                                                <span>{assignment.assigned_user?.name || 'Unknown'}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <Building2 className="w-4 h-4 text-purple-600" />
                                                                <span>{assignment.assigned_to_department}</span>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">
                                                            {assignment.assigned_to_user_id ? 'User' : 'Department'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {new Date(assignment.assigned_at).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        {assignment.acknowledged_at ? (
                                                            <Badge className="bg-green-100 text-green-800">
                                                                Acknowledged
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="bg-yellow-100 text-yellow-800">
                                                                Pending
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeleteAssignment(assignment.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
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
                </TabsContent>
            </Tabs>

            {/* Create/Edit SOP Dialog */}
            <Dialog open={dialogType === 'create-sop'} onOpenChange={(open) => setDialogType(open ? 'create-sop' : null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingSOP ? 'Edit SOP' : 'Create New SOP'}</DialogTitle>
                        <DialogDescription>
                            {editingSOP ? 'Update SOP details.' : 'Create a new Standard Operating Procedure.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmitSOP} className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">SOP Name *</Label>
                            <Input
                                id="name"
                                value={sopForm.name}
                                onChange={(e) => setSopForm({ ...sopForm, name: e.target.value })}
                                placeholder="e.g. Fire Safety Procedure"
                                required
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="code">Code (Optional)</Label>
                            <Input
                                id="code"
                                value={sopForm.code}
                                onChange={(e) => setSopForm({ ...sopForm, code: e.target.value })}
                                placeholder="e.g. SOP-001"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="category">Category (Optional)</Label>
                            <Input
                                id="category"
                                value={sopForm.category}
                                onChange={(e) => setSopForm({ ...sopForm, category: e.target.value })}
                                placeholder="e.g. Safety, Operations, HR"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Textarea
                                id="description"
                                value={sopForm.description}
                                onChange={(e) => setSopForm({ ...sopForm, description: e.target.value })}
                                placeholder="Brief overview of this SOP"
                                rows={2}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="content">Content/Procedures *</Label>
                            <Textarea
                                id="content"
                                value={sopForm.content}
                                onChange={(e) => setSopForm({ ...sopForm, content: e.target.value })}
                                placeholder="Full SOP content and step-by-step procedures"
                                rows={8}
                                required
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>SOP Document (PDF/Image)</Label>
                            <div className="flex flex-col gap-3">
                                {sopForm.attachment_url && !selectedFile && (
                                    <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <FileText className="w-4 h-4 text-blue-500" />
                                            <span className="text-sm truncate">Current Attachment</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => window.open(sopForm.attachment_url, '_blank')}
                                            >
                                                <Download className="w-3 h-3" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSopForm({ ...sopForm, attachment_url: '' })}
                                            >
                                                <X className="w-3 h-3 text-red-500" />
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {selectedFile ? (
                                    <div className="flex items-center justify-between p-2 border rounded-md bg-blue-50 border-blue-200">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <FileText className="w-4 h-4 text-blue-500" />
                                            <span className="text-sm truncate">{selectedFile.name} (Ready to upload)</span>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedFile(null)}
                                        >
                                            <X className="w-3 h-3 text-red-500" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <Input
                                            id="attachment-file"
                                            type="file"
                                            className="hidden"
                                            accept=".pdf,image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) setSelectedFile(file);
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full justify-start gap-2 h-10 border-dashed"
                                            onClick={() => document.getElementById('attachment-file')?.click()}
                                        >
                                            <Upload className="w-4 h-4" />
                                            {sopForm.attachment_url ? 'Replace Attachment' : 'Upload SOP Document'}
                                        </Button>
                                    </div>
                                )}
                                <p className="text-[10px] text-muted-foreground italic">
                                    Upload supporting PDF or Image for this SOP.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                                <Label>Active Status</Label>
                                <div className="text-sm text-muted-foreground">
                                    Inactive SOPs cannot be assigned to users
                                </div>
                            </div>
                            <Switch
                                checked={sopForm.is_active}
                                onCheckedChange={(checked) => setSopForm({ ...sopForm, is_active: checked })}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogType(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : editingSOP ? 'Update SOP' : 'Create SOP'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Assign SOP Dialog */}
            <Dialog open={dialogType === 'assign-sop'} onOpenChange={(open) => setDialogType(open ? 'assign-sop' : null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Assign SOP</DialogTitle>
                        <DialogDescription>
                            Assign "{selectedSOPForAssignment?.name}" to users or departments
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmitAssignment} className="space-y-4 py-4">
                        <div className="grid gap-4">
                            <Label>Assignment Type</Label>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        id="assign-dept"
                                        value="department"
                                        checked={assignmentForm.assignmentType === 'department'}
                                        onChange={(e) => setAssignmentForm({
                                            ...assignmentForm,
                                            assignmentType: 'department',
                                            selectedUsers: [],
                                        })}
                                    />
                                    <Label htmlFor="assign-dept">Department</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        id="assign-user"
                                        value="user"
                                        checked={assignmentForm.assignmentType === 'user'}
                                        onChange={(e) => setAssignmentForm({
                                            ...assignmentForm,
                                            assignmentType: 'user',
                                            selectedDepartment: '',
                                        })}
                                    />
                                    <Label htmlFor="assign-user">Individual Users</Label>
                                </div>
                            </div>
                        </div>

                        {assignmentForm.assignmentType === 'department' ? (
                            <div className="grid gap-2">
                                <Label htmlFor="department">Select Department</Label>
                                <Select value={assignmentForm.selectedDepartment} onValueChange={(value) =>
                                    setAssignmentForm({ ...assignmentForm, selectedDepartment: value })
                                }>
                                    <SelectTrigger id="department">
                                        <SelectValue placeholder="Choose a department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments?.map(dept => (
                                            <SelectItem key={dept.name} value={dept.name}>
                                                {dept.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                <Label>Select Users</Label>
                                <div className="border rounded-md p-3 max-h-64 overflow-y-auto space-y-2">
                                    {allUsers?.map(user => (
                                        <div key={user.id} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`user-${user.id}`}
                                                checked={assignmentForm.selectedUsers.includes(user.id)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setAssignmentForm({
                                                            ...assignmentForm,
                                                            selectedUsers: [...assignmentForm.selectedUsers, user.id],
                                                        });
                                                    } else {
                                                        setAssignmentForm({
                                                            ...assignmentForm,
                                                            selectedUsers: assignmentForm.selectedUsers.filter(id => id !== user.id),
                                                        });
                                                    }
                                                }}
                                            />
                                            <Label htmlFor={`user-${user.id}`} className="flex-1 cursor-pointer">
                                                <div className="font-medium">{user.name}</div>
                                                <div className="text-xs text-muted-foreground">{user.email} • {user.department}</div>
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {assignmentForm.selectedUsers.length} user(s) selected
                                </p>
                            </div>
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogType(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Assigning...' : 'Assign SOP'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
