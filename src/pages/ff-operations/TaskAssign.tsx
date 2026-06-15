// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ClipboardList, Plus, Save, RefreshCw, CheckCircle2,
  Clock, AlertCircle, User, Target, MapPin, FileText,
  ChevronDown, ChevronUp, Calendar,
} from 'lucide-react';

const STATUS_COLORS = {
  pending:     'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  missed:      'bg-red-100 text-red-600',
};

function AssignModal({
  member,
  existing,
  hubId,
  onClose,
  onSave,
}: any) {
  const [form, setForm] = useState({
    order_target:  existing?.order_target  ?? 10,
    amount_target: existing?.amount_target ?? 10000,
    area_assigned: existing?.area_assigned ?? '',
    task_notes:    existing?.task_notes    ?? '',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">{member.name}</h3>
            <p className="text-xs text-gray-400 capitalize">{member.role?.replace(/_/g,' ')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Order Target</label>
            <input
              type="number"
              value={form.order_target}
              onChange={e => setForm(f => ({ ...f, order_target: +e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              min={0}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount Target (₹)</label>
            <input
              type="number"
              value={form.amount_target}
              onChange={e => setForm(f => ({ ...f, amount_target: +e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              min={0}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            <MapPin className="w-3 h-3 inline mr-1" />Area / Locality
          </label>
          <input
            type="text"
            value={form.area_assigned}
            onChange={e => setForm(f => ({ ...f, area_assigned: e.target.value }))}
            placeholder="e.g. Anna Nagar, Adyar..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            <FileText className="w-3 h-3 inline mr-1" />Task Notes
          </label>
          <textarea
            value={form.task_notes}
            onChange={e => setForm(f => ({ ...f, task_notes: e.target.value }))}
            rows={3}
            placeholder="Special instructions..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onSave({ ...form, assigned_to: member.id })}
            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            <Save className="w-4 h-4" /> Save Assignment
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TaskAssign() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [taskDate, setTaskDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [modalMember, setModalMember] = useState<any>(null);

  // Fetch all active staff — exclude pure admin/finance roles
  const { data: salesTeam = [], isLoading: teamLoading } = useQuery({
    queryKey: ['sales-team-members', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('id, name, role, email, hub_id, hubs(name)')
        .in('role', ['field_executive', 'tele_caller', 'bde', 'nsm', 'rsh'])
        .neq('id', user?.id ?? '')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch existing assignments for the selected date
  const { data: assignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ['task-assignments', taskDate],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ff_task_assignments')
        .select('*')
        .eq('task_date', taskDate);
      if (error) throw error;
      return data || [];
    },
  });

  const assignmentMap = Object.fromEntries(assignments.map(a => [a.assigned_to, a]));

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const existing = assignmentMap[payload.assigned_to];
      if (existing) {
        const { error } = await (supabase as any)
          .from('ff_task_assignments')
          .update({
            order_target:  payload.order_target,
            amount_target: payload.amount_target,
            area_assigned: payload.area_assigned,
            task_notes:    payload.task_notes,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('ff_task_assignments')
          .insert({
            assigned_by:   user?.id,
            assigned_to:   payload.assigned_to,
            task_date:     taskDate,
            order_target:  payload.order_target,
            amount_target: payload.amount_target,
            area_assigned: payload.area_assigned,
            task_notes:    payload.task_notes,
            status:        'pending',
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Assignment saved ✓');
      setModalMember(null);
      qc.invalidateQueries({ queryKey: ['task-assignments', taskDate] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  });

  const totalAssigned = assignments.length;
  const totalCompleted = assignments.filter(a => a.status === 'completed').length;
  const totalOrders = assignments.reduce((s, a) => s + (a.completed_orders || 0), 0);
  const totalTarget = assignments.reduce((s, a) => s + (a.order_target || 0), 0);

  const roleColor: Record<string, string> = {
    field_executive: 'bg-blue-100 text-blue-700',
    bde:             'bg-purple-100 text-purple-700',
    tele_caller:     'bg-teal-100 text-teal-700',
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Task Assignment</h1>
          <p className="text-xs text-gray-500 mt-0.5">Assign daily targets to the sales & tele-caller team</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={taskDate}
            onChange={e => setTaskDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Team Members', value: salesTeam.length, icon: User, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Assigned Today', value: totalAssigned, icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Completed', value: totalCompleted, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Orders Done / Target', value: `${totalOrders}/${totalTarget}`, icon: Target, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
            <div className={`p-2 rounded-lg ${k.bg}`}>
              <k.icon className={`w-5 h-5 ${k.color}`} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{k.value}</p>
              <p className="text-xs text-gray-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Team table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Sales Team</h2>
          <button
            onClick={() => refetchAssignments()}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {teamLoading ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Loading team...</div>
        ) : salesTeam.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No sales team members found</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {salesTeam.map(member => {
              const assignment = assignmentMap[member.id];
              return (
                <div key={member.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                      {member.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{member.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor[member.role] || 'bg-gray-100 text-gray-600'}`}>
                          {member.role?.replace(/_/g,' ')}
                        </span>
                        {member.hubs?.name && (
                          <span className="text-xs text-gray-400">· {member.hubs.name}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {assignment ? (
                      <div className="text-right">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span><b>{assignment.order_target}</b> orders</span>
                          <span>·</span>
                          <span>₹<b>{Number(assignment.amount_target).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</b></span>
                          {assignment.area_assigned && <span className="text-gray-400">· {assignment.area_assigned}</span>}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          Done: {assignment.completed_orders || 0}/{assignment.order_target} orders
                        </div>
                        <div className="mt-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[assignment.status] || 'bg-gray-100 text-gray-500'}`}>
                            {assignment.status}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Not assigned</span>
                    )}
                    <button
                      onClick={() => setModalMember(member)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        assignment
                          ? 'border border-blue-200 text-blue-600 hover:bg-blue-50'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {assignment ? 'Edit' : <><Plus className="w-3.5 h-3.5" />Assign</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalMember && (
        <AssignModal
          member={modalMember}
          existing={assignmentMap[modalMember.id]}
          hubId={modalMember.hub_id}
          onClose={() => setModalMember(null)}
          onSave={(payload: any) => saveMutation.mutate(payload)}
        />
      )}
    </div>
  );
}
