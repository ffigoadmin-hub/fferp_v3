// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import {
  Users, LogIn, CalendarOff, Wallet, UserPlus, CalendarCheck,
  ClipboardList, Eye, FileText, Shield, CreditCard, Clock,
  TrendingUp, CheckCircle, AlertCircle, ChevronRight, Activity,
  Briefcase, CalendarDays,
} from 'lucide-react';

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-200 transition-all' : ''}`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black text-gray-900 leading-tight">{value ?? '—'}</p>
        <p className="text-xs font-semibold text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Quick Action Card ────────────────────────────────────────────────────────
function ActionCard({ icon: Icon, title, desc, color, badge, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm cursor-pointer hover:shadow-md hover:border-gray-200 transition-all group flex flex-col gap-3"
    >
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {badge != null && badge > 0 && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-600">
            {badge} pending
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-black text-gray-900">{title}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{desc}</p>
      </div>
      <div className="flex items-center gap-1 text-[11px] font-bold text-gray-400 group-hover:text-gray-700 transition-colors mt-auto">
        Open <ChevronRight className="w-3 h-3" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function HRDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  const [stats, setStats] = useState({
    totalEmployees: null,
    todayLogins: null,
    pendingLeaves: null,
    pendingSalary: null,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    const safe = (p: Promise<any>) => p.catch(() => ({ count: null, error: true }));

    const [empRes, loginRes, leaveRes, salaryRes] = await Promise.all([
      // Total employees (all profiles)
      safe(supabase.from('profiles').select('id', { count: 'exact', head: true })),
      // Today's check-ins
      safe(supabase.from('selfie_records').select('id', { count: 'exact', head: true })
        .eq('date', today).eq('selfie_type', 'morning_login')),
      // Pending leave requests
      safe(supabase.from('leave_requests').select('id', { count: 'exact', head: true })
        .eq('status', 'pending')),
      // Draft salary batches
      safe(supabase.from('salary_batches').select('id', { count: 'exact', head: true })
        .eq('status', 'Draft')),
    ]);

    setStats({
      totalEmployees: empRes.count ?? 0,
      todayLogins:    loginRes.count ?? 0,
      pendingLeaves:  leaveRes.count ?? 0,
      pendingSalary:  salaryRes.count ?? 0,
    });
  }

  const go = (path: string) => navigate(path);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-7">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">HR Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {format(new Date(), 'EEEE, dd MMMM yyyy')} · Welcome back, {user?.name?.split(' ')[0] || 'HR'}
          </p>
        </div>
        <button
          onClick={() => go('/onboarding/new-user')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold shadow-sm transition-colors"
        >
          <UserPlus className="w-4 h-4" /> Onboard Employee
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Employees"
          value={stats.totalEmployees}
          color="bg-blue-50 text-blue-600"
          onClick={() => go('/hr/employee-master')}
        />
        <StatCard
          icon={LogIn}
          label="Today's Logins"
          value={stats.todayLogins}
          sub={`as of ${format(new Date(), 'hh:mm a')}`}
          color="bg-green-50 text-green-600"
          onClick={() => go('/employee-activity')}
        />
        <StatCard
          icon={CalendarOff}
          label="Pending Leaves"
          value={stats.pendingLeaves}
          color="bg-amber-50 text-amber-600"
          onClick={() => go('/leave-approvals')}
        />
        <StatCard
          icon={Wallet}
          label="Salary Batches (Draft)"
          value={stats.pendingSalary}
          color="bg-purple-50 text-purple-600"
          onClick={() => go('/hr/payroll')}
        />
      </div>

      {/* Section: Attendance & Activity */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
          Attendance &amp; Activity
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <ActionCard
            icon={Activity}
            title="Employee Activity"
            desc="Live login tracking & daily status"
            color="bg-green-50 text-green-600"
            onClick={() => go('/employee-activity')}
          />
          <ActionCard
            icon={Eye}
            title="Selfie Attendance"
            desc="View morning check-in selfies"
            color="bg-sky-50 text-sky-600"
            onClick={() => go('/selfie-attendance')}
          />
          <ActionCard
            icon={CalendarDays}
            title="Attendance Roster"
            desc="Full attendance calendar & roster"
            color="bg-indigo-50 text-indigo-600"
            onClick={() => go('/admin/attendance-roster')}
          />
          <ActionCard
            icon={TrendingUp}
            title="Performance Hub"
            desc="Weekly targets & achievements"
            color="bg-orange-50 text-orange-600"
            onClick={() => go('/performance-hub')}
          />
        </div>
      </div>

      {/* Section: Leave & Time Off */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
          Leave &amp; Time Off
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <ActionCard
            icon={CalendarCheck}
            title="Leave Approvals"
            desc="Approve or reject leave requests"
            color="bg-amber-50 text-amber-600"
            badge={stats.pendingLeaves}
            onClick={() => go('/leave-approvals')}
          />
          <ActionCard
            icon={ClipboardList}
            title="LOP Management"
            desc="Track & manage loss of pay days"
            color="bg-red-50 text-red-600"
            onClick={() => go('/lop-management')}
          />
          <ActionCard
            icon={CalendarOff}
            title="Week Off Assignment"
            desc="Set weekly off days per employee"
            color="bg-violet-50 text-violet-600"
            onClick={() => go('/admin/week-off-management')}
          />
        </div>
      </div>

      {/* Section: Payroll & Salary */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
          Payroll &amp; Salary
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <ActionCard
            icon={Wallet}
            title="Payroll Management"
            desc="Generate & process monthly salary batches"
            color="bg-purple-50 text-purple-600"
            badge={stats.pendingSalary}
            onClick={() => go('/hr/payroll')}
          />
          <ActionCard
            icon={FileText}
            title="Salary Sheet"
            desc="View & export full salary sheets"
            color="bg-teal-50 text-teal-600"
            onClick={() => go('/hr/sheet')}
          />
          <ActionCard
            icon={CheckCircle}
            title="Salary Approval"
            desc="Approve payroll before release"
            color="bg-green-50 text-green-700"
            onClick={() => go('/hr/approval')}
          />
          <ActionCard
            icon={CreditCard}
            title="Payment Audit"
            desc="HR payment request audit trail"
            color="bg-slate-50 text-slate-600"
            onClick={() => go('/hr/payment-audit')}
          />
        </div>
      </div>

      {/* Section: Employee Management */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
          Employee Management
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <ActionCard
            icon={Users}
            title="Employee Master"
            desc="Full employee database & profiles"
            color="bg-blue-50 text-blue-600"
            onClick={() => go('/hr/employee-master')}
          />
          <ActionCard
            icon={Briefcase}
            title="Employee Profiles"
            desc="Detailed payroll profiles"
            color="bg-cyan-50 text-cyan-600"
            onClick={() => go('/admin/employee-profiles')}
          />
          <ActionCard
            icon={Users}
            title="Employee Directory"
            desc="Company-wide contact directory"
            color="bg-gray-50 text-gray-600"
            onClick={() => go('/employee-directory')}
          />
          <ActionCard
            icon={Shield}
            title="Salary Calculation"
            desc="Calculate & preview salary components"
            color="bg-rose-50 text-rose-600"
            onClick={() => go('/hr/salary-calculation')}
          />
        </div>
      </div>

      {/* Section: Onboarding */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
          Onboarding
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <ActionCard
            icon={UserPlus}
            title="New Employee"
            desc="Onboard & register a new team member"
            color="bg-emerald-50 text-emerald-600"
            onClick={() => go('/onboarding/new-user')}
          />
          <ActionCard
            icon={Clock}
            title="Onboarding Status"
            desc="Track & manage onboarding progress"
            color="bg-yellow-50 text-yellow-600"
            onClick={() => go('/onboarding/hr-access')}
          />
        </div>
      </div>

    </div>
  );
}
