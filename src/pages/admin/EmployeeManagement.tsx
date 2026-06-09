import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Plus, Search, Edit2, UserX, UserCheck, X, Loader2,
  Eye, EyeOff, Users, Building2, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ROLES = [
  'admin', 'ceo', 'gm', 'hr', 'accounts',
  'purchase_manager', 'purchase_head',
  'warehouse_manager', 'qc_manager',
  'field_executive', 'tele_caller',
  'driver', 'back_office', 'employee',
];

const DEPARTMENTS = [
  'Administration', 'Executive', 'Operations', 'HR',
  'Accounts', 'Purchase', 'Warehouse', 'Sales',
  'Logistics', 'CRM', 'General',
];

const ROLE_COLORS: Record<string, string> = {
  ceo: 'bg-purple-100 text-purple-700 border-purple-200',
  admin: 'bg-blue-100 text-blue-700 border-blue-200',
  gm: 'bg-sky-100 text-sky-700 border-sky-200',
  hr: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  accounts: 'bg-amber-100 text-amber-700 border-amber-200',
  purchase_manager: 'bg-orange-100 text-orange-700 border-orange-200',
  purchase_head: 'bg-orange-100 text-orange-700 border-orange-200',
  warehouse_manager: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  qc_manager: 'bg-teal-100 text-teal-700 border-teal-200',
  field_executive: 'bg-green-100 text-green-700 border-green-200',
  tele_caller: 'bg-lime-100 text-lime-700 border-lime-200',
  driver: 'bg-slate-100 text-slate-700 border-slate-200',
  back_office: 'bg-gray-100 text-gray-700 border-gray-200',
  employee: 'bg-gray-100 text-gray-600 border-gray-200',
};

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  office_number: string | null;
  is_active: boolean;
  status: string | null;
  created_at: string | null;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  role: string;
  department: string;
  office_number: string;
}

const EMPTY_FORM: FormData = {
  name: '', email: '', password: '', role: 'employee',
  department: 'General', office_number: '',
};

export default function EmployeeManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('profiles') as any)
        .select('id,name,email,role,department,office_number,is_active,status,created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Employee[];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase.from('profiles') as any)
        .update({ is_active, status: is_active ? 'active' : 'inactive' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { is_active }) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(is_active ? 'Employee activated' : 'Employee deactivated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const filtered = employees.filter(e => {
    const matchSearch = !search ||
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase()) ||
      e.office_number?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || e.role === roleFilter;
    return matchSearch && matchRole;
  });

  const openAdd = () => {
    setEditingEmployee(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setForm({
      name: emp.name, email: emp.email, password: '',
      role: emp.role, department: emp.department,
      office_number: emp.office_number || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    if (!editingEmployee && !form.password.trim()) {
      toast.error('Password is required for new employees');
      return;
    }

    setSaving(true);
    try {
      if (editingEmployee) {
        // Update existing profile
        const { error } = await (supabase.from('profiles') as any)
          .update({
            name: form.name.trim(),
            role: form.role,
            department: form.department,
            office_number: form.office_number.trim() || null,
          })
          .eq('id', editingEmployee.id);
        if (error) throw error;
        toast.success('Employee updated');
      } else {
        // Create auth user + profile via admin API workaround
        // Using signUp then immediately updating profile
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          options: { data: { name: form.name.trim() } },
        });
        if (authError) throw authError;
        if (!authData.user) throw new Error('User creation failed');

        // Insert profile
        const { error: profileError } = await (supabase.from('profiles') as any).insert({
          id: authData.user.id,
          email: form.email.trim().toLowerCase(),
          name: form.name.trim(),
          role: form.role,
          department: form.department,
          office_number: form.office_number.trim() || null,
          is_active: true,
          login_enabled: true,
          account_activated: true,
          onboarding_completed: true,
          status: 'active',
        });
        if (profileError) throw profileError;
        toast.success(`${form.name} added successfully`);
      }

      qc.invalidateQueries({ queryKey: ['employees'] });
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = employees.filter(e => e.is_active).length;
  const inactiveCount = employees.filter(e => !e.is_active).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Employee Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage staff accounts, roles and departments</p>
        </div>
        <Button onClick={openAdd} className="bg-green-600 hover:bg-green-700 gap-2">
          <Plus className="w-4 h-4" /> Add Employee
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Staff', value: employees.length, icon: Users, color: 'text-blue-600 bg-blue-50' },
          { label: 'Active', value: activeCount, icon: UserCheck, color: 'text-green-600 bg-green-50' },
          { label: 'Inactive', value: inactiveCount, icon: UserX, color: 'text-red-600 bg-red-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', s.color)}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, email or employee ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 border-gray-300"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Roles</option>
          {ROLES.map(r => (
            <option key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Users className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">No employees found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Employee', 'Role', 'Department', 'Emp ID', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(emp => (
                  <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                          <span className="text-green-700 text-xs font-bold">
                            {emp.name?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{emp.name}</p>
                          <p className="text-xs text-gray-400">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border uppercase tracking-wide', ROLE_COLORS[emp.role] || 'bg-gray-100 text-gray-600 border-gray-200')}>
                        {emp.role?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{emp.department}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{emp.office_number || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                        emp.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', emp.is_active ? 'bg-green-500' : 'bg-red-400')} />
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600" onClick={() => openEdit(emp)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className={cn('h-8 w-8 p-0', emp.is_active ? 'text-gray-500 hover:text-red-600' : 'text-gray-500 hover:text-green-600')}
                          onClick={() => toggleActive.mutate({ id: emp.id, is_active: !emp.is_active })}
                        >
                          {emp.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                  {editingEmployee ? <Edit2 className="w-4 h-4 text-green-600" /> : <Plus className="w-4 h-4 text-green-600" />}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{editingEmployee ? 'Edit Employee' : 'Add Employee'}</h3>
                  <p className="text-xs text-gray-500">{editingEmployee ? 'Update staff details' : 'Create a new staff account'}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-gray-700">Full Name *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Ravi Kumar" className="border-gray-300" />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label className="text-gray-700">Email *</Label>
                  <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="ravi@farmersfactory.com" type="email" disabled={!!editingEmployee}
                    className={cn('border-gray-300', editingEmployee && 'bg-gray-50 text-gray-400')} />
                </div>

                {!editingEmployee && (
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-gray-700">Password *</Label>
                    <div className="relative">
                      <Input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        type={showPassword ? 'text' : 'password'} placeholder="Min 6 characters" className="border-gray-300 pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-gray-700">Role *</Label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                    {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-gray-700">Department *</Label>
                  <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label className="text-gray-700">Employee ID</Label>
                  <Input value={form.office_number} onChange={e => setForm(f => ({ ...f, office_number: e.target.value }))}
                    placeholder="e.g. FF-EMP-001" className="border-gray-300" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-200">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : (editingEmployee ? 'Update' : 'Add Employee')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
