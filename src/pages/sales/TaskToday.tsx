// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Target, CheckCircle2, Clock, TrendingUp,
  MapPin, FileText, Save, AlertCircle, Package, Lock, ListChecks,
} from 'lucide-react';

function ProgressRing({ value, max, size = 80 }: { value: number; max: number; size?: number }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={8} />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none" stroke={pct >= 1 ? '#16A34A' : '#2563EB'} strokeWidth={8}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize="14" fontWeight="700" fill={pct >= 1 ? '#16A34A' : '#1F2937'}>
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

export default function TaskToday() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [actualOrders, setActualOrders] = useState('');
  const [actualAmount, setActualAmount] = useState('');

  const { data: task, isLoading } = useQuery({
    queryKey: ['my-task-today', user?.id, today],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await (supabase as any)
        .from('ff_task_assignments')
        .select('*')
        .eq('assigned_to', user.id)
        .eq('task_date', today)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setActualOrders(String(data.completed_orders ?? ''));
        setActualAmount(String(data.completed_amount ?? ''));
      }
      return data;
    },
    enabled: !!user?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!task) throw new Error('No task assigned');
      const orders = parseInt(actualOrders) || 0;
      const amount  = parseFloat(actualAmount)  || 0;
      const status = orders >= task.order_target ? 'completed' : orders > 0 ? 'in_progress' : 'pending';
      const { error } = await (supabase as any)
        .from('ff_task_assignments')
        .update({ completed_orders: orders, completed_amount: amount, status })
        .eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Progress updated ✓');
      qc.invalidateQueries({ queryKey: ['my-task-today'] });
    },
    onError: (e: any) => toast.error(e.message || 'Update failed'),
  });

  const orderPct = task ? Math.min((parseInt(actualOrders) || 0) / task.order_target, 1) : 0;
  const amtPct   = task ? Math.min((parseFloat(actualAmount) || 0) / Number(task.amount_target), 1) : 0;

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-12 pt-2">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Today's Task</h1>
        <p className="text-xs text-gray-500 mt-0.5">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
      </div>

      {isLoading ? (
        <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Loading your task...</div>
      ) : !task ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 flex flex-col items-center text-center">
          <AlertCircle className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No task assigned yet for today</p>
          <p className="text-xs text-gray-400 mt-1">Your manager will assign targets. Check back soon.</p>
        </div>
      ) : (
        <>
          {/* Target cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Orders target */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Order Target</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{task.order_target}</p>
                  <p className="text-xs text-gray-400">orders today</p>
                </div>
                <ProgressRing value={parseInt(actualOrders) || 0} max={task.order_target} />
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${orderPct >= 1 ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${orderPct * 100}%` }}
                />
              </div>
            </div>

            {/* Amount target */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Amount Target</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">
                    ₹{Number(task.amount_target).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-gray-400">revenue today</p>
                </div>
                <ProgressRing value={parseFloat(actualAmount) || 0} max={Number(task.amount_target)} />
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${amtPct >= 1 ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${amtPct * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Task details */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Assignment Details</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {task.area_assigned && (
                <div className="flex items-start gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Area Assigned</p>
                    <p className="font-medium">{task.area_assigned}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2 text-gray-600">
                <Target className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Status</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    task.status === 'completed' ? 'bg-green-100 text-green-700' :
                    task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    task.status === 'missed' ? 'bg-red-100 text-red-600' :
                    'bg-amber-100 text-amber-700'
                  }`}>{task.status}</span>
                </div>
              </div>
            </div>
            {task.task_notes && (
              <div className="flex items-start gap-2 text-gray-600">
                <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Manager Notes</p>
                  <p className="text-sm mt-0.5 text-gray-700">{task.task_notes}</p>
                </div>
              </div>
            )}
          </div>


          {/* Daily Plan */}
          {task.plan_locked && Array.isArray(task.daily_plan) && task.daily_plan.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <ListChecks className="w-4 h-4 text-amber-500" />
                  Today's Plan
                </h2>
                <span className="flex items-center gap-1 text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-full">
                  <Lock className="w-3 h-3" /> Locked by Manager
                </span>
              </div>
              <div className="space-y-2">
                {(task.daily_plan as string[]).map((item: string, i: number) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-lg">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Update actuals */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Update Progress</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Orders Completed
                </label>
                <input
                  type="number"
                  value={actualOrders}
                  onChange={e => setActualOrders(e.target.value)}
                  placeholder="0"
                  min={0}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Amount Collected (₹)
                </label>
                <input
                  type="number"
                  value={actualAmount}
                  onChange={e => setActualAmount(e.target.value)}
                  placeholder="0"
                  min={0}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? 'Saving...' : 'Save Progress'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
