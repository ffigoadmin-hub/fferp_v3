import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, Search, ArrowRight, Package } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BOQBuilderLandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: projects, isLoading } = useQuery({
    queryKey: ['engineering-projects-boq'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          project_id,
          project_name,
          client_name,
          vertical,
          lifecycle_stage,
          location_city,
          location_state,
          assigned_engineer_id,
          assigned_project_engineer_id
        `)
        .neq('status', 'closed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const filteredProjects = projects?.filter(project => {
    const matchesSearch =
      project.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.project_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.client_name?.toLowerCase().includes(searchTerm.toLowerCase());

    // For engineering users, only show assigned projects
    if (user?.department?.toLowerCase()?.includes('engineering')) {
      const isAssigned =
        project.assigned_engineer_id === user?.id ||
        project.assigned_project_engineer_id === user?.id;
      return matchesSearch && isAssigned;
    }

    return matchesSearch;
  }) || [];

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'deal_approved':
      case 'boq_pending':
        return 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200';
      case 'boq_submitted_smo':
        return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
      case 'boq_submitted_gmo':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200';
      case 'boq_approved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200';
      case 'sourcing':
      case 'execution':
        return 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatStage = (stage: string) => {
    switch (stage) {
      case 'deal_approved': return 'Pending BOQ';
      case 'boq_submitted_smo': return 'L1 Review (SMO)';
      case 'boq_submitted_gmo': return 'L2 Review (GMO)';
      case 'boq_approved': return 'Approved';
      case 'sourcing': return 'Sourcing';
      case 'execution': return 'Execution';
      default: return stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            BOQ Builder
            {!isLoading && (
              <Badge variant="secondary" className="ml-2">
                {filteredProjects.length} Projects
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            Select a project to create or edit its Bill of Quantities
          </p>
        </div>
      </motion.div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Projects Found</h3>
            <p className="text-muted-foreground">
              {searchTerm
                ? 'No projects match your search criteria.'
                : 'No projects are ready for BOQ creation yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base line-clamp-1">
                        {project.project_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {project.project_id}
                      </p>
                    </div>
                    <Badge variant="outline" className={getStageColor(project.lifecycle_stage || '')}>
                      {formatStage(project.lifecycle_stage || 'pending')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    <p><span className="font-medium">Client:</span> {project.client_name}</p>
                    {project.location_city && (
                      <p><span className="font-medium">Location:</span> {project.location_city}, {project.location_state}</p>
                    )}
                    {project.vertical && (
                      <p><span className="font-medium">Vertical:</span> {project.vertical}</p>
                    )}
                  </div>
                  <Button
                    className="w-full group-hover:bg-primary/90"
                    onClick={() => navigate(`/engineering/boq/${project.id}`)}
                  >
                    Open BOQ Builder
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
