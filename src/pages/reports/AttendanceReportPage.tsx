import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, Download, Search, RefreshCw, Users, Clock, CheckCircle2, LogIn } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export default function AttendanceReportPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [downloading, setDownloading] = useState(false);

  const { data: records = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['attendance-report', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('selfie_records')
        .select(`
          id, selfie_type, created_at, date,
          employee:profiles(name, role, department)
        `)
        .eq('date', date)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Group by employee — pair login with logout
  const employees = useMemo(() => {
    const map: Record<string, any> = {};
    records.forEach((r: any) => {
      const id = r.employee_id || r.id;
      const name = r.employee?.name || 'Unknown';
      const key = name + '_' + (r.employee?.role || '');
      if (!map[key]) {
        map[key] = {
          name,
          role: r.employee?.role || '—',
          department: r.employee?.department || '—',
          loginTime: null,
          logoutTime: null,
        };
      }
      if (r.selfie_type === 'morning_login' || r.selfie_type === 'check_in') {
        map[key].loginTime = r.created_at;
      }
      if (r.selfie_type === 'evening_logout' || r.selfie_type === 'check_out') {
        map[key].logoutTime = r.created_at;
      }
    });
    return Object.values(map);
  }, [records]);

  const roles = useMemo(() => {
    const rs = [...new Set(employees.map((e: any) => e.role).filter(Boolean))];
    return rs.sort() as string[];
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter((e: any) => {
      const matchSearch = !q ||
        (e.name || '').toLowerCase().includes(q) ||
        (e.department || '').toLowerCase().includes(q) ||
        (e.role || '').toLowerCase().includes(q);
      const matchRole = roleFilter === 'all' || e.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [employees, search, roleFilter]);

  const summary = useMemo(() => ({
    total:    filtered.length,
    loggedIn: filtered.filter((e: any) => e.loginTime).length,
    complete: filtered.filter((e: any) => e.loginTime && e.logoutTime).length,
    selfies:  records.length,
  }), [filtered, records]);

  const downloadXLSX = async () => {
    if (!filtered.length) { toast.error('No data to download'); return; }
    setDownloading(true);
    try {
      const rows = filtered.map((e: any) => ({
        'Employee':    e.name,
        'Role':        e.role?.replace(/_/g, ' ') || '—',
        'Department':  e.department || '—',
        'Login Time':  e.loginTime ? format(new Date(e.loginTime), 'hh:mm a') : '—',
        'Logout Time': e.logoutTime ? format(new Date(e.logoutTime), 'hh:mm a') : '—',
        'Date':        date,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [20, 16, 14, 12, 12, 12].map(w => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      XLSX.writeFile(wb, `FF_Attendance_Report_${date}.xlsx`);
      toast.success('Attendance report downloaded!');
    } catch (e: any) { toast.error(e.message); }
    finally { setDownloading(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 font-medium">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div>
            <h1 className="text-xl font-black text-gray-900">Attendance Report</h1>
            <p className="text-xs text-gray-400 mt-0.5">Daily login times · selfie check-ins · EOD rate</p>
          </div>
        </div>
        <button onClick={downloadXLSX} disabled={downloading || !filtered.length}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold shadow-sm disabled:opacity-50">
          {downloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50" />
          </div>
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search employee name, role, department..."
              className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50" />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50">
            <option value="all">All Roles</option>
            {roles.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
          </select>
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Employees', value: summary.total,    icon: Users,       color: 'bg-amber-50 text-amber-600' },
          { label: 'Logged In',       value: summary.loggedIn, icon: LogIn,       color: 'bg-blue-50 text-blue-600' },
          { label: 'Complete Day',    value: summary.complete, icon: CheckCircle2, color: 'bg-green-50 text-green-600' },
          { label: 'Total Selfies',   value: summary.selfies,  icon: Clock,       color: 'bg-purple-50 text-purple-600' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.color}`}>
              <c.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-black text-gray-900">{c.value}</p>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-black text-gray-900">Attendance — {format(new Date(date + 'T00:00:00'), 'dd MMMM yyyy')}</p>
          <p className="text-xs text-gray-400">{filtered.length} employees</p>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin text-amber-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Users className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-semibold">No attendance records found</p>
            <p className="text-xs mt-1">Try a different date</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Employee','Role','Department','Login Time','Logout Time','Status'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-[11px] font-black uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((e: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-gray-900">{e.name}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs capitalize">{(e.role || '').replace(/_/g, ' ')}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{e.department}</td>
                    <td className="py-3 px-4">
                      {e.loginTime ? (
                        <span className="text-green-600 font-bold text-xs">{format(new Date(e.loginTime), 'hh:mm a')}</span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      {e.logoutTime ? (
                        <span className="text-blue-600 font-bold text-xs">{format(new Date(e.logoutTime), 'hh:mm a')}</span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      {e.loginTime && e.logoutTime ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Complete</span>
                      ) : e.loginTime ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">In Progress</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">Absent</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
