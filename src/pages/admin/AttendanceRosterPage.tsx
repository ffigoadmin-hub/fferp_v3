import { useState, useEffect, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Users, Search, Clock, Loader2, RefreshCw, Check, X, Calendar,
    Download, Filter, Sun, Coffee, Moon, MapPin, Palmtree
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRealtimeAttendance } from '@/hooks/useRealtimeAttendance';
import * as XLSX from 'xlsx';

// Selfie window definitions (matching DayStartPage.tsx)
const SELFIE_WINDOWS = {
    morning_login: { start: 9 * 60 + 30, end: 10 * 60 + 15, label: 'Morning', icon: Sun },
    afternoon_break: { start: 14 * 60 + 30, end: 14 * 60 + 45, label: 'Lunch', icon: Coffee },
    evening_break: { start: 17 * 60 + 40, end: 17 * 60 + 45, label: 'Evening', icon: Moon },
};

interface SelfieRecord {
    selfie_type: string;
    captured_at: string;
}

interface LeaveRecord {
    status: string;
    from_date: string;
    to_date: string;
}

interface EmployeeAttendance {
    id: string;
    name: string;
    department: string;
    role: string;
    selfies: SelfieRecord[];
    leave?: LeaveRecord;
    locationZone?: string;
    locationVerified?: boolean;
    isWeekOff?: boolean;
}

type AttendanceStatus = 'full' | 'partial' | 'absent' | 'leave' | 'week_off';

const getAttendanceStatus = (emp: EmployeeAttendance): AttendanceStatus => {
    if (emp.isWeekOff) return 'week_off';
    if (emp.leave?.status === 'approved') return 'leave';
    if (emp.selfies.length === 0) return 'absent';
    if (emp.selfies.length < 3) return 'partial';
    return 'full';
};

const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
        case 'full':
            return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">✅ 3/3</Badge>;
        case 'partial':
            return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">⚠️ Working</Badge>;
        case 'absent':
            return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">❌ Absent</Badge>;
        case 'leave':
            return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">🏖️ Leave</Badge>;
        case 'week_off':
            return <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30">📅 Week Off</Badge>;
    }
};

const getSelfieTime = (selfies: SelfieRecord[], type: string): string | null => {
    const selfie = selfies.find(s => s.selfie_type === type);
    return selfie?.captured_at || null;
};

const isLate = (capturedAt: string, type: keyof typeof SELFIE_WINDOWS): boolean => {
    const date = new Date(capturedAt);
    const minutes = date.getHours() * 60 + date.getMinutes();
    return minutes > SELFIE_WINDOWS[type].end;
};

const formatTime = (isoString: string | null): string => {
    if (!isoString) return '-';
    return format(new Date(isoString), 'h:mm a');
};

