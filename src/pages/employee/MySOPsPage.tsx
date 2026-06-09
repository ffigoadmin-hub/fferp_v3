import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
    BookOpen,
    Search,
    Filter,
    CheckCircle2,
    AlertCircle,
    Download,
    ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

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
}

export function MySOPsPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedSOP, setSelectedSOP] = useState<SOPAssignment | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isAcknowledging, setIsAcknowledging] = useState(false);

    // Fetch user profile for department
    const { data: userProfile } = useQuery({
        queryKey: ['user-profile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase
                .from('profiles')
                .select('department')
                .eq('id', user.id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id,
    });

    // Fetch SOPs assigned to user or their department
    const { data: assignments, isLoading, refetch } = useQuery({
        queryKey: ['my-sops', user?.id, userProfile?.department],
        queryFn: async () => {
            if (!user?.id) return [];

            const { data, error } = await supabase
                .from('sop_assignments')
                .select(`
                    *,
                    sop:sops(*)
                `)
                .eq('is_active', true)
                .or(
                    `assigned_to_user_id.eq.${user.id},assigned_to_department.eq.${userProfile?.department}`
                )
                .order('assigned_at', { ascending: false });

            if (error) throw error;
            return (data as SOPAssignment[]) || [];
        },
        enabled: !!user?.id && !!userProfile?.department,
    });

    // Filter and group SOPs
    const filteredAndGrouped = useMemo(() => {
        if (!assignments) return { all: [], categories: {} };

        let filtered = assignments;

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                a =>
                    a.sop?.name.toLowerCase().includes(query) ||
                    a.sop?.code?.toLowerCase().includes(query) ||
                    a.sop?.description?.toLowerCase().includes(query)
            );
        }

        // Category filter
        if (categoryFilter !== 'all') {
            filtered = filtered.filter(a => a.sop?.category === categoryFilter);
        }

        // Status filter
        if (statusFilter !== 'all') {
            if (statusFilter === 'new') {
                filtered = filtered.filter(a => !a.acknowledged_at);
            } else if (statusFilter === 'acknowledged') {
                filtered = filtered.filter(a => a.acknowledged_at);
            }
        }

        // Group by category
        const grouped: Record<string, SOPAssignment[]> = {};
        filtered.forEach(a => {
            const cat = a.sop?.category || 'General';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(a);
        });

        return { all: filtered, categories: grouped };
    }, [assignments, searchQuery, categoryFilter, statusFilter]);

    const categories = useMemo(() => {
        return Array.from(new Set(assignments?.map(a => a.sop?.category).filter(Boolean))) || [];
    }, [assignments]);

    const handleAcknowledge = async () => {
        if (!selectedSOP?.id) return;

        setIsAcknowledging(true);
        try {
            const now = new Date().toISOString();
            const { error } = await supabase
                .from('sop_assignments')
                .update({
                    acknowledged_at: now,
                    acknowledged_by_user_id: user?.id,
                    updated_at: now,
                })
                .eq('id', selectedSOP.id);

            if (error) throw error;

            toast.success('SOP marked as acknowledged');
            setIsDetailOpen(false);
            queryClient.invalidateQueries({ queryKey: ['my-sops'] });
        } catch (error: any) {
            console.error('Error acknowledging SOP:', error);
            toast.error(error.message || 'Failed to acknowledge SOP');
        } finally {
            setIsAcknowledging(false);
        }
    };

    const stats = {
        total: assignments?.length || 0,
        new: assignments?.filter(a => !a.acknowledged_at).length || 0,
        acknowledged: assignments?.filter(a => a.acknowledged_at).length || 0,
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
                    <BookOpen className="w-8 h-8" />
                    My Standard Operating Procedures
                </h1>
                <p className="text-muted-foreground">
                    Review and acknowledge your assigned SOPs
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Total SOPs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-yellow-600">{stats.new}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Acknowledged</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{stats.acknowledged}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle>Search & Filter</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-4 md:flex-row">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, code, or description..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="px-3 py-2 border rounded-md text-sm bg-background"
                        >
                            <option value="all">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat || ''}>
                                    {cat}
                                </option>
                            ))}
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 border rounded-md text-sm bg-background"
                        >
                            <option value="all">All Status</option>
                            <option value="new">Pending</option>
                            <option value="acknowledged">Acknowledged</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* SOPs List */}
            {isLoading ? (
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                        Loading SOPs...
                    </CardContent>
                </Card>
            ) : stats.total === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                        <p className="text-muted-foreground">
                            No SOPs assigned to you yet.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {Object.entries(filteredAndGrouped.categories).map(([category, sops]) => (
                        <div key={category}>
                            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                                {category}
                            </h2>

                            <div className="grid gap-3">
                                {sops.map(assignment => (
                                    <motion.div
                                        key={assignment.id}
                                        whileHover={{ y: -2 }}
                                        transition={{ type: 'spring', stiffness: 300 }}
                                    >
                                        <Card
                                            className="cursor-pointer hover:shadow-md transition-shadow"
                                            onClick={() => {
                                                setSelectedSOP(assignment);
                                                setIsDetailOpen(true);
                                            }}
                                        >
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className="font-semibold text-base truncate">
                                                                {assignment.sop?.name}
                                                            </h3>
                                                            {assignment.acknowledged_at ? (
                                                                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                                                            ) : (
                                                                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                                                            )}
                                                        </div>

                                                        {assignment.sop?.code && (
                                                            <p className="text-xs text-muted-foreground mb-2">
                                                                Code: {assignment.sop.code}
                                                            </p>
                                                        )}

                                                        {assignment.sop?.description && (
                                                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                                                {assignment.sop.description}
                                                            </p>
                                                        )}

                                                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                                            <span>v{assignment.sop?.version}</span>
                                                            <span>•</span>
                                                            <span>
                                                                Assigned {format(new Date(assignment.assigned_at), 'MMM d')}
                                                            </span>
                                                            {assignment.acknowledged_at && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>
                                                                        Acknowledged {format(
                                                                            new Date(assignment.acknowledged_at),
                                                                            'MMM d'
                                                                        )}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-2 items-end flex-shrink-0">
                                                        <Badge
                                                            variant="outline"
                                                            className={
                                                                assignment.acknowledged_at
                                                                    ? 'bg-green-50 text-green-700 border-green-200'
                                                                    : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                                            }
                                                        >
                                                            {assignment.acknowledged_at ? 'Acknowledged' : 'Pending'}
                                                        </Badge>
                                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {filteredAndGrouped.all.length === 0 && assignments && assignments.length > 0 && (
                        <Card>
                            <CardContent className="py-8 text-center text-muted-foreground">
                                No SOPs match your filters.
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Detail Modal */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    {selectedSOP?.sop && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    {selectedSOP.sop.name}
                                    {selectedSOP.acknowledged_at ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5 text-yellow-600" />
                                    )}
                                </DialogTitle>
                                <DialogDescription>
                                    {selectedSOP.sop.description}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                {/* Metadata */}
                                <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-lg">
                                    {selectedSOP.sop.code && (
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase">Code</p>
                                            <p className="font-semibold">{selectedSOP.sop.code}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase">Version</p>
                                        <p className="font-semibold">v{selectedSOP.sop.version}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase">Category</p>
                                        <p className="font-semibold">{selectedSOP.sop.category || 'General'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase">Status</p>
                                        <Badge
                                            className={
                                                selectedSOP.acknowledged_at
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-yellow-100 text-yellow-800'
                                            }
                                        >
                                            {selectedSOP.acknowledged_at ? 'Acknowledged' : 'Pending'}
                                        </Badge>
                                    </div>
                                </div>

                                {/* Acknowledgement Info */}
                                {selectedSOP.acknowledged_at && (
                                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <p className="text-sm text-green-700">
                                            ✓ You acknowledged this SOP on{' '}
                                            <span className="font-semibold">
                                                {format(new Date(selectedSOP.acknowledged_at), 'PPP p')}
                                            </span>
                                        </p>
                                    </div>
                                )}

                                {/* Content */}
                                <div>
                                    <h3 className="font-semibold mb-2">Procedures</h3>
                                    <div className="p-3 bg-muted rounded-lg max-h-64 overflow-y-auto whitespace-pre-wrap text-sm">
                                        {selectedSOP.sop.content}
                                    </div>
                                </div>

                                {/* Attachment */}
                                {selectedSOP.sop.attachment_url && (
                                    <Button
                                        variant="outline"
                                        className="w-full gap-2"
                                        onClick={() => window.open(selectedSOP.sop?.attachment_url, '_blank')}
                                    >
                                        <Download className="w-4 h-4" />
                                        Download PDF
                                    </Button>
                                )}

                                {/* Acknowledge Button */}
                                {!selectedSOP.acknowledged_at && (
                                    <Button
                                        onClick={handleAcknowledge}
                                        disabled={isAcknowledging}
                                        className="w-full gap-2"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        {isAcknowledging ? 'Acknowledging...' : 'Mark as Acknowledged'}
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
