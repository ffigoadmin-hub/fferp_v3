import { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Users, Clock, TrendingUp, Search, UserCheck, UserX, Check, X, UserMinus } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAdminShiftUsers } from '@/hooks/useAdminShiftUsers';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Profile {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string;
}

export default function AdminShiftUserManagementPage() {
    const { user } = useAuth();
    const {
        shiftUsers,
        activeUsers,
        isLoading,
        isProcessing,
        assignUser,
        toggleUser,
        updateTargetHours,
        removeUser,
    } = useAdminShiftUsers();

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [selectedTargetHours, setSelectedTargetHours] = useState<string>('9');
    const [profileSearch, setProfileSearch] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

    // Fetch all profiles for the add dialog
    useEffect(() => {
        const fetchProfiles = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, email, role, department')
                .order('name');

            if (error) {
                console.error('Error fetching profiles:', error);
                return;
            }

            console.log('Fetched profiles:', data?.length);
            setAllProfiles(data || []);
        };

        fetchProfiles();
    }, []);

    // Filter already assigned users from the add list
    const assignedUserIds = new Set(shiftUsers.map(u => u.userId));
    const availableProfiles = allProfiles
        .filter(p => !assignedUserIds.has(p.id))
        .filter(p => !selectedDepartment || selectedDepartment === 'all' || (p.department === selectedDepartment))
        .filter(p =>
            profileSearch === '' ||
            p.name.toLowerCase().includes(profileSearch.toLowerCase()) ||
            p.email.toLowerCase().includes(profileSearch.toLowerCase())
        );

    // Get unique departments
    const departments = Array.from(new Set(allProfiles.map(p => p.department).filter(Boolean))).sort();

    // Filter shift users list
    const filteredShiftUsers = shiftUsers.filter(u =>
        searchQuery === '' ||
        u.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.department.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAddUser = async () => {
        if (selectedUserIds.size === 0 || !user) return;

        let successCount = 0;
        const total = selectedUserIds.size;

        for (const userId of selectedUserIds) {
            const result = await assignUser(
                { userId, targetHours: parseFloat(selectedTargetHours) },
                user.id
            );
            if (result.success) successCount++;
        }

        if (successCount > 0) {
            setIsAddDialogOpen(false);
            setSelectedUserIds(new Set());
            setSelectedTargetHours('9');
            setProfileSearch('');
            setSelectedDepartment('all');
        }
    };

    const toggleUserSelection = (userId: string) => {
        const newSelected = new Set(selectedUserIds);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedUserIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedUserIds.size === availableProfiles.length) {
            setSelectedUserIds(new Set());
        } else {
            setSelectedUserIds(new Set(availableProfiles.map(p => p.id)));
        }
    };

    const handleToggle = async (assignmentId: string, isActive: boolean) => {
        if (!user) return;
        await toggleUser(assignmentId, isActive, user.id);
    };

    const handleTargetHoursChange = async (assignmentId: string, hours: string) => {
        if (!user) return;
        await updateTargetHours(assignmentId, parseFloat(hours), user.id);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Shift User Management</h1>
                    <p className="text-muted-foreground">
                        Manage employees on flexible shift mode
                    </p>
                </div>

                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Shift User
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add User to Shift Mode</DialogTitle>
                            <DialogDescription>
                                Select an employee to enable flexible shift tracking
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="flex flex-col gap-4">
                                <div className="space-y-2">
                                    <Label>Filter Department</Label>
                                    <Select
                                        value={selectedDepartment}
                                        onValueChange={setSelectedDepartment}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Departments" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Departments</SelectItem>
                                            {departments.map(dept => (
                                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Search Employee</Label>
                                    <Input
                                        placeholder="Search by name or email..."
                                        value={profileSearch}
                                        onChange={(e) => setProfileSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between pb-2 border-b">
                                <span className="text-sm text-muted-foreground">
                                    {availableProfiles.length} available employees
                                </span>
                                {availableProfiles.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={toggleSelectAll}
                                    >
                                        {selectedUserIds.size === availableProfiles.length ? 'Deselect All' : 'Select All'}
                                    </Button>
                                )}
                            </div>

                            {availableProfiles.length > 0 && (
                                <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
                                    {availableProfiles.map((profile) => {
                                        const isSelected = selectedUserIds.has(profile.id);
                                        return (
                                            <div
                                                key={profile.id}
                                                className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-muted transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                                                onClick={() => toggleUserSelection(profile.id)}
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleUserSelection(profile.id)}
                                                />
                                                <div className="flex-1 overflow-hidden">
                                                    <div className="font-medium truncate">{profile.name}</div>
                                                    <div className="text-xs text-muted-foreground truncate">
                                                        {profile.email} • {profile.department || profile.role}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {availableProfiles.length === 0 && (
                                <div className="text-center text-muted-foreground py-8 border rounded-md bg-muted/20">
                                    No available users found matching your filters
                                </div>
                            )}

                            {selectedUserIds.size > 0 && (
                                <div className="space-y-2 pt-2 border-t">
                                    <Label>Target Working Hours</Label>
                                    <Select
                                        value={selectedTargetHours}
                                        onValueChange={setSelectedTargetHours}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="6">6 hours</SelectItem>
                                            <SelectItem value="7">7 hours</SelectItem>
                                            <SelectItem value="8">8 hours</SelectItem>
                                            <SelectItem value="9">9 hours (Default)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Applies to all {selectedUserIds.size} selected users (Max cap: 12h)
                                    </p>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="flex-col sm:flex-row gap-2">
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddUser}
                                disabled={selectedUserIds.size === 0 || isProcessing}
                            >
                                {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Add {selectedUserIds.size > 0 ? `${selectedUserIds.size} Users` : 'User'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Shift Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{shiftUsers.length}</div>
                        <p className="text-xs text-muted-foreground">
                            Assigned to flexible shift mode
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                        <UserCheck className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {activeUsers.length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Currently tracking flexible time
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Inactive Users</CardTitle>
                        <UserX className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                            {shiftUsers.length - activeUsers.length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Disabled shift tracking
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Users Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Shift Users</CardTitle>
                    <CardDescription>
                        Manage employee shift assignments and target hours
                    </CardDescription>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 max-w-sm"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredShiftUsers.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {shiftUsers.length === 0
                                ? 'No users assigned to shift mode yet'
                                : 'No users match your search'}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Target Hours</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Assigned</TableHead>
                                    <TableHead className="text-right">Active</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredShiftUsers.map((shiftUser) => (
                                    <TableRow key={shiftUser.id}>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{shiftUser.userName}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {shiftUser.userEmail}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {shiftUser.department || shiftUser.userRole}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={shiftUser.targetHours.toString()}
                                                onValueChange={(value) =>
                                                    handleTargetHoursChange(shiftUser.id, value)
                                                }
                                                disabled={isProcessing}
                                            >
                                                <SelectTrigger className="w-24">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="6">6 hrs</SelectItem>
                                                    <SelectItem value="7">7 hrs</SelectItem>
                                                    <SelectItem value="8">8 hrs</SelectItem>
                                                    <SelectItem value="9">9 hrs</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            {shiftUser.isActive ? (
                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                                    Active
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">Inactive</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                <div>
                                                    {format(new Date(shiftUser.assignedAt), 'MMM d, yyyy')}
                                                </div>
                                                <div className="text-muted-foreground">
                                                    by {shiftUser.assignedByName}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Switch
                                                checked={shiftUser.isActive}
                                                onCheckedChange={(checked) =>
                                                    handleToggle(shiftUser.id, checked)
                                                }
                                                disabled={isProcessing}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-1 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                                                        disabled={isProcessing}
                                                    >
                                                        <UserMinus className="h-3 w-3" />
                                                        Convert to General
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Convert to General User</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will remove <strong>{shiftUser.userName}</strong> from shift mode and convert them back to a general employee. Their shift tracking data will be preserved but they will no longer be tracked as a shift user.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => user && removeUser(shiftUser.id, user.id)}
                                                            className="bg-orange-600 hover:bg-orange-700"
                                                        >
                                                            Yes, Convert to General
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>


        </div>
    );
}
