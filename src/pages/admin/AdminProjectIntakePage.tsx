import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle2, ClipboardCheck, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAssignProjectTeam, useProjectIntakeProjects } from '@/hooks/useProjectIntake';
import { toast } from 'sonner';

interface ProfileOption {
  id: string;
  name: string;
  role: string;
}

export default function AdminProjectIntakePage() {
  const { data: projects, isLoading: isProjectsLoading } = useProjectIntakeProjects();
  const assignProject = useAssignProjectTeam();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [gmoId, setGmoId] = useState<string>('');
  const [smoId, setSmoId] = useState<string>('');
  const [engineerId, setEngineerId] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'assigned'>('pending');

  const { data: roleProfiles, isLoading: isProfilesLoading } = useQuery({
    queryKey: ['project-intake-role-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role')
        .in('role', ['gmo', 'GMO', 'smo', 'SMO', 'employee', 'Employee'])
        .order('name');

      if (error) throw error;
      return (data ?? []) as ProfileOption[];
    },
  });

  const gmoOptions = useMemo(
    () => (roleProfiles ?? []).filter((p) => p.role?.toLowerCase() === 'gmo'),
    [roleProfiles]
  );

  const smoOptions = useMemo(
    () => (roleProfiles ?? []).filter((p) => p.role?.toLowerCase() === 'smo'),
    [roleProfiles]
  );

  const engineerOptions = useMemo(
    () => (roleProfiles ?? []).filter((p) => p.role?.toLowerCase() === 'employee'),
    [roleProfiles]
  );

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return (projects ?? []).filter((project) => {
      const isPending = ['pending_admin_review', 'assignment_pending'].includes(project.intake_status ?? 'pending_admin_review');
      const isAssigned = ['engineering_assigned', 'in_execution', 'closed'].includes(project.intake_status ?? '');

      if (statusFilter === 'pending' && !isPending) return false;
      if (statusFilter === 'assigned' && !isAssigned) return false;

      if (!normalizedSearch) return true;

      const searchableText = [
        project.project_id,
        project.project_name,
        project.client_name,
        project.location_city,
        project.location_state,
        project.intake_status,
        project.lifecycle_stage,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [projects, searchTerm, statusFilter]);

  const pendingCount = useMemo(
    () => (projects ?? []).filter((project) => ['pending_admin_review', 'assignment_pending'].includes(project.intake_status ?? 'pending_admin_review')).length,
    [projects]
  );

  const selectedProject = useMemo(
    () => (projects ?? []).find((project) => project.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  const handleAssign = async () => {
    if (!selectedProjectId || !gmoId || !smoId || !engineerId) {
      toast.error('Select project, GMO, SMO, and Engineer before assigning.');
      return;
    }

    try {
      await assignProject.mutateAsync({
        projectId: selectedProjectId,
        gmoId,
        smoId,
        engineerId,
        reviewNotes,
      });

      toast.success('Project assigned successfully and moved to engineering.');
      setSelectedProjectId('');
      setGmoId('');
      setSmoId('');
      setEngineerId('');
      setReviewNotes('');
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to assign project');
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Project Intake Assignment</h1>
        <p className="text-muted-foreground mt-1">
          Review BD Data uploads, search all projects, and assign GMO, SMO, and Engineer before execution starts.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Project Intake List</CardTitle>
            <CardDescription>
              Browse all projects, search instantly, and focus on pending assignments when needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by project ID, name, client, city, state..."
                  className="pl-9"
                />
              </div>
              <Button type="button" variant={statusFilter === 'all' ? 'default' : 'outline'} onClick={() => setStatusFilter('all')}>
                All ({projects?.length ?? 0})
              </Button>
              <Button type="button" variant={statusFilter === 'pending' ? 'default' : 'outline'} onClick={() => setStatusFilter('pending')}>
                Pending ({pendingCount})
              </Button>
              <Button type="button" variant={statusFilter === 'assigned' ? 'default' : 'outline'} onClick={() => setStatusFilter('assigned')}>
                Assigned
              </Button>
            </div>

            {isProjectsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading projects...
              </div>
            ) : !filteredProjects.length ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />
                No projects match the current search/filter.
              </div>
            ) : (
              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {filteredProjects.map((project) => {
                  const isSelected = project.id === selectedProjectId;
                  const isPending = ['pending_admin_review', 'assignment_pending'].includes(project.intake_status ?? 'pending_admin_review');
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => setSelectedProjectId(project.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{project.project_name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {project.project_id} • {project.client_name} • {project.location_city}, {project.location_state}
                          </div>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${isPending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {project.intake_status ?? 'pending_admin_review'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Lifecycle: {project.lifecycle_stage ?? 'new_deal'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Assign Project Team
            </CardTitle>
            <CardDescription>
              Complete all assignments to move project into engineering execution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Selected Project</Label>
              <div className="rounded-md border p-2 text-sm">
                {selectedProject ? `${selectedProject.project_id} - ${selectedProject.project_name}` : 'No project selected'}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assign GMO</Label>
              <Select value={gmoId} onValueChange={setGmoId} disabled={isProfilesLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select GMO" />
                </SelectTrigger>
                <SelectContent>
                  {gmoOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assign SMO</Label>
              <Select value={smoId} onValueChange={setSmoId} disabled={isProfilesLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select SMO" />
                </SelectTrigger>
                <SelectContent>
                  {smoOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assign Engineer</Label>
              <Select value={engineerId} onValueChange={setEngineerId} disabled={isProfilesLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Engineer" />
                </SelectTrigger>
                <SelectContent>
                  {engineerOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Admin Review Notes</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Optional review notes for assignment context"
              />
            </div>

            <Button
              className="w-full"
              onClick={handleAssign}
              disabled={assignProject.isPending || isProjectsLoading || !selectedProjectId}
            >
              {assignProject.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Confirm Assignment'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
