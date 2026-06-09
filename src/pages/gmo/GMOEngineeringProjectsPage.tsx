import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HardHat, Loader2, ArrowRight, Sprout, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { AgriHandoverDialog } from '@/components/gmo/AgriHandoverDialog';

export default function GMOEngineeringProjectsPage() {
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [handoverModalOpen, setHandoverModalOpen] = useState(false);
    const queryClient = useQueryClient();

    // Fetch engineering projects (projects with lifecycle_stage = 'engineering_assigned')
    const { data: projects, isLoading } = useQuery({
        queryKey: ['engineering-projects'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('projects')
                .select(`
          *,
          vertical:project_verticals(id, name, icon, color, category),
          assigned_engineer:profiles!projects_assigned_project_engineer_id_fkey(name),
          assigned_manager:profiles!projects_assigned_manager_id_fkey(name)
        `)
                .eq('lifecycle_stage', 'engineering_assigned')
                .order('stage_engineering_assigned_at', { ascending: false });

            if (error) throw error;
            return data;
        },
    });

    // Real-time subscription
    useEffect(() => {
        const channel = supabase
            .channel('engineering-projects-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                queryClient.invalidateQueries({ queryKey: ['engineering-projects'] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    const openHandoverModal = (project: any) => {
        setSelectedProject(project);
        setHandoverModalOpen(true);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6"
        >
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <HardHat className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Engineering Projects</h1>
                    <p className="text-muted-foreground">Monitor ongoing engineering execution and handover to Agri</p>
                </div>
                <Badge variant="secondary" className="ml-auto text-lg px-4 py-1">
                    {projects?.length || 0} Active
                </Badge>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : projects?.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <HardHat className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No engineering projects currently in progress</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {projects?.map((project: any) => (
                        <Card key={project.id} className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-semibold">{project.project_name}</h3>
                                            <Badge variant="outline" className="text-xs font-mono">
                                                {project.project_id}
                                            </Badge>
                                            {project.vertical && (
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-0">
                                                    {project.vertical.name}
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-muted-foreground mt-4 max-w-2xl">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4" />
                                                <span>Engineer: <span className="text-foreground font-medium">{project.assigned_engineer?.name || 'Unassigned'}</span></span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4" />
                                                <span>Manager: <span className="text-foreground font-medium">{project.assigned_manager?.name || 'Unassigned'}</span></span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4" />
                                                <span>Assigned: {project.stage_engineering_assigned_at ? format(new Date(project.stage_engineering_assigned_at), 'MMM d, yyyy') : '-'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-3 justify-center min-w-[200px]">
                                        <Button
                                            className="w-full bg-green-600 hover:bg-green-700 text-white shadow-sm"
                                            onClick={() => openHandoverModal(project)}
                                        >
                                            <Sprout className="w-4 h-4 mr-2" />
                                            Handover to Agri
                                            <ArrowRight className="w-4 h-4 ml-2 opacity-50" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <AgriHandoverDialog
                open={handoverModalOpen}
                onOpenChange={setHandoverModalOpen}
                project={selectedProject}
            />
        </motion.div>
    );
}
