// @ts-nocheck
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft, User, Building, Briefcase, Clock, Download,
    TrendingUp, TrendingDown, BarChart3, Wallet, Calendar,
    Mail, Phone, CreditCard, FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface EmployeeProfile {
    id: string;
    name: string;
    email?: string;
    department?: string;
    role?: string;
    employee_id?: string;
    phone?: string;
    joining_date?: string;
}

interface PayslipRecord {
    id: string;
    month: number;
    year: number;
    basic_salary: number;
    increment: number;
    incentive: number;
    lop_days: number;
    lop_amount: number;
    tds: number;
    days_in_month: number;
    selected_days: number;
    net_pay: number;
    paid_at?: string;
    status: string;
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
const TABS = ['Personal Info', 'Payroll', 'Time Management'];
const PAY_ELEMENTS = [
    { key: 'basic_salary', label: 'Basic Salary', category: 'Salary',    catBg: '#EFF6FF', catText: '#2563EB', color: '#2563EB', type: 'earning' },
    { key: 'incentive',    label: 'Incentive',    category: 'Incentive', catBg: '#F0FDF4', catText: '#16A34A', color: '#16A34A', type: 'earning' },
    { key: 'increment',    label: 'Increment',    category: 'Increment', catBg: '#FFFBEB', catText: '#D97706', color: '#D97706', type: 'earning' },
    { key: 'tds',          label: 'TDS (Tax)',    category: 'Tax',       catBg: '#FEF2F2', catText: '#DC2626', color: '#DC2626', type: 'deduction' },
    { key: 'lop_amount',   label: 'Loss of Pay',  category: 'LOP',       catBg: '#FEF2F2', catText: '#DC2626', color: '#DC2626', type: 'deduction' },
];

function fmt(n: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n);
}
function fmtFull(n: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);
}
function getInitials(name?: string) {
    if (!name) return 'U';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

// ─── Time Management Tab ──────────────────────────────────────────────────────
function TimeManagementTab({ dayStarts, leaveRequests, lopEntries, hourlyReports }: {
    dayStarts: any[]; leaveRequests: any[]; lopEntries: any[]; hourlyReports: any[];
}) {
    const presentDays = dayStarts.length;
    const lateDays    = hourlyReports.filter(r => r.is_late).length;
    const leavesTaken = leaveRequests.filter(l => l.status === 'approved').length;
    const lopCount    = lopEntries.length;

    const LEAVE_STATUS: Record<string, { label: string; color: string }> = {
        pending:  { label: 'Pending',  color: '#F59E0B' },
        approved: { label: 'Approved', color: '#10B981' },
        rejected: { label: 'Rejected', color: '#EF4444' },
    };

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Days Present (30d)', value: presentDays, icon: '✅', color: '#10B981' },
                    { label: 'Late Reports (30d)',  value: lateDays,    icon: '⏰', color: '#F59E0B' },
                    { label: 'Leaves Approved',     value: leavesTaken, icon: '🗓️',  color: '#3B82F6' },
                    { label: 'LOP Entries',         value: lopCount,    icon: '⚠️',  color: '#EF4444' },
                ].map(card => (
                    <div key={card.label} className="rounded-2xl p-4" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                        <p className="text-xl mb-1">{card.icon}</p>
                        <p className="text-2xl font-black" style={{ color: card.color }}>{card.value}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>{card.label}</p>
                    </div>
                ))}
            </div>

            {/* Attendance (Day Starts) */}
            <div className="rounded-2xl p-5" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                <p className="text-sm font-black mb-3" style={{ color: '#374151' }}>
                    📅 Day Starts — Last 30 Days ({dayStarts.length} days)
                </p>
                {dayStarts.length === 0 ? (
                    <p className="text-xs text-center py-6" style={{ color: '#9CA3AF' }}>No day starts recorded in last 30 days</p>
                ) : (
                    <div className="grid grid-cols-7 gap-1.5">
                        {Array.from({ length: 30 }, (_, i) => {
                            const d = new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0];
                            const hasStart = dayStarts.some(s => s.date === d);
                            return (
                                <div key={d} title={d}
                                    className="h-7 rounded-md flex items-center justify-center text-[10px] font-bold"
                                    style={{
                                        background: hasStart ? '#D1FAE5' : '#F3F4F6',
                                        color: hasStart ? '#065F46' : '#D1D5DB',
                                        border: `1px solid ${hasStart ? '#6EE7B7' : '#E5E7EB'}`,
                                    }}>
                                    {new Date(d).getDate()}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Leave Requests */}
            <div className="rounded-2xl p-5" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                <p className="text-sm font-black mb-3" style={{ color: '#374151' }}>🏖️ Leave Requests</p>
                {leaveRequests.length === 0 ? (
                    <p className="text-xs text-center py-6" style={{ color: '#9CA3AF' }}>No leave requests found</p>
                ) : (
                    <div className="space-y-2">
                        {leaveRequests.map((l, i) => {
                            const cfg = LEAVE_STATUS[l.status] || { label: l.status, color: '#6B7280' };
                            return (
                                <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl"
                                    style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                                    <div>
                                        <p className="text-xs font-bold" style={{ color: '#111827' }}>
                                            {l.leave_type}
                                        </p>
                                        <p className="text-[11px] mt-0.5" style={{ color: '#6B7280' }}>
                                            {l.from_date} → {l.to_date}
                                        </p>
                                        {l.reason && (
                                            <p className="text-[10px] mt-0.5 italic truncate max-w-[220px]" style={{ color: '#9CA3AF' }}>
                                                {l.reason}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                        style={{ background: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
                                        {cfg.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* LOP Entries */}
            {lopEntries.length > 0 && (
                <div className="rounded-2xl p-5" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                    <p className="text-sm font-black mb-3" style={{ color: '#9A3412' }}>⚠️ Loss of Pay Entries ({lopEntries.length})</p>
                    <div className="space-y-2">
                        {lopEntries.map((l, i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl"
                                style={{ background: '#FFFFFF', border: '1px solid #FED7AA' }}>
                                <div>
                                    <p className="text-xs font-bold" style={{ color: '#111827' }}>{l.date}</p>
                                    <p className="text-[11px] mt-0.5" style={{ color: '#6B7280' }}>{l.lop_type || 'Absence'}</p>
                                </div>
                                <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{l.reason || '—'}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function HREmployeePayrollProfile() {
    const { profileId } = useParams<{ profileId: string }>();
    const navigate = useNavigate();

    const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
    const [payslips, setPayslips] = useState<PayslipRecord[]>([]);
    const [selectedPayslip, setSelectedPayslip] = useState<PayslipRecord | null>(null);
    const [lastLogin, setLastLogin] = useState<string | undefined>();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Payroll');
    const [timeData, setTimeData] = useState<{
        dayStarts: any[]; leaveRequests: any[]; lopEntries: any[]; hourlyReports: any[];
    }>({ dayStarts: [], leaveRequests: [], lopEntries: [], hourlyReports: [] });

    useEffect(() => {
        if (profileId) { fetchData(); }
    }, [profileId]);

    async function fetchData() {
        setLoading(true);
        try {
            // Fetch employee profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, name, email, department, role, employee_id, phone, joining_date')
                .eq('id', profileId)
                .maybeSingle();

            if (profile) setEmployee(profile);

            // Fetch last login
            const { data: loginData } = await supabase
                .from('day_start')
                .select('submitted_at')
                .eq('employee_id', profileId)
                .order('submitted_at', { ascending: false })
                .limit(1);
            if (loginData?.[0]) {
                setLastLogin(format(new Date(loginData[0].submitted_at), 'dd MMM yyyy, hh:mm a'));
            }

            // Fetch payslip history
            const { data: batchEmps, error } = await supabase
                .from('salary_batch_employees')
                .select(`
                    id, basic_salary, increment, incentive,
                    lop_days, lop_amount, tds,
                    days_in_month, selected_days, net_pay, status,
                    salary_batches!inner(month, year, paid_at, status)
                `)
                .or(`profile_id.eq.${profileId},employee_id.eq.${profileId}`)
                .order('created_at', { ascending: false });

            if (!error && batchEmps) {
                const records: PayslipRecord[] = batchEmps
                    .filter((b: any) => ['Paid', 'PAID', 'Paid Already'].includes(b.status || b.salary_batches?.status))
                    .map((b: any) => ({
                        id: b.id,
                        month: b.salary_batches.month,
                        year: b.salary_batches.year,
                        basic_salary: b.basic_salary || 0,
                        increment: b.increment || 0,
                        incentive: b.incentive || 0,
                        lop_days: b.lop_days || 0,
                        lop_amount: b.lop_amount || 0,
                        tds: b.tds || 0,
                        days_in_month: b.days_in_month || 30,
                        selected_days: b.selected_days || 30,
                        net_pay: b.net_pay || 0,
                        paid_at: b.salary_batches.paid_at,
                        status: b.status || b.salary_batches.status,
                    }));
                setPayslips(records);
                if (records.length > 0) setSelectedPayslip(records[0]);
            }

            // ── Time Management data ──────────────────────────────────
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const [dsRes, lrRes, lopRes, hrRes] = await Promise.allSettled([
                supabase.from('day_starts').select('date, submitted_at, location').eq('user_id', profileId!).gte('date', thirtyDaysAgo).order('date', { ascending: false }),
                supabase.from('leave_requests').select('leave_type, from_date, to_date, status, reason, created_at').eq('user_id', profileId!).order('created_at', { ascending: false }).limit(20),
                (supabase as any).from('lop_entries').select('date, reason, lop_type, created_at').eq('user_id', profileId!).order('date', { ascending: false }).limit(30),
                supabase.from('hourly_reports').select('date, slot, is_late').eq('user_id', profileId!).gte('date', thirtyDaysAgo).order('date', { ascending: false }),
            ]);
            setTimeData({
                dayStarts:     dsRes.status  === 'fulfilled' ? (dsRes.value.data  || []) : [],
                leaveRequests: lrRes.status  === 'fulfilled' ? (lrRes.value.data  || []) : [],
                lopEntries:    lopRes.status === 'fulfilled' ? (lopRes.value.data || []) : [],
                hourlyReports: hrRes.status  === 'fulfilled' ? (hrRes.value.data  || []) : [],
            });
        } catch (e) {
            toast.error('Failed to load employee data');
        } finally {
            setLoading(false);
        }
    }

    // ── Profile Header ─────────────────────────────────────────────────────
    function ProfileHeader() {
        const name = employee?.name || 'Employee';
        const msSinceJoined = employee?.joining_date
            ? Math.floor((Date.now() - new Date(employee.joining_date).getTime()) / (1000 * 60 * 60 * 24 * 365))
            : null;

        return (
            <div className="rounded-2xl p-5 mb-5"
                style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div className="flex items-start gap-5">
                    {/* Avatar */}
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black shrink-0"
                        style={{ background: 'linear-gradient(135deg, #EFF6FF, #BFDBFE)', color: '#2563EB', border: '2.5px solid #BFDBFE' }}>
                        {getInitials(name)}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                            <h2 className="text-xl font-black" style={{ color: '#111827' }}>{name}</h2>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: '#DCFCE7', color: '#16A34A' }}>● Active</span>
                            {msSinceJoined !== null && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: '#EFF6FF', color: '#2563EB' }}>
                                    {msSinceJoined}y tenure
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-5 text-xs" style={{ color: '#6B7280' }}>
                            {employee?.employee_id && (
                                <span className="flex items-center gap-1.5">
                                    <User className="w-3 h-3" /> #{employee.employee_id}
                                </span>
                            )}
                            {employee?.department && (
                                <span className="flex items-center gap-1.5">
                                    <Building className="w-3 h-3" /> {employee.department}
                                </span>
                            )}
                            {employee?.role && (
                                <span className="flex items-center gap-1.5">
                                    <Briefcase className="w-3 h-3" /> {employee.role}
                                </span>
                            )}
                            {employee?.email && (
                                <span className="flex items-center gap-1.5">
                                    <Mail className="w-3 h-3" /> {employee.email}
                                </span>
                            )}
                            {lastLogin && (
                                <span className="flex items-center gap-1.5">
                                    <Clock className="w-3 h-3" /> Last Login: {lastLogin}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Stats right */}
                    <div className="hidden md:flex gap-6 shrink-0">
                        <div className="text-right">
                            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Payslips</p>
                            <p className="text-2xl font-black" style={{ color: '#111827' }}>{payslips.length}</p>
                        </div>
                        {selectedPayslip && (
                            <div className="text-right">
                                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Last Net Pay</p>
                                <p className="text-2xl font-black" style={{ color: '#2563EB' }}>{fmt(selectedPayslip.net_pay)}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tab bar */}
                <div className="flex gap-1 mt-4 pt-4" style={{ borderTop: '1px solid #F3F4F6' }}>
                    {TABS.map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                            style={activeTab === tab
                                ? { background: '#EFF6FF', color: '#2563EB' }
                                : { color: '#6B7280' }}>
                            {tab}
                            {tab === 'Payroll' && payslips.length > 0 && (
                                <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full"
                                    style={{ background: '#DBEAFE', color: '#2563EB' }}>{payslips.length}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // ── Personal Info Tab ──────────────────────────────────────────────────
    function PersonalInfoTab() {
        const fields = [
            { label: 'Full Name', value: employee?.name, icon: User },
            { label: 'Employee ID', value: employee?.employee_id ? `#${employee.employee_id}` : '—', icon: CreditCard },
            { label: 'Department', value: employee?.department, icon: Building },
            { label: 'Role / Designation', value: employee?.role, icon: Briefcase },
            { label: 'Email', value: employee?.email, icon: Mail },
            { label: 'Phone', value: employee?.phone || '—', icon: Phone },
            { label: 'Joining Date', value: employee?.joining_date ? format(new Date(employee.joining_date), 'dd MMMM yyyy') : '—', icon: Calendar },
            { label: 'Last Login', value: lastLogin || '—', icon: Clock },
        ];
        return (
            <div className="rounded-2xl overflow-hidden"
                style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div className="px-5 py-3.5" style={{ borderBottom: '1px solid #F3F4F6', background: '#F9FAFB' }}>
                    <p className="text-xs font-black uppercase tracking-wider" style={{ color: '#374151' }}>Personal Information</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2">
                    {fields.map((f, i) => {
                        const Icon = f.icon;
                        return (
                            <div key={f.label} className="flex items-center gap-3 px-5 py-4"
                                style={{ borderBottom: i < fields.length - 2 ? '1px solid #F9FAFB' : 'none' }}>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ background: '#EFF6FF' }}>
                                    <Icon className="w-4 h-4" style={{ color: '#2563EB' }} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>{f.label}</p>
                                    <p className="text-sm font-semibold mt-0.5" style={{ color: '#111827' }}>{f.value || '—'}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ── Payroll Tab ────────────────────────────────────────────────────────
    function PayrollTab() {
        if (payslips.length === 0) {
            return (
                <div className="flex flex-col items-center py-20 rounded-2xl"
                    style={{ background: '#F9FAFB', border: '1px dashed #D1D5DB' }}>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: '#EFF6FF' }}>
                        <FileText className="w-7 h-7" style={{ color: '#93C5FD' }} />
                    </div>
                    <p className="text-sm font-bold" style={{ color: '#374151' }}>No payslips found</p>
                    <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>No paid salary records for this employee yet.</p>
                </div>
            );
        }

        const p = selectedPayslip!;
        const deductions = p.lop_amount + p.tds;
        const gross = p.basic_salary + p.incentive + p.increment;
        const segTotal = gross + deductions;
        const paidDays = p.selected_days - p.lop_days;

        const chartData = [...payslips].reverse().slice(-6).map(ps => ({
            name: `${MONTHS[ps.month - 1].slice(0, 3)} '${String(ps.year).slice(2)}`,
            'Net Pay': ps.net_pay,
            'Basic': ps.basic_salary,
        }));

        return (
            <div className="space-y-4">
                {/* Month selector pills */}
                <div className="flex flex-wrap gap-2">
                    {payslips.map(ps => (
                        <button key={ps.id} onClick={() => setSelectedPayslip(ps)}
                            className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                            style={selectedPayslip?.id === ps.id
                                ? { background: '#2563EB', color: '#FFFFFF' }
                                : { background: '#F1F5F9', color: '#6B7280' }}>
                            {MONTHS[ps.month - 1].slice(0, 3)} {ps.year}
                        </button>
                    ))}
                </div>

                {/* Payroll summary card */}
                <div className="rounded-2xl p-5"
                    style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

                    {/* Period header */}
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#9CA3AF' }}>Pay Period</p>
                            <p className="text-sm font-bold" style={{ color: '#374151' }}>
                                1 {MONTHS[p.month - 1]} {p.year} — {p.days_in_month} {MONTHS[p.month - 1]} {p.year}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs" style={{ color: '#6B7280' }}>
                                Working: <strong style={{ color: '#111827' }}>{p.days_in_month}d</strong>
                            </span>
                            <span className="text-xs" style={{ color: '#6B7280' }}>
                                Paid: <strong style={{ color: '#111827' }}>{paidDays}d</strong>
                            </span>
                            {p.lop_days > 0 && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: '#FEF2F2', color: '#DC2626' }}>
                                    {p.lop_days} LOP days
                                </span>
                            )}
                            {p.paid_at && (
                                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                                    style={{ background: '#DCFCE7', color: '#16A34A' }}>
                                    ✓ Paid {format(new Date(p.paid_at), 'dd MMM yyyy')}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Breakdown summary row */}
                    <div className="flex flex-wrap gap-6 mb-4">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#9CA3AF' }}>Total Pay</p>
                            <p className="text-2xl font-black" style={{ color: '#111827' }}>{fmtFull(p.net_pay)}</p>
                        </div>
                        {[
                            { label: 'Salary', val: p.basic_salary, color: '#2563EB' },
                            { label: 'Incentive', val: p.incentive, color: '#16A34A' },
                            { label: 'Increment', val: p.increment, color: '#D97706' },
                            { label: 'Deductions', val: deductions, color: '#DC2626' },
                        ].filter(s => s.val > 0).map(seg => (
                            <div key={seg.label} className="flex items-start gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0" style={{ background: seg.color }} />
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>{seg.label}</p>
                                    <p className="text-sm font-bold" style={{ color: '#111827' }}>{fmt(seg.val)}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Proportional bar */}
                    <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                        {[
                            { v: p.basic_salary, c: '#2563EB' },
                            { v: p.incentive, c: '#16A34A' },
                            { v: p.increment, c: '#D97706' },
                            { v: deductions, c: '#DC2626' },
                        ].map((s, i) => s.v > 0 && (
                            <div key={i} style={{ flex: s.v, background: s.c }} />
                        ))}
                    </div>
                </div>

                {/* Pay Element Totals Table */}
                <div className="rounded-2xl overflow-hidden"
                    style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div className="flex items-center justify-between px-5 py-3.5"
                        style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" style={{ color: '#2563EB' }} />
                            <span className="text-sm font-bold" style={{ color: '#111827' }}>Pay Element Totals</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: '#EFF6FF', color: '#2563EB' }}>
                            {MONTHS[p.month - 1]} {p.year}
                        </span>
                    </div>

                    {/* Column headers */}
                    <div className="grid px-5 py-2.5"
                        style={{ gridTemplateColumns: '2fr 1.2fr 1.4fr 1fr 1fr', borderBottom: '1px solid #F3F4F6', background: '#F9FAFB' }}>
                        {['Pay Element', 'Category', 'Amount', 'Type', 'Share'].map(h => (
                            <span key={h} className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#9CA3AF' }}>{h}</span>
                        ))}
                    </div>

                    {/* Rows */}
                    {PAY_ELEMENTS.map((el, i) => {
                        const amount = (p as any)[el.key] || 0;
                        if (amount === 0) return null;
                        const share = segTotal > 0 ? Math.round((amount / segTotal) * 100) : 0;
                        return (
                            <div key={el.key}
                                className="grid px-5 py-3.5 items-center hover:bg-[#F9FAFB] transition-colors"
                                style={{
                                    gridTemplateColumns: '2fr 1.2fr 1.4fr 1fr 1fr',
                                    borderBottom: '1px solid #F9FAFB'
                                }}>
                                <div className="flex items-center gap-2.5">
                                    <div className="w-1.5 h-5 rounded-full shrink-0" style={{ background: el.color }} />
                                    <span className="text-sm font-semibold" style={{ color: '#111827' }}>{el.label}</span>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full w-fit"
                                    style={{ background: el.catBg, color: el.catText }}>
                                    {el.category}
                                </span>
                                <span className="text-sm font-bold"
                                    style={{ color: el.type === 'deduction' ? '#DC2626' : '#111827' }}>
                                    {el.type === 'deduction' ? '-' : ''}{fmtFull(amount)}
                                </span>
                                <div className="flex items-center gap-1">
                                    {el.type === 'earning'
                                        ? <TrendingUp className="w-3.5 h-3.5" style={{ color: '#16A34A' }} />
                                        : <TrendingDown className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />}
                                    <span className="text-[10px] font-bold"
                                        style={{ color: el.type === 'earning' ? '#16A34A' : '#DC2626' }}>
                                        {el.type}
                                    </span>
                                </div>
                                {/* Share bar */}
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                                        <div className="h-full rounded-full" style={{ width: `${share}%`, background: el.color }} />
                                    </div>
                                    <span className="text-[9px] font-bold w-6 text-right" style={{ color: '#9CA3AF' }}>{share}%</span>
                                </div>
                            </div>
                        );
                    })}

                    {/* Gross footer */}
                    <div className="grid px-5 py-4 items-center"
                        style={{ gridTemplateColumns: '2fr 1.2fr 1.4fr 1fr 1fr', background: '#F9FAFB', borderTop: '2px solid #E5E7EB' }}>
                        <span className="text-sm font-black" style={{ color: '#111827' }}>Gross Earnings</span>
                        <span />
                        <span className="text-sm font-black" style={{ color: '#16A34A' }}>{fmtFull(gross)}</span>
                        <span /><span />
                    </div>
                </div>

                {/* Net Pay */}
                <div className="rounded-2xl p-5 flex items-center justify-between"
                    style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', border: '1px solid #BFDBFE' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#2563EB' }}>
                            <Wallet className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: '#2563EB' }}>Net Pay (Take Home)</p>
                            <p className="text-3xl font-black" style={{ color: '#1E3A8A' }}>{fmtFull(p.net_pay)}</p>
                        </div>
                    </div>
                    <div className="text-right hidden md:block">
                        <p className="text-xs" style={{ color: '#3B82F6' }}>
                            Gross <strong>{fmtFull(gross)}</strong> − Deductions <strong style={{ color: '#DC2626' }}>{fmtFull(deductions)}</strong>
                        </p>
                        <p className="text-xs mt-1" style={{ color: '#3B82F6' }}>
                            {paidDays}/{p.days_in_month} days paid • {MONTHS[p.month - 1]} {p.year}
                        </p>
                    </div>
                </div>

                {/* Salary trend chart */}
                {chartData.length > 1 && (
                    <div className="rounded-2xl p-5"
                        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                        <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#9CA3AF' }}>
                            Salary Trend (last {chartData.length} months)
                        </p>
                        <div style={{ height: 130 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 9, fill: '#D1D5DB' }} axisLine={false} tickLine={false}
                                        tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip formatter={(v: any) => [fmtFull(v)]}
                                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E5E7EB' }} />
                                    <Bar dataKey="Net Pay" fill="#2563EB" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Basic" fill="#BFDBFE" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-4xl mx-auto px-4 py-6">
            {/* Back button */}
            <button onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-sm font-semibold mb-5 transition-colors hover:text-primary"
                style={{ color: '#6B7280' }}>
                <ArrowLeft className="w-4 h-4" /> Back
            </button>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="ml-3 text-sm" style={{ color: '#6B7280' }}>Loading employee profile…</span>
                </div>
            ) : (
                <>
                    <ProfileHeader />
                    {activeTab === 'Personal Info' && <PersonalInfoTab />}
                    {activeTab === 'Payroll' && <PayrollTab />}
                    {activeTab === 'Time Management' && (
                        <TimeManagementTab
                            dayStarts={timeData.dayStarts}
                            leaveRequests={timeData.leaveRequests}
                            lopEntries={timeData.lopEntries}
                            hourlyReports={timeData.hourlyReports}
                        />
                    )}
                </>
            )}
        </div>
    );
}
