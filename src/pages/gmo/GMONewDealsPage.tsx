import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Inbox, Users, Check, Loader2, Eye, HardHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function GMONewDealsPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [managerId, setManagerId] = useState('');
    const [engineerId, setEngineerId] = useState('');
    const [siteManagerId, setSiteManagerId] = useState('');

    // Fetch new deals (projects with lifecycle_stage = 'new_deal')
    const { data: deals, isLoading } = useQuery({
        queryKey: ['new-deals'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('projects')
                .select(`
          *,
          vertical:project_verticals(id, name, icon, color, category),
          deal_uploader:profiles!projects_deal_uploaded_by_fkey(id, name)
        `)
                .eq('lifecycle_stage', 'new_deal')
                .or('department.ilike.%engineering%,department.ilike.%civil%,project_vertical.ilike.%engineering%,project_vertical.ilike.%civil%')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    // Real-time subscription for new deals
    useEffect(() => {
        const channel = supabase
            .channel('new-deals-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                queryClient.invalidateQueries({ queryKey: ['new-deals'] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    // Fetch SMOs for manager selection
    const { data: smos } = useQuery({
        queryKey: ['smos'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, department')
                .ilike('role', 'smo')
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            return data;
        },
    });

    // Fetch engineers
    const { data: engineers } = useQuery({
        queryKey: ['engineers'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, department')
                .ilike('role', 'employee') // Employee role as requested
                .or('department.ilike.%engineering%,department.ilike.%civil%')
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            return data;
        },
    });

    const assignMutation = useMutation({
        mutationFn: async () => {
            if (!selectedProject || !engineerId) throw new Error('Engineer is required');

            const { error } = await supabase
                .from('projects')
                .update({
                    assigned_manager_id: managerId || null,
                    assigned_project_engineer_id: engineerId,
                    assigned_site_manager_id: siteManagerId || null,
                    lifecycle_stage: 'engineering_assigned',
                    stage_engineering_assigned_at: new Date().toISOString(),
                })
                .eq('id', selectedProject.id);

            if (error) throw error;

            // Log to timeline
            await supabase.from('project_timeline').insert({
                project_id: selectedProject.id,
                action: 'team_assigned',
                performed_by: user?.id,
                performed_by_name: user?.name,
                performed_by_role: user?.role,
                details: { manager_id: managerId, engineer_id: engineerId, site_manager_id: siteManagerId },
            });
        },
        onSuccess: () => {
            toast.success('Team assigned successfully!');
            queryClient.invalidateQueries({ queryKey: ['new-deals'] });
            setAssignModalOpen(false);
            setSelectedProject(null);
            setManagerId('');
            setEngineerId('');
            setSiteManagerId('');
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to assign team');
        },
    });

    const openAssignModal = (project: any) => {
        setSelectedProject(project);
        setAssignModalOpen(true);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6"
        >
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                    <Inbox className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">New Deals Queue</h1>
                    <p className="text-muted-foreground">Assign teams to incoming project deals</p>
                </div>
                <Badge variant="secondary" className="ml-auto text-lg px-4 py-1">
                    {deals?.length || 0} Pending
                </Badge>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : deals?.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No new deals awaiting assignment</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {deals?.map((deal: any) => (
                        <Card key={deal.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-semibold">{deal.project_name}</h3>
                                            <Badge variant={deal.project_category === 'DIRECT' ? 'default' : 'secondary'}>
                                                {deal.project_category || 'DIRECT'}
                                            </Badge>
                                            {deal.vertical && (
                                                <Badge variant="outline">{deal.vertical.name}</Badge>
                                            )}
                                        </div>
                                        <p className="text-muted-foreground mb-2">
                                            {deal.client_name} • {deal.location_city}, {deal.location_state}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Uploaded by {deal.deal_uploader?.name || 'Unknown'} • {format(new Date(deal.created_at), 'MMM d, yyyy')}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        {deal.deal_file_url && (
                                            <a href={deal.deal_file_url} target="_blank" rel="noopener noreferrer">
                                                <Button variant="outline" size="sm">
                                                    <Eye className="h-4 w-4 mr-1" /> View Deal
                                                </Button>
                                            </a>
                                        )}
                                        <Button onClick={() => openAssignModal(deal)} className="bg-blue-600 hover:bg-blue-700 text-white">
                                            <HardHat className="h-4 w-4 mr-2" /> Assign to Engineering
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Assign Team Modal */}
            <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Assign Engineering Team</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            Project: <strong>{selectedProject?.project_name}</strong>
                        </p>

                        <div>
                            <Label>Project Manager (SMO)</Label>
                            <Select value={managerId} onValueChange={setManagerId}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Select SMO (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {smos?.map((smo) => (
                                        <SelectItem key={smo.id} value={smo.id}>{smo.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Project Engineer *</Label>
                            <Select value={engineerId} onValueChange={setEngineerId}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Select engineer" />
                                </SelectTrigger>
                                <SelectContent>
                                    {engineers?.map((eng) => (
                                        <SelectItem key={eng.id} value={eng.id}>{eng.name} - {eng.department}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Site Manager</Label>
                            <Select value={siteManagerId} onValueChange={setSiteManagerId}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Select site manager (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {engineers?.map((eng) => (
                                        <SelectItem key={eng.id} value={eng.id}>{eng.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssignModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => assignMutation.mutate()} disabled={!engineerId || assignMutation.isPending}>
                            {assignMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Check className="h-4 w-4 mr-2" />
                            )}
                            Assign Team
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