export default function AttendanceRosterPage() {
    const [employees, setEmployees] = useState<EmployeeAttendance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'all'>('all');

    const fetchRoster = useCallback(async (isInitial = true) => {
        if (isInitial) setIsLoading(true);
        try {
            // 1. Fetch all active employees
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, name, department, role')
                .eq('is_active', true)
                .not('role', 'ilike', '%auditor%')
                .order('name');

            if (profilesError) throw profilesError;

            // 2. Fetch selfies for the selected date
            const { data: selfies, error: selfiesError } = await supabase
                .from('selfie_records')
                .select('user_id, selfie_type, captured_at')
                .eq('date', selectedDate);

            if (selfiesError) throw selfiesError;

            // 3. Fetch leaves for the selected date
            const { data: leaves, error: leavesError } = await (supabase
                .from('leave_requests') as any)
                .select('employee_id, status, start_date, end_date')
                .eq('status', 'approved')
                .lte('start_date', selectedDate)
                .gte('end_date', selectedDate);

            if (leavesError) throw leavesError;

            // 4. Fetch day starts to get geofence verification status
            const { data: dayStarts, error: dayStartsError } = await (supabase
                .from('day_starts') as any)
                .select('user_id, location_zone, location_verified')
                .eq('date', selectedDate);

            if (dayStartsError) throw dayStartsError;

            // 5. Check week off status for all employees
            const weekOffPromises = (profiles || []).map(async (p) => {
                const { data } = await (supabase.rpc as any)('is_week_off_day', {
                    p_employee_id: p.id,
                    p_date: selectedDate
                });
                return { id: p.id, isWeekOff: !!data };
            });
            const weekOffResults = await Promise.all(weekOffPromises);
            const weekOffMap = new Map(weekOffResults.map(r => [r.id, r.isWeekOff]));

            // Build lookup maps
            const selfieMap = new Map<string, SelfieRecord[]>();
            (selfies || []).forEach(s => {
                if (!selfieMap.has(s.user_id)) selfieMap.set(s.user_id, []);
                selfieMap.get(s.user_id)!.push({ selfie_type: s.selfie_type, captured_at: s.captured_at });
            });

            const leaveMap = new Map<string, LeaveRecord>();
            (leaves || []).forEach((l: any) => {
                leaveMap.set(l.employee_id, { status: l.status, from_date: l.start_date, to_date: l.end_date });
            });

            const dayStartMap = new Map<string, { zone: string, verified: boolean }>();
            (dayStarts || []).forEach((ds: any) => {
                dayStartMap.set(ds.user_id, { zone: ds.location_zone, verified: ds.location_verified });
            });

            // Combine data
            const rosterData: EmployeeAttendance[] = (profiles || []).map(p => {
                const selfies = selfieMap.get(p.id) || [];
                const leave = leaveMap.get(p.id);
                const dayStart = dayStartMap.get(p.id);
                const isOff = weekOffMap.get(p.id) || false;

                return {
                    id: p.id,
                    name: p.name || 'Unknown',
                    department: p.department || 'N/A',
                    role: p.role || 'employee',
                    selfies,
                    leave,
                    locationZone: dayStart?.zone,
                    locationVerified: dayStart?.verified,
                    isWeekOff: isOff
                };
            });

            setEmployees(rosterData);
        } catch (err) {
            console.error('Error fetching roster:', err);
        } finally {
            if (isInitial) setIsLoading(false);
        }
    }, [selectedDate]);

    const fetchRosterRealtime = useCallback(() => {
        fetchRoster(false);
    }, [fetchRoster]);

    useRealtimeAttendance(fetchRosterRealtime);

    useEffect(() => {
        fetchRoster(true);
    }, [selectedDate, fetchRoster]);

    // Filter employees
    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.department?.toLowerCase().includes(searchTerm.toLowerCase());
        const status = getAttendanceStatus(emp);
        const matchesStatus = statusFilter === 'all' || status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Calculate stats
    const stats = {
        total: employees.length,
        full: employees.filter(e => getAttendanceStatus(e) === 'full').length,
        partial: employees.filter(e => getAttendanceStatus(e) === 'partial').length,
        absent: employees.filter(e => getAttendanceStatus(e) === 'absent').length,
        leave: employees.filter(e => getAttendanceStatus(e) === 'leave').length,
        weekOff: employees.filter(e => getAttendanceStatus(e) === 'week_off').length,
    };

    // Export to Excel
    const handleExport = () => {
        const exportData = filteredEmployees.map(emp => ({
            'Employee Name': emp.name,
            'Department': emp.department,
            'Status': getAttendanceStatus(emp) === 'partial' ? 'WORKING' : getAttendanceStatus(emp).toUpperCase(),
            'Location': emp.locationZone ? emp.locationZone.replace('_', ' ').toUpperCase() : '-',
            'Geofence': emp.locationZone === 'head_office' ? (emp.locationVerified ? 'VERIFIED' : 'OUT OF GEOFENCE') : '-',
            'Morning (9:30-10:15)': formatTime(getSelfieTime(emp.selfies, 'morning_login')),
            'Lunch (2:30-2:45)': formatTime(getSelfieTime(emp.selfies, 'afternoon_break')),
            'Evening (5:40-5:45)': formatTime(getSelfieTime(emp.selfies, 'evening_break')),
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
        XLSX.writeFile(wb, `Attendance_Roster_${selectedDate}.xlsx`);
    };

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Users className="w-6 h-6 text-primary" />
                        Full Attendance Roster
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Complete employee attendance with 3 checkpoint status
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-1" />
                        Export
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => fetchRoster(true)}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <Card className="p-3 text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setStatusFilter('all')}>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                </Card>
                <Card className={cn("p-3 text-center cursor-pointer hover:bg-muted/50 transition-colors", statusFilter === 'full' && "ring-2 ring-green-500")} onClick={() => setStatusFilter(statusFilter === 'full' ? 'all' : 'full')}>
                    <p className="text-2xl font-bold text-green-600">{stats.full}</p>
                    <p className="text-xs text-muted-foreground">Full (3/3)</p>
                </Card>
                <Card className={cn("p-3 text-center cursor-pointer hover:bg-muted/50 transition-colors", statusFilter === 'partial' && "ring-2 ring-amber-500")} onClick={() => setStatusFilter(statusFilter === 'partial' ? 'all' : 'partial')}>
                    <p className="text-2xl font-bold text-amber-600">{stats.partial}</p>
                    <p className="text-xs text-muted-foreground">Working</p>
                </Card>
                <Card className={cn("p-3 text-center cursor-pointer hover:bg-muted/50 transition-colors", statusFilter === 'absent' && "ring-2 ring-red-500")} onClick={() => setStatusFilter(statusFilter === 'absent' ? 'all' : 'absent')}>
                    <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
                    <p className="text-xs text-muted-foreground">Absent</p>
                </Card>
                <Card className={cn("p-3 text-center cursor-pointer hover:bg-muted/50 transition-colors", statusFilter === 'leave' && "ring-2 ring-blue-500")} onClick={() => setStatusFilter(statusFilter === 'leave' ? 'all' : 'leave')}>
                    <p className="text-2xl font-bold text-blue-600">{stats.leave}</p>
                    <p className="text-xs text-muted-foreground">On Leave</p>
                </Card>
                <Card className={cn("p-3 text-center cursor-pointer hover:bg-muted/50 transition-colors", statusFilter === 'week_off' && "ring-2 ring-purple-500")} onClick={() => setStatusFilter(statusFilter === 'week_off' ? 'all' : 'week_off')}>
                    <p className="text-2xl font-bold text-purple-600">{stats.weekOff}</p>
                    <p className="text-xs text-muted-foreground">Week Off</p>
                </Card>
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or department..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-auto"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant={selectedDate === format(new Date(), 'yyyy-MM-dd') ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                        >
                            Today
                        </Button>
                        <Button
                            variant={selectedDate === format(subDays(new Date(), 1), 'yyyy-MM-dd') ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))}
                        >
                            Yesterday
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            )}

            {/* Table */}
            {!isLoading && (
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="text-left p-3 font-medium">Employee</th>
                                    <th className="text-left p-3 font-medium hidden md:table-cell">Dept</th>
                                    <th className="text-center p-3 font-medium">
                                        <div className="flex items-center justify-center gap-1">
                                            <Sun className="w-4 h-4 text-amber-500" />
                                            <span className="hidden sm:inline">Morning</span>
                                        </div>
                                    </th>
                                    <th className="text-center p-3 font-medium">
                                        <div className="flex items-center justify-center gap-1">
                                            <Coffee className="w-4 h-4 text-orange-500" />
                                            <span className="hidden sm:inline">Lunch</span>
                                        </div>
                                    </th>
                                    <th className="text-center p-3 font-medium">
                                        <div className="flex items-center justify-center gap-1">
                                            <Moon className="w-4 h-4 text-indigo-500" />
                                            <span className="hidden sm:inline">Evening</span>
                                        </div>
                                    </th>
                                    <th className="text-center p-3 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-muted-foreground">
                                            No employees found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredEmployees.map((emp) => {
                                        const status = getAttendanceStatus(emp);
                                        const morningTime = getSelfieTime(emp.selfies, 'morning_login');
                                        const lunchTime = getSelfieTime(emp.selfies, 'afternoon_break');
                                        const eveningTime = getSelfieTime(emp.selfies, 'evening_break');

                                        return (
                                            <tr key={emp.id} className={cn(
                                                "border-b hover:bg-muted/30 transition-colors",
                                                status === 'absent' && "bg-red-500/5",
                                                status === 'leave' && "bg-blue-500/5",
                                                status === 'week_off' && "bg-purple-500/5"
                                            )}>
                                                <td className="p-3">
                                                    <div>
                                                        <p className="font-medium">{emp.name}</p>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-muted-foreground hidden md:table-cell">
                                                    {emp.department}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {status === 'leave' || status === 'week_off' ? (
                                                        <span className="text-muted-foreground text-xs">-</span>
                                                    ) : morningTime ? (
                                                        <div className={cn(
                                                            "inline-flex flex-col items-center",
                                                            isLate(morningTime, 'morning_login') && "text-red-600"
                                                        )}>
                                                            <Check className="w-4 h-4 text-green-600" />
                                                            <span className="text-xs">{formatTime(morningTime)}</span>
                                                            {emp.locationZone && (
                                                                <div className="flex flex-col items-center mt-1">
                                                                    <span className="text-[10px] text-muted-foreground capitalize font-medium whitespace-nowrap">
                                                                        📍 {emp.locationZone.replace('_', ' ')}
                                                                    </span>
                                                                    {emp.locationZone === 'head_office' && (
                                                                        emp.locationVerified ? (
                                                                            <span className="text-[9px] text-green-600 font-bold">Verified</span>
                                                                        ) : (
                                                                            <span className="text-[9px] text-red-500 font-bold animate-pulse">Out of Geofence</span>
                                                                        )
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <X className="w-4 h-4 text-red-500 mx-auto" />
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {status === 'leave' || status === 'week_off' ? (
                                                        <span className="text-muted-foreground text-xs">-</span>
                                                    ) : lunchTime ? (
                                                        <div className={cn(
                                                            "inline-flex flex-col items-center",
                                                            isLate(lunchTime, 'afternoon_break') && "text-red-600"
                                                        )}>
                                                            <Check className="w-4 h-4 text-green-600" />
                                                            <span className="text-xs">{formatTime(lunchTime)}</span>
                                                        </div>
                                                    ) : (
                                                        <X className="w-4 h-4 text-red-500 mx-auto" />
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {status === 'leave' || status === 'week_off' ? (
                                                        <span className="text-muted-foreground text-xs">-</span>
                                                    ) : eveningTime ? (
                                                        <div className={cn(
                                                            "inline-flex flex-col items-center",
                                                            isLate(eveningTime, 'evening_break') && "text-red-600"
                                                        )}>
                                                            <Check className="w-4 h-4 text-green-600" />
                                                            <span className="text-xs">{formatTime(eveningTime)}</span>
                                                        </div>
                                                    ) : (
                                                        <X className="w-4 h-4 text-red-500 mx-auto" />
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {getStatusBadge(status)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Legend */}
            <Card className="p-4">
                <h3 className="text-sm font-medium mb-3">Legend</h3>
                <div className="flex flex-wrap gap-4 text-xs">
                    <div className="flex items-center gap-2">
                        <Sun className="w-4 h-4 text-amber-500" />
                        <span>Morning: 9:30 - 10:15 AM</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Coffee className="w-4 h-4 text-orange-500" />
                        <span>Lunch: 2:30 - 2:45 PM</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Moon className="w-4 h-4 text-indigo-500" />
                        <span>Evening: 5:40 - 5:45 PM</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-red-500" />
                        <span className="text-red-500 font-medium whitespace-nowrap">Out of Geo Fencing: Head Office login from unauthorized location</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-red-600 font-medium">Red Time</span>
                        <span>= Late submission</span>
                    </div>
                </div>
            </Card>
        </div>
    );
}
