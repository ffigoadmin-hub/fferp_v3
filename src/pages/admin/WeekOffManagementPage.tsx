import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Plus, X, Loader2, Users, RefreshCw, Check, Sun } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useWeekOffAssignments } from '@/hooks/useWeekOffAssignments';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_OF_WEEK_OPTIONS = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
];

/**
 * Bulk Assign Week Off Modal
 */
function BulkAssignModal({ open, onClose, fetchParentData }: { open: boolean, onClose: () => void, fetchParentData: () => void }) {
    const { user } = useAuth();
    const [employees, setEmployees] = useState<any[]>([]);
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [selectedDept, setSelectedDept] = useState<string>('all');
    const [assignmentType, setAssignmentType] = useState<'one_time' | 'recurring_weekly'>('one_time');
    const [specificDate, setSpecificDate] = useState('');
    const [recurringDay, setRecurringDay] = useState<number>(0);
    const [reason, setReason] = useState('');

    const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort() as string[];

    useEffect(() => {
        if (open) {
            const fetchAll = async () => {
                setIsLoadingEmployees(true);
                try {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('id, name, email, department, role')
                        .order('name');
                    if (error) throw error;
                    setEmployees(data || []);
                } catch (e) {
                    if (!isMissingTable(error)) toast.error('Failed to load employees');
                } finally {
                    setIsLoadingEmployees(false);
                }
            };
            fetchAll();
        }
    }, [open]);

    const filtered = employees.filter(e => {
        const s = searchTerm.toLowerCase();
        const matchesSearch = (e.name || '').toLowerCase().includes(s) || (e.department || '').toLowerCase().includes(s);
        const matchesDept = selectedDept === 'all' || e.department === selectedDept;
        return matchesSearch && matchesDept;
    });

    const toggle = (id: string) => {
        setSelectedEmployees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleBulkSubmit = async () => {
        if (selectedEmployees.length === 0) return toast.error('Select employees');
        if (assignmentType === 'one_time' && !specificDate) return toast.error('Select date');

        setIsSubmitting(true);
        let successCount = 0;
        let failCount = 0;
        let duplicateCount = 0;
        let failError = '';

        try {
            // Process in small batches or individually to handle partial successes
            const results = await Promise.all(selectedEmployees.map(async (id) => {
                const data = {
                    employee_id: id,
                    week_off_date: assignmentType === 'one_time' ? specificDate : new Date().toISOString().split('T')[0],
                    assignment_type: assignmentType,
                    recurring_day: assignmentType === 'recurring_weekly' ? recurringDay : undefined,
                    reason: reason || undefined,
                    assigned_by: user?.id,
                    is_active: true
                };

                const { error } = await supabase.from('week_off_assignments').insert(data);

                if (error) {
                    if (error.code === '23505') return 'duplicate';
                    failError = error.message;
                    console.error(`Error for ${id}:`, error);
                    return 'error';
                }
                return 'success';
            }));

            results.forEach(res => {
                if (res === 'success') successCount++;
                else if (res === 'duplicate') duplicateCount++;
                else failCount++;
            });

            if (successCount > 0) {
                toast.success(`Assigned week off to ${successCount} employees`);
                fetchParentData();
            }

            if (duplicateCount > 0) {
                toast.info(`${duplicateCount} employees already had this assignment`);
            }

            if (failCount > 0) {
                toast.error(`Failed ${failCount} assignments. Error: ${failError || 'Server rejected request'}`);
            }

            if (successCount > 0 || duplicateCount > 0) {
                onClose();
                setSelectedEmployees([]);
            }
        } catch (e: any) {
            console.error('Bulk Processing Error:', e);
            toast.error(e.message || 'An unexpected error occurred during processing');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isAllFilteredSelected = filtered.length > 0 && filtered.every(emp => selectedEmployees.includes(emp.id));
    const hiddenSelectionCount = selectedEmployees.length - filtered.filter(f => selectedEmployees.includes(f.id)).length;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 border-b bg-background z-10">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Users className="w-6 h-6 text-purple-500" />
                        Bulk Assign Week Off
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="flex-1 px-6">
                    <div className="py-6 space-y-6">
                        {/* Filters and Search */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Search Workers</Label>
                                    <Input placeholder="Search by name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium flex justify-between">
                                        <span>Department</span>
                                        <Badge variant="outline" className="text-[10px] py-0 h-4">{filtered.length} shown</Badge>
                                    </Label>
                                    <Select value={selectedDept} onValueChange={setSelectedDept}>
                                        <SelectTrigger><SelectValue placeholder="All Departments" /></SelectTrigger>
                                        <SelectContent position="popper">
                                            <SelectItem value="all">All Departments</SelectItem>
                                            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 bg-muted/30 p-2 rounded-lg border border-dashed">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="sel-all"
                                        checked={isAllFilteredSelected}
                                        onCheckedChange={checked => {
                                            if (checked) {
                                                const newSelected = [...selectedEmployees];
                                                filtered.forEach(f => {
                                                    if (!newSelected.includes(f.id)) newSelected.push(f.id);
                                                });
                                                setSelectedEmployees(newSelected);
                                            } else {
                                                setSelectedEmployees(selectedEmployees.filter(id => !filtered.some(f => f.id === id)));
                                            }
                                        }}
                                    />
                                    <Label htmlFor="sel-all" className="text-xs font-semibold cursor-pointer">
                                        Select All {selectedDept !== 'all' ? `in ${selectedDept}` : 'Visible'}
                                    </Label>
                                </div>
                                {selectedEmployees.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedEmployees([])}
                                        className="h-7 text-[10px] px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                                    >
                                        Clear Selection ({selectedEmployees.length})
                                    </Button>
                                )}
                            </div>
                            {hiddenSelectionCount > 0 && (
                                <p className="text-[10px] text-orange-500 px-1 italic">
                                    * Warning: {hiddenSelectionCount} employees outside current view are also selected.
                                </p>
                            )}
                        </div>

                        {/* Employee List */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Employee List</Label>
                            <div className="border rounded-xl divide-y overflow-hidden bg-card">
                                {isLoadingEmployees ? (
                                    <div className="flex flex-col items-center justify-center p-12 gap-2">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                        <p className="text-xs text-muted-foreground">Loading roster...</p>
                                    </div>
                                ) : filtered.length === 0 ? (
                                    <div className="p-8 text-center text-sm text-muted-foreground italic">
                                        No employees found matching filter
                                    </div>
                                ) : (
                                    filtered.map(emp => (
                                        <div
                                            key={emp.id}
                                            className={`flex items-center gap-3 p-3 transition-colors cursor-pointer ${selectedEmployees.includes(emp.id) ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                                            onClick={() => toggle(emp.id)}
                                        >
                                            <Checkbox checked={selectedEmployees.includes(emp.id)} onCheckedChange={() => { }} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold truncate">{emp.name || 'Unknown'}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-tight">{emp.department || 'N/A'}</p>
                                            </div>
                                            {selectedEmployees.includes(emp.id) && <Check className="w-4 h-4 text-primary" />}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Config */}
                        <div className="space-y-6 border-t pt-6 pb-4">
                            <div className="space-y-3">
                                <Label className="text-sm font-bold flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Assignment Setting
                                </Label>
                                <RadioGroup value={assignmentType} onValueChange={v => setAssignmentType(v as any)} className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:ring-1 has-[:checked]:ring-primary">
                                        <RadioGroupItem value="one_time" id="ot" className="h-4 w-4" />
                                        <Label htmlFor="ot" className="flex-1 cursor-pointer text-xs font-semibold">One-time Date</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:ring-1 has-[:checked]:ring-primary">
                                        <RadioGroupItem value="recurring_weekly" id="rw" className="h-4 w-4" />
                                        <Label htmlFor="rw" className="flex-1 cursor-pointer text-xs font-semibold">Weekly Repeat</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">{assignmentType === 'one_time' ? 'Select Date' : 'Select Day of Week'}</Label>
                                {assignmentType === 'one_time' ?
                                    <Input type="date" value={specificDate} onChange={e => setSpecificDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full bg-background" /> :
                                    <Select value={recurringDay.toString()} onValueChange={v => setRecurringDay(parseInt(v))}>
                                        <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Pick a day" /></SelectTrigger>
                                        <SelectContent position="popper">
                                            {DAYS_OF_WEEK_OPTIONS.map(d => <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                }
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">Reason (Optional)</Label>
                                <Textarea
                                    placeholder="Enter reason for assignment..."
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    className="bg-background resize-none"
                                    rows={3}
                                />
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 border-t bg-background flex gap-2">
                    <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-muted-foreground/20 hover:bg-muted">Cancel</Button>
                    <Button
                        onClick={handleBulkSubmit}
                        disabled={isSubmitting || !selectedEmployees.length}
                        className="flex-1 h-11 shadow-lg shadow-primary/20 gap-2"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                        Apply to {selectedEmployees.length} Staff
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Individual Assign Week Off Modal
 */
function AssignModal({ open, onClose, fetchParentData }: { open: boolean, onClose: () => void, fetchParentData: () => void }) {
    const { user } = useAuth();
    const [employees, setEmployees] = useState<any[]>([]);
    const [isLoadingEmp, setIsLoadingEmp] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [assignmentType, setAssignmentType] = useState<'one_time' | 'recurring_weekly'>('one_time');
    const [specificDate, setSpecificDate] = useState('');
    const [recurringDay, setRecurringDay] = useState<number>(0);
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setIsLoadingEmp(true);
            setSelectedEmployee('');
            supabase.from('profiles')
                .select('id, name, department, role')
                .order('name')
                .then(({ data, error }) => {
                    if (error) console.error('Employee fetch error:', error);
                    setEmployees(data || []);
                    setIsLoadingEmp(false);
                });
        }
    }, [open]);

    const handleSubmit = async () => {
        if (!selectedEmployee) return toast.error('Please select an employee');
        if (assignmentType === 'one_time' && !specificDate) return toast.error('Please select a date');

        setIsSubmitting(true);
        try {
            const data = {
                employee_id: selectedEmployee,
                week_off_date: assignmentType === 'one_time' ? specificDate : new Date().toISOString().split('T')[0],
                assignment_type: assignmentType,
                recurring_day: assignmentType === 'recurring_weekly' ? recurringDay : undefined,
                reason: reason || undefined,
                assigned_by: user?.id,
                is_active: true
            };

            const { error } = await supabase.from('week_off_assignments').insert(data);

            if (error) {
                if (error.code === '23505') {
                    return toast.error('This employee already has a week off assigned for this date/day');
                }
                throw error;
            }

            toast.success('Week off assigned successfully');
            fetchParentData();
            onClose();
        } catch (e: any) {
            console.error('Individual Assignment Error:', e);
            toast.error(e.message || 'Failed to assign week off');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[450px] flex flex-col p-0">
                <DialogHeader className="p-6 border-b shrink-0">
                    <DialogTitle>Assign Week Off</DialogTitle>
                </DialogHeader>

                {/* Employee select lives OUTSIDE ScrollArea to avoid overflow clipping */}
                <div className="px-6 pt-5 pb-3 shrink-0 space-y-1.5">
                    <Label className="text-sm font-medium">Select Employee</Label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee} disabled={isLoadingEmp}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder={isLoadingEmp ? 'Loading employees…' : employees.length === 0 ? 'No employees found' : 'Select worker...'} />
                        </SelectTrigger>
                        <SelectContent position="popper" className="max-h-60 overflow-y-auto">
                            {employees.map(e => (
                                <SelectItem key={e.id} value={e.id}>
                                    {e.name || '(no name)'} {e.department ? `· ${e.department}` : ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <ScrollArea className="flex-1 px-6 max-h-[55vh]">
                    <div className="pb-6 space-y-5">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Assignment Frequency</Label>
                            <RadioGroup value={assignmentType} onValueChange={v => setAssignmentType(v as any)} className="flex gap-4">
                                <div className="flex items-center space-x-2 border rounded-lg p-2 px-3 hover:bg-muted/50 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                    <RadioGroupItem value="one_time" id="ot2" className="h-4 w-4" />
                                    <Label htmlFor="ot2" className="cursor-pointer text-xs font-medium">One-time</Label>
                                </div>
                                <div className="flex items-center space-x-2 border rounded-lg p-2 px-3 hover:bg-muted/50 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                    <RadioGroupItem value="recurring_weekly" id="rw2" className="h-4 w-4" />
                                    <Label htmlFor="rw2" className="cursor-pointer text-xs font-medium">Weekly</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium">{assignmentType === 'one_time' ? 'Select Date' : 'Select Day of Week'}</Label>
                            {assignmentType === 'one_time' ?
                                <Input type="date" value={specificDate} onChange={e => setSpecificDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full" /> :
                                <Select value={recurringDay.toString()} onValueChange={v => setRecurringDay(parseInt(v))}>
                                    <SelectTrigger className="w-full"><SelectValue placeholder="Pick a day" /></SelectTrigger>
                                    <SelectContent position="popper">
                                        {DAYS_OF_WEEK_OPTIONS.map(d => <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            }
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Reason (Optional)</Label>
                            <Textarea
                                placeholder="Enter reason..."
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                className="resize-none"
                                rows={3}
                            />
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 border-t shrink-0 flex gap-2">
                    <Button variant="outline" onClick={onClose} className="flex-1 h-11">Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 h-11">
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Assign Week Off'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function WeekOffManagementPage() {
    const { weekOffs, isLoading, fetchWeekOffs, removeWeekOff } = useWeekOffAssignments();
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [allEmployees, setAllEmployees] = useState<any[]>([]);
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);

    useEffect(() => {
        const fetchEmployees = async () => {
            setIsLoadingEmployees(true);
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, name, department, role')
                    .order('name');
                if (error) throw error;
                setAllEmployees(data || []);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoadingEmployees(false);
            }
        };
        fetchEmployees();
    }, []);

    const filteredWeekOffs = weekOffs.filter(wo => {
        const s = searchTerm.toLowerCase();
        return (wo.employee?.name || '').toLowerCase().includes(s) || (wo.reason || '').toLowerCase().includes(s);
    });

    const employeeGroups = filteredWeekOffs.reduce((acc, wo) => {
        const id = wo.employee_id;
        if (!acc[id]) acc[id] = { employee: wo.employee, weekOffs: [] };
        acc[id].weekOffs.push(wo);
        return acc;
    }, {} as Record<string, { employee: any, weekOffs: any[] }>);

    // Calculate daily stats for active attendance users (excluding common admin/hr roles)
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayDay = new Date().getDay();

    // Attendance User Pool: Active profiles excluding high-level roles not tracked in weekly workflow if any
    const attendancePool = allEmployees.filter(p => {
        const r = (p.role || '').toLowerCase();
        return r !== 'admin' && r !== 'hr' && r !== 'ceo';
    });
    const attendancePoolIds = new Set(attendancePool.map(p => p.id));

    const offTodayIds = new Set(
        weekOffs
            .filter(wo => {
                if (!wo.is_active) return false;
                // CRITICAL: Only count if the employee is in our active attendance pool
                if (!attendancePoolIds.has(wo.employee_id)) return false;

                if (wo.assignment_type === 'one_time') return wo.week_off_date === today;
                if (wo.assignment_type === 'recurring_weekly') return wo.recurring_day === todayDay;
                return false;
            })
            .map(wo => wo.employee_id)
    );

    const offTodayCount = offTodayIds.size;
    const workingTodayCount = Math.max(0, attendancePool.length - offTodayCount);

    const handleRemove = async (id: string, name: string) => {
        if (confirm(`Remove week off for ${name}?`)) await removeWeekOff(id);
    };

    if (isLoading || isLoadingEmployees) return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white"><Calendar /></div>
                    <div><h1 className="text-2xl font-bold">Week Off Management</h1><p className="text-muted-foreground text-sm">Manage employee schedules</p></div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={fetchWeekOffs} disabled={isLoading}><RefreshCw className={isLoading ? 'animate-spin' : ''} /></Button>
                    <Button variant="outline" onClick={() => setShowBulkAssignModal(true)}><Users className="mr-2 h-4 w-4" /> Bulk</Button>
                    <Button onClick={() => setShowAssignModal(true)}><Plus className="mr-2 h-4 w-4" /> Assign</Button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-1">
                            <Users className="w-4 h-4 text-primary" />
                            <p className="text-sm font-medium text-primary">Attendance Staff</p>
                        </div>
                        <p className="text-3xl font-black">{attendancePool.length}</p>
                    </CardContent>
                </Card>
                <Card className="border-authority-admin/20 bg-authority-admin/5">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-1">
                            <Sun className="w-4 h-4 text-authority-admin" />
                            <p className="text-sm font-medium text-authority-admin">Off Today</p>
                        </div>
                        <p className="text-3xl font-black">{offTodayCount}</p>
                    </CardContent>
                </Card>
                <Card className="border-status-live/20 bg-status-live/5">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-1">
                            <RefreshCw className="w-4 h-4 text-status-live" />
                            <p className="text-sm font-medium text-status-live">Working Today (Pending)</p>
                        </div>
                        <p className="text-3xl font-black">{workingTodayCount}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><div className="flex justify-between items-center"><CardTitle>Assignments</CardTitle><Input placeholder="Search..." className="w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></CardHeader>
                <CardContent>
                    <ScrollArea className="h-[500px]">
                        <div className="space-y-4">
                            {Object.values(employeeGroups).map(({ employee, weekOffs: ewo }) => (
                                <Card key={employee?.id} className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div><h3 className="font-bold">{employee?.name || 'Unknown'}</h3><p className="text-xs text-muted-foreground">{employee?.department || 'No Dept'}</p></div>
                                        <Badge variant="secondary">{ewo.length} Assigned</Badge>
                                    </div>
                                    <div className="space-y-1">
                                        {ewo.map(wo => (
                                            <div key={wo.id} className="flex justify-between items-center text-sm p-2 bg-muted/30 rounded">
                                                <span>{wo.assignment_type === 'recurring_weekly' ? `Every ${DAYS_OF_WEEK[wo.recurring_day || 0]}` : format(new Date(wo.week_off_date), 'PP')}</span>
                                                <Button variant="ghost" size="sm" onClick={() => handleRemove(wo.id!, employee?.name)} className="text-red-500 h-6 w-6 p-0"><X className="h-4 w-4" /></Button>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            <AssignModal open={showAssignModal} onClose={() => setShowAssignModal(false)} fetchParentData={fetchWeekOffs} />
            <BulkAssignModal open={showBulkAssignModal} onClose={() => setShowBulkAssignModal(false)} fetchParentData={fetchWeekOffs} />
        </motion.div>
    );
}
