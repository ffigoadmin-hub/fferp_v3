import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
    Users,
    Unlock,
    Lock,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Search,
    RefreshCw,
    Calendar
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

interface LockedUser {
    id: string;
    name: string;
    email: string;
    role: string;
    morning_selfie_time: string | null;
    day_start_time: string | null;
    is_locked: boolean;
    is_revoked: boolean;
    is_absent: boolean;
}

export default function AdminLockoutManagementPage() {
    const { user: adminUser } = useAuth();
    const [users, setUsers] = useState<LockedUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    const fetchLockedUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const now = new Date();
            const isPastCutoff = (now.getHours() * 60 + now.getMinutes()) > 750; // 12:30 PM

            // Use secure RPC function to fetch attendance status
            const { data, error } = await supabase.rpc('get_attendance_status_for_admin' as any, {
                p_date: today
            });

            if (error) {
                console.error('RPC error:', error);
                throw error;
            }

            const attendanceData = data as Array<{
                id: string;
                name: string;
                email: string;
                role: string;
                morning_selfie_time: string | null;
                day_start_time: string | null;
                is_revoked: boolean;
                override_type: string | null;
            }>;

            const consolidated: LockedUser[] = (attendanceData || []).map((p) => {
                const morningSelfieTime = p.morning_selfie_time || null;
                const isRevoked = p.override_type === 'REVOKE';
                const isManuallyLocked = p.override_type === 'LOCK';

                // Locked if:
                // 1. Manually locked (LOCK override), OR
                // 2. Past 12:30 PM AND no morning selfie AND NOT revoked
                const isCurrentlyLocked = isManuallyLocked || (isPastCutoff && !morningSelfieTime && !isRevoked);

                // Absent if before 12:30 PM AND no morning selfie
                const isAbsentNow = !isPastCutoff && !morningSelfieTime;

                return {
                    id: p.id,
                    name: p.name,
                    email: p.email || 'N/A',
                    role: p.role,
                    morning_selfie_time: morningSelfieTime,
                    day_start_time: p.day_start_time || null,
                    is_locked: isCurrentlyLocked,
                    is_revoked: isRevoked,
                    is_absent: isAbsentNow
                };
            });

            setUsers(consolidated);
        } catch (error: any) {
            console.error('Error fetching locked users:', error);
            if (!isMissingTable(error)) toast.error('Failed to fetch user status');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLockedUsers();
    }, [fetchLockedUsers]);

    const handleRevokeLock = async (userId: string, userName: string) => {
        if (!adminUser) return;

        setIsProcessing(userId);
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const { data, error } = await supabase.rpc('revoke_attendance_lock', {
                p_user_id: userId,
                p_date: today,
                p_admin_id: adminUser.id,
                p_reason: 'Admin Override'
            });

            if (error) throw error;

            toast.success(`Lock revoked for ${userName}`);
            fetchLockedUsers();
        } catch (error: any) {
            console.error('Error revoking lock:', error);
            toast.error('Failed to revoke lock');
        } finally {
            setIsProcessing(null);
        }
    };

    const handleManualLock = async (userId: string, userName: string) => {
        if (!adminUser) return;

        setIsProcessing(userId);
        try {
            const today = format(new Date(), 'yyyy-MM-dd');

            // Create a "manual lock" by inserting a record indicating this user should be locked
            const { error } = await supabase
                .from('attendance_lock_overrides')
                .insert({
                    user_id: userId,
                    override_date: today,
                    granted_by: adminUser.id,
                    admin_id: adminUser.id,
                    reason: 'Manual Lock by Admin',
                    override_type: 'LOCK'
                });

            if (error) throw error;

            toast.success(`${userName} has been manually locked`);
            fetchLockedUsers();
        } catch (error: any) {
            console.error('Error manually locking user:', error);
            toast.error('Failed to manually lock user');
        } finally {
            setIsProcessing(null);
        }
    };

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const lockedCount = users.filter(u => u.is_locked).length;
    const activeCount = users.filter(u => u.morning_selfie_time).length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 space-y-8"
        >
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <Lock className="w-8 h-8 text-primary" />
                        Attendance Lockout Management
                    </h1>
                    <p className="text-muted-foreground mt-1">Monitor and revoke system lockouts for employees</p>
                </div>
                <Button
                    variant="outline"
                    onClick={fetchLockedUsers}
                    disabled={isLoading}
                    className="gap-2"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh Status
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2 text-primary font-bold">
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" /> Total Employees
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black">{users.length}</p>
                        <p className="text-xs opacity-70">Active Employee Records</p>
                    </CardContent>
                </Card>

                <Card className="bg-status-live/5 border-status-live/20">
                    <CardHeader className="pb-2 text-status-live font-bold">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> Present Today
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black text-status-live">{activeCount}</p>
                        <p className="text-xs opacity-70">Captured Morning Selfie</p>
                    </CardContent>
                </Card>

                <Card className={lockedCount > 0 ? "bg-status-missed/10 border-status-missed/30" : "bg-muted"}>
                    <CardHeader className={`pb-2 font-bold ${lockedCount > 0 ? "text-status-missed" : "text-muted-foreground"}`}>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> Currently Locked
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className={`text-2xl font-black ${lockedCount > 0 ? "text-status-missed" : ""}`}>{lockedCount}</p>
                        <p className="text-xs opacity-70">Missed window (Past 12:30 PM)</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle>Employee Lockout Status</CardTitle>
                        <CardDescription>Real-time view of attendance and system access</CardDescription>
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or ID..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[600px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Morning Selfie</TableHead>
                                    <TableHead>Day Start</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                                            Loading status...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                            No employees found matching criteria.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((u) => (
                                        <TableRow key={u.id} className="group">
                                            <TableCell>
                                                <div>
                                                    <p className="font-bold">{u.name}</p>
                                                    <p className="text-xs text-muted-foreground">{u.email}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {u.morning_selfie_time ? (
                                                    <div className="flex items-center gap-2 text-status-live">
                                                        <Clock className="w-4 h-4" />
                                                        <span className="text-sm font-medium">{format(new Date(u.morning_selfie_time), 'hh:mm a')}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm italic">Not Captured</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {u.day_start_time ? (
                                                    <Badge variant="outline" className="text-xs">
                                                        {format(new Date(u.day_start_time), 'hh:mm a')}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs italic">Pending</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {u.is_revoked ? (
                                                    <Badge className="bg-status-live hover:bg-status-live gap-1">
                                                        <Unlock className="w-3 h-3" /> Revoked (Unlocked)
                                                    </Badge>
                                                ) : u.is_locked ? (
                                                    <Badge className="bg-status-missed hover:bg-status-missed gap-1">
                                                        <Lock className="w-3 h-3" /> Locked
                                                    </Badge>
                                                ) : u.is_absent ? (
                                                    <Badge variant="outline" className="gap-1 border-status-missed text-status-missed">
                                                        <Clock className="w-3 h-3 text-status-missed" /> Absent (Pending)
                                                    </Badge>
                                                ) : u.morning_selfie_time ? (
                                                    <Badge variant="secondary" className="gap-1">
                                                        <CheckCircle2 className="w-3 h-3" /> Present
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="gap-1">
                                                        <Clock className="w-3 h-3" /> Pending
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex gap-2 justify-end">
                                                    {u.is_revoked ? (
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            disabled={isProcessing === u.id}
                                                            onClick={() => handleManualLock(u.id, u.name)}
                                                            className="gap-1"
                                                        >
                                                            <Lock className="w-4 h-4" />
                                                            Lock User
                                                        </Button>
                                                    ) : u.is_locked ? (
                                                        <Button
                                                            variant="default"
                                                            size="sm"
                                                            disabled={isProcessing === u.id}
                                                            onClick={() => handleRevokeLock(u.id, u.name)}
                                                            className="gap-1"
                                                        >
                                                            <Unlock className="w-4 h-4" />
                                                            Revoke Lock
                                                        </Button>
                                                    ) : u.morning_selfie_time ? (
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            disabled={isProcessing === u.id}
                                                            onClick={() => handleManualLock(u.id, u.name)}
                                                            className="gap-1"
                                                        >
                                                            <Lock className="w-4 h-4" />
                                                            Lock User
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">No action</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>

            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start gap-3">
                <Calendar className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="font-bold text-blue-900">Admin Lockout Protocol</p>
                    <p className="text-blue-800/80">
                        Revoking a lock allows the employee to access their dashboard and submit reports for the remainder of the day.
                        This action also rejects any automated "Absent" LOP entries created for the user on this date.
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
