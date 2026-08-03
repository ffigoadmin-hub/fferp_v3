import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { exportToCSV } from '@/lib/exportUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useLOPEntries } from '@/hooks/useLOPEntries';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
    Loader2, Download, Camera, ClipboardList, Clock, Pencil, Trash2,
    UserPlus, Check, X, AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Same shift-eligible roles as Shift User Management — keep in sync.
const SHIFT_ROLES = ['hub_manager', 'shift_employee'];

interface AttendanceRow {
    sessionId: string | null;
    userId: string;
    userName: string;
    userEmail: string;
    userRole: string;
    hasSession: boolean;
    loginTime: string | null;
    logoutTime: string | null;
    loginSelfieUrl: string | null;
    logoutSelfieUrl: string | null;
    dayPlan: string | null;
    status: string | null;
    netWorkingMinutes: number | null;
}

interface EditFormState {
    loginTime: string; // HH:mm
    logoutTime: string; // HH:mm
    dayPlan: string;
    status: string;
}

function fmtDuration(minutes: number | null) {
    if (!minutes && minutes !== 0) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
}

function toTimeInput(iso: string | null): string {
    if (!iso) return '';
    try {
        return format(new Date(iso), 'HH:mm');
    } catch {
        return '';
    }
}

function toIsoFromTime(dateStr: string, timeStr: string): string | null {
    if (!timeStr) return null;
    return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

const EMPTY_EDIT_FORM: EditFormState = { loginTime: '', logoutTime: '', dayPlan: '', status: 'active' };

export default function AdminShiftAttendancePage() {
    const { user } = useAuth();
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [rows, setRows] = useState<AttendanceRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

    const [editingRow, setEditingRow] = useState<AttendanceRow | null>(null);
    const [editForm, setEditForm] = useState<EditFormState>(EMPTY_EDIT_FORM);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [deletingRow, setDeletingRow] = useState<AttendanceRow | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [lopRejectTarget, setLopRejectTarget] = useState<string | null>(null);
    const [lopRejectReason, setLopRejectReason] = useState('');

    const {
        entries: lopEntries,
        isSaving: isLopSaving,
        verifyEntry,
        deleteEntry: deleteLopEntry,
    } = useLOPEntries();

    const lopByUser = useMemo(() => {
        const map = new Map<string, typeof lopEntries>();
        for (const entry of lopEntries) {
            if (entry.lop_date !== selectedDate) continue;
            const list = map.get(entry.employee_id) || [];
            list.push(entry);
            map.set(entry.employee_id, list);
        }
        return map;
    }, [lopEntries, selectedDate]);

    const fetchAttendance = useCallback(async () => {
        setIsLoading(true);
        try {
            const [profilesRes, sessionsRes] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id, name, email, role')
                    .in('role', SHIFT_ROLES)
                    .eq('is_active', true)
                    .order('name'),
                supabase
                    .from('shift_sessions')
                    .select('id, user_id, login_time, logout_time, login_selfie_url, logout_selfie_url, day_plan, status, net_working_minutes, created_at')
                    .eq('date', selectedDate),
            ]);

            if (profilesRes.error) throw profilesRes.error;
            if (sessionsRes.error) throw sessionsRes.error;

            const sessionByUserId = new Map((sessionsRes.data || []).map((s: any) => [s.user_id, s]));

            const mapped: AttendanceRow[] = (profilesRes.data || []).map((p: any) => {
                const s: any = sessionByUserId.get(p.id);
                return {
                    sessionId: s?.id || null,
                    userId: p.id,
                    userName: p.name || 'Unknown',
                    userEmail: p.email || '',
                    userRole: p.role || '',
                    hasSession: !!s,
                    // login_time has no reliable DB default (confirmed live) — fall
                    // back to created_at, same reasoning as the late-login trigger.
                    loginTime: s?.login_time || s?.created_at || null,
                    logoutTime: s?.logout_time || null,
                    loginSelfieUrl: s?.login_selfie_url || null,
                    logoutSelfieUrl: s?.logout_selfie_url || null,
                    dayPlan: s?.day_plan || null,
                    status: s?.status || null,
                    netWorkingMinutes: s?.net_working_minutes ?? null,
                };
            });

            setRows(mapped);
        } catch (error) {
            console.error('Error fetching shift attendance:', error);
            toast.error('Failed to load attendance');
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchAttendance();
    }, [fetchAttendance]);

    const checkedInCount = rows.filter(r => r.hasSession).length;

    const handleExportCSV = () => {
        exportToCSV(
            rows.map(r => ({
                Employee: r.userName,
                Email: r.userEmail,
                Role: r.userRole,
                Date: selectedDate,
                'Checked In': r.hasSession ? 'Yes' : 'No',
                'Login Time': r.loginTime ? format(new Date(r.loginTime), 'HH:mm:ss') : '',
                'Logout Time': r.logoutTime ? format(new Date(r.logoutTime), 'HH:mm:ss') : '',
                'Net Hours': fmtDuration(r.netWorkingMinutes),
                Status: r.status || '',
                'Day Plan': r.dayPlan || '',
                LOP: (lopByUser.get(r.userId) || []).map(e => `${e.lop_type} (${e.status})`).join('; '),
            })),
            `shift-attendance-${selectedDate}`,
            [
                { key: 'Employee', label: 'Employee' },
                { key: 'Email', label: 'Email' },
                { key: 'Role', label: 'Role' },
                { key: 'Date', label: 'Date' },
                { key: 'Checked In', label: 'Checked In' },
                { key: 'Login Time', label: 'Login Time' },
                { key: 'Logout Time', label: 'Logout Time' },
                { key: 'Net Hours', label: 'Net Hours' },
                { key: 'Status', label: 'Status' },
                { key: 'Day Plan', label: 'Day Plan' },
                { key: 'LOP', label: 'LOP' },
            ]
        );
    };

    const openEdit = (row: AttendanceRow) => {
        setEditingRow(row);
        setEditForm({
            loginTime: toTimeInput(row.loginTime) || (row.hasSession ? '' : '09:00'),
            logoutTime: toTimeInput(row.logoutTime),
            dayPlan: row.dayPlan || '',
            status: row.status || 'active',
        });
    };

    const closeEdit = () => {
        setEditingRow(null);
        setEditForm(EMPTY_EDIT_FORM);
    };

    const handleSaveEdit = async () => {
        if (!editingRow) return;
        if (!editForm.loginTime) {
            toast.error('Login time is required');
            return;
        }
        setIsSavingEdit(true);
        try {
            const loginIso = toIsoFromTime(selectedDate, editForm.loginTime);
            const logoutIso = toIsoFromTime(selectedDate, editForm.logoutTime);

            if (editingRow.sessionId) {
                const { error } = await supabase
                    .from('shift_sessions')
                    .update({
                        login_time: loginIso,
                        logout_time: logoutIso,
                        day_plan: editForm.dayPlan || null,
                        status: editForm.status,
                    } as any)
                    .eq('id', editingRow.sessionId);
                if (error) throw error;
                toast.success('Attendance updated');
            } else {
                const { error } = await supabase
                    .from('shift_sessions')
                    .insert({
                        user_id: editingRow.userId,
                        date: selectedDate,
                        login_time: loginIso,
                        logout_time: logoutIso,
                        login_selfie_url: 'ADMIN_MANUAL_ENTRY',
                        day_plan: editForm.dayPlan || null,
                        status: editForm.status,
                    } as any);
                if (error) throw error;
                toast.success('Attendance entry created');
            }
            closeEdit();
            await fetchAttendance();
        } catch (error: any) {
            console.error('Error saving attendance:', error);
            toast.error(error?.message || 'Failed to save attendance');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingRow?.sessionId) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('shift_sessions')
                .delete()
                .eq('id', deletingRow.sessionId);
            if (error) throw error;
            toast.success('Attendance entry deleted');
            setDeletingRow(null);
            await fetchAttendance();
        } catch (error: any) {
            console.error('Error deleting attendance:', error);
            toast.error(error?.message || 'Failed to delete attendance');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleLopApprove = async (id: string) => {
        await verifyEntry(id, 'verify');
    };

    const handleLopRejectConfirm = async () => {
        if (!lopRejectTarget) return;
        await verifyEntry(lopRejectTarget, 'reject', lopRejectReason || undefined);
        setLopRejectTarget(null);
        setLopRejectReason('');
    };

    const handleLopDelete = async (id: string) => {
        await deleteLopEntry(id);
    };

    if (isLoading && rows.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Shift Attendance</h1>
                    <p className="text-muted-foreground">
                        Login/logout selfies, day plan, hours &amp; LOP for Hub Managers &amp; Shift Employees
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-40"
                    />
                    <Button onClick={handleExportCSV} disabled={rows.length === 0} variant="outline" className="gap-2">
                        <Download className="h-4 w-4" /> Export CSV
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Checked In</CardTitle>
                        <Clock className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {checkedInCount} / {rows.length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            on {format(new Date(selectedDate), 'MMM d, yyyy')}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Not Checked In</CardTitle>
                        <Clock className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                            {rows.length - checkedInCount}
                        </div>
                        <p className="text-xs text-muted-foreground">no shift_sessions row for this date</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Attendance — {format(new Date(selectedDate), 'MMM d, yyyy')}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No active Hub Manager or Shift Employee accounts found
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-gray-50">
                                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">Employee</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">Login</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">Selfie</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">Logout</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">Selfie</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">Net Hours</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">Day Plan</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">Status</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">LOP</th>
                                        <th className="text-right px-4 py-2.5 font-medium text-gray-500">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {rows.map(r => {
                                        const rowLops = lopByUser.get(r.userId) || [];
                                        return (
                                        <tr key={r.userId} className={r.hasSession ? '' : 'bg-gray-50/50'}>
                                            <td className="px-4 py-2.5">
                                                <div className="font-medium text-gray-800">{r.userName}</div>
                                                <div className="text-xs text-gray-400">{r.userEmail}</div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {r.loginTime ? format(new Date(r.loginTime), 'h:mm a') : (
                                                    <span className="text-gray-400">Not checked in</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {r.loginSelfieUrl ? (
                                                    <button onClick={() => setPreviewPhoto(r.loginSelfieUrl)}>
                                                        <img
                                                            src={r.loginSelfieUrl}
                                                            className="w-9 h-9 rounded-full object-cover border border-gray-200 hover:opacity-75 transition"
                                                        />
                                                    </button>
                                                ) : (
                                                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                                                        <Camera className="w-3.5 h-3.5 text-gray-300" />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {r.logoutTime ? format(new Date(r.logoutTime), 'h:mm a') : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {r.logoutSelfieUrl ? (
                                                    <button onClick={() => setPreviewPhoto(r.logoutSelfieUrl)}>
                                                        <img
                                                            src={r.logoutSelfieUrl}
                                                            className="w-9 h-9 rounded-full object-cover border border-gray-200 hover:opacity-75 transition"
                                                        />
                                                    </button>
                                                ) : (
                                                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                                                        <Camera className="w-3.5 h-3.5 text-gray-300" />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-600">
                                                {fmtDuration(r.netWorkingMinutes)}
                                            </td>
                                            <td className="px-4 py-2.5 max-w-xs">
                                                {r.dayPlan ? (
                                                    <span className="flex items-start gap-1 text-gray-600 text-xs">
                                                        <ClipboardList className="w-3 h-3 mt-0.5 shrink-0 text-gray-400" />
                                                        <span className="line-clamp-2">{r.dayPlan}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {r.status ? (
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                        r.status === 'active' ? 'bg-green-100 text-green-700' :
                                                        r.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-gray-100 text-gray-600'
                                                    }`}>{r.status}</span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">No session</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {rowLops.length === 0 ? (
                                                    <span className="text-xs text-gray-300">—</span>
                                                ) : (
                                                    <div className="flex flex-col gap-1.5">
                                                        {rowLops.map(lop => (
                                                            <div key={lop.id} className="flex items-center gap-1.5">
                                                                <Badge
                                                                    variant="outline"
                                                                    className={`text-[10px] gap-1 ${
                                                                        lop.status === 'pending_admin' ? 'border-orange-300 text-orange-700 bg-orange-50' :
                                                                        lop.status === 'pending_ceo' ? 'border-blue-300 text-blue-700 bg-blue-50' :
                                                                        lop.status === 'approved' ? 'border-red-300 text-red-700 bg-red-50' :
                                                                        'border-gray-300 text-gray-500 bg-gray-50'
                                                                    }`}
                                                                    title={lop.reason}
                                                                >
                                                                    <AlertTriangle className="w-2.5 h-2.5" />
                                                                    {lop.lop_type} · {lop.status.replace('_', ' ')}
                                                                </Badge>
                                                                {lop.status === 'pending_admin' && (
                                                                    <>
                                                                        <button
                                                                            title="Approve"
                                                                            disabled={isLopSaving}
                                                                            onClick={() => handleLopApprove(lop.id)}
                                                                            className="text-green-600 hover:text-green-800 disabled:opacity-40"
                                                                        >
                                                                            <Check className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button
                                                                            title="Reject"
                                                                            disabled={isLopSaving}
                                                                            onClick={() => setLopRejectTarget(lop.id)}
                                                                            className="text-red-600 hover:text-red-800 disabled:opacity-40"
                                                                        >
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </>
                                                                )}
                                                                <button
                                                                    title="Delete LOP entry"
                                                                    disabled={isLopSaving}
                                                                    onClick={() => handleLopDelete(lop.id)}
                                                                    className="text-gray-400 hover:text-red-600 disabled:opacity-40"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7"
                                                        title={r.hasSession ? 'Edit attendance' : 'Mark present / add entry'}
                                                        onClick={() => openEdit(r)}
                                                    >
                                                        {r.hasSession ? <Pencil className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                                                    </Button>
                                                    {r.hasSession && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-red-500 hover:text-red-700"
                                                            title="Delete attendance entry"
                                                            onClick={() => setDeletingRow(r)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!previewPhoto} onOpenChange={(v) => !v && setPreviewPhoto(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Selfie</DialogTitle>
                    </DialogHeader>
                    {previewPhoto && (
                        <img src={previewPhoto} className="w-full rounded-lg object-cover" />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingRow} onOpenChange={(v) => !v && closeEdit()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingRow?.hasSession ? 'Edit Attendance' : 'Mark Present'} — {editingRow?.userName}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Login Time</Label>
                                <Input
                                    type="time"
                                    value={editForm.loginTime}
                                    onChange={(e) => setEditForm(f => ({ ...f, loginTime: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Logout Time</Label>
                                <Input
                                    type="time"
                                    value={editForm.logoutTime}
                                    onChange={(e) => setEditForm(f => ({ ...f, logoutTime: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Status</Label>
                            <Select value={editForm.status} onValueChange={(v) => setEditForm(f => ({ ...f, status: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="incomplete">Incomplete</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Day Plan</Label>
                            <Textarea
                                value={editForm.dayPlan}
                                onChange={(e) => setEditForm(f => ({ ...f, dayPlan: e.target.value }))}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeEdit} disabled={isSavingEdit}>Cancel</Button>
                        <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
                            {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deletingRow} onOpenChange={(v) => !v && setDeletingRow(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete attendance entry?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently removes {deletingRow?.userName}'s attendance record for {selectedDate}, including selfies and hours. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={!!lopRejectTarget} onOpenChange={(v) => !v && setLopRejectTarget(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Reject LOP entry</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label>Reason (optional)</Label>
                        <Textarea
                            value={lopRejectReason}
                            onChange={(e) => setLopRejectReason(e.target.value)}
                            placeholder="Why is this LOP being rejected?"
                            rows={3}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setLopRejectTarget(null)} disabled={isLopSaving}>Cancel</Button>
                        <Button onClick={handleLopRejectConfirm} disabled={isLopSaving} className="bg-red-600 hover:bg-red-700">
                            {isLopSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
