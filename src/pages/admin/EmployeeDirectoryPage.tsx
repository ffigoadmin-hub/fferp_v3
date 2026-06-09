import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Users, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { DEPARTMENTS } from '@/constants/departments';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EmployeeBulkUpdateDialog } from '@/components/admin/EmployeeBulkUpdateDialog';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  office_number: string | null;
  created_at: string;
  is_active: boolean;
}

export function EmployeeDirectoryPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [userTypeFilter, setUserTypeFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'ceo';

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (profileError) throw profileError;
      setEmployees(profiles || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!employeeToDelete || !isAdmin) return;

    // Don't allow deleting yourself
    if (employeeToDelete.id === user?.id) {
      toast.error("You cannot delete your own account");
      setDeleteDialogOpen(false);
      return;
    }

    // Don't allow deleting CEO
    if (employeeToDelete.role.toLowerCase() === 'ceo') {
      toast.error("Cannot delete CEO account");
      setDeleteDialogOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId: employeeToDelete.id },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      toast.success(`User ${employeeToDelete.name} deleted permanently`);
      setEmployees(prev => prev.filter(e => e.id !== employeeToDelete.id));
      setDeleteDialogOpen(false);
      setEmployeeToDelete(null);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDepartment = departmentFilter === 'all' || emp.department === departmentFilter;
    const matchesRole = roleFilter === 'all' || emp.role.toLowerCase() === roleFilter.toLowerCase();

    // Determine if user is a shift user (based on department/role)
    const shiftDepartments = ['cafe', 'security', 'housekeeping', 'maintenance', 'transport'];
    const shiftRoles = ['shift supervisor', 'shift lead', 'shift manager'];
    const isShiftUser =
      shiftDepartments.some(dept => emp.department.toLowerCase().includes(dept)) ||
      shiftRoles.some(role => emp.role.toLowerCase().includes(role));

    const matchesUserType =
      userTypeFilter === 'all' ||
      (userTypeFilter === 'shift' && isShiftUser) ||
      (userTypeFilter === 'general' && !isShiftUser);

    return matchesSearch && matchesDepartment && matchesRole && matchesUserType;
  });

  const uniqueRoles = [...new Set(employees.map(e => e.role))].filter(role => role && role.trim() !== '');

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case 'ceo': return 'destructive';
      case 'admin': return 'outline';
      case 'hr': return 'secondary';
      case 'accounts': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 md:space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Employee Directory</h1>
          <p className="text-sm text-muted-foreground">View all employees in the organization</p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="w-5 h-5" />
          <span className="font-medium">{filteredEmployees.length} employees</span>
          {isAdmin && <EmployeeBulkUpdateDialog onSuccess={fetchEmployees} />}
        </div>
      </div>

      {/* Filters */}
      <div className="authority-card">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map(dept => (
                  <SelectItem key={dept.value} value={dept.value}>{dept.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {uniqueRoles.map(role => (
                  <SelectItem key={role} value={role.toLowerCase()}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="shift">Shift Users</SelectItem>
                <SelectItem value="general">General Users</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Employee List - Mobile Cards / Desktop Table */}
      <div className="authority-card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No employees found matching your criteria
          </div>
        ) : (
          <>
            {/* Mobile View - Cards */}
            <div className="block md:hidden divide-y divide-border">
              {filteredEmployees.map((employee) => (
                <div key={employee.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{employee.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{employee.email}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={employee.is_active ? 'outline' : 'secondary'} className={employee.is_active ? 'bg-status-live/10 text-status-live border-status-live/30 text-xs' : 'text-xs'}>
                        {employee.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {isAdmin && employee.id !== user?.id && employee.role.toLowerCase() !== 'ceo' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setEmployeeToDelete(employee);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{employee.department}</span>
                    <span className="text-muted-foreground">•</span>
                    <Badge variant={getRoleBadgeVariant(employee.role)} className="text-xs">
                      {employee.role}
                    </Badge>
                    {employee.office_number && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">{employee.office_number}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View - Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-4 font-medium text-sm">Name</th>
                    <th className="text-left p-4 font-medium text-sm">Email</th>
                    <th className="text-left p-4 font-medium text-sm">Department</th>
                    <th className="text-left p-4 font-medium text-sm">Role</th>
                    <th className="text-left p-4 font-medium text-sm">Office</th>
                    <th className="text-left p-4 font-medium text-sm">Status</th>
                    {isAdmin && <th className="text-left p-4 font-medium text-sm">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-muted/20">
                      <td className="p-4 font-medium">{employee.name}</td>
                      <td className="p-4 text-muted-foreground">{employee.email}</td>
                      <td className="p-4">{employee.department}</td>
                      <td className="p-4">
                        <Badge variant={getRoleBadgeVariant(employee.role)}>
                          {employee.role}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {employee.office_number || '-'}
                      </td>
                      <td className="p-4">
                        <Badge variant={employee.is_active ? 'outline' : 'secondary'} className={employee.is_active ? 'bg-status-live/10 text-status-live border-status-live/30' : ''}>
                          {employee.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      {isAdmin && (
                        <td className="p-4">
                          {employee.id !== user?.id && employee.role.toLowerCase() !== 'ceo' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setEmployeeToDelete(employee);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete User Permanently
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Are you sure you want to permanently delete <strong>{employeeToDelete?.name}</strong>?
              </p>
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20 text-sm">
                <p className="font-medium text-destructive mb-1">⚠️ This action cannot be undone!</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>• User will be removed from authentication system</li>
                  <li>• All associated data will be permanently deleted</li>
                  <li>• User cannot log in anymore</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Permanently
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
