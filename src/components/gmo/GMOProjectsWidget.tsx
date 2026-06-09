import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGMOProjects, useFieldStaffEmployees, GMOProject } from '@/hooks/useGMOData';
import { useAllProjectsExecution } from '@/hooks/useProjectExecution';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Loader2, FolderKanban, Plus, Truck, Search, Filter, RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { CivilProjectStats } from './CivilProjectStats';
import { CivilProjectCard } from './CivilProjectCard';

export function GMOProjectsWidget() {
  const { projects, isLoading, refetch, isRefetching } = useAllProjectsExecution();
  const { employees } = useFieldStaffEmployees();
  const { user } = useAuth();

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<GMOProject | null>(null);
  const [assigneeType, setAssigneeType] = useState<'engineer' | 'manager'>('engineer');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter ONLY Civil Projects
  const civilProjects = projects.filter(p => {
    const vertical = p.vertical;
    const verticalName = (vertical?.name || p.project_vertical || '').toLowerCase();
    const verticalCode = (vertical?.code || '').toLowerCase();
    const category = vertical?.category;

    return (
      category === 'JV' ||
      ['civil', 'polyhouse', 'engineering', 'new_jv', 'revamp_jv', 'repair_services', 'mushroom', 'open_cultivation', 'microgreens'].includes(verticalCode) ||
      verticalName.includes('civil') ||
      verticalName.includes('engineering') ||
      verticalName.includes('jv') ||
      (p.department || '').toLowerCase() === 'civil'
    );
  });

  const filteredProjects = civilProjects
    .filter(p =>
      p.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.project_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location_city.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.project_name.localeCompare(b.project_name));

  const handleOpenAssign = (project: GMOProject, type: 'engineer' | 'manager') => {
    setSelectedProject(project);
    setAssigneeType(type);
    setSelectedEmployee(
      type === 'engineer' ? (project.assigned_engineer_id || '') : (project.assigned_manager_id || '')
    );
    setAssignDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedProject || !selectedEmployee) return;
    setIsAssigning(true);

    try {
      const updateField = assigneeType === 'engineer'
        ? { 
            assigned_engineer_id: selectedEmployee,
            assigned_project_engineer_id: selectedEmployee 
          }
        : { assigned_manager_id: selectedEmployee };

      const { error } = await supabase
        .from('projects')
        .update(updateField)
        .eq('id', selectedProject.id);

      if (error) {
        console.error('[GMO Assign] Supabase error:', error);
        toast.error(`Failed to assign: ${error.message || 'Unknown error'}`);
      } else {
        toast.success(`${assigneeType === 'engineer' ? 'Engineer' : 'Manager'} assigned`);
        setAssignDialogOpen(false);
        refetch();
      }
    } catch (err: any) {
      console.error('[GMO Assign] Network/catch error:', err);
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setIsAssigning(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* 1. High Level Stats */}
      <CivilProjectStats projects={civilProjects} />

      {/* 2. Action Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search civil projects..."
            className="pl-9 bg-card/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Link to="/sourcing-dashboard">
            <Button variant="outline" className="w-full md:w-auto">
              <Truck className="w-4 h-4 mr-2" /> Execution View
            </Button>
          </Link>
          <Link to="/projects/new">
            <Button className="w-full md:w-auto bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" /> New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* 3. Project Grid */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-16 bg-muted/10 rounded-2xl border border-dashed">
          <FolderKanban className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium">No projects found</h3>
          <p className="text-muted-foreground">Try adjusting your search filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <CivilProjectCard
              key={project.id}
              project={project}
              onAssignEngineer={(p) => handleOpenAssign(p, 'engineer')}
              onAssignManager={(p) => handleOpenAssign(p, 'manager')}
            />
          ))}
        </div>
      )}

      {/* Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Assign {assigneeType === 'engineer' ? 'Engineer' : 'Manager'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Project</Label>
              <div className="p-3 bg-muted rounded-md text-sm font-medium">
                {selectedProject?.project_name}
                <span className="ml-2 text-muted-foreground font-normal">({selectedProject?.project_id})</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Select {assigneeType === 'engineer' ? 'Engineer' : 'Manager'}</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter(emp => {
                      const dept = (emp.department || '').toLowerCase();
                      const role = (emp.role || '').toLowerCase();

                      // SMO can play both "Project Engineer" and "SMO" roles
                      if (role === 'smo') return true;
                      
                      if (assigneeType === 'engineer') {
                        // Regular engineers must be in correct departments
                        return ['engineering', 'eng', 'civil'].includes(dept) && role === 'employee';
                      } else {
                        // Manager list: Only SMOs (already covered by role === 'smo' above)
                        return false; 
                      }
                    })
                    .map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} ({emp.department} - {emp.role.toUpperCase()})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Showing eligible staff members
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={isAssigning || !selectedEmployee} className="bg-primary">
              {isAssigning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Assign Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
