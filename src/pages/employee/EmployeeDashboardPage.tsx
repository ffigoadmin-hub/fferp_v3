import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useDayStart } from '@/hooks/useDayStart';
import { useDayPlan } from '@/hooks/useDayPlan';
import { useHourlyReports } from '@/hooks/useHourlyReports';
import { useEODReport } from '@/hooks/useEODReport';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import {
    LogIn, ClipboardList, Timer, FileText, Check, ChevronRight,
    CreditCard, Calendar, MessageSquare, Clock, Zap,
    LogIn as CheckInIcon, LogOut as CheckOutIcon, Timer as HoursIcon,
    CalendarDays
} from 'lucide-react';

const AVATAR_BG = ['#EFF6FF', '#F0FDF4', '#FEF3C7', '#FEE2E2', '#F3E8FF', '#E0F2FE'];
const AVATAR_TEXT = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0284C7'];
function getAvatarColors(name?: string): [string, string] {
    const idx = (name?.charCodeAt(0) || 0) % AVATAR_BG.length;
    return [AVATAR_TEXT[idx], AVATAR_BG[idx]];
}
function getInitials(name?: string) {
    if (!name) return 'U';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

const TOTAL_SLOTS = 8;

const STATUS_COLORS: Record<string, string> = {
    approved: 'bg-green-500/10 text-green-600 border-green-500/20',
    pending_hr: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    pending_admin: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    pending_ceo: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
    paid: 'bg-green-500/10 text-green-600 border-green-500/20',
    pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    draft: 'bg-muted text-muted-foreground border-border',
};

// Placeholder weekly data — replace with real hook when available
const weeklyAttendance = [
    { day: 'Mon', pct: 52 },
    { day: 'Tue', pct: 75 },
    { day: 'Wed', pct: 68 },
    { day: 'Thu', pct: 74 },
    { day: 'Fri', pct: 70 },
    { day: 'Sat', pct: 55 },
    { day: 'Sun', pct: 90 },
];

export function EmployeeDashboardPage() {
    const today = new Date();
    const { user } = useAuth();
    const navigate = useNavigate();

    const { dayStart } = useDayStart(today);
    const { dayPlan } = useDayPlan(today);
    const { reports } = useHourlyReports(today);
    const { eodReport } = useEODReport(today);
    const { requests: leaveRequests } = useLeaveRequests();
    const { requests: paymentRequests } = usePaymentRequests();

    const myLeave = (leaveRequests || [])
        .filter((r: any) => r.employee_id === user?.id || !r.employee_id)
        .slice(0, 3);

    const myPayments = (paymentRequests || [])
        .filter((r: any) => r.requester_id === user?.id || !r.requester_id)
        .slice(0, 3);

    const steps = [
        { icon: LogIn, label: 'Login', done: !!dayStart, path: '/day-start', note: dayStart?.login_status || '' },
        { icon: ClipboardList, label: 'Day Plan', done: !!dayPlan, path: '/day-plan', note: dayPlan ? `${dayPlan.tasks?.length || 0} tasks` : '' },
        { icon: Timer, label: 'Hourly', done: false, path: '/hourly-report', note: `${reports?.length || 0}/${TOTAL_SLOTS} slots`, partial: true },
        { icon: FileText, label: 'EOD', done: !!eodReport, path: '/eod-summary', note: eodReport ? `${eodReport.completion_percentage || 0}%` : '' },
    ];

    const currentStepIdx = steps.findIndex(s => !s.done && !s.partial) === -1
        ? 3
        : steps.findIndex(s => !s.done);

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const [avatarText, avatarBg] = getAvatarColors(user?.name);
    const checkInTime = dayStart?.submitted_at
        ? format(new Date(dayStart.submitted_at), 'hh:mm a')
        : null;
    const isLate = dayStart?.login_status?.toLowerCase().includes('late');

    // Circular SVG attendance ring
    const attendancePct = dayStart ? 78 : 0;
    const circumference = 2 * Math.PI * 42; // r=42
    const dashOffset = circumference * (1 - attendancePct / 100);

    return (
        <div className="max-w-5xl mx-auto px-4 py-6">
            <div className="flex gap-6 items-start">

                {/* ── Left column ── */}
                <div className="flex-1 min-w-0 space-y-6">

                    {/* Greeting + Avatar */}
                    <div className="flex items-center gap-4">
                        {/* Profile avatar circle */}
                        <div
                            className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black shrink-0 shadow-md"
                            style={{ background: `linear-gradient(135deg, ${avatarBg}, ${avatarText}22)`, color: avatarText, border: `2.5px solid ${avatarText}33` }}
                        >
                            {getInitials(user?.name)}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">
                                {greeting()}, {user?.name?.split(' ')[0] || 'there'} 👋
                            </h1>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {format(today, 'EEEE, d MMMM yyyy')}
                            </p>
                        </div>
                    </div>

                    {/* Today's Workflow Stepper */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                                <Zap className="w-4 h-4 text-primary" /> Today's Workflow
                            </h2>
                            <span className="text-xs text-muted-foreground">
                                {steps.filter(s => s.done).length}/{steps.length} done
                            </span>
                        </div>

                        <div className="flex items-start gap-0">
                            {steps.map((step, idx) => {
                                const isCurrent = idx === currentStepIdx && !step.done;
                                const StepIcon = step.icon;
                                return (
                                    <div key={step.label} className="flex-1 flex flex-col items-center gap-1.5">
                                        <div className="flex items-center w-full">
                                            {idx > 0 && (
                                                <div className={cn("flex-1 h-0.5 transition-colors", steps[idx - 1].done ? "bg-primary" : "bg-border")} />
                                            )}
                                            <button
                                                onClick={() => navigate(step.path)}
                                                className={cn(
                                                    "w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                                                    step.done ? "bg-primary border-primary text-primary-foreground"
                                                        : isCurrent ? "border-primary text-primary bg-primary/10 animate-pulse"
                                                            : "border-border text-muted-foreground bg-background"
                                                )}
                                            >
                                                {step.done ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                                            </button>
                                            {idx < steps.length - 1 && (
                                                <div className={cn("flex-1 h-0.5 transition-colors", step.done ? "bg-primary" : "bg-border")} />
                                            )}
                                        </div>
                                        <span className={cn("text-[10px] font-bold text-center",
                                            step.done ? "text-primary" : isCurrent ? "text-primary" : "text-muted-foreground")}>
                                            {step.label}
                                        </span>
                                        {step.note && (
                                            <span className="text-[9px] text-muted-foreground/70 text-center">{step.note}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {currentStepIdx < steps.length && (
                            <div className="mt-4 pt-4 border-t border-border/50">
                                <Button className="w-full gap-2" onClick={() => navigate(steps[currentStepIdx].path)}>
                                    {(() => { const Icon = steps[currentStepIdx].icon; return <Icon className="w-4 h-4" />; })()}
                                    Continue: {steps[currentStepIdx].label}
                                    <ChevronRight className="w-4 h-4 ml-auto" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Pending Requests */}
                    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                        <div className="flex border-b border-border">
                            <div className="flex-1 px-5 py-3 border-r border-border">
                                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-primary" /> Leave Requests
                                </h2>
                            </div>
                            <div className="flex-1 px-5 py-3">
                                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <CreditCard className="w-3.5 h-3.5 text-primary" /> Payment Requests
                                </h2>
                            </div>
                        </div>
                        <div className="flex">
                            <div className="flex-1 border-r border-border divide-y divide-border/50">
                                {myLeave.length === 0 ? (
                                    <div className="px-5 py-4 text-xs text-muted-foreground">No leave requests</div>
                                ) : myLeave.map((r: any) => (
                                    <div key={r.id} className="px-4 py-3">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <span className="text-xs font-medium text-foreground truncate">{r.leave_type?.name || 'Leave'}</span>
                                            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 shrink-0", STATUS_COLORS[r.status] || STATUS_COLORS.pending)}>
                                                {r.status?.replace(/_/g, ' ')}
                                            </Badge>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            {r.start_date && format(new Date(r.start_date), 'd MMM')}
                                            {r.end_date && r.end_date !== r.start_date && ` – ${format(new Date(r.end_date), 'd MMM')}`}
                                        </p>
                                    </div>
                                ))}
                                <button onClick={() => navigate('/leave-request')}
                                    className="w-full px-4 py-2.5 text-[10px] font-bold text-primary hover:bg-primary/5 transition-colors flex items-center gap-1">
                                    + Apply for Leave <ChevronRight className="w-3 h-3 ml-auto" />
                                </button>
                            </div>
                            <div className="flex-1 divide-y divide-border/50">
                                {myPayments.length === 0 ? (
                                    <div className="px-5 py-4 text-xs text-muted-foreground">No payment requests</div>
                                ) : myPayments.map((r: any) => (
                                    <div key={r.id} className="px-4 py-3">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <span className="text-xs font-medium text-foreground truncate">{r.purpose?.slice(0, 20) || 'Payment'}</span>
                                            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 shrink-0", STATUS_COLORS[r.status] || STATUS_COLORS.pending)}>
                                                {r.status?.replace(/_/g, ' ')}
                                            </Badge>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            {r.amount ? `₹${Number(r.amount).toLocaleString('en-IN')}` : '—'}
                                        </p>
                                    </div>
                                ))}
                                <button onClick={() => navigate('/payment-request')}
                                    className="w-full px-4 py-2.5 text-[10px] font-bold text-primary hover:bg-primary/5 transition-colors flex items-center gap-1">
                                    + Raise Payment <ChevronRight className="w-3 h-3 ml-auto" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-3 gap-3">
                        <button onClick={() => navigate('/payment-request')}
                            className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition-all">
                            <CreditCard className="w-5 h-5 text-primary" />
                            <span className="text-xs font-bold text-foreground text-center">Raise Payment</span>
                        </button>
                        <button onClick={() => navigate('/leave-request')}
                            className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition-all">
                            <Calendar className="w-5 h-5 text-primary" />
                            <span className="text-xs font-bold text-foreground text-center">Apply Leave</span>
                        </button>
                        <button onClick={() => navigate('/chat')}
                            className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition-all">
                            <MessageSquare className="w-5 h-5 text-primary" />
                            <span className="text-xs font-bold text-foreground text-center">Go to Chat</span>
                        </button>
                    </div>

                    <button onClick={() => navigate('/my-requests')}
                        className="w-full text-xs text-muted-foreground hover:text-primary transition-colors py-2 flex items-center justify-center gap-1">
                        View all my requests <ChevronRight className="w-3 h-3" />
                    </button>
                </div>

                {/* ── Right column ── */}
                <div className="w-72 shrink-0 space-y-4">

                    {/* Attendance Overview card */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                        <h2 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">
                            Attendance Overview
                        </h2>

                        {/* Ring + stats row */}
                        <div className="flex items-center gap-4 mb-5">
                            {/* Circular ring */}
                            <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
                                <svg width="88" height="88" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                                    <circle cx="50" cy="50" r="42" fill="none" stroke="#E5E7EB" strokeWidth="10" />
                                    <circle
                                        cx="50" cy="50" r="42" fill="none"
                                        stroke="#2563EB" strokeWidth="10"
                                        strokeDasharray={circumference}
                                        strokeDashoffset={dashOffset}
                                        strokeLinecap="round"
                                        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-lg font-black" style={{ color: '#111827' }}>
                                        {dayStart ? `${attendancePct}%` : '—'}
                                    </span>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <CheckInIcon className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                                        <span className="text-[11px] text-muted-foreground">Check In</span>
                                    </div>
                                    <span className="text-[11px] font-bold" style={{ color: checkInTime ? '#2563EB' : '#9CA3AF' }}>
                                        {checkInTime || '--:--'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <CheckOutIcon className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                                        <span className="text-[11px] text-muted-foreground">Check Out</span>
                                    </div>
                                    <span className="text-[11px] font-bold" style={{ color: '#9CA3AF' }}>--:--</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <HoursIcon className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                                        <span className="text-[11px] text-muted-foreground">Working Hrs</span>
                                    </div>
                                    <span className="text-[11px] font-bold" style={{ color: checkInTime ? '#2563EB' : '#9CA3AF' }}>
                                        {checkInTime ? `${reports?.length || 0}h` : '--'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                                        <span className="text-[11px] text-muted-foreground">Late</span>
                                    </div>
                                    <span className="text-[11px] font-bold" style={{ color: isLate ? '#DC2626' : '#2563EB' }}>
                                        {isLate ? 'Yes' : '0m'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Present Today label */}
                        <p className="text-[10px] text-center font-semibold mb-4" style={{ color: '#6B7280' }}>
                            Present Today
                        </p>

                        {/* Weekly chart */}
                        <div style={{ height: 110 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={weeklyAttendance} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                                    <XAxis
                                        dataKey="day"
                                        tick={{ fontSize: 9, fill: '#9CA3AF', fontWeight: 600 }}
                                        axisLine={false} tickLine={false}
                                    />
                                    <YAxis
                                        domain={[0, 100]}
                                        ticks={[0, 25, 50, 75, 100]}
                                        tick={{ fontSize: 8, fill: '#D1D5DB' }}
                                        axisLine={false} tickLine={false}
                                        tickFormatter={v => `${v}%`}
                                    />
                                    <Tooltip
                                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                                        formatter={(v: any) => [`${v}%`, 'Attendance']}
                                    />
                                    <Line
                                        type="monotone" dataKey="pct"
                                        stroke="#2563EB" strokeWidth={2}
                                        dot={{ fill: '#2563EB', r: 3, strokeWidth: 2, stroke: '#FFFFFF' }}
                                        activeDot={{ r: 5, fill: '#2563EB' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Upcoming Events */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                                Upcoming Events
                            </h2>
                            <button className="text-[10px] font-bold text-primary hover:underline">View all</button>
                        </div>
                        <div className="flex flex-col items-center py-5 text-center">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: '#EFF6FF' }}>
                                <CalendarDays className="w-6 h-6" style={{ color: '#2563EB' }} />
                            </div>
                            <p className="text-sm font-semibold" style={{ color: '#374151' }}>No upcoming events</p>
                            <p className="text-[11px] mt-1" style={{ color: '#9CA3AF' }}>You're all caught up!</p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
