import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Search, Edit, Loader2, History, Check, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DEPARTMENTS, ROLES } from '@/constants/departments';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { format } from 'date-fns';

interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
}

export default function RoleManagementPage() {
  const queryClient = useQueryClient();
  const { createLog, logs } = useAuditLogs();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [newRole, setNewRole] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch all users
  const { data: users, isLoading } = useQuery({
    queryKey: ['role-management-users'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('id, name, email, role, department')
        .neq('is_active', false)
        .order('name');

      if (error) throw error;
      return data as Profile[];
    },
  });

  // Filter users
  const filteredUsers = users?.filter(user => {
    const matchesSearch = !searchQuery ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role.toLowerCase() === filterRole.toLowerCase();
    const matchesDepartment = filterDepartment === 'all' || user.department?.toLowerCase() === filterDepartment.toLowerCase();
    return matchesSearch && matchesRole && matchesDepartment;
  }) || [];

  // Role change logs - filter for role changes only
  const roleChangeLogs = logs.filter(log =>
    log.record_type === 'profile_role_change' ||
    log.action.toLowerCase().includes('role') ||
    log.action.toLowerCase().includes('department')
  ).slice(0, 50);

  const openEditDialog = (user: Profile) => {
    setEditingUser(user);
    setNewRole(user.role);
    setNewDepartment(user.department);
    setChangeReason('');
  };

  const handleUpdateRole = async () => {
    if (!editingUser || !changeReason.trim()) {
      toast.error('Please provide a reason for the change');
      return;
    }

    setIsUpdating(true);
    try {
      const beforeState = {
        role: editingUser.role,
        department: editingUser.department,
      };

      const afterState = {
        role: newRole,
        department: newDepartment,
      };

      // Update profile
      const { error } = await (supabase as any)
        .from('profiles')
        .update({
          role: newRole,
          department: newDepartment,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      // Create audit log
      await createLog(
        'Role/Department Change',
        'profile_role_change',
        editingUser.id,
        beforeState,
        afterState,
        `${changeReason} | User: ${editingUser.name} (${editingUser.email})`
      );

      toast.success(`Role updated for ${editingUser.name}`);
      setEditingUser(null);
      setChangeReason('');
      queryClient.invalidateQueries({ queryKey: ['role-management-users'] });
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(error.message || 'Failed to update role');
    } finally {
      setIsUpdating(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const lowerRole = role.toLowerCase();
    const colors: Record<string, string> = {
      ceo: 'bg-authority-ceo/20 text-authority-ceo border-authority-ceo',
      admin: 'bg-authority-admin/20 text-authority-admin border-authority-admin',
      hr: 'bg-authority-hr/20 text-authority-hr border-authority-hr',
      gm: 'bg-primary/20 text-primary border-primary',
      gmo: 'bg-status-live/20 text-status-live border-status-live',
      smo: 'bg-cyan-500/20 text-cyan-500 border-cyan-500',
      boi: 'bg-violet-500/20 text-violet-500 border-violet-500',
      accounts: 'bg-amber-500/20 text-amber-500 border-amber-500',
      nsm: 'bg-orange-500/20 text-orange-500 border-orange-500',
      datateam: 'bg-pink-500/20 text-pink-500 border-pink-500',
      auditor: 'bg-authority-admin/20 text-authority-admin border-authority-admin',
      rsh: 'bg-authority-rsh/20 text-authority-rsh border-authority-rsh',
      bd_data: 'bg-indigo-100 text-indigo-600 border-indigo-200',
      purchase_head: 'bg-teal-500/20 text-teal-600 border-teal-500',
      employee: 'bg-muted text-muted-foreground border-border',
    };
    return colors[lowerRole] || colors.employee;
  };

  // Get unique departments from users
  const uniqueDepartments = [...new Set(users?.map(u => u.department).filter(Boolean))].sort();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
          <Shield className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Role Management</h1>
          <p className="text-muted-foreground">Manage user roles and departments with audit trail</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Shield className="w-4 h-4" /> Users & Roles
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <History className="w-4 h-4" /> Audit Trail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>User Roles</CardTitle>
              <CardDescription>Click on a user to change their role or department</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name or email..."
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {ROLES.map(role => (
                      <SelectItem key={role.value} value={role.value.toLowerCase()}>{role.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {uniqueDepartments.map(dept => (
                      <SelectItem key={dept} value={dept.toLowerCase()}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Users Table */}
              <ScrollArea className="h-[500px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No users found matching your filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEditDialog(user)}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getRoleBadgeColor(user.role)}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>{user.department || '-'}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditDialog(user); }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>

              <p className="text-sm text-muted-foreground">
                Showing {filteredUsers.length} of {users?.length || 0} users
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Role Change Audit Trail
              </CardTitle>
              <CardDescription>History of all role and department changes</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {roleChangeLogs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No role change history found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {roleChangeLogs.map((log) => (
                      <div key={log.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{log.action}</Badge>
                            <span className="text-sm text-muted-foreground">
                              by {log.performed_by_name || 'System'}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm')}
                          </span>
                        </div>

                        {log.before_state && log.after_state && (
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            <div className="bg-destructive/10 rounded-md p-3">
                              <p className="text-xs font-medium text-destructive mb-1 flex items-center gap-1">
                                <X className="w-3 h-3" /> Before
                              </p>
                              <p className="text-sm">Role: <span className="font-medium">{log.before_state.role}</span></p>
                              <p className="text-sm">Dept: <span className="font-medium">{log.before_state.department || '-'}</span></p>
                            </div>
                            <div className="bg-status-live/10 rounded-md p-3">
                              <p className="text-xs font-medium text-status-live mb-1 flex items-center gap-1">
                                <Check className="w-3 h-3" /> After
                              </p>
                              <p className="text-sm">Role: <span className="font-medium">{log.after_state.role}</span></p>
                              <p className="text-sm">Dept: <span className="font-medium">{log.after_state.department || '-'}</span></p>
                            </div>
                          </div>
                        )}

                        {log.remarks && (
                          <p className="text-sm text-muted-foreground mt-3 italic">
                            "{log.remarks}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Change Role/Department
            </DialogTitle>
            <DialogDescription>
              {editingUser?.name} ({editingUser?.email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Changing user roles affects their access permissions immediately. This action is logged for audit purposes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Current Role</Label>
                <Badge variant="outline" className={getRoleBadgeColor(editingUser?.role || '')}>
                  {editingUser?.role}
                </Badge>
              </div>
              <div className="space-y-2">
                <Label>Current Department</Label>
                <p className="text-sm text-muted-foreground">{editingUser?.department || 'Not set'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>New Role *</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>New Department *</Label>
              <Select value={newDepartment} onValueChange={setNewDepartment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(dept => (
                    <SelectItem key={dept.value} value={dept.value}>{dept.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reason for Change *</Label>
              <Textarea
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Provide a reason for this role change (required for audit trail)..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button
              onClick={handleUpdateRole}
              disabled={isUpdating || !changeReason.trim() || (newRole === editingUser?.role && newDepartment === editingUser?.department)}
            >
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
